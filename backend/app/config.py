"""Configuration settings, constants, and clinical metadata for TrustHeart 3D Backend."""

import os
from pathlib import Path
from typing import Any

# Models and artifacts directory override
MODELS_DIR: Path = Path(os.getenv("TRUSTHEART_MODELS_DIR", "models"))
REPORTS_DIR: Path = Path(os.getenv("TRUSTHEART_REPORTS_DIR", "reports"))

# Security and networking configuration
CORS_ORIGINS_RAW: str = (
    os.getenv("CORS_ORIGINS")
    or os.getenv("TRUSTHEART_ORIGINS")
    or "http://localhost:5173,http://127.0.0.1:5173"
)
ALLOWED_ORIGINS: list[str] = [
    origin.strip() for origin in CORS_ORIGINS_RAW.split(",") if origin.strip()
]

# Request body limit: 20 KB
MAX_REQUEST_BODY_BYTES: int = 20 * 1024

# Rate limiter: default 60 requests/minute per IP
RATE_LIMIT_PER_MINUTE: int = int(os.getenv("TRUSTHEART_RATE_LIMIT", "60"))

# Proxy configuration for rate limiting
TRUST_PROXY_RAW: str = os.getenv("TRUSTHEART_TRUST_PROXY", "false").lower()
TRUST_PROXY: bool = TRUST_PROXY_RAW in ("true", "1", "yes")

# Display-only Probability Bands
BAND_LOWER_THRESHOLD: float = 0.30
BAND_HIGHER_THRESHOLD: float = 0.60
BANDS_NOTE: str = "Bands are display categories, not clinical thresholds."

PROBABILITY_BANDS: list[dict[str, Any]] = [
    {"name": "lower", "min": 0.0, "max": BAND_LOWER_THRESHOLD},
    {"name": "intermediate", "min": BAND_LOWER_THRESHOLD, "max": BAND_HIGHER_THRESHOLD},
    {"name": "higher", "min": BAND_HIGHER_THRESHOLD, "max": 1.0},
]


def get_probability_band(p: float) -> str:
    """Classify probability into display-only category."""
    if p < BAND_LOWER_THRESHOLD:
        return "lower"
    elif p < BAND_HIGHER_THRESHOLD:
        return "intermediate"
    else:
        return "higher"


# Disclaimers and Limitations
DISCLAIMER: str = (
    "Decision support / educational use only. Predictions are per-vessel "
    "probabilities from a small single-centre dataset and are not a lesion location. "
    "Not a substitute for formal diagnostic imaging or clinical judgement."
)

LIMITATIONS: list[str] = [
    "Single-centre dataset of 303 angiography-referred patients.",
    "Probabilities are mildly overconfident out of sample.",
    "What-if changes show model sensitivity, not treatment effect.",
]

# Feature Groups Mapping
FEATURE_GROUPS: dict[str, list[str]] = {
    "Demographics": ["Age", "Weight", "Length", "Sex", "BMI"],
    "History & risk factors": [
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
    ],
    "Vitals & exam": [
        "BP",
        "PR",
        "Edema",
        "Weak Peripheral Pulse",
        "Lung rales",
        "Systolic Murmur",
        "Diastolic Murmur",
    ],
    "Symptoms": [
        "Typical Chest Pain",
        "Dyspnea",
        "Function Class",
        "Atypical",
        "Nonanginal",
        "LowTH Ang",
    ],
    "ECG": [
        "Q Wave",
        "St Elevation",
        "St Depression",
        "Tinversion",
        "LVH",
        "Poor R Progression",
        "BBB",
    ],
    "Labs": [
        "FBS",
        "CR",
        "TG",
        "LDL",
        "HDL",
        "BUN",
        "ESR",
        "HB",
        "K",
        "Na",
        "WBC",
        "Lymph",
        "Neut",
        "PLT",
    ],
    "Echo": ["EF-TTE", "Region RWMA", "VHD"],
}

# 7 compact features used in "quick" mode
QUICK_FEATURES: list[str] = [
    "Age",
    "Sex",
    "Typical Chest Pain",
    "Atypical",
    "Nonanginal",
    "DM",
    "HTN",
]

# 54 human-readable full features
FULL_HUMAN_FEATURES: list[str] = [
    "Age", "Weight", "Length", "Sex", "BMI",
    "DM", "HTN", "Current Smoker", "EX-Smoker", "FH", "Obesity", "CRF", "CVA",
    "Airway disease", "Thyroid Disease", "CHF", "DLP",
    "BP", "PR", "Edema", "Weak Peripheral Pulse", "Lung rales", "Systolic Murmur", "Diastolic Murmur",
    "Typical Chest Pain", "Dyspnea", "Function Class", "Atypical", "Nonanginal", "LowTH Ang",
    "Q Wave", "St Elevation", "St Depression", "Tinversion", "LVH", "Poor R Progression", "BBB",
    "FBS", "CR", "TG", "LDL", "HDL", "BUN", "ESR", "HB", "K", "Na", "WBC", "Lymph", "Neut", "PLT",
    "EF-TTE", "Region RWMA", "VHD",
]
