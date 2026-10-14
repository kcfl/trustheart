"""Pydantic v2 schemas for the TrustHeart 3D FastAPI API."""

import math
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.app.config import (
    BANDS_NOTE,
    DISCLAIMER,
    FULL_HUMAN_FEATURES,
    LIMITATIONS,
    QUICK_FEATURES,
)
from ml.config import LEAK_COLS, SEX_MAPPING, VHD_ORDINAL_MAPPING


# ---------------------------------------------------------------------------
# Base Schema Configuration
# ---------------------------------------------------------------------------
class StrictBaseModel(BaseModel):
    """Base schema with forbidden extra fields and validation defaults."""

    model_config = ConfigDict(extra="forbid")


# Hard physiologic/dataset validity ranges for continuous and ordinal features
HARD_FEATURE_RANGES: dict[str, tuple[float, float]] = {
    "Age": (0.0, 120.0),
    "Weight": (10.0, 400.0),
    "Length": (50.0, 260.0),
    "BMI": (10.0, 100.0),
    "BP": (30.0, 300.0),
    "PR": (30.0, 250.0),
    "FBS": (20.0, 1200.0),
    "CR": (0.1, 30.0),
    "TG": (10.0, 3000.0),
    "LDL": (5.0, 1000.0),
    "HDL": (5.0, 300.0),
    "BUN": (1.0, 300.0),
    "ESR": (0.0, 200.0),
    "HB": (3.0, 25.0),
    "K": (1.0, 10.0),
    "Na": (90.0, 200.0),
    "WBC": (500.0, 150000.0),
    "Lymph": (0.0, 100.0),
    "Neut": (0.0, 100.0),
    "PLT": (5.0, 2500.0),
    "EF-TTE": (5.0, 95.0),
    "Region RWMA": (0.0, 4.0),
    "Function Class": (0.0, 3.0),
}

BINARY_FEATURES: set[str] = {
    "DM",
    "HTN",
    "Current Smoker",
    "EX-Smoker",
    "FH",
    "Obesity",
    "CRF",
    "CVA",
    "Airway disease",
    "Thyroid Disease",
    "CHF",
    "DLP",
    "Edema",
    "Weak Peripheral Pulse",
    "Lung rales",
    "Systolic Murmur",
    "Diastolic Murmur",
    "Typical Chest Pain",
    "Dyspnea",
    "Atypical",
    "Nonanginal",
    "LowTH Ang",
    "Q Wave",
    "St Elevation",
    "St Depression",
    "Tinversion",
    "LVH",
    "Poor R Progression",
}


