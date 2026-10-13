# TrustHeart 3D - Step 5: Nested Cross-Validation & Calibration Results

- **Timestamp (UTC)**: 2026-10-13T23:40:44.419948+00:00
- **Git Commit**: `e29ed066fe353a882b917c87f28857f11163cb27` (dirty: False)
- **Outer CV**: 10 repeats × 5 folds = 50 outer folds
- **Inner CV**: 2 repeats × 3 folds = 6 inner folds per candidate config
- **Calibration Protocol**: 5-fold stratified Platt scaling on outer-train
- **Elapsed Execution Time**: 852.14 seconds (14.20 min)

---

## 1. Nested Evaluation Performance by Space & Target

Metrics reported as **Mean ± Std** over outer repeats.

### Search Space: `AUTO`

| Target | Prediction | ROC-AUC | PR-AUC | Brier Score | ECE (5 Bins) | Calib Intercept | Calib Slope |
|---|---|---|---|---|---|---|---|
| **CAD** | Raw | 0.9200 ± 0.0154 | 0.9643 ± 0.0118 | 0.2081 ± 0.0057 | 0.2891 ± 0.0253 | 0.9451 ± 0.0644 | 10.0871 ± 3.9444 |
| **CAD** | **Platt Calibrated** | **0.9237 ± 0.0064** | 0.9681 ± 0.0037 | **0.0978 ± 0.0031** | **0.0283 ± 0.0078** | 0.1846 ± 0.0375 | 0.8373 ± 0.0266 |
| **LAD** | Raw | 0.8240 ± 0.0127 | 0.8443 ± 0.0140 | 0.2110 ± 0.0038 | 0.1969 ± 0.0148 | 0.2471 ± 0.0352 | 3.9123 ± 1.1657 |
| **LAD** | **Platt Calibrated** | **0.8364 ± 0.0044** | 0.8734 ± 0.0057 | **0.1598 ± 0.0021** | **0.0494 ± 0.0099** | 0.0524 ± 0.0316 | 0.8368 ± 0.0353 |
| **LCX** | Raw | 0.7108 ± 0.0143 | 0.5912 ± 0.0251 | 0.2221 ± 0.0082 | 0.1005 ± 0.0136 | -0.4118 ± 0.0187 | 1.3560 ± 0.2866 |
| **LCX** | **Platt Calibrated** | **0.7260 ± 0.0115** | 0.5942 ± 0.0209 | **0.2049 ± 0.0045** | **0.0455 ± 0.0083** | -0.0545 ± 0.0272 | 0.8557 ± 0.0702 |
| **RCA** | Raw | 0.7300 ± 0.0119 | 0.5921 ± 0.0247 | 0.2389 ± 0.0033 | 0.1632 ± 0.0141 | -0.5123 ± 0.0165 | 8.2550 ± 4.2765 |
| **RCA** | **Platt Calibrated** | **0.7357 ± 0.0072** | 0.6069 ± 0.0173 | **0.1997 ± 0.0027** | **0.0716 ± 0.0098** | -0.0933 ± 0.0181 | 0.8204 ± 0.0290 |

### Search Space: `QUICK`

