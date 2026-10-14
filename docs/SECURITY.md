# TrustHeart 3D — Security Architecture & Threat Model

This document outlines the security architecture, threat model, protective controls, and automated vulnerability audits for the TrustHeart 3D application.

---

## 1. Threat Model & Asset Protection

| Threat Vector | Potential Impact | Implemented Mitigation | Verification Test |
|---|---|---|---|
| **PHI / PII Data Leakage** | Exposure of patient clinical inputs or identifiers | Pure stateless inference; zero persistence; input stripping from all application logs | `test_13_zero_phi_logging_enforcement`, `test_23_body_size_limit_and_zero_body_logging` |
| **Model Artifact Tampering** | Malicious alteration of prediction weights or thresholds | Startup cryptographic verification against SHA-256 manifest; fail-closed execution | `test_15_startup_fails_closed_on_tampering` |
| **Data Leakage in Inference** | Unfair diagnostic advantage or corrupted evaluation | Strict validator rejections of `LEAK_COLS` and catheterization terms (`Cath`) | `test_8_invalid_input_rejections_422` |
| **Denial of Service (DoS)** | Exhaustion of server memory via large payloads or request flooding | 20 KB strict request body limit; in-memory sliding window rate limiter | `test_10_rate_limiting_429`, `test_11_request_body_size_limit_413`, `test_26_proxy_aware_rate_limiting` |
| **Cross-Site Scripting (XSS)** | Injection of malicious client scripts via web browser | Route-differentiated Content Security Policy (CSP); strict nosniff and frame headers | `test_12_security_headers_and_cors`, `test_24_csp_headers_per_route_type` |
| **Cross-Origin Abuse** | Unauthorized third-party cross-origin requests | Explicit CORS origin whitelist; wildcards disallowed | `test_12_security_headers_and_cors`, `test_20_cors_headers_with_origin` |
| **Directory Traversal** | Exfiltration of server filesystem assets via static routes | Canonical path resolution (`Path.resolve()`) + boundary containment (`is_relative_to`) | `test_25_raw_asgi_path_traversal_hardening` |

---

## 2. Privacy & Zero-PHI Logging Enforcement

