# TrustHeart 3D - Data Audit Report

Audit report generated on dataset: **Extension of Z-Alizadeh Sani dataset** (UCI ID 411).

## 1. Overview & Data Hygiene

| Metric | Value |
|---|---|
| **Raw Dataset Shape** | 303 rows × 59 columns |
| **Missing Values Total** | 0 |
| **Duplicate Rows Count** | 0 |
| **Model Feature Count (Encoded)** | 56 |

## 2. Demographics

- **Age**: Min 30, Max 86, Mean 58.9
- **Sex Distribution**:
  - Male: 176
  - Fmale: 127

## 3. Target Distribution & Prevalence

| Target | Description | Normal (0) | Positive (1) | Prevalence (%) |
|---|---|---|---|---|
| **CAD** | Coronary Artery Disease (Cath) | 87 | 216 | 71.29% |
| **LAD** | Left Anterior Descending Artery | 126 | 177 | 58.42% |
| **LCX** | Left Circumflex Artery | 184 | 119 | 39.27% |
| **RCA** | Right Coronary Artery | 189 | 114 | 37.62% |

## 4. Target Consistency Check: `CAD == max(LAD, LCX, RCA)`

- **Matching Rows**: 302 / 303 (99.67%)
- **Mismatch Count**: 1

### Mismatch Details:
| Row Index | Cath (Raw) | CAD (Binary) | LAD | LCX | RCA | Max Artery |
|---|---|---|---|---|---|---|
| 93 | Normal | 0 | Stenotic | Normal | Normal | 1 |

## 5. Joint Artery Stenosis Patterns (`LAD-LCX-RCA`)

| 3-Bit Pattern | Count | Percentage (%) |
|---|---|---|
| `000` | 86 | 28.38% |
| `111` | 63 | 20.79% |
| `100` | 57 | 18.81% |
| `110` | 33 | 10.89% |
| `101` | 24 | 7.92% |
| `001` | 17 | 5.61% |
| `010` | 13 | 4.29% |
| `011` | 10 | 3.3% |

## 6. Raw String Columns and Unique Values

- **Sex**: `['Male', 'Fmale']`
- **Obesity**: `['Y', 'N']`
- **CRF**: `['N', 'Y']`
- **CVA**: `['N', 'Y']`
- **Airway disease**: `['N', 'Y']`
- **Thyroid Disease**: `['N', 'Y']`
- **CHF**: `['N', 'Y']`
- **DLP**: `['Y', 'N']`
- **Weak Peripheral Pulse**: `['N', 'Y']`
- **Lung rales**: `['N', 'Y']`
- **Systolic Murmur**: `['N', 'Y']`
- **Diastolic Murmur**: `['N', 'Y']`
- **Dyspnea**: `['N', 'Y']`
- **Atypical**: `['N', 'Y']`
- **Nonanginal**: `['N', 'Y']`
- **Exertional CP**: `['N']`
- **LowTH Ang**: `['N', 'Y']`
- **LVH**: `['N', 'Y']`
- **Poor R Progression**: `['N', 'Y']`
- **BBB**: `['N', 'LBBB', 'RBBB']`
- **VHD**: `['N', 'mild', 'Severe', 'Moderate']`
- **LAD**: `['Stenotic', 'Normal']`
- **LCX**: `['Normal', 'Stenotic']`
- **RCA**: `['Stenotic', 'Normal']`
- **Cath**: `['CAD', 'Normal']`

## 7. Compact Features Verification

- All compact features present: **True**
  - `Age`
  - `Sex`
  - `Typical Chest Pain`
  - `Atypical`
  - `Nonanginal`
  - `DM`
  - `HTN`
