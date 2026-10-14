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

        # 2. Reject unknown feature names
        known_features = set(FULL_HUMAN_FEATURES)
        unknown = [k for k in v.keys() if k not in known_features]
        if unknown:
            raise ValueError(f"Unknown feature name(s): {unknown}")

        # 3. Validate values and non-finite floats
        for feat, val in v.items():
            if val is None:
                continue
            if isinstance(val, (int, float)):
                if math.isnan(val) or math.isinf(val):
                    raise ValueError(f"Non-finite value for feature '{feat}': {val}")
            elif isinstance(val, str):
                # Check categorical / ordinal inputs
                if feat == "Sex" and val not in ["Male", "Female", "Fmale"]:
                    raise ValueError(
                        f"Invalid Sex '{val}'. Expected 'Male' or 'Female'."
                    )
                elif feat == "VHD" and val.strip().lower() not in VHD_ORDINAL_MAPPING:
                    raise ValueError(
                        f"Invalid VHD '{val}'. Expected one of: {list(VHD_ORDINAL_MAPPING.keys())}"
                    )
                elif feat == "BBB" and val not in ["N", "LBBB", "RBBB"]:
                    raise ValueError(
                        f"Invalid BBB '{val}'. Expected 'N', 'LBBB', or 'RBBB'."
                    )
            elif not isinstance(val, bool):
                raise ValueError(
                    f"Unsupported type {type(val)} for feature '{feat}'."
                )

        # 4. Hard range check on Age (0 to 120)
        if "Age" in v and v["Age"] is not None:
            age_val = v["Age"]
            if not isinstance(age_val, (int, float)) or isinstance(age_val, bool):
                raise ValueError("Age must be a numeric value.")
            if age_val < 0 or age_val > 120:
                raise ValueError(f"Age {age_val} is outside hard limit [0, 120].")

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


class MetaResponse(StrictBaseModel):
    """Complete metadata response schema."""

    modes: dict[str, ModeDefinition]
    features: list[FeatureMetaItem]


# ---------------------------------------------------------------------------
# Samples Schemas
# ---------------------------------------------------------------------------
class SamplePatient(StrictBaseModel):
    """Demo sample patient record."""

    case_id: int
    label: Literal["lower", "intermediate", "higher", "LCX-positive example"]
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


class TargetPrediction(StrictBaseModel):
    """Predicted risk and explainability breakdown for a single target."""

    raw_probability: float
    calibrated_probability: float
    band: Literal["lower", "intermediate", "higher"]
    base: float
    contributions: list[ContributionItem]
    other_total: float
    logit_model: float


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
