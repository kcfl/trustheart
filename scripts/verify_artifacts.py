"""Verify cryptographic, model, and API identity artifacts (read-only).

Checks:
  1. SHA-256 of models/*.joblib, feature_stats.json, trust_stats.json vs manifest.json.
  2. For all 8 (space, target): config_name, model column count, platt_a, platt_b
     from joblib vs models/final_selection.md.
  3. Real FastAPI TestClient for both modes x 4 samples + p10 with 3 features removed x 4 targets:
     - base + sum(all contributions) + other_total == logit_model (1e-9)
     - expit(logit_model) == calibrated_probability (1e-9)
     - calibrated_probability == ml.predict value (1e-9)
     - model_info.config_name == config_name in final_selection.md
     - model_info.n_features == user-facing features (BBB counts once)
     - model_info.features_used has no duplicates and no Exertional CP
  4. docs/api_examples/quick_p10.json and docs/api_examples/full_median_3missing.json:
     same checks 3 applied to stored files.

Prints check counts, pass count, max residuals, and table for p10 quick mode.
Exits 1 on fail, 0 on pass.
"""

import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import joblib
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from scipy.special import expit

from backend.app.config import FULL_HUMAN_FEATURES
from backend.app.main import app
from backend.app.service import ModelService, get_model_service
from ml.config import SPACES, TARGETS, VHD_ORDINAL_MAPPING
from ml.predict import predict_one


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def parse_final_selection_md(md_path: Path) -> dict[tuple[str, str], dict[str, Any]]:
    """Parse selection table from final_selection.md."""
    res = {}
    with open(md_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line.startswith("|") or "Space" in line or "---" in line:
                continue
            parts = [p.strip() for p in line.strip().strip("|").split("|")]
            if len(parts) >= 8:
                space = parts[0].replace("`", "")
                target = parts[1].replace("*", "")
                config_name = "|".join(parts[2:-5]).replace("`", "")
                n_cols = int(parts[-3])
                platt_a = float(parts[-2])
                platt_b = float(parts[-1])
                res[(space, target)] = {
                    "config_name": config_name,
                    "n_cols": n_cols,
                    "platt_a": platt_a,
                    "platt_b": platt_b,
                }
    return res


def format_inputs_for_model(
    inputs: dict[str, Any], service: ModelService, feature_list: list[str]
) -> pd.DataFrame:
    filled = dict(inputs)
    for feat in FULL_HUMAN_FEATURES:
        if feat not in filled or filled[feat] is None:
            if feat == "Sex":
                filled[feat] = (
                    "Male" if service.feature_stats["Sex"]["median"] == 1.0 else "Female"
                )
            elif feat == "VHD":
                filled[feat] = "N"
            elif feat == "BBB":
                filled[feat] = "N"
            elif (
                feat in service.feature_stats
                and service.feature_stats[feat].get("is_binary", False)
            ):
                filled[feat] = bool(service.feature_stats[feat]["median"] == 1.0)
            elif feat in service.feature_stats:
                filled[feat] = float(service.feature_stats[feat]["median"])
            else:
                filled[feat] = 0.0

    row: dict[str, float] = {}
    for f in feature_list:
        if f == "Sex":
            val = filled.get("Sex", "Male")
            row[f] = 1.0 if str(val).strip().lower() == "male" else 0.0
        elif f == "VHD":
            val = filled.get("VHD", "N")
            row[f] = float(VHD_ORDINAL_MAPPING.get(str(val).strip().lower(), 0))
        elif f == "BBB_LBBB":
            val = filled.get("BBB", "N")
            row[f] = 1.0 if str(val).strip() == "LBBB" else 0.0
        elif f == "BBB_RBBB":
            val = filled.get("BBB", "N")
            row[f] = 1.0 if str(val).strip() == "RBBB" else 0.0
        elif f in filled:
            val = filled[f]
            if isinstance(val, bool):
                row[f] = 1.0 if val else 0.0
            else:
                row[f] = float(val)
        else:
            row[f] = 0.0
    return pd.DataFrame([row])


def main() -> None:
    models_dir = REPO_ROOT / "models"
    manifest_path = models_dir / "manifest.json"
    final_sel_path = models_dir / "final_selection.md"

    checks_run = 0
    checks_passed = 0
    failures: list[str] = []

    max_res_linear = 0.0
    max_res_expit = 0.0
    max_res_ml_predict = 0.0

    def check(condition: bool, desc: str) -> None:
        nonlocal checks_run, checks_passed
        checks_run += 1
        if condition:
            checks_passed += 1
            print(f"PASS: {desc}")
        else:
            failures.append(desc)
            print(f"FAIL: {desc}")

    # =========================================================================
    # CHECK 1: Manifest SHA-256 Checksums
    # =========================================================================
    print("--- 1. Checking SHA-256 digests in manifest.json ---")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    manifest_files = manifest.get("files", {})

    for rel_path, expected_hash in manifest_files.items():
        fp = REPO_ROOT / rel_path
        if not fp.exists():
            fp = models_dir / Path(rel_path).name
        actual_hash = compute_sha256(fp)
        check(actual_hash == expected_hash, f"SHA-256 of {rel_path} equals manifest")

    # =========================================================================
    # CHECK 2: final_selection.md parity with joblib artifacts
    # =========================================================================
    print("\n--- 2. Checking joblib attributes vs final_selection.md ---")
    final_sel = parse_final_selection_md(final_sel_path)

    for space in SPACES:
        for target in TARGETS:
            joblib_path = models_dir / f"{space}_{target}.joblib"
            artifact = joblib.load(joblib_path)
            md_entry = final_sel.get((space, target))
            check(md_entry is not None, f"Found {space} {target} in final_selection.md")
            if not md_entry:
                continue

            # config_name
            cfg = str(artifact.get("config_name"))
            check(
                cfg == md_entry["config_name"],
                f"[{space}|{target}] config_name ({cfg}) == md ({md_entry['config_name']})",
            )

            # number of model columns
            n_cols = len(artifact.get("feature_list", []))
            check(
                n_cols == md_entry["n_cols"],
                f"[{space}|{target}] model columns ({n_cols}) == md ({md_entry['n_cols']})",
            )

            # platt_a, platt_b with tolerance 1e-3
            pa = float(artifact.get("platt_a"))
            pb = float(artifact.get("platt_b"))
            check(
                math.isclose(pa, md_entry["platt_a"], abs_tol=1e-3),
                f"[{space}|{target}] platt_a ({pa:.4f}) == md ({md_entry['platt_a']:.4f})",
            )
            check(
                math.isclose(pb, md_entry["platt_b"], abs_tol=1e-3),
                f"[{space}|{target}] platt_b ({pb:.4f}) == md ({md_entry['platt_b']:.4f})",
            )

    # =========================================================================
    # CHECK 3: Real FastAPI TestClient identity, calibration, and metadata
    # =========================================================================
    print("\n--- 3. Checking live TestClient predictions across modes & samples ---")
    client = TestClient(app)
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()["samples"]

    # 4 standard samples
    cases: list[tuple[str, dict[str, Any]]] = [
        (s["label"], dict(s["inputs"])) for s in samples
    ]

    # p10 sample with 3 features removed
    p10_full = next(s for s in samples if s["label"] == "p10")
    p10_3missing = dict(p10_full["inputs"])
    for dropped in ["Typical Chest Pain", "HTN", "DM"]:
        p10_3missing.pop(dropped, None)
    cases.append(("p10_3missing", p10_3missing))

    service = get_model_service()
    p10_quick_rows: list[dict[str, Any]] = []

    for mode in ["quick", "full"]:
        space = "quick" if mode == "quick" else "auto"
        for case_label, case_inputs in cases:
            res = client.post("/api/predict", json={"mode": mode, "inputs": case_inputs})
            check(res.status_code == 200, f"POST /api/predict 200 for {mode} {case_label}")
            if res.status_code != 200:
                continue

            preds = res.json()["predictions"]
            for target in TARGETS:
                p_obj = preds[target]
                base = float(p_obj["base"])
                top_10 = sum(c["contribution"] for c in p_obj["contributions"])
                other_total = float(p_obj["other_total"])
                sum_contrib = top_10 + other_total
                logit_model = float(p_obj["logit_model"])
                cal_p = float(p_obj["calibrated_probability"])

                # Residuals
                r_linear = abs((base + sum_contrib) - logit_model)
                r_expit = abs(float(expit(logit_model)) - cal_p)
                max_res_linear = max(max_res_linear, r_linear)
                max_res_expit = max(max_res_expit, r_expit)

                # 3a. Linear decomposition: base + sum == logit_model (1e-9)
                check(
                    math.isclose(base + sum_contrib, logit_model, abs_tol=1e-9),
                    f"[{mode}|{case_label}|{target}] linear identity (res={r_linear:.2e})",
                )

                # 3b. expit(logit_model) == calibrated_probability (1e-9)
                check(
                    math.isclose(float(expit(logit_model)), cal_p, abs_tol=1e-9),
                    f"[{mode}|{case_label}|{target}] expit(logit)==p_cal (res={r_expit:.2e})",
                )

                # 3c. calibrated_probability == ml.predict value (1e-9)
                artifact = service.models[(space, target)]
                feat_list = artifact["feature_list"]
                X_df = format_inputs_for_model(case_inputs, service, feat_list)
                p_ml = float(predict_one(space, target, X_df)[0])
                r_ml = abs(cal_p - p_ml)
                max_res_ml_predict = max(max_res_ml_predict, r_ml)
                check(
                    math.isclose(cal_p, p_ml, abs_tol=1e-9),
                    f"[{mode}|{case_label}|{target}] cal_p==ml.predict (res={r_ml:.2e})",
                )

                # 3d. model_info.config_name == config_name in final_selection.md
                expected_cfg = final_sel[(space, target)]["config_name"]
                actual_cfg = p_obj["model_info"]["config_name"]
                check(
                    actual_cfg == expected_cfg,
                    f"[{mode}|{case_label}|{target}] model_info.config_name ({actual_cfg}=={expected_cfg})",
                )

                # 3e. model_info.n_features == user-facing features (BBB counts once)
                actual_n = p_obj["model_info"]["n_features"]
                expected_n = 7 if space == "quick" or expected_cfg.startswith("compact") else 54
                check(
                    actual_n == expected_n,
                    f"[{mode}|{case_label}|{target}] user-facing features ({actual_n}=={expected_n})",
                )

                # 3f. features_used has no duplicates and no Exertional CP
                feats_used = p_obj["model_info"]["features_used"]
                check(
                    len(feats_used) == len(set(feats_used)),
                    f"[{mode}|{case_label}|{target}] no duplicates in features_used",
                )
                check(
                    "Exertional CP" not in feats_used,
                    f"[{mode}|{case_label}|{target}] no Exertional CP in features_used",
                )

                # Collect p10 quick row for table
                if mode == "quick" and case_label == "p10":
                    p10_quick_rows.append(
                        {
                            "target": target,
                            "config_name": actual_cfg,
                            "base": base,
                            "sum_contrib": sum_contrib,
                            "logit_model": logit_model,
                            "expit_logit": float(expit(logit_model)),
                            "calibrated_p": cal_p,
                        }
                    )

    # =========================================================================
    # CHECK 4: Stored API Example Files
    # =========================================================================
    print("\n--- 4. Checking stored API example JSON files ---")
    example_files = [
        ("quick", REPO_ROOT / "docs" / "api_examples" / "quick_p10.json"),
        ("auto", REPO_ROOT / "docs" / "api_examples" / "full_median_3missing.json"),
    ]

    for space, ex_path in example_files:
        check(ex_path.is_file(), f"{ex_path.name} exists")
        if not ex_path.is_file():
            continue
        with open(ex_path, "r", encoding="utf-8") as f:
            ex_data = json.load(f)

        ex_preds = ex_data["predictions"]
        for target in TARGETS:
            p_obj = ex_preds[target]
            base = float(p_obj["base"])
            top_10 = sum(c["contribution"] for c in p_obj["contributions"])
            other_total = float(p_obj["other_total"])
            sum_contrib = top_10 + other_total
            logit_model = float(p_obj["logit_model"])
            cal_p = float(p_obj["calibrated_probability"])

            r_linear = abs((base + sum_contrib) - logit_model)
            r_expit = abs(float(expit(logit_model)) - cal_p)
            max_res_linear = max(max_res_linear, r_linear)
            max_res_expit = max(max_res_expit, r_expit)

            # Linear identity
            check(
                math.isclose(base + sum_contrib, logit_model, abs_tol=1e-9),
                f"[{ex_path.name}|{target}] linear identity (res={r_linear:.2e})",
            )
            # expit
            check(
                math.isclose(float(expit(logit_model)), cal_p, abs_tol=1e-9),
                f"[{ex_path.name}|{target}] expit(logit)==p_cal (res={r_expit:.2e})",
            )
            # config_name
            expected_cfg = final_sel[(space, target)]["config_name"]
            actual_cfg = p_obj["model_info"]["config_name"]
            check(
                actual_cfg == expected_cfg,
                f"[{ex_path.name}|{target}] config_name ({actual_cfg}=={expected_cfg})",
            )
            # n_features
            expected_n = 7 if space == "quick" or expected_cfg.startswith("compact") else 54
            actual_n = p_obj["model_info"]["n_features"]
            check(
                actual_n == expected_n,
                f"[{ex_path.name}|{target}] n_features ({actual_n}=={expected_n})",
            )
            # features_used
            feats_used = p_obj["model_info"]["features_used"]
            check(
                len(feats_used) == len(set(feats_used)),
                f"[{ex_path.name}|{target}] no duplicates in features_used",
            )
            check(
                "Exertional CP" not in feats_used,
                f"[{ex_path.name}|{target}] no Exertional CP",
            )

    # =========================================================================
    # SUMMARY & P10 TABLE
    # =========================================================================
    print("\n" + "=" * 90)
    print("SUMMARY")
    print("=" * 90)
    print(f"Total checks run   : {checks_run}")
    print(f"Total checks passed : {checks_passed}")
    print(f"Total checks failed : {len(failures)}")
    print(f"Max |(base + sum_contrib) - logit_model| : {max_res_linear:.4e}")
    print(f"Max |expit(logit_model) - calibrated_p|  : {max_res_expit:.4e}")
    print(f"Max |calibrated_p - ml.predict|          : {max_res_ml_predict:.4e}")

    print("\n" + "=" * 120)
    print("SAMPLE P10 IN QUICK MODE - PREDICTION DECOMPOSITION TABLE")
    print("=" * 120)
    tbl_header = (
        f"{'Target':6s} | {'Config Name':20s} | {'Base (w0)':12s} | "
        f"{'Sum(Contribs)':14s} | {'Logit Model':12s} | "
        f"{'expit(Logit)':14s} | {'Calibrated P':14s}"
    )
    print(tbl_header)
    print("-" * 120)
    for r in p10_quick_rows:
        row_str = (
            f"{r['target']:6s} | {r['config_name']:20s} | {r['base']:12.6f} | "
            f"{r['sum_contrib']:14.6f} | {r['logit_model']:12.6f} | "
            f"{r['expit_logit']:14.6f} | {r['calibrated_p']:14.6f}"
        )
        print(row_str)
    print("=" * 120)

    if failures:
        print("\nFAILURES ENCOUNTERED:")
        for f_desc in failures:
            print(f"  - {f_desc}")
        print("\nFINAL RESULT: FAIL")
        sys.exit(1)
    else:
        print("\nFINAL RESULT: PASS")
        sys.exit(0)


if __name__ == "__main__":
    main()
