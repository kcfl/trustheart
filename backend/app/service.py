"""Service layer for model verification, inference, Fréchet coherence, and trust analytics."""

import hashlib
import json
import math
import os
import uuid
from pathlib import Path
from typing import Any, Sequence

import numpy as np
import pandas as pd
from scipy.special import expit, logit

from backend.app.config import (
    BAND_HIGHER_THRESHOLD,
    BAND_LOWER_THRESHOLD,
    BANDS_NOTE,
    DISCLAIMER,
    FEATURE_GROUPS,
    FULL_HUMAN_FEATURES,
    LIMITATIONS,
    QUICK_FEATURES,
    get_probability_band,
)
from backend.app.schemas import (
    ConsistencyInfo,
    ContributionItem,
    FeatureMetaItem,
    HealthResponse,
    LiftItem,
    MetaResponse,
    ModeDefinition,
    ModelExportResponse,
    ModelInfo,
    PredictRequest,
    PredictResponse,
    PredictWarning,
    SamplePatient,
    SamplesResponse,
    SimilarPatientItem,
    TargetModelExport,
    TargetPrediction,
    TrustBlock,
)
from ml.coherence import apply_coherence, frechet_bounds
from ml.config import (
    LEAK_COLS,
    KNN_K_EVIDENCE,
    N_SIMILAR_SHOWN,
    SPACES,
    TARGETS,
    VHD_ORDINAL_MAPPING,
)
from ml.data import assert_no_leak, drop_constant_columns, load_features, load_raw, load_targets
from ml.predict import load_model
from ml.similar import SimilarPatients


