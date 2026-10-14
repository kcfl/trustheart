"""Verify every number in MODEL_CARD.md sections 2, 3, and 4 against source report/model artifacts."""

import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

def load_json(rel_path: str) -> dict:
    with open(REPO_ROOT / rel_path, "r", encoding="utf-8") as f:
        return json.load(f)

def parse_final_selection_md(rel_path: str) -> list[dict]:
    rows = []
    with open(REPO_ROOT / rel_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line.startswith("|") or "Target" in line or "---" in line or "Space" in line:
                continue
            parts = [p.strip() for p in line.strip().strip("|").split("|")]
            if len(parts) >= 8:
                space = parts[0].strip("` ")
                target = parts[1].strip("*` ")
                config_name = "|".join(parts[2:-5]).strip("` ")
                featureset = parts[-5].strip("` ")
                architecture = parts[-4].strip("` ")
                n_features = int(parts[-3].strip("` "))
                platt_a = float(parts[-2].strip("` "))
                platt_b = float(parts[-1].strip("` "))
                rows.append({
                    "space": space,
                    "target": target,
                    "config": config_name,
                    "featureset": featureset,
                    "architecture": architecture,
                    "n_features": n_features,
                    "platt_a": platt_a,
                    "platt_b": platt_b,
                })
    return rows

def main():
    card_path = REPO_ROOT / "docs" / "MODEL_CARD.md"
    if not card_path.is_file():
        print(f"FAIL: {card_path} not found")
        sys.exit(1)

    with open(card_path, "r", encoding="utf-8") as f:
        card_text = f.read()

    # Load source artifacts
    data_audit = load_json("reports/data_audit.json")
    final_selection = parse_final_selection_md("models/final_selection.md")
    nested_res = load_json("reports/nested_results.json")

    checks = []

    def add_check(item: str, card_val: str, source_key: str, expected_val: str):
        match = (card_val.strip() == expected_val.strip())
        checks.append({
            "item": item,
            "card_val": card_val,
            "source": source_key,
            "expected_val": expected_val,
            "status": "MATCH" if match else "MISMATCH",
        })

    # Section 2 checks
    # Dimensions: 303 patients, 59 raw attributes.
    m_dim = re.search(r"(\d+)\s+patients,\s+(\d+)\s+raw attributes", card_text)
    if m_dim:
        add_check("Patients Count", m_dim.group(1), "data_audit.json:raw_shape[0]", str(data_audit["raw_shape"][0]))
        add_check("Raw Attributes", m_dim.group(2), "data_audit.json:raw_shape[1]", str(data_audit["raw_shape"][1]))
    else:
        add_check("Dimensions line", "NOT FOUND", "data_audit.json:raw_shape", "303 patients, 59 raw attributes")

    # Demographics: Age range 30 to 86 years (mean: 58.9 years); Sex: 176 Male, 127 Female.
    m_age = re.search(r"Age range (\d+) to (\d+) years \(mean: ([\d\.]+) years\); Sex: (\d+) Male, (\d+) Female", card_text)
    if m_age:
        demo = data_audit["demographics"]
        add_check("Age Min", m_age.group(1), "data_audit.json:demographics.age_min", str(demo["age_min"]))
        add_check("Age Max", m_age.group(2), "data_audit.json:demographics.age_max", str(demo["age_max"]))
        add_check("Age Mean", m_age.group(3), "data_audit.json:demographics.age_mean", f"{demo['age_mean']:.1f}")
        add_check("Sex Male", m_age.group(4), "data_audit.json:demographics.sex_counts.Male", str(demo["sex_counts"]["Male"]))
        add_check("Sex Female", m_age.group(5), "data_audit.json:demographics.sex_counts.Fmale", str(demo["sex_counts"]["Fmale"]))
    else:
        add_check("Demographics line", "NOT FOUND", "data_audit.json:demographics", "Age range...")

    # Target prevalences
    for tgt in ["CAD", "LAD", "LCX", "RCA"]:
        tgt_data = data_audit["targets"][tgt]
        m_tgt = re.search(rf"\*\*{tgt}\*\*:\s+(\d+)\s+positive\s+\(([\d\.]+)%\),\s+(\d+)\s+normal\s+\(([\d\.]+)%\)", card_text)
        if m_tgt:
            add_check(f"{tgt} Positive Count", m_tgt.group(1), f"data_audit.json:targets.{tgt}.count_1_positive", str(tgt_data["count_1_positive"]))
            add_check(f"{tgt} Positive Pct", m_tgt.group(2), f"data_audit.json:targets.{tgt}.prevalence_pct", f"{tgt_data['prevalence_pct']:.2f}")
            add_check(f"{tgt} Normal Count", m_tgt.group(3), f"data_audit.json:targets.{tgt}.count_0_normal", str(tgt_data["count_0_normal"]))
            add_check(f"{tgt} Normal Pct", m_tgt.group(4), f"data_audit.json:100-targets.{tgt}.prevalence_pct", f"{100.0 - tgt_data['prevalence_pct']:.2f}")
        else:
            add_check(f"{tgt} Line", "NOT FOUND", f"data_audit.json:targets.{tgt}", "counts and pct")

    # Section 3 checks: Models in Table
    for r in final_selection:
        sp = r["space"]
        tgt = r["target"]
        pat = rf"\|\s*`{sp}`\s*\|\s*\*\*{tgt}\*\*\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*(\d+)\s*\|\s*([\d\.\-]+)\s*\|\s*([\d\.\-]+)\s*\|"
        m_row = re.search(pat, card_text)
        if m_row:
            add_check(f"Model {sp} {tgt} Features", m_row.group(3), f"final_selection.md:{sp}_{tgt}_n_features", str(r["n_features"]))
            add_check(f"Model {sp} {tgt} Platt Slope", m_row.group(4), f"final_selection.md:{sp}_{tgt}_platt_a", f"{r['platt_a']:.4f}")
            add_check(f"Model {sp} {tgt} Platt Intercept", m_row.group(5), f"final_selection.md:{sp}_{tgt}_platt_b", f"{r['platt_b']:.4f}")
        else:
            add_check(f"Model {sp} {tgt} Row", "NOT FOUND", f"final_selection.md:{sp}_{tgt}", "table row")

    # Section 4 checks: Nested-CV results
    auto_res = nested_res["results"]["auto"]
    quick_res = nested_res["results"]["quick"]

    for tgt in ["CAD", "LAD", "LCX", "RCA"]:
        # Auto row
        auto_cal = auto_res[tgt]["calibrated"]["summary"]
        pat_auto = rf"\|\s*\*\*{tgt}\*\*\s*\|\s*Auto\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|"
        m_auto = re.search(pat_auto, card_text)
        if m_auto:
            add_check(f"{tgt} Auto ROC-AUC", f"{m_auto.group(1)} ± {m_auto.group(2)}", f"nested_results.json:auto.{tgt}.roc_auc", f"{auto_cal['roc_auc']['mean']:.4f} ± {auto_cal['roc_auc']['std']:.4f}")
            add_check(f"{tgt} Auto PR-AUC", f"{m_auto.group(3)} ± {m_auto.group(4)}", f"nested_results.json:auto.{tgt}.pr_auc", f"{auto_cal['pr_auc']['mean']:.4f} ± {auto_cal['pr_auc']['std']:.4f}")
            add_check(f"{tgt} Auto Brier", f"{m_auto.group(5)} ± {m_auto.group(6)}", f"nested_results.json:auto.{tgt}.brier", f"{auto_cal['brier']['mean']:.4f} ± {auto_cal['brier']['std']:.4f}")
            add_check(f"{tgt} Auto ECE", f"{m_auto.group(7)} ± {m_auto.group(8)}", f"nested_results.json:auto.{tgt}.ece", f"{auto_cal['ece']['mean']:.4f} ± {auto_cal['ece']['std']:.4f}")
        else:
            add_check(f"{tgt} Auto Row", "NOT FOUND", f"nested_results.json:auto.{tgt}", "table row")

        # Quick row
        quick_cal = quick_res[tgt]["calibrated"]["summary"]
        pat_quick = rf"\|\s*\*\*{tgt}\*\*\s*\|\s*Quick\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|\s*([\d\.]+) ± ([\d\.]+)\s*\|"
        m_quick = re.search(pat_quick, card_text)
        if m_quick:
            add_check(f"{tgt} Quick ROC-AUC", f"{m_quick.group(1)} ± {m_quick.group(2)}", f"nested_results.json:quick.{tgt}.roc_auc", f"{quick_cal['roc_auc']['mean']:.4f} ± {quick_cal['roc_auc']['std']:.4f}")
            add_check(f"{tgt} Quick PR-AUC", f"{m_quick.group(3)} ± {m_quick.group(4)}", f"nested_results.json:quick.{tgt}.pr_auc", f"{quick_cal['pr_auc']['mean']:.4f} ± {quick_cal['pr_auc']['std']:.4f}")
            add_check(f"{tgt} Quick Brier", f"{m_quick.group(5)} ± {m_quick.group(6)}", f"nested_results.json:quick.{tgt}.brier", f"{quick_cal['brier']['mean']:.4f} ± {quick_cal['brier']['std']:.4f}")
            add_check(f"{tgt} Quick ECE", f"{m_quick.group(7)} ± {m_quick.group(8)}", f"nested_results.json:quick.{tgt}.ece", f"{quick_cal['ece']['mean']:.4f} ± {quick_cal['ece']['std']:.4f}")
        else:
            add_check(f"{tgt} Quick Row", "NOT FOUND", f"nested_results.json:quick.{tgt}", "table row")

    # Print diff-style table
    print("=" * 110)
    print("MODEL_CARD.md NUMERICAL CONSISTENCY VERIFICATION (Sections 2, 3, 4)")
    print("=" * 110)
    print(f"{'Item':<28} | {'MODEL_CARD.md Value':<22} | {'Source Artifact / Key':<35} | {'Status'}")
    print("-" * 110)

    all_matched = True
    for c in checks:
        status_str = f"PASS ({c['status']})" if c["status"] == "MATCH" else f"FAIL ({c['status']})"
        print(f"{c['item']:<28} | {c['card_val']:<22} | {c['source']:<35} | {status_str}")
        if c["status"] != "MATCH":
            all_matched = False
            print(f"   -> Expected: {c['expected_val']}")

    print("-" * 110)
    if all_matched:
        print(f"ALL {len(checks)} NUMERICAL VALUES IN MODEL_CARD.md MATCH SOURCE ARTIFACTS EXACTLY.")
        sys.exit(0)
    else:
        print(f"FAIL: One or more numerical values in MODEL_CARD.md mismatched source artifacts.")
        sys.exit(1)

if __name__ == "__main__":
    main()
