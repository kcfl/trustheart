"""Unit tests for Platt calibration fitting, scaling, and calibration diagnostic metrics."""

import numpy as np
import pytest

from ml.calibration import apply_platt, calibration_metrics, compute_ece, fit_platt


def test_platt_monotonicity_and_bounds() -> None:
    """Verify apply_platt is strictly monotonic increasing for positive slope and bounded in [0, 1]."""
    scores = np.linspace(0.001, 0.999, 500)
    a = 1.75
    b = -0.35

    calibrated = apply_platt(scores, a, b)

    # Monotonicity check
    assert np.all(np.diff(calibrated) > 0), "apply_platt must be strictly monotonic increasing when a > 0"

    # Bounds check
    assert np.all(calibrated >= 0.0) and np.all(calibrated <= 1.0), "apply_platt outputs must be bounded in [0, 1]"

    # Extreme value handling
    extremes = np.array([0.0, 1e-7, 0.5, 1.0 - 1e-7, 1.0])
    cal_extremes = apply_platt(extremes, a, b)
    assert np.all(cal_extremes >= 0.0) and np.all(cal_extremes <= 1.0)


def test_platt_simulated_calibration() -> None:
    """Verify that perfectly calibrated simulated probabilities recover slope ~ 1.0 and intercept ~ 0.0."""
    rng = np.random.RandomState(42)
    n = 5000

    # Generate probabilities uniformly between 0.05 and 0.95
    p_true = rng.uniform(0.05, 0.95, size=n)
    # Sample Bernoulli targets exactly from p_true
    y = rng.binomial(1, p_true)

    a, b = fit_platt(p_true, y)

    # Tolerance 0.3 per specification
    assert abs(a - 1.0) < 0.3, f"Expected Platt slope near 1.0, got {a:.4f}"
    assert abs(b - 0.0) < 0.3, f"Expected Platt intercept near 0.0, got {b:.4f}"

    metrics = calibration_metrics(y, p_true)
    assert abs(metrics["slope"] - 1.0) < 0.3
    assert abs(metrics["intercept"] - 0.0) < 0.3
    assert metrics["ece"] < 0.05, f"ECE for true probabilities should be small, got {metrics['ece']:.4f}"
