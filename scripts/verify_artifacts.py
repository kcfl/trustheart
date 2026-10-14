"""Verify cryptographic, model, and API identity artifacts (read-only).

Checks:
  1. Parsing models/final_selection.md robustly (8 rows, platt_a > 0).
  2. SHA-256 of every file listed in models/manifest.json.
  3. Joblib model artifacts (keys from manifest.json) match final_selection.md.
  4. Live FastAPI TestClient predictions across modes, samples, and targets.
  5. Stored API examples in docs/api_examples.
  6. Repository cleanliness: 'clinical_plus' appears nowhere in the repository.

Every check is routed through check(section, name, ok, detail).
Per-section counts and total are printed, and total is asserted against printed lines.
"""

import argparse
import hashlib
import json
import math
import os
import sys
from pathlib import Path
from typing import Any

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import joblib
import pandas as pd
from scipy.special import expit, logit

from backend.app.config import FULL_HUMAN_FEATURES
from ml.config import TARGETS, VHD_ORDINAL_MAPPING
from ml.predict import predict_one

EXPECTED_BASE_RATES: dict[str, float] = {
    "CAD": 216 / 303,
    "LAD": 177 / 303,
    "LCX": 119 / 303,
    "RCA": 114 / 303,
}


def compute_sha256(filepath: Path) -> str:
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def parse_final_selection_md(md_path: Path) -> list[dict[str, Any]]:
    """Parse selection table from final_selection.md robustly."""
    rows: list[dict[str, Any]] = []
    with open(md_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line.startswith("|") or "---" in line or "Space" in line:
                continue
            parts = [p.strip() for p in line.strip().strip("|").split("|")]
            # Table layout:
            # Space | Target | Selected Configuration | Featureset | Model Architecture | Features Used | Platt Slope (a) | Platt Intercept (b)
            if len(parts) >= 8:
                space = parts[0].strip("` ")
                target = parts[1].strip("*` ")
                config_name = "|".join(parts[2:-5]).strip("` ")
                n_features = int(parts[-3].strip("` "))
                platt_a = float(parts[-2].strip("` "))
                platt_b = float(parts[-1].strip("` "))
                rows.append(
                    {
                        "space": space,
                        "target": target,
                        "config_name": config_name,
                        "n_features": n_features,
                        "platt_a": platt_a,
                        "platt_b": platt_b,
                    }
                )
    return rows


def format_inputs_for_model(
    inputs: dict[str, Any], feature_stats: dict[str, Any], feature_list: list[str]
) -> pd.DataFrame:
    filled = dict(inputs)
    for feat in FULL_HUMAN_FEATURES:
        if feat not in filled or filled[feat] is None:
            if feat == "Sex":
                filled[feat] = (
                    "Male" if feature_stats["Sex"]["median"] == 1.0 else "Female"
                )
            elif feat == "VHD":
                filled[feat] = "N"
            elif feat == "BBB":
                filled[feat] = "N"
            elif (
                feat in feature_stats
                and feature_stats[feat].get("is_binary", False)
            ):
                filled[feat] = bool(feature_stats[feat]["median"] == 1.0)
            elif feat in feature_stats:
                filled[feat] = float(feature_stats[feat]["median"])
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


def verify_all(
    models_dir: Path | None = None,
    examples_dir: Path | None = None,
    repo_root: Path | None = None,
    skip_live: bool = False,
    skip_repo_search: bool = False,
) -> tuple[bool, int, int, dict[str, dict[str, int]]]:
    """Execute all artifact, model, prediction, and repository checks."""
    if repo_root is None:
        repo_root = REPO_ROOT
    if models_dir is None:
        models_dir = repo_root / "models"
    if examples_dir is None:
        examples_dir = repo_root / "docs" / "api_examples"

    manifest_path = models_dir / "manifest.json"
    final_sel_path = models_dir / "final_selection.md"
    trust_stats_path = models_dir / "trust_stats.json"
    feature_stats_path = models_dir / "feature_stats.json"

    printed_lines: list[str] = []
    section_counts: dict[str, dict[str, int]] = {}

    def check(section: str, name: str, ok: bool, detail: str = "") -> bool:
        if section not in section_counts:
            section_counts[section] = {"pass": 0, "fail": 0}
        status = "PASS" if ok else "FAIL"
        section_counts[section]["pass" if ok else "fail"] += 1
        detail_str = f" ({detail})" if detail else ""
        line = f"{status}: [{section}] {name}{detail_str}"
        printed_lines.append(line)
        print(line)
        return ok

    max_res_linear = 0.0
    max_res_expit = 0.0
    max_res_raw_platt = 0.0
    max_res_ml_predict = 0.0
    p10_quick_rows: list[dict[str, Any]] = []

    # =========================================================================
    # 1. Parse final_selection.md
    # =========================================================================
    print("--- 1. Parsing models/final_selection.md ---")
    parsed_rows = parse_final_selection_md(final_sel_path)
    print("Parsed final_selection.md rows:")
    for r in parsed_rows:
        print(
            f"  (space={r['space']}, target={r['target']}, config={r['config_name']}, "
            f"n_features={r['n_features']}, platt_a={r['platt_a']:.4f}, platt_b={r['platt_b']:.4f})"
        )

    check(
        "final_selection_md",
        "row_count >= 8",
        len(parsed_rows) >= 8,
        f"parsed {len(parsed_rows)} rows",
    )
    for r in parsed_rows:
        check(
            "final_selection_md",
            f"platt_a > 0 for {r['space']} {r['target']}",
            r["platt_a"] > 0,
            f"platt_a={r['platt_a']}",
        )

    final_sel: dict[tuple[str, str], dict[str, Any]] = {
        (r["space"], r["target"]): r for r in parsed_rows
    }

    # =========================================================================
    # 2. Manifest SHA-256 Checksums
    # =========================================================================
    print("\n--- 2. Checking SHA-256 digests in manifest.json ---")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    manifest_files: dict[str, str] = manifest.get("files", {})

    for rel_path, expected_hash in manifest_files.items():
        fp = repo_root / rel_path
        if not fp.exists():
            fp = models_dir / Path(rel_path).name
        exists = fp.is_file()
        check(
            "manifest_sha256",
            f"file exists: {rel_path}",
            exists,
            f"path={fp}",
        )
        if exists:
            actual_hash = compute_sha256(fp)
            check(
                "manifest_sha256",
                f"SHA-256 {rel_path}",
                actual_hash == expected_hash,
                f"actual={actual_hash[:8]}... expected={expected_hash[:8]}...",
            )

    # Load stats
    with open(trust_stats_path, "r", encoding="utf-8") as f:
        trust_stats = json.load(f)
    with open(feature_stats_path, "r", encoding="utf-8") as f:
        feature_stats = json.load(f)

    # =========================================================================
    # 3. Joblib Model Artifacts vs final_selection.md
    # =========================================================================
    print("\n--- 3. Checking joblib attributes vs final_selection.md ---")
    model_keys = [k for k in manifest_files.keys() if k.endswith(".joblib")]
    check(
        "model_artifacts",
        "model keys found in manifest",
        len(model_keys) == 8,
        f"count={len(model_keys)}",
    )

    for rel_path in model_keys:
        model_file = repo_root / rel_path
        if not model_file.exists():
            model_file = models_dir / Path(rel_path).name
        stem = model_file.stem  # e.g. "auto_CAD" or "quick_CAD"
        parts = stem.split("_")
        space, target = parts[0], parts[1]

        md_entry = final_sel.get((space, target))
        check(
            "model_artifacts",
            f"entry in final_selection for {space} {target}",
            md_entry is not None,
            f"file={model_file.name}",
        )
        if not md_entry:
            continue

        artifact = joblib.load(model_file)
        cfg = str(artifact.get("config_name"))
        check(
            "model_artifacts",
            f"[{space}|{target}] config_name",
            cfg == md_entry["config_name"],
            f"{cfg} == {md_entry['config_name']}",
        )

        n_cols = len(artifact.get("feature_list", []))
        check(
            "model_artifacts",
            f"[{space}|{target}] column count",
            n_cols == md_entry["n_features"],
            f"{n_cols} == {md_entry['n_features']}",
        )

        pa = float(artifact.get("platt_a"))
        pb = float(artifact.get("platt_b"))
        check(
            "model_artifacts",
            f"[{space}|{target}] platt_a",
            math.isclose(pa, md_entry["platt_a"], abs_tol=1e-3),
            f"actual={pa:.4f} expected={md_entry['platt_a']:.4f}",
        )
        check(
            "model_artifacts",
            f"[{space}|{target}] platt_b",
            math.isclose(pb, md_entry["platt_b"], abs_tol=1e-3),
            f"actual={pb:.4f} expected={md_entry['platt_b']:.4f}",
        )

    # Helper function to check a prediction response object
    def check_predictions(
        section: str,
        ident: str,
        space: str,
        preds: dict[str, Any],
        consistency: dict[str, Any] | None,
        case_inputs: dict[str, Any] | None = None,
        collect_p10_table: bool = False,
    ) -> None:
        nonlocal max_res_linear, max_res_expit, max_res_raw_platt, max_res_ml_predict
        for target in TARGETS:
            if target not in preds:
                check(section, f"{ident}|{target} in predictions", False, "target missing")
                continue

            p_obj = preds[target]
            base = float(p_obj["base"])
            top_10 = sum(c["contribution"] for c in p_obj["contributions"])
            other_total = float(p_obj["other_total"])
            sum_contrib = top_10 + other_total
            logit_model = float(p_obj["logit_model"])
            cal_p = float(p_obj["calibrated_probability"])
            raw_p = float(p_obj["raw_probability"])
            base_rate = float(p_obj["base_rate"])

            # 1. Linear identity
            r_linear = abs((base + sum_contrib) - logit_model)
            max_res_linear = max(max_res_linear, r_linear)
            check(
                section,
                f"{ident}|{target} linear identity",
                r_linear < 1e-9,
                f"res={r_linear:.2e}",
            )

            # 2. expit identity
            r_expit = abs(float(expit(logit_model)) - cal_p)
            max_res_expit = max(max_res_expit, r_expit)
            check(
                section,
                f"{ident}|{target} expit(logit)==p_cal",
                r_expit < 1e-9,
                f"res={r_expit:.2e}",
            )

            # 3. Platt scaling identity (raw_probability -> calibrated_probability)
            md_entry = final_sel.get((space, target))
            if md_entry:
                pa, pb = md_entry["platt_a"], md_entry["platt_b"]
                expected_cal_p = float(expit(pa * float(logit(raw_p)) + pb))
                r_raw = abs(expected_cal_p - cal_p)
                max_res_raw_platt = max(max_res_raw_platt, r_raw)
                check(
                    section,
                    f"{ident}|{target} raw->calibrated Platt identity",
                    r_raw < 2e-3,
                    f"res={r_raw:.2e}",
                )

            # 4. Base rate match
            expected_br = EXPECTED_BASE_RATES[target]
            r_br = abs(base_rate - expected_br)
            check(
                section,
                f"{ident}|{target} base_rate",
                r_br < 1e-9,
                f"actual={base_rate:.4f} expected={expected_br:.4f}",
            )

            # 5. Config name match
            if md_entry:
                actual_cfg = p_obj["model_info"]["config_name"]
                check(
                    section,
                    f"{ident}|{target} model_info.config_name",
                    actual_cfg == md_entry["config_name"],
                    f"{actual_cfg} == {md_entry['config_name']}",
                )

            # 6. n_features match
            expected_n = (
                7
                if space == "quick"
                or (md_entry and md_entry["config_name"].startswith("compact"))
                else 54
            )
            actual_n = p_obj["model_info"]["n_features"]
            check(
                section,
                f"{ident}|{target} model_info.n_features",
                actual_n == expected_n,
                f"{actual_n} == {expected_n}",
            )

            # 7. features_used: no duplicates, no Exertional CP
            feats_used = p_obj["model_info"]["features_used"]
            check(
                section,
                f"{ident}|{target} no duplicates in features_used",
                len(feats_used) == len(set(feats_used)),
                f"count={len(feats_used)}",
            )
            check(
                section,
                f"{ident}|{target} no Exertional CP in features_used",
                "Exertional CP" not in feats_used,
            )

            # 8. Stability tags match trust_stats.json
            stab_feature_map = (
                trust_stats.get("stability_tags", {})
                .get(space, {})
                .get(target, {})
                .get("features", {})
            )
            for c in p_obj["contributions"]:
                f_name = c["feature"]
                expected_tag = stab_feature_map.get(f_name, {}).get("tag")
                actual_tag = c.get("stability_tag")
                check(
                    section,
                    f"{ident}|{target}|{f_name} stability_tag",
                    actual_tag == expected_tag,
                    f"actual={actual_tag} expected={expected_tag}",
                )

            # 9. ml.predict value match (if inputs provided)
            if case_inputs is not None:
                joblib_path = models_dir / f"{space}_{target}.joblib"
                art = joblib.load(joblib_path)
                feat_list = art["feature_list"]
                X_df = format_inputs_for_model(case_inputs, feature_stats, feat_list)
                p_ml = float(predict_one(space, target, X_df)[0])
                r_ml = abs(cal_p - p_ml)
                max_res_ml_predict = max(max_res_ml_predict, r_ml)
                check(
                    section,
                    f"{ident}|{target} cal_p==ml.predict",
                    r_ml < 1e-9,
                    f"res={r_ml:.2e}",
                )

            # Collect p10 table
            if collect_p10_table:
                p10_quick_rows.append(
                    {
                        "target": target,
                        "config_name": p_obj["model_info"]["config_name"],
                        "base": base,
                        "sum_contrib": sum_contrib,
                        "logit_model": logit_model,
                        "expit_logit": float(expit(logit_model)),
                        "calibrated_p": cal_p,
                    }
                )

        # 10. Consistency upper bound
        if consistency is not None:
            vessel_probs = [
                preds[t]["calibrated_probability"] for t in ("LAD", "LCX", "RCA") if t in preds
            ]
            if len(vessel_probs) == 3:
                up_expected = min(1.0, sum(vessel_probs))
                up_actual = float(consistency["upper"])
                r_up = abs(up_expected - up_actual)
                check(
                    section,
                    f"{ident} consistency.upper vs sum of vessels",
                    r_up < 1e-9,
                    f"res={r_up:.2e}",
                )

    # =========================================================================
    # 4. Live FastAPI TestClient Predictions
    # =========================================================================
    if not skip_live:
        print("\n--- 4. Checking live TestClient predictions across modes & samples ---")
        from fastapi.testclient import TestClient
        from backend.app.main import app

        client = TestClient(app)
        samples_res = client.get("/api/samples")
        assert samples_res.status_code == 200
        samples = samples_res.json()["samples"]

        cases: list[tuple[str, dict[str, Any]]] = [
            (s["label"], dict(s["inputs"])) for s in samples
        ]
        p10_full = next(s for s in samples if s["label"] == "p10")
        p10_3missing = dict(p10_full["inputs"])
        for dropped in ["Typical Chest Pain", "HTN", "DM"]:
            p10_3missing.pop(dropped, None)
        cases.append(("p10_3missing", p10_3missing))

        for mode in ["quick", "full"]:
            space = "quick" if mode == "quick" else "auto"
            for case_label, case_inputs in cases:
                res = client.post("/api/predict", json={"mode": mode, "inputs": case_inputs})
                check(
                    "live_predict",
                    f"POST /api/predict 200 for {mode} {case_label}",
                    res.status_code == 200,
                    f"status={res.status_code}",
                )
                if res.status_code == 200:
                    d = res.json()
                    collect = mode == "quick" and case_label == "p10"
                    check_predictions(
                        "live_predict",
                        f"live {mode}/{case_label}",
                        space,
                        d["predictions"],
                        d.get("consistency"),
                        case_inputs=case_inputs,
                        collect_p10_table=collect,
                    )

    # =========================================================================
    # 5. Stored API Examples
    # =========================================================================
    print("\n--- 5. Checking stored API example JSON files ---")
    stored_files = [
        ("quick", examples_dir / "quick_p10.json"),
        ("auto", examples_dir / "full_median_3missing.json"),
    ]
    for space, ex_path in stored_files:
        exists = ex_path.is_file()
        check(
            "stored_examples",
            f"file exists: {ex_path.name}",
            exists,
            f"path={ex_path}",
        )
        if exists:
            with open(ex_path, "r", encoding="utf-8") as f:
                ex_data = json.load(f)
            check_predictions(
                "stored_examples",
                ex_path.name,
                space,
                ex_data["predictions"],
                ex_data.get("consistency"),
                case_inputs=None,
                collect_p10_table=False,
            )

    # =========================================================================
    # 6. Repository Cleanliness: confirm clinical_plus appears nowhere
    # =========================================================================
    if not skip_repo_search:
        print("\n--- 6. Checking repository cleanliness: clinical_plus ---")
        matches: list[str] = []
        forbidden_token = "clinical" + "_plus"
        search_dirs = ["ml", "backend", "tests", "scripts", "frontend"]
        for sdir in search_dirs:
            dp = repo_root / sdir
            if not dp.exists():
                continue
            for root, _, files in os.walk(dp):
                for fn in files:
                    # Do not self-match the verification tools testing this token
                    if fn in ("verify_artifacts.py", "test_verify_artifacts.py"):
                        continue
                    if fn.endswith((".py", ".ts", ".tsx", ".json", ".md", ".ps1")):
                        fp = Path(root) / fn
                        try:
                            content = fp.read_text(encoding="utf-8", errors="ignore")
                            if forbidden_token in content:
                                matches.append(str(fp.relative_to(repo_root)))
                        except Exception:
                            pass
        check(
            "repo_cleanliness",
            "clinical_plus appears nowhere in repository",
            len(matches) == 0,
            f"occurrences={len(matches)}" + (f": {matches}" if matches else ""),
        )

    # =========================================================================
    # SUMMARY & P10 TABLE
    # =========================================================================
    total_pass = sum(c["pass"] for c in section_counts.values())
    total_fail = sum(c["fail"] for c in section_counts.values())
    total_checks = total_pass + total_fail

    print("\n" + "=" * 90)
    print("SUMMARY")
    print("=" * 90)
    for sec, counts in sorted(section_counts.items()):
        print(f"  {sec:30s} : {counts['pass']:4d} PASS, {counts['fail']:4d} FAIL")
    print("-" * 90)
    print(f"  {'TOTAL':30s} : {total_pass:4d} PASS, {total_fail:4d} FAIL, {total_checks:4d} TOTAL")
    print("=" * 90)
    print(f"Max |(base + sum_contrib) - logit_model| : {max_res_linear:.4e}")
    print(f"Max |expit(logit_model) - calibrated_p|  : {max_res_expit:.4e}")
    print(f"Max |raw -> cal (Platt) residual|        : {max_res_raw_platt:.4e}")
    print(f"Max |calibrated_p - ml.predict|          : {max_res_ml_predict:.4e}")

    # Assert total == number of printed PASS plus FAIL lines
    assert total_checks == len(printed_lines), (
        f"Total checks ({total_checks}) != number of printed lines ({len(printed_lines)})"
    )

    if p10_quick_rows:
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

    success = total_fail == 0
    if success:
        print("\nFINAL RESULT: PASS")
    else:
        print("\nFINAL RESULT: FAIL")

    return success, total_checks, total_pass, section_counts


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify TrustHeart ML & API artifacts")
    parser.add_argument("--models-dir", type=Path, default=None, help="Override models directory")
    parser.add_argument("--examples-dir", type=Path, default=None, help="Override examples directory")
    parser.add_argument("--skip-live", action="store_true", help="Skip live TestClient checks")
    parser.add_argument("--skip-repo-search", action="store_true", help="Skip repo search")
    args = parser.parse_args()

    success, total, passed, _ = verify_all(
        models_dir=args.models_dir,
        examples_dir=args.examples_dir,
        skip_live=args.skip_live,
        skip_repo_search=args.skip_repo_search,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
