"""Model loading and inference module with cryptographic verification and leakage checks."""

import hashlib
import json
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from ml.calibration import apply_platt
from ml.config import TARGETS
from ml.data import assert_no_leak


def _compute_sha256(file_path: Path) -> str:
    """Compute hexadecimal SHA-256 digest of a file.

    Parameters
    ----------
    file_path : Path
        File to hash.

    Returns
    -------
    str
        SHA-256 hexadecimal string.
    """
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def load_model(space: str, target: str, models_dir: Path | str = "models") -> dict[str, Any]:
    """Load a final model artifact after verifying its cryptographic SHA-256 checksum.

    Parameters
    ----------
    space : str
        Search space ('auto' or 'quick').
    target : str
        Target artery / condition ('CAD', 'LAD', 'LCX', 'RCA').
    models_dir : Path | str, optional
        Directory holding models and manifest.json, by default "models".

    Returns
    -------
    dict[str, Any]
        Model artifact dictionary containing:
        - pipeline: fitted scikit-learn estimator
        - platt_a: Platt scaling slope
        - platt_b: Platt scaling intercept
        - feature_list: list of expected feature columns
        - config_name: name of chosen search space config
        - space: search space identifier
        - target: target name
        - git_commit: git commit hash

    Raises
    ------
    FileNotFoundError
        If model file or manifest.json cannot be found.
    ValueError
        If computed SHA-256 hash does not match manifest.json.
    """
    models_path = Path(models_dir)
    manifest_file = models_path / "manifest.json"
    if not manifest_file.exists():
        raise FileNotFoundError(f"Manifest file not found: {manifest_file}")

    model_filename = f"{space}_{target}.joblib"
    model_file = models_path / model_filename
    if not model_file.exists():
        raise FileNotFoundError(f"Model file not found: {model_file}")

    with open(manifest_file, encoding="utf-8") as f:
        manifest = json.load(f)

    # Normalize relative key for lookup
    expected_hash = manifest.get("files", {}).get(f"models/{model_filename}")
    if not expected_hash:
        expected_hash = manifest.get("files", {}).get(model_file.as_posix())
    if not expected_hash:
        raise ValueError(f"No SHA-256 entry found in manifest for {model_filename}")

    actual_hash = _compute_sha256(model_file)
    if actual_hash != expected_hash:
        raise ValueError(
            f"Integrity check failed for {model_file}!\n"
            f"Expected SHA-256: {expected_hash}\n"
            f"Computed SHA-256: {actual_hash}"
        )

    model_artifact = joblib.load(model_file)
    return model_artifact


def predict_one(
    space: str,
    target: str,
    X: pd.DataFrame,
    models_dir: Path | str = "models",
) -> np.ndarray:
    """Predict Platt-calibrated positive-class probabilities for a single target.

    Parameters
    ----------
    space : str
        Search space identifier ('auto' or 'quick').
    target : str
        Target name ('CAD', 'LAD', 'LCX', 'RCA').
    X : pd.DataFrame
        Feature matrix containing at least the columns required by the model.
    models_dir : Path | str, optional
        Directory holding models, by default "models".

    Returns
    -------
    np.ndarray
        Array of calibrated probabilities in [0, 1].

    Raises
    ------
    AssertionError
        If data leakage columns or substrings are present.
    ValueError
        If required feature columns are missing from X.
    """
    assert_no_leak(X.columns)

    model_artifact = load_model(space, target, models_dir=models_dir)
    required_features = model_artifact["feature_list"]

    missing_cols = [c for c in required_features if c not in X.columns]
    if missing_cols:
        raise ValueError(
            f"DataFrame X is missing required columns for {space}_{target}: {missing_cols}"
        )

    X_subset = X[required_features]
    estimator = model_artifact["pipeline"]
    raw_probs = estimator.predict_proba(X_subset)[:, 1]

    platt_a = model_artifact["platt_a"]
    platt_b = model_artifact["platt_b"]
    calibrated_probs = apply_platt(raw_probs, platt_a, platt_b)

    return calibrated_probs


def predict_all(
    space: str,
    X: pd.DataFrame,
    models_dir: Path | str = "models",
) -> dict[str, np.ndarray]:
    """Predict calibrated probabilities for all four targets ('CAD', 'LAD', 'LCX', 'RCA').

    Parameters
    ----------
    space : str
        Search space identifier ('auto' or 'quick').
    X : pd.DataFrame
        Feature matrix containing full feature columns.
    models_dir : Path | str, optional
        Directory holding models, by default "models".

    Returns
    -------
    dict[str, np.ndarray]
        Dictionary mapping target names to arrays of calibrated probabilities.

    Raises
    ------
    AssertionError
        If data leakage columns are present.
    ValueError
        If required feature columns are missing.
    """
    assert_no_leak(X.columns)

    predictions: dict[str, np.ndarray] = {}
    for target in TARGETS:
        predictions[target] = predict_one(space, target, X, models_dir=models_dir)

    return predictions
