"""Configuration and constants for TrustHeart 3D ML pipeline."""

from pathlib import Path

# Paths
PROJECT_ROOT: Path = Path(__file__).resolve().parent.parent
DATA_DIR: Path = PROJECT_ROOT / "data"
RAW_DATA_DIR: Path = DATA_DIR / "raw"
RAW_XLSX: Path = RAW_DATA_DIR / "extention of Z-Alizadeh sani dataset.xlsx"
REPORTS_DIR: Path = PROJECT_ROOT / "reports"

# Random Seed
SEED: int = 42

# Target definitions
# Raw column "Cath" holds the overall CAD label ("CAD"/"Normal").
# Raw columns LAD/LCX/RCA hold vessel stenosis status ("Stenotic"/"Normal").
TARGETS: list[str] = ["CAD", "LAD", "LCX", "RCA"]

# Columns that represent clinical ground truth / angiography results
# and must NEVER be used as model inputs to prevent target leakage.
LEAK_COLS: list[str] = ["LAD", "LCX", "RCA", "Cath"]

# Compact subset of high-signal non-invasive clinical features
COMPACT_FEATURES: list[str] = [
    "Age",
    "Sex",
    "Typical Chest Pain",
    "Atypical",
    "Nonanginal",
    "DM",
    "HTN",
]

# Explicit encoding mappings
SEX_MAPPING: dict[str, int] = {
    "Male": 1,
    "Fmale": 0,
}

YN_MAPPING: dict[str, int] = {
    "Y": 1,
    "N": 0,
}

VHD_ORDINAL_MAPPING: dict[str, int] = {
    "n": 0,
    "mild": 1,
    "moderate": 2,
    "severe": 3,
}

TARGET_CATH_MAPPING: dict[str, int] = {
    "CAD": 1,
    "Normal": 0,
}

TARGET_ARTERY_MAPPING: dict[str, int] = {
    "Stenotic": 1,
    "Normal": 0,
}

# Cross-Validation Evaluation Parameters
N_SPLITS: int = 5
N_REPEATS: int = 10
CV_SEED: int = 42
THRESHOLD: float = 0.5

# Nested Cross-Validation and Tuning Parameters (Step 3 & 5)
N_REPEATS_NESTED: int = 10
INNER_SPLITS: int = 3
INNER_REPEATS: int = 2
CALIB_SPLITS: int = 5
SPACES: list[str] = ["auto", "quick"]
LR_C_GRID: list[float] = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1.0]

# Trust Layer & Stability Parameters (Step 4 & 5)
BOOTSTRAPS: int = 30
STAB_TOPK: int = 5
STAB_TOPK_FULL: int = 5
STAB_TOPK_COMPACT: int = 3
STAB_STABLE_FREQ: float = 0.80
STAB_STABLE_SIGN: float = 0.90
STAB_MODERATE_FREQ: float = 0.50
KNN_K_EVIDENCE: int = 15
N_SIMILAR_SHOWN: int = 5


def compute_stability_tag(top_k_freq: float, sign_consistency: float) -> str:
    """Classify feature importance stability tag.

    Tag rule:
    - 'stable' if top_k_freq >= STAB_STABLE_FREQ and sign_consistency >= STAB_STABLE_SIGN
    - 'moderate' if top_k_freq >= STAB_MODERATE_FREQ (and not stable)
    - otherwise 'unstable'
    """
    if top_k_freq >= STAB_STABLE_FREQ and sign_consistency >= STAB_STABLE_SIGN:
        return "stable"
    if top_k_freq >= STAB_MODERATE_FREQ:
        return "moderate"
    return "unstable"


_FEATURE_SETS_CACHE: dict[str, list[str]] | None = None


def get_feature_sets() -> dict[str, list[str]]:
    """Programmatically construct and cache compact and full feature sets.

    Full feature set contains all encoded model inputs with zero-variance
    constant columns removed.
    """
    global _FEATURE_SETS_CACHE
    if _FEATURE_SETS_CACHE is None:
        from ml.data import drop_constant_columns, load_features, load_raw

        if RAW_XLSX.exists():
            raw_df = load_raw(RAW_XLSX)
            feats = load_features(raw_df)
            clean_feats, dropped = drop_constant_columns(feats)
            full_cols = list(clean_feats.columns)
            print(f"Programmatically built 'full' feature set: size={len(full_cols)} (expected 55)")
            _FEATURE_SETS_CACHE = {
                "compact": list(COMPACT_FEATURES),
                "full": full_cols,
            }
        else:
            _FEATURE_SETS_CACHE = {
                "compact": list(COMPACT_FEATURES),
                "full": [],
            }
    return _FEATURE_SETS_CACHE


def __getattr__(name: str) -> object:
    """Lazy module attribute access for FEATURE_SETS to avoid circular imports."""
    if name == "FEATURE_SETS":
        return get_feature_sets()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
