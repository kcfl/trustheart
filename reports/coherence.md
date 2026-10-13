# TrustHeart 3D - Step 4: Fréchet Coherence Analysis

- **Theoretical Definition**: CAD is defined as 'at least one stenotic vessel', yielding exact Fréchet bounds:
  $$\max(P(\text{LAD}), P(\text{LCX}), P(\text{RCA})) \le P(\text{CAD}) \le \min(1, P(\text{LAD}) + P(\text{LCX}) + P(\text{RCA}))$$
- **Empirical Dataset Note**: 1 of 303 patients (index 93) violates the clinical definition in raw ground truth.
- **Evaluated Out-of-Fold Repeats**: 5 repeats (303 patients each)

---

## 1. Coherence Bound Violations (% of Patients)

| Search Space | % Below Lower Bound (Raised) | % Above Upper Bound (Lowered) | % Coherent (Unchanged) |
|---|---|---|---|
| `AUTO` | 23.10% ± 2.48% | 0.73% ± 0.43% | 76.17% ± 2.51% |
| `QUICK` | 15.71% ± 1.08% | 0.00% ± 0.00% | 84.29% ± 1.08% |

---

## 2. Model Performance Before vs. After Coherence Clipping

| Search Space | Metric | Before Clipping | After Clipping | Difference | Lower Bound Alone as CAD Score |
|---|---|---|---|---|---|
| `AUTO` | **ROC-AUC** | 0.9238 ± 0.0041 | **0.9266 ± 0.0036** | `+0.0028` | 0.9152 ± 0.0048 |
| `AUTO` | **Brier Score** | 0.0966 ± 0.0018 | **0.0935 ± 0.0024** | `-0.0032` | N/A |
| `QUICK` | **ROC-AUC** | 0.8981 ± 0.0037 | **0.8984 ± 0.0044** | `+0.0004` | 0.8922 ± 0.0014 |
| `QUICK` | **Brier Score** | 0.1081 ± 0.0017 | **0.1076 ± 0.0021** | `-0.0005` | N/A |
