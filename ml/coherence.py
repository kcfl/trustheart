"""Fréchet probability coherence bounds and adjustment for multi-target coronary artery disease prediction."""

from typing import Tuple, Union
import numpy as np


def frechet_bounds(
    p_lad: Union[float, np.ndarray],
    p_lcx: Union[float, np.ndarray],
    p_rca: Union[float, np.ndarray],
) -> Tuple[np.ndarray, np.ndarray]:
    """Compute Fréchet lower and upper probability bounds for coronary artery disease (CAD).

    CAD is defined in the dataset as 'at least one stenotic vessel', so
    max(vessel probs) <= P(CAD) <= min(1, sum(vessel probs)) must hold for any
    coherent probabilities (Frechet bounds, valid without any independence assumption).
    Note that 1 of 303 rows in the data (index 93) violates the definition.

    Parameters
    ----------
    p_lad : float or np.ndarray
        Predicted probability of Left Anterior Descending (LAD) stenosis.
    p_lcx : float or np.ndarray
        Predicted probability of Left Circumflex (LCX) stenosis.
    p_rca : float or np.ndarray
        Predicted probability of Right Coronary Artery (RCA) stenosis.

    Returns
    -------
    Tuple[np.ndarray, np.ndarray]
        lower : np.ndarray
            Lower Fréchet bound: max(p_lad, p_lcx, p_rca).
        upper : np.ndarray
            Upper Fréchet bound: min(1.0, p_lad + p_lcx + p_rca).
    """
    lad = np.asarray(p_lad, dtype=float)
    lcx = np.asarray(p_lcx, dtype=float)
    rca = np.asarray(p_rca, dtype=float)

    lower = np.maximum(lad, np.maximum(lcx, rca))
    upper = np.minimum(1.0, lad + lcx + rca)

    return lower, upper


def apply_coherence(
    p_cad: Union[float, np.ndarray],
    p_lad: Union[float, np.ndarray],
    p_lcx: Union[float, np.ndarray],
    p_rca: Union[float, np.ndarray],
    tol: float = 1e-9,
) -> Tuple[np.ndarray, np.ndarray]:
    """Clip CAD prediction into Fréchet bounds and determine coherence status.

    CAD is defined in the dataset as 'at least one stenotic vessel', so
    max(vessel probs) <= P(CAD) <= min(1, sum(vessel probs)) must hold for any
    coherent probabilities (Frechet bounds, valid without any independence assumption).
    Note that 1 of 303 rows in the data (index 93) violates the definition.

    Parameters
    ----------
    p_cad : float or np.ndarray
        Predicted probability of CAD.
    p_lad : float or np.ndarray
        Predicted probability of LAD stenosis.
    p_lcx : float or np.ndarray
        Predicted probability of LCX stenosis.
    p_rca : float or np.ndarray
        Predicted probability of RCA stenosis.
    tol : float, optional
        Tolerance for floating-point equality, by default 1e-9.

    Returns
    -------
    Tuple[np.ndarray, np.ndarray]
        p_cad_adjusted : np.ndarray
            Adjusted CAD probability clipped to [lower, upper].
        status_array : np.ndarray
            String array with 'ok' if unchanged within tolerance, 'raised' if p_cad < lower,
            and 'lowered' if p_cad > upper.
    """
    cad = np.asarray(p_cad, dtype=float)
    lower, upper = frechet_bounds(p_lad, p_lcx, p_rca)

    p_cad_adjusted = np.clip(cad, lower, upper)

    # Determine status vectorized
    status = np.full(cad.shape, "ok", dtype=object)
    status[cad < lower - tol] = "raised"
    status[cad > upper + tol] = "lowered"

    return p_cad_adjusted, status
