"""Comprehensive test suite for the TrustHeart 3D FastAPI backend."""

import copy
import json
import logging
import math
import shutil
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from scipy.special import expit, logit

from backend.app.config import FULL_HUMAN_FEATURES, QUICK_FEATURES, get_probability_band
from backend.app.main import app
from backend.app.security import reset_rate_limiter
from backend.app.service import ModelService, get_model_service
from ml.config import VHD_ORDINAL_MAPPING
from ml.predict import predict_one


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

    with open("models/manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)
    manifest_commit = manifest["git_commit"]

    assert data["git_commit"] == manifest_commit
    assert data["model_version"] == f"ml-v1 ({manifest_commit})"
    assert "disclaimer" in data and "Decision support" in data["disclaimer"]


# ---------------------------------------------------------------------------
# Test 2: Metadata Endpoint
# ---------------------------------------------------------------------------
def test_2_meta_modes_and_features(client: TestClient) -> None:
    """Test 2: GET /api/meta has 54 full features, 7 quick, bands, BBB as one feature."""
    res = client.get("/api/meta")
    assert res.status_code == 200
    data = res.json()

    # Verify probability bands
    assert "bands" in data
    bands = data["bands"]
    assert len(bands) == 3
    assert [b["name"] for b in bands] == ["lower", "intermediate", "higher"]
    assert bands[0] == {"name": "lower", "min": 0.0, "max": 0.30}
    assert bands[1] == {"name": "intermediate", "min": 0.30, "max": 0.60}
    assert bands[2] == {"name": "higher", "min": 0.60, "max": 1.0}

    # Verify mode definitions
    modes = data["modes"]
    assert "quick" in modes and "full" in modes
    assert modes["quick"]["n_features"] == 7
    assert len(modes["quick"]["features"]) == 7
    assert modes["full"]["n_features"] == 54
    assert len(modes["full"]["features"]) == 54

    # Verify feature list
    features = data["features"]
    assert len(features) == 54, f"Expected 54 features in meta list, got {len(features)}"
    assert "Exertional CP" not in [f["name"] for f in features]

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
    """Test 3: GET /api/samples returns exactly 4 demo patients with 54 inputs and oof estimates."""
    res = client.get("/api/samples")
    assert res.status_code == 200
    data = res.json()
    samples = data["samples"]
    assert len(samples) == 4

    expected_labels = {"p10", "median", "p90", "lcx_positive_near_median"}
    observed_labels = {s["label"] for s in samples}
    assert observed_labels == expected_labels

    expected_label_texts = {
        "p10": "10th percentile of dataset CAD risk (out-of-fold)",
        "median": "median of dataset CAD risk (out-of-fold)",
        "p90": "90th percentile of dataset CAD risk (out-of-fold)",
        "lcx_positive_near_median": "LCX-positive patient near the median",
    }

    for s in samples:
        assert isinstance(s["case_id"], int)
        assert 0 <= s["case_id"] < 303
        assert len(s["inputs"]) == 54
        assert "BBB" in s["inputs"]
        assert "Sex" in s["inputs"]
        assert "VHD" in s["inputs"]
        assert "Exertional CP" not in s["inputs"]
        assert s["label_text"] == expected_label_texts[s["label"]]
        assert set(s["ground_truth"].keys()) == {"CAD", "LAD", "LCX", "RCA"}
        assert set(s["oof_estimate"].keys()) == {"CAD", "LAD", "LCX", "RCA"}
        for t in ["CAD", "LAD", "LCX", "RCA"]:
            assert 0.0 <= s["oof_estimate"][t] <= 1.0


# ---------------------------------------------------------------------------
# Test 4: Prediction Calibration, Coherence, and Exact Linear Identity
# ---------------------------------------------------------------------------
def _format_inputs_for_model(inputs: dict[str, Any], service: ModelService, feature_list: list[str]) -> pd.DataFrame:
    filled = dict(inputs)
    for feat in FULL_HUMAN_FEATURES:
        if feat not in filled or filled[feat] is None:
            if feat == "Sex":
                filled[feat] = "Male" if service.feature_stats["Sex"]["median"] == 1.0 else "Female"
            elif feat == "VHD":
                filled[feat] = "N"
            elif feat == "BBB":
                filled[feat] = "N"
            elif feat in service.feature_stats and service.feature_stats[feat].get("is_binary", False):
                filled[feat] = bool(service.feature_stats[feat]["median"] == 1.0)
            elif feat in service.feature_stats:
                filled[feat] = float(service.feature_stats[feat]["median"])
            else:
                filled[feat] = 0.0

    row: dict[str, float] = {}
    for f in feature_list:
        if f == "Sex":
            val = filled.get("Sex", "Male")
            row[f] = 1.0 if str(val).strip().lower() == "male" else 0.0
        elif f == "VHD":
            val = filled.get("VHD", "N")
            row[f] = float(VHD_ORDINAL_MAPPING.get(str(val).strip().lower(), 0))
        elif f == "BBB_LBBB":
            val = filled.get("BBB", "N")
            row[f] = 1.0 if str(val).strip() == "LBBB" else 0.0
        elif f == "BBB_RBBB":
            val = filled.get("BBB", "N")
            row[f] = 1.0 if str(val).strip() == "RBBB" else 0.0
        elif f in filled:
            val = filled[f]
            if isinstance(val, bool):
                row[f] = 1.0 if val else 0.0
            else:
                row[f] = float(val)
        else:
            row[f] = 0.0
    return pd.DataFrame([row])


def test_4_predict_calibration_coherence_and_linear_identity(client: TestClient) -> None:
    """Test 4: Identity holds within 1e-9 across modes, targets, samples + imputed case, matching ml.predict."""
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()["samples"]

    # 4 samples + 1 request with 3 imputed features
    cases: list[dict[str, Any]] = [dict(s["inputs"]) for s in samples]
    imputed_case = dict(samples[1]["inputs"])
    del imputed_case["Region RWMA"]
    del imputed_case["EF-TTE"]
    del imputed_case["LDL"]
    cases.append(imputed_case)

    service = get_model_service()

    for mode in ["quick", "full"]:
        space = "quick" if mode == "quick" else "auto"
        for case_inputs in cases:
            res = client.post("/api/predict", json={"mode": mode, "inputs": case_inputs})
            assert res.status_code == 200, res.text
            data = res.json()
            preds = data["predictions"]

            for target in ["CAD", "LAD", "LCX", "RCA"]:
                p_obj = preds[target]
                p_cal = p_obj["calibrated_probability"]
                assert 0.0 <= p_cal <= 1.0
                assert p_obj["band"] in ["lower", "intermediate", "higher"]

                # 1. Exact linear decomposition identity check (abs tolerance 1e-9)
                base = p_obj["base"]
                sum_contrib = sum(c["contribution"] for c in p_obj["contributions"]) + p_obj["other_total"]
                logit_model = p_obj["logit_model"]
                assert math.isclose(base + sum_contrib, logit_model, abs_tol=1e-9), (
                    f"Mode {mode}, Target {target}: base + sum_contrib ({base + sum_contrib}) "
                    f"!= logit_model ({logit_model})"
                )

                # 2. expit(logit_model) == calibrated_probability (before coherence) with tolerance 1e-9
                assert math.isclose(float(expit(logit_model)), p_cal, abs_tol=1e-9), (
                    f"Mode {mode}, Target {target}: expit(logit) ({float(expit(logit_model))}) != p_cal ({p_cal})"
                )

                # 3. calibrated_probability matches ml.predict within 1e-9
                artifact = service.models[(space, target)]
                feature_list = artifact["feature_list"]
                X_df = _format_inputs_for_model(case_inputs, service, feature_list)
                p_ml = float(predict_one(space, target, X_df)[0])
                assert math.isclose(p_cal, p_ml, abs_tol=1e-9), (
                    f"Mode {mode}, Target {target}: p_cal ({p_cal}) != p_ml ({p_ml})"
                )

            # Fréchet coherence bounds check for CAD
            consistency = data["consistency"]
            lower = consistency["lower"]
            upper = consistency["upper"]
            p_cad_adj = consistency["p_cad_adjusted"]

            assert lower <= p_cad_adj <= upper + 1e-9
            assert math.isclose(consistency["p_cad_model"], preds["CAD"]["calibrated_probability"], abs_tol=1e-9)
            assert consistency["status"] in ["ok", "raised", "lowered"]


# ---------------------------------------------------------------------------
# Test 4b: Raw Probability Platt Scaling Consistency
# ---------------------------------------------------------------------------
def test_4b_raw_probability_platt_consistency(client: TestClient) -> None:
    """Test 4b: Asserts expit(a * logit(raw_probability) + b) == calibrated_probability within 1e-9."""
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()["samples"]

    for mode in ["quick", "full"]:
        export_res = client.get(f"/api/model-export?mode={mode}")
        assert export_res.status_code == 200
        export_targets = export_res.json()["targets"]

        for s in samples:
            res = client.post("/api/predict", json={"mode": mode, "inputs": s["inputs"]})
            assert res.status_code == 200
            preds = res.json()["predictions"]

            for target in ["CAD", "LAD", "LCX", "RCA"]:
                p_obj = preds[target]
                raw_p = p_obj["raw_probability"]
                cal_p = p_obj["calibrated_probability"]
                platt_a = export_targets[target]["platt_a"]
                platt_b = export_targets[target]["platt_b"]

                expected_cal = float(expit(platt_a * float(logit(raw_p)) + platt_b))
                assert math.isclose(expected_cal, cal_p, abs_tol=1e-9), (
                    f"Mode {mode}, Target {target}: expit(a*logit(raw)+b) ({expected_cal}) != cal_p ({cal_p})"
                )


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

    # Posting Exertional CP returns 422 with clear message ("not a model input")
    r5 = client.post(
        "/api/predict",
        json={"mode": "quick", "inputs": {"Age": 55, "Exertional CP": True}},
    )
    assert r5.status_code == 422
    assert "not a model input" in r5.text.lower()


# ---------------------------------------------------------------------------
# Test 8b: Important Feature Imputed Warning
# ---------------------------------------------------------------------------
def test_8b_important_feature_imputed_warning(client: TestClient) -> None:
    """Test warning code 'important_feature_imputed' when an important feature is removed."""
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    sample = dict(samples_res.json()["samples"][1]["inputs"])
    # Remove 'Region RWMA'
    del sample["Region RWMA"]

    res = client.post("/api/predict", json={"mode": "full", "inputs": sample})
    assert res.status_code == 200
    data = res.json()

    warnings = [
        w for w in data["warnings"]
        if w["code"] == "important_feature_imputed"
        and w.get("feature") == "Region RWMA"
        and w.get("target") == "LAD"
    ]
    assert len(warnings) == 1
    assert warnings[0]["message"] == (
        "Missing value was filled with the training median/most frequent value; "
        "this feature matters for this target."
    )


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
    assert "access-control-allow-credentials" not in res_allowed.headers

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


# ---------------------------------------------------------------------------
# Test 16: Display Fields and Fréchet Adjustment Verification
# ---------------------------------------------------------------------------
def test_16_display_fields_and_p10_adjustment(client: TestClient) -> None:
    """Test 16: Display fields match specifications, CAD adjustment and p10 raised status in both modes."""
    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200
    samples = samples_res.json()["samples"]

    p10_sample = next(s for s in samples if s["label"] == "p10")

    for mode in ["quick", "full"]:
        for sample in samples:
            res = client.post("/api/predict", json={"mode": mode, "inputs": sample["inputs"]})
            assert res.status_code == 200
            data = res.json()
            preds = data["predictions"]
            consistency = data["consistency"]

            # Vessels: display == calibrated, adjusted == False, display_note is None
            for v in ["LAD", "LCX", "RCA"]:
                assert preds[v]["display_probability"] == preds[v]["calibrated_probability"]
                assert preds[v]["display_band"] == get_probability_band(preds[v]["display_probability"])
                assert preds[v]["adjusted"] is False
                assert preds[v]["display_note"] is None

            # CAD: display == consistency.p_cad_adjusted, adjusted == (status != 'ok')
            assert math.isclose(preds["CAD"]["display_probability"], consistency["p_cad_adjusted"], abs_tol=1e-9)
            assert preds["CAD"]["display_band"] == get_probability_band(preds["CAD"]["display_probability"])
            assert preds["CAD"]["adjusted"] == (consistency["status"] != "ok")
            if preds["CAD"]["adjusted"]:
                assert preds["CAD"]["display_note"] == (
                    "Adjusted to stay logically consistent with the vessel probabilities "
                    "(CAD is defined as at least one stenotic vessel)."
                )
            else:
                assert preds["CAD"]["display_note"] is None

        # Specific check for p10 sample in BOTH modes
        p10_res = client.post("/api/predict", json={"mode": mode, "inputs": p10_sample["inputs"]})
        assert p10_res.status_code == 200
        p10_data = p10_res.json()
        p10_cad = p10_data["predictions"]["CAD"]
        p10_cons = p10_data["consistency"]

        assert p10_cons["status"] == "raised", f"Expected 'raised' for p10 in {mode} mode, got {p10_cons['status']}"
        assert p10_cad["adjusted"] is True
        assert p10_cad["display_probability"] != p10_cad["calibrated_probability"]
        assert p10_cad["display_probability"] == p10_cons["p_cad_adjusted"]


# ---------------------------------------------------------------------------
# Test 17: OpenAPI Contract Drift
# ---------------------------------------------------------------------------
def test_17_openapi_contract_drift() -> None:
    """Test 17: docs/openapi.json matches the active FastAPI app schema exactly."""
    openapi_path = Path("docs/openapi.json")
    assert openapi_path.is_file(), "docs/openapi.json missing! Run scripts/dump_openapi.py"

    with open(openapi_path, "r", encoding="utf-8") as f:
        disk_schema = json.load(f)

    active_schema = app.openapi()
    assert disk_schema == active_schema, (
        "docs/openapi.json differs from app.openapi()! Run scripts/dump_openapi.py to update."
    )


# ---------------------------------------------------------------------------
# Test 18: Probability Bands Boundary Agreement
# ---------------------------------------------------------------------------
def test_18_probability_bands_boundary_agreement(client: TestClient) -> None:
    """Test 18: /api/meta bands agree with get_probability_band at boundary values."""
    res = client.get("/api/meta")
    assert res.status_code == 200
    bands = res.json()["bands"]

    def classify_via_meta_bands(p: float) -> str:
        for b in bands:
            # min inclusive, max exclusive (for top band max inclusive)
            if b["name"] == "higher":
                if b["min"] <= p <= b["max"]:
                    return b["name"]
            else:
                if b["min"] <= p < b["max"]:
                    return b["name"]
        raise ValueError(f"Probability {p} not covered by meta bands")

    test_points = [0.2999, 0.30, 0.5999, 0.60]
    expected_bands = ["lower", "intermediate", "intermediate", "higher"]

    for p, expected in zip(test_points, expected_bands):
        fn_band = get_probability_band(p)
        meta_band = classify_via_meta_bands(p)
        assert fn_band == expected, f"get_probability_band({p}) gave {fn_band}, expected {expected}"
        assert meta_band == expected, f"meta bands classification of {p} gave {meta_band}, expected {expected}"
        assert fn_band == meta_band, f"Mismatch at boundary {p}: get_probability_band={fn_band} vs meta={meta_band}"


