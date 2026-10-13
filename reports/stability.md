# TrustHeart 3D - Step 5: Explanation Stability Report

- **Timestamp (UTC)**: 2026-10-13T23:42:48.704471+00:00
- **Git Commit**: `e29ed066fe353a882b917c87f28857f11163cb27` (dirty: False)
- **Bootstraps**: 30 stratified resamples with replacement
- **Stability Criteria**:
  - **Stable**: Top-K frequency $\ge 80%$ AND Sign consistency $\ge 90%$
  - **Moderate**: Top-K frequency $\ge 50%$ (not meeting stable)
  - **Unstable**: Otherwise

---

## Rule Revision

### Rationale
In stability rule v1, a fixed top-5 cutoff (`STAB_TOPK = 5`) was applied across all models regardless of feature set size. With only 7 compact features, being 'in the top 5' occurs by chance for $5/7 \approx 71.4\%$ of features in any single resample, severely diminishing the discriminative power of the stability tag. To resolve this, Stability Rule v2 introduces an adaptive cutoff as a post-hoc design revision made after seeing the initial results:
- **Full-feature models (55 features)**: `STAB_TOPK_FULL = 5` (top ~9.1% of features)
- **Compact-feature models (7 features)**: `STAB_TOPK_COMPACT = 3` (top ~42.9% of features)

The core classification thresholds (`STAB_STABLE_FREQ = 0.80`, `STAB_STABLE_SIGN = 0.90`, `STAB_MODERATE_FREQ = 0.50`) remain unchanged. Both v2 tags (`tag`, used by the clinical interface) and v1 tags (`tag_v1`, top-5 baseline) are preserved in the artifact records.

### Differences Between Stability Rule v1 and v2

| Search Space | Target | Feature | Rank (full-data fit) | v1 Tag (Top-5) | v2 Tag (Top-3/5) | Top-K Freq (v1) | Top-K Freq (v2) | Sign Consistency |
|---|---|---|---|---|---|---|---|---|
| `auto` | **LCX** | **Sex** | 3 | `stable` | **`moderate`** | 90.0% | 50.0% | 100.0% |
| `auto` | **LCX** | **DM** | 4 | `stable` | **`unstable`** | 93.3% | 36.7% | 100.0% |
| `auto` | **LCX** | **HTN** | 5 | `stable` | **`unstable`** | 90.0% | 13.3% | 93.3% |
| `auto` | **RCA** | **Atypical** | 3 | `stable` | **`moderate`** | 93.3% | 63.3% | 100.0% |
| `auto` | **RCA** | **Age** | 4 | `stable` | **`unstable`** | 90.0% | 33.3% | 100.0% |
| `auto` | **RCA** | **HTN** | 5 | `moderate` | **`unstable`** | 53.3% | 10.0% | 100.0% |
| `auto` | **RCA** | **Sex** | 6 | `moderate` | **`unstable`** | 63.3% | 13.3% | 100.0% |
| `quick` | **CAD** | **Age** | 3 | `stable` | **`moderate`** | 100.0% | 53.3% | 100.0% |
| `quick` | **CAD** | **HTN** | 4 | `stable` | **`unstable`** | 96.7% | 43.3% | 100.0% |
| `quick` | **CAD** | **DM** | 5 | `stable` | **`unstable`** | 96.7% | 6.7% | 100.0% |
| `quick` | **LAD** | **HTN** | 4 | `stable` | **`unstable`** | 80.0% | 10.0% | 100.0% |
| `quick` | **LAD** | **Sex** | 6 | `moderate` | **`unstable`** | 56.7% | 0.0% | 100.0% |
| `quick` | **LCX** | **Sex** | 3 | `stable` | **`moderate`** | 90.0% | 50.0% | 100.0% |
| `quick` | **LCX** | **DM** | 4 | `stable` | **`unstable`** | 93.3% | 36.7% | 100.0% |
| `quick` | **LCX** | **HTN** | 5 | `stable` | **`unstable`** | 90.0% | 13.3% | 93.3% |
| `quick` | **RCA** | **Atypical** | 3 | `stable` | **`moderate`** | 93.3% | 63.3% | 100.0% |
| `quick` | **RCA** | **Age** | 4 | `stable` | **`unstable`** | 90.0% | 33.3% | 100.0% |
| `quick` | **RCA** | **HTN** | 5 | `moderate` | **`unstable`** | 53.3% | 10.0% | 100.0% |
| `quick` | **RCA** | **Sex** | 6 | `moderate` | **`unstable`** | 63.3% | 13.3% | 100.0% |

