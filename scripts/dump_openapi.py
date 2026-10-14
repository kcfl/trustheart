"""Dump OpenAPI schema from FastAPI application to docs/openapi.json."""

import json
import sys
from pathlib import Path

# Ensure repo root is on sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.main import app


def dump_openapi() -> None:
    schema = app.openapi()
    out_path = REPO_ROOT / "docs" / "openapi.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2, sort_keys=True)
        f.write("\n")
    print(f"Wrote OpenAPI schema to {out_path}")


if __name__ == "__main__":
    dump_openapi()
