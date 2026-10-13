"""Nested cross-validation with hyperparameter tuning, 1-SE selection, and Platt calibration."""

from collections import Counter
import json
from pathlib import Path
import time
from typing import Any

from joblib import Parallel, delayed
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    roc_auc_score,
)
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, cross_val_predict

from ml.calibration import apply_platt, calibration_metrics, compute_ece, fit_platt
from ml.config import (
    CALIB_SPLITS,
    COMPACT_FEATURES,
    CV_SEED,
    INNER_REPEATS,
    INNER_SPLITS,
    N_REPEATS_NESTED,
    N_SPLITS,
    REPORTS_DIR,
    SEED,
    SPACES,
    TARGETS,
)
from ml.cv import make_splits
from ml.data import drop_constant_columns, load_features, load_raw, load_targets
from ml.search_space import ALL_CONFIGS, Config, build_estimator, get_space_configs
from ml.select import select_config
from ml.utils import run_metadata


def _evaluate_outer_task(
    fold_idx: int,
    repeat_idx: int,
    train_idx: np.ndarray,
    test_idx: np.ndarray,
    target_name: str,
    X_full_df: pd.DataFrame,
    y_full: np.ndarray,
    all_configs: list[Config],
) -> dict[str, Any]:
    """Execute inner tuning, selection, calibration, and test evaluation for one outer fold and target.

    Parameters
    ----------
    fold_idx : int
        Index of outer fold (0 to N_SPLITS * N_REPEATS_NESTED - 1).
    repeat_idx : int
        Repeat index (0 to N_REPEATS_NESTED - 1).
    train_idx : np.ndarray
        Outer training indices.
    test_idx : np.ndarray
        Outer test indices (strictly untouched during tuning/calibration).
    target_name : str
        Target name ('CAD', 'LAD', 'LCX', 'RCA').
    X_full_df : pd.DataFrame
        Complete cleaned feature matrix (55 columns).
    y_full : np.ndarray
        Binary target vector.
    all_configs : list[Config]
        The 18 search space configurations.

    Returns
    -------
    dict[str, Any]
        Dictionary with outer evaluation results across all search spaces.
    """
    cache_dir = Path("models/.nested_cache")
    cache_file = cache_dir / f"task_{fold_idx}_{repeat_idx}_{target_name}.joblib"
    if cache_file.exists():
        try:
            return joblib.load(cache_file)
        except Exception:
            pass

    X_tr = X_full_df.iloc[train_idx]
    y_tr = y_full[train_idx]
    X_te = X_full_df.iloc[test_idx]
    y_te = y_full[test_idx]

    feature_cols = {
        "compact": list(COMPACT_FEATURES),
        "full": list(X_full_df.columns),
    }

    # 1. Inner CV on outer-train only: 3 splits, 2 repeats
    inner_cv = RepeatedStratifiedKFold(
        n_splits=INNER_SPLITS,
        n_repeats=INNER_REPEATS,
        random_state=CV_SEED + fold_idx,
    )
    inner_splits = list(inner_cv.split(X_tr, y_tr))

    # Evaluate all 18 configs across all 6 inner folds
    inner_scores: dict[str, list[float]] = {c.name: [] for c in all_configs}
    for in_tr_idx, in_val_idx in inner_splits:
        X_in_tr = X_tr.iloc[in_tr_idx]
        y_in_tr = y_tr[in_tr_idx]
        X_in_val = X_tr.iloc[in_val_idx]
        y_in_val = y_tr[in_val_idx]

        for c in all_configs:
            cols = feature_cols[c.featureset]
            est = build_estimator(c)
            est.fit(X_in_tr[cols], y_in_tr)
            p_val = est.predict_proba(X_in_val[cols])[:, 1]
            inner_scores[c.name].append(float(roc_auc_score(y_in_val, p_val)))

    inner_scores_arr = {k: np.array(v) for k, v in inner_scores.items()}

    # 2. For each search space (auto, quick): select, calibrate, predict
    space_outputs: dict[str, dict[str, Any]] = {}

    for space in SPACES:
        sp_configs = get_space_configs(space)
        selected_cfg = select_config(inner_scores_arr, sp_configs)
        sel_cols = feature_cols[selected_cfg.featureset]

        # 3. Platt Calibration via 5-fold cross_val_predict on outer-train only
        cal_cv = StratifiedKFold(
            n_splits=CALIB_SPLITS,
            shuffle=True,
            random_state=CV_SEED + fold_idx,
        )
        base_model_for_cal = build_estimator(selected_cfg)
        cal_cv_scores = cross_val_predict(
            base_model_for_cal,
            X_tr[sel_cols],
            y_tr,
            cv=cal_cv,
            method="predict_proba",
            n_jobs=1,
        )[:, 1]

        platt_a, platt_b = fit_platt(cal_cv_scores, y_tr)

        # Fit final model for this fold on full outer-train
        final_estimator = build_estimator(selected_cfg)
        final_estimator.fit(X_tr[sel_cols], y_tr)

        # Score outer-test fold
        raw_test_probs = final_estimator.predict_proba(X_te[sel_cols])[:, 1]
        cal_test_probs = apply_platt(raw_test_probs, platt_a, platt_b)

        space_outputs[space] = {
            "selected_config": selected_cfg.name,
            "selected_featureset": selected_cfg.featureset,
            "selected_model": selected_cfg.model,
            "platt_a": platt_a,
            "platt_b": platt_b,
            "raw_test_probs": raw_test_probs,
            "cal_test_probs": cal_test_probs,
        }

    res = {
        "fold_idx": fold_idx,
        "repeat_idx": repeat_idx,
        "test_idx": test_idx,
        "target_name": target_name,
        "space_outputs": space_outputs,
    }
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        joblib.dump(res, cache_file)
    except Exception:
        pass

    return res