# ---------------------------------------------------------------------------
# Request Schemas
# ---------------------------------------------------------------------------
class PredictRequest(StrictBaseModel):
    """Prediction request schema."""

    mode: Literal["quick", "full"]
    inputs: dict[str, Any]
    case_id: int | None = None

    @field_validator("inputs")
    @classmethod
    def validate_inputs(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Validate input feature names, leak prevention, and types."""
        # 1. Reject data leakage columns
        for col in v.keys():
            if col in LEAK_COLS or "Cath" in col:
                raise ValueError(
                    f"Data leakage risk: column '{col}' is in LEAK_COLS or contains 'Cath'."
                )

        # 2. Reject Exertional CP as not a model input
        if "Exertional CP" in v:
            raise ValueError("Feature 'Exertional CP' is not a model input (dropped constant column).")

        # 3. Reject unknown feature names
        known_features = set(FULL_HUMAN_FEATURES)
        unknown = [k for k in v.keys() if k not in known_features]
        if unknown:
            raise ValueError(f"Unknown feature name(s): {unknown}")

        # 4. Validate feature values and types
        for feat, val in v.items():
            if val is None:
                continue

            # Binary features
            if feat in BINARY_FEATURES:
                if isinstance(val, bool):
                    continue
                if isinstance(val, (int, float)):
                    if math.isnan(val) or math.isinf(val):
                        raise ValueError(f"Non-finite value for binary feature '{feat}': {val}")
                    if val not in (0, 1, 0.0, 1.0):
                        raise ValueError(
                            f"Value {val} for binary feature '{feat}' is invalid. Expected 0 or 1 (or boolean)."
                        )
                else:
                    raise ValueError(
                        f"Unsupported type {type(val).__name__} for binary feature '{feat}'. Expected boolean or 0/1."
                    )

            # Continuous and ordinal numeric features
            elif feat in HARD_FEATURE_RANGES:
                if isinstance(val, bool):
                    raise ValueError(f"Feature '{feat}' must be numeric, got boolean.")
                if not isinstance(val, (int, float)):
                    raise ValueError(f"Feature '{feat}' must be a numeric value, got {type(val).__name__}.")
                if math.isnan(val) or math.isinf(val):
                    raise ValueError(f"Non-finite value for feature '{feat}': {val}")
                min_val, max_val = HARD_FEATURE_RANGES[feat]
                if val < min_val or val > max_val:
                    raise ValueError(
                        f"Value {val} for feature '{feat}' is outside valid range [{min_val}, {max_val}]."
                    )

            # Categorical string features
            elif feat == "Sex":
                if isinstance(val, str):
                    if val not in ["Male", "Female", "Fmale"]:
                        raise ValueError(f"Invalid Sex '{val}'. Expected 'Male' or 'Female'.")
                elif isinstance(val, bool):
                    continue
                elif isinstance(val, (int, float)) and val in (0, 1, 0.0, 1.0):
                    continue
                else:
                    raise ValueError(f"Invalid Sex value '{val}'. Expected 'Male', 'Female', or 0/1.")

            elif feat == "VHD":
                if not isinstance(val, str) or val.strip().lower() not in VHD_ORDINAL_MAPPING:
                    raise ValueError(
                        f"Invalid VHD '{val}'. Expected one of: {list(VHD_ORDINAL_MAPPING.keys())}"
                    )

            elif feat == "BBB":
                if not isinstance(val, str) or val.strip() not in ["N", "LBBB", "RBBB"]:
                    raise ValueError(
                        f"Invalid BBB '{val}'. Expected 'N', 'LBBB', or 'RBBB'."
                    )

            else:
                raise ValueError(f"Unsupported feature '{feat}' with value {val}.")

        return v

    @field_validator("case_id")
    @classmethod
    def validate_case_id(cls, v: int | None) -> int | None:
        """Validate case_id if provided."""
        if v is not None:
            if v < 0 or v >= 303:
                raise ValueError(f"case_id {v} out of valid dataset range [0, 302].")
        return v


# ---------------------------------------------------------------------------
# Health & Metadata Schemas
# ---------------------------------------------------------------------------
class HealthResponse(StrictBaseModel):
    """Health check response schema."""

    status: str
    model_version: str
    git_commit: str
    models_verified: bool
    disclaimer: str


class FeatureMetaItem(StrictBaseModel):
    """Single feature descriptor for /api/meta."""

    name: str
    label: str
    kind: Literal["binary", "continuous", "ordinal", "categorical"]
    group: str
    allowed_values: list[Any] | None = None
    training_min: float
    training_max: float
    training_median: float
    training: dict[str, float]
    in_quick: bool
    unit: None = None


class ModeDefinition(StrictBaseModel):
    """Mode specification descriptor."""

    name: str
    description: str
    n_features: int
    features: list[str]


class BandMetaItem(StrictBaseModel):
    """Display probability band boundary specification."""

    name: str
    min: float
    max: float


class MetaResponse(StrictBaseModel):
    """Complete metadata response schema."""

    modes: dict[str, ModeDefinition]
    features: list[FeatureMetaItem]
    bands: list[BandMetaItem]



# ---------------------------------------------------------------------------
# Samples Schemas
# ---------------------------------------------------------------------------
class SamplePatient(StrictBaseModel):
    """Demo sample patient record."""

    case_id: int
    label: Literal["p10", "median", "p90", "lcx_positive_near_median"]
    label_text: str
    inputs: dict[str, Any]
    ground_truth: dict[str, int]
    ground_truth_note: str = "dataset angiography labels, demo only"
    oof_estimate: dict[str, float]
    oof_estimate_note: str = (
        "out-of-fold: this patient was not in the training data of the model that produced it"
    )


class SamplesResponse(StrictBaseModel):
    """Demo samples collection response."""

    samples: list[SamplePatient]


# ---------------------------------------------------------------------------
# Model Export Schemas
# ---------------------------------------------------------------------------
class TargetModelExport(StrictBaseModel):
    """Exported pipeline parameters for a single target."""

    feature_list: list[str]
    scaler_mean: list[float]
    scaler_scale: list[float]
    coef: list[float]
    intercept: float
    platt_a: float
    platt_b: float
    defaults: dict[str, float]


class ModelExportResponse(StrictBaseModel):
    """Full browser-reproducible model export schema."""

    mode: str
    targets: dict[str, TargetModelExport]


# ---------------------------------------------------------------------------
# Prediction Response Schemas
# ---------------------------------------------------------------------------
class ContributionItem(StrictBaseModel):
    """Feature contribution entry in logit space."""

    feature: str
    value: Any
    contribution: float
    direction: Literal["up", "down"]
    stability_tag: str | None = None
    imputed: bool = False


class ModelInfo(StrictBaseModel):
    """Configuration and feature metadata for a fitted target model."""

    config_name: str
    n_features: int
    features_used: list[str]
    source_space: Literal["quick", "auto"]


class TargetPrediction(StrictBaseModel):
    """Predicted risk and explainability breakdown for a single target."""

    raw_probability: float
    calibrated_probability: float
    band: Literal["lower", "intermediate", "higher"]
    display_probability: float
    display_band: Literal["lower", "intermediate", "higher"]
    adjusted: bool
    display_note: str | None = None
    base: float
    contributions: list[ContributionItem]
    other_total: float
    logit_model: float
    model_info: ModelInfo
    base_rate: float
    base_rate_note: str = (
        "dataset average (angiography-referred patients); not a population prevalence"
    )


class ConsistencyInfo(StrictBaseModel):
    """Fréchet coherence analysis results for CAD vs vessel probabilities."""

    status: Literal["ok", "raised", "lowered"]
    lower: float
    upper: float
    p_cad_model: float
    p_cad_adjusted: float


class SimilarPatientItem(StrictBaseModel):
    """Clinically similar patient reference record."""

    case_id: int
    distance: float
    age_band: str
    sex: str
    outcomes: dict[str, int]


class LiftItem(StrictBaseModel):
    """Full feature set lift over quick screening."""

    paired_mean: float
    p2_5: float
    p97_5: float
    selection_identical_fraction: float
    note: str = "repeat interval, descriptive"


class TrustBlock(StrictBaseModel):
    """Trust and clinical evidence container."""

    similar_patients: list[SimilarPatientItem]
    evidence_estimate: dict[str, float] | None = None
    evidence_auc: dict[str, float]
    lift: dict[str, LiftItem]
    bands_note: str = BANDS_NOTE


class PredictWarning(StrictBaseModel):
    """Validation or reliability warning."""

    code: str
    message: str | None = None
    feature: str | None = None
    target: str | None = None
    value: Any = None
    min: float | None = None
    max: float | None = None


class PredictResponse(StrictBaseModel):
    """Top-level prediction response schema."""

    request_id: str
    mode: Literal["quick", "full"]
    model_version: str
    predictions: dict[str, TargetPrediction]
    consistency: ConsistencyInfo
    trust: TrustBlock
    imputed: list[str]
    warnings: list[PredictWarning]
    oof_estimate: dict[str, float] | None = None
    oof_estimate_note: str | None = None
    disclaimer: str = DISCLAIMER
    limitations: list[str] = Field(default_factory=lambda: list(LIMITATIONS))
