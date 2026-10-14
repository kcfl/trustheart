#!/usr/bin/env python3
"""Sync model and dataset metrics from reports/*.json to frontend/src/generated/facts.json."""

import json
from pathlib import Path


def main():
    root = Path(__file__).resolve().parent.parent
    reports_dir = root / "reports"
    out_file = root / "frontend" / "src" / "generated" / "facts.json"
    out_file.parent.mkdir(parents=True, exist_ok=True)

    data_audit_path = reports_dir / "data_audit.json"
    nested_path = reports_dir / "nested_results.json"
    coherence_path = reports_dir / "coherence.json"

    with open(data_audit_path, "r", encoding="utf-8") as f:
        data_audit = json.load(f)

    with open(nested_path, "r", encoding="utf-8") as f:
        nested_data = json.load(f)

    coherence_data = {}
    if coherence_path.is_file():
        with open(coherence_path, "r", encoding="utf-8") as f:
            coherence_data = json.load(f)

    # 1. Dataset & Cohort
    cohort = {
        "n_samples": data_audit["raw_shape"][0],
        "n_raw_attributes": data_audit["raw_shape"][1],
        "n_encoded_features": data_audit.get("num_encoded_feature_columns", 56),
        "uci_id": 411,
        "uci_source": "https://archive.ics.uci.edu/dataset/411/extension+of+z+alizadeh+sani+dataset",
        "demographics": data_audit.get("demographics", {}),
        "prevalences": {
            k: {
                "count_positive": v["count_1_positive"],
                "count_normal": v["count_0_normal"],
                "total": v["total"],
                "prevalence_pct": v["prevalence_pct"],
            }
            for k, v in data_audit.get("targets", {}).items()
        },
    }

    # 2. Performance Auto vs Quick from nested_results
    # Nested CV has 10 repeats x 5 folds
    # We extract calibrated metrics or summary metrics
    # In MODEL_CARD.md:
    # CAD Auto: ROC-AUC 0.9237 ± 0.0064, Quick 0.8979 ± 0.0030
    # LAD Auto: ROC-AUC 0.8364 ± 0.0044, Quick 0.7885 ± 0.0036
    # LCX Auto: ROC-AUC 0.7260 ± 0.0115, Quick 0.7278 ± 0.0083
    # RCA Auto: ROC-AUC 0.7357 ± 0.0072, Quick 0.7391 ± 0.0039

    # Let's inspect nested_data structure for calibrated summary
    # nested_data["results"][space][target]["calibrated"]["summary"] or similar
    perf_table = {}
    spaces = ["auto", "quick"]
    targets = ["CAD", "LAD", "LCX", "RCA"]

    for t in targets:
        perf_table[t] = {}
        for sp in spaces:
            target_res = nested_data.get("results", {}).get(sp, {}).get(t, {})
            calib_summary = target_res.get("calibrated", {}).get("summary", {})
            raw_summary = target_res.get("raw", {}).get("summary", {})
            
            # ROC AUC is invariant to calibration, so it exists in raw/summary or calib/summary
            roc_auc = calib_summary.get("roc_auc") or raw_summary.get("roc_auc") or {}
            pr_auc = calib_summary.get("pr_auc") or raw_summary.get("pr_auc") or {}
            brier = calib_summary.get("brier", {})
            ece = calib_summary.get("ece", {})

            perf_table[t][sp] = {
                "roc_auc_mean": round(roc_auc.get("mean", 0.0), 4),
                "roc_auc_std": round(roc_auc.get("std", 0.0), 4),
                "pr_auc_mean": round(pr_auc.get("mean", 0.0), 4),
                "pr_auc_std": round(pr_auc.get("std", 0.0), 4),
                "brier_mean": round(brier.get("mean", 0.0), 4),
                "brier_std": round(brier.get("std", 0.0), 4),
                "ece_mean": round(ece.get("mean", 0.0), 4),
                "ece_std": round(ece.get("std", 0.0), 4),
            }

    # 3. Final Selected Models & Calibration Parameters from MODEL_CARD
    models = {
        "CAD": {
            "auto": {"config": "full|LR|C=0.001", "features": 55, "platt_a": 12.3628, "platt_b": 0.9704},
            "quick": {"config": "compact|LR|C=0.001", "features": 7, "platt_a": 13.7899, "platt_b": 0.9356},
        },
        "LAD": {
            "auto": {"config": "full|LR|C=0.001", "features": 55, "platt_a": 8.9140, "platt_b": 0.3702},
            "quick": {"config": "compact|LR|C=0.001", "features": 7, "platt_a": 11.4114, "platt_b": 0.2925},
        },
        "LCX": {
            "auto": {"config": "compact|LR|C=0.03", "features": 7, "platt_a": 1.3056, "platt_b": -0.4250},
            "quick": {"config": "compact|LR|C=0.03", "features": 7, "platt_a": 1.3056, "platt_b": -0.4250},
        },
        "RCA": {
            "auto": {"config": "compact|LR|C=0.001", "features": 7, "platt_a": 11.9557, "platt_b": -0.5293},
            "quick": {"config": "compact|LR|C=0.001", "features": 7, "platt_a": 11.9557, "platt_b": -0.5293},
        },
    }

    # 4. Limitations
    limitations = [
        "Single-centre dataset of 303 angiography-referred patients from Tehran Heart Center.",
        "Probabilities are mildly overconfident out of sample (demonstrated in nested CV).",
        "What-if changes show model sensitivity, not clinical or treatment effect.",
        "Decision support and educational demonstration only. Not a substitute for formal diagnostic angiography.",
        "Probabilities are per-vessel stenosis risks (>=50% diameter stenosis), not anatomical lesion locations.",
    ]

    facts = {
        "cohort": cohort,
        "performance": perf_table,
        "models": models,
        "limitations": limitations,
        "coherence": coherence_data,
    }

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(facts, f, indent=2)

    print(f"Synced facts to {out_file} successfully.")


if __name__ == "__main__":
    main()
