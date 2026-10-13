"""Tests for cross-validation splitting, fold integrity, and evaluation harness determinism."""

import numpy as np
import pandas as pd
import pytest

from ml.config import COMPACT_FEATURES, CV_SEED, FEATURE_SETS, LEAK_COLS, N_REPEATS, N_SPLITS, SEED, TARGETS
from ml.cv import make_splits
from ml.data import drop_constant_columns, load_features, load_raw, load_targets
from ml.evaluate import evaluate_combination


@pytest.fixture
def raw_data() -> pd.DataFrame:
    """Fixture providing raw dataset."""
    return load_raw()


@pytest.fixture
def targets(raw_data: pd.DataFrame) -> pd.DataFrame:
    """Fixture providing target matrix."""
    return load_targets(raw_data)


@pytest.fixture
def clean_features(raw_data: pd.DataFrame) -> pd.DataFrame:
    """Fixture providing clean encoded features without constant columns."""
    encoded = load_features(raw_data)
    clean, _ = drop_constant_columns(encoded)
    return clean


@pytest.fixture
def splits(targets: pd.DataFrame) -> list[tuple[int, np.ndarray, np.ndarray]]:
    """Fixture providing repeated CV splits."""
    return make_splits(targets, n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=CV_SEED)


def test_all_four_targets_use_identical_folds(targets: pd.DataFrame, splits: list) -> None:
    """Assert all four targets share the exact same fold partitions."""
    splits_recomputed = make_splits(targets, n_splits=N_SPLITS, n_repeats=N_REPEATS, random_state=CV_SEED)

    assert len(splits) == N_SPLITS * N_REPEATS == 50
    assert len(splits_recomputed) == 50

    for i in range(len(splits)):
        rep1, train1, test1 = splits[i]
        rep2, train2, test2 = splits_recomputed[i]

        assert rep1 == rep2
        np.testing.assert_array_equal(train1, train2)
        np.testing.assert_array_equal(test1, test2)


def test_train_test_no_overlap_and_full_partition(splits: list) -> None:
    """Assert train and test indices never overlap, and every sample appears in exactly one test fold per repeat."""
    n_samples = 303
    expected_sample_set = set(range(n_samples))

    # Check each fold for non-overlap
    for repeat_idx, train_idx, test_idx in splits:
        train_set = set(train_idx)
        test_set = set(test_idx)
        assert train_set.isdisjoint(test_set), "Train and test indices overlap in fold!"
        assert len(train_set) + len(test_set) == n_samples

    # Check that each repeat partitions all samples exactly once
    for r in range(N_REPEATS):
        repeat_test_samples: list[int] = []
        repeat_folds = [s for s in splits if s[0] == r]
        assert len(repeat_folds) == N_SPLITS == 5

        for _, _, test_idx in repeat_folds:
            repeat_test_samples.extend(test_idx.tolist())

        assert len(repeat_test_samples) == n_samples, f"Repeat {r} total test samples != {n_samples}"
        assert set(repeat_test_samples) == expected_sample_set, f"Repeat {r} test folds do not partition all samples"


def test_every_test_fold_contains_both_classes_for_every_target(
    targets: pd.DataFrame, splits: list
) -> None:
    """Assert every test fold contains both positive (1) and negative (0) classes for every target."""
    for fold_k, (repeat_idx, train_idx, test_idx) in enumerate(splits):
        fold_targets = targets.iloc[test_idx]
        for tgt in TARGETS:
            unique_classes = set(fold_targets[tgt].unique())
            assert unique_classes == {0, 1}, (
                f"Fold {fold_k} (repeat {repeat_idx}) for target '{tgt}' has classes {unique_classes}, expected {{0, 1}}"
            )


def test_compact_features_is_subset_of_full() -> None:
    """Assert COMPACT_FEATURES is a strict subset of the full feature set."""
    compact_set = set(COMPACT_FEATURES)
    full_set = set(FEATURE_SETS["full"])

    assert compact_set.issubset(full_set), "COMPACT_FEATURES is not a subset of full feature set!"
    assert len(compact_set) < len(full_set), "Compact set should be strictly smaller than full set"


def test_determinism_lr_compact_lad(
    clean_features: pd.DataFrame, targets: pd.DataFrame, splits: list
) -> None:
    """Assert running LR compact for target LAD twice with the same seed gives identical out-of-fold probabilities."""
    X = clean_features[COMPACT_FEATURES].values
    y = targets["LAD"].values

    oof_probs_1, fold_aucs_1, summary_1 = evaluate_combination(
        X, y, model_name="LR", splits=splits, seed=SEED, threshold=0.5
    )
    oof_probs_2, fold_aucs_2, summary_2 = evaluate_combination(
        X, y, model_name="LR", splits=splits, seed=SEED, threshold=0.5
    )

    np.testing.assert_allclose(oof_probs_1, oof_probs_2, rtol=1e-12, atol=1e-12)
    np.testing.assert_allclose(fold_aucs_1, fold_aucs_2, rtol=1e-12, atol=1e-12)
    assert summary_1["metrics_summary"]["roc_auc"]["mean"] == summary_2["metrics_summary"]["roc_auc"]["mean"]


def test_no_leak_cols_in_any_feature_set() -> None:
    """Assert no column from LEAK_COLS appears in any feature set."""
    for f_name, f_cols in FEATURE_SETS.items():
        for leak_col in LEAK_COLS:
            assert leak_col not in f_cols, f"Leak column '{leak_col}' found in feature set '{f_name}'"
        for col in f_cols:
            assert "cath" not in col.lower(), f"Column '{col}' in '{f_name}' contains 'Cath'"
