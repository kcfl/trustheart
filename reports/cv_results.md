# TrustHeart 3D - Cross-Validation Evaluation Results

- **Timestamp (UTC)**: 2026-10-13T21:27:11.851817+00:00
- **Git Commit**: `d9ee21556fe677628dacdf671f64bb866e63d55e`
- **Evaluation Protocol**: 10 repeats × 5 folds Stratified CV (50 folds per combo)
- **Decision Threshold**: 0.5
- **Features**: Compact (7) vs Full (55)
- **Total Elapsed Time**: 49.94 seconds

---

## Performance by Target

### Target: **CAD**

| Feature Set | Model | ROC-AUC (Mean ± Std) | Fold 95% Interval | PR-AUC (Mean ± Std) | Brier (Mean ± Std) | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|---|---|
| Compact | LR | 0.9012 ± 0.0031 | [0.8333, 0.9778] | 0.9508 ± 0.0025 | 0.1223 ± 0.0010 | 0.8370 ± 0.0039 | 0.9272 ± 0.0056 | 0.8370 ± 0.0048 | 0.8798 ± 0.0028 |
| Compact | RF | 0.8838 ± 0.0056 | [0.8098, 0.9649] | 0.9353 ± 0.0068 | 0.1161 ± 0.0027 | 0.8604 ± 0.0114 | 0.9232 ± 0.0121 | 0.8773 ± 0.0105 | 0.8996 ± 0.0081 |
| Full | LR | 0.9240 ± 0.0030 | [0.8595, 0.9695] | 0.9680 ± 0.0013 | 0.1066 ± 0.0034 | 0.8531 ± 0.0110 | 0.9355 ± 0.0062 | 0.8528 ± 0.0132 | 0.8922 ± 0.0086 |
| Full | RF | 0.9232 ± 0.0046 | [0.8628, 0.9699] | 0.9648 ± 0.0034 | 0.1115 ± 0.0023 | 0.8683 ± 0.0053 | 0.8857 ± 0.0044 | 0.9361 ± 0.0043 | 0.9102 ± 0.0036 |

### Target: **LAD**

| Feature Set | Model | ROC-AUC (Mean ± Std) | Fold 95% Interval | PR-AUC (Mean ± Std) | Brier (Mean ± Std) | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|---|---|
| Compact | LR | 0.7895 ± 0.0034 | [0.7175, 0.8663] | 0.8079 ± 0.0050 | 0.1814 ± 0.0018 | 0.7498 ± 0.0143 | 0.7875 ± 0.0109 | 0.7831 ± 0.0165 | 0.7852 ± 0.0130 |
| Compact | RF | 0.7650 ± 0.0084 | [0.6435, 0.8497] | 0.7650 ± 0.0154 | 0.1904 ± 0.0041 | 0.7459 ± 0.0165 | 0.7725 ± 0.0154 | 0.8011 ± 0.0199 | 0.7864 ± 0.0143 |
| Full | LR | 0.8185 ± 0.0080 | [0.7490, 0.8963] | 0.8565 ± 0.0083 | 0.1762 ± 0.0042 | 0.7248 ± 0.0163 | 0.7865 ± 0.0159 | 0.7260 ± 0.0210 | 0.7549 ± 0.0156 |
| Full | RF | 0.8487 ± 0.0085 | [0.7832, 0.9330] | 0.8822 ± 0.0093 | 0.1643 ± 0.0029 | 0.7868 ± 0.0084 | 0.7834 ± 0.0102 | 0.8780 ± 0.0141 | 0.8279 ± 0.0067 |

### Target: **LCX**

