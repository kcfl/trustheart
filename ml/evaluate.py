"""Repeated cross-validation evaluation harness for TrustHeart 3D.

Compares COMPACT vs FULL feature sets across baseline models (LR, RF)
and all four clinical targets (CAD, LAD, LCX, RCA) using 10 repeats of 5-fold CV.

Run with:
    python -m ml.evaluate
"""

from datetime import datetime, timezone
from pathlib import Path
import subprocess
import time
from typing import Any

from joblib import Parallel, delayed
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from ml.config import (
    COMPACT_FEATURES,
    CV_SEED,
    N_REPEATS,
    N_SPLITS,
    REPORTS_DIR,
    SEED,
    TARGETS,
    THRESHOLD,
)
from ml.cv import make_splits
from ml.data import drop_constant_columns, load_features, load_raw, load_targets
from ml.models import get_model


def _fit_predict_fold(
    model_name: str,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_test: np.ndarray,
    y_test: np.ndarray,
    fold_seed: int,
) -> tuple[np.ndarray, float]:
    """Fit model on training fold and predict probabilities on test fold.

    Parameters
    ----------
    model_name : str
        Estimator identifier ('LR' or 'RF').
    X_train : np.ndarray
        Training feature matrix.
    y_train : np.ndarray
        Training binary target vector.
    X_test : np.ndarray
        Test feature matrix.
    y_test : np.ndarray
        Test binary target vector.
    fold_seed : int
        Seed for estimator reproducibility in this fold.

    Returns
    -------
    tuple[np.ndarray, float]
        Out-of-fold predicted probabilities for positive class (1),
        and the ROC-AUC score on this specific test fold.
    """
    model = get_model(model_name, seed=fold_seed)
    model.fit(X_train, y_train)
    probs = model.predict_proba(X_test)[:, 1]
    fold_auc = float(roc_auc_score(y_test, probs))
    return probs, fold_auc


def evaluate_combination(
    X: np.ndarray,
    y: np.ndarray,
    model_name: str,
    splits: list[tuple[int, np.ndarray, np.ndarray]],
    seed: int = SEED,
    threshold: float = THRESHOLD,
) -> tuple[np.ndarray, np.ndarray, dict[str, Any]]:
    """Run 50 cross-validation folds for a single (feature set, model, target) tuple.

    Parameters
    ----------
    X : np.ndarray
        Feature matrix (N, D).
    y : np.ndarray
        Target labels (N,).
    model_name : str
        Model identifier ('LR' or 'RF').
    splits : list[tuple[int, np.ndarray, np.ndarray]]
        The 50 (repeat_idx, train_idx, test_idx) tuples.
    seed : int, optional
        Base random seed, by default SEED.
    threshold : float, optional
        Decision threshold for binary metrics, by default THRESHOLD (0.5).

    Returns
    -------
    tuple[np.ndarray, np.ndarray, dict[str, Any]]
        - Out-of-fold probabilities array of shape [n_repeats, n_samples].
        - Fold-level ROC-AUC array of shape [n_total_folds].
        - Summary metrics dictionary with per-repeat distributions and aggregations.
    """
    n_samples = len(y)
    n_splits_total = len(splits)

    # Parallelize fold evaluations across available CPU cores
    fold_results = Parallel(n_jobs=-1)(
        delayed(_fit_predict_fold)(
            model_name,
            X[train_idx],
            y[train_idx],
            X[test_idx],
            y[test_idx],
            seed + k,
        )
        for k, (repeat_idx, train_idx, test_idx) in enumerate(splits)
    )

    oof_probs = np.zeros((N_REPEATS, n_samples), dtype=float)
    fold_aucs = np.zeros(n_splits_total, dtype=float)

    for k, (probs, fold_auc) in enumerate(fold_results):
        repeat_idx, train_idx, test_idx = splits[k]
        oof_probs[repeat_idx, test_idx] = probs
        fold_aucs[k] = fold_auc

    # Compute metrics per repeat on full out-of-fold vector
    repeat_metrics: dict[str, list[float]] = {
        "roc_auc": [],
        "pr_auc": [],
        "brier": [],
        "accuracy": [],
        "precision": [],
        "recall": [],
        "f1": [],
    }

    for r in range(N_REPEATS):
        y_prob = oof_probs[r]
        y_pred = (y_prob >= threshold).astype(int)

        repeat_metrics["roc_auc"].append(float(roc_auc_score(y, y_prob)))
        repeat_metrics["pr_auc"].append(float(average_precision_score(y, y_prob)))
        repeat_metrics["brier"].append(float(brier_score_loss(y, y_prob)))
        repeat_metrics["accuracy"].append(float(accuracy_score(y, y_pred)))
        repeat_metrics["precision"].append(
            float(precision_score(y, y_pred, zero_division=0))
        )
        repeat_metrics["recall"].append(
            float(recall_score(y, y_pred, zero_division=0))
        )
        repeat_metrics["f1"].append(float(f1_score(y, y_pred, zero_division=0)))

    # Compute mean and standard deviation over 10 repeats
    summary: dict[str, Any] = {
        "n_samples": n_samples,
        "n_repeats": N_REPEATS,
        "n_splits": N_SPLITS,
        "threshold": threshold,
        "fold_auc_p025": float(np.percentile(fold_aucs, 2.5)),
        "fold_auc_p975": float(np.percentile(fold_aucs, 97.5)),
        "repeat_values": repeat_metrics,
        "metrics_summary": {},
    }

    for m_key, vals in repeat_metrics.items():
        arr = np.array(vals)
        summary["metrics_summary"][m_key] = {
            "mean": float(np.mean(arr)),
            "std": float(np.std(arr, ddof=1)),
            "min": float(np.min(arr)),
            "max": float(np.max(arr)),
        }

    return oof_probs, fold_aucs, summary


