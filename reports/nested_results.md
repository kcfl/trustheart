# TrustHeart 3D - Step 3: Nested Cross-Validation & Calibration Results

- **Timestamp (UTC)**: 2026-10-13T22:00:03.815568+00:00
- **Git Commit**: `ba9f7f6d289210aff22246a8e0dc8705a06e3750` (dirty: True)
- **Outer CV**: 5 repeats × 5 folds = 25 outer folds
- **Inner CV**: 2 repeats × 3 folds = 6 inner folds per candidate config
- **Calibration Protocol**: 5-fold stratified Platt scaling on outer-train
- **Elapsed Execution Time**: 428.14 seconds (7.14 min)

---

## 1. Nested Evaluation Performance by Space & Target

Metrics reported as **Mean ± Std** over outer repeats.

### Search Space: `AUTO`

| Target | Prediction | ROC-AUC | PR-AUC | Brier Score | ECE (5 Bins) | Calib Intercept | Calib Slope |
|---|---|---|---|---|---|---|---|
| **CAD** | Raw | 0.9241 ± 0.0058 | 0.9678 ± 0.0031 | 0.1335 ± 0.0020 | 0.1664 ± 0.0126 | 0.9322 ± 0.0415 | 2.5436 ± 0.2227 |
| **CAD** | **Platt Calibrated** | **0.9238 ± 0.0041** | 0.9674 ± 0.0028 | **0.0966 ± 0.0018** | **0.0204 ± 0.0063** | 0.1266 ± 0.0449 | 0.9011 ± 0.0273 |
| **LAD** | Raw | 0.8308 ± 0.0061 | 0.8669 ± 0.0049 | 0.1733 ± 0.0019 | 0.1078 ± 0.0104 | 0.2307 ± 0.0371 | 1.8190 ± 0.0977 |
| **LAD** | **Platt Calibrated** | **0.8303 ± 0.0064** | 0.8668 ± 0.0054 | **0.1614 ± 0.0031** | **0.0468 ± 0.0143** | 0.0269 ± 0.0224 | 0.8936 ± 0.0493 |
| **LCX** | Raw | 0.7313 ± 0.0053 | 0.6028 ± 0.0111 | 0.2130 ± 0.0037 | 0.0907 ± 0.0040 | -0.4211 ± 0.0127 | 1.3916 ± 0.3009 |
| **LCX** | **Platt Calibrated** | **0.7372 ± 0.0057** | 0.6059 ± 0.0110 | **0.2009 ± 0.0017** | **0.0347 ± 0.0054** | -0.0241 ± 0.0232 | 0.9410 ± 0.0330 |
| **RCA** | Raw | 0.7411 ± 0.0076 | 0.6118 ± 0.0176 | 0.2132 ± 0.0016 | 0.1157 ± 0.0054 | -0.5137 ± 0.0070 | 2.0802 ± 0.1654 |
| **RCA** | **Platt Calibrated** | **0.7375 ± 0.0093** | 0.6007 ± 0.0225 | **0.1978 ± 0.0035** | **0.0606 ± 0.0113** | -0.0524 ± 0.0305 | 0.8901 ± 0.0512 |

### Search Space: `QUICK`