---

## Search Space: `AUTO`

### Target: **CAD** (`full|LR|C=0.001`, Top-5 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.0737 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **Atypical** | 0.0510 | 100.0% | 100.0% | - (Negative) | **STABLE** | stable |
| 3 | **Age** | 0.0402 | 90.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 4 | **HTN** | 0.0380 | 70.0% | 100.0% | + (Positive) | Moderate | moderate |
| 5 | **Region RWMA** | 0.0342 | 66.7% | 100.0% | + (Positive) | Moderate | moderate |
| 6 | **DM** | 0.0304 | 30.0% | 100.0% | + (Positive) | Unstable | unstable |
| 7 | **Tinversion** | 0.0302 | 23.3% | 100.0% | + (Positive) | Unstable | unstable |
| 8 | **BP** | 0.0242 | 3.3% | 100.0% | + (Positive) | Unstable | unstable |
| 9 | **EF-TTE** | 0.0232 | 10.0% | 100.0% | - (Negative) | Unstable | unstable |
| 10 | **FBS** | 0.0184 | 0.0% | 100.0% | + (Positive) | Unstable | unstable |

### Target: **LAD** (`full|LR|C=0.001`, Top-5 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.0591 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **Atypical** | 0.0418 | 100.0% | 100.0% | - (Negative) | **STABLE** | stable |
| 3 | **Region RWMA** | 0.0356 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 4 | **Age** | 0.0326 | 90.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 5 | **EF-TTE** | 0.0313 | 73.3% | 100.0% | - (Negative) | Moderate | moderate |
| 6 | **Tinversion** | 0.0248 | 23.3% | 100.0% | + (Positive) | Unstable | unstable |
| 7 | **HTN** | 0.0213 | 13.3% | 100.0% | + (Positive) | Unstable | unstable |
| 8 | **PR** | 0.0165 | 0.0% | 100.0% | + (Positive) | Unstable | unstable |
| 9 | **Lymph** | 0.0181 | 0.0% | 100.0% | - (Negative) | Unstable | unstable |
| 10 | **St Depression** | 0.0148 | 0.0% | 100.0% | + (Positive) | Unstable | unstable |

### Target: **LCX** (`compact|LR|C=0.03`, Top-3 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-3 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.3750 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **Age** | 0.3426 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 3 | **Sex** | 0.2011 | 50.0% | 100.0% | + (Positive) | Moderate | stable |
| 4 | **DM** | 0.1700 | 36.7% | 100.0% | + (Positive) | Unstable | stable |
| 5 | **HTN** | 0.1502 | 13.3% | 93.3% | + (Positive) | Unstable | stable |
| 6 | **Nonanginal** | 0.0474 | 0.0% | 90.0% | - (Negative) | Unstable | unstable |
| 7 | **Atypical** | 0.0466 | 0.0% | 50.0% | - (Negative) | Unstable | unstable |

