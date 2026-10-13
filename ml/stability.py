"""Explanation stability evaluation via stratified bootstrapping and feature contribution tracking."""

from collections import Counter
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
import shap

from ml.config import (
    BOOTSTRAPS,
    CV_SEED,
    REPORTS_DIR,
    SPACES,
    STAB_MODERATE_FREQ,
    STAB_STABLE_FREQ,
    STAB_STABLE_SIGN,
    STAB_TOPK,
    TARGETS,
    compute_stability_tag,
)
from ml.data import drop_constant_columns, load_features, load_raw, load_targets
from ml.search_space import ALL_CONFIGS, build_estimator
from ml.utils import run_metadata


def _compute_feature_contributions(model: Any, X_mat: np.ndarray) -> np.ndarray:
    """Compute per-sample, per-feature contributions phi of shape (n_samples, n_features).

    Parameters
    ----------
    model : Pipeline or RandomForestClassifier
        Uncalibrated base estimator.
    X_mat : np.ndarray
        Feature matrix (303, n_features).

    Returns
    -------
    np.ndarray
        Contribution matrix of shape (n_samples, n_features).
    """
    if hasattr(model, "named_steps"):
        # LogisticRegression Pipeline with StandardScaler
        scaler = model.named_steps["scaler"]
        clf = model.named_steps["classifier"]
        Z = scaler.transform(X_mat)
        coef = clf.coef_[0]  # shape (n_features,)
        phi = Z * coef.reshape(1, -1)
        return phi
    else:
        # RandomForestClassifier TreeExplainer
        explainer = shap.TreeExplainer(model)
        shap_vals = explainer.shap_values(X_mat)

        if isinstance(shap_vals, list):
            # List of [class_0, class_1]
            return np.asarray(shap_vals[1], dtype=float)
        elif isinstance(shap_vals, np.ndarray) and shap_vals.ndim == 3:
            # Array of shape (n_samples, n_features, n_classes)
            return np.asarray(shap_vals[:, :, 1], dtype=float)
        else:
            return np.asarray(shap_vals, dtype=float)