| Feature Set | Model | ROC-AUC (Mean ± Std) | Fold 95% Interval | PR-AUC (Mean ± Std) | Brier (Mean ± Std) | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|---|---|
| Compact | LR | 0.7426 ± 0.0083 | [0.6672, 0.8600] | 0.6157 ± 0.0122 | 0.2061 ± 0.0027 | 0.6710 ± 0.0102 | 0.5659 ± 0.0101 | 0.6958 ± 0.0193 | 0.6241 ± 0.0135 |
| Compact | RF | 0.6960 ± 0.0148 | [0.6048, 0.8318] | 0.5924 ± 0.0189 | 0.2226 ± 0.0058 | 0.6333 ± 0.0095 | 0.5312 ± 0.0114 | 0.5647 ± 0.0265 | 0.5472 ± 0.0160 |
| Full | LR | 0.6682 ± 0.0182 | [0.5492, 0.7777] | 0.5468 ± 0.0264 | 0.2393 ± 0.0096 | 0.6271 ± 0.0152 | 0.5222 ± 0.0173 | 0.5958 ± 0.0226 | 0.5565 ± 0.0177 |
| Full | RF | 0.7326 ± 0.0096 | [0.6416, 0.8416] | 0.5855 ± 0.0151 | 0.2060 ± 0.0017 | 0.6828 ± 0.0193 | 0.6350 ± 0.0308 | 0.4504 ± 0.0387 | 0.5268 ± 0.0363 |

### Target: **RCA**

| Feature Set | Model | ROC-AUC (Mean ± Std) | Fold 95% Interval | PR-AUC (Mean ± Std) | Brier (Mean ± Std) | Accuracy | Precision | Recall | F1 |
|---|---|---|---|---|---|---|---|---|---|
| Compact | LR | 0.7449 ± 0.0047 | [0.6518, 0.8302] | 0.6052 ± 0.0099 | 0.2039 ± 0.0015 | 0.6571 ± 0.0075 | 0.5346 ± 0.0084 | 0.6868 ± 0.0093 | 0.6012 ± 0.0060 |
| Compact | RF | 0.6968 ± 0.0088 | [0.6141, 0.7846] | 0.5194 ± 0.0108 | 0.2218 ± 0.0033 | 0.6617 ± 0.0100 | 0.5456 ± 0.0112 | 0.6026 ± 0.0346 | 0.5724 ± 0.0197 |
| Full | LR | 0.7178 ± 0.0152 | [0.6143, 0.7906] | 0.5908 ± 0.0226 | 0.2177 ± 0.0064 | 0.6564 ± 0.0150 | 0.5371 ± 0.0170 | 0.6281 ± 0.0290 | 0.5789 ± 0.0205 |
| Full | RF | 0.7123 ± 0.0114 | [0.6133, 0.7814] | 0.5730 ± 0.0195 | 0.2066 ± 0.0030 | 0.6809 ± 0.0130 | 0.6179 ± 0.0287 | 0.3991 ± 0.0204 | 0.4847 ± 0.0211 |

---

## Paired Comparison: Full vs Compact Feature Set (ROC-AUC)

| Target | Model | Mean AUC Diff (Full - Compact) | Std Diff | 95% Repeat Interval [2.5%, 97.5%] |
|---|---|---|---|---|
| **CAD** | LR | +0.0228 | 0.0051 | [0.0160, 0.0305] |
| **CAD** | RF | +0.0394 | 0.0069 | [0.0309, 0.0530] |
| **LAD** | LR | +0.0289 | 0.0099 | [0.0149, 0.0433] |
| **LAD** | RF | +0.0837 | 0.0117 | [0.0698, 0.1031] |
| **LCX** | LR | -0.0744 | 0.0145 | [-0.1030, -0.0570] |
| **LCX** | RF | +0.0366 | 0.0190 | [0.0133, 0.0714] |
| **RCA** | LR | -0.0272 | 0.0134 | [-0.0534, -0.0150] |
| **RCA** | RF | +0.0155 | 0.0122 | [-0.0038, 0.0320] |

> **Methodological Note on Repeated CV Intervals:**
> Repeats share underlying dataset samples, introducing positive covariance across repeats. Consequently, the 2.5th to 97.5th percentile interval across repeats is descriptive and indicative of repeat-to-repeat variation, not a formal independent hypothesis test (e.g., Nadeau-Bengio corrected resampled t-test).