def compute_sha256(file_path: Path) -> str:
    """Compute hexadecimal SHA-256 digest of a file."""
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class ModelService:
    """Core service for model inference, integrity verification, and trust layer metrics."""

    def __init__(self, models_dir: Path | str | None = None) -> None:
        """Initialize ModelService and fail closed if integrity verification fails."""
        self.models_dir = Path(models_dir or os.getenv("TRUSTHEART_MODELS_DIR", "models"))
        self.verify_and_load()

    def verify_and_load(self) -> None:
        """Verify SHA-256 digests against manifest.json and load all required artifacts."""
        manifest_path = self.models_dir / "manifest.json"
        if not manifest_path.exists():
            raise RuntimeError(f"Manifest not found at {manifest_path}; refusing to start.")

        with open(manifest_path, encoding="utf-8") as f:
            self.manifest: dict[str, Any] = json.load(f)

        # 1. Cryptographic integrity check: fail closed if any manifest entry fails
        manifest_files = self.manifest.get("files", {})
        for rel_path_str, expected_hash in manifest_files.items():
            # Resolve file path relative to models_dir or repo root
            file_path = self.models_dir / Path(rel_path_str).name
            if not file_path.exists():
                file_path = Path(rel_path_str)
            if not file_path.exists():
                raise RuntimeError(
                    f"Required artifact {rel_path_str} is missing; startup failed closed."
                )

            actual_hash = compute_sha256(file_path)
            if actual_hash != expected_hash:
                raise RuntimeError(
                    f"Integrity check failed for {rel_path_str}!\n"
                    f"Expected SHA-256: {expected_hash}\n"
                    f"Computed SHA-256: {actual_hash}"
                )

        # 2. Load feature statistics
        stats_path = self.models_dir / "feature_stats.json"
        with open(stats_path, encoding="utf-8") as f:
            self.feature_stats: dict[str, dict[str, Any]] = json.load(f)

        # 3. Load trust statistics
        trust_stats_path = self.models_dir / "trust_stats.json"
        with open(trust_stats_path, encoding="utf-8") as f:
            self.trust_stats: dict[str, Any] = json.load(f)

        # 4. Load all 8 final model artifacts
        self.models: dict[tuple[str, str], dict[str, Any]] = {}
        for space in SPACES:
            for target in TARGETS:
                self.models[(space, target)] = load_model(space, target, models_dir=self.models_dir)

        # 5. Load out-of-fold predictions
        oof_path = self.models_dir / "nested_oof.npz"
        if not oof_path.exists():
            raise RuntimeError(f"OOF array file missing at {oof_path}")
        self.oof_data = np.load(oof_path)

        # 6. Initialize similarity search engine with training data
        raw_df = load_raw()
        self.raw_df = raw_df
        self.targets_df = load_targets(raw_df)
        clean_features, _ = drop_constant_columns(load_features(raw_df))
        self.clean_features = clean_features
        self.clean_feature_cols = list(clean_features.columns)
        self.similar_engine = SimilarPatients(self.clean_features, self.targets_df)

        # 7. Precompute deterministic demo sample patients
        self._init_demo_samples()

    def _init_demo_samples(self) -> None:
        """Select exactly 4 deterministic demo patients from nested OOF CAD predictions."""
        # Mean calibrated CAD probability across 10 repeats
        mean_p_cad = self.oof_data["auto|CAD|cal"].mean(axis=0)

        p10 = np.percentile(mean_p_cad, 10)
        p50 = np.percentile(mean_p_cad, 50)
        p90 = np.percentile(mean_p_cad, 90)

        lcx_pos_indices = np.where(self.targets_df["LCX"].values == 1)[0]
        p50_lcx = np.percentile(mean_p_cad[lcx_pos_indices], 50)

        idx_10 = int(np.argmin(np.abs(mean_p_cad - p10)))
        idx_50 = int(np.argmin(np.abs(mean_p_cad - p50)))
        idx_90 = int(np.argmin(np.abs(mean_p_cad - p90)))
        idx_lcx = int(lcx_pos_indices[np.argmin(np.abs(mean_p_cad[lcx_pos_indices] - p50_lcx))])

        sample_specs = [
            (idx_10, "p10", "10th percentile of dataset CAD risk (out-of-fold)"),
            (idx_50, "median", "median of dataset CAD risk (out-of-fold)"),
            (idx_90, "p90", "90th percentile of dataset CAD risk (out-of-fold)"),
            (idx_lcx, "lcx_positive_near_median", "LCX-positive patient near the median"),
        ]

        self.demo_samples: list[SamplePatient] = []
        for case_idx, label, label_text in sample_specs:
            raw_row = self.raw_df.iloc[case_idx]
            gt_row = self.targets_df.iloc[case_idx]

            inputs_dict: dict[str, Any] = {}
            for col in FULL_HUMAN_FEATURES:
                val = raw_row[col]
                if col == "Sex":
                    inputs_dict[col] = "Male" if str(val).strip().lower() == "male" else "Female"
                elif col == "VHD":
                    inputs_dict[col] = str(val).strip()
                elif col == "BBB":
                    inputs_dict[col] = str(val).strip()
                elif col in self.feature_stats and self.feature_stats[col].get("is_binary", False):
                    inputs_dict[col] = bool(val == 1 or val == "Y" or val == 1.0)
                else:
                    inputs_dict[col] = float(val)

            oof_est = {
                t: float(self.oof_data[f"auto|{t}|cal"][:, case_idx].mean())
                for t in TARGETS
            }

            self.demo_samples.append(
                SamplePatient(
                    case_id=int(case_idx),
                    label=label,
                    label_text=label_text,
                    inputs=inputs_dict,
                    ground_truth={t: int(gt_row[t]) for t in TARGETS},
                    oof_estimate=oof_est,
                )
            )

    def get_health(self) -> HealthResponse:
        """Provide health status and cryptographic verification metadata."""
        git_commit = str(self.manifest.get("git_commit", "unknown"))
        return HealthResponse(
            status="ok",
            model_version=f"ml-v1 ({git_commit})",
            git_commit=git_commit,
            models_verified=True,
            disclaimer=DISCLAIMER,
        )

    def get_meta(self) -> MetaResponse:
        """Construct feature schema and mode definitions."""
        # 1. Invert FEATURE_GROUPS to column -> group mapping
        col_to_group = {}
        for grp, cols in FEATURE_GROUPS.items():
            for c in cols:
                col_to_group[c] = grp

        features_meta: list[FeatureMetaItem] = []
        for feat in FULL_HUMAN_FEATURES:
            group = col_to_group.get(feat, "Other")
            in_quick = feat in QUICK_FEATURES

            # Kind and allowed values
            if feat == "Sex":
                kind = "categorical"
                allowed = ["Male", "Female"]
                t_min, t_max, t_med = 0.0, 1.0, float(self.feature_stats["Sex"]["median"])
            elif feat == "VHD":
                kind = "ordinal"
                allowed = ["N", "mild", "Moderate", "Severe"]
                t_min, t_max, t_med = 0.0, 3.0, float(self.feature_stats["VHD"]["median"])
            elif feat == "BBB":
                kind = "categorical"
                allowed = ["N", "LBBB", "RBBB"]
                t_min, t_max, t_med = 0.0, 1.0, 0.0
            elif feat in self.feature_stats and self.feature_stats[feat].get("is_binary", False):
                kind = "binary"
                allowed = [False, True]
                f_s = self.feature_stats[feat]
                t_min, t_max, t_med = f_s["min"], f_s["max"], f_s["median"]
            else:
                kind = "continuous"
                allowed = None
                f_s = self.feature_stats.get(feat, {"min": 0.0, "max": 100.0, "median": 50.0})
                t_min, t_max, t_med = f_s["min"], f_s["max"], f_s["median"]

            features_meta.append(
                FeatureMetaItem(
                    name=feat,
                    label=feat,
                    kind=kind,
                    group=group,
                    allowed_values=allowed,
                    training_min=t_min,
                    training_max=t_max,
                    training_median=t_med,
                    training={"min": t_min, "max": t_max, "median": t_med},
                    in_quick=in_quick,
                    unit=None,
                )
            )

        modes = {
            "quick": ModeDefinition(
                name="quick",
                description="Quick screening mode using 7 compact clinical features",
                n_features=len(QUICK_FEATURES),
                features=list(QUICK_FEATURES),
            ),
            "full": ModeDefinition(
                name="full",
                description="Full clinical mode using all 54 features and nested CV-tuned models",
                n_features=len(FULL_HUMAN_FEATURES),
                features=list(FULL_HUMAN_FEATURES),
            ),
        }

        return MetaResponse(modes=modes, features=features_meta)

    def get_samples(self) -> SamplesResponse:
        """Return the precomputed 4 representative patient profiles."""
        return SamplesResponse(samples=self.demo_samples)

    def get_model_export(self, mode: str) -> ModelExportResponse:
        """Export LR weights and Platt parameters for browser-side re-computation."""
        space = "quick" if mode.lower() == "quick" else "auto"
        exported_targets: dict[str, TargetModelExport] = {}

        for target in TARGETS:
            artifact = self.models[(space, target)]
            pipeline = artifact["pipeline"]

            # Validate pipeline structure
            if "scaler" not in pipeline.named_steps or "classifier" not in pipeline.named_steps:
                raise NotImplementedError(
                    f"Model for ({space}, {target}) is not a pure StandardScaler + LogisticRegression pipeline."
                )

            scaler = pipeline.named_steps["scaler"]
            clf = pipeline.named_steps["classifier"]
            feature_list = artifact["feature_list"]

            defaults = {
                f: float(self.feature_stats[f]["median"]) if f in self.feature_stats else 0.0
                for f in feature_list
            }

            exported_targets[target] = TargetModelExport(
                feature_list=list(feature_list),
                scaler_mean=[float(x) for x in scaler.mean_],
                scaler_scale=[float(x) for x in scaler.scale_],
                coef=[float(x) for x in clf.coef_[0]],
                intercept=float(clf.intercept_[0]),
                platt_a=float(artifact["platt_a"]),
                platt_b=float(artifact["platt_b"]),
                defaults=defaults,
            )

        return ModelExportResponse(mode=mode, targets=exported_targets)

    def predict(self, request: PredictRequest) -> PredictResponse:
        """Run validated, calibrated prediction with Fréchet coherence and trust metrics."""
        request_id = str(uuid.uuid4())
        mode = request.mode
        space = "quick" if mode == "quick" else "auto"
        expected_features = QUICK_FEATURES if mode == "quick" else FULL_HUMAN_FEATURES

        # 1. Assert no data leakage in requested inputs
        assert_no_leak(request.inputs.keys())

        # 2. Track missing features and impute with training medians
        imputed_features: list[str] = []
        for feat in expected_features:
            if feat not in request.inputs or request.inputs[feat] is None:
                imputed_features.append(feat)

        warnings: list[PredictWarning] = []
        imputed_ratio = len(imputed_features) / len(expected_features)
        if imputed_ratio > 0.30:
            warnings.append(
                PredictWarning(
                    code="low_reliability",
                    message=(
                        f"{len(imputed_features)} of {len(expected_features)} mode features "
                        f"({imputed_ratio:.1%}) were imputed from training medians."
                    ),
                )
            )

        # 3. Soft range check on numeric inputs
        for feat, val in request.inputs.items():
            if val is not None and isinstance(val, (int, float)) and not isinstance(val, bool):
                if feat in self.feature_stats:
                    t_min = self.feature_stats[feat]["min"]
                    t_max = self.feature_stats[feat]["max"]
                    if val < t_min or val > t_max:
                        warnings.append(
                            PredictWarning(
                                code="outside_training_range",
                                feature=feat,
                                value=val,
                                min=t_min,
                                max=t_max,
                                message=(
                                    f"Value {val} for '{feat}' is outside observed training "
                                    f"range [{t_min}, {t_max}]."
                                ),
                            )
                        )

        # 4. Synthesize complete human-readable feature record
        filled_inputs: dict[str, Any] = dict(request.inputs)
        for feat in imputed_features:
            if feat == "Sex":
                filled_inputs[feat] = "Male" if self.feature_stats["Sex"]["median"] == 1.0 else "Female"
            elif feat == "VHD":
                filled_inputs[feat] = "N"
            elif feat == "BBB":
                filled_inputs[feat] = "N"
            elif feat in self.feature_stats and self.feature_stats[feat].get("is_binary", False):
                filled_inputs[feat] = bool(self.feature_stats[feat]["median"] == 1.0)
            elif feat in self.feature_stats:
                filled_inputs[feat] = float(self.feature_stats[feat]["median"])
            else:
                filled_inputs[feat] = 0.0

        # 5. Convert to numerical representation for model pipeline
        numeric_inputs: dict[str, float] = {}
        for feat in FULL_HUMAN_FEATURES:
            val = filled_inputs.get(feat)
            if feat == "Sex":
                numeric_inputs[feat] = 1.0 if str(val).strip().lower() == "male" else 0.0
            elif feat == "VHD":
                key = str(val).strip().lower()
                numeric_inputs[feat] = float(VHD_ORDINAL_MAPPING.get(key, 0))
            elif feat == "BBB":
                bbb_str = str(val).strip()
                numeric_inputs["BBB_LBBB"] = 1.0 if bbb_str == "LBBB" else 0.0
                numeric_inputs["BBB_RBBB"] = 1.0 if bbb_str == "RBBB" else 0.0
            elif feat in self.feature_stats and self.feature_stats[feat].get("is_binary", False):
                numeric_inputs[feat] = 1.0 if bool(val) else 0.0
            else:
                numeric_inputs[feat] = float(val) if val is not None else 0.0

        # 6. Compute predictions, logit contributions, and bands per target
        raw_p_map: dict[str, float] = {}
        cal_p_map: dict[str, float] = {}
        intermediate_targets: dict[str, dict[str, Any]] = {}

        for target in TARGETS:
            artifact = self.models[(space, target)]
            pipeline = artifact["pipeline"]
            scaler = pipeline.named_steps["scaler"]
            clf = pipeline.named_steps["classifier"]
            features = artifact["feature_list"]
            platt_a = float(artifact["platt_a"])
            platt_b = float(artifact["platt_b"])

            # Feature vector and standardization
            x_vec = np.array([numeric_inputs[f] for f in features], dtype=float)
            z_vec = (x_vec - scaler.mean_) / scaler.scale_

            # Raw uncalibrated decision function and probability
            w = clf.coef_[0]
            c = float(clf.intercept_[0])
            score = float(np.dot(w, z_vec) + c)
            raw_p = float(expit(score))

            # Platt calibrated logit and probability
            logit_cal = float(platt_a * score + platt_b)
            cal_p = float(expit(logit_cal))

            raw_p_map[target] = raw_p
            cal_p_map[target] = cal_p

            # Decomposition into exact linear contributions
            base = float(platt_a * c + platt_b)
            all_contribs: list[ContributionItem] = []

            for j, f_name in enumerate(features):
                contrib_val = float(platt_a * w[j] * z_vec[j])
                direction = "up" if contrib_val >= 0.0 else "down"

                # Check if feature was imputed
                if f_name in ["BBB_LBBB", "BBB_RBBB"]:
                    f_imputed = "BBB" in imputed_features
                    entered_val = request.inputs.get("BBB") if not f_imputed else filled_inputs.get("BBB")
                else:
                    f_imputed = f_name in imputed_features
                    entered_val = request.inputs.get(f_name) if not f_imputed else filled_inputs.get(f_name)

                # Stability tag from trust_stats
                stab_tag = None
                try:
                    stab_tag = (
                        self.trust_stats["stability_tags"][space][target]["features"]
                        .get(f_name, {})
                        .get("tag")
                    )
                except KeyError:
                    pass

                all_contribs.append(
                    ContributionItem(
                        feature=f_name,
                        value=entered_val,
                        contribution=contrib_val,
                        direction=direction,
                        stability_tag=stab_tag,
                        imputed=f_imputed,
                    )
                )

            # Sort descending by absolute contribution
            all_contribs.sort(key=lambda item: abs(item.contribution), reverse=True)
            top_10 = all_contribs[:10]
            other_total = float(sum(item.contribution for item in all_contribs[10:]))

            # Important feature imputed warnings: top 5 by abs contribution or stable
            for rank, item in enumerate(all_contribs):
                if item.imputed:
                    if rank < 5 or item.stability_tag == "stable":
                        human_feat = "BBB" if item.feature in ["BBB_LBBB", "BBB_RBBB"] else item.feature
                        if not any(
                            w.code == "important_feature_imputed"
                            and w.feature == human_feat
                            and w.target == target
                            for w in warnings
                        ):
                            warnings.append(
                                PredictWarning(
                                    code="important_feature_imputed",
                                    feature=human_feat,
                                    target=target,
                                    message=(
                                        "Missing value was filled with the training median/most frequent value; "
                                        "this feature matters for this target."
                                    ),
                                )
                            )

            band = get_probability_band(cal_p)

            # Features used with BBB unified as one name
            features_used: list[str] = []
            for f in features:
                f_name = "BBB" if f in ["BBB_LBBB", "BBB_RBBB"] else f
                if f_name not in features_used:
                    features_used.append(f_name)

            model_info = ModelInfo(
                config_name=str(artifact["config_name"]),
                n_features=len(features_used),
                features_used=features_used,
                source_space=artifact["space"],
            )
            base_rate = float(self.targets_df[target].mean())

            intermediate_targets[target] = {
                "raw_probability": raw_p,
                "calibrated_probability": cal_p,
                "band": band,
                "base": base,
                "contributions": top_10,
                "other_total": other_total,
                "logit_model": logit_cal,
                "model_info": model_info,
                "base_rate": base_rate,
            }

        # 7. Apply Fréchet Coherence Bounds to CAD
        lower_bound, upper_bound = frechet_bounds(
            cal_p_map["LAD"], cal_p_map["LCX"], cal_p_map["RCA"]
        )
        p_cad_adj, coh_status = apply_coherence(
            cal_p_map["CAD"], cal_p_map["LAD"], cal_p_map["LCX"], cal_p_map["RCA"]
        )

        consistency = ConsistencyInfo(
            status=str(coh_status.item() if hasattr(coh_status, "item") else coh_status),
            lower=float(lower_bound.item() if hasattr(lower_bound, "item") else lower_bound),
            upper=float(upper_bound.item() if hasattr(upper_bound, "item") else upper_bound),
            p_cad_model=float(cal_p_map["CAD"]),
            p_cad_adjusted=float(p_cad_adj.item() if hasattr(p_cad_adj, "item") else p_cad_adj),
        )

        # Assemble final TargetPrediction objects with display fields
        target_predictions: dict[str, TargetPrediction] = {}
        for target in TARGETS:
            inter = intermediate_targets[target]
            if target == "CAD":
                display_p = consistency.p_cad_adjusted
                display_b = get_probability_band(display_p)
                is_adj = bool(consistency.status != "ok")
                disp_note = (
                    "Adjusted to stay logically consistent with the vessel probabilities "
                    "(CAD is defined as at least one stenotic vessel)."
                    if is_adj
                    else None
                )
            else:
                display_p = inter["calibrated_probability"]
                display_b = get_probability_band(display_p)
                is_adj = False
                disp_note = None

            target_predictions[target] = TargetPrediction(
                raw_probability=inter["raw_probability"],
                calibrated_probability=inter["calibrated_probability"],
                band=inter["band"],
                display_probability=display_p,
                display_band=display_b,
                adjusted=is_adj,
                display_note=disp_note,
                base=inter["base"],
                contributions=inter["contributions"],
                other_total=inter["other_total"],
                logit_model=inter["logit_model"],
                model_info=inter["model_info"],
                base_rate=inter["base_rate"],
            )


        # 8. Build Trust Block (similar patients, LOO evidence, lift)
        # Determine available columns (non-imputed features of the mode)
        if mode == "quick":
            available_cols = [c for c in QUICK_FEATURES if c not in imputed_features]
        else:
            available_cols = [
                c
                for c in self.clean_feature_cols
                if c not in imputed_features
                and (c not in ["BBB_LBBB", "BBB_RBBB"] or "BBB" not in imputed_features)
            ]

        similar_patients_list: list[SimilarPatientItem] = []
        evidence_estimates: dict[str, float] | None = None

        if len(available_cols) < 3:
            warnings.append(
                PredictWarning(
                    code="insufficient_features_for_similarity",
                    message="Fewer than 3 provided columns are available; similar patient search was skipped.",
                )
            )
        else:
            query_neighbors = self.similar_engine.query(
                numeric_inputs,
                available_cols=available_cols,
                k=N_SIMILAR_SHOWN,
                exclude_index=request.case_id,
            )
            for n in query_neighbors:
                similar_patients_list.append(
                    SimilarPatientItem(
                        case_id=n["case_id"],
                        distance=n["distance"],
                        age_band=n["age_band"],
                        sex=n["sex"],
                        outcomes=n["outcomes"],
                    )
                )

            evidence_estimates = self.similar_engine.knn_estimate(
                numeric_inputs,
                available_cols=available_cols,
                k=KNN_K_EVIDENCE,
                exclude_index=request.case_id,
            )

        evidence_aucs = self.trust_stats["loo_evidence_aucs"][
            "compact" if mode == "quick" else "full"
        ]

        lift_data = {
            t: LiftItem(
                paired_mean=float(self.trust_stats["lift"][t]["paired_mean"]),
                p2_5=float(self.trust_stats["lift"][t]["p2_5"]),
                p97_5=float(self.trust_stats["lift"][t]["p97_5"]),
                selection_identical_fraction=float(
                    self.trust_stats["lift"][t]["selection_identical_fraction"]
                ),
            )
            for t in TARGETS
        }

        trust_block = TrustBlock(
            similar_patients=similar_patients_list,
            evidence_estimate=evidence_estimates,
            evidence_auc=evidence_aucs,
            lift=lift_data,
            bands_note=BANDS_NOTE,
        )

        # 9. Out-of-fold benchmark if valid case_id given
        oof_estimate = None
        oof_estimate_note = None
        if request.case_id is not None and 0 <= request.case_id < 303:
            oof_estimate = {
                t: float(self.oof_data[f"auto|{t}|cal"][:, request.case_id].mean())
                for t in TARGETS
            }
            oof_estimate_note = (
                "out-of-fold: this patient was held out during nested CV. "
                "Main probabilities come from the all-data model (in-sample for this patient)."
            )

        git_commit = str(self.manifest.get("git_commit", "unknown"))

        return PredictResponse(
            request_id=request_id,
            mode=mode,
            model_version=f"ml-v1 ({git_commit})",
            predictions=target_predictions,
            consistency=consistency,
            trust=trust_block,
            imputed=imputed_features,
            warnings=warnings,
            oof_estimate=oof_estimate,
            oof_estimate_note=oof_estimate_note,
            disclaimer=DISCLAIMER,
            limitations=list(LIMITATIONS),
        )


# Singleton instance accessor
_service_instance: ModelService | None = None


def get_model_service() -> ModelService:
    """Retrieve or initialize the ModelService singleton instance."""
    global _service_instance
    if _service_instance is None:
        _service_instance = ModelService()
    return _service_instance
