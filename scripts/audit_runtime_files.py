"""Audit all files opened inside the repo during backend startup and one /api/predict call."""

import os
import sys
from pathlib import Path

opened_files = set()
REPO_ROOT = Path(__file__).resolve().parent.parent

def audit_hook(event, args):
    if event == "open":
        file_path = args[0]
        # file_path may be a str, Path, or file descriptor (int)
        if isinstance(file_path, (str, Path)):
            try:
                p = Path(file_path).resolve()
                if p.is_relative_to(REPO_ROOT):
                    rel = p.relative_to(REPO_ROOT)
                    # Filter out .venv, .git, and temporary files
                    parts = rel.parts
                    if not any(part.startswith(".venv") or part == ".git" or part == "__pycache__" for part in parts):
                        opened_files.add(str(rel).replace("\\", "/"))
            except Exception:
                pass

sys.addaudithook(audit_hook)

sys.path.insert(0, str(REPO_ROOT))

# Now import backend and run startup and predict
from fastapi.testclient import TestClient
from backend.app.main import app

def main():
    print("Executing startup and predict under open-audit hook...")
    with TestClient(app) as client:
        # 1. Health check (triggers lifespan startup if not already run)
        r_health = client.get("/api/health")
        assert r_health.status_code == 200, f"Health check failed: {r_health.text}"

        # 2. Get samples to retrieve sample 0 inputs
        r_samples = client.get("/api/samples")
        assert r_samples.status_code == 200, f"Samples check failed: {r_samples.text}"
        sample_0 = r_samples.json()["samples"][0]

        # 3. Predict call for sample 0 (quick mode)
        r_pred_q = client.post("/api/predict", json={"mode": "quick", "inputs": sample_0["inputs"]})
        assert r_pred_q.status_code == 200, f"Predict quick failed: {r_pred_q.text}"

        # 4. Predict call for sample 0 (full mode)
        r_pred_f = client.post("/api/predict", json={"mode": "full", "inputs": sample_0["inputs"]})
        assert r_pred_f.status_code == 200, f"Predict full failed: {r_pred_f.text}"

        # 5. Access frontend root to record static file access
        r_root = client.get("/")
        assert r_root.status_code == 200

    out_file = REPO_ROOT / "docs" / "verification" / "runtime_files.txt"
    out_file.parent.mkdir(parents=True, exist_ok=True)

    # Sort files
    sorted_files = sorted(list(opened_files))
    with open(out_file, "w", encoding="utf-8") as f:
        for item in sorted_files:
            f.write(item + "\n")

    print(f"Recorded {len(sorted_files)} unique repository files opened during runtime.")
    for item in sorted_files:
        print(f"  {item}")

if __name__ == "__main__":
    main()
