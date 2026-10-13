"""Cross-validation split generation and partitioning utilities."""

import numpy as np
import pandas as pd
from sklearn.model_selection import RepeatedStratifiedKFold

from ml.config import CV_SEED, N_REPEATS, N_SPLITS


def compute_joint_vessel_pattern(Y: pd.DataFrame) -> pd.Series:
    """Compute the 3-bit joint vessel stenosis pattern: LAD*4 + LCX*2 + RCA.

    Parameters
    ----------
    Y : pd.DataFrame
        Targets dataframe containing integer or binary columns 'LAD', 'LCX', 'RCA'.

    Returns
    -------
    pd.Series
        Integer codes in range [0, 7].
    """
    for col in ["LAD", "LCX", "RCA"]:
        if col not in Y.columns:
            raise ValueError(f"Target dataframe missing required artery column '{col}'.")
    return Y["LAD"] * 4 + Y["LCX"] * 2 + Y["RCA"]


def make_splits(
    Y: pd.DataFrame,
    n_splits: int = N_SPLITS,
    n_repeats: int = N_REPEATS,
    random_state: int = CV_SEED,
) -> list[tuple[int, np.ndarray, np.ndarray]]:
    """Generate repeated stratified K-fold cross-validation splits.

    Stratification is performed on the 3-bit joint vessel stenosis pattern
    code (LAD*4 + LCX*2 + RCA) so that ALL four targets (CAD, LAD, LCX, RCA)
    share the exact same fold partitions and balanced class representations.

    Parameters
    ----------
    Y : pd.DataFrame
        Targets dataframe containing LAD, LCX, RCA (and CAD).
    n_splits : int, optional
        Number of folds per repeat, by default ml.config.N_SPLITS (5).
    n_repeats : int, optional
        Number of repeats, by default ml.config.N_REPEATS (10).
    random_state : int, optional
        Random seed for the split generator, by default ml.config.CV_SEED (42).

    Returns
    -------
    list[tuple[int, np.ndarray, np.ndarray]]
        List of (repeat_idx, train_idx, test_idx) tuples for all 50 folds.
    """
    joint_code = compute_joint_vessel_pattern(Y)
    rskf = RepeatedStratifiedKFold(
        n_splits=n_splits, n_repeats=n_repeats, random_state=random_state
    )

    splits: list[tuple[int, np.ndarray, np.ndarray]] = []
    dummy_X = np.zeros(len(Y))

    for k, (train_idx, test_idx) in enumerate(rskf.split(dummy_X, joint_code)):
        repeat_idx = k // n_splits
        splits.append((repeat_idx, np.asarray(train_idx), np.asarray(test_idx)))

    return splits
