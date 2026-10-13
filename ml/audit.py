"""Dataset audit script for TrustHeart 3D.

Computes comprehensive clinical and technical data profiles, validates
encoding sanity, verifies target consistency, and exports reports.

Run with:
    python -m ml.audit
"""

import json
from pathlib import Path
from typing import Any
import pandas as pd

from ml.config import COMPACT_FEATURES, REPORTS_DIR, TARGETS
from ml.data import load_features, load_raw, load_targets


def run_audit() -> dict[str, Any]:
    """Execute full dataset audit and return audit results dictionary.

    Returns
    -------
    dict[str, Any]
        Structured dictionary containing all computed metrics.
    """
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    features_df = load_features(raw_df)

    # 1. Dataset Shape and Data Hygiene
    raw_shape = list(raw_df.shape)
    missing_total = int(raw_df.isna().sum().sum())
    duplicates_count = int(raw_df.duplicated().sum())
    encoded_feature_count = int(features_df.shape[1])

    # 2. String Columns Unique Values
    string_columns_uniques: dict[str, list[Any]] = {}
    for col in raw_df.columns:
        if not pd.api.types.is_numeric_dtype(raw_df[col]):
            string_columns_uniques[col] = raw_df[col].dropna().unique().tolist()

    # 3. Target Class Counts and Prevalence
    target_summary: dict[str, dict[str, Any]] = {}
    for target in TARGETS:
        counts = targets_df[target].value_counts().to_dict()
        count_0 = int(counts.get(0, 0))
        count_1 = int(counts.get(1, 0))
        total = count_0 + count_1
        prevalence_pct = round((count_1 / total * 100.0), 2) if total > 0 else 0.0
        target_summary[target] = {
            "count_0_normal": count_0,
            "count_1_positive": count_1,
            "total": total,
            "prevalence_pct": prevalence_pct,
        }

    # 4. Demographics (Age and Sex)
    age_min = int(raw_df["Age"].min())
    age_max = int(raw_df["Age"].max())
    age_mean = round(float(raw_df["Age"].mean()), 2)
    sex_counts = {str(k): int(v) for k, v in raw_df["Sex"].value_counts().items()}

    # 5. Target Consistency Check: CAD == max(LAD, LCX, RCA)
    artery_cols = ["LAD", "LCX", "RCA"]
    max_artery = targets_df[artery_cols].max(axis=1)
    cad_series = targets_df["CAD"]
    matches = (cad_series == max_artery)
    matching_rows_count = int(matches.sum())
    total_rows = len(raw_df)

    mismatch_indices = raw_df[~matches].index.tolist()
    mismatch_details: list[dict[str, Any]] = []
    for idx in mismatch_indices:
        raw_row = raw_df.loc[idx]
        mismatch_details.append(
            {
                "index": int(idx),
                "Cath": str(raw_row["Cath"]),
                "LAD": str(raw_row["LAD"]),
                "LCX": str(raw_row["LCX"]),
                "RCA": str(raw_row["RCA"]),
                "CAD_binary": int(targets_df.loc[idx, "CAD"]),
                "max_artery_binary": int(max_artery.loc[idx]),
            }
        )

    # 6. Joint Artery Stenosis Patterns (LAD, LCX, RCA as 3-bit string)
    joint_patterns_series = (
        targets_df["LAD"].astype(str)
        + targets_df["LCX"].astype(str)
        + targets_df["RCA"].astype(str)
    )
    joint_pattern_counts = {
        pattern: int(count)
        for pattern, count in joint_patterns_series.value_counts().items()
    }

    # 7. Verification of Compact Feature Set
    missing_compact = [f for f in COMPACT_FEATURES if f not in features_df.columns]
    compact_features_present = len(missing_compact) == 0

    audit_results: dict[str, Any] = {
        "raw_shape": raw_shape,
        "missing_values_total": missing_total,
        "duplicate_rows_count": duplicates_count,
        "num_encoded_feature_columns": encoded_feature_count,
        "targets": target_summary,
        "demographics": {
            "age_min": age_min,
            "age_max": age_max,
            "age_mean": age_mean,
            "sex_counts": sex_counts,
        },
        "raw_string_columns_unique_values": string_columns_uniques,
        "target_consistency_check": {
            "formula": "CAD == max(LAD, LCX, RCA)",
            "matching_rows": matching_rows_count,
            "total_rows": total_rows,
            "match_rate_pct": round(matching_rows_count / total_rows * 100.0, 2),
            "mismatch_count": len(mismatch_details),
            "mismatch_rows": mismatch_details,
        },
        "joint_artery_patterns_3bit": joint_pattern_counts,
        "compact_features_check": {
            "all_present": compact_features_present,
            "expected_features": COMPACT_FEATURES,
            "missing_features": missing_compact,
        },
    }

    return audit_results