The application strictly guarantees that patient clinical data is processed ephemerally in volatile memory and never persisted:
- **No Database or Disk Storage**: Patient input records are never written to disk, databases, or caches.
- **Log Sanitation**: The application logger records strictly HTTP method, route path, status code, and execution duration. Request bodies, patient dictionary keys, clinical values, and case IDs are never formatted into log strings.
- **Citations**: Enforced by [`test_13_zero_phi_logging_enforcement`](file:///e:/iit%20mandi/trustheart/tests/test_api.py#L563-L585) (which sends sentinel floating point values and asserts zero leakage) and [`test_23_body_size_limit_and_zero_body_logging`](file:///e:/iit%20mandi/trustheart/tests/test_api.py#L882-L902).

---

## 3. Fail-Closed Cryptographic Model Integrity

To ensure that machine learning weights, calibrators, and baseline statistics cannot be replaced or modified:
- During application lifespan initialization (`backend/app/main.py`), `get_model_service()` executes `ModelService.__init__`.
- Every model file declared in `models/manifest.json` is hashed with SHA-256 and compared to the frozen reference digest.
- If any file is missing or exhibits a mismatched hash, the backend raises a fatal `RuntimeError("Integrity check failed: ...")` and aborts server boot.
- **Citation**: Enforced by [`test_15_startup_fails_closed_on_tampering`](file:///e:/iit%20mandi/trustheart/tests/test_api.py#L617-L636).

---

## 4. Input Validation & Strict Bounds

All incoming payloads are validated via Pydantic schemas in [`backend/app/schemas.py`](file:///e:/iit%20mandi/trustheart/backend/app/schemas.py). Unknown attributes and data leakage columns trigger HTTP 422 rejections.

Physiologic and dataset validity bounds defined in `backend/app/schemas.py`:
- **Continuous and Ordinal Features** ([`backend/app/schemas.py:27-51`](file:///e:/iit%20mandi/trustheart/backend/app/schemas.py#L27-L51)):
  ```python
  HARD_FEATURE_RANGES: dict[str, tuple[float, float]] = {
      "Age": (0.0, 120.0),
      "Weight": (10.0, 400.0),
      "Length": (50.0, 260.0),
      "BMI": (10.0, 100.0),
      "BP": (30.0, 300.0),
      "PR": (30.0, 250.0),
      "FBS": (20.0, 1200.0),
      "CR": (0.1, 30.0),
      "TG": (10.0, 3000.0),
      "LDL": (5.0, 1000.0),
      "HDL": (5.0, 300.0),
      "BUN": (1.0, 300.0),
      "ESR": (0.0, 200.0),
      "HB": (3.0, 25.0),
      "K": (1.0, 10.0),
      "Na": (90.0, 200.0),
      "WBC": (500.0, 150000.0),
      "Lymph": (0.0, 100.0),
      "Neut": (0.0, 100.0),
      "PLT": (5.0, 2500.0),
      "EF-TTE": (5.0, 95.0),
      "Region RWMA": (0.0, 4.0),
      "Function Class": (0.0, 3.0),
  }
  ```
- **Binary Features** ([`backend/app/schemas.py:53-82`](file:///e:/iit%20mandi/trustheart/backend/app/schemas.py#L53-L82)): Validated to `0`, `1`, `True`, or `False`. Non-finite numbers (`NaN`, `Inf`) and invalid integers are rejected.
- **Categorical Features** ([`backend/app/schemas.py:152-174`](file:///e:/iit%20mandi/trustheart/backend/app/schemas.py#L152-L174)):
  - `Sex`: `'Male'`, `'Female'`, or numeric `0`/`1`.
  - `VHD`: Restricted to `['N', 'mild', 'Moderate', 'Severe']`.
  - `BBB`: Restricted to `['N', 'LBBB', 'RBBB']`.
- **Target Leakage Prohibition** ([`backend/app/schemas.py:99-105`](file:///e:/iit%20mandi/trustheart/backend/app/schemas.py#L99-L105)): Rejects `CAD`, `LAD`, `LCX`, `RCA`, or any column containing `'Cath'`.

---

## 5. Network Hardening, CORS, CSP & Proxy Configuration

### CORS Configuration
- Controlled via `CORS_ORIGINS` / `TRUSTHEART_ORIGINS` environment variables.
- Default: `http://localhost:5173,http://127.0.0.1:5173` (no wildcard `*` allowed).
- Verified by [`test_20_cors_headers_with_origin`](file:///e:/iit%20mandi/trustheart/tests/test_api.py#L765-L790).

### Content Security Policy (CSP) per Route Type
Differentiated dynamically in `backend/app/security.py` ([`backend/app/security.py:102-115`](file:///e:/iit%20mandi/trustheart/backend/app/security.py#L102-L115)):
- **API & Documentation Routes** (`/api/*`, `/docs`, `/openapi.json`):
  ```http
  Content-Security-Policy: default-src 'none'
  ```
- **HTML & Static Assets** (`/`, `/assets/*`):
  ```http
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; frame-ancestors 'none'
  ```
- Additional security headers attached to all responses:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - `Cache-Control: no-store` (on `/api/predict`)

### Rate Limiting & Proxy Configuration
- **Request Body Limit**: Strict 20 KB limit (`MAX_REQUEST_BODY_BYTES = 20 * 1024`). Over-limit payloads return HTTP 413.
- **Rate Limiting**: Sliding window in-memory limiter tracking requests per 60-second window. Returns HTTP 429 with `Retry-After`.
- **Proxy Header Security (`TRUSTHEART_TRUST_PROXY`)**:
  - `TRUSTHEART_TRUST_PROXY=false` (Default): All `X-Forwarded-For` headers are completely ignored, and rate limiting tracks the socket client IP (`request.client.host`). Prevents header spoofing attacks.
  - `TRUSTHEART_TRUST_PROXY=true`: Extracts the client IP from the first comma-separated entry of `X-Forwarded-For`.
  - **WARNING**: `TRUSTHEART_TRUST_PROXY=true` MUST ONLY be enabled when the application runs behind a trusted, properly configured reverse proxy (such as Nginx, Traefik, or an AWS/GCP cloud load balancer) that strips untrusted external client headers. Enabling this flag in direct public exposures permits rate-limit circumvention via spoofed client headers.
- **Configurable Environment Variables**:
  - `TRUSTHEART_RATE_LIMIT`: Maximum allowed requests per 60-second window per IP (default: `60`).
  - `TRUSTHEART_TRUST_PROXY`: Boolean flag (`true`/`false`) controlling whether `X-Forwarded-For` is parsed (default: `false`).
  - `CORS_ORIGINS`: Comma-separated list of allowed CORS origins (default: `http://localhost:5173,http://127.0.0.1:5173`).
  - `PORT`: Server bind port (default: `8000`).
  - `TRUSTHEART_MODELS_DIR`: Directory path for model artifacts (default: `models`).
  - `TRUSTHEART_REPORTS_DIR`: Directory path for reports (default: `reports`).

---

## 6. Static Path Traversal Hardening

To serve the React SPA alongside API endpoints without risk of directory traversal attacks:
- Static request paths in `backend/app/main.py` ([`backend/app/main.py:101-118`](file:///e:/iit%20mandi/trustheart/backend/app/main.py#L101-L118)) are decoded via `urllib.parse.unquote()` and resolved against the absolute filesystem path via `Path.resolve()`.
- The resolved path is verified via Python 3.9+ `is_relative_to(dist_resolved)`:
  ```python
  candidate = (dist_resolved / unquote(full_path)).resolve()
  if not candidate.is_relative_to(dist_resolved):
      raise HTTPException(status_code=404, detail="File not found")
  ```
- Verified by [`test_25_raw_asgi_path_traversal_hardening`](file:///e:/iit%20mandi/trustheart/tests/test_api.py#L947-L1002), which proves raw ASGI traversal scopes (`/../models/manifest.json`, `/%2e%2e/models/manifest.json`, `/..\\models\\manifest.json`) fail to leak any internal filesystem files.

---

## 7. Automated Dependency Vulnerability Audits

Both frontend and backend dependencies have been evaluated with production vulnerability scanners:

### Frontend Audit (`npm.cmd audit --omit=dev`)
Executed inside `frontend/`:
```text
found 0 vulnerabilities
```

### Backend Runtime Audit (`pip-audit -r requirements-runtime.txt`)
Executed using `pip-audit 2.10.1` against pinned runtime dependencies:
```text
No known vulnerabilities found
```