| Target | Prediction | ROC-AUC | PR-AUC | Brier Score | ECE (5 Bins) | Calib Intercept | Calib Slope |
|---|---|---|---|---|---|---|---|
| **CAD** | Raw | 0.8997 ± 0.0027 | 0.9508 ± 0.0030 | 0.1539 ± 0.0006 | 0.2050 ± 0.0080 | 0.9355 ± 0.0075 | 2.6543 ± 0.0485 |
| **CAD** | **Platt Calibrated** | **0.8981 ± 0.0037** | 0.9490 ± 0.0046 | **0.1081 ± 0.0017** | **0.0262 ± 0.0043** | 0.1144 ± 0.0147 | 0.8742 ± 0.0291 |
| **LAD** | Raw | 0.7903 ± 0.0029 | 0.8080 ± 0.0062 | 0.1953 ± 0.0020 | 0.1411 ± 0.0056 | 0.3176 ± 0.0062 | 2.1239 ± 0.0561 |
| **LAD** | **Platt Calibrated** | **0.7872 ± 0.0017** | 0.8040 ± 0.0074 | **0.1762 ± 0.0014** | **0.0503 ± 0.0128** | 0.0433 ± 0.0119 | 0.8916 ± 0.0227 |
| **LCX** | Raw | 0.7310 ± 0.0056 | 0.5990 ± 0.0132 | 0.2132 ± 0.0038 | 0.0907 ± 0.0039 | -0.4189 ± 0.0116 | 1.4352 ± 0.2798 |
| **LCX** | **Platt Calibrated** | **0.7367 ± 0.0060** | 0.6053 ± 0.0112 | **0.2010 ± 0.0018** | **0.0347 ± 0.0053** | -0.0243 ± 0.0232 | 0.9388 ± 0.0335 |
| **RCA** | Raw | 0.7422 ± 0.0049 | 0.6096 ± 0.0137 | 0.2143 ± 0.0006 | 0.1160 ± 0.0076 | -0.5094 ± 0.0091 | 2.1885 ± 0.0664 |
| **RCA** | **Platt Calibrated** | **0.7402 ± 0.0051** | 0.6030 ± 0.0185 | **0.1974 ± 0.0024** | **0.0572 ± 0.0148** | -0.0502 ± 0.0240 | 0.8859 ± 0.0496 |

---

## 2. Model Selection Distribution Across Outer Folds

| Search Space | Target | Compact Share (%) | Full Share (%) | Top Selected Configurations (Count / Total) |
|---|---|---|---|---|
| `auto` | **CAD** | 12.0% | 88.0% | `full|LR|C=0.01` (22/25), `compact|LR|C=0.01` (2/25), `compact|LR|C=0.03` (1/25) |
| `auto` | **LAD** | 0.0% | 100.0% | `full|LR|C=0.01` (16/25), `full|RF|leaf=5|feat=sqrt` (8/25), `full|RF|leaf=5|feat=0.3` (1/25) |
| `auto` | **LCX** | 100.0% | 0.0% | `compact|LR|C=0.01` (12/25), `compact|LR|C=0.1` (6/25), `compact|LR|C=0.03` (5/25) |
| `auto` | **RCA** | 96.0% | 4.0% | `compact|LR|C=0.01` (22/25), `compact|LR|C=0.03` (2/25), `full|LR|C=0.01` (1/25) |
| `quick` | **CAD** | 100.0% | 0.0% | `compact|LR|C=0.01` (25/25) |
| `quick` | **LAD** | 100.0% | 0.0% | `compact|LR|C=0.01` (24/25), `compact|LR|C=0.03` (1/25) |
| `quick` | **LCX** | 100.0% | 0.0% | `compact|LR|C=0.01` (12/25), `compact|LR|C=0.1` (6/25), `compact|LR|C=0.03` (6/25) |
| `quick` | **RCA** | 100.0% | 0.0% | `compact|LR|C=0.01` (25/25) |

---

## 3. Comparison: Nested Auto (Tuned + Calibrated) vs Step 2 Best Fixed Baseline

| Target | Best Step 2 Combo | Step 2 Baseline AUC | Nested Auto Calibrated AUC | AUC Difference (Nested - Step 2) |
|---|---|---|---|---|
| **CAD** | `full|LR|CAD` | 0.9240 ± 0.0030 | 0.9238 ± 0.0041 | **-0.0002** |
| **LAD** | `full|RF|LAD` | 0.8487 ± 0.0085 | 0.8303 ± 0.0064 | **-0.0184** |
| **LCX** | `compact|LR|LCX` | 0.7426 ± 0.0083 | 0.7372 ± 0.0057 | **-0.0054** |
| **RCA** | `compact|LR|RCA` | 0.7449 ± 0.0047 | 0.7375 ± 0.0093 | **-0.0074** |