### Target: **RCA** (`compact|LR|C=0.001`, Top-3 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-3 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.0377 | 93.3% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **DM** | 0.0362 | 86.7% | 100.0% | + (Positive) | **STABLE** | stable |
| 3 | **Atypical** | 0.0287 | 63.3% | 100.0% | - (Negative) | Moderate | stable |
| 4 | **Age** | 0.0255 | 33.3% | 100.0% | + (Positive) | Unstable | stable |
| 5 | **HTN** | 0.0200 | 10.0% | 100.0% | + (Positive) | Unstable | moderate |
| 6 | **Sex** | 0.0185 | 13.3% | 100.0% | + (Positive) | Unstable | moderate |
| 7 | **Nonanginal** | 0.0102 | 0.0% | 100.0% | - (Negative) | Unstable | unstable |

---

## Search Space: `QUICK`

### Target: **CAD** (`compact|LR|C=0.001`, Top-3 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-3 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.0780 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **Atypical** | 0.0540 | 96.7% | 100.0% | - (Negative) | **STABLE** | stable |
| 3 | **Age** | 0.0433 | 53.3% | 100.0% | + (Positive) | Moderate | stable |
| 4 | **HTN** | 0.0408 | 43.3% | 100.0% | + (Positive) | Unstable | stable |
| 5 | **DM** | 0.0330 | 6.7% | 100.0% | + (Positive) | Unstable | stable |
| 6 | **Nonanginal** | 0.0183 | 0.0% | 100.0% | - (Negative) | Unstable | unstable |
| 7 | **Sex** | 0.0107 | 0.0% | 90.0% | + (Positive) | Unstable | unstable |

### Target: **LAD** (`compact|LR|C=0.001`, Top-3 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-3 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.0624 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **Atypical** | 0.0449 | 100.0% | 100.0% | - (Negative) | **STABLE** | stable |
| 3 | **Age** | 0.0353 | 90.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 4 | **HTN** | 0.0226 | 10.0% | 100.0% | + (Positive) | Unstable | stable |
| 5 | **DM** | 0.0138 | 0.0% | 96.7% | + (Positive) | Unstable | unstable |
| 6 | **Sex** | 0.0165 | 0.0% | 100.0% | + (Positive) | Unstable | moderate |
| 7 | **Nonanginal** | 0.0135 | 0.0% | 100.0% | - (Negative) | Unstable | unstable |

### Target: **LCX** (`compact|LR|C=0.03`, Top-3 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-3 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.3750 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **Age** | 0.3426 | 100.0% | 100.0% | + (Positive) | **STABLE** | stable |
| 3 | **Sex** | 0.2011 | 50.0% | 100.0% | + (Positive) | Moderate | stable |
| 4 | **DM** | 0.1700 | 36.7% | 100.0% | + (Positive) | Unstable | stable |
| 5 | **HTN** | 0.1502 | 13.3% | 93.3% | + (Positive) | Unstable | stable |
| 6 | **Nonanginal** | 0.0474 | 0.0% | 90.0% | - (Negative) | Unstable | unstable |
| 7 | **Atypical** | 0.0466 | 0.0% | 50.0% | - (Negative) | Unstable | unstable |

### Target: **RCA** (`compact|LR|C=0.001`, Top-3 Cutoff)

| Rank (full-data fit) | Feature | Mean Importance | Top-3 Frequency | Sign Consistency | Direction | Stability Tag (v2) | Tag (v1) |
|---|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.0377 | 93.3% | 100.0% | + (Positive) | **STABLE** | stable |
| 2 | **DM** | 0.0362 | 86.7% | 100.0% | + (Positive) | **STABLE** | stable |
| 3 | **Atypical** | 0.0287 | 63.3% | 100.0% | - (Negative) | Moderate | stable |
| 4 | **Age** | 0.0255 | 33.3% | 100.0% | + (Positive) | Unstable | stable |
| 5 | **HTN** | 0.0200 | 10.0% | 100.0% | + (Positive) | Unstable | moderate |
| 6 | **Sex** | 0.0185 | 13.3% | 100.0% | + (Positive) | Unstable | moderate |
| 7 | **Nonanginal** | 0.0102 | 0.0% | 100.0% | - (Negative) | Unstable | unstable |

---
