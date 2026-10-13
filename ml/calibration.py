"""Probability calibration routines using Platt scaling and calibration diagnostic metrics."""

import numpy as np
import pandas as pd
from scipy.special import expit, logit
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss


def fit_platt(scores: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """Fit a univariate Platt calibration model: logit(p_cal) = a * logit(score) + b.

    Parameters
    ----------
    scores : np.ndarray
        Uncalibrated predicted probabilities in [0, 1].
    y : np.ndarray
        Ground-truth binary labels in {0, 1}.

    Returns
    -------
    tuple[float, float]
        Platt scaling slope (a) and intercept (b).
    """
    scores_arr = np.asarray(scores, dtype=float)
    y_arr = np.asarray(y, dtype=int)

    # Numerically clip probabilities to prevent logit explosion
    clipped_scores = np.clip(scores_arr, 1e-4, 1.0 - 1e-4)
    logits = logit(clipped_scores).reshape(-1, 1)

    # Unregularized logistic regression using large C to avoid penalty=None deprecation
    lr = LogisticRegression(C=1e9, solver="lbfgs", max_iter=2000)
    lr.fit(logits, y_arr)

    a = float(lr.coef_[0, 0])
    b = float(lr.intercept_[0])
    return a, b


def apply_platt(scores: np.ndarray, a: float, b: float) -> np.ndarray:
    """Apply Platt calibration parameters to uncalibrated probabilities.

    Parameters
    ----------
    scores : np.ndarray
        Uncalibrated probabilities.
    a : float
        Platt slope.
    b : float
        Platt intercept.

    Returns
    -------
    np.ndarray
        Calibrated probabilities in [0, 1].
    """
    scores_arr = np.asarray(scores, dtype=float)
    clipped_scores = np.clip(scores_arr, 1e-4, 1.0 - 1e-4)
    logits = logit(clipped_scores)
    calibrated = expit(a * logits + b)
    return np.asarray(calibrated, dtype=float)


def compute_ece(y: np.ndarray, p: np.ndarray, n_bins: int = 5) -> float:
    """Compute Expected Calibration Error (ECE) using equal-frequency bins.

    Parameters
    ----------
    y : np.ndarray
        Binary target ground truth.
    p : np.ndarray
        Predicted probabilities.
    n_bins : int, optional
        Target number of equal-frequency quantile bins, by default 5.

    Returns
    -------
    float
        ECE score.
    """
    p_arr = np.asarray(p, dtype=float)
    y_arr = np.asarray(y, dtype=int)
    n = len(p_arr)
    if n == 0:
        return 0.0

    bins = pd.qcut(p_arr, q=n_bins, duplicates="drop")
    ece = 0.0

    for b in bins.unique():
        mask = np.asarray(bins == b)
        bin_count = int(np.sum(mask))
        if bin_count > 0:
            bin_acc = float(np.mean(y_arr[mask]))
            bin_conf = float(np.mean(p_arr[mask]))
            ece += (bin_count / n) * abs(bin_acc - bin_conf)

    return float(ece)


def calibration_metrics(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    """Compute calibration metrics: Brier score, ECE (5 quantile bins), and calibration slope & intercept.

    Calibration intercept and slope are obtained via logistic regression of y on logit(p).
    A perfectly calibrated model yields slope = 1.0 and intercept = 0.0.

    Parameters
    ----------
    y : np.ndarray
        Binary target ground truth.
    p : np.ndarray
        Predicted probabilities.

    Returns
    -------
    dict[str, float]
        Dictionary with keys 'brier', 'ece', 'intercept', 'slope'.
    """
    y_arr = np.asarray(y, dtype=int)
    p_arr = np.asarray(p, dtype=float)

    brier = float(brier_score_loss(y_arr, p_arr))
    ece = compute_ece(y_arr, p_arr, n_bins=5)

    # Diagnostic logistic regression of y on logit(p)
    clipped_p = np.clip(p_arr, 1e-4, 1.0 - 1e-4)
    logits_p = logit(clipped_p).reshape(-1, 1)

    lr_diag = LogisticRegression(C=1e9, solver="lbfgs", max_iter=2000)
    lr_diag.fit(logits_p, y_arr)

    slope = float(lr_diag.coef_[0, 0])
    intercept = float(lr_diag.intercept_[0])

    return {
        "brier": brier,
        "ece": ece,
        "intercept": intercept,
        "slope": slope,
    }