| Target | Prediction | ROC-AUC | PR-AUC | Brier Score | ECE (5 Bins) | Calib Intercept | Calib Slope |
|---|---|---|---|---|---|---|---|
| **CAD** | Raw | 0.8994 ± 0.0023 | 0.9509 ± 0.0020 | 0.2234 ± 0.0047 | 0.3143 ± 0.0128 | 0.9420 ± 0.0320 | 13.3514 ± 1.7485 |
| **CAD** | **Platt Calibrated** | **0.8979 ± 0.0030** | 0.9500 ± 0.0029 | **0.1101 ± 0.0014** | **0.0392 ± 0.0028** | 0.1778 ± 0.0142 | 0.8115 ± 0.0194 |
| **LAD** | Raw | 0.7905 ± 0.0031 | 0.8059 ± 0.0052 | 0.2346 ± 0.0052 | 0.2239 ± 0.0100 | 0.3055 ± 0.0085 | 10.8379 ± 1.9087 |
| **LAD** | **Platt Calibrated** | **0.7885 ± 0.0036** | 0.8026 ± 0.0060 | **0.1765 ± 0.0019** | **0.0576 ± 0.0087** | 0.0616 ± 0.0094 | 0.8151 ± 0.0175 |
| **LCX** | Raw | 0.7108 ± 0.0135 | 0.5895 ± 0.0222 | 0.2234 ± 0.0077 | 0.1033 ± 0.0135 | -0.4201 ± 0.0198 | 1.4660 ± 0.3174 |
| **LCX** | **Platt Calibrated** | **0.7278 ± 0.0083** | 0.5984 ± 0.0139 | **0.2042 ± 0.0030** | **0.0460 ± 0.0075** | -0.0536 ± 0.0254 | 0.8633 ± 0.0547 |
| **RCA** | Raw | 0.7346 ± 0.0111 | 0.5974 ± 0.0263 | 0.2400 ± 0.0024 | 0.1678 ± 0.0105 | -0.5143 ± 0.0112 | 9.5787 ± 3.9417 |
| **RCA** | **Platt Calibrated** | **0.7391 ± 0.0039** | 0.6091 ± 0.0144 | **0.1986 ± 0.0019** | **0.0664 ± 0.0107** | -0.0878 ± 0.0130 | 0.8276 ± 0.0284 |

---

## 2. Model Selection Distribution Across Outer Folds

| Search Space | Target | Compact Share (%) | Full Share (%) | Top Selected Configurations (Count / Total) |
|---|---|---|---|---|
| `auto` | **CAD** | 10.0% | 90.0% | `full|LR|C=0.001` (44/50), `compact|LR|C=0.001` (3/50), `full|LR|C=0.003` (1/50) |
| `auto` | **LAD** | 0.0% | 100.0% | `full|LR|C=0.001` (37/50), `full|RF|leaf=5|feat=sqrt` (12/50), `full|RF|leaf=5|feat=0.3` (1/50) |
| `auto` | **LCX** | 98.0% | 2.0% | `compact|LR|C=0.001` (19/50), `compact|LR|C=0.1` (11/50), `compact|LR|C=0.03` (11/50) |
| `auto` | **RCA** | 94.0% | 6.0% | `compact|LR|C=0.001` (43/50), `compact|LR|C=0.01` (3/50), `full|LR|C=0.001` (3/50) |
| `quick` | **CAD** | 100.0% | 0.0% | `compact|LR|C=0.001` (49/50), `compact|LR|C=0.01` (1/50) |
| `quick` | **LAD** | 100.0% | 0.0% | `compact|LR|C=0.001` (49/50), `compact|LR|C=0.03` (1/50) |
| `quick` | **LCX** | 100.0% | 0.0% | `compact|LR|C=0.001` (21/50), `compact|LR|C=0.03` (12/50), `compact|LR|C=0.1` (11/50) |
| `quick` | **RCA** | 100.0% | 0.0% | `compact|LR|C=0.001` (47/50), `compact|LR|C=0.01` (3/50) |

---

## 3. Comparison: Nested Auto (Tuned + Calibrated) vs Step 2 Best Fixed Baseline

| Target | Best Step 2 Combo | Step 2 Baseline AUC | Nested Auto Calibrated AUC | AUC Difference (Nested - Step 2) |
|---|---|---|---|---|
| **CAD** | `full|LR|CAD` | 0.9240 ± 0.0030 | 0.9237 ± 0.0064 | **-0.0003** |
| **LAD** | `full|RF|LAD` | 0.8487 ± 0.0085 | 0.8364 ± 0.0044 | **-0.0123** |
| **LCX** | `compact|LR|LCX` | 0.7426 ± 0.0083 | 0.7260 ± 0.0115 | **-0.0166** |
| **RCA** | `compact|LR|RCA` | 0.7449 ± 0.0047 | 0.7357 ± 0.0072 | **-0.0092** |