def run_stability_analysis(
    models_dir: Path | str = "models",
    output_dir: Path | str = "reports",
) -> dict[str, Any]:
    """Execute stratified bootstrap explanation stability analysis across all spaces and targets.

    Parameters
    ----------
    models_dir : Path | str, optional
        Directory holding fitted models, by default 'models'.
    output_dir : Path | str, optional
        Destination directory for stability reports, by default 'reports'.

    Returns
    -------
    dict[str, Any]
        Dictionary of stability results, top feature summaries, and stability tags.
    """
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    clean_features, _ = drop_constant_columns(load_features(raw_df))
    n_samples = len(clean_features)

    models_path = Path(models_dir)
    reports_path = Path(output_dir)
    reports_path.mkdir(parents=True, exist_ok=True)

    stability_results: dict[str, dict[str, Any]] = {}

    print("\n" + "=" * 70)
    print(" TRUSTHEART 3D - STEP 4: EXPLANATION STABILITY ANALYSIS (BOOTSTRAP)")
    print("=" * 70)
    print(f"Bootstraps:             {BOOTSTRAPS}")
    print(f"Top-K Feature Rank:     {STAB_TOPK}")
    print(f"Stable Thresholds:      freq >= {STAB_STABLE_FREQ:.2f}, sign >= {STAB_STABLE_SIGN:.2f}")
    print(f"Moderate Threshold:     freq >= {STAB_MODERATE_FREQ:.2f}")
    print("=" * 70 + "\n")

    for space in SPACES:
        stability_results[space] = {}

        for target in TARGETS:
            model_file = models_path / f"{space}_{target}.joblib"
            if not model_file.exists():
                raise FileNotFoundError(f"Model file not found: {model_file}")

            artifact = joblib.load(model_file)
            config_name = artifact["config_name"]
            feature_list = artifact["feature_list"]
            n_features = len(feature_list)

            # Match configuration object
            selected_cfg = next(c for c in ALL_CONFIGS if c.name == config_name)

            y_target = targets_df[target].values
            X_orig_sub = clean_features[feature_list].to_numpy(dtype=float)

            # 1. Full-data model feature contributions
            full_est = build_estimator(selected_cfg)
            full_est.fit(X_orig_sub, y_target)
            full_phi = _compute_feature_contributions(full_est, X_orig_sub)
            full_importance = np.mean(np.abs(full_phi), axis=0)

            # Top-10 features for full-data model
            sorted_indices = np.argsort(-full_importance)
            top10_indices = sorted_indices[: min(10, n_features)]
            top10_features_full = [feature_list[idx] for idx in top10_indices]

            # 2. Bootstrap sampling
            # Track per-feature statistics across bootstraps
            feat_topk_counts: dict[str, int] = {f: 0 for f in feature_list}
            feat_importances_list: dict[str, list[float]] = {f: [] for f in feature_list}
            feat_directions_list: dict[str, list[int]] = {f: [] for f in feature_list}

            # Indices of class 0 and class 1 for stratified sampling with replacement
            idx_class0 = np.where(y_target == 0)[0]
            idx_class1 = np.where(y_target == 1)[0]
            n_0 = len(idx_class0)
            n_1 = len(idx_class1)

            for b in range(BOOTSTRAPS):
                rng = np.random.RandomState(CV_SEED + b)
                boot_idx0 = rng.choice(idx_class0, size=n_0, replace=True)
                boot_idx1 = rng.choice(idx_class1, size=n_1, replace=True)
                boot_indices = np.concatenate([boot_idx0, boot_idx1])

                X_boot = X_orig_sub[boot_indices]
                y_boot = y_target[boot_indices]

                boot_est = build_estimator(selected_cfg)
                boot_est.fit(X_boot, y_boot)

                # Compute contributions on the ORIGINAL 303 rows
                phi_boot = _compute_feature_contributions(boot_est, X_orig_sub)
                mean_abs_phi = np.mean(np.abs(phi_boot), axis=0)

                # Identify top-STAB_TOPK features in this bootstrap
                top_k_boot_idx = np.argsort(-mean_abs_phi)[:STAB_TOPK]
                top_k_boot_names = set(feature_list[i] for i in top_k_boot_idx)

                for j, f_name in enumerate(feature_list):
                    imp_val = float(mean_abs_phi[j])
                    feat_importances_list[f_name].append(imp_val)

                    if f_name in top_k_boot_names:
                        feat_topk_counts[f_name] += 1

                    # Direction: sign of Spearman correlation between feature and contribution
                    f_col = X_orig_sub[:, j]
                    c_col = phi_boot[:, j]

                    if np.all(f_col == f_col[0]) or np.all(c_col == c_col[0]):
                        direction = 0
                    else:
                        rho, _ = spearmanr(f_col, c_col)
                        if np.isnan(rho) or rho == 0.0:
                            direction = 0
                        else:
                            direction = int(np.sign(rho))

                    feat_directions_list[f_name].append(direction)

            # 3. Aggregate per-feature metrics
            feature_stats: dict[str, dict[str, Any]] = {}
            for f_name in feature_list:
                top_k_freq = float(feat_topk_counts[f_name] / BOOTSTRAPS)
                mean_imp = float(np.mean(feat_importances_list[f_name]))

                dirs = feat_directions_list[f_name]
                dir_counts = Counter(d for d in dirs if d != 0)

                if dir_counts:
                    # Majority non-zero direction
                    majority_dir, count_maj = dir_counts.most_common(1)[0]
                    sign_consistency = float(count_maj / BOOTSTRAPS)
                else:
                    majority_dir = 0
                    sign_consistency = 0.0

                tag = compute_stability_tag(top_k_freq, sign_consistency)

                feature_stats[f_name] = {
                    "top_k_freq": round(top_k_freq, 4),
                    "sign_consistency": round(sign_consistency, 4),
                    "majority_direction": int(majority_dir),
                    "mean_importance": round(mean_imp, 6),
                    "tag": tag,
                }

            # Top-10 summary table for this space x target
            top10_summary: list[dict[str, Any]] = []
            for rank, f_name in enumerate(top10_features_full, start=1):
                f_st = feature_stats[f_name]
                top10_summary.append(
                    {
                        "rank": rank,
                        "feature": f_name,
                        "mean_importance": f_st["mean_importance"],
                        "top_k_freq": f_st["top_k_freq"],
                        "sign_consistency": f_st["sign_consistency"],
                        "majority_direction": f_st["majority_direction"],
                        "tag": f_st["tag"],
                    }
                )

            stability_results[space][target] = {
                "config_name": config_name,
                "n_features": n_features,
                "top10_features_full": top10_features_full,
                "top10_summary": top10_summary,
                "all_features": feature_stats,
            }

            print(
                f"[{space.upper():5s}] Target: {target:<4s} | "
                f"Top 3 Stable Features: {[s['feature'] for s in top10_summary if s['tag'] == 'stable'][:3]}"
            )

    meta = run_metadata()
    output_data = {
        **meta,
        "config": {
            "bootstraps": BOOTSTRAPS,
            "stab_topk": STAB_TOPK,
            "stab_stable_freq": STAB_STABLE_FREQ,
            "stab_stable_sign": STAB_STABLE_SIGN,
            "stab_moderate_freq": STAB_MODERATE_FREQ,
            "cv_seed": CV_SEED,
        },
        "results": stability_results,
    }

    # Save reports/stability.json
    json_path = reports_path / "stability.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)
    print(f"\nSaved stability report JSON to: {json_path}")

    # Save reports/stability.md
    md_path = reports_path / "stability.md"
    md_lines = [
        "# TrustHeart 3D - Step 4: Explanation Stability Report",
        "",
        f"- **Timestamp (UTC)**: {meta['timestamp_utc']}",
        f"- **Git Commit**: `{meta['git_commit']}` (dirty: {meta['git_dirty']})",
        f"- **Bootstraps**: {BOOTSTRAPS} stratified resamples with replacement",
        f"- **Stability Criteria**:",
        f"  - **Stable**: Top-{STAB_TOPK} frequency $\\ge {STAB_STABLE_FREQ:.0%}$ AND Sign consistency $\\ge {STAB_STABLE_SIGN:.0%}$",
        f"  - **Moderate**: Top-{STAB_TOPK} frequency $\\ge {STAB_MODERATE_FREQ:.0%}$ (not meeting stable)",
        f"  - **Unstable**: Otherwise",
        "",
        "---",
        "",
    ]

    for space in SPACES:
        md_lines.append(f"## Search Space: `{space.upper()}`")
        md_lines.append("")

        for target in TARGETS:
            t_res = stability_results[space][target]
            md_lines.append(f"### Target: **{target}** (`{t_res['config_name']}`)")
            md_lines.append("")
            md_lines.append(
                "| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |"
            )
            md_lines.append("|---|---|---|---|---|---|---|")

            for row in t_res["top10_summary"]:
                dir_str = "+ (Positive)" if row["majority_direction"] > 0 else ("- (Negative)" if row["majority_direction"] < 0 else "0 (Neutral)")
                tag_badge = f"**{row['tag'].upper()}**" if row["tag"] == "stable" else row["tag"].capitalize()
                md_lines.append(
                    f"| {row['rank']} | **{row['feature']}** | {row['mean_importance']:.4f} | "
                    f"{row['top_k_freq']:.1%} | {row['sign_consistency']:.1%} | {dir_str} | {tag_badge} |"
                )
            md_lines.append("")

        md_lines.append("---")
        md_lines.append("")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    print(f"Saved stability report Markdown to: {md_path}")
    print("\n" + "\n".join(md_lines) + "\n")

    return output_data


def main() -> None:
    """Execute bootstrap stability analysis and persist reports."""
    run_stability_analysis()


if __name__ == "__main__":
    main()