def run_evaluation() -> dict[str, Any]:
    """Execute complete 16-combination cross-validation evaluation.

    Returns
    -------
    dict[str, Any]
        Complete results dictionary with all metadata and evaluation outputs.
    """
    start_time = time.perf_counter()

    # Load raw dataset, extract targets, clean encoded features
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    encoded_features = load_features(raw_df)
    clean_features, dropped_constant_cols = drop_constant_columns(encoded_features)

    feature_sets: dict[str, list[str]] = {
        "compact": list(COMPACT_FEATURES),
        "full": list(clean_features.columns),
    }

    models = ["LR", "RF"]
    targets = list(TARGETS)

    print("\n" + "=" * 70)
    print(" TRUSTHEART 3D - STEP 2: REPEATED CROSS-VALIDATION EVALUATION")
    print("=" * 70)
    print(f"Dataset Size:           {len(raw_df)} samples")
    print(f"Dropped Constants:      {dropped_constant_cols}")
    print(f"Feature Sets:           compact={len(feature_sets['compact'])}, full={len(feature_sets['full'])}")
    print(f"Models:                 {models}")
    print(f"Targets:                {targets}")
    print(f"CV Scheme:              {N_REPEATS} repeats x {N_SPLITS} folds = 50 folds per combination")
    print(f"Total Combinations:     {len(feature_sets)} x {len(models)} x {len(targets)} = 16")
    print("=" * 70 + "\n")

    # Generate unified splits shared across all targets
    splits = make_splits(targets_df, n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=CV_SEED)

    oof_dict: dict[str, np.ndarray] = {}
    results_dict: dict[str, Any] = {}

    for f_name, f_cols in feature_sets.items():
        X_mat = clean_features[f_cols].values
        for m_name in models:
            for t_name in targets:
                combo_key = f"{f_name}|{m_name}|{t_name}"
                print(f"Evaluating [{combo_key:20s}] (50 folds)...", end=" ", flush=True)
                t0 = time.perf_counter()

                y_vec = targets_df[t_name].values
                oof_probs, fold_aucs, summary = evaluate_combination(
                    X_mat, y_vec, m_name, splits, seed=SEED, threshold=THRESHOLD
                )

                elapsed_combo = time.perf_counter() - t0
                auc_mean = summary["metrics_summary"]["roc_auc"]["mean"]
                auc_std = summary["metrics_summary"]["roc_auc"]["std"]
                print(f"Done in {elapsed_combo:4.1f}s | ROC-AUC: {auc_mean:.4f} +/- {auc_std:.4f}")

                oof_dict[combo_key] = oof_probs
                results_dict[combo_key] = summary

    # Compute paired differences (Full minus Compact) per repeat for each (model, target)
    paired_diffs: dict[str, dict[str, Any]] = {}
    for m_name in models:
        for t_name in targets:
            full_key = f"full|{m_name}|{t_name}"
            compact_key = f"compact|{m_name}|{t_name}"

            full_aucs = np.array(results_dict[full_key]["repeat_values"]["roc_auc"])
            compact_aucs = np.array(results_dict[compact_key]["repeat_values"]["roc_auc"])
            diff = full_aucs - compact_aucs

            pair_key = f"{m_name}|{t_name}"
            paired_diffs[pair_key] = {
                "model": m_name,
                "target": t_name,
                "mean_diff": float(np.mean(diff)),
                "std_diff": float(np.std(diff, ddof=1)),
                "p025_diff": float(np.percentile(diff, 2.5)),
                "p975_diff": float(np.percentile(diff, 97.5)),
                "repeat_diffs": [float(x) for x in diff],
            }

    elapsed_total = time.perf_counter() - start_time
    print(f"\nTotal evaluation completed in: {elapsed_total:.2f} seconds.")

    from ml.utils import run_metadata

    env_meta = run_metadata()

    metadata = {
        "timestamp_utc": env_meta["timestamp_utc"],
        "git_commit": env_meta["git_commit"],
        "git_dirty": env_meta["git_dirty"],
        "python_version": env_meta["python_version"],
        "package_versions": env_meta["package_versions"],
        "config": {
            "n_splits": N_SPLITS,
            "n_repeats": N_REPEATS,
            "cv_seed": CV_SEED,
            "seed": SEED,
            "threshold": THRESHOLD,
            "compact_features_count": len(feature_sets["compact"]),
            "full_features_count": len(feature_sets["full"]),
            "dropped_constant_columns": dropped_constant_cols,
        },
        "results": results_dict,
        "paired_differences": paired_diffs,
        "elapsed_seconds": round(elapsed_total, 2),
    }

    return {
        "metadata": metadata,
        "oof_dict": oof_dict,
        "targets_df": targets_df,
        "splits": splits,
        "feature_sets": feature_sets,
    }


