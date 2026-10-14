# TrustHeart 3D API Documentation

FastAPI backend providing clinically calibrated coronary artery disease (CAD) risk assessment, Fréchet coherence bounds, explainability breakdowns, and similarity evidence.

- **Base URL**: `http://127.0.0.1:8000/api`
- **Model Version**: `ml-v1`
- **Dataset Context**: UCI Machine Learning Repository Dataset #411 (Z-Alizadeh Sani dataset, 303 patients).

---

## Security & Privacy Architecture

1. **Strict CORS Whitelist**: Only origins explicitly defined in `TRUSTHEART_ORIGINS` (default: `http://localhost:5173`, `http://127.0.0.1:5173`) are permitted. Wildcards are strictly prohibited. Disallowed origins receive no `Access-Control-Allow-Origin` header.
2. **Payload Size Guard**: Request payloads exceeding 20 KB are rejected immediately with HTTP 413.
3. **In-Memory Rate Limiting**: Per-client IP rate limiter defaulting to 60 requests/minute (customizable via `TRUSTHEART_RATE_LIMIT`). Excess requests return HTTP 429 with a standard `Retry-After` header.
4. **Hardened Security Headers**:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
   - `Content-Security-Policy: default-src 'none'`
   - `Cache-Control: no-store` (applied to all prediction outputs)
5. **Zero-PHI Logging**: Request payloads, individual feature inputs, prediction outputs, and patient identifiers (`case_id`) are never logged. Server access logs record only the HTTP method, endpoint path, status code, and execution duration.
6. **Fail-Closed Startup**: On server launch, all model files (`models/*.joblib`), feature statistics, and trust tables are cryptographically validated against SHA-256 digests in `models/manifest.json`. The server fails closed and refuses to boot if any artifact is missing or tampered.
7. **Clean Error Handling**: All client and server errors return structured JSON objects without exposing tracebacks or internal execution details.

---

## Endpoints

### 1. Health & Verification Check
`GET /api/health`

Verifies that the backend is operational and that all model artifacts have satisfied cryptographic checksum checks.

#### Response Example (200 OK)
```json
{
  "status": "ok",
  "model_version": "ml-v1 (e29ed066fe353a882b917c87f28857f11163cb27)",
  "git_commit": "e29ed066fe353a882b917c87f28857f11163cb27",
  "models_verified": true,
  "disclaimer": "Decision support / educational use only. Predictions are per-vessel probabilities from a small single-centre dataset and are not a lesion location. Not a substitute for formal diagnostic imaging or clinical judgement."
}
```

---

### 2. Feature & Mode Metadata
`GET /api/meta`

Returns mode specifications (Quick: 7 features; Full: 55 features) and training statistics for all human-readable inputs.

#### Response Example (200 OK)
```json
{
  "modes": {
    "quick": {
      "name": "quick",
      "description": "Quick screening mode using 7 compact clinical features",
      "n_features": 7,
      "features": ["Age", "Sex", "Typical Chest Pain", "Atypical", "Nonanginal", "DM", "HTN"]
    },
    "full": {
      "name": "full",
      "description": "Full clinical mode using all 55 features and nested CV-tuned models",
      "n_features": 55,
      "features": ["Age", "Weight", "Length", "..."]
    }
  },
  "features": [
    {
      "name": "Age",
      "label": "Age",
      "kind": "continuous",
      "group": "Demographics",
      "allowed_values": null,
      "training_min": 30.0,
      "training_max": 86.0,
      "training_median": 58.0,
      "training": { "min": 30.0, "max": 86.0, "median": 58.0 },
      "in_quick": true,
      "unit": null
    },
    {
      "name": "Sex",
      "label": "Sex",
      "kind": "categorical",
      "group": "Demographics",
      "allowed_values": ["Male", "Female"],
      "training_min": 0.0,
      "training_max": 1.0,
      "training_median": 1.0,
      "training": { "min": 0.0, "max": 1.0, "median": 1.0 },
      "in_quick": true,
      "unit": null
    }
  ]
}
```

---

### 3. Representative Demo Patients
`GET /api/samples`

Retrieves 4 deterministic benchmark patient profiles selected from out-of-fold evaluations:
- **`lower`**: 10th percentile CAD risk profile (Case ID 293).
- **`intermediate`**: 50th percentile CAD risk profile (Case ID 125).
- **`higher`**: 90th percentile CAD risk profile (Case ID 52).
- **`LCX-positive example`**: 50th percentile profile among verified LCX stenosis cases (Case ID 265).

