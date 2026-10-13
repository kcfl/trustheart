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