def print_audit_report(results: dict[str, Any]) -> None:
    """Print readable audit report to stdout."""
    print("=" * 70)
    print(" TRUSTHEART 3D - DATASET AUDIT REPORT")
    print("=" * 70)

    print("\n1. DATASET OVERVIEW & INTEGRITY:")
    print(f"   Raw Shape:                     {results['raw_shape'][0]} rows x {results['raw_shape'][1]} columns")
    print(f"   Missing Values Total:          {results['missing_values_total']}")
    print(f"   Duplicate Rows Count:          {results['duplicate_rows_count']}")
    print(f"   Model Input Columns (Encoded): {results['num_encoded_feature_columns']}")

    print("\n2. DEMOGRAPHICS:")
    dem = results["demographics"]
    print(f"   Age Range:                     {dem['age_min']} to {dem['age_max']} years (mean: {dem['age_mean']})")
    print(f"   Sex Counts:                    {dem['sex_counts']}")

    print("\n3. TARGET DISTRIBUTIONS & PREVALENCE:")
    for tgt, stats in results["targets"].items():
        print(
            f"   {tgt:4s}: Normal (0) = {stats['count_0_normal']:3d} | "
            f"Positive (1) = {stats['count_1_positive']:3d} | "
            f"Prevalence = {stats['prevalence_pct']:6.2f}%"
        )

    print("\n4. RAW STRING-TYPED COLUMNS & UNIQUE VALUES:")
    for col, vals in results["raw_string_columns_unique_values"].items():
        print(f"   - {col:25s}: {vals}")

    print("\n5. TARGET CONSISTENCY CHECK [CAD == max(LAD, LCX, RCA)]:")
    chk = results["target_consistency_check"]
    print(f"   Matching rows:                 {chk['matching_rows']} / {chk['total_rows']} ({chk['match_rate_pct']}%)")
    print(f"   Mismatching rows count:        {chk['mismatch_count']}")
    if chk["mismatch_rows"]:
        print("   Mismatching Row Details:")
        for mm in chk["mismatch_rows"]:
            print(
                f"     * Index {mm['index']}: Cath='{mm['Cath']}' (CAD={mm['CAD_binary']}) | "
                f"LAD='{mm['LAD']}', LCX='{mm['LCX']}', RCA='{mm['RCA']}' "
                f"(max_artery={mm['max_artery_binary']})"
            )
    else:
        print("   No mismatching rows found.")

    print("\n6. JOINT ARTERY PATTERNS (LAD, LCX, RCA as 3-bit 'LAD-LCX-RCA'):")
    for pattern, count in results["joint_artery_patterns_3bit"].items():
        pct = count / results["raw_shape"][0] * 100.0
        print(f"   Pattern '{pattern}': {count:3d} rows ({pct:5.2f}%)")

    print("\n7. COMPACT FEATURES PRESENCE CHECK:")
    cf = results["compact_features_check"]
    print(f"   All {len(cf['expected_features'])} compact features present? {cf['all_present']}")
    if not cf["all_present"]:
        print(f"   Missing: {cf['missing_features']}")
    print("=" * 70)


