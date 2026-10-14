"""Diagnose numerical identity and residuals across modes, targets, and sample patients."""

import logging
logging.disable(logging.CRITICAL)
import re
import sys
from pathlib import Path

# Ensure repo root is on sys.path
repo_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(repo_root))

import numpy as np
import pandas as pd
from scipy.special import expit
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import FULL_HUMAN_FEATURES
from ml.config import SPACES, TARGETS, VHD_ORDINAL_MAPPING
from ml.predict import load_model, predict_one


def parse_final_selection_md() -> dict[tuple[str, str], tuple[float, float]]:
    """Parse Platt slope and intercept from models/final_selection.md."""
    md_path = repo_root / "models" / "final_selection.md"
    results = {}
    with open(md_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line.startswith("|") or "Space" in line or "---" in line:
                continue
            parts = [p.strip() for p in line.split("|") if p.strip()]
            if len(parts) >= 8:
                space = parts[0].replace("`", "")
                target = parts[1].replace("*", "")
                platt_a = float(parts[-2])
                platt_b = float(parts[-1])
                results[(space, target)] = (platt_a, platt_b)
    return results


def sample_inputs_to_df(inputs: dict, feature_list: list[str]) -> pd.DataFrame:
    """Convert human-readable inputs dictionary to DataFrame matching clean features."""
    row = {}
    for f in feature_list:
        if f == "Sex":
            val = inputs.get("Sex", "Male")
            row[f] = 1.0 if str(val).strip().lower() == "male" else 0.0
        elif f == "VHD":
            val = inputs.get("VHD", "N")
            row[f] = float(VHD_ORDINAL_MAPPING.get(str(val).strip().lower(), 0))
        elif f == "BBB_LBBB":
            val = inputs.get("BBB", "N")
            row[f] = 1.0 if str(val).strip() == "LBBB" else 0.0
        elif f == "BBB_RBBB":
            val = inputs.get("BBB", "N")
            row[f] = 1.0 if str(val).strip() == "RBBB" else 0.0
        elif f in inputs:
            val = inputs[f]
            if isinstance(val, bool):
                row[f] = 1.0 if val else 0.0
            else:
                row[f] = float(val)
        else:
            row[f] = 0.0
    return pd.DataFrame([row])


def main() -> None:
    client = TestClient(app)
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()["samples"]

    final_sel = parse_final_selection_md()

    rows = []
    res_raw_list = []
    res_p_list = []
    res_linear_list = []

    print("=" * 160)
    print("TRUSTHEART 3D - IDENTITY DIAGNOSTICS TABLE")
    print("=" * 160)

    header = (
        f"{'Mode':5s} | {'Sample':12s} | {'Tgt':4s} | "
        f"{'raw_pipe':10s} | {'raw_man':10s} | "
        f"{'platt_a (joblib/md)':21s} | {'platt_b (joblib/md)':21s} | "
        f"{'p_ml':10s} | {'p_api':10s} | "
        f"{'logit_api':10s} | {'base':10s} | {'sum_all_c':10s} | "
        f"{'res_raw':10s} | {'res_p':10s} | {'res_linear':10s}"
    )
    print(header)
    print("-" * 160)

    for mode in ["quick", "full"]:
        space = "quick" if mode == "quick" else "auto"
        for s in samples:
            s_label = s["label"]
            s_inputs = s["inputs"]
            s_case_id = s["case_id"]

            # Real API call
            api_res = client.post(
                "/api/predict",
                json={"mode": mode, "inputs": s_inputs, "case_id": s_case_id},
            )
            assert api_res.status_code == 200
            api_data = api_res.json()

            for target in TARGETS:
                # 1. Joblib artifact
                artifact = load_model(space, target, models_dir=repo_root / "models")
                pipeline = artifact["pipeline"]
                feature_list = artifact["feature_list"]
                platt_a_joblib = float(artifact["platt_a"])
                platt_b_joblib = float(artifact["platt_b"])

                # From final_selection.md
                platt_a_md, platt_b_md = final_sel.get((space, target), (0.0, 0.0))

                # 2. Raw from pipeline
                X_df = sample_inputs_to_df(s_inputs, feature_list)
                raw_pipeline = float(pipeline.predict_proba(X_df[feature_list])[0, 1])

                # 3. Raw manual
                scaler = pipeline.named_steps["scaler"]
                clf = pipeline.named_steps["classifier"]
                x_vec = X_df[feature_list].values[0]
                z_vec = (x_vec - scaler.mean_) / scaler.scale_
                score_manual = float(np.dot(clf.coef_[0], z_vec) + clf.intercept_[0])
                raw_manual = float(expit(score_manual))

                # 4. ml.predict calibrated prob
                # Need complete clean feature frame for ml.predict
                clean_cols = list(load_model("auto", "CAD", models_dir=repo_root / "models")["feature_list"])
                X_full_df = sample_inputs_to_df(s_inputs, clean_cols)
                p_ml_predict = float(predict_one(space, target, X_full_df, models_dir=repo_root / "models")[0])

                # 5. API response fields
                pred_api = api_data["predictions"][target]
                p_api = float(pred_api["calibrated_probability"])
                logit_api = float(pred_api["logit_model"])
                base_api = float(pred_api["base"])
                top_10_sum = sum(c["contribution"] for c in pred_api["contributions"])
                sum_contrib = float(top_10_sum + pred_api["other_total"])

                # 6. Residuals
                res_raw = abs(raw_pipeline - raw_manual)
                res_p = abs(p_ml_predict - p_api)
                res_linear = abs(logit_api - (base_api + sum_contrib))

                res_raw_list.append(res_raw)
                res_p_list.append(res_p)
                res_linear_list.append(res_linear)

                row_str = (
                    f"{mode:5s} | {s_label:12s} | {target:4s} | "
                    f"{raw_pipeline:10.8f} | {raw_manual:10.8f} | "
                    f"{platt_a_joblib:8.4f} / {platt_a_md:8.4f} | "
                    f"{platt_b_joblib:8.4f} / {platt_b_md:8.4f} | "
                    f"{p_ml_predict:10.8f} | {p_api:10.8f} | "
                    f"{logit_api:10.6f} | {base_api:10.6f} | {sum_contrib:10.6f} | "
                    f"{res_raw:10.2e} | {res_p:10.2e} | {res_linear:10.2e}"
                )
                print(row_str)

    print("-" * 160)
    print(f"MAX RESIDUALS across all 32 configurations:")
    print(f"  Max |raw_pipeline - raw_manual|          : {max(res_raw_list):.4e}")
    print(f"  Max |p_ml_predict - p_api|               : {max(res_p_list):.4e}")
    print(f"  Max |logit_api - (base + sum_contrib)|   : {max(res_linear_list):.4e}")
    print("=" * 160)


if __name__ == "__main__":
    main()
