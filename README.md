# TrustHeart 3D

Machine learning backend and 3D visualization platform for coronary artery disease (CAD) and vessel stenosis risk prediction on the Extension of Z-Alizadeh Sani dataset (UCI ID 411).

> **Clinical Disclaimer:** Decision support / educational prototype only. Predictions represent per-vessel stenosis probabilities from a small single-centre dataset (303 patients) and are not an anatomical lesion location. Not a substitute for formal diagnostic imaging or clinical judgement.

---

## Prerequisites & Dependencies

- **Python**: Python 3.12 (`python --version` or `py -3.12`)
- **Node.js**: Node 20.x or 22.x LTS (`node -v`) and npm (`npm -v`)
- **Git**: For version control and submodule/manifest verification

---

## Quickstart & Setup Instructions

### 1. Clone & Setup Python Virtual Environment

```bash
# Clone the repository
git clone https://github.com/your-username/trustheart.git
cd trustheart

# Create and activate virtual environment
# Windows (PowerShell):
python -m venv .venv
# or if using Python launcher or uv:
# py -3.12 -m venv .venv
# uv venv --seed --python 3.12 .venv
.\.venv\Scripts\Activate.ps1

# Linux / macOS:
python3.12 -m venv .venv
source .venv/bin/activate

# Install runtime dependencies (FastAPI + inference pipeline):
pip install -r requirements-runtime.txt

# For running tests and development harnesses, also install dev dependencies:
pip install -r requirements-dev.txt
```

### 2. Frontend Build Step (Required for Clean Clones)

> **Important:** `frontend/dist` is gitignored. In any clean clone, the compiled frontend assets must be built before starting the single-port production server.

```bash
# Navigate to frontend and install dependencies
cd frontend
npm ci

# Compile production bundle (includes design system and WebGL shaders)
npm run build
cd ..
```

### 3. Start the Server

#### Windows (PowerShell / Command Prompt):
```powershell
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

#### Linux / macOS:
```bash
python3 -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

### 4. Open in Browser

Open **`http://localhost:8000`** (or `http://127.0.0.1:8000`).

- **Frontend UI & 3D Heart**: Loaded at `http://localhost:8000/`
- **Analysis Workspace**: `http://localhost:8000/analysis`
- **Results & Calibrated Probabilities**: `http://localhost:8000/results`
- **Interactive Explainability**: `http://localhost:8000/explainability`
- **Methodology & Cross-Validation**: `http://localhost:8000/methodology`
- **About & Attribution**: `http://localhost:8000/about`
- **API Health Check**: `http://localhost:8000/api/health`
- **Interactive API Docs (Swagger UI)**: `http://localhost:8000/docs`

---

## Trying Quick vs. Full Mode

TrustHeart 3D supports two distinct prediction workflows:

### A. In the Web UI (`/analysis`)
1. **Quick Screening Mode (7 Features)**:
   - Evaluates: *Age, Sex, Chest Pain (Typical / Atypical / Non-anginal / None), Diabetes (DM), Hypertension (HTN)*.
   - Click the **"Sample patient (p10)"** preset button to populate a low-risk clinical screening profile.
   - Click **Review inputs**, verify the values, check the consent checkbox, and click **Confirm & evaluate risk**.
2. **Full Multimodal Mode (Up to 54 Features)**:
   - Toggle the mode radio button to **Full mode (multimodal)**.
   - Click **"Fill example"** to populate comprehensive demographics, vitals, lab markers, ECG, and echocardiography (`EF-TTE`, `Region RWMA`, `VHD`).
   - Click **Review inputs** and submit to inspect calibrated predictions across all four targets (`CAD`, `LAD`, `LCX`, `RCA`) and nearest out-of-fold training neighbors.

### B. Via HTTP API (`POST /api/predict`)

**Quick Mode Example**:
```bash
curl -X POST http://127.0.0.1:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "quick",
    "inputs": {
      "Age": 59.0,
      "Sex": "Male",
      "Typical Chest Pain": false,
      "Atypical": true,
      "Nonanginal": false,
      "DM": false,
      "HTN": false
    }
  }'
```

**Full Mode Example**:
```bash
curl -X POST http://127.0.0.1:8000/api/predict \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full",
    "inputs": {
      "Age": 58.0,
      "Sex": "Male",
      "Weight": 78.0,
      "Length": 175.0,
      "BMI": 25.47,
      "DM": false,
      "HTN": true,
      "BP": 130.0,
      "PR": 72.0,
      "Typical Chest Pain": true,
      "Atypical": false,
      "Nonanginal": false,
      "FBS": 94.0,
      "CR": 0.9,
      "TG": 150.0,
      "LDL": 110.0,
      "HDL": 45.0,
      "BUN": 14.0,
      "HB": 14.2,
      "EF-TTE": 55.0,
      "Region RWMA": 0.0,
      "VHD": "N",
      "BBB": "N"
    }
  }'
```

---

## Running the Automated Test Suites