def save_artifacts(eval_output: dict[str, Any]) -> None:
    """Save all evaluation artifacts: JSON, Markdown, NPZ, and PNG plot."""
    metadata = eval_output["metadata"]
    oof_dict = eval_output["oof_dict"]
    targets_df = eval_output["targets_df"]
    splits = eval_output["splits"]
    results_dict = metadata["results"]
    paired_diffs = metadata["paired_differences"]

    models_dir = Path("models")
    reports_dir = Path("reports")
    models_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    # 1. Save models/oof_predictions.npz
    npz_data = dict(oof_dict)
    npz_data["targets"] = targets_df[TARGETS].values
    npz_data["target_names"] = np.array(TARGETS)
    npz_data["split_repeat_indices"] = np.array([s[0] for s in splits])
    # Store indices as object arrays
    npz_data["split_train_indices"] = np.array([s[1] for s in splits], dtype=object)
    npz_data["split_test_indices"] = np.array([s[2] for s in splits], dtype=object)

    oof_npz_path = models_dir / "oof_predictions.npz"
    np.savez_compressed(oof_npz_path, **npz_data)
    print(f"Saved OOF predictions to: {oof_npz_path}")

    # 2. Save reports/cv_results.json
    json_path = reports_dir / "cv_results.json"
    import json

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved CV results JSON to: {json_path}")

    # 3. Save reports/cv_results.md
    md_path = reports_dir / "cv_results.md"
    md_lines: list[str] = [
        "# TrustHeart 3D - Cross-Validation Evaluation Results",
        "",
        f"- **Timestamp (UTC)**: {metadata['timestamp_utc']}",
        f"- **Git Commit**: `{metadata['git_commit']}`",
        f"- **Evaluation Protocol**: {N_REPEATS} repeats × {N_SPLITS} folds Stratified CV (50 folds per combo)",
        f"- **Decision Threshold**: {THRESHOLD}",
        f"- **Features**: Compact ({len(eval_output['feature_sets']['compact'])}) vs Full ({len(eval_output['feature_sets']['full'])})",
        f"- **Total Elapsed Time**: {metadata['elapsed_seconds']} seconds",
        "",
        "---",
        "",
        "## Performance by Target",
        "",
    ]

    for target in TARGETS:
        md_lines.append(f"### Target: **{target}**")
        md_lines.append("")
        md_lines.append(
            "| Feature Set | Model | ROC-AUC (Mean ± Std) | Fold 95% Interval | PR-AUC (Mean ± Std) | Brier (Mean ± Std) | Accuracy | Precision | Recall | F1 |"
        )
        md_lines.append(
            "|---|---|---|---|---|---|---|---|---|---|"
        )

        for f_name in ["compact", "full"]:
            for m_name in ["LR", "RF"]:
                key = f"{f_name}|{m_name}|{target}"
                s = results_dict[key]["metrics_summary"]
                p025 = results_dict[key]["fold_auc_p025"]
                p975 = results_dict[key]["fold_auc_p975"]

                auc_str = f"{s['roc_auc']['mean']:.4f} ± {s['roc_auc']['std']:.4f}"
                fold_ci_str = f"[{p025:.4f}, {p975:.4f}]"
                prauc_str = f"{s['pr_auc']['mean']:.4f} ± {s['pr_auc']['std']:.4f}"
                brier_str = f"{s['brier']['mean']:.4f} ± {s['brier']['std']:.4f}"
                acc_str = f"{s['accuracy']['mean']:.4f} ± {s['accuracy']['std']:.4f}"
                prec_str = f"{s['precision']['mean']:.4f} ± {s['precision']['std']:.4f}"
                rec_str = f"{s['recall']['mean']:.4f} ± {s['recall']['std']:.4f}"
                f1_str = f"{s['f1']['mean']:.4f} ± {s['f1']['std']:.4f}"

                md_lines.append(
                    f"| {f_name.capitalize()} | {m_name} | {auc_str} | {fold_ci_str} | {prauc_str} | {brier_str} | {acc_str} | {prec_str} | {rec_str} | {f1_str} |"
                )
        md_lines.append("")

    md_lines.append("---")
    md_lines.append("")
    md_lines.append("## Paired Comparison: Full vs Compact Feature Set (ROC-AUC)")
    md_lines.append("")
    md_lines.append(
        "| Target | Model | Mean AUC Diff (Full - Compact) | Std Diff | 95% Repeat Interval [2.5%, 97.5%] |"
    )
    md_lines.append("|---|---|---|---|---|")

    for target in TARGETS:
        for m_name in ["LR", "RF"]:
            pair_key = f"{m_name}|{target}"
            p = paired_diffs[pair_key]
            mean_d = p["mean_diff"]
            std_d = p["std_diff"]
            ci_d = f"[{p['p025_diff']:.4f}, {p['p975_diff']:.4f}]"
            sign = "+" if mean_d >= 0 else ""
            md_lines.append(
                f"| **{target}** | {m_name} | {sign}{mean_d:.4f} | {std_d:.4f} | {ci_d} |"
            )

    md_lines.append("")
    md_lines.append(
        "> **Methodological Note on Repeated CV Intervals:**"
    )
    md_lines.append(
        "> Repeats share underlying dataset samples, introducing positive covariance across repeats. "
        "Consequently, the 2.5th to 97.5th percentile interval across repeats is descriptive and indicative of repeat-to-repeat variation, "
        "not a formal independent hypothesis test (e.g., Nadeau-Bengio corrected resampled t-test)."
    )
    md_lines.append("")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    print(f"Saved CV results Markdown to: {md_path}")

    # 4. Save reports/cv_auc_by_target.png
    plot_path = reports_dir / "cv_auc_by_target.png"
    _generate_auc_plot(results_dict, plot_path)
    print(f"Saved AUC bar chart to: {plot_path}")