def run_nested_cv() -> dict[str, Any]:
    """Execute complete nested CV pipeline across all outer folds and targets.

    Returns
    -------
    dict[str, Any]
        Nested cross-validation results, OOF prediction arrays, and diagnostic summaries.
    """
    start_time = time.perf_counter()

    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    clean_features, dropped_cols = drop_constant_columns(load_features(raw_df))

    outer_splits = make_splits(
        targets_df,
        n_splits=N_SPLITS,
        n_repeats=N_REPEATS_NESTED,
        random_state=CV_SEED,
    )
    n_outer_folds = len(outer_splits)
    n_samples = len(raw_df)

    print("\n" + "=" * 70)
    print(" TRUSTHEART 3D - STEP 3: NESTED CROSS-VALIDATION & CALIBRATION")
    print("=" * 70)
    print(f"Dataset Size:           {n_samples} samples")
    print(f"Search Spaces:          {SPACES} (auto=18 configs, quick=9 configs)")
    print(f"Outer CV:               {N_REPEATS_NESTED} repeats x {N_SPLITS} folds = {n_outer_folds} outer folds")
    print(f"Inner CV:               {INNER_REPEATS} repeats x {INNER_SPLITS} folds = 6 inner folds per config")
    print(f"Calibration:            {CALIB_SPLITS}-fold stratified Platt scaling on outer-train")
    print(f"Total Outer Tasks:      {n_outer_folds} folds x {len(TARGETS)} targets = {n_outer_folds * len(TARGETS)}")
    print("=" * 70 + "\n")

    # Build task list: each task evaluates (outer fold, target)
    tasks = []
    for k, (repeat_idx, train_idx, test_idx) in enumerate(outer_splits):
        for target in TARGETS:
            tasks.append((k, repeat_idx, train_idx, test_idx, target))

    print(f"Launching {len(tasks)} parallel outer tasks with joblib (n_jobs=-1)...")
    task_results = Parallel(n_jobs=-1, verbose=10)(
        delayed(_evaluate_outer_task)(
            k,
            repeat_idx,
            train_idx,
            test_idx,
            target,
            clean_features,
            targets_df[target].values,
            ALL_CONFIGS,
        )
        for (k, repeat_idx, train_idx, test_idx, target) in tasks
    )

    elapsed_eval = time.perf_counter() - start_time
    print(f"\nOuter tasks completed in: {elapsed_eval:.2f} seconds ({elapsed_eval/60:.2f} min).")

    # Assemble out-of-fold probability arrays of shape [N_REPEATS_NESTED, n_samples]
    # for both spaces and both raw / calibrated predictions
    oof_arrays: dict[str, np.ndarray] = {}
    selection_history: dict[str, list[dict[str, Any]]] = {}

    for space in SPACES:
        for target in TARGETS:
            raw_key = f"{space}|{target}|raw"
            cal_key = f"{space}|{target}|cal"
            hist_key = f"{space}|{target}"

            oof_arrays[raw_key] = np.zeros((N_REPEATS_NESTED, n_samples), dtype=float)
            oof_arrays[cal_key] = np.zeros((N_REPEATS_NESTED, n_samples), dtype=float)
            selection_history[hist_key] = []

    for res in task_results:
        k = res["fold_idx"]
        r = res["repeat_idx"]
        test_idx = res["test_idx"]
        t = res["target_name"]

        for space in SPACES:
            sp_res = res["space_outputs"][space]
            raw_key = f"{space}|{t}|raw"
            cal_key = f"{space}|{t}|cal"
            hist_key = f"{space}|{t}"

            oof_arrays[raw_key][r, test_idx] = sp_res["raw_test_probs"]
            oof_arrays[cal_key][r, test_idx] = sp_res["cal_test_probs"]
            selection_history[hist_key].append(
                {
                    "fold_idx": k,
                    "repeat_idx": r,
                    "config": sp_res["selected_config"],
                    "featureset": sp_res["selected_featureset"],
                    "model": sp_res["selected_model"],
                    "platt_a": sp_res["platt_a"],
                    "platt_b": sp_res["platt_b"],
                }
            )

    # Compute metrics per repeat on full out-of-fold vector [303]
    metrics_by_space_target: dict[str, dict[str, Any]] = {}

    for space in SPACES:
        metrics_by_space_target[space] = {}
        for target in TARGETS:
            y_true = targets_df[target].values
            raw_key = f"{space}|{target}|raw"
            cal_key = f"{space}|{target}|cal"

            raw_oof = oof_arrays[raw_key]
            cal_oof = oof_arrays[cal_key]

            def _compute_repeat_metrics(probs_matrix: np.ndarray) -> dict[str, list[float]]:
                out: dict[str, list[float]] = {
                    "roc_auc": [],
                    "pr_auc": [],
                    "brier": [],
                    "ece": [],
                    "intercept": [],
                    "slope": [],
                }
                for r_idx in range(N_REPEATS_NESTED):
                    p_vec = probs_matrix[r_idx]
                    out["roc_auc"].append(float(roc_auc_score(y_true, p_vec)))
                    out["pr_auc"].append(float(average_precision_score(y_true, p_vec)))
                    cal_m = calibration_metrics(y_true, p_vec)
                    out["brier"].append(cal_m["brier"])
                    out["ece"].append(cal_m["ece"])
                    out["intercept"].append(cal_m["intercept"])
                    out["slope"].append(cal_m["slope"])
                return out

            raw_repeat_vals = _compute_repeat_metrics(raw_oof)
            cal_repeat_vals = _compute_repeat_metrics(cal_oof)

            def _summarize_metrics(repeat_dict: dict[str, list[float]]) -> dict[str, dict[str, float]]:
                sum_dict = {}
                for m_k, v_list in repeat_dict.items():
                    arr = np.array(v_list)
                    sum_dict[m_k] = {
                        "mean": float(np.mean(arr)),
                        "std": float(np.std(arr, ddof=1)),
                        "min": float(np.min(arr)),
                        "max": float(np.max(arr)),
                    }
                return sum_dict

            # Selection frequency counts
            hist_key = f"{space}|{target}"
            configs_selected = [h["config"] for h in selection_history[hist_key]]
            config_counts = dict(Counter(configs_selected))
            featuresets_selected = [h["featureset"] for h in selection_history[hist_key]]
            fs_counts = dict(Counter(featuresets_selected))
            compact_pct = round(fs_counts.get("compact", 0) / len(featuresets_selected) * 100.0, 2)
            full_pct = round(fs_counts.get("full", 0) / len(featuresets_selected) * 100.0, 2)

            metrics_by_space_target[space][target] = {
                "raw": {
                    "summary": _summarize_metrics(raw_repeat_vals),
                    "repeat_values": raw_repeat_vals,
                },
                "calibrated": {
                    "summary": _summarize_metrics(cal_repeat_vals),
                    "repeat_values": cal_repeat_vals,
                },
                "selection_distribution": {
                    "config_counts": config_counts,
                    "featureset_counts": fs_counts,
                    "compact_share_pct": compact_pct,
                    "full_share_pct": full_pct,
                },
            }

    # Step 2 Comparison: read reports/cv_results.json
    step2_comparison = {}
    cv_json_path = REPORTS_DIR / "cv_results.json"
    if cv_json_path.exists():
        with open(cv_json_path, encoding="utf-8") as f:
            cv_res = json.load(f)

        for target in TARGETS:
            # Find best fixed config from step 2 for this target
            best_s2_key = None
            best_s2_auc = -1.0
            best_s2_std = 0.0

            for combo_k, combo_v in cv_res["results"].items():
                if combo_k.endswith(f"|{target}"):
                    auc_val = combo_v["metrics_summary"]["roc_auc"]["mean"]
                    if auc_val > best_s2_auc:
                        best_s2_auc = auc_val
                        best_s2_std = combo_v["metrics_summary"]["roc_auc"]["std"]
                        best_s2_key = combo_k

            nested_auto_auc = metrics_by_space_target["auto"][target]["calibrated"]["summary"]["roc_auc"]["mean"]
            nested_auto_std = metrics_by_space_target["auto"][target]["calibrated"]["summary"]["roc_auc"]["std"]

            step2_comparison[target] = {
                "best_step2_combo": best_s2_key,
                "best_step2_auc": best_s2_auc,
                "best_step2_std": best_s2_std,
                "nested_auto_auc": nested_auto_auc,
                "nested_auto_std": nested_auto_std,
                "diff": nested_auto_auc - best_s2_auc,
            }

    metadata = {
        **run_metadata(),
        "config": {
            "n_repeats_nested": N_REPEATS_NESTED,
            "n_splits": N_SPLITS,
            "inner_splits": INNER_SPLITS,
            "inner_repeats": INNER_REPEATS,
            "calib_splits": CALIB_SPLITS,
            "cv_seed": CV_SEED,
            "seed": SEED,
            "spaces": SPACES,
        },
        "results": metrics_by_space_target,
        "step2_comparison": step2_comparison,
        "elapsed_seconds": round(elapsed_eval, 2),
    }

    return {
        "metadata": metadata,
        "oof_arrays": oof_arrays,
        "targets_df": targets_df,
    }


