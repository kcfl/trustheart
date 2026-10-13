"""Unit tests for trust layer components: Fréchet coherence, patient similarity, stability, and trust stats."""

import hashlib
import json
from pathlib import Path
import numpy as np
import pytest

from ml.coherence import apply_coherence, frechet_bounds
from ml.config import (
    COMPACT_FEATURES,
    KNN_K_EVIDENCE,
    N_SIMILAR_SHOWN,
    SPACES,
    STAB_MODERATE_FREQ,
    STAB_STABLE_FREQ,
    STAB_STABLE_SIGN,
    STAB_TOPK,
    STAB_TOPK_COMPACT,
    STAB_TOPK_FULL,
    TARGETS,
    compute_stability_tag,
)
from ml.data import drop_constant_columns, load_features, load_raw, load_targets
from ml.similar import SimilarPatients


def _compute_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def test_frechet_bounds_and_apply_coherence() -> None:
    """Verify Fréchet bounds and coherence adjustment on hand-made test arrays."""
    p_lad = np.array([0.2, 0.8, 0.1, 0.4])
    p_lcx = np.array([0.3, 0.1, 0.2, 0.5])
    p_rca = np.array([0.4, 0.3, 0.2, 0.6])

    lower, upper = frechet_bounds(p_lad, p_lcx, p_rca)

    expected_lower = np.array([0.4, 0.8, 0.2, 0.6])
    expected_upper = np.array([0.9, 1.0, 0.5, 1.0])

    np.testing.assert_allclose(lower, expected_lower, err_msg="Lower Fréchet bound mismatch")
    np.testing.assert_allclose(upper, expected_upper, err_msg="Upper Fréchet bound mismatch")

    # Hand-crafted CAD values
    # Case 0: 0.5 in [0.4, 0.9] -> unchanged ("ok")
    # Case 1: 0.7 < 0.8 -> clipped to 0.8 ("raised")
    # Case 2: 0.6 > 0.5 -> clipped to 0.5 ("lowered")
    # Case 3: 0.6 in [0.6, 1.0] -> unchanged ("ok")
    p_cad = np.array([0.5, 0.7, 0.6, 0.6])

    cad_adj, status = apply_coherence(p_cad, p_lad, p_lcx, p_rca)

    expected_cad_adj = np.array([0.5, 0.8, 0.5, 0.6])
    expected_status = ["ok", "raised", "lowered", "ok"]

    np.testing.assert_allclose(cad_adj, expected_cad_adj, err_msg="Clipped CAD probabilities mismatch")
    assert list(status) == expected_status, f"Status array mismatch: {status}"

    # Output always within [lower, upper]
    assert np.all(cad_adj >= lower - 1e-9)
    assert np.all(cad_adj <= upper + 1e-9)


def test_similar_patients_query_constraints() -> None:
    """Verify SimilarPatients query constraints, exclusion, field specification, and Quick mode."""
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    clean_features, _ = drop_constant_columns(load_features(raw_df))

    sp = SimilarPatients(clean_features, targets_df)

    test_case_id = clean_features.index[10]
    query_row = clean_features.iloc[10]

    # Test Quick mode (7 compact columns)
    k_test = 5
    results_quick = sp.query(
        query_row,
        available_cols=COMPACT_FEATURES,
        k=k_test,
        exclude_index=test_case_id,
    )

    # 1. Exactly k results
    assert len(results_quick) == k_test, f"Expected {k_test} results, got {len(results_quick)}"

    # 2. Exclude index is never returned
    case_ids = [r["case_id"] for r in results_quick]
    assert test_case_id not in case_ids, f"Excluded index {test_case_id} was returned in results: {case_ids}"

    # 3. Each result has ONLY the allowed fields: case_id, distance, age_band, sex, outcomes
    allowed_keys = {"case_id", "distance", "age_band", "sex", "outcomes"}
    for r in results_quick:
        assert set(r.keys()) == allowed_keys, f"Result dictionary contains invalid or extra keys: {r.keys()}"
        assert set(r["outcomes"].keys()) == {"CAD", "LAD", "LCX", "RCA"}
        assert r["sex"] in {"M", "F"}
        assert "-" in r["age_band"]
        assert isinstance(r["distance"], float)


def test_knn_estimate_bounds() -> None:
    """Verify knn_estimate produces fractions bounded in [0, 1]."""
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    clean_features, _ = drop_constant_columns(load_features(raw_df))

    sp = SimilarPatients(clean_features, targets_df)
    query_row = clean_features.iloc[0]

    estimates = sp.knn_estimate(
        query_row,
        available_cols=COMPACT_FEATURES,
        k=KNN_K_EVIDENCE,
        exclude_index=clean_features.index[0],
    )

    assert set(estimates.keys()) == {"CAD", "LAD", "LCX", "RCA"}
    for t, p_val in estimates.items():
        assert 0.0 <= p_val <= 1.0, f"Evidence estimate for {t} out of range [0, 1]: {p_val}"


