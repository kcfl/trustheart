"""Data ingestion, target extraction, leakage prevention, and explicit feature encoding."""

from pathlib import Path
from typing import Sequence
import pandas as pd

from ml.config import (
    LEAK_COLS,
    RAW_XLSX,
    SEX_MAPPING,
    TARGET_ARTERY_MAPPING,
    TARGET_CATH_MAPPING,
    TARGETS,
    VHD_ORDINAL_MAPPING,
    YN_MAPPING,
)


def assert_no_leak(columns: Sequence[str] | pd.Index) -> None:
    """Raise AssertionError if any column in LEAK_COLS or containing 'Cath' is present.

    Parameters
    ----------
    columns : Sequence[str] | pd.Index
        Collection of column names to check.

    Raises
    ------
    AssertionError
        If any forbidden column or substring is detected.
    """
    for col in columns:
        if col in LEAK_COLS or "Cath" in col:
            raise AssertionError(
                f"Data leakage risk: column '{col}' is in LEAK_COLS or contains 'Cath'."
            )


def load_raw(xlsx_path: Path | None = None) -> pd.DataFrame:
    """Read the first sheet of the raw dataset xlsx file.

    The second sheet in the workbook is empty and intentionally ignored.

    Parameters
    ----------
    xlsx_path : Path | None, optional
        Path to the Excel workbook. Defaults to ml.config.RAW_XLSX.

    Returns
    -------
    pd.DataFrame
        Raw dataframe containing 303 rows and 59 columns.
    """
    path = xlsx_path or RAW_XLSX
    if not path.exists():
        raise FileNotFoundError(f"Raw dataset file not found at: {path}")
    return pd.read_excel(path, sheet_name=0)


def load_targets(df: pd.DataFrame) -> pd.DataFrame:
    """Extract and binarize target columns from the raw dataset.

    Maps:
    - 'Cath' -> 'CAD': 'CAD' -> 1, 'Normal' -> 0.
    - 'LAD' -> 'LAD': 'Stenotic' -> 1, 'Normal' -> 0.
    - 'LCX' -> 'LCX': 'Stenotic' -> 1, 'Normal' -> 0.
    - 'RCA' -> 'RCA': 'Stenotic' -> 1, 'Normal' -> 0.

    Parameters
    ----------
    df : pd.DataFrame
        Raw dataframe containing target columns.

    Returns
    -------
    pd.DataFrame
        Dataframe with integer columns ['CAD', 'LAD', 'LCX', 'RCA'] (1/0).

    Raises
    ------
    ValueError
        If required columns are missing or contain unexpected values.
    """
    targets_df = pd.DataFrame(index=df.index)

    if "Cath" not in df.columns:
        raise ValueError("Missing 'Cath' column in raw dataset for CAD target extraction.")
    cath_uniques = set(df["Cath"].dropna().unique())
    unknown_cath = cath_uniques - set(TARGET_CATH_MAPPING.keys())
    if unknown_cath:
        raise ValueError(
            f"Unexpected value(s) in 'Cath': {unknown_cath}. Expected: {list(TARGET_CATH_MAPPING.keys())}"
        )
    targets_df["CAD"] = df["Cath"].map(TARGET_CATH_MAPPING).astype(int)

    for artery in ["LAD", "LCX", "RCA"]:
        if artery not in df.columns:
            raise ValueError(f"Missing artery column '{artery}' in raw dataset.")
        artery_uniques = set(df[artery].dropna().unique())
        unknown_artery = artery_uniques - set(TARGET_ARTERY_MAPPING.keys())
        if unknown_artery:
            raise ValueError(
                f"Unexpected value(s) in '{artery}': {unknown_artery}. Expected: {list(TARGET_ARTERY_MAPPING.keys())}"
            )
        targets_df[artery] = df[artery].map(TARGET_ARTERY_MAPPING).astype(int)

    return targets_df[TARGETS]


