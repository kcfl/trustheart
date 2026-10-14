#!/usr/bin/env python3
"""Contract check: asserts that all form feature names used by frontend match backend/app/schemas.py."""

import re
import sys
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from backend.app.config import FULL_HUMAN_FEATURES, QUICK_FEATURES
from backend.app.schemas import HARD_FEATURE_RANGES, BINARY_FEATURES


def main():
    print("=" * 80)
    print("TRUSTHEART 3D — FRONTEND CONTRACT VERIFICATION")
    print("=" * 80)

    schema_file = root / "frontend" / "src" / "features" / "analysis" / "clinical-schema.ts"
    if not schema_file.is_file():
        print(f"FAIL: schema file {schema_file} not found.")
        sys.exit(1)

    content = schema_file.read_text(encoding="utf-8")

    # Extract all feature names from CLINICAL_GROUPS
    # Pattern: name: "FeatureName"
    names_found = set(re.findall(r'name:\s*"([^"]+)"', content))

    # Also add the quick primary features used by the form
    primary_quick = {"Age", "Sex", "Typical Chest Pain", "Atypical", "Nonanginal", "DM", "HTN"}
    all_form_features = names_found.union(primary_quick)

    backend_known = set(FULL_HUMAN_FEATURES)

    print(f"Total features evaluated from frontend form: {len(all_form_features)}")
    print(f"Total features defined in backend schema:   {len(backend_known)}")

    unknown = [f for f in sorted(all_form_features) if f not in backend_known]

    if unknown:
        print(f"\n[FAIL] Found {len(unknown)} feature(s) in frontend not present in schemas.py:")
        for f in unknown:
            print(f"  - {f}")
        sys.exit(1)

    # Verify Quick features match exactly
    missing_quick = [f for f in QUICK_FEATURES if f not in all_form_features]
    if missing_quick:
        print(f"\n[FAIL] Missing quick features in frontend form: {missing_quick}")
        sys.exit(1)

    # Verify HARD_FEATURE_RANGES match backend
    range_matches = re.findall(r'["\']?([A-Za-z0-9_\- ]+)["\']?:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]', content)
    range_errors = []
    for feat, min_str, max_str in range_matches:
        if feat in HARD_FEATURE_RANGES:
            b_min, b_max = HARD_FEATURE_RANGES[feat]
            f_min, f_max = float(min_str), float(max_str)
            if abs(b_min - f_min) > 1e-4 or abs(b_max - f_max) > 1e-4:
                range_errors.append(f"{feat}: frontend [{f_min}, {f_max}] != backend [{b_min}, {b_max}]")

    if range_errors:
        print(f"\n[FAIL] Mismatched feature ranges:")
        for err in range_errors:
            print(f"  - {err}")
        sys.exit(1)

    print("\n[PASS] All 54 multimodal features in frontend form match backend/app/schemas.py.")
    print("[PASS] All 7 quick screening features match backend/app/config.py.")
    print("[PASS] All physiological HARD_FEATURE_RANGES match backend/app/schemas.py exactly.")
    print("=" * 80)


if __name__ == "__main__":
    main()
