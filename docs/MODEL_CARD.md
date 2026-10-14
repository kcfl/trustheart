# TrustHeart 3D - Model Card

> **Clinical Disclaimer**: Decision support and educational demonstration only. Not a substitute for coronary angiography, diagnostic imaging, or formal clinical judgement. Predictions represent statistical probabilities from a small single-centre dataset, not anatomical lesion locations.

---

## 1. Intended Use
- **Domain**: Cardiovascular risk assessment and vessel-specific coronary artery stenosis evaluation.
- **Task**: Multi-target binary classification of overall coronary artery disease (CAD) and vessel-specific stenosis (LAD, LCX, RCA) with stenosis threshold $\ge 50\%$.
- **Operating Modes**:
  - **Auto / Full Mode**: Uses the full 54 human-interpretable clinical features (demographics, history, symptoms, exam, ECG, laboratory findings, echocardiography), selecting the simplest model within 1 SE of the best cross-validated AUC.
  - **Quick Mode**: Requires only 7 bedside clinical features (`Age`, `Sex`, `Typical Chest Pain`, `Atypical`, `Nonanginal`, `DM`, `HTN`).
- **Intended Users**: Healthcare researchers, educational demonstrations, and clinical decision support study settings.
- **Out-of-Scope Use**: Emergency department triage, acute coronary syndrome definitive diagnosis, replacing invasive coronary catheterization or computed tomography angiography.

---

## 2. Dataset & Cohort Characteristics
- **Source**: Extension of Z-Alizadeh Sani Dataset (UCI Machine Learning Repository ID 411, DOI: 10.24432/C5461K).
- **Dimensions**: 303 patients, 59 raw attributes.
- **Demographics**: Age range 30 to 86 years (mean: 58.9 years); Sex: 176 Male, 127 Female.
- **Target Counts & Dataset Prevalences** (angiography-referred cohort):
  - **CAD**: 216 positive (71.29%), 87 normal (28.71%).
  - **LAD**: 177 positive (58.42%), 126 normal (41.58%).
  - **LCX**: 119 positive (39.27%), 184 normal (60.73%).
  - **RCA**: 114 positive (37.62%), 189 normal (62.38%).

---

## 3. Model Architecture & Selection Rule
- **Selection Rule**: 1-Standard-Error (1-SE) simplicity heuristic evaluated across 10-repeat 5-fold nested cross-validation.
- **Final Selected Production Models** (all-data fit on 303 samples):

| Mode | Target | Configuration | Space | Features | Platt Slope ($a$) | Platt Intercept ($b$) |
|---|---|---|---|---|---|---|
| `auto` | **CAD** | `full|LR|C=0.001` | `full` | 55 | 12.3628 | 0.9704 |
| `quick` | **CAD** | `compact|LR|C=0.001` | `compact` | 7 | 13.7899 | 0.9356 |
| `auto` | **LAD** | `full|LR|C=0.001` | `full` | 55 | 8.9140 | 0.3702 |
| `quick` | **LAD** | `compact|LR|C=0.001` | `compact` | 7 | 11.4114 | 0.2925 |
| `auto` | **LCX** | `compact|LR|C=0.03` | `compact` | 7 | 1.3056 | -0.4250 |
| `quick` | **LCX** | `compact|LR|C=0.03` | `compact` | 7 | 1.3056 | -0.4250 |
| `auto` | **RCA** | `compact|LR|C=0.001` | `compact` | 7 | 11.9557 | -0.5293 |
| `quick` | **RCA** | `compact|LR|C=0.001` | `compact` | 7 | 11.9557 | -0.5293 |

- **Key Selection Finding**: For LCX and RCA, the 1-SE rule chose the 7-feature compact model even in the full search space, preventing overparameterization on secondary vessel targets.

---

## 4. Nested Cross-Validation Performance (Auto vs Quick)
Evaluated over 10 repeats × 5 folds nested CV (50 out-of-fold evaluations):

