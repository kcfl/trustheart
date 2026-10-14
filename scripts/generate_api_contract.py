"""Generate comprehensive docs/API_CONTRACT.md for frontend teammates."""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def generate_contract() -> None:
    # Read api examples
    quick_p10_path = REPO_ROOT / "docs" / "api_examples" / "quick_p10.json"
    full_3missing_path = (
        REPO_ROOT / "docs" / "api_examples" / "full_median_3missing.json"
    )

    with open(quick_p10_path, "r", encoding="utf-8") as f:
        quick_p10_str = f.read().strip()

    with open(full_3missing_path, "r", encoding="utf-8") as f:
        full_3missing_str = f.read().strip()

    contract_content = f"""# TrustHeart 3D — API Contract & Integration Guide

> **CRITICAL CLINICAL NOTICE**:
> **Probabilities are per-vessel, not lesion location.**
> Predicted probabilities represent the calibrated probability of significant stenosis ($\ge 50\%$ diameter stenosis) in each named coronary artery branch (LAD, LCX, RCA) or CAD overall. They do **not** represent lesion locations, spatial coordinates along the coronary vessel, or lesion counts.
> Decision support / educational use only. Not a substitute for formal diagnostic angiography or clinical judgement.

---

## 1. Overview & Architecture

TrustHeart 3D provides a validated, calibrated machine learning backend for coronary artery disease (CAD) risk assessment. It supports:
- **Two clinical operational modes**:
  - `quick`: 7 bedside screening features.
  - `full`: 54 multimodal features (clinical history, vitals, labs, ECG, and echocardiography).
- **Four diagnostic targets**: `CAD`, `LAD` (Left Anterior Descending), `LCX` (Left Circumflex), and `RCA` (Right Coronary Artery).
- **Logical consistency enforcement**: Fréchet joint probability bounds ensure $P(\\text{{CAD}}) \\ge \\max(P(\\text{{LAD}}), P(\\text{{LCX}}), P(\\text{{RCA}}))$.
- **Linear explainability**: Exact logit decomposition into per-feature linear contributions.
- **Clinical trust layer**: Out-of-fold nearest-neighbour evidence and stability tagging.

---

## 2. API Endpoints

### 2.1 `GET /api/health`
Operational readiness, model verification, and clinical disclaimer.

- **Request**: No parameters.
- **Response Schema** (`HealthResponse`):
  - `status` (`string`, required): Operational status, e.g. `"ok"`.
  - `model_version` (`string`, required): Fixed model release string anchored to `models/manifest.json`, e.g. `"ml-v1 (e29ed066fe353a882b917c87f28857f11163cb27)"`.
  - `git_commit` (`string`, required): SHA commit hash recorded in `manifest.json`.
  - `models_verified` (`boolean`, required): Cryptographic hash integrity status (`true` if SHA-256 match passed).
  - `disclaimer` (`string`, required): Mandatory clinical disclaimer text.

---

### 2.2 `GET /api/meta`
Feature catalog, mode specifications, training statistics, and display probability band thresholds.

- **Request**: No parameters.
- **Response Schema** (`MetaResponse`):
  - `modes` (`object`, required): Mode definitions mapping:
    - `quick`: `{{ "name": "quick", "description": string, "n_features": 7, "features": string[] }}`
    - `full`: `{{ "name": "full", "description": string, "n_features": 54, "features": string[] }}`
  - `features` (`FeatureMetaItem[]`, required): Array of feature descriptors:
    - `name` (`string`, required): Canonical feature identifier (e.g. `"Age"`, `"DM"`, `"EF-TTE"`).
    - `label` (`string`, required): Human-readable UI label.
    - `kind` (`"binary" | "continuous" | "ordinal" | "categorical"`, required): Feature data kind.
    - `group` (`string`, required): Clinical grouping (`Demographics`, `History & risk factors`, `Vitals & exam`, `Symptoms`, `ECG`, `Labs`, `Echo`).
    - `allowed_values` (`any[] | null`, optional): Valid string options for categoricals or `[false, true]` for binary.
    - `training_min` (`float`, required): Minimum observed in training dataset.
    - `training_max` (`float`, required): Maximum observed in training dataset.
    - `training_median` (`float`, required): Training set median used for default imputation.
    - `training` (`object`, required): `{{ "min": float, "max": float, "median": float }}`.
    - `in_quick` (`boolean`, required): `true` if feature belongs to the 7-feature quick screening set.
    - `unit` (`null`, optional): Optional clinical unit string.
  - `bands` (`BandMetaItem[]`, required): The authoritative source of UI risk band cutoffs:
    - `lower`: `min = 0.0, max = 0.30`
    - `intermediate`: `min = 0.30, max = 0.60`
    - `higher`: `min = 0.60, max = 1.0`

> **Band Cutoffs Source**: The frontend must consume `/api/meta` `bands` array to style probabilities. Bands are purely display categories for clinical visual triage, not diagnostic thresholds.

---

### 2.3 `GET /api/samples`
Precomputed deterministic demo patient profiles.

- **Request**: No parameters.
- **Response Schema** (`SamplesResponse`):
  - `samples` (`SamplePatient[]`, required): Array of 4 representative patient cases:
    - `case_id` (`integer`, required): Dataset index (0 to 302).
    - `label` (`string`, required): Slug identifier (`"p10"`, `"median"`, `"p90"`, `"lcx_positive_near_median"`).
    - `label_text` (`string`, required): Descriptive UI label.
    - `inputs` (`object`, required): Complete feature key-value mapping for the patient.
    - `ground_truth` (`dict[string, int]`, required): Actual angiographic stenosis status for each target.
    - `oof_estimate` (`dict[string, float]`, required): Mean out-of-fold calibrated probabilities across 10 CV repeats.

---

### 2.4 `GET /api/model-export`
Lightweight browser-side model parameters for offline or instant client-side prediction re-computation.

- **Request Query Parameters**:
  - `mode` (`string`, optional, default `"quick"`): `"quick"` or `"full"`.
- **Response Schema** (`ModelExportResponse`):
  - `mode` (`string`, required): Echo of requested mode.
  - `targets` (`dict[string, TargetModelExport]`, required): Per-target (`CAD`, `LAD`, `LCX`, `RCA`) linear parameters:
    - `feature_list` (`string[]`, required): Ordered list of feature names.
    - `scaler_mean` (`float[]`, required): StandardScaler centering means.
    - `scaler_scale` (`float[]`, required): StandardScaler scaling factors (standard deviations).
    - `coef` (`float[]`, required): Logistic regression coefficients $w$.
    - `intercept` (`float`, required): Logistic regression intercept $c$.
    - `platt_a` (`float`, required): Platt calibration scaling parameter $a$.
    - `platt_b` (`float`, required): Platt calibration shift parameter $b$.
    - `defaults` (`dict[string, float]`, required): Default imputation values per feature.

---

### 2.5 `POST /api/predict`
Primary calibrated prediction, Fréchet logical consistency checking, logit contributions, and trust evidence.

#### Request Schema (`PredictRequest`)
```json
{{
  "mode": "quick",
  "inputs": {{
    "Age": 58,
    "Sex": "Male",
    "Typical Chest Pain": true,
    "Atypical": false,
    "Nonanginal": false,
    "DM": false,
    "HTN": true
  }},
  "case_id": null
}}
```

- **Fields**:
  - `mode` (`"quick" | "full"`, required): Model mode.
  - `inputs` (`dict[string, any]`, required): Patient feature inputs.
  - `case_id` (`integer | null`, optional, default `null`): Optional dataset case identifier (0 to 302). Excluded from similarity search to prevent self-matching.

#### Input Feature Specifications, Types, Ranges, and Defaults

| Feature Name | Kind | Type | Valid Range / Allowed Values | Imputation Default |
|:---|:---|:---|:---|:---|
| **Age** | continuous | number | `0.0` to `120.0` | `58.0` |
| **Weight** | continuous | number | `10.0` to `400.0` kg | `74.0` |
| **Length** | continuous | number | `50.0` to `260.0` cm | `165.0` |
| **Sex** | categorical | string / bool / 0-1 | `"Male"`, `"Female"`, `"Fmale"` | `"Male"` |
| **BMI** | continuous | number | `10.0` to `100.0` | `26.78` |
| **DM** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **HTN** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `true` (1) |
| **Current Smoker** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **EX-Smoker** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **FH** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Obesity** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **CRF** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **CVA** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Airway disease** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Thyroid Disease** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **CHF** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **DLP** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **BP** | continuous | number | `30.0` to `300.0` mmHg | `130.0` |
| **PR** | continuous | number | `30.0` to `250.0` bpm | `70.0` |
| **Edema** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Weak Peripheral Pulse**| binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Lung rales** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Systolic Murmur** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Diastolic Murmur** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Typical Chest Pain** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `true` (1) |
| **Dyspnea** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Function Class** | ordinal | number | `0.0` to `3.0` | `0.0` |
| **Atypical** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Nonanginal** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **LowTH Ang** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Q Wave** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **St Elevation** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **St Depression** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Tinversion** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **LVH** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **Poor R Progression** | binary | boolean / 0-1 | `true`, `false`, `0`, `1` | `false` (0) |
| **BBB** | categorical | string | `"N"`, `"LBBB"`, `"RBBB"` | `"N"` |
| **FBS** | continuous | number | `20.0` to `1200.0` mg/dl | `119.0` |
| **CR** | continuous | number | `0.1` to `30.0` mg/dl | `1.0` |
| **TG** | continuous | number | `10.0` to `3000.0` mg/dl | `150.0` |
| **LDL** | continuous | number | `5.0` to `1000.0` mg/dl | `104.0` |
| **HDL** | continuous | number | `5.0` to `300.0` mg/dl | `41.0` |
| **BUN** | continuous | number | `1.0` to `300.0` mg/dl | `16.0` |
| **ESR** | continuous | number | `0.0` to `200.0` mm/hr | `15.0` |
| **HB** | continuous | number | `3.0` to `25.0` g/dl | `13.5` |
| **K** | continuous | number | `1.0` to `10.0` mEq/L | `4.2` |
| **Na** | continuous | number | `90.0` to `200.0` mEq/L | `141.0` |
| **WBC** | continuous | number | `500.0` to `150000.0` /cu.mm | `7500.0` |
| **Lymph** | continuous | number | `0.0` to `100.0` % | `32.0` |
| **Neut** | continuous | number | `0.0` to `100.0` % | `60.0` |
| **PLT** | continuous | number | `5.0` to `2500.0` 1000/cu.mm | `221.0` |
| **EF-TTE** | continuous | number | `5.0` to `95.0` % | `50.0` |
| **Region RWMA** | ordinal | number | `0.0` to `4.0` | `0.0` |
| **VHD** | ordinal | string | `"N"`, `"mild"`, `"moderate"`, `"severe"` | `"N"` |

#### Response Schema (`PredictResponse`)
- `request_id` (`string`, required): UUID generated per request.
- `mode` (`"quick" | "full"`, required): Echo of mode used.
- `model_version` (`string`, required): Release string from manifest, e.g. `"ml-v1 (e29ed06...)"`.
- `predictions` (`dict[string, TargetPrediction]`, required): Keyed by `"CAD"`, `"LAD"`, `"LCX"`, `"RCA"`:
  - `raw_probability` (`float`, required): Uncalibrated logistic probability $\sigma(w^T z + c)$.
  - `calibrated_probability` (`float`, required): Platt-calibrated probability $\sigma(a \cdot \text{{logit}} + b)$.
  - `band` (`"lower" | "intermediate" | "higher"`, required): Display category based on calibrated probability.
  - `display_probability` (`float`, required): Authoritative UI probability (matches `calibrated_probability` for vessels; adjusted for CAD if Fréchet bounds violated).
  - `display_band` (`"lower" | "intermediate" | "higher"`, required): UI display band for `display_probability`.
  - `adjusted` (`boolean`, required): `true` if `display_probability` was altered by Fréchet consistency adjustment.
  - `display_note` (`string | null`, optional): Explanation string when `adjusted == true`.
  - `base` (`float`, required): Model logit baseline $a \cdot c + b$.
  - `contributions` (`ContributionItem[]`, required): Top feature contributions in logit space:
    - `feature` (`string`, required): Feature name.
    - `value` (`any`, required): Input value used.
    - `contribution` (`float`, required): Additive logit contribution $a \cdot w_j \cdot z_j$.
    - `direction` (`"up" | "down"`, required): Direction of risk shift (`"up"` if positive, `"down"` if negative).
    - `stability_tag` (`string | null`, optional): Stability rating (`"stable"`, `"moderate"`, `"unstable"`).
    - `imputed` (`boolean`, required): `true` if the feature was absent/null and imputed from training median.
  - `other_total` (`float`, required): Sum of remaining contributions outside the top displayed list.
  - `logit_model` (`float`, required): Exact model logit before calibration / consistency adjustment.
  - `model_info` (`ModelInfo`, required):
    - `config_name` (`string`, required): Configuration identifier from selection.
    - `n_features` (`integer`, required): Number of features used by the fitted model.
    - `features_used` (`string[]`, required): Features in model pipeline.
    - `source_space` (`"quick" | "auto"`, required): Feature space name.
  - `base_rate` (`float`, required): Training cohort prevalence for this target.
  - `base_rate_note` (`string`, required): Contextual note on base rate.
- `consistency` (`ConsistencyInfo`, required):
  - `status` (`"ok" | "raised" | "lowered"`, required): Fréchet bound check status.
  - `lower` (`float`, required): Theoretical lower bound $\max(P(v))$.
  - `upper` (`float`, required): Theoretical upper bound $\min(1.0, \sum P(v))$.
  - `p_cad_model` (`float`, required): Model calibrated CAD probability.
  - `p_cad_adjusted` (`float`, required): Logically consistent CAD probability clamped to $[lower, upper]$.
- `trust` (`TrustBlock`, required):
  - `similar_patients` (`SimilarPatientItem[]`, required): Nearest training cases (distance, age_band, sex, outcomes).
  - `evidence_estimate` (`dict[string, float] | null`, optional): k-NN local prevalence estimate.
  - `evidence_auc` (`dict[string, float]`, required): Benchmark AUC for evidence k-NN.
  - `lift` (`dict[string, LiftItem]`, required): Diagnostic lift metrics of full mode over quick screening.
  - `bands_note` (`string`, required): Explanation of probability bands.
- `imputed` (`string[]`, required): List of all feature names imputed during inference.
- `warnings` (`PredictWarning[]`, required): Array of validation or clinical reliability warnings.
- `oof_estimate` (`dict[string, float] | null`, optional): If `case_id` provided, out-of-fold historical estimate.
- `oof_estimate_note` (`string | null`, optional): Explanation note if `oof_estimate` is present.
- `disclaimer` (`string`, required): Clinical disclaimer.
- `limitations` (`string[]`, required): Known clinical dataset limitations.

---

## 3. System Semantics & Code Quotations

### 3.1 Meaning of `imputed`
Quoted from `backend/app/service.py`:
```python
        # Track missing features and impute with training medians
        imputed_features: list[str] = []
        for feat in expected_features:
            if feat not in request.inputs or request.inputs[feat] is None:
                imputed_features.append(feat)
```
- In `PredictResponse.imputed`: A list containing every feature expected by the requested mode that was either omitted from the request or set to `null`.
- In `ContributionItem.imputed`: A boolean flag on every individual feature contribution. `true` indicates that the patient value was missing and was substituted with the training median/mode; `false` indicates a measured or supplied patient value.

### 3.2 Meaning of `warnings`
Quoted from `backend/app/service.py`:
```python
        # 1. Low reliability warning if >30% features imputed
        imputed_ratio = len(imputed_features) / len(expected_features)
        if imputed_ratio > 0.30:
            warnings.append(
                PredictWarning(
                    code="low_reliability",
                    message=(
                        f"{{len(imputed_features)}} of {{len(expected_features)}} mode features "
                        f"({{imputed_ratio:.1%}}) were imputed from training medians."
                    ),
                )
            )

        # 2. Outside training range warning on continuous features
        if val < t_min or val > t_max:
            warnings.append(
                PredictWarning(
                    code="outside_training_range",
                    feature=feat,
                    value=val,
                    min=t_min,
                    max=t_max,
                    message=(
                        f"Value {{val}} for '{{feat}}' is outside observed training "
                        f"range [{{t_min}}, {{t_max}}]."
                    ),
                )
            )

        # 3. Important feature imputed warning
        if is_imputed:
            if f_name in self.trust_stats.get("top_features", {{}}).get(space, {{}}).get(target, []):
                warnings.append(
                    PredictWarning(
                        code="important_feature_imputed",
                        feature=f_name,
                        target=target,
                        message=(
                            "Missing value was filled with the training median/most frequent value; "
                            "this feature matters for this target."
                        ),
                    )
                )
```
- `low_reliability`: More than 30% of required mode features were absent and filled with training medians.
- `outside_training_range`: A measured numeric feature is within physiologic bounds but lies outside the empirical min-max range of the training cohort.
- `important_feature_imputed`: A feature known to be a top predictor for this target was missing and filled with its training baseline.

### 3.3 Meaning of `stability_tag`
Quoted from `ml/config.py`:
```python
def compute_stability_tag(top_k_freq: float, sign_consistency: float) -> str:
    \"\"\"Classify feature importance stability tag.

    Tag rule:
    - 'stable' if top_k_freq >= STAB_STABLE_FREQ and sign_consistency >= STAB_STABLE_SIGN
    - 'moderate' if top_k_freq >= STAB_MODERATE_FREQ (and not stable)
    - otherwise 'unstable'
    \"\"\"
    if top_k_freq >= STAB_STABLE_FREQ and sign_consistency >= STAB_STABLE_SIGN:
        return "stable"
    if top_k_freq >= STAB_MODERATE_FREQ:
        return "moderate"
    return "unstable"
```
Constants:
- `STAB_STABLE_FREQ = 0.80` (feature appears in top-K in $\ge 80\%$ of bootstrap resamples).
- `STAB_STABLE_SIGN = 0.90` (feature maintains the same direction/sign in $\ge 90\%$ of bootstrap resamples).
- `STAB_MODERATE_FREQ = 0.50` (feature appears in top-K in $\ge 50\%$ of bootstrap resamples).

---

## 4. Full Verified API Examples

### 4.1 Example 1: Quick Screening Mode (`docs/api_examples/quick_p10.json`)
```json
{quick_p10_str}
```

---

### 4.2 Example 2: Full Mode with Imputation (`docs/api_examples/full_median_3missing.json`)
```json
{full_3missing_str}
```
"""

    out_path = REPO_ROOT / "docs" / "API_CONTRACT.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(contract_content)
    print(f"Generated {out_path} ({len(contract_content)} bytes)")


if __name__ == "__main__":
    generate_contract()
