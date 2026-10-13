"""Final model fitting on the complete dataset (303 samples), calibration, and model artifact manifest."""

import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, cross_val_predict
from sklearn.metrics import roc_auc_score

from ml.calibration import fit_platt
from ml.config import (
    CALIB_SPLITS,
    COMPACT_FEATURES,
    CV_SEED,
    INNER_REPEATS,
    INNER_SPLITS,
    SPACES,
    TARGETS,
)
from ml.data import drop_constant_columns, load_features, load_raw, load_targets
from ml.search_space import ALL_CONFIGS, build_estimator, get_space_configs
from ml.select import select_config
from ml.utils import run_metadata


def compute_feature_statistics(X_df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """Compute summary statistics and encoding notes for each feature in the cleaned feature set.

    Parameters
    ----------
    X_df : pd.DataFrame
        Cleaned 55-feature matrix.

    Returns
    -------
    dict[str, dict[str, Any]]
        Per-feature statistics including min, max, median, mean, std, is_binary, and encoding note.
    """
    stats: dict[str, dict[str, Any]] = {}

    for col in X_df.columns:
        s = X_df[col]
        vals_set = set(s.dropna().unique())
        is_bin = vals_set.issubset({0, 1, 0.0, 1.0})

        # Derive human-readable encoding note
        if col == "Sex":
            note = "Binary encoding: Male=1, Fmale=0"
        elif col == "VHD":
            note = "Ordinal encoding: N=0, mild=1, Moderate=2, Severe=3"
        elif col == "BBB_LBBB":
            note = "One-hot indicator: LBBB=1, else=0 (baseline N=0)"
        elif col == "BBB_RBBB":
            note = "One-hot indicator: RBBB=1, else=0 (baseline N=0)"
        elif is_bin:
            if col in [
                "DM",
                "HTN",
                "Current Smoker",
                "Obesity",
                "CRF",
                "CVA",
                "Airway disease",
                "Thyroid Disease",
                "CHF",
                "DLP",
                "Weak Peripheral Pulse",
                "Lung rales",
                "Systolic Murmur",
                "Diastolic Murmur",
                "Dyspnea",
                "Atypical",
                "Nonanginal",
                "Poor R Progression",
            ]:
                note = "Binary indicator: Y=1, N=0"
            elif col in ["Q Wave", "St Elevation", "St Depression", "Tinversion", "LVH"]:
                note = "Binary ECG finding: presence=1, absence=0"
            else:
                note = "Binary clinical indicator: 1=present, 0=absent"
        else:
            note = "Numeric continuous / clinical laboratory measurement"

        stats[col] = {
            "min": float(s.min()),
            "max": float(s.max()),
            "median": float(s.median()),
            "mean": float(s.mean()),
            "std": float(s.std(ddof=1)),
            "is_binary": bool(is_bin),
            "encoding_note": note,
        }

    return stats


def compute_sha256(file_path: Path) -> str:
    """Compute hexadecimal SHA-256 digest of a file.

    Parameters
    ----------
    file_path : Path
        Target file path.

    Returns
    -------
    str
        Hexadecimal SHA-256 hash.
    """
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def fit_and_save_final_models() -> dict[str, Any]:
    """Execute model selection, Platt calibration, and final fitting on full dataset (303 samples).

    Returns
    -------
    dict[str, Any]
        Dictionary of final fitted artifacts and selection metadata.
    """
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    clean_features, _ = drop_constant_columns(load_features(raw_df))
    n_samples = len(clean_features)

    models_dir = Path("models")
    models_dir.mkdir(parents=True, exist_ok=True)

    feature_cols_map = {
        "compact": list(COMPACT_FEATURES),
        "full": list(clean_features.columns),
    }

    # 1. Compute and save feature statistics
    feature_stats = compute_feature_statistics(clean_features)
    stats_path = models_dir / "feature_stats.json"
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(feature_stats, f, indent=2)
    print(f"Saved feature statistics to: {stats_path}")

    meta = run_metadata()
    git_commit_hash = meta["git_commit"]

    selection_records: list[dict[str, Any]] = []
    saved_model_files: list[Path] = []

    print("\n" + "=" * 70)
    print(" TRUSTHEART 3D - STEP 3: FINAL MODEL TRAINING (ALL 303 SAMPLES)")
    print("=" * 70)

    # 2. For each target, evaluate inner CV scores on all 18 configs once
    for target in TARGETS:
        print(f"\n--- Target: {target} ---")
        y = targets_df[target].values

        inner_cv = RepeatedStratifiedKFold(
            n_splits=INNER_SPLITS,
            n_repeats=INNER_REPEATS,
            random_state=CV_SEED,
        )
        inner_splits = list(inner_cv.split(clean_features, y))

        inner_scores: dict[str, list[float]] = {c.name: [] for c in ALL_CONFIGS}
        for in_tr_idx, in_val_idx in inner_splits:
            X_in_tr = clean_features.iloc[in_tr_idx]
            y_in_tr = y[in_tr_idx]
            X_in_val = clean_features.iloc[in_val_idx]
            y_in_val = y[in_val_idx]

            for c in ALL_CONFIGS:
                cols = feature_cols_map[c.featureset]
                est = build_estimator(c)
                est.fit(X_in_tr[cols], y_in_tr)
                p_val = est.predict_proba(X_in_val[cols])[:, 1]
                inner_scores[c.name].append(float(roc_auc_score(y_in_val, p_val)))

        inner_scores_arr = {k: np.array(v) for k, v in inner_scores.items()}

        # 3. For each search space (auto, quick): select config, calibrate, fit final
        for space in SPACES:
            sp_configs = get_space_configs(space)
            selected_cfg = select_config(inner_scores_arr, sp_configs)
            sel_cols = feature_cols_map[selected_cfg.featureset]

            # 5-fold stratified out-of-fold calibration on full dataset
            cal_cv = StratifiedKFold(
                n_splits=CALIB_SPLITS,
                shuffle=True,
                random_state=CV_SEED,
            )
            base_model_for_cal = build_estimator(selected_cfg)
            cal_scores = cross_val_predict(
                base_model_for_cal,
                clean_features[sel_cols],
                y,
                cv=cal_cv,
                method="predict_proba",
                n_jobs=1,
            )[:, 1]

            platt_a, platt_b = fit_platt(cal_scores, y)

            # Fit base model on all 303 samples
            final_estimator = build_estimator(selected_cfg)
            final_estimator.fit(clean_features[sel_cols], y)

            # Save models/{space}_{target}.joblib
            model_path = models_dir / f"{space}_{target}.joblib"
            artifact_dict = {
                "pipeline": final_estimator,
                "platt_a": platt_a,
                "platt_b": platt_b,
                "feature_list": sel_cols,
                "config_name": selected_cfg.name,
                "space": space,
                "target": target,
                "git_commit": git_commit_hash,
            }
            joblib.dump(artifact_dict, model_path, compress=3)
            saved_model_files.append(model_path)

            print(
                f"[{space.upper():5s}] Model: {selected_cfg.name:<25s} | "
                f"Features: {len(sel_cols)} cols | Platt: slope={platt_a:.4f}, int={platt_b:.4f} -> {model_path}"
            )

            selection_records.append(
                {
                    "space": space,
                    "target": target,
                    "config_name": selected_cfg.name,
                    "featureset": selected_cfg.featureset,
                    "model": selected_cfg.model,
                    "n_features": len(sel_cols),
                    "platt_a": round(platt_a, 4),
                    "platt_b": round(platt_b, 4),
                }
            )

    # 4. Save models/final_selection.md
    md_lines = [
        "# TrustHeart 3D - Step 5: Final Model Selection & Calibration",
        "",
        "Final models selected using the 1-SE simplicity heuristic on full dataset (303 samples, 6 inner folds).",
        "",
        "| Space | Target | Selected Configuration | Featureset | Model Architecture | Features Used | Platt Slope (a) | Platt Intercept (b) |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for r in selection_records:
        md_lines.append(
            f"| `{r['space']}` | **{r['target']}** | `{r['config_name']}` | `{r['featureset']}` | "
            f"{r['model']} | {r['n_features']} | {r['platt_a']:.4f} | {r['platt_b']:.4f} |"
        )
    md_lines.append("")

    selection_md_path = models_dir / "final_selection.md"
    with open(selection_md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    print(f"\nSaved final selection summary to: {selection_md_path}")
    print("\n" + "\n".join(md_lines) + "\n")

    # 5. Save models/manifest.json with SHA-256 digests
    files_to_hash = saved_model_files + [stats_path]
    file_hashes = {}
    for p in files_to_hash:
        rel_key = p.as_posix()
        file_hashes[rel_key] = compute_sha256(p)

    manifest_data = {
        **meta,
        "files": file_hashes,
    }
    manifest_path = models_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2)
    print(f"Saved model artifact manifest to: {manifest_path}")

    return {
        "manifest": manifest_data,
        "selection_records": selection_records,
    }


def main() -> None:
    """Train and persist final models and manifest."""
    fit_and_save_final_models()


if __name__ == "__main__":
    main()
