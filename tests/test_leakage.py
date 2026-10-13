"""Tests for data leakage prevention, target extraction, and feature encoding."""

import numpy as np
import pandas as pd
import pytest

from ml.config import COMPACT_FEATURES, LEAK_COLS, TARGETS
from ml.data import assert_no_leak, load_features, load_raw, load_targets


@pytest.fixture
def raw_data() -> pd.DataFrame:
    """Fixture providing raw dataset."""
    return load_raw()


@pytest.fixture
def targets(raw_data: pd.DataFrame) -> pd.DataFrame:
    """Fixture providing extracted targets."""
    return load_targets(raw_data)


@pytest.fixture
def features(raw_data: pd.DataFrame) -> pd.DataFrame:
    """Fixture providing encoded features."""
    return load_features(raw_data)


def test_load_features_has_no_leak_cols_and_no_cath(features: pd.DataFrame) -> None:
    """Test that load_features output has no column in LEAK_COLS and none containing 'Cath'."""
    feature_cols = list(features.columns)

    for leak_col in LEAK_COLS:
        assert leak_col not in feature_cols, f"Leak column '{leak_col}' found in features."

    for col in feature_cols:
        assert "cath" not in col.lower(), f"Column '{col}' in features contains 'Cath'."


def test_no_feature_column_identical_to_any_target(
    features: pd.DataFrame, targets: pd.DataFrame
) -> None:
    """Test that no feature column is identical (all rows equal) to any target column."""
    for feat_col in features.columns:
        feat_series = features[feat_col]
        for target_col in targets.columns:
            target_series = targets[target_col]
            identical = (feat_series == target_series).all()
            assert not identical, (
                f"Feature '{feat_col}' is identical to target '{target_col}' across all rows!"
            )


def test_assert_no_leak_raises_on_lad() -> None:
    """Test that assert_no_leak raises AssertionError when given a list containing 'LAD'."""
    with pytest.raises(AssertionError, match="LAD"):
        assert_no_leak(["Age", "Sex", "LAD"])

    # Also verify that it raises on other LEAK_COLS and Cath variants
    with pytest.raises(AssertionError, match="Cath"):
        assert_no_leak(["Age", "Cath"])

    with pytest.raises(AssertionError):
        assert_no_leak(["Age", "Pre_Cath_Test"])


def test_targets_binary_and_shape(targets: pd.DataFrame) -> None:
    """Test that targets are binary 0/1 with 303 rows and 4 columns."""
    assert targets.shape == (303, 4), f"Expected shape (303, 4), got {targets.shape}"
    assert list(targets.columns) == TARGETS, f"Expected columns {TARGETS}, got {list(targets.columns)}"

    for col in targets.columns:
        unique_vals = set(targets[col].unique())
        assert unique_vals.issubset({0, 1}), f"Column '{col}' has non-binary values: {unique_vals}"
        assert pd.api.types.is_integer_dtype(targets[col]), f"Column '{col}' is not integer dtype"


def test_compact_features_present(features: pd.DataFrame) -> None:
    """Test that COMPACT_FEATURES are all present in the encoded features."""
    for compact_feat in COMPACT_FEATURES:
        assert compact_feat in features.columns, f"Compact feature '{compact_feat}' missing from features"


def test_features_no_nan_and_all_numeric(features: pd.DataFrame) -> None:
    """Test that feature table has no NaN values and all columns are numeric."""
    assert features.shape[0] == 303, f"Expected 303 rows, got {features.shape[0]}"
    nan_count = int(features.isna().sum().sum())
    assert nan_count == 0, f"Found {nan_count} NaN values in feature dataframe"

    for col in features.columns:
        assert pd.api.types.is_numeric_dtype(features[col]), f"Feature column '{col}' is not numeric"
