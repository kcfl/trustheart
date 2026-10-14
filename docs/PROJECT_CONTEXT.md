# TrustHeart 3D - project context (read this first in every new session)

Goal: Multimodal AI Hackathon 2026, Track A. Predict overall CAD and LAD/LCX/RCA stenosis from clinical data (UCI dataset #411, 303 patients), map predicted probabilities onto an interactive 3D heart, explain predictions, show a clinical disclaimer.

Working rules
- Windows PowerShell, repo root e:\iit mandi\trustheart, venv .venv (Python 3.12). Stay inside the repo. Never fabricate data. When asked for raw output, print it verbatim, do not summarise.
- Leakage rule: LAD, LCX, RCA and Cath are never model inputs.
- ML artifacts are frozen at git tag ml-v1 (models/*.joblib verified by models/manifest.json). Do not retrain or change them without running scripts\rebuild.ps1 and saying so.

Modes
- "auto": best configuration per target chosen by nested CV (simplest model within 1 SE of the best).
- "quick": 7 inputs only (Age, Sex, Typical Chest Pain, Atypical, Nonanginal, DM, HTN).

Trust Layer (our differentiator)
- Coherence: CAD = OR(LAD, LCX, RCA) by dataset definition, so max(vessel p) <= P(CAD) <= min(1, sum of vessel p); P(CAD) is clipped into that band and flagged.
- Similar patients: z-score kNN over the available inputs; return only case_id, distance, age band, sex, outcomes.
- Explanation stability: 30 bootstrap refits; tags stable/moderate/unstable (rule v2: top-3 for 7-feature models, top-5 for the full set).
- Lift: how much the full feature set adds over quick mode, per target.

UI / medical rules
- Show per-vessel predicted probability, NOT lesion location.
- What-if sliders are "model sensitivity", not treatment effect.
- Persistent visible disclaimer: decision support / educational only, not a substitute for formal diagnostic imaging.
- Do not store or log patient inputs.

Reporting rules
- Report nested-CV numbers. Intervals over repeats are descriptive, not significance tests.

Roadmap: Step 6 FastAPI backend; Step 7 frontend and 3D heart; Step 8 dashboard and Trust panel; Step 9 Docker, 6-page report, demo video.
