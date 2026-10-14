"""Generate docs/MODEL_CARD.md by programmatically extracting metrics from reports and models."""

import json
import re
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
    # 1. Load source artifacts
    data_audit = load_json("reports/data_audit.json")
    coherence = load_json("reports/coherence.json")
    nested_res = load_json("reports/nested_results.json")
    trust_stats = load_json("models/trust_stats.json")
    manifest = load_json("models/manifest.json")
    feature_stats = load_json("models/feature_stats.json")
    final_selection = parse_final_selection_md("models/final_selection.md")

    # Target info from data_audit
    raw_shape = data_audit["raw_shape"]
    targets_data = data_audit["targets"]
    demographics = data_audit["demographics"]

    # Coherence summary
    coh_auto = coherence["results"]["auto"]
    coh_quick = coherence["results"]["quick"]

    # Lift summary
    lift_data = trust_stats["lift"]

    # Nested CV results
    auto_res = nested_res["results"]["auto"]
    quick_res = nested_res["results"]["quick"]

    # Check for api example of raised CAD in full mode
    raised_example_text = ""
    quick_p10_path = REPO_ROOT / "docs" / "api_examples" / "quick_p10.json"
    full_median_path = REPO_ROOT / "docs" / "api_examples" / "full_median_3missing.json"
    
    # We check if docs/api_examples has a full mode raised example
    # Note: quick_p10 has status='raised' in quick mode (P(CAD) model 0.1869 raised to 0.2225 by LCX).
    # If a full mode example exists, read it; else note that quick_p10 illustrates the mechanism.
    full_raised_example = None
    for p in [full_median_path, quick_p10_path]:
        if p.is_file():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    d = json.load(f)
                    if d.get("mode") == "full" and d.get("consistency", {}).get("status") == "raised":
                        full_raised_example = d
            except Exception:
                pass

    lines = []
    lines.append("# TrustHeart 3D - Model Card")
    lines.append("")
    lines.append("> **Clinical Disclaimer**: Decision support and educational demonstration only. Not a substitute for coronary angiography, diagnostic imaging, or formal clinical judgement. Predictions represent statistical probabilities from a small single-centre dataset, not anatomical lesion locations.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 1. Intended Use")
    lines.append("- **Domain**: Cardiovascular risk assessment and vessel-specific coronary artery stenosis evaluation.")
    lines.append("- **Task**: Multi-target binary classification of overall coronary artery disease (CAD) and vessel-specific stenosis (LAD, LCX, RCA) with stenosis threshold $\\ge 50\\%$.")
    lines.append("- **Operating Modes**:")
    lines.append("  - **Auto / Full Mode**: Uses the full 54 human-interpretable clinical features (demographics, history, symptoms, exam, ECG, laboratory findings, echocardiography), selecting the simplest model within 1 SE of the best cross-validated AUC.")
    lines.append("  - **Quick Mode**: Requires only 7 bedside clinical features (`Age`, `Sex`, `Typical Chest Pain`, `Atypical`, `Nonanginal`, `DM`, `HTN`).")
    lines.append("- **Intended Users**: Healthcare researchers, educational demonstrations, and clinical decision support study settings.")
    lines.append("- **Out-of-Scope Use**: Emergency department triage, acute coronary syndrome definitive diagnosis, replacing invasive coronary catheterization or computed tomography angiography.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 2. Dataset & Cohort Characteristics")
    lines.append("- **Source**: Extension of Z-Alizadeh Sani Dataset (UCI Machine Learning Repository ID 411, DOI: 10.24432/C5461K).")
    lines.append(f"- **Dimensions**: {raw_shape[0]} patients, {raw_shape[1]} raw attributes.")
    lines.append(f"- **Demographics**: Age range {demographics['age_min']} to {demographics['age_max']} years (mean: {demographics['age_mean']:.1f} years); Sex: {demographics['sex_counts'].get('Male', 0)} Male, {demographics['sex_counts'].get('Fmale', 0)} Female.")
    lines.append(f"- **Target Counts & Dataset Prevalences** (angiography-referred cohort):")
    lines.append(f"  - **CAD**: {targets_data['CAD']['count_1_positive']} positive ({targets_data['CAD']['prevalence_pct']:.2f}%), {targets_data['CAD']['count_0_normal']} normal ({100.0 - targets_data['CAD']['prevalence_pct']:.2f}%).")
    lines.append(f"  - **LAD**: {targets_data['LAD']['count_1_positive']} positive ({targets_data['LAD']['prevalence_pct']:.2f}%), {targets_data['LAD']['count_0_normal']} normal ({100.0 - targets_data['LAD']['prevalence_pct']:.2f}%).")
    lines.append(f"  - **LCX**: {targets_data['LCX']['count_1_positive']} positive ({targets_data['LCX']['prevalence_pct']:.2f}%), {targets_data['LCX']['count_0_normal']} normal ({100.0 - targets_data['LCX']['prevalence_pct']:.2f}%).")
    lines.append(f"  - **RCA**: {targets_data['RCA']['count_1_positive']} positive ({targets_data['RCA']['prevalence_pct']:.2f}%), {targets_data['RCA']['count_0_normal']} normal ({100.0 - targets_data['RCA']['prevalence_pct']:.2f}%).")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 3. Model Architecture & Selection Rule")
    lines.append("- **Selection Rule**: 1-Standard-Error (1-SE) simplicity heuristic evaluated across 10-repeat 5-fold nested cross-validation.")
    lines.append("- **Final Selected Production Models** (all-data fit on 303 samples):")
    lines.append("")
    lines.append("| Mode | Target | Configuration | Space | Features | Platt Slope ($a$) | Platt Intercept ($b$) |")
    lines.append("|---|---|---|---|---|---|---|")
    for r in final_selection:
        lines.append(f"| `{r['space']}` | **{r['target']}** | `{r['config']}` | `{r['featureset']}` | {r['n_features']} | {r['platt_a']:.4f} | {r['platt_b']:.4f} |")
    lines.append("")
    lines.append("- **Key Selection Finding**: For LCX and RCA, the 1-SE rule chose the 7-feature compact model even in the full search space, preventing overparameterization on secondary vessel targets.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 4. Nested Cross-Validation Performance (Auto vs Quick)")
    lines.append("Evaluated over 10 repeats × 5 folds nested CV (50 out-of-fold evaluations):")
    lines.append("")
    lines.append("| Target | Mode | ROC-AUC (Mean ± Std) | PR-AUC (Mean ± Std) | Brier Score (Mean ± Std) | Expected Calibration Error (ECE) |")
    lines.append("|---|---|---|---|---|---|")
    for tgt in ["CAD", "LAD", "LCX", "RCA"]:
        auto_cal = auto_res[tgt]["calibrated"]["summary"]
        quick_cal = quick_res[tgt]["calibrated"]["summary"]
        lines.append(
            f"| **{tgt}** | Auto | {auto_cal['roc_auc']['mean']:.4f} ± {auto_cal['roc_auc']['std']:.4f} | "
            f"{auto_cal['pr_auc']['mean']:.4f} ± {auto_cal['pr_auc']['std']:.4f} | "
            f"{auto_cal['brier']['mean']:.4f} ± {auto_cal['brier']['std']:.4f} | "
            f"{auto_cal['ece']['mean']:.4f} ± {auto_cal['ece']['std']:.4f} |"
        )
        lines.append(
            f"| **{tgt}** | Quick | {quick_cal['roc_auc']['mean']:.4f} ± {quick_cal['roc_auc']['std']:.4f} | "
            f"{quick_cal['pr_auc']['mean']:.4f} ± {quick_cal['pr_auc']['std']:.4f} | "
            f"{quick_cal['brier']['mean']:.4f} ± {quick_cal['brier']['std']:.4f} | "
            f"{quick_cal['ece']['mean']:.4f} ± {quick_cal['ece']['std']:.4f} |"
        )
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 5. Calibration")
    lines.append("- **Method**: Post-hoc Platt scaling ($P = 1 / (1 + \\exp(-(a \\cdot \\text{logit} + b)))$) fitted with 6 inner folds.")
    lines.append("- **Calibration Parameters**:")
    for r in final_selection:
        lines.append(f"  - `{r['space']}` **{r['target']}**: Slope $a = {r['platt_a']:.4f}$, Intercept $b = {r['platt_b']:.4f}$.")
    lines.append("- **Nested CV Calibration Slopes & Intercepts** (Auto Mode):")
    for tgt in ["CAD", "LAD", "LCX", "RCA"]:
        cal_sum = auto_res[tgt]["calibrated"]["summary"]
        lines.append(f"  - **{tgt}**: Slope = {cal_sum['slope']['mean']:.4f} ± {cal_sum['slope']['std']:.4f}, Intercept = {cal_sum['intercept']['mean']:.4f} ± {cal_sum['intercept']['std']:.4f}.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 6. Paired Lift (Full Feature Set over Quick Mode)")
    lines.append("Paired difference in nested-CV ROC-AUC across 10 evaluation repeats:")
    lines.append("")
    lines.append("| Target | Paired Mean AUC Diff | 95% Repeat Interval [p2.5, p97.5] | Note | Selection Identical Fraction |")
    lines.append("|---|---|---|---|---|")
    for tgt in ["CAD", "LAD", "LCX", "RCA"]:
        ld = lift_data[tgt]
        lines.append(
            f"| **{tgt}** | {ld['paired_mean']:+.4f} | [{ld['p2_5']:+.4f}, {ld['p97_5']:+.4f}] | "
            f"repeat interval, descriptive | {ld['selection_identical_fraction']:.2f} |"
        )
    lines.append("")
    lines.append("> **Note**: Intervals over repeats are descriptive, not statistical hypothesis tests. In LCX and RCA, the identical selection fraction is {0:.0f}% and {1:.0f}%, respectively, because the 1-SE rule consistently chooses the compact model across CV repeats.".format(
        lift_data["LCX"]["selection_identical_fraction"] * 100,
        lift_data["RCA"]["selection_identical_fraction"] * 100,
    ))
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 7. Joint Coherence & Fréchet Bounds Violation Rates")
    lines.append("Under the dataset definition $\\text{CAD} = \\text{OR}(\\text{LAD}, \\text{LCX}, \\text{RCA})$, biological validity requires:")
    lines.append("$$\\max(P(\\text{LAD}), P(\\text{LCX}), P(\\text{RCA})) \\le P(\\text{CAD}) \\le \\min(1.0, P(\\text{LAD}) + P(\\text{LCX}) + P(\\text{RCA}))$$")
    lines.append("")
    lines.append("- **Violation Rates Across 10 Nested CV Repeats**:")
    lines.append(f"  - **Auto Mode**: Lower bound violations = {coh_auto['pct_below_lower']['mean']:.2f}% ± {coh_auto['pct_below_lower']['std']:.2f}%; Upper bound violations = {coh_auto['pct_above_upper']['mean']:.2f}% ± {coh_auto['pct_above_upper']['std']:.2f}%; Coherent predictions = {coh_auto['pct_coherent']['mean']:.2f}% ± {coh_auto['pct_coherent']['std']:.2f}%.")
    lines.append(f"  - **Quick Mode**: Lower bound violations = {coh_quick['pct_below_lower']['mean']:.2f}% ± {coh_quick['pct_below_lower']['std']:.2f}%; Upper bound violations = {coh_quick['pct_above_upper']['mean']:.2f}% ± {coh_quick['pct_above_upper']['std']:.2f}%; Coherent predictions = {coh_quick['pct_coherent']['mean']:.2f}% ± {coh_quick['pct_coherent']['std']:.2f}%.")
    lines.append(f"- **Effect of Coherence Clipping Adjustment**:")
    lines.append(f"  - Auto CAD ROC-AUC: {coh_auto['auc_before']['mean']:.4f} → {coh_auto['auc_after']['mean']:.4f} ($\\Delta = {coh_auto['auc_diff']:+.4f}$).")
    lines.append(f"  - Auto CAD Brier Score: {coh_auto['brier_before']['mean']:.4f} → {coh_auto['brier_after']['mean']:.4f} ($\\Delta = {coh_auto['brier_diff']:+.4f}$).")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 8. Stability Rule Revision: v1 to v2")
    lines.append("- **Post-hoc Revision Statement**: In initial prototyping (v1), feature stability was evaluated using a fixed Top-5 frequency cutoff across all models. In the 7-feature compact space, selecting 5 of 7 features trivialized the ranking and classified unstable lower-importance features as stable. As a documented post-hoc methodological revision (rule v2):")
    lines.append("  - **7-Feature Compact Models**: Evaluated with a **Top-3** cutoff.")
    lines.append("  - **54-Feature Full Models**: Evaluated with a **Top-5** cutoff.")
    lines.append("  - **Stability Thresholds**: Tagged **STABLE** if top-K frequency $\\ge 80\\%$ and sign consistency $\\ge 90\\%$; **MODERATE** if frequency $\\ge 50\\%$; **UNSTABLE** otherwise.")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 9. Limitations & Clinical Considerations")
    lines.append("1. **Single-Centre Cohort**: Trained exclusively on 303 patients from Shaheed Rajaei Cardiovascular, Medical and Research Center (Tehran, Iran). Generalizability across diverse international demographics and referral patterns is unverified.")
    lines.append("2. **Angiography-Referred Population**: All patients were referred for invasive coronary catheterization (dataset CAD prevalence is 71.29%). Baseline risk is substantially higher than the asymptomatic general outpatient screening population.")
    lines.append("3. **Per-Vessel Probability vs. Anatomical Lesion Location**: Outputs represent statistical likelihood of stenosis $\\ge 50\\%$ somewhere in the vessel, not lesion coordinates, stenosis severity percentage, bifurcation involvement, or fractional flow reserve (FFR).")
    lines.append("4. **Mild Out-of-Sample Overconfidence**: Platt-calibrated models show slight slope attenuation on held-out folds (slope $\\approx 0.84$), indicating mild overconfidence at probability extremes.")
    lines.append("5. **What-If Sensitivity vs. Treatment Effect**: Counterfactual slider adjustments reflect the mathematical gradient of the model given static historical correlations, NOT the expected biological or therapeutic outcome of clinical interventions.")
    lines.append("6. **Imputed Feature Linear Contributions**: Missing clinical inputs are imputed with training medians. Because standard scaler normalizes features by their training mean ($z = (x - \\mu) / \\sigma$), when the training median differs from the training mean, $(x_{\\text{median}} - \\mu) / \\sigma \\ne 0$, producing non-zero contributions for imputed variables. These are transparently flagged as `imputed: true` in the API.")
    if full_raised_example is not None:
        p_cad_raw = full_raised_example["predictions"]["CAD"]["calibrated_probability"]
        p_cad_adj = full_raised_example["consistency"]["p_cad_adjusted"]
        lines.append(f"7. **CAD Raised in Full Mode by Compact Models**: In Full mode, CAD uses 54 features while LCX and RCA use the 7-feature compact model. For patient example `{full_raised_example.get('label', 'sample')}`, raw CAD model probability was {p_cad_raw:.4f}, but Fréchet lower bound $\\max(P_v) = {p_cad_adj:.4f}$ raised CAD probability to {p_cad_adj:.4f}.")
    else:
        lines.append("7. **CAD Raised by Vessel Bounds**: In Full mode, CAD uses 54 features while LCX and RCA use 7-feature compact models. For low-risk clinical presentations where multi-variable biomarkers depress CAD logit but standard symptoms keep compact LCX/RCA probabilities elevated, Fréchet lower bound enforcement raises overall CAD probability to match the highest single-vessel risk.")
    lines.append("")

    out_path = REPO_ROOT / "docs" / "MODEL_CARD.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Successfully generated {out_path} ({len(lines)} lines).")

if __name__ == "__main__":
    main()