| Target | Mode | ROC-AUC (Mean ± Std) | PR-AUC (Mean ± Std) | Brier Score (Mean ± Std) | Expected Calibration Error (ECE) |
|---|---|---|---|---|---|
| **CAD** | Auto | 0.9237 ± 0.0064 | 0.9681 ± 0.0037 | 0.0978 ± 0.0031 | 0.0283 ± 0.0078 |
| **CAD** | Quick | 0.8979 ± 0.0030 | 0.9500 ± 0.0029 | 0.1101 ± 0.0014 | 0.0392 ± 0.0028 |
| **LAD** | Auto | 0.8364 ± 0.0044 | 0.8734 ± 0.0057 | 0.1598 ± 0.0021 | 0.0494 ± 0.0099 |
| **LAD** | Quick | 0.7885 ± 0.0036 | 0.8026 ± 0.0060 | 0.1765 ± 0.0019 | 0.0576 ± 0.0087 |
| **LCX** | Auto | 0.7260 ± 0.0115 | 0.5942 ± 0.0209 | 0.2049 ± 0.0045 | 0.0455 ± 0.0083 |
| **LCX** | Quick | 0.7278 ± 0.0083 | 0.5984 ± 0.0139 | 0.2042 ± 0.0030 | 0.0460 ± 0.0075 |
| **RCA** | Auto | 0.7357 ± 0.0072 | 0.6069 ± 0.0173 | 0.1997 ± 0.0027 | 0.0716 ± 0.0098 |
| **RCA** | Quick | 0.7391 ± 0.0039 | 0.6091 ± 0.0144 | 0.1986 ± 0.0019 | 0.0664 ± 0.0107 |

---

## 5. Calibration
- **Method**: Post-hoc Platt scaling ($P = 1 / (1 + \exp(-(a \cdot \text{logit} + b)))$) fitted with 6 inner folds.
- **Calibration Parameters**:
  - `auto` **CAD**: Slope $a = 12.3628$, Intercept $b = 0.9704$.
  - `quick` **CAD**: Slope $a = 13.7899$, Intercept $b = 0.9356$.
  - `auto` **LAD**: Slope $a = 8.9140$, Intercept $b = 0.3702$.
  - `quick` **LAD**: Slope $a = 11.4114$, Intercept $b = 0.2925$.
  - `auto` **LCX**: Slope $a = 1.3056$, Intercept $b = -0.4250$.
  - `quick` **LCX**: Slope $a = 1.3056$, Intercept $b = -0.4250$.
  - `auto` **RCA**: Slope $a = 11.9557$, Intercept $b = -0.5293$.
  - `quick` **RCA**: Slope $a = 11.9557$, Intercept $b = -0.5293$.
- **Nested CV Calibration Slopes & Intercepts** (Auto Mode):
  - **CAD**: Slope = 0.8373 ± 0.0266, Intercept = 0.1846 ± 0.0375.
  - **LAD**: Slope = 0.8368 ± 0.0353, Intercept = 0.0524 ± 0.0316.
  - **LCX**: Slope = 0.8557 ± 0.0702, Intercept = -0.0545 ± 0.0272.
  - **RCA**: Slope = 0.8204 ± 0.0290, Intercept = -0.0933 ± 0.0181.

---

## 6. Paired Lift (Full Feature Set over Quick Mode)
Paired difference in nested-CV ROC-AUC across 10 evaluation repeats:

| Target | Paired Mean AUC Diff | 95% Repeat Interval [p2.5, p97.5] | Note | Selection Identical Fraction |
|---|---|---|---|---|
| **CAD** | +0.0257 | [+0.0133, +0.0307] | repeat interval, descriptive | 0.06 |
| **LAD** | +0.0478 | [+0.0390, +0.0553] | repeat interval, descriptive | 0.00 |
| **LCX** | -0.0018 | [-0.0162, +0.0032] | repeat interval, descriptive | 0.90 |
| **RCA** | -0.0034 | [-0.0150, +0.0000] | repeat interval, descriptive | 0.92 |

