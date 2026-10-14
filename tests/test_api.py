"""Comprehensive test suite for the TrustHeart 3D FastAPI backend."""

import copy
import json
import logging
import math
import shutil
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from fastapi.testclient import TestClient

from backend.app.config import FULL_HUMAN_FEATURES, QUICK_FEATURES
from backend.app.main import app
from backend.app.security import reset_rate_limiter
from backend.app.service import ModelService, get_model_service


@pytest.fixture
def client() -> TestClient:
    """Fixture providing an active FastAPI TestClient."""
    return TestClient(app)


@pytest.fixture
def sample_patient_inputs(client: TestClient) -> dict[str, Any]:
    """Retrieve full inputs of the first sample patient for test cases."""
    res = client.get("/api/samples")
    assert res.status_code == 200
    samples = res.json()["samples"]
    assert len(samples) >= 1
    return dict(samples[0]["inputs"])


# ---------------------------------------------------------------------------
# Test 1: Health Check Endpoint
# ---------------------------------------------------------------------------
def test_1_health_ok(client: TestClient) -> None:
    """Test 1: GET /api/health returns 200 OK, verified models, and disclaimer."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["models_verified"] is True
    assert "ml-v1" in data["model_version"]
    assert "git_commit" in data and len(data["git_commit"]) > 0
    assert "disclaimer" in data and "Decision support" in data["disclaimer"]


# ---------------------------------------------------------------------------
# Test 2: Metadata Endpoint
# ---------------------------------------------------------------------------
def test_2_meta_modes_and_features(client: TestClient) -> None:
    """Test 2: GET /api/meta has 55 full features, 7 quick, all with groups, BBB as one feature."""
    res = client.get("/api/meta")
    assert res.status_code == 200
    data = res.json()

    # Verify mode definitions
    modes = data["modes"]
    assert "quick" in modes and "full" in modes
    assert modes["quick"]["n_features"] == 7
    assert len(modes["quick"]["features"]) == 7
    assert modes["full"]["n_features"] == 55
    assert len(modes["full"]["features"]) == 55

    # Verify feature list
    features = data["features"]
    assert len(features) == 55, f"Expected 55 features in meta list, got {len(features)}"

    # Check BBB is present as exactly ONE feature
    bbb_features = [f for f in features if f["name"] == "BBB"]
    assert len(bbb_features) == 1
    assert bbb_features[0]["kind"] == "categorical"
    assert set(bbb_features[0]["allowed_values"]) == {"N", "LBBB", "RBBB"}
    assert "BBB_LBBB" not in [f["name"] for f in features]
    assert "BBB_RBBB" not in [f["name"] for f in features]

    # Check every feature has a non-empty group
    quick_count = 0
    for f in features:
        assert f["group"] is not None and len(f["group"]) > 0
        assert f["kind"] in ["binary", "continuous", "ordinal", "categorical"]
        assert "min" in f["training"] and "max" in f["training"] and "median" in f["training"]
        assert f["training_min"] is not None
        assert f["training_max"] is not None
        assert f["training_median"] is not None
        assert f["unit"] is None
        if f["in_quick"]:
            quick_count += 1

    assert quick_count == 7


# ---------------------------------------------------------------------------
# Test 3: Demo Samples Endpoint
# ---------------------------------------------------------------------------
def test_3_samples_structure_and_counts(client: TestClient) -> None:
    """Test 3: GET /api/samples returns exactly 4 demo patients with 55 inputs and oof estimates."""
    res = client.get("/api/samples")
    assert res.status_code == 200
    data = res.json()
    samples = data["samples"]
    assert len(samples) == 4

    expected_labels = {"lower", "intermediate", "higher", "LCX-positive example"}
    observed_labels = {s["label"] for s in samples}
    assert observed_labels == expected_labels

    for s in samples:
        assert isinstance(s["case_id"], int)
        assert 0 <= s["case_id"] < 303
        assert len(s["inputs"]) == 55
        assert "BBB" in s["inputs"]
        assert "Sex" in s["inputs"]
        assert "VHD" in s["inputs"]
        assert set(s["ground_truth"].keys()) == {"CAD", "LAD", "LCX", "RCA"}
        assert set(s["oof_estimate"].keys()) == {"CAD", "LAD", "LCX", "RCA"}
        for t in ["CAD", "LAD", "LCX", "RCA"]:
            assert 0.0 <= s["oof_estimate"][t] <= 1.0


# ---------------------------------------------------------------------------
# Test 4: Prediction Calibration, Coherence, and Exact Linear Identity
# ---------------------------------------------------------------------------
def test_4_predict_calibration_coherence_and_linear_identity(
    client: TestClient, sample_patient_inputs: dict[str, Any]
) -> None:
    """Test 4: Probabilities in [0, 1], coherence bounds hold, and exact linear logit decomposition."""
    for mode in ["quick", "full"]:
        req_body = {
            "mode": mode,
            "inputs": sample_patient_inputs,
            "case_id": 125,
        }
        res = client.post("/api/predict", json=req_body)
        assert res.status_code == 200, res.text
        data = res.json()

        preds = data["predictions"]
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            p_obj = preds[target]
            p_cal = p_obj["calibrated_probability"]
            assert 0.0 <= p_cal <= 1.0
            assert p_obj["band"] in ["lower", "intermediate", "higher"]

            # Mathematical exact linear decomposition identity check
            base = p_obj["base"]
            top_10_contribs_sum = sum(c["contribution"] for c in p_obj["contributions"])
            other_total = p_obj["other_total"]
            reconstructed_logit = base + top_10_contribs_sum + other_total
            expected_logit = p_obj["logit_model"]

            assert math.isclose(reconstructed_logit, expected_logit, abs_tol=1e-6), (
                f"Mode {mode}, Target {target}: Reconstructed {reconstructed_logit} "
                f"differs from expected logit {expected_logit}"
            )

        # Fréchet coherence bounds check for CAD
        consistency = data["consistency"]
        lower = consistency["lower"]
        upper = consistency["upper"]
        p_cad_adj = consistency["p_cad_adjusted"]

        assert lower <= p_cad_adj <= upper + 1e-9
        assert data["predictions"]["CAD"]["calibrated_probability"] == p_cad_adj
        assert consistency["status"] in ["ok", "raised", "lowered"]


# ---------------------------------------------------------------------------
# Test 5: Model Export Parity with Plain NumPy
# ---------------------------------------------------------------------------
def test_5_model_export_parity_with_numpy(
    client: TestClient, sample_patient_inputs: dict[str, Any]
) -> None:
    """Test 5: Reproduce probabilities from /api/model-export parameters with NumPy within 1e-9."""
    for mode in ["quick", "full"]:
        export_res = client.get(f"/api/model-export?mode={mode}")
        assert export_res.status_code == 200
        export_data = export_res.json()["targets"]

        predict_res = client.post("/api/predict", json={"mode": mode, "inputs": sample_patient_inputs})
        assert predict_res.status_code == 200
        predict_data = predict_res.json()["predictions"]

        # Map sample inputs to numeric dictionary
        numeric_dict: dict[str, float] = {}
        for k, v in sample_patient_inputs.items():
            if k == "Sex":
                numeric_dict[k] = 1.0 if str(v).lower() == "male" else 0.0
            elif k == "VHD":
                from ml.config import VHD_ORDINAL_MAPPING
                numeric_dict[k] = float(VHD_ORDINAL_MAPPING.get(str(v).lower(), 0))
            elif k == "BBB":
                numeric_dict["BBB_LBBB"] = 1.0 if v == "LBBB" else 0.0
                numeric_dict["BBB_RBBB"] = 1.0 if v == "RBBB" else 0.0
            elif isinstance(v, bool):
                numeric_dict[k] = 1.0 if v else 0.0
            else:
                numeric_dict[k] = float(v)

        for target in ["CAD", "LAD", "LCX", "RCA"]:
            t_exp = export_data[target]
            features = t_exp["feature_list"]
            scaler_mean = np.array(t_exp["scaler_mean"], dtype=float)
            scaler_scale = np.array(t_exp["scaler_scale"], dtype=float)
            coef = np.array(t_exp["coef"], dtype=float)
            intercept = float(t_exp["intercept"])
            platt_a = float(t_exp["platt_a"])
            platt_b = float(t_exp["platt_b"])

            x_vec = np.array([numeric_dict[f] for f in features], dtype=float)
            z_vec = (x_vec - scaler_mean) / scaler_scale
            score = float(np.dot(coef, z_vec) + intercept)
            logit_cal = platt_a * score + platt_b
            p_numpy = 1.0 / (1.0 + np.exp(-logit_cal))

            # Compare against the unclipped model logit / probability
            expected_logit = predict_data[target]["logit_model"]
            assert math.isclose(logit_cal, expected_logit, abs_tol=1e-9)

            expected_p_model = 1.0 / (1.0 + np.exp(-expected_logit))
            assert math.isclose(p_numpy, expected_p_model, abs_tol=1e-9)


# ---------------------------------------------------------------------------
# Test 6: Missing Fields Imputation & Low Reliability Warning
# ---------------------------------------------------------------------------
def test_6_missing_fields_and_low_reliability_warning(client: TestClient) -> None:
    """Test 6: Missing fields are recorded in `imputed`; warning added when > 30% are missing."""
    # Quick mode with 3 of 7 features missing (> 30%): Typical Chest Pain, Atypical, Nonanginal omitted
    req_sparse = {
        "mode": "quick",
        "inputs": {
            "Age": 60,
            "Sex": "Male",
            "DM": False,
            "HTN": True,
        },
    }
    res = client.post("/api/predict", json=req_sparse)
    assert res.status_code == 200
    data = res.json()

    assert set(data["imputed"]) == {"Typical Chest Pain", "Atypical", "Nonanginal"}
    warning_codes = [w["code"] for w in data["warnings"]]
    assert "low_reliability" in warning_codes


# ---------------------------------------------------------------------------
# Test 7: Soft Range Check Warning
# ---------------------------------------------------------------------------
def test_7_outside_training_range_warning(client: TestClient) -> None:
    """Test 7: Out-of-range numeric input triggers soft check warning."""
    req = {
        "mode": "quick",
        "inputs": {
            "Age": 115,  # Valid under hard limit [0, 120] but outside training max (86)
            "Sex": "Male",
            "Typical Chest Pain": True,
            "Atypical": False,
            "Nonanginal": False,
            "DM": False,
            "HTN": False,
        },
    }
    res = client.post("/api/predict", json=req)
    assert res.status_code == 200
    data = res.json()

    range_warnings = [w for w in data["warnings"] if w["code"] == "outside_training_range"]
    assert len(range_warnings) >= 1
    assert any(w["feature"] == "Age" for w in range_warnings)


# ---------------------------------------------------------------------------
# Test 8: Invalid Input Rejection (422)
# ---------------------------------------------------------------------------
def test_8_invalid_input_rejections_422(client: TestClient) -> None:
    """Test 8: Unknown fields, leak columns, non-finite values, and Age 500 trigger 422."""
    # Unknown field
    r1 = client.post("/api/predict", json={"mode": "quick", "inputs": {"Age": 55, "UnknownField": 123}})
    assert r1.status_code == 422
    assert "Unknown feature" in r1.text

    # Leak column in inputs
    r2 = client.post("/api/predict", json={"mode": "quick", "inputs": {"Age": 55, "LAD": 1}})
    assert r2.status_code == 422
    assert "leakage" in r2.text.lower()

    # Non-finite float (rejected by schema validator and HTTP endpoint)
    from backend.app.schemas import PredictRequest
    with pytest.raises(ValueError, match="Non-finite value"):
        PredictRequest(mode="quick", inputs={"Age": float("nan")})

    r_non_finite = client.post(
        "/api/predict",
        content=b'{"mode": "quick", "inputs": {"Age": 1e999}}',
        headers={"Content-Type": "application/json"},
    )
    assert r_non_finite.status_code == 422
    assert "Non-finite value" in r_non_finite.text

    # Wrong type for numeric feature over HTTP
    r3 = client.post("/api/predict", json={"mode": "quick", "inputs": {"Age": "invalid-string"}})
    assert r3.status_code == 422

    # Hard limit on Age (500)
    r4 = client.post("/api/predict", json={"mode": "quick", "inputs": {"Age": 500}})
    assert r4.status_code == 422
    assert "Age" in r4.text


# ---------------------------------------------------------------------------
# Test 9: Similar Patients Privacy & Case ID Exclusion
# ---------------------------------------------------------------------------
def test_9_similar_patients_privacy_and_exclusion(
    client: TestClient, sample_patient_inputs: dict[str, Any]
) -> None:
    """Test 9: Provided case_id is excluded from similar patients; returned fields are restricted."""
    case_id_query = 125
    req = {
        "mode": "quick",
        "inputs": sample_patient_inputs,
        "case_id": case_id_query,
    }
    res = client.post("/api/predict", json=req)
    assert res.status_code == 200
    data = res.json()

    similar_list = data["trust"]["similar_patients"]
    assert len(similar_list) > 0
    for p in similar_list:
        assert p["case_id"] != case_id_query, "Query patient was not excluded from similar candidates"
        assert set(p.keys()) == {"case_id", "distance", "age_band", "sex", "outcomes"}
        assert set(p["outcomes"].keys()) == {"CAD", "LAD", "LCX", "RCA"}


# ---------------------------------------------------------------------------
# Test 10: In-Memory Rate Limiter (429)
# ---------------------------------------------------------------------------
def test_10_rate_limiting_429(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    """Test 10: Exceeding request rate limit returns 429 with Retry-After header."""
    reset_rate_limiter()
    monkeypatch.setenv("TRUSTHEART_RATE_LIMIT", "2")

    res1 = client.get("/api/health")
    res2 = client.get("/api/health")
    res3 = client.get("/api/health")

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res3.status_code == 429
    assert "Retry-After" in res3.headers

    # Reset rate limiter for remaining tests
    reset_rate_limiter()


# ---------------------------------------------------------------------------
# Test 11: Request Payload Size Limit (413)
# ---------------------------------------------------------------------------
def test_11_request_body_size_limit_413(client: TestClient) -> None:
    """Test 11: Request payload exceeding 20 KB is rejected with 413."""
    oversized_data = {"mode": "quick", "inputs": {"Age": 50, "padding": "x" * 25000}}
    res = client.post("/api/predict", json=oversized_data)
    assert res.status_code == 413
    assert "20 KB" in res.text


# ---------------------------------------------------------------------------
# Test 12: Security Headers & CORS Enforcement
# ---------------------------------------------------------------------------
def test_12_security_headers_and_cors(client: TestClient) -> None:
    """Test 12: Security headers present; disallowed Origin receives no allow header."""
    # Valid allowed origin
    res_allowed = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert res_allowed.headers.get("access-control-allow-origin") == "http://localhost:5173"

    # Disallowed origin
    res_disallowed = client.get("/api/health", headers={"Origin": "http://malicious-site.com"})
    assert "access-control-allow-origin" not in res_disallowed.headers

    # Mandatory security headers
    headers = res_allowed.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("Referrer-Policy") == "no-referrer"
    assert headers.get("Content-Security-Policy") == "default-src 'none'"

    # Cache-Control: no-store on /api/predict
    pred_res = client.post(
        "/api/predict",
        json={"mode": "quick", "inputs": {"Age": 55, "Sex": "Male"}},
    )
    assert pred_res.headers.get("Cache-Control") == "no-store"


# ---------------------------------------------------------------------------
# Test 13: Zero-PHI Logging Enforcement
# ---------------------------------------------------------------------------
def test_13_zero_phi_logging_enforcement(
    client: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    """Test 13: Requests with sentinel values and case_ids leave zero traces in log output."""
    sentinel_age = 61.123456
    sentinel_case_id = 293

    with caplog.at_level(logging.INFO):
        res = client.post(
            "/api/predict",
            json={
                "mode": "quick",
                "inputs": {"Age": sentinel_age, "Sex": "Male"},
                "case_id": sentinel_case_id,
            },
        )
        assert res.status_code == 200

    log_content = caplog.text
    assert str(sentinel_age) not in log_content, "Sentinel age leaked into application logs!"
    assert str(sentinel_case_id) not in log_content, "Case ID leaked into application logs!"


# ---------------------------------------------------------------------------
# Test 14: Determinism of Predictions
# ---------------------------------------------------------------------------
def test_14_prediction_determinism(
    client: TestClient, sample_patient_inputs: dict[str, Any]
) -> None:
    """Test 14: Repeated requests with identical inputs produce identical responses except request_id."""
    req_body = {
        "mode": "quick",
        "inputs": sample_patient_inputs,
        "case_id": 125,
    }
    res1 = client.post("/api/predict", json=req_body)
    res2 = client.post("/api/predict", json=req_body)

    assert res1.status_code == 200
    assert res2.status_code == 200

    d1 = res1.json()
    d2 = res2.json()

    assert d1["request_id"] != d2["request_id"]
    del d1["request_id"]
    del d2["request_id"]

    assert d1 == d2


# ---------------------------------------------------------------------------
# Test 15: Fail-Closed Integrity Check on Tampered Models
# ---------------------------------------------------------------------------
def test_15_startup_fails_closed_on_tampering(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test 15: Tampering with a model artifact causes startup to fail closed."""
    # Copy models directory to temporary path
    temp_models = tmp_path / "models"
    shutil.copytree("models", temp_models)

    # Tamper with quick_CAD.joblib by appending a corrupt byte
    tamper_file = temp_models / "quick_CAD.joblib"
    with open(tamper_file, "ab") as f:
        f.write(b"CORRUPT")

    # Set environment variable to tampered models directory
    monkeypatch.setenv("TRUSTHEART_MODELS_DIR", str(temp_models))

    # Expect initialization to fail closed with a RuntimeError
    with pytest.raises(RuntimeError, match="Integrity check failed"):
        ModelService(models_dir=temp_models)