def load_features(df: pd.DataFrame) -> pd.DataFrame:
    """Encode model inputs after dropping leakage columns.

    Processing and encoding rules:
    1. Leakage prevention: Drops all LEAK_COLS ('LAD', 'LCX', 'RCA', 'Cath')
       BEFORE any other transformation.
    2. Sex: 'Male' -> 1, 'Fmale' -> 0 (preserving the original dataset spelling).
       Raises ValueError on any unexpected value.
    3. Y/N Columns: Any column with non-numeric values whose unique non-null values
       are a subset of {'Y', 'N'} is mapped as 'Y' -> 1, 'N' -> 0.
    4. VHD (Valvular Heart Disease): Ordinal encoding with case-insensitive matching:
       'N' -> 0, 'mild' -> 1, 'Moderate' -> 2, 'Severe' -> 3.
       Prints unique values found and raises ValueError on unknown values.
    5. BBB (Bundle Branch Block): One-hot encoded into 'BBB_LBBB' and 'BBB_RBBB'
       with baseline 'N' (0 for both).
       Prints unique values found and raises ValueError on unknown values.
    6. Non-numeric validation: All remaining columns must be numeric.
       Raises ValueError detailing column name and unique values if an unhandled
       string column remains.
    7. Leak assertion: Calls assert_no_leak on final column names.
    8. Preserves original feature names (spaces included) for non-expanded columns.

    Parameters
    ----------
    df : pd.DataFrame
        Raw dataframe.

    Returns
    -------
    pd.DataFrame
        Clean, numeric feature dataframe ready for model training.

    Raises
    ------
    ValueError
        If unexpected string values or unhandled columns are encountered.
    AssertionError
        If any leakage column remains in the final feature table.
    """
    # Step 1: Drop LEAK_COLS BEFORE any other processing
    drop_cols = [c for c in LEAK_COLS if c in df.columns]
    feat_df = df.drop(columns=drop_cols).copy()

    # Step 2: Explicit Sex encoding
    if "Sex" in feat_df.columns:
        sex_unique = set(feat_df["Sex"].dropna().unique())
        unknown_sex = sex_unique - set(SEX_MAPPING.keys())
        if unknown_sex:
            raise ValueError(
                f"Unexpected Sex value(s): {unknown_sex}. Expected only {list(SEX_MAPPING.keys())}"
            )
        feat_df["Sex"] = feat_df["Sex"].map(SEX_MAPPING).astype(int)

    # Step 3: Columns whose values are only "Y"/"N"
    for col in list(feat_df.columns):
        if not pd.api.types.is_numeric_dtype(feat_df[col]):
            unique_vals = set(feat_df[col].dropna().unique())
            if unique_vals.issubset(set(YN_MAPPING.keys())):
                feat_df[col] = feat_df[col].map(YN_MAPPING).astype(int)

    # Step 4: VHD ordinal encoding
    if "VHD" in feat_df.columns:
        raw_vhd_uniques = feat_df["VHD"].unique().tolist()
        print(f"VHD unique values found: {raw_vhd_uniques}")

        def _map_vhd(val: object) -> int:
            if pd.isna(val):
                raise ValueError("VHD column contains NaN/missing values.")
            key = str(val).strip().lower()
            if key not in VHD_ORDINAL_MAPPING:
                raise ValueError(
                    f"Unknown VHD value '{val}' (normalized: '{key}'). "
                    f"Expected one of: {list(VHD_ORDINAL_MAPPING.keys())}"
                )
            return VHD_ORDINAL_MAPPING[key]

        feat_df["VHD"] = feat_df["VHD"].apply(_map_vhd).astype(int)

    # Step 5: BBB one-hot encoding
    if "BBB" in feat_df.columns:
        raw_bbb_uniques = feat_df["BBB"].unique().tolist()
        print(f"BBB unique values found: {raw_bbb_uniques}")
        valid_bbb = {"N", "LBBB", "RBBB"}
        unknown_bbb = set(raw_bbb_uniques) - valid_bbb
        if unknown_bbb:
            raise ValueError(
                f"Unknown BBB value(s): {unknown_bbb}. Expected subset of: {valid_bbb}"
            )

        bbb_idx = feat_df.columns.get_loc("BBB")
        bbb_col = feat_df["BBB"]
        feat_df = feat_df.drop(columns=["BBB"])
        feat_df.insert(bbb_idx, "BBB_LBBB", (bbb_col == "LBBB").astype(int))
        feat_df.insert(bbb_idx + 1, "BBB_RBBB", (bbb_col == "RBBB").astype(int))

    # Step 6: Verify all columns are now numeric
    for col in feat_df.columns:
        if not pd.api.types.is_numeric_dtype(feat_df[col]):
            unique_unhandled = feat_df[col].unique().tolist()
            raise ValueError(
                f"Unexpected string/non-numeric column '{col}' remaining. "
                f"Unique values: {unique_unhandled}"
            )

    # Step 7: Leakage assertion on final column list
    assert_no_leak(feat_df.columns)

    return feat_df