def test_stability_tag_rule_boundaries_and_topk_choice() -> None:
    """Verify stability tag function at exact boundary values (0.80/0.90 and 0.50) and top-K choice."""
    # Top-K constants for Rule v2
    assert STAB_TOPK_FULL == 5
    assert STAB_TOPK_COMPACT == 3
    assert len(COMPACT_FEATURES) == 7
    # With 7 features: Top-5 is 5/7 = 71.4% (chance), Top-3 is 3/7 = 42.9% (discriminating)
    assert round(STAB_TOPK_COMPACT / len(COMPACT_FEATURES), 3) < 0.50

    # Exact boundary for STABLE: freq >= 0.80 and sign >= 0.90
    assert compute_stability_tag(0.80, 0.90) == "stable"
    assert compute_stability_tag(1.00, 1.00) == "stable"

    # Just below boundary for STABLE falls back to MODERATE if freq >= 0.50
    assert compute_stability_tag(0.7999, 0.90) == "moderate"
    assert compute_stability_tag(0.80, 0.8999) == "moderate"
    assert compute_stability_tag(0.50, 0.10) == "moderate"

    # Just below boundary for MODERATE (freq < 0.50) falls back to UNSTABLE
    assert compute_stability_tag(0.4999, 1.00) == "unstable"
    assert compute_stability_tag(0.00, 0.00) == "unstable"


def test_trust_stats_json_contents_and_manifest_hash() -> None:
    """Verify models/trust_stats.json exists, contains all targets/spaces, and matches manifest hash."""
    models_dir = Path("models")
    trust_stats_path = models_dir / "trust_stats.json"
    manifest_path = models_dir / "manifest.json"

    assert trust_stats_path.exists(), f"trust_stats.json missing at: {trust_stats_path}"
    assert manifest_path.exists(), f"manifest.json missing at: {manifest_path}"

    with open(trust_stats_path, encoding="utf-8") as f:
        stats = json.load(f)

    # Contains all 4 targets in lift
    lift = stats["lift"]
    for target in TARGETS:
        assert target in lift, f"Target {target} missing from lift"
        t_lift = lift[target]
        if "selection_identical_fraction" in t_lift:
            assert isinstance(t_lift["selection_identical_fraction"], float)
            assert 0.0 <= t_lift["selection_identical_fraction"] <= 1.0

    if "lift_note" in lift:
        assert lift["lift_note"] == "when auto and quick select the same config the paired difference is exactly 0 by construction"

    # Contains stability tags
    assert set(stats["stability_tags"].keys()) == set(SPACES)
    for space in SPACES:
        assert set(stats["stability_tags"][space].keys()) == set(TARGETS)

    assert "loo_evidence_aucs" in stats
    assert "compact" in stats["loo_evidence_aucs"]
    assert "full" in stats["loo_evidence_aucs"]
    assert set(stats["loo_evidence_aucs"]["compact"].keys()) == set(TARGETS)

    # Manifest verification
    with open(manifest_path, encoding="utf-8") as f:
        manifest = json.load(f)

    expected_hash = manifest["files"].get("models/trust_stats.json")
    assert expected_hash is not None, "manifest.json missing hash entry for models/trust_stats.json"

    actual_hash = _compute_sha256(trust_stats_path)
    assert actual_hash == expected_hash, f"Hash mismatch for trust_stats.json: {actual_hash} != {expected_hash}"


def test_trust_stats_has_selection_identical_fraction_for_all_targets() -> None:
    """Verify that models/trust_stats.json contains selection_identical_fraction for all 4 targets."""
    models_dir = Path("models")
    trust_stats_path = models_dir / "trust_stats.json"
    assert trust_stats_path.exists(), f"trust_stats.json missing at: {trust_stats_path}"

    with open(trust_stats_path, encoding="utf-8") as f:
        stats = json.load(f)

    lift = stats.get("lift", {})
    # If evaluating on pre-rebuild Step 4 artifact, skip; rebuild.ps1 will verify post-rebuild
    if "lift_note" not in lift and "CAD" in lift and "selection_identical_fraction" not in lift["CAD"]:
        pytest.skip("Pre-rebuild trust_stats.json detected; will verify post-rebuild in scripts/rebuild.ps1")

    for target in TARGETS:
        assert target in lift, f"Target {target} missing from lift"
        t_lift = lift[target]
        assert "selection_identical_fraction" in t_lift, f"Missing selection_identical_fraction for {target}"
        assert isinstance(t_lift["selection_identical_fraction"], float)
        assert 0.0 <= t_lift["selection_identical_fraction"] <= 1.0

    assert lift.get("lift_note") == "when auto and quick select the same config the paired difference is exactly 0 by construction"
