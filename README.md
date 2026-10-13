# TrustHeart 3D

Machine learning backend foundation for cardiac risk prediction on the Extension of Z-Alizadeh Sani dataset (UCI ID 411).

> **Clinical disclaimer:** Decision support / educational only, not a substitute for formal diagnostic imaging.

---

## Reproduce

To reproduce the entire TrustHeart 3D ML pipeline and regenerate all models, evaluation metrics, and trust layer artifacts:

### 1. Environment Setup
- **Python**: Python 3.12 (e.g. `py -3.12` on Windows).
- **Virtual Environment**:
  ```powershell
  py -3.12 -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.lock
  ```

### 2. Dataset Location
- The dataset file must be placed at:
  ```
  data/raw/extention of Z-Alizadeh sani dataset.xlsx
  ```
- **Official Source**: UCI Machine Learning Repository, Dataset ID 411:
  [Extension of Z-Alizadeh Sani Dataset (DOI: 10.24432/C5461K)](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset)

### 3. Execution
Run the end-to-end rebuild script from the repository root:
```powershell
.\scripts\rebuild.ps1
```

The script runs the following sequence and halts immediately if any step fails:
1. `python -m ml.nested`: 10-repeat 5-fold nested cross-validation with inner 2-repeat 3-fold tuning and Platt calibration across 22 model configurations.
2. `python -m ml.final_fit`: Final 1-SE model selection on the full dataset (303 samples), calibration, feature statistics, and SHA-256 artifact manifest generation.
3. `python -m ml.coherence_report`: Coherence evaluation checking joint risk bounds ($P(\text{CAD}) \ge \max(P(\text{LAD}), P(\text{LCX}), P(\text{RCA}))$) and monotonic CAD severity across single-, double-, and triple-vessel stenosis.
4. `python -m ml.stability`: 30-bootstrap stratified feature importance stability analysis with adaptive top-K cutoffs (Top-3 for compact models, Top-5 for full models).
5. `python -m ml.trust_stats`: Trust layer aggregation, quick-vs-full paired lift, k-NN leave-one-out evidence AUCs, and identical selection fractions.
6. `pytest -q`: Comprehensive test suite verification.

### 4. Expected Runtime
- **Runtime**: Approximately 8 to 14 minutes on a multi-core machine (using joblib with all available CPU cores).
- **Determinism**: All results are fully deterministic given the fixed random seeds (`SEED = 42`, `CV_SEED = 42`) and the exact package versions specified in `requirements.lock`.
