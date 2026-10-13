"""Leakage test verifying that outer test samples never enter tuning, selection, or calibration."""

from typing import Any
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, ClassifierMixin

from ml.config import COMPACT_FEATURES
from ml.data import drop_constant_columns, load_features, load_raw, load_targets
from ml.nested import _evaluate_outer_task
from ml.search_space import Config


class SpyEstimator(BaseEstimator, ClassifierMixin):
    """Wrapper estimator that spies on and records all sample indices passed to fit()."""

    def __init__(self, base_estimator: Any, recorded_indices_list: list[Any]) -> None:
        self.base_estimator = base_estimator
        self.recorded_indices_list = recorded_indices_list
        self.classes_ = np.array([0, 1])

    def fit(self, X: Any, y: Any) -> "SpyEstimator":
        if isinstance(X, pd.DataFrame):
            self.recorded_indices_list.extend(X.index.tolist())
        self.base_estimator.fit(X, y)
        self.classes_ = getattr(self.base_estimator, "classes_", np.array([0, 1]))
        return self

    def predict_proba(self, X: Any) -> np.ndarray:
        return self.base_estimator.predict_proba(X)

    def predict(self, X: Any) -> np.ndarray:
        return self.base_estimator.predict(X)


def test_nested_no_outer_test_leakage(monkeypatch: Any) -> None:
    """Run nested evaluation on 2 outer folds for 1 target, asserting zero outer-test leakage."""
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    clean_features, _ = drop_constant_columns(load_features(raw_df))

    # Give rows explicit unique integer indices to verify index tracking
    clean_features = clean_features.copy()
    clean_features.index = pd.RangeIndex(1000, 1000 + len(clean_features))

    target = "CAD"
    y_target = targets_df[target].values

    # 2 outer folds (e.g. 80% train, 20% test)
    n = len(clean_features)
    fold0_test = np.arange(0, 60)
    fold0_train = np.arange(60, n)

    fold1_test = np.arange(60, 120)
    fold1_train = np.concatenate([np.arange(0, 60), np.arange(120, n)])

    outer_folds = [
        (0, fold0_train, fold0_test),
        (1, fold1_train, fold1_test),
    ]

    # Minimal subset of configs for fast execution in tests
    test_configs = [
        Config("compact|LR|C=0.1", "compact", "LR", {"C": 0.1}),
        Config("compact|RF|leaf=5|feat=sqrt", "compact", "RF", {"min_samples_leaf": 5, "max_features": "sqrt"}),
    ]

    import ml.nested as nested_mod
    orig_build_est = nested_mod.build_estimator

    monkeypatch.setattr(nested_mod, "get_space_configs", lambda sp: test_configs)

    current_recorded: list[int] = []

    def spied_build_estimator(cfg: Config) -> Any:
        real_est = orig_build_est(cfg)
        return SpyEstimator(real_est, current_recorded)

    monkeypatch.setattr(nested_mod, "build_estimator", spied_build_estimator)

    for fold_idx, train_idx, test_idx in outer_folds:
        current_recorded.clear()

        outer_test_row_ids = set(clean_features.index[test_idx])
        outer_train_row_ids = set(clean_features.index[train_idx])

        # Execute outer fold task
        res = _evaluate_outer_task(
            fold_idx=fold_idx,
            repeat_idx=0,
            train_idx=train_idx,
            test_idx=test_idx,
            target_name=target,
            X_full_df=clean_features,
            y_full=y_target,
            all_configs=test_configs,
        )

        assert res is not None
        assert len(current_recorded) > 0, "Spy must have recorded fit indices"

        fitted_indices_set = set(current_recorded)

        # Leakage assertion 1: No outer test index was ever passed to any fit() call
        leakage = outer_test_row_ids.intersection(fitted_indices_set)
        assert len(leakage) == 0, f"Outer test indices leaked into fit(): {leakage}"

        # Leakage assertion 2: Every single index passed to fit() was strictly in outer train
        assert fitted_indices_set.issubset(outer_train_row_ids), "Non-outer-train indices detected in fit()"
