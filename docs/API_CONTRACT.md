# TrustHeart 3D — API Contract & Integration Guide

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
- **Logical consistency enforcement**: Fréchet joint probability bounds ensure $P(\text{CAD}) \ge \max(P(\text{LAD}), P(\text{LCX}), P(\text{RCA}))$.
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
    - `quick`: `{ "name": "quick", "description": string, "n_features": 7, "features": string[] }`
    - `full`: `{ "name": "full", "description": string, "n_features": 54, "features": string[] }`
  - `features` (`FeatureMetaItem[]`, required): Array of feature descriptors:
    - `name` (`string`, required): Canonical feature identifier (e.g. `"Age"`, `"DM"`, `"EF-TTE"`).
    - `label` (`string`, required): Human-readable UI label.
    - `kind` (`"binary" | "continuous" | "ordinal" | "categorical"`, required): Feature data kind.
    - `group` (`string`, required): Clinical grouping (`Demographics`, `History & risk factors`, `Vitals & exam`, `Symptoms`, `ECG`, `Labs`, `Echo`).
    - `allowed_values` (`any[] | null`, optional): Valid string options for categoricals or `[false, true]` for binary.
    - `training_min` (`float`, required): Minimum observed in training dataset.
    - `training_max` (`float`, required): Maximum observed in training dataset.
    - `training_median` (`float`, required): Training set median used for default imputation.
    - `training` (`object`, required): `{ "min": float, "max": float, "median": float }`.
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
{
  "mode": "quick",
  "inputs": {
    "Age": 58,
    "Sex": "Male",
    "Typical Chest Pain": true,
    "Atypical": false,
    "Nonanginal": false,
    "DM": false,
    "HTN": true
  },
  "case_id": null
}
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
  - `calibrated_probability` (`float`, required): Platt-calibrated probability $\sigma(a \cdot 	ext{logit} + b)$.
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
                        f"{len(imputed_features)} of {len(expected_features)} mode features "
                        f"({imputed_ratio:.1%}) were imputed from training medians."
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
                        f"Value {val} for '{feat}' is outside observed training "
                        f"range [{t_min}, {t_max}]."
                    ),
                )
            )

        # 3. Important feature imputed warning
        if is_imputed:
            if f_name in self.trust_stats.get("top_features", {}).get(space, {}).get(target, []):
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
    """Classify feature importance stability tag.

    Tag rule:
    - 'stable' if top_k_freq >= STAB_STABLE_FREQ and sign_consistency >= STAB_STABLE_SIGN
    - 'moderate' if top_k_freq >= STAB_MODERATE_FREQ (and not stable)
    - otherwise 'unstable'
    """
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
{
  "request_id": "05e5594e-0d36-4046-84e1-a0ad49b1056d",
  "mode": "quick",
  "model_version": "ml-v1 (e29ed066fe353a882b917c87f28857f11163cb27)",
  "predictions": {
    "CAD": {
      "raw_probability": 0.45649353825979444,
      "calibrated_probability": 0.18690538635303863,
      "band": "lower",
      "display_probability": 0.22248620708923597,
      "display_band": "lower",
      "adjusted": true,
      "display_note": "Adjusted to stay logically consistent with the vessel probabilities (CAD is defined as at least one stenotic vessel).",
      "base": 1.7132725243187799,
      "contributions": [
        {
          "feature": "Atypical",
          "value": true,
          "contribution": -1.2306014573860864,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Typical Chest Pain",
          "value": false,
          "contribution": -1.1860832631981486,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": false,
          "contribution": -0.6917342782010778,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "DM",
          "value": false,
          "contribution": -0.33576599038074906,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Nonanginal",
          "value": false,
          "contribution": 0.131494367679112,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Sex",
          "value": "Male",
          "contribution": 0.12204425736062152,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 59.0,
          "contribution": 0.007128894566025472,
          "direction": "up",
          "stability_tag": "moderate",
          "imputed": false
        }
      ],
      "other_total": 0.0,
      "logit_model": -1.470244945241523,
      "model_info": {
        "config_name": "compact|LR|C=0.001",
        "n_features": 7,
        "features_used": [
          "Age",
          "Sex",
          "Typical Chest Pain",
          "Atypical",
          "Nonanginal",
          "DM",
          "HTN"
        ],
        "source_space": "quick"
      },
      "base_rate": 0.7128712871287128,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    },
    "LAD": {
      "raw_probability": 0.46388043702755677,
      "calibrated_probability": 0.20438819144851075,
      "band": "lower",
      "display_probability": 0.20438819144851075,
      "display_band": "lower",
      "adjusted": false,
      "display_note": null,
      "base": 0.43386575563296315,
      "contributions": [
        {
          "feature": "Atypical",
          "value": true,
          "contribution": -0.7990383647694816,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Typical Chest Pain",
          "value": false,
          "contribution": -0.765276578414724,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": false,
          "contribution": -0.33130952097999816,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Sex",
          "value": "Male",
          "contribution": 0.13601416480086925,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "DM",
          "value": false,
          "contribution": -0.11940284003891723,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Nonanginal",
          "value": false,
          "contribution": 0.0813030055291102,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 59.0,
          "contribution": 0.004754073930746505,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        }
      ],
      "other_total": 0.0,
      "logit_model": -1.3590903043094316,
      "model_info": {
        "config_name": "compact|LR|C=0.001",
        "n_features": 7,
        "features_used": [
          "Age",
          "Sex",
          "Typical Chest Pain",
          "Atypical",
          "Nonanginal",
          "DM",
          "HTN"
        ],
        "source_space": "quick"
      },
      "base_rate": 0.5841584158415841,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    },
    "LCX": {
      "raw_probability": 0.34686420062788165,
      "calibrated_probability": 0.22248620708923597,
      "band": "lower",
      "display_probability": 0.22248620708923597,
      "display_band": "lower",
      "adjusted": false,
      "display_note": null,
      "base": -0.5279177207382921,
      "contributions": [
        {
          "feature": "Typical Chest Pain",
          "value": false,
          "contribution": -0.5196747338825569,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": false,
          "contribution": -0.24970631668837986,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Sex",
          "value": "Male",
          "contribution": 0.23265514032589465,
          "direction": "up",
          "stability_tag": "moderate",
          "imputed": false
        },
        {
          "feature": "DM",
          "value": false,
          "contribution": -0.16319982588848367,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Atypical",
          "value": true,
          "contribution": -0.04449959960014,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Nonanginal",
          "value": false,
          "contribution": 0.015780376433083495,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 59.0,
          "contribution": 0.005326405139307913,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        }
      ],
      "other_total": 0.0,
      "logit_model": -1.2512362748995667,
      "model_info": {
        "config_name": "compact|LR|C=0.03",
        "n_features": 7,
        "features_used": [
          "Age",
          "Sex",
          "Typical Chest Pain",
          "Atypical",
          "Nonanginal",
          "DM",
          "HTN"
        ],
        "source_space": "quick"
      },
      "base_rate": 0.3927392739273927,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    },
    "RCA": {
      "raw_probability": 0.46735029667226524,
      "calibrated_probability": 0.10978148424487105,
      "band": "lower",
      "display_probability": 0.10978148424487105,
      "display_band": "lower",
      "adjusted": false,
      "display_note": null,
      "base": -0.6676863976369516,
      "contributions": [
        {
          "feature": "Atypical",
          "value": true,
          "contribution": -0.5747733531739929,
          "direction": "down",
          "stability_tag": "moderate",
          "imputed": false
        },
        {
          "feature": "Typical Chest Pain",
          "value": false,
          "contribution": -0.5158222545559885,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "DM",
          "value": false,
          "contribution": -0.29807535557783593,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": false,
          "contribution": -0.28698107407374973,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Sex",
          "value": "Male",
          "contribution": 0.18573664047759966,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Nonanginal",
          "value": false,
          "contribution": 0.060948461999562394,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 59.0,
          "contribution": 0.0036782598366076683,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        }
      ],
      "other_total": 0.0,
      "logit_model": -2.0929750727047485,
      "model_info": {
        "config_name": "compact|LR|C=0.001",
        "n_features": 7,
        "features_used": [
          "Age",
          "Sex",
          "Typical Chest Pain",
          "Atypical",
          "Nonanginal",
          "DM",
          "HTN"
        ],
        "source_space": "quick"
      },
      "base_rate": 0.37623762376237624,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    }
  },
  "consistency": {
    "status": "raised",
    "lower": 0.22248620708923597,
    "upper": 0.5366558827826178,
    "p_cad_model": 0.18690538635303863,
    "p_cad_adjusted": 0.22248620708923597
  },
  "trust": {
    "similar_patients": [
      {
        "case_id": 108,
        "distance": 0.0962,
        "age_band": "60-64",
        "sex": "M",
        "outcomes": {
          "CAD": 0,
          "LAD": 0,
          "LCX": 0,
          "RCA": 0
        }
      },
      {
        "case_id": 290,
        "distance": 0.0962,
        "age_band": "55-59",
        "sex": "M",
        "outcomes": {
          "CAD": 0,
          "LAD": 0,
          "LCX": 0,
          "RCA": 0
        }
      },
      {
        "case_id": 102,
        "distance": 0.2887,
        "age_band": "55-59",
        "sex": "M",
        "outcomes": {
          "CAD": 0,
          "LAD": 0,
          "LCX": 0,
          "RCA": 0
        }
      },
      {
        "case_id": 234,
        "distance": 0.2887,
        "age_band": "55-59",
        "sex": "M",
        "outcomes": {
          "CAD": 0,
          "LAD": 0,
          "LCX": 0,
          "RCA": 0
        }
      },
      {
        "case_id": 180,
        "distance": 0.2887,
        "age_band": "60-64",
        "sex": "M",
        "outcomes": {
          "CAD": 1,
          "LAD": 1,
          "LCX": 0,
          "RCA": 1
        }
      }
    ],
    "evidence_estimate": {
      "CAD": 0.3333333333333333,
      "LAD": 0.26666666666666666,
      "LCX": 0.2,
      "RCA": 0.13333333333333333
    },
    "evidence_auc": {
      "CAD": 0.8682418050234142,
      "LAD": 0.7532284100080711,
      "LCX": 0.6949214468396055,
      "RCA": 0.6923094773971966
    },
    "lift": {
      "CAD": {
        "paired_mean": 0.02572105151128139,
        "p2_5": 0.013330140485312763,
        "p97_5": 0.030738479140059737,
        "selection_identical_fraction": 0.06,
        "note": "repeat interval, descriptive"
      },
      "LAD": {
        "paired_mean": 0.04784772666128599,
        "p2_5": 0.03900490987355383,
        "p97_5": 0.05525625504439068,
        "selection_identical_fraction": 0.0,
        "note": "repeat interval, descriptive"
      },
      "LCX": {
        "paired_mean": -0.0017879978078187975,
        "p2_5": -0.01621357782243333,
        "p97_5": 0.0031603945926196534,
        "selection_identical_fraction": 0.9,
        "note": "repeat interval, descriptive"
      },
      "RCA": {
        "paired_mean": -0.0033950617283950656,
        "p2_5": -0.014976677805625293,
        "p97_5": 3.596955351352073e-05,
        "selection_identical_fraction": 0.92,
        "note": "repeat interval, descriptive"
      }
    },
    "bands_note": "Bands are display categories, not clinical thresholds."
  },
  "imputed": [],
  "warnings": [],
  "oof_estimate": {
    "CAD": 0.10994875422190713,
    "LAD": 0.11787662582692662,
    "LCX": 0.17119019372304056,
    "RCA": 0.12101468188755345
  },
  "oof_estimate_note": "out-of-fold: this patient was held out during nested CV. Main probabilities come from the all-data model (in-sample for this patient).",
  "disclaimer": "Decision support / educational use only. Predictions are per-vessel probabilities from a small single-centre dataset and are not a lesion location. Not a substitute for formal diagnostic imaging or clinical judgement.",
  "limitations": [
    "Single-centre dataset of 303 angiography-referred patients.",
    "Probabilities are mildly overconfident out of sample.",
    "What-if changes show model sensitivity, not treatment effect."
  ]
}
```

---

### 4.2 Example 2: Full Mode with Imputation (`docs/api_examples/full_median_3missing.json`)
```json
{
  "request_id": "1b030bbc-980e-42cf-8bfc-f3a393d3db16",
  "mode": "full",
  "model_version": "ml-v1 (e29ed066fe353a882b917c87f28857f11163cb27)",
  "predictions": {
    "CAD": {
      "raw_probability": 0.5207028314558224,
      "calibrated_probability": 0.8802512159356477,
      "band": "higher",
      "display_probability": 0.8802512159356477,
      "display_band": "higher",
      "adjusted": false,
      "display_note": null,
      "base": 2.165928215249296,
      "contributions": [
        {
          "feature": "Typical Chest Pain",
          "value": true,
          "contribution": 0.8586434092018447,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Atypical",
          "value": false,
          "contribution": 0.46341988823335706,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 52.0,
          "contribution": -0.40219824647995417,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": true,
          "contribution": 0.4014562008735151,
          "direction": "up",
          "stability_tag": "moderate",
          "imputed": false
        },
        {
          "feature": "K",
          "value": 3.7,
          "contribution": -0.3422021625509871,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "FBS",
          "value": 71.0,
          "contribution": -0.30879737437065824,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Region RWMA",
          "value": 0.0,
          "contribution": -0.29324795878468596,
          "direction": "down",
          "stability_tag": "moderate",
          "imputed": true
        },
        {
          "feature": "DM",
          "value": false,
          "contribution": -0.27977107884478647,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Tinversion",
          "value": false,
          "contribution": -0.2648171598140123,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Current Smoker",
          "value": true,
          "contribution": 0.2572309098407102,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        }
      ],
      "other_total": -0.26083338545514884,
      "logit_model": 1.9948112570984895,
      "model_info": {
        "config_name": "full|LR|C=0.001",
        "n_features": 54,
        "features_used": [
          "Age",
          "Weight",
          "Length",
          "Sex",
          "BMI",
          "DM",
          "HTN",
          "Current Smoker",
          "EX-Smoker",
          "FH",
          "Obesity",
          "CRF",
          "CVA",
          "Airway disease",
          "Thyroid Disease",
          "CHF",
          "DLP",
          "BP",
          "PR",
          "Edema",
          "Weak Peripheral Pulse",
          "Lung rales",
          "Systolic Murmur",
          "Diastolic Murmur",
          "Typical Chest Pain",
          "Dyspnea",
          "Function Class",
          "Atypical",
          "Nonanginal",
          "LowTH Ang",
          "Q Wave",
          "St Elevation",
          "St Depression",
          "Tinversion",
          "LVH",
          "Poor R Progression",
          "BBB",
          "FBS",
          "CR",
          "TG",
          "LDL",
          "HDL",
          "BUN",
          "ESR",
          "HB",
          "K",
          "Na",
          "WBC",
          "Lymph",
          "Neut",
          "PLT",
          "EF-TTE",
          "Region RWMA",
          "VHD"
        ],
        "source_space": "auto"
      },
      "base_rate": 0.7128712871287128,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    },
    "LAD": {
      "raw_probability": 0.5065563793677202,
      "calibrated_probability": 0.6465749317225248,
      "band": "higher",
      "display_probability": 0.6465749317225248,
      "display_band": "higher",
      "adjusted": false,
      "display_note": null,
      "base": 0.6170413277557817,
      "contributions": [
        {
          "feature": "Typical Chest Pain",
          "value": true,
          "contribution": 0.4836229575065383,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Atypical",
          "value": false,
          "contribution": 0.25795649542115523,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 52.0,
          "contribution": -0.23180740863811963,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Region RWMA",
          "value": 0.0,
          "contribution": -0.22448336429663993,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": true
        },
        {
          "feature": "BMI",
          "value": 19.257028815517668,
          "contribution": 0.21797446658150543,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Current Smoker",
          "value": true,
          "contribution": 0.19837153462114496,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": true,
          "contribution": 0.1688688774793972,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Tinversion",
          "value": false,
          "contribution": -0.15592358276760723,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "ESR",
          "value": 7.0,
          "contribution": -0.1484229925933593,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "FBS",
          "value": 71.0,
          "contribution": -0.13769553937327425,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        }
      ],
      "other_total": -0.44148516847221836,
      "logit_model": 0.6040176032243041,
      "model_info": {
        "config_name": "full|LR|C=0.001",
        "n_features": 54,
        "features_used": [
          "Age",
          "Weight",
          "Length",
          "Sex",
          "BMI",
          "DM",
          "HTN",
          "Current Smoker",
          "EX-Smoker",
          "FH",
          "Obesity",
          "CRF",
          "CVA",
          "Airway disease",
          "Thyroid Disease",
          "CHF",
          "DLP",
          "BP",
          "PR",
          "Edema",
          "Weak Peripheral Pulse",
          "Lung rales",
          "Systolic Murmur",
          "Diastolic Murmur",
          "Typical Chest Pain",
          "Dyspnea",
          "Function Class",
          "Atypical",
          "Nonanginal",
          "LowTH Ang",
          "Q Wave",
          "St Elevation",
          "St Depression",
          "Tinversion",
          "LVH",
          "Poor R Progression",
          "BBB",
          "FBS",
          "CR",
          "TG",
          "LDL",
          "HDL",
          "BUN",
          "ESR",
          "HB",
          "K",
          "Na",
          "WBC",
          "Lymph",
          "Neut",
          "PLT",
          "EF-TTE",
          "Region RWMA",
          "VHD"
        ],
        "source_space": "auto"
      },
      "base_rate": 0.5841584158415841,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    },
    "LCX": {
      "raw_probability": 0.54893072060151,
      "calibrated_probability": 0.45793940409445355,
      "band": "intermediate",
      "display_probability": 0.45793940409445355,
      "display_band": "intermediate",
      "adjusted": false,
      "display_note": null,
      "base": -0.5279177207382921,
      "contributions": [
        {
          "feature": "Typical Chest Pain",
          "value": true,
          "contribution": 0.44045602444924037,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 52.0,
          "contribution": -0.3591027981017214,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Sex",
          "value": "Male",
          "contribution": 0.23265514032589465,
          "direction": "up",
          "stability_tag": "moderate",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": true,
          "contribution": 0.17298091211932456,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "DM",
          "value": false,
          "contribution": -0.16319982588848367,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Atypical",
          "value": false,
          "contribution": 0.019706965537204857,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Nonanginal",
          "value": false,
          "contribution": 0.015780376433083495,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        }
      ],
      "other_total": 0.0,
      "logit_model": -0.16864092586374924,
      "model_info": {
        "config_name": "compact|LR|C=0.03",
        "n_features": 7,
        "features_used": [
          "Age",
          "Sex",
          "Typical Chest Pain",
          "Atypical",
          "Nonanginal",
          "DM",
          "HTN"
        ],
        "source_space": "auto"
      },
      "base_rate": 0.3927392739273927,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    },
    "RCA": {
      "raw_probability": 0.5094675303700341,
      "calibrated_probability": 0.4808776498873944,
      "band": "intermediate",
      "display_probability": 0.4808776498873944,
      "display_band": "intermediate",
      "adjusted": false,
      "display_note": null,
      "base": -0.6676863976369516,
      "contributions": [
        {
          "feature": "Typical Chest Pain",
          "value": true,
          "contribution": 0.43719081331269755,
          "direction": "up",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "DM",
          "value": false,
          "contribution": -0.29807535557783593,
          "direction": "down",
          "stability_tag": "stable",
          "imputed": false
        },
        {
          "feature": "Atypical",
          "value": false,
          "contribution": 0.254542484977054,
          "direction": "up",
          "stability_tag": "moderate",
          "imputed": false
        },
        {
          "feature": "Age",
          "value": 52.0,
          "contribution": -0.2479859051132228,
          "direction": "down",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "HTN",
          "value": true,
          "contribution": 0.1988025317605864,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Sex",
          "value": "Male",
          "contribution": 0.18573664047759966,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        },
        {
          "feature": "Nonanginal",
          "value": false,
          "contribution": 0.060948461999562394,
          "direction": "up",
          "stability_tag": "unstable",
          "imputed": false
        }
      ],
      "other_total": 0.0,
      "logit_model": -0.07652672580051012,
      "model_info": {
        "config_name": "compact|LR|C=0.001",
        "n_features": 7,
        "features_used": [
          "Age",
          "Sex",
          "Typical Chest Pain",
          "Atypical",
          "Nonanginal",
          "DM",
          "HTN"
        ],
        "source_space": "auto"
      },
      "base_rate": 0.37623762376237624,
      "base_rate_note": "dataset average (angiography-referred patients); not a population prevalence"
    }
  },
  "consistency": {
    "status": "ok",
    "lower": 0.6465749317225248,
    "upper": 1.0,
    "p_cad_model": 0.8802512159356477,
    "p_cad_adjusted": 0.8802512159356477
  },
  "trust": {
    "similar_patients": [
      {
        "case_id": 95,
        "distance": 4.4863,
        "age_band": "45-49",
        "sex": "M",
        "outcomes": {
          "CAD": 1,
          "LAD": 1,
          "LCX": 1,
          "RCA": 0
        }
      },
      {
        "case_id": 2,
        "distance": 4.5733,
        "age_band": "50-54",
        "sex": "M",
        "outcomes": {
          "CAD": 1,
          "LAD": 1,
          "LCX": 0,
          "RCA": 0
        }
      },
      {
        "case_id": 5,
        "distance": 4.7981,
        "age_band": "50-54",
        "sex": "M",
        "outcomes": {
          "CAD": 1,
          "LAD": 1,
          "LCX": 1,
          "RCA": 1
        }
      },
      {
        "case_id": 90,
        "distance": 4.804,
        "age_band": "55-59",
        "sex": "M",
        "outcomes": {
          "CAD": 1,
          "LAD": 0,
          "LCX": 1,
          "RCA": 1
        }
      },
      {
        "case_id": 262,
        "distance": 4.9834,
        "age_band": "55-59",
        "sex": "M",
        "outcomes": {
          "CAD": 1,
          "LAD": 1,
          "LCX": 0,
          "RCA": 0
        }
      }
    ],
    "evidence_estimate": {
      "CAD": 0.8,
      "LAD": 0.7333333333333333,
      "LCX": 0.5333333333333333,
      "RCA": 0.4666666666666667
    },
    "evidence_auc": {
      "CAD": 0.8961792252022135,
      "LAD": 0.8070352434759215,
      "LCX": 0.6649616368286446,
      "RCA": 0.7256335282651072
    },
    "lift": {
      "CAD": {
        "paired_mean": 0.02572105151128139,
        "p2_5": 0.013330140485312763,
        "p97_5": 0.030738479140059737,
        "selection_identical_fraction": 0.06,
        "note": "repeat interval, descriptive"
      },
      "LAD": {
        "paired_mean": 0.04784772666128599,
        "p2_5": 0.03900490987355383,
        "p97_5": 0.05525625504439068,
        "selection_identical_fraction": 0.0,
        "note": "repeat interval, descriptive"
      },
      "LCX": {
        "paired_mean": -0.0017879978078187975,
        "p2_5": -0.01621357782243333,
        "p97_5": 0.0031603945926196534,
        "selection_identical_fraction": 0.9,
        "note": "repeat interval, descriptive"
      },
      "RCA": {
        "paired_mean": -0.0033950617283950656,
        "p2_5": -0.014976677805625293,
        "p97_5": 3.596955351352073e-05,
        "selection_identical_fraction": 0.92,
        "note": "repeat interval, descriptive"
      }
    },
    "bands_note": "Bands are display categories, not clinical thresholds."
  },
  "imputed": [
    "LDL",
    "EF-TTE",
    "Region RWMA"
  ],
  "warnings": [
    {
      "code": "important_feature_imputed",
      "message": "Missing value was filled with the training median/most frequent value; this feature matters for this target.",
      "feature": "Region RWMA",
      "target": "LAD",
      "value": null,
      "min": null,
      "max": null
    }
  ],
  "oof_estimate": {
    "CAD": 0.9025822204831353,
    "LAD": 0.6773340302146205,
    "LCX": 0.45975447106463657,
    "RCA": 0.4297055210898456
  },
  "oof_estimate_note": "out-of-fold: this patient was held out during nested CV. Main probabilities come from the all-data model (in-sample for this patient).",
  "disclaimer": "Decision support / educational use only. Predictions are per-vessel probabilities from a small single-centre dataset and are not a lesion location. Not a substitute for formal diagnostic imaging or clinical judgement.",
  "limitations": [
    "Single-centre dataset of 303 angiography-referred patients.",
    "Probabilities are mildly overconfident out of sample.",
    "What-if changes show model sensitivity, not treatment effect."
  ]
}
```
