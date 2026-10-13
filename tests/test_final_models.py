"""Unit and integration tests for final fitted models, manifest integrity, and predictions."""

import hashlib
import json
from pathlib import Path
import shutil

import numpy as np
import pytest

from ml.config import SPACES, TARGETS
from ml.data import drop_constant_columns, load_features, load_raw
from ml.predict import load_model, predict_all, predict_one


def _compute_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def test_all_eight_models_exist_and_hashes_match() -> None:
    """Verify all 8 model joblib files exist and match hashes recorded in manifest.json."""
    models_dir = Path("models")
    manifest_path = models_dir / "manifest.json"
    assert manifest_path.exists(), f"Manifest file missing: {manifest_path}"

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    # Check 8 model files
    expected_models = [f"{space}_{target}.joblib" for space in SPACES for target in TARGETS]
    assert len(expected_models) == 8

    for mod_name in expected_models:
        mod_path = models_dir / mod_name
        assert mod_path.exists(), f"Model file missing: {mod_path}"

        # Hash check
        rel_key = f"models/{mod_name}"
        expected_hash = manifest.get("files", {}).get(rel_key) or manifest.get("files", {}).get(mod_path.as_posix())
        assert expected_hash is not None, f"No hash recorded for {mod_name} in manifest"

        actual_hash = _compute_sha256(mod_path)
        assert actual_hash == expected_hash, f"Hash mismatch for {mod_name}: {actual_hash} != {expected_hash}"

    # Also verify feature_stats.json in manifest
    stats_path = models_dir / "feature_stats.json"
    assert stats_path.exists()
    stats_key = "models/feature_stats.json"
    expected_stats_hash = manifest.get("files", {}).get(stats_key) or manifest.get("files", {}).get(stats_path.as_posix())
    assert expected_stats_hash is not None
    assert _compute_sha256(stats_path) == expected_stats_hash


def test_predict_all_returns_bounded_probabilities_and_deterministic() -> None:
    """Verify predict_all returns calibrated probabilities in [0, 1] and is strictly deterministic."""
    raw_df = load_raw()
    clean_features, _ = drop_constant_columns(load_features(raw_df))
    X_sample = clean_features.iloc[:5].copy()

    for space in SPACES:
        preds1 = predict_all(space, X_sample)
        preds2 = predict_all(space, X_sample)

        assert set(preds1.keys()) == set(TARGETS)

        for target in TARGETS:
            p1 = preds1[target]
            p2 = preds2[target]

            assert len(p1) == 5
            assert np.all(p1 >= 0.0) and np.all(p1 <= 1.0), f"Probabilities for {target} out of [0, 1]"
            np.testing.assert_array_equal(p1, p2, err_msg=f"Predictions not deterministic for {space}_{target}")


def test_load_model_tamper_detection(tmp_path: Path) -> None:
    """Verify that tampering with bytes of a model file causes load_model to raise ValueError."""
    models_dir = Path("models")
    manifest_path = models_dir / "manifest.json"

    # Copy manifest and one model to tmp_path
    shutil.copy(manifest_path, tmp_path / "manifest.json")
    orig_model = models_dir / "auto_CAD.joblib"
    tampered_model = tmp_path / "auto_CAD.joblib"
    shutil.copy(orig_model, tampered_model)

    # Tamper with the file contents
    with open(tampered_model, "ab") as f:
        f.write(b"CORRUPTED_BYTES")

    # Attempting to load from tampered directory must raise ValueError
    with pytest.raises(ValueError, match="Integrity check failed"):
        load_model("auto", "CAD", models_dir=tmp_path)


def test_manifest_verifies_every_listed_file() -> None:
    """Verify that models/manifest.json verifies for every single listed file."""
    manifest_path = Path("models/manifest.json")
    assert manifest_path.exists(), f"Manifest missing at: {manifest_path}"

    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    files_dict = manifest.get("files", {})
    assert len(files_dict) >= 10, f"Expected at least 10 files in manifest, got {len(files_dict)}"

    for rel_path_str, expected_hash in files_dict.items():
        file_path = Path(rel_path_str)
        assert file_path.exists(), f"Manifest lists file that does not exist on disk: {file_path}"
        actual_hash = _compute_sha256(file_path)
        assert actual_hash == expected_hash, (
            f"SHA-256 verification failed for {rel_path_str}: expected {expected_hash}, got {actual_hash}"
        )