def _generate_auc_plot(results_dict: dict[str, Any], output_path: Path) -> None:
    """Generate and save grouped bar chart of ROC-AUC scores by target."""
    targets = list(TARGETS)
    combos = [
        ("compact", "LR", "Compact LR", "#2b5c8f"),
        ("compact", "RF", "Compact RF", "#4b9cd3"),
        ("full", "LR", "Full LR", "#c44e52"),
        ("full", "RF", "Full RF", "#dd8452"),
    ]

    x = np.arange(len(targets))
    width = 0.18
    fig, ax = plt.subplots(figsize=(10, 6), dpi=300)

    for i, (f_name, m_name, label, color) in enumerate(combos):
        means = []
        stds = []
        for target in targets:
            key = f"{f_name}|{m_name}|{target}"
            s = results_dict[key]["metrics_summary"]["roc_auc"]
            means.append(s["mean"])
            stds.append(s["std"])

        offset = (i - 1.5) * width
        ax.bar(
            x + offset,
            means,
            width,
            yerr=stds,
            capsize=3,
            label=label,
            color=color,
            alpha=0.9,
            edgecolor="black",
            linewidth=0.6,
        )

    ax.set_title(
        "TrustHeart 3D: Repeated 5x10 CV ROC-AUC by Target\n(Compact vs Full Feature Sets)",
        fontsize=13,
        fontweight="bold",
        pad=12,
    )
    ax.set_ylabel("ROC-AUC (Mean ± Std over 10 Repeats)", fontsize=11)
    ax.set_xlabel("Clinical Target", fontsize=11)
    ax.set_xticks(x)
    ax.set_xticklabels(targets, fontsize=11, fontweight="bold")
    ax.set_ylim(0.5, 1.0)
    ax.axhline(0.5, color="gray", linestyle="--", linewidth=0.8, alpha=0.7)
    ax.grid(axis="y", linestyle=":", alpha=0.6)
    ax.legend(frameon=True, facecolor="white", framealpha=0.9, loc="lower right")

    plt.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    """Execute evaluation and persist all artifacts."""
    eval_output = run_evaluation()
    save_artifacts(eval_output)


if __name__ == "__main__":
    main()