#### Response Example (200 OK)
```json
{
  "samples": [
    {
      "case_id": 293,
      "label": "lower",
      "inputs": {
        "Age": 59,
        "Sex": "Male",
        "Typical Chest Pain": false,
        "Atypical": false,
        "Nonanginal": false,
        "DM": false,
        "HTN": false,
        "VHD": "mild",
        "BBB": "N"
      },
      "ground_truth": { "CAD": 0, "LAD": 0, "LCX": 0, "RCA": 0 },
      "ground_truth_note": "dataset angiography labels, demo only",
      "oof_estimate": { "CAD": 0.1099, "LAD": 0.1652, "LCX": 0.1678, "RCA": 0.1478 },
      "oof_estimate_note": "out-of-fold: this patient was not in the training data of the model that produced it"
    }
  ]
}
```

---

### 4. Client-Side Model Parameter Export
`GET /api/model-export?mode=quick|full`

Exports standardized pipeline coefficients, intercepts, and Platt scaling parameters for direct browser evaluation.

#### Response Example (200 OK)
```json
{
  "mode": "quick",
  "targets": {
    "CAD": {
      "feature_list": ["Age", "Sex", "Typical Chest Pain", "Atypical", "Nonanginal", "DM", "HTN"],
      "scaler_mean": [58.89, 0.706, 0.541, 0.287, 0.053, 0.297, 0.591],
      "scaler_scale": [10.37, 0.456, 0.498, 0.452, 0.224, 0.457, 0.492],
      "coef": [0.015, -0.003, 0.038, -0.024, -0.006, 0.009, 0.014],
      "intercept": 0.068,
      "platt_a": 13.7899,
      "platt_b": 0.9356,
      "defaults": { "Age": 58.0, "Sex": 1.0, "Typical Chest Pain": 1.0, "Atypical": 0.0, "Nonanginal": 0.0, "DM": 0.0, "HTN": 1.0 }
    }
  }
}
```

---

### 5. Multi-Target Prediction with Trust Layer
`POST /api/predict`

Performs multi-artery stenosis inference, applies Fréchet probability bounds to CAD, computes exact linear contributions in logit space, searches for nearest clinical neighbours, and reports model lift.

#### Request Schema
```json
{
  "mode": "quick",
  "inputs": {
    "Age": 62,
    "Sex": "Male",
    "Typical Chest Pain": true,
    "Atypical": false,
    "Nonanginal": false,
    "DM": true,
    "HTN": true
  },
  "case_id": null
}
```

#### Response Structure
- **`predictions`**: Per-target calibrated probabilities, display risk band (`lower`, `intermediate`, `higher`), linear logit `base`, and top 10 feature contributions with direction and stability tags.
  - Mathematical identity: $\text{base} + \sum (\text{contributions}) + \text{other\_total} = \text{logit}(p)$.
- **`consistency`**: Fréchet coherence bounds $\max(P(\text{LAD}), P(\text{LCX}), P(\text{RCA})) \le P(\text{CAD}) \le \min(1, \sum P(\text{vessels}))$, clipping status (`ok`, `raised`, `lowered`), model CAD score, and final adjusted CAD score.
- **`trust`**: Similar historical patients (5 cases, Euclidean distance on standardized z-scores), empirical k-NN evidence estimate (k=15), leave-one-out AUC, and nested CV lift intervals.
- **`imputed`**: List of omitted features filled via training medians. If > 30% are imputed, a `low_reliability` warning is added.
- **`warnings`**: Soft out-of-range checks and data reliability notices.

---

## PowerShell Execution Example

To test the prediction endpoint locally via Windows PowerShell:

```powershell
$Headers = @{
    "Content-Type" = "application/json"
    "Origin" = "http://localhost:5173"
}

$Body = @{
    mode = "quick"
    inputs = @{
        Age = 58
        Sex = "Male"
        "Typical Chest Pain" = $true
        Atypical = $false
        Nonanginal = $false
        DM = $false
        HTN = $true
    }
    case_id = 125
} | ConvertTo-Json -Depth 5

$Response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/predict" -Method Post -Headers $Headers -Body $Body
$Response | ConvertTo-Json -Depth 5
```
