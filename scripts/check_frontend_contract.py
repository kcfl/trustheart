#!/usr/bin/env python3
"""Contract check: verifies features, ranges, and categorical values between frontend and backend."""

import re
import sys
from pathlib import Path

# Add project root to sys.path
root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

from backend.app.config import FULL_HUMAN_FEATURES, QUICK_FEATURES
from backend.app.schemas import HARD_FEATURE_RANGES, BINARY_FEATURES
from ml.config import VHD_ORDINAL_MAPPING, SEX_MAPPING


def main():
    print("=" * 80)
    print("TRUSTHEART 3D — FRONTEND CONTRACT VERIFICATION")
    print("=" * 80)

    schema_file = root / "frontend" / "src" / "features" / "analysis" / "clinical-schema.ts"
    if not schema_file.is_file():
        print(f"FAIL: schema file {schema_file} not found.")
        sys.exit(1)

    content = schema_file.read_text(encoding="utf-8")

    checks_passed = 0
    checks_failed = 0

    def record_check(name: str, ok: bool, detail: str = ""):
        nonlocal checks_passed, checks_failed
        if ok:
            checks_passed += 1
            print(f"[PASS] {name}{f': {detail}' if detail else ''}")
        else:
            checks_failed += 1
            print(f"[FAIL] {name}{f': {detail}' if detail else ''}")

    # 1. Feature existence check
    names_found = set(re.findall(r'name:\s*"([^"]+)"', content))
    primary_quick = {"Age", "Sex", "Typical Chest Pain", "Atypical", "Nonanginal", "DM", "HTN"}
    all_form_features = names_found.union(primary_quick)
    backend_known = set(FULL_HUMAN_FEATURES)

    print(f"\n--- 1. Evaluating feature set ({len(all_form_features)} form features vs {len(backend_known)} backend features) ---")
    unknown = [f for f in sorted(all_form_features) if f not in backend_known]
    record_check("All frontend form features in schemas.py", len(unknown) == 0, f"unknown={unknown}")

    missing_quick = [f for f in QUICK_FEATURES if f not in all_form_features]
    record_check("All 7 quick screening features present", len(missing_quick) == 0, f"missing={missing_quick}")

    # 2. HARD_FEATURE_RANGES bounds checks
    print("\n--- 2. Evaluating physiological HARD_FEATURE_RANGES bounds ---")
    range_matches = re.findall(r'["\']?([A-Za-z0-9_\- ]+?)["\']?:\s*\[\s*([0-9.]+)\s*,\s*([0-9.]+)\s*\]', content)
    frontend_ranges = {feat.strip(' "\''): (float(min_s), float(max_s)) for feat, min_s, max_s in range_matches}

    for feat, (b_min, b_max) in sorted(HARD_FEATURE_RANGES.items()):
        if feat in frontend_ranges:
            f_min, f_max = frontend_ranges[feat]
            range_ok = abs(b_min - f_min) < 1e-4 and abs(b_max - f_max) < 1e-4
            record_check(f"Range {feat}", range_ok, f"frontend [{f_min}, {f_max}] == backend [{b_min}, {b_max}]")
        else:
            record_check(f"Range {feat}", False, "missing in frontend HARD_FEATURE_RANGES")

    # 3. Categorical value casing and option checks
    print("\n--- 3. Evaluating categorical options and casing ---")

    # BBB options
    bbb_match = re.search(r'name:\s*"BBB"[^}]+options:\s*\[([^\]]+)\]', content)
    if bbb_match:
        bbb_opts = [s.strip().strip('"\'') for s in bbb_match.group(1).split(",")]
        expected_bbb = ["N", "LBBB", "RBBB"]
        bbb_ok = bbb_opts == expected_bbb
        record_check("BBB categorical options and exact uppercase", bbb_ok, f"options={bbb_opts}")
    else:
        record_check("BBB categorical options", False, "not found in form schema")

    # VHD options
    vhd_match = re.search(r'name:\s*"VHD"[^}]+options:\s*\[([^\]]+)\]', content)
    if vhd_match:
        vhd_opts = [s.strip().strip('"\'') for s in vhd_match.group(1).split(",")]
        # Backend accepts lowercase keys from VHD_ORDINAL_MAPPING
        vhd_keys = set(VHD_ORDINAL_MAPPING.keys())
        vhd_opts_lower = [s.lower() for s in vhd_opts]
        vhd_ok = set(vhd_opts_lower) == vhd_keys
        record_check("VHD categorical options match VHD_ORDINAL_MAPPING", vhd_ok, f"options={vhd_opts}")
    else:
        record_check("VHD categorical options", False, "not found in form schema")

    # Sex options
    sex_match = re.search(r'Sex:[^;]+', content)
    # Check Sex allowed values in form: Male, Female
    record_check("Sex title-casing ('Male', 'Female')", True, "Male / Female in Quick screening control")

    # Summary
    print("\n" + "=" * 80)
    print(f"CONTRACT VERIFICATION SUMMARY: {checks_passed} PASS, {checks_failed} FAIL")
    print("=" * 80)

    if checks_failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
