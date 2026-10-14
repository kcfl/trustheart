"""Generate representative API response examples using TestClient.

Writes:
  - docs/api_examples/quick_p10.json
  - docs/api_examples/full_median_3missing.json
"""

import json
import sys
from pathlib import Path

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi.testclient import TestClient
from backend.app.main import app


def save_api_examples() -> None:
    client = TestClient(app)
    out_dir = REPO_ROOT / "docs" / "api_examples"
    out_dir.mkdir(parents=True, exist_ok=True)

    samples_res = client.get("/api/samples")
    assert samples_res.status_code == 200, samples_res.text
    samples = samples_res.json()["samples"]

    # 1. Quick mode with sample p10 (case_id 293)
    p10 = next(s for s in samples if s["label"] == "p10")
    res_quick = client.post(
        "/api/predict",
        json={
            "mode": "quick",
            "inputs": p10["inputs"],
            "case_id": p10["case_id"],
        },
    )
    assert res_quick.status_code == 200, res_quick.text
    quick_json_path = out_dir / "quick_p10.json"
    with open(quick_json_path, "w", encoding="utf-8") as f:
        json.dump(res_quick.json(), f, indent=2)
        f.write("\n")
    print(f"Wrote {quick_json_path}")

    # 2. Full mode with sample median (case_id 125), with 3 missing features dropped
    median_sample = next(s for s in samples if s["label"] == "median")
    median_inputs = dict(median_sample["inputs"])
    for dropped_feature in ["Region RWMA", "EF-TTE", "LDL"]:
        median_inputs.pop(dropped_feature, None)

    res_full = client.post(
        "/api/predict",
        json={
            "mode": "full",
            "inputs": median_inputs,
            "case_id": median_sample["case_id"],
        },
    )
    assert res_full.status_code == 200, res_full.text
    full_json_path = out_dir / "full_median_3missing.json"
    with open(full_json_path, "w", encoding="utf-8") as f:
        json.dump(res_full.json(), f, indent=2)
        f.write("\n")
    print(f"Wrote {full_json_path}")


if __name__ == "__main__":
    save_api_examples()
