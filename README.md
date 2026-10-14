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
  ```
- **Dependencies (Runtime vs Dev)**:
  - **Runtime Only** (FastAPI backend + inference server):
    ```powershell
    pip install -r requirements-runtime.txt
    ```
  - **Development & Testing** (includes pytest, httpx, and test harnesses):
    ```powershell
    pip install -r requirements-runtime.txt -r requirements-dev.txt
    ```
  - **Full Pipeline Reproduction** (includes training, SHAP, and plotting packages):
    ```powershell
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

---

## Running the Application

### 1. Windows Local Execution

#### Option A: Development Mode (Two Terminals)

**Terminal 1 — Backend API (FastAPI):**
```powershell
cd "e:\iit mandi\trustheart"
$env:Path = "C:\Program Files\nodejs;" + $env:Path
.\.venv\Scripts\Activate.ps1
# Run API server on port 8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
# Alternatively via script:
# powershell -ExecutionPolicy Bypass -File scripts\run_api.ps1
```
The FastAPI backend will start on `http://127.0.0.1:8000`. Health check: `http://127.0.0.1:8000/api/health`.

**Terminal 2 — Frontend UI (Vite + React):**
```powershell
cd "e:\iit mandi\trustheart\frontend"
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm.cmd install
npm.cmd run dev
```
The Vite development server will start on `http://localhost:5173` with proxying to `http://127.0.0.1:8000/api`.

#### Option B: Standalone Production Mode on Windows (Single Server)
FastAPI automatically serves the compiled `frontend/dist` assets and SPA routes when present:
```powershell
# 1. Compile frontend production bundle
cd "e:\iit mandi\trustheart\frontend"
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm.cmd run build

# 2. Launch FastAPI serving both API and static frontend on port 8000
cd "e:\iit mandi\trustheart"
.\.venv\Scripts\Activate.ps1
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```
Open `http://localhost:8000` in your web browser.

---

### 2. Docker Execution (Multi-Stage Container)

The project includes a multi-stage `Dockerfile` that builds the React frontend in `node:22-alpine`, installs runtime dependencies from `requirements-runtime.txt`, configures a non-root user (`appuser`), and serves both the API and frontend assets via FastAPI on `python:3.12-slim`.

> **Notice**: Docker is not installed on this host environment. The Dockerfile itself is untested on this machine, and `python scripts/check_docker_context.py` only validates the build context (verifying that all 16 runtime files are neither excluded by `.dockerignore` nor omitted from `Dockerfile` COPY directives).

#### Step 1: Build Docker Image
From the repository root (`e:\iit mandi\trustheart`):
```powershell
docker build -t trustheart-3d:latest .
```

#### Step 2: Run Docker Container
Run the container mapping port 8000:
```powershell
docker run -d `
  --name trustheart-app `
  -p 8000:8000 `
  -e CORS_ORIGINS="http://localhost:5173,http://localhost:8000" `
  -e TRUSTHEART_TRUST_PROXY="false" `
  -e TRUSTHEART_TRUSTED_PROXY_HOPS="1" `
  -e TRUSTHEART_RATE_LIMIT="60" `
  trustheart-3d:latest
```

#### Step 3: Verify Health and Access
```powershell
# Check container logs
docker logs trustheart-app

# Check health endpoint
curl http://localhost:8000/api/health

# Open in browser
Start-Process "http://localhost:8000"
```

#### Step 4: Stop and Remove Container
```powershell
docker stop trustheart-app
docker rm trustheart-app
```

---

## Deploy

### Deploying to Render via Blueprint

1. **Create Service on Render**:
   - In the [Render Dashboard](https://dashboard.render.com), click **New** > **Blueprint**.
   - Connect this GitHub repository.
   - Render automatically reads [`render.yaml`](file:///e:/iit%20mandi/trustheart/render.yaml) to configure the web service using the multi-stage `Dockerfile`.
2. **Environment Variables Configured in Blueprint**:
   - `TRUSTHEART_TRUST_PROXY`: `true` (enables proxy header parsing).
   - `TRUSTHEART_TRUSTED_PROXY_HOPS`: `1` (takes the 1st IP from the right of `X-Forwarded-For`; verify with `scripts/smoke_deployed.py` post-deploy).
   - `TRUSTHEART_RATE_LIMIT`: `60` (requests per minute).
   - *Note*: `PORT` is automatically injected by Render (no manual specification required).
3. **Operational Notes & Architecture Limitations**:
   - **Pre-deployment Status**: `Dockerfile` and `render.yaml` are untested until the first real deploy.
   - **Worker Architecture**: Run with a **single worker only** because the IP sliding-window rate limiter is stored in-memory in `backend/app/security.py`. Multi-worker deployments would fragment rate limit tracking.
   - **Cold Start & Model Load Time**: On Render's Free tier, services spin down after 15 minutes of inactivity. Cold starts take approximately 30–60 seconds to boot the container; once the Python process starts, model loading and artifact verification take **~2.2 seconds** before `/api/health` returns HTTP 200.
4. **Post-Deployment Verification**:
   Run the remote smoke test against the live Render URL:
   ```powershell
   python scripts/smoke_deployed.py https://<your-service-name>.onrender.com
   ```