def save_reports_and_artifacts(eval_output: dict[str, Any]) -> None:
    """Persist nested results JSON, Markdown, NPZ, and calibration reliability diagram."""
    metadata = eval_output["metadata"]
    oof_arrays = eval_output["oof_arrays"]
    targets_df = eval_output["targets_df"]

    models_dir = Path("models")
    reports_dir = Path("reports")
    models_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)

    # 1. Save models/nested_oof.npz
    npz_data = dict(oof_arrays)
    npz_data["labels"] = targets_df[TARGETS].values
    npz_data["targets"] = targets_df[TARGETS].values
    npz_data["target_names"] = np.array(TARGETS)
    for target in TARGETS:
        npz_data[f"labels|{target}"] = targets_df[target].values
    npz_path = models_dir / "nested_oof.npz"
    np.savez_compressed(npz_path, **npz_data)
    print(f"Saved nested OOF predictions to: {npz_path}")

    # 2. Save reports/nested_results.json
    json_path = reports_dir / "nested_results.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved nested results JSON to: {json_path}")

    # 3. Save reports/nested_results.md
    md_path = reports_dir / "nested_results.md"
    cfg = metadata["config"]
    res = metadata["results"]
    s2 = metadata["step2_comparison"]

    md_lines: list[str] = [
        "# TrustHeart 3D - Step 3: Nested Cross-Validation & Calibration Results",
        "",
        f"- **Timestamp (UTC)**: {metadata['timestamp_utc']}",
        f"- **Git Commit**: `{metadata['git_commit']}` (dirty: {metadata['git_dirty']})",
        f"- **Outer CV**: {cfg['n_repeats_nested']} repeats × {cfg['n_splits']} folds = {cfg['n_repeats_nested'] * cfg['n_splits']} outer folds",
        f"- **Inner CV**: {cfg['inner_repeats']} repeats × {cfg['inner_splits']} folds = 6 inner folds per candidate config",
        f"- **Calibration Protocol**: {cfg['calib_splits']}-fold stratified Platt scaling on outer-train",
        f"- **Elapsed Execution Time**: {metadata['elapsed_seconds']} seconds ({metadata['elapsed_seconds']/60:.2f} min)",
        "",
        "---",
        "",
        "## 1. Nested Evaluation Performance by Space & Target",
        "",
        "Metrics reported as **Mean ± Std** over outer repeats.",
        "",
    ]

    for space in SPACES:
        md_lines.append(f"### Search Space: `{space.upper()}`")
        md_lines.append("")
        md_lines.append(
            "| Target | Prediction | ROC-AUC | PR-AUC | Brier Score | ECE (5 Bins) | Calib Intercept | Calib Slope |"
        )
        md_lines.append(
            "|---|---|---|---|---|---|---|---|"
        )

        for target in TARGETS:
            t_data = res[space][target]
            raw_s = t_data["raw"]["summary"]
            cal_s = t_data["calibrated"]["summary"]

            md_lines.append(
                f"| **{target}** | Raw | "
                f"{raw_s['roc_auc']['mean']:.4f} ± {raw_s['roc_auc']['std']:.4f} | "
                f"{raw_s['pr_auc']['mean']:.4f} ± {raw_s['pr_auc']['std']:.4f} | "
                f"{raw_s['brier']['mean']:.4f} ± {raw_s['brier']['std']:.4f} | "
                f"{raw_s['ece']['mean']:.4f} ± {raw_s['ece']['std']:.4f} | "
                f"{raw_s['intercept']['mean']:.4f} ± {raw_s['intercept']['std']:.4f} | "
                f"{raw_s['slope']['mean']:.4f} ± {raw_s['slope']['std']:.4f} |"
            )
            md_lines.append(
                f"| **{target}** | **Platt Calibrated** | "
                f"**{cal_s['roc_auc']['mean']:.4f} ± {cal_s['roc_auc']['std']:.4f}** | "
                f"{cal_s['pr_auc']['mean']:.4f} ± {cal_s['pr_auc']['std']:.4f} | "
                f"**{cal_s['brier']['mean']:.4f} ± {cal_s['brier']['std']:.4f}** | "
                f"**{cal_s['ece']['mean']:.4f} ± {cal_s['ece']['std']:.4f}** | "
                f"{cal_s['intercept']['mean']:.4f} ± {cal_s['intercept']['std']:.4f} | "
                f"{cal_s['slope']['mean']:.4f} ± {cal_s['slope']['std']:.4f} |"
            )
        md_lines.append("")

    md_lines.append("---")
    md_lines.append("")
    md_lines.append("## 2. Model Selection Distribution Across Outer Folds")
    md_lines.append("")
    md_lines.append(
        "| Search Space | Target | Compact Share (%) | Full Share (%) | Top Selected Configurations (Count / Total) |"
    )
    md_lines.append("|---|---|---|---|---|")

    total_folds = cfg["n_repeats_nested"] * cfg["n_splits"]
    for space in SPACES:
        for target in TARGETS:
            dist = res[space][target]["selection_distribution"]
            top_cfgs = sorted(dist["config_counts"].items(), key=lambda x: -x[1])[:3]
            top_cfgs_str = ", ".join([f"`{c}` ({cnt}/{total_folds})" for c, cnt in top_cfgs])
            md_lines.append(
                f"| `{space}` | **{target}** | {dist['compact_share_pct']}% | {dist['full_share_pct']}% | {top_cfgs_str} |"
            )
    md_lines.append("")

    md_lines.append("---")
    md_lines.append("")
    md_lines.append("## 3. Comparison: Nested Auto (Tuned + Calibrated) vs Step 2 Best Fixed Baseline")
    md_lines.append("")
    md_lines.append(
        "| Target | Best Step 2 Combo | Step 2 Baseline AUC | Nested Auto Calibrated AUC | AUC Difference (Nested - Step 2) |"
    )
    md_lines.append("|---|---|---|---|---|")

    for target in TARGETS:
        cmp = s2.get(target, {})
        diff_val = cmp.get("diff", 0.0)
        sign = "+" if diff_val >= 0 else ""
        md_lines.append(
            f"| **{target}** | `{cmp.get('best_step2_combo', 'N/A')}` | "
            f"{cmp.get('best_step2_auc', 0.0):.4f} ± {cmp.get('best_step2_std', 0.0):.4f} | "
            f"{cmp.get('nested_auto_auc', 0.0):.4f} ± {cmp.get('nested_auto_std', 0.0):.4f} | "
            f"**{sign}{diff_val:.4f}** |"
        )
    md_lines.append("")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    print(f"Saved nested results Markdown to: {md_path}")
    print("\n" + "\n".join(md_lines) + "\n")

    # 4. Save reports/calibration_plot.png
    plot_path = reports_dir / "calibration_plot.png"
    _generate_calibration_plot(eval_output, plot_path)
    print(f"Saved calibration reliability plot to: {plot_path}")