### 1. Python Backend & Contract Tests
```powershell
# Run the complete pytest suite (65 tests)
pytest -q

# Verify feature contract between frontend form and backend schemas
python scripts/check_frontend_contract.py

# Verify artifact cryptographic integrity and mathematical identities
python scripts/verify_artifacts.py

# Run independent check on model calibrations and identities
python scripts/independent_check.py

# Verify Docker context against .dockerignore
python scripts/check_docker_context.py

# Verify Model Card claims against nested CV results
python scripts/check_model_card.py
```

### 2. Frontend Unit & Type Tests
```powershell
cd frontend

# TypeScript typecheck
npm run typecheck

# Vitest unit test suite (67 tests across 6 suites)
npm test

# Production build verification
npm run build
cd ..
```

---

## Project Structure

```text
trustheart/
├── backend/                  # FastAPI backend service
│   ├── app/
│   │   ├── config.py         # App configuration, bounds, and constants
│   │   ├── main.py           # Application factory, middleware & lifespan
│   │   ├── routes.py         # API endpoints (/api/predict, /api/samples, etc.)
│   │   ├── schemas.py        # Pydantic v2 schemas and validation
│   │   ├── security.py       # Rate limiting, CSP, and privacy logging
│   │   └── service.py        # Model service, Fréchet coherence, trust metrics
├── data/
│   └── raw/                  # Z-Alizadeh Sani Excel dataset
├── docs/                     # Architectural, contract, and verification docs
│   ├── FIELD_MAP.md          # Generated 54-feature mapping documentation
│   ├── MODEL_CARD.md         # Model factsheet and performance metrics
│   └── verification/         # Verification artifacts, test logs, screenshots
├── frontend/                 # React + TypeScript + Vite frontend
│   ├── public/               # Static assets (heart.glb, local fonts)
│   ├── src/
│   │   ├── components/       # HeartScene (Three.js), UI components, Footer
│   │   ├── features/         # Clinical schemas and form controls
│   │   ├── pages/            # Home, Analysis, Results, Explainability, etc.
│   │   └── services/         # prediction-api.ts, api-types.ts
│   ├── package.json
│   └── vite.config.ts
├── ml/                       # Machine learning pipeline and training code
│   ├── calibration.py        # Platt scaling & isotonic calibration
│   ├── coherence.py          # Fréchet joint probability inequality bounds
│   ├── config.py             # Feature mappings and hyperparameters
│   ├── data.py               # Data loading and leakage prevention
│   ├── final_fit.py          # 1-SE model fit and manifest generation
│   ├── nested.py             # 10-repeat 5-fold nested cross-validation
│   ├── predict.py            # Model loader and inference engine
│   └── similar.py            # Gower distance k-NN for clinical trust
├── models/                   # Serialized model artifacts (.joblib, .json, .npz)
│   └── manifest.json         # Cryptographic SHA-256 artifact manifest
├── scripts/                  # Verification, generation, and dev scripts
├── tests/                    # Backend pytest suite
├── Dockerfile                # Multi-stage production container definition
├── requirements-runtime.txt  # Minimal runtime dependencies
├── requirements-dev.txt      # Development and testing dependencies
└── README.md
```

---

## Dataset Source & License

- **Dataset**: Extension of Z-Alizadeh Sani Dataset (UCI Machine Learning Repository ID 411).
- **Source**: [UCI Machine Learning Repository (DOI: 10.24432/C5461K)](https://archive.ics.uci.edu/dataset/411/extention+of+z+alizadeh+sani+dataset).
- **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- **Citation**: Alizadehsani, R. et al. *A database of patients for coronary artery disease research*.

---

## Model Limitations & Clinical Safety

1. **Small Single-Centre Cohort**: Trained on 303 angiography-referred patients from Tehran Heart Center. Performance characteristics may not generalize to broader outpatient screening populations.
2. **Per-Vessel Probability vs. Lesion Location**: Model outputs reflect statistical probabilities of stenosis $\ge 50\%$; they do not delineate anatomical lesion location, bifurcation involvement, or plaque morphology.
3. **Fréchet Coherence Rule**: Overall CAD probability is mathematically adjusted to satisfy Fréchet joint bounds:
   $$\max(P(\text{LAD}), P(\text{LCX}), P(\text{RCA})) \le P(\text{CAD}) \le \min\left(1, \sum P(\text{vessels})\right)$$
4. **Privacy-Preserving**: No patient identifiers or protected health information (PHI) are logged, stored, or sent to external endpoints.

---

## AI-Tool Disclosure

This project was built with the assistance of agentic AI coding assistants (**Google Antigravity** powered by **Gemini 2.5**). All generated code, mathematical identities, and model pipelines were validated by automated end-to-end testing, cryptographic manifest verification, and independent mathematical checks.

---

## Third-Party Attributions & Credits

- **3D Anatomical Heart**: “Realistic Human Heart” by **neshallads**, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Extracted and optimized with custom material shaders.
- **Visual Design & Footer**: Component design and footer beam wordmark inspired by **SSPRO🎀**.
- **Icons**: Lucide Icons ([ISC License](https://lucide.dev/license)).
