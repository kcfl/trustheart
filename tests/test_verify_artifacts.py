"""Tests for the artifact verification tooling (scripts/verify_artifacts.py).

Verifies:
  1. The verifier passes on the real repository artifacts.
  2. Four negative tests on temp copies:
     - Shift an LCX contribution by 0.2 -> must FAIL.
     - Set a raw_probability to 0.3 -> must FAIL.
     - Set a base_rate to 0.5 -> must FAIL.
     - Flip a stability_tag -> must FAIL.
"""

import json
import shutil
from pathlib import Path
import pytest

from scripts.verify_artifacts import verify_all


@pytest.fixture
def temp_examples_dir(tmp_path: Path) -> Path:
    """Fixture providing a temporary copy of stored api_examples."""
    real_examples_dir = Path("docs/api_examples")
    target_dir = tmp_path / "api_examples"
    shutil.copytree(real_examples_dir, target_dir)
    return target_dir


def test_verify_artifacts_real_files() -> None:
    """Verifier succeeds with 0 failures on genuine repo artifacts."""
    success, total_checks, total_pass, section_counts = verify_all()
    assert success is True
    assert total_checks == total_pass
    assert all(c["fail"] == 0 for c in section_counts.values())


def test_negative_lcx_contribution_shifted(temp_examples_dir: Path) -> None:
    """Negative test: shifting an LCX contribution by 0.2 must produce FAIL."""
    sample_file = temp_examples_dir / "quick_p10.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Shift first LCX contribution by +0.2 (violating linear decomposition identity)
    data["predictions"]["LCX"]["contributions"][0]["contribution"] += 0.2
    with open(sample_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    success, total, passed, counts = verify_all(
        examples_dir=temp_examples_dir, skip_live=True, skip_repo_search=True
    )
    assert success is False, "Checker failed to catch LCX contribution shift!"
    assert counts["stored_examples"]["fail"] >= 1


def test_negative_raw_probability_set_to_03(temp_examples_dir: Path) -> None:
    """Negative test: setting raw_probability to 0.3 must produce FAIL."""
    sample_file = temp_examples_dir / "quick_p10.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Set CAD raw_probability to 0.3 (violating Platt calibration identity)
    data["predictions"]["CAD"]["raw_probability"] = 0.3
    with open(sample_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    success, total, passed, counts = verify_all(
        examples_dir=temp_examples_dir, skip_live=True, skip_repo_search=True
    )
    assert success is False, "Checker failed to catch corrupted raw_probability!"
    assert counts["stored_examples"]["fail"] >= 1


def test_negative_base_rate_set_to_05(temp_examples_dir: Path) -> None:
    """Negative test: setting base_rate to 0.5 must produce FAIL."""
    sample_file = temp_examples_dir / "quick_p10.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Set CAD base_rate to 0.5 (violating expected base rate 216/303)
    data["predictions"]["CAD"]["base_rate"] = 0.5
    with open(sample_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    success, total, passed, counts = verify_all(
        examples_dir=temp_examples_dir, skip_live=True, skip_repo_search=True
    )
    assert success is False, "Checker failed to catch corrupted base_rate!"
    assert counts["stored_examples"]["fail"] >= 1


def test_negative_stability_tag_flipped(temp_examples_dir: Path) -> None:
    """Negative test: flipping a stability_tag must produce FAIL."""
    sample_file = temp_examples_dir / "quick_p10.json"
    with open(sample_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Flip CAD first feature stability tag from stable to unstable (or vice versa)
    first_contrib = data["predictions"]["CAD"]["contributions"][0]
    orig_tag = first_contrib["stability_tag"]
    flipped_tag = "unstable" if orig_tag == "stable" else "stable"
    first_contrib["stability_tag"] = flipped_tag

    with open(sample_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    success, total, passed, counts = verify_all(
        examples_dir=temp_examples_dir, skip_live=True, skip_repo_search=True
    )
    assert success is False, "Checker failed to catch flipped stability_tag!"
    assert counts["stored_examples"]["fail"] >= 1