def _generate_calibration_plot(eval_output: dict[str, Any], output_path: Path) -> None:
    """Generate 2x2 reliability diagrams comparing raw vs Platt-calibrated predictions for space 'auto'."""
    oof_arrays = eval_output["oof_arrays"]
    targets_df = eval_output["targets_df"]

    fig, axes = plt.subplots(2, 2, figsize=(11, 10), dpi=300)
    axes_flat = axes.flatten()

    for idx, target in enumerate(TARGETS):
        ax = axes_flat[idx]
        y_true = targets_df[target].values

        # Average OOF probability across all repeats for visualization
        raw_prob_mean = np.mean(oof_arrays[f"auto|{target}|raw"], axis=0)
        cal_prob_mean = np.mean(oof_arrays[f"auto|{target}|cal"], axis=0)

        # Equal-frequency bin calibration curve
        for prob_vec, label, color, marker in [
            (raw_prob_mean, "Raw (Uncalibrated)", "#c44e52", "s"),
            (cal_prob_mean, "Platt Calibrated", "#2b5c8f", "o"),
        ]:
            bins = pd.qcut(prob_vec, q=5, duplicates="drop")
            bin_confs = []
            bin_accs = []
            for b in sorted(bins.unique(), key=lambda interval: interval.mid):
                m = np.asarray(bins == b)
                if np.sum(m) > 0:
                    bin_confs.append(float(np.mean(prob_vec[m])))
                    bin_accs.append(float(np.mean(y_true[m])))

            ax.plot(
                bin_confs,
                bin_accs,
                marker=marker,
                linewidth=1.8,
                markersize=6,
                label=label,
                color=color,
            )

        # Perfect calibration line
        ax.plot([0, 1], [0, 1], linestyle="--", color="gray", alpha=0.7, label="Perfect Calibration")

        ax.set_title(f"Target: {target}", fontsize=12, fontweight="bold")
        ax.set_xlabel("Mean Predicted Probability (5 Quantile Bins)", fontsize=10)
        ax.set_ylabel("Empirical Positive Fraction", fontsize=10)
        ax.set_xlim(-0.02, 1.02)
        ax.set_ylim(-0.02, 1.02)
        ax.grid(True, linestyle=":", alpha=0.6)
        ax.legend(frameon=True, facecolor="white", framealpha=0.9, fontsize=9)

    fig.suptitle(
        "TrustHeart 3D: Platt Calibration Reliability Diagrams (Space: 'auto')\n"
        "5 Equal-Frequency (Quantile) Bins Across Full Dataset OOF Predictions",
        fontsize=13,
        fontweight="bold",
        y=0.995,
    )
    plt.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    """Run nested CV, log selection frequencies, and save all artifacts."""
    eval_output = run_nested_cv()
    save_reports_and_artifacts(eval_output)


if __name__ == "__main__":
    main()
