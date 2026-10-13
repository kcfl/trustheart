# TrustHeart 3D - Step 4: Explanation Stability Report

- **Timestamp (UTC)**: 2026-10-13T22:32:10.489079+00:00
- **Git Commit**: `3ee1e70e1523f911ea5d5bebeccd4d6ab73d9f7f` (dirty: True)
- **Bootstraps**: 30 stratified resamples with replacement
- **Stability Criteria**:
  - **Stable**: Top-5 frequency $\ge 80%$ AND Sign consistency $\ge 90%$
  - **Moderate**: Top-5 frequency $\ge 50%$ (not meeting stable)
  - **Unstable**: Otherwise

---

## Search Space: `AUTO`

### Target: **CAD** (`full|LR|C=0.01`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.3310 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Atypical** | 0.2050 | 93.3% | 100.0% | - (Negative) | **STABLE** |
| 3 | **Age** | 0.1834 | 80.0% | 100.0% | + (Positive) | **STABLE** |
| 4 | **HTN** | 0.1659 | 70.0% | 100.0% | + (Positive) | Moderate |
| 5 | **Region RWMA** | 0.1555 | 63.3% | 100.0% | + (Positive) | Moderate |
| 6 | **DM** | 0.1447 | 36.7% | 100.0% | + (Positive) | Unstable |
| 7 | **Tinversion** | 0.1473 | 40.0% | 100.0% | + (Positive) | Unstable |
| 8 | **Dyspnea** | 0.0977 | 13.3% | 100.0% | - (Negative) | Unstable |
| 9 | **BP** | 0.0938 | 0.0% | 100.0% | + (Positive) | Unstable |
| 10 | **EF-TTE** | 0.0866 | 3.3% | 100.0% | - (Negative) | Unstable |

### Target: **LAD** (`full|RF|leaf=5|feat=sqrt`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.0810 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Region RWMA** | 0.0411 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 3 | **EF-TTE** | 0.0456 | 96.7% | 100.0% | - (Negative) | **STABLE** |
| 4 | **Atypical** | 0.0340 | 76.7% | 100.0% | - (Negative) | Moderate |
| 5 | **Age** | 0.0350 | 80.0% | 100.0% | + (Positive) | **STABLE** |
| 6 | **ESR** | 0.0177 | 13.3% | 100.0% | + (Positive) | Unstable |
| 7 | **Neut** | 0.0178 | 13.3% | 100.0% | + (Positive) | Unstable |
| 8 | **PR** | 0.0111 | 3.3% | 100.0% | + (Positive) | Unstable |
| 9 | **Tinversion** | 0.0114 | 0.0% | 100.0% | + (Positive) | Unstable |
| 10 | **Lymph** | 0.0138 | 0.0% | 100.0% | - (Negative) | Unstable |

### Target: **LCX** (`compact|LR|C=0.03`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.3750 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Age** | 0.3426 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 3 | **Sex** | 0.2011 | 90.0% | 100.0% | + (Positive) | **STABLE** |
| 4 | **DM** | 0.1700 | 93.3% | 100.0% | + (Positive) | **STABLE** |
| 5 | **HTN** | 0.1502 | 90.0% | 93.3% | + (Positive) | **STABLE** |
| 6 | **Nonanginal** | 0.0474 | 16.7% | 90.0% | - (Negative) | Unstable |
| 7 | **Atypical** | 0.0466 | 10.0% | 50.0% | - (Negative) | Unstable |

### Target: **RCA** (`compact|LR|C=0.01`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **DM** | 0.2091 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Typical Chest Pain** | 0.1737 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 3 | **Age** | 0.1379 | 90.0% | 100.0% | + (Positive) | **STABLE** |
| 4 | **Atypical** | 0.1325 | 83.3% | 100.0% | - (Negative) | **STABLE** |
| 5 | **Sex** | 0.1361 | 86.7% | 100.0% | + (Positive) | **STABLE** |
| 6 | **HTN** | 0.0892 | 36.7% | 100.0% | + (Positive) | Unstable |
| 7 | **Nonanginal** | 0.0589 | 3.3% | 100.0% | - (Negative) | Unstable |

---

## Search Space: `QUICK`

### Target: **CAD** (`compact|LR|C=0.01`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.3860 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Atypical** | 0.2338 | 100.0% | 100.0% | - (Negative) | **STABLE** |
| 3 | **Age** | 0.2247 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 4 | **HTN** | 0.2020 | 93.3% | 100.0% | + (Positive) | **STABLE** |
| 5 | **DM** | 0.1795 | 96.7% | 100.0% | + (Positive) | **STABLE** |
| 6 | **Nonanginal** | 0.0905 | 10.0% | 100.0% | - (Negative) | Unstable |
| 7 | **Sex** | 0.0684 | 0.0% | 100.0% | + (Positive) | Unstable |

### Target: **LAD** (`compact|LR|C=0.01`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.3009 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Age** | 0.1891 | 96.7% | 100.0% | + (Positive) | **STABLE** |
| 3 | **Atypical** | 0.1977 | 100.0% | 100.0% | - (Negative) | **STABLE** |
| 4 | **HTN** | 0.1018 | 73.3% | 96.7% | + (Positive) | Moderate |
| 5 | **Sex** | 0.1009 | 70.0% | 100.0% | + (Positive) | Moderate |
| 6 | **Nonanginal** | 0.0712 | 33.3% | 100.0% | - (Negative) | Unstable |
| 7 | **DM** | 0.0582 | 26.7% | 86.7% | + (Positive) | Unstable |

### Target: **LCX** (`compact|LR|C=0.03`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **Typical Chest Pain** | 0.3750 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Age** | 0.3426 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 3 | **Sex** | 0.2011 | 90.0% | 100.0% | + (Positive) | **STABLE** |
| 4 | **DM** | 0.1700 | 93.3% | 100.0% | + (Positive) | **STABLE** |
| 5 | **HTN** | 0.1502 | 90.0% | 93.3% | + (Positive) | **STABLE** |
| 6 | **Nonanginal** | 0.0474 | 16.7% | 90.0% | - (Negative) | Unstable |
| 7 | **Atypical** | 0.0466 | 10.0% | 50.0% | - (Negative) | Unstable |

### Target: **RCA** (`compact|LR|C=0.01`)

| Rank | Feature | Mean Importance | Top-5 Frequency | Sign Consistency | Direction | Stability Tag |
|---|---|---|---|---|---|---|
| 1 | **DM** | 0.2091 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 2 | **Typical Chest Pain** | 0.1737 | 100.0% | 100.0% | + (Positive) | **STABLE** |
| 3 | **Age** | 0.1379 | 90.0% | 100.0% | + (Positive) | **STABLE** |
| 4 | **Atypical** | 0.1325 | 83.3% | 100.0% | - (Negative) | **STABLE** |
| 5 | **Sex** | 0.1361 | 86.7% | 100.0% | + (Positive) | **STABLE** |
| 6 | **HTN** | 0.0892 | 36.7% | 100.0% | + (Positive) | Unstable |
| 7 | **Nonanginal** | 0.0589 | 3.3% | 100.0% | - (Negative) | Unstable |

---
