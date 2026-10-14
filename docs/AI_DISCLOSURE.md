DRAFT: confirm against the hackathon Submission Guidelines before submitting.

# AI Assistance & Tools Disclosure

## Hackathon Submission Disclosure

This document discloses the use of generative AI and automated developer tooling in the conception, development, and verification of the **TrustHeart 3D** project for the **Multimodal AI Hackathon 2026** (Track A).

### 1. Conceptualization, Prompting & Workflow Planning
- **Planning & Workflow Engineering**: Architectural workflow design, statistical validation protocol formulation, and step-by-step task breakdown were designed and directed by the human engineering team.
- **Human Oversight**: Problem framing, domain adaptation for coronary artery stenosis modeling, selection of the Fréchet coherence bounds formulation, and clinical disclaimer definitions were authored and directed by the human team.

### 2. Code Generation & Interactive Development
- **Code Generation & Pair Programming**: Implementation of backend modules (`backend/app/*`), machine learning pipelines (`ml/*`), test suites (`tests/*`), and 3D frontend visual components (`frontend/src/*`) was generated and pair-programmed with **Gemini** within the **Google Antigravity IDE**.
- **Execution & Integration**: All code synthesis occurred under strict pair programming guidelines, adhering to deterministic random seeds, frozen artifact constraints, zero-leakage assertions, and rigorous type enforcement.

### 3. Human Review & Independent Verification
- Every code module, model artifact, and API endpoint underwent systematic human review and deterministic validation using automated independent verification scripts:
  - `scripts/independent_check.py`: An independent verification harness verifying data leakage absence, model calibration, monotonicity, and contract stability without relying on shared internal helpers.
  - `scripts/verify_artifacts.py`: Cryptographic SHA-256 manifest verification, model-to-report parity checks, live test client evaluation across patient scenarios, and repository cleanliness checks.
  - `pytest`: Automated test suite covering health endpoints, prediction mechanics, privacy enforcement, rate limiting, and raw ASGI path traversal hardening.

### 4. Integrity Statement
All benchmark metrics, cross-validation statistics, and calibration coefficients reported in documentation and presented in the user interface are generated directly by reproducible computational scripts from frozen dataset runs. No performance numbers, probabilities, or patient cases were fabricated or manually altered.