> **Note**: Intervals over repeats are descriptive, not statistical hypothesis tests. In LCX and RCA, the identical selection fraction is 90% and 92%, respectively, because the 1-SE rule consistently chooses the compact model across CV repeats.

---

## 7. Joint Coherence & Fréchet Bounds Violation Rates
Under the dataset definition $\text{CAD} = \text{OR}(\text{LAD}, \text{LCX}, \text{RCA})$, biological validity requires:
$$\max(P(\text{LAD}), P(\text{LCX}), P(\text{RCA})) \le P(\text{CAD}) \le \min(1.0, P(\text{LAD}) + P(\text{LCX}) + P(\text{RCA}))$$

- **Violation Rates Across 10 Nested CV Repeats**:
  - **Auto Mode**: Lower bound violations = 22.71% ± 2.37%; Upper bound violations = 0.96% ± 0.90%; Coherent predictions = 76.34% ± 2.52%.
  - **Quick Mode**: Lower bound violations = 15.91% ± 1.06%; Upper bound violations = 0.00% ± 0.00%; Coherent predictions = 84.09% ± 1.06%.
- **Effect of Coherence Clipping Adjustment**:
  - Auto CAD ROC-AUC: 0.9237 → 0.9258 ($\Delta = +0.0021$).
  - Auto CAD Brier Score: 0.0978 → 0.0948 ($\Delta = -0.0030$).

---

## 8. Stability Rule Revision: v1 to v2
- **Post-hoc Revision Statement**: In initial prototyping (v1), feature stability was evaluated using a fixed Top-5 frequency cutoff across all models. In the 7-feature compact space, selecting 5 of 7 features trivialized the ranking and classified unstable lower-importance features as stable. As a documented post-hoc methodological revision (rule v2):
  - **7-Feature Compact Models**: Evaluated with a **Top-3** cutoff.
  - **54-Feature Full Models**: Evaluated with a **Top-5** cutoff.
  - **Stability Thresholds**: Tagged **STABLE** if top-K frequency $\ge 80\%$ and sign consistency $\ge 90\%$; **MODERATE** if frequency $\ge 50\%$; **UNSTABLE** otherwise.

---

## 9. Limitations & Clinical Considerations
1. **Single-Centre Cohort**: Trained exclusively on 303 patients from Shaheed Rajaei Cardiovascular, Medical and Research Center (Tehran, Iran). Generalizability across diverse international demographics and referral patterns is unverified.
2. **Angiography-Referred Population**: All patients were referred for invasive coronary catheterization (dataset CAD prevalence is 71.29%). Baseline risk is substantially higher than the asymptomatic general outpatient screening population.
3. **Per-Vessel Probability vs. Anatomical Lesion Location**: Outputs represent statistical likelihood of stenosis $\ge 50\%$ somewhere in the vessel, not lesion coordinates, stenosis severity percentage, bifurcation involvement, or fractional flow reserve (FFR).
4. **Mild Out-of-Sample Overconfidence**: Platt-calibrated models show slight slope attenuation on held-out folds (slope $\approx 0.84$), indicating mild overconfidence at probability extremes.
5. **What-If Sensitivity vs. Treatment Effect**: Counterfactual slider adjustments reflect the mathematical gradient of the model given static historical correlations, NOT the expected biological or therapeutic outcome of clinical interventions.
6. **Imputed Feature Linear Contributions**: Missing clinical inputs are imputed with training medians. Because standard scaler normalizes features by their training mean ($z = (x - \mu) / \sigma$), when the training median differs from the training mean, $(x_{\text{median}} - \mu) / \sigma \ne 0$, producing non-zero contributions for imputed variables. These are transparently flagged as `imputed: true` in the API.
7. **CAD Raised by Vessel Bounds**: In Full mode, CAD uses 54 features while LCX and RCA use 7-feature compact models. For low-risk clinical presentations where multi-variable biomarkers depress CAD logit but standard symptoms keep compact LCX/RCA probabilities elevated, Fréchet lower bound enforcement raises overall CAD probability to match the highest single-vessel risk.