def save_reports(results: dict[str, Any], reports_dir: Path | None = None) -> None:
    """Save JSON and Markdown audit reports to reports directory.

    Parameters
    ----------
    results : dict[str, Any]
        Audit results dictionary.
    reports_dir : Path | None, optional
        Target directory. Defaults to ml.config.REPORTS_DIR.
    """
    out_dir = reports_dir or REPORTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    # 1. Save JSON
    json_path = out_dir / "data_audit.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # 2. Save Markdown
    md_path = out_dir / "data_audit.md"
    dem = results["demographics"]
    chk = results["target_consistency_check"]

    md_content = f"""# TrustHeart 3D - Data Audit Report

Audit report generated on dataset: **Extension of Z-Alizadeh Sani dataset** (UCI ID 411).

## 1. Overview & Data Hygiene

| Metric | Value |
|---|---|
| **Raw Dataset Shape** | {results['raw_shape'][0]} rows × {results['raw_shape'][1]} columns |
| **Missing Values Total** | {results['missing_values_total']} |
| **Duplicate Rows Count** | {results['duplicate_rows_count']} |
| **Model Feature Count (Encoded)** | {results['num_encoded_feature_columns']} |

## 2. Demographics

- **Age**: Min {dem['age_min']}, Max {dem['age_max']}, Mean {dem['age_mean']}
- **Sex Distribution**:
  - Male: {dem['sex_counts'].get('Male', 0)}
  - Fmale: {dem['sex_counts'].get('Fmale', 0)}

## 3. Target Distribution & Prevalence

| Target | Description | Normal (0) | Positive (1) | Prevalence (%) |
|---|---|---|---|---|
| **CAD** | Coronary Artery Disease (Cath) | {results['targets']['CAD']['count_0_normal']} | {results['targets']['CAD']['count_1_positive']} | {results['targets']['CAD']['prevalence_pct']}% |
| **LAD** | Left Anterior Descending Artery | {results['targets']['LAD']['count_0_normal']} | {results['targets']['LAD']['count_1_positive']} | {results['targets']['LAD']['prevalence_pct']}% |
| **LCX** | Left Circumflex Artery | {results['targets']['LCX']['count_0_normal']} | {results['targets']['LCX']['count_1_positive']} | {results['targets']['LCX']['prevalence_pct']}% |
| **RCA** | Right Coronary Artery | {results['targets']['RCA']['count_0_normal']} | {results['targets']['RCA']['count_1_positive']} | {results['targets']['RCA']['prevalence_pct']}% |

## 4. Target Consistency Check: `CAD == max(LAD, LCX, RCA)`

- **Matching Rows**: {chk['matching_rows']} / {chk['total_rows']} ({chk['match_rate_pct']}%)
- **Mismatch Count**: {chk['mismatch_count']}

### Mismatch Details:
"""
    if chk["mismatch_rows"]:
        md_content += """| Row Index | Cath (Raw) | CAD (Binary) | LAD | LCX | RCA | Max Artery |
|---|---|---|---|---|---|---|
"""
        for mm in chk["mismatch_rows"]:
            md_content += (
                f"| {mm['index']} | {mm['Cath']} | {mm['CAD_binary']} | "
                f"{mm['LAD']} | {mm['LCX']} | {mm['RCA']} | {mm['max_artery_binary']} |\n"
            )
    else:
        md_content += "No mismatching rows detected.\n"

    md_content += "\n## 5. Joint Artery Stenosis Patterns (`LAD-LCX-RCA`)\n\n"
    md_content += "| 3-Bit Pattern | Count | Percentage (%) |\n|---|---|---|\n"
    for pattern, count in results["joint_artery_patterns_3bit"].items():
        pct = round(count / results["raw_shape"][0] * 100.0, 2)
        md_content += f"| `{pattern}` | {count} | {pct}% |\n"

    md_content += "\n## 6. Raw String Columns and Unique Values\n\n"
    for col, vals in results["raw_string_columns_unique_values"].items():
        md_content += f"- **{col}**: `{vals}`\n"

    md_content += "\n## 7. Compact Features Verification\n\n"
    md_content += f"- All compact features present: **{results['compact_features_check']['all_present']}**\n"
    for feat in results["compact_features_check"]["expected_features"]:
        md_content += f"  - `{feat}`\n"

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)


def main() -> None:
    """Execute audit, print to terminal, and export reports."""
    results = run_audit()
    print_audit_report(results)
    save_reports(results)


if __name__ == "__main__":
    main()
