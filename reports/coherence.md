# TrustHeart 3D - Step 4: Fréchet Coherence Analysis

- **Theoretical Definition**: CAD is defined as 'at least one stenotic vessel', yielding exact Fréchet bounds:
  $$\max(P(\text{LAD}), P(\text{LCX}), P(\text{RCA})) \le P(\text{CAD}) \le \min(1, P(\text{LAD}) + P(\text{LCX}) + P(\text{RCA}))$$
- **Empirical Dataset Note**: 1 of 303 patients (index 93) violates the clinical definition in raw ground truth.
- **Evaluated Out-of-Fold Repeats**: 10 repeats (303 patients each)

---

## 1. Coherence Bound Violations (% of Patients)

| Search Space | % Below Lower Bound (Raised) | % Above Upper Bound (Lowered) | % Coherent (Unchanged) |
|---|---|---|---|
| `AUTO` | 22.71% ± 2.37% | 0.96% ± 0.90% | 76.34% ± 2.52% |
| `QUICK` | 15.91% ± 1.06% | 0.00% ± 0.00% | 84.09% ± 1.06% |

---

## 2. Model Performance Before vs. After Coherence Clipping

| Search Space | Metric | Before Clipping | After Clipping | Difference | Lower Bound Alone as CAD Score |
|---|---|---|---|---|---|
| `AUTO` | **ROC-AUC** | 0.9237 ± 0.0064 | **0.9258 ± 0.0046** | `+0.0021` | 0.9148 ± 0.0044 |
| `AUTO` | **Brier Score** | 0.0978 ± 0.0031 | **0.0948 ± 0.0025** | `-0.0030` | N/A |
| `QUICK` | **ROC-AUC** | 0.8979 ± 0.0030 | **0.8987 ± 0.0031** | `+0.0008` | 0.8949 ± 0.0034 |
| `QUICK` | **Brier Score** | 0.1101 ± 0.0014 | **0.1093 ± 0.0014** | `-0.0008` | N/A |
