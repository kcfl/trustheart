"""Build and persist trust layer statistics, quick-vs-full lift, and manifest registration."""

import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import roc_auc_score

from ml.config import (
    BOOTSTRAPS,
    KNN_K_EVIDENCE,
    N_SIMILAR_SHOWN,
    SPACES,
    STAB_MODERATE_FREQ,
    STAB_STABLE_FREQ,
    STAB_STABLE_SIGN,
    STAB_TOPK,
    TARGETS,
)
from ml.similar import loo_evidence_auc
from ml.utils import run_metadata


def _compute_sha256(file_path: Path) -> str:
    """Compute hexadecimal SHA-256 digest of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def compute_trust_stats(
    models_dir: Path | str = "models",
    reports_dir: Path | str = "reports",
) -> dict[str, Any]:
    """Compile trust metrics, quick-vs-full lift, evidence AUCs, and stability tags.

    Parameters
    ----------
    models_dir : Path | str, optional
        Path to models directory, by default 'models'.
    reports_dir : Path | str, optional
        Path to reports directory, by default 'reports'.

    Returns
    -------
    dict[str, Any]
        Dictionary of complete trust layer statistics.
    """
    models_path = Path(models_dir)
    reports_path = Path(reports_dir)

    # 1. Coherence summary from reports/coherence.json
    coherence_file = reports_path / "coherence.json"
    if not coherence_file.exists():
        from ml.coherence_report import generate_coherence_report
        generate_coherence_report(oof_path=models_path / "nested_oof.npz", output_dir=reports_path)

    with open(coherence_file, encoding="utf-8") as f:
        coherence_data = json.load(f)

    # 2. Lift: nested 'auto' calibrated ROC-AUC minus 'quick' calibrated ROC-AUC per repeat
    oof_path = models_path / "nested_oof.npz"
    if not oof_path.exists():
        raise FileNotFoundError(f"Nested OOF file not found at: {oof_path}")

    oof_data = np.load(oof_path)
    lift_by_target: dict[str, dict[str, Any]] = {}

    for target in TARGETS:
        y_target = oof_data[f"labels|{target}"] if f"labels|{target}" in oof_data else oof_data["labels"][:, TARGETS.index(target)]
        auto_cal_reps = oof_data[f"auto|{target}|cal"]
        quick_cal_reps = oof_data[f"quick|{target}|cal"]

        n_reps = len(auto_cal_reps)
        diffs = []
        auto_aucs = []
        quick_aucs = []

        for r in range(n_reps):
            auc_auto = float(roc_auc_score(y_target, auto_cal_reps[r]))
            auc_quick = float(roc_auc_score(y_target, quick_cal_reps[r]))
            auto_aucs.append(auc_auto)
            quick_aucs.append(auc_quick)
            diffs.append(auc_auto - auc_quick)

        diffs_arr = np.array(diffs)
        lift_by_target[target] = {
            "paired_mean": float(np.mean(diffs_arr)),
            "p2_5": float(np.percentile(diffs_arr, 2.5)),
            "p97_5": float(np.percentile(diffs_arr, 97.5)),
            "std": float(np.std(diffs_arr, ddof=1)),
            "auto_mean": float(np.mean(auto_aucs)),
            "quick_mean": float(np.mean(quick_aucs)),
            "diffs_per_repeat": [float(d) for d in diffs],
        }

    # 3. LOO evidence AUCs from k-NN
    print("Computing Leave-One-Out (LOO) evidence AUCs for compact and full feature sets...")
    loo_compact = loo_evidence_auc("compact")
    loo_full = loo_evidence_auc("full")
    loo_evidence_aucs = {
        "compact": loo_compact,
        "full": loo_full,
    }

    # 4. Stability tags from reports/stability.json
    stability_file = reports_path / "stability.json"
    if not stability_file.exists():
        from ml.stability import run_stability_analysis
        run_stability_analysis(models_dir=models_path, output_dir=reports_path)

    with open(stability_file, encoding="utf-8") as f:
        stability_data = json.load(f)

    stability_tags_by_space_target: dict[str, dict[str, dict[str, Any]]] = {}
    for space in SPACES:
        stability_tags_by_space_target[space] = {}
        for target in TARGETS:
            t_res = stability_data["results"][space][target]
            stability_tags_by_space_target[space][target] = {
                "config_name": t_res["config_name"],
                "features": {
                    f_name: {
                        "tag": f_info["tag"],
                        "top_k_freq": f_info["top_k_freq"],
                        "sign_consistency": f_info["sign_consistency"],
                        "majority_direction": f_info["majority_direction"],
                        "mean_importance": f_info["mean_importance"],
                    }
                    for f_name, f_info in t_res["all_features"].items()
                },
            }

    # 5. Thresholds used
    thresholds = {
        "coherence_tolerance": 1e-9,
        "knn_k_evidence": KNN_K_EVIDENCE,
        "n_similar_shown": N_SIMILAR_SHOWN,
        "bootstraps": BOOTSTRAPS,
        "stab_topk": STAB_TOPK,
        "stab_stable_freq": STAB_STABLE_FREQ,
        "stab_stable_sign": STAB_STABLE_SIGN,
        "stab_moderate_freq": STAB_MODERATE_FREQ,
    }

    meta = run_metadata()
    trust_stats = {
        **meta,
        "thresholds_used": thresholds,
        "coherence_summary": coherence_data["results"],
        "lift": lift_by_target,
        "loo_evidence_aucs": loo_evidence_aucs,
        "stability_tags": stability_tags_by_space_target,
    }

    # Save models/trust_stats.json
    trust_stats_path = models_path / "trust_stats.json"
    with open(trust_stats_path, "w", encoding="utf-8") as f:
        json.dump(trust_stats, f, indent=2)
    print(f"Saved trust statistics to: {trust_stats_path}")

    # 6. Update manifest.json with trust_stats.json hash
    manifest_path = models_path / "manifest.json"
    if manifest_path.exists():
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
    else:
        manifest = {**meta, "files": {}}

    trust_stats_hash = _compute_sha256(trust_stats_path)
    manifest["files"]["models/trust_stats.json"] = trust_stats_hash
    manifest["timestamp_utc"] = meta["timestamp_utc"]
    manifest["git_dirty"] = meta["git_dirty"]
    manifest["git_commit"] = meta["git_commit"]

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"Updated manifest at: {manifest_path} (added models/trust_stats.json)")

    return trust_stats


def main() -> None:
    """Build trust statistics and register in manifest."""
    compute_trust_stats()


if __name__ == "__main__":
    main()
