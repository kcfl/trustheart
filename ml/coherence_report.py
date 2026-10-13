"""Evaluate and report Fréchet probability coherence on nested out-of-fold predictions."""

import json
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.metrics import brier_score_loss, roc_auc_score

from ml.coherence import apply_coherence, frechet_bounds
from ml.config import REPORTS_DIR, SPACES
from ml.utils import run_metadata


def generate_coherence_report(
    oof_path: Path | str = "models/nested_oof.npz",
    output_dir: Path | str = "reports",
) -> dict[str, Any]:
    """Generate coherence analysis across all nested CV repeats and save JSON and Markdown reports.

    Parameters
    ----------
    oof_path : Path | str, optional
        Path to nested out-of-fold predictions npz file, by default 'models/nested_oof.npz'.
    output_dir : Path | str, optional
        Destination directory for reports, by default 'reports'.

    Returns
    -------
    dict[str, Any]
        Dictionary with per-space coherence metrics and overall summary.
    """
    oof_file = Path(oof_path)
    if not oof_file.exists():
        raise FileNotFoundError(f"Nested OOF file not found at: {oof_file}")

    data = np.load(oof_file)
    y_cad = data["labels|CAD"] if "labels|CAD" in data else data["labels"][:, 0]
    n_samples = len(y_cad)

    results_by_space: dict[str, dict[str, Any]] = {}

    for space in SPACES:
        p_cad_repeats = data[f"{space}|CAD|cal"]
        p_lad_repeats = data[f"{space}|LAD|cal"]
        p_lcx_repeats = data[f"{space}|LCX|cal"]
        p_rca_repeats = data[f"{space}|RCA|cal"]

        n_repeats = len(p_cad_repeats)

        pct_raised_list: list[float] = []
        pct_lowered_list: list[float] = []
        pct_ok_list: list[float] = []
        auc_before_list: list[float] = []
        auc_after_list: list[float] = []
        brier_before_list: list[float] = []
        brier_after_list: list[float] = []
        auc_lower_bound_list: list[float] = []

        for r in range(n_repeats):
            p_cad = p_cad_repeats[r]
            p_lad = p_lad_repeats[r]
            p_lcx = p_lcx_repeats[r]
            p_rca = p_rca_repeats[r]

            lower_bound, upper_bound = frechet_bounds(p_lad, p_lcx, p_rca)
            p_cad_adj, status = apply_coherence(p_cad, p_lad, p_lcx, p_rca)

            pct_raised = float(np.mean(status == "raised") * 100.0)
            pct_lowered = float(np.mean(status == "lowered") * 100.0)
            pct_ok = float(np.mean(status == "ok") * 100.0)

            auc_before = float(roc_auc_score(y_cad, p_cad))
            auc_after = float(roc_auc_score(y_cad, p_cad_adj))
            brier_before = float(brier_score_loss(y_cad, p_cad))
            brier_after = float(brier_score_loss(y_cad, p_cad_adj))
            auc_lower = float(roc_auc_score(y_cad, lower_bound))

            pct_raised_list.append(pct_raised)
            pct_lowered_list.append(pct_lowered)
            pct_ok_list.append(pct_ok)
            auc_before_list.append(auc_before)
            auc_after_list.append(auc_after)
            brier_before_list.append(brier_before)
            brier_after_list.append(brier_after)
            auc_lower_bound_list.append(auc_lower)

        def _stats(arr: list[float]) -> dict[str, float]:
            a = np.array(arr)
            return {
                "mean": float(np.mean(a)),
                "std": float(np.std(a, ddof=1)),
                "min": float(np.min(a)),
                "max": float(np.max(a)),
            }

        results_by_space[space] = {
            "n_repeats": n_repeats,
            "n_samples": n_samples,
            "pct_below_lower": _stats(pct_raised_list),
            "pct_above_upper": _stats(pct_lowered_list),
            "pct_coherent": _stats(pct_ok_list),
            "auc_before": _stats(auc_before_list),
            "auc_after": _stats(auc_after_list),
            "brier_before": _stats(brier_before_list),
            "brier_after": _stats(brier_after_list),
            "auc_lower_bound_score": _stats(auc_lower_bound_list),
            "auc_diff": float(np.mean(auc_after_list) - np.mean(auc_before_list)),
            "brier_diff": float(np.mean(brier_after_list) - np.mean(brier_before_list)),
        }

    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    meta = run_metadata()
    report_data = {
        **meta,
        "coherence_definition": "max(LAD, LCX, RCA) <= P(CAD) <= min(1, sum(LAD, LCX, RCA))",
        "dataset_exception_note": "1 of 303 rows in the data (index 93) violates the definition",
        "results": results_by_space,
    }

    # Save reports/coherence.json
    json_path = out_dir / "coherence.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)
    print(f"Saved coherence report JSON to: {json_path}")

    # Save reports/coherence.md
    md_path = out_dir / "coherence.md"
    md_lines = [
        "# TrustHeart 3D - Step 4: Fréchet Coherence Analysis",
        "",
        "- **Theoretical Definition**: CAD is defined as 'at least one stenotic vessel', yielding exact Fréchet bounds:",
        "  $$\\max(P(\\text{LAD}), P(\\text{LCX}), P(\\text{RCA})) \\le P(\\text{CAD}) \\le \\min(1, P(\\text{LAD}) + P(\\text{LCX}) + P(\\text{RCA}))$$",
        "- **Empirical Dataset Note**: 1 of 303 patients (index 93) violates the clinical definition in raw ground truth.",
        f"- **Evaluated Out-of-Fold Repeats**: {results_by_space['auto']['n_repeats']} repeats ({n_samples} patients each)",
        "",
        "---",
        "",
        "## 1. Coherence Bound Violations (% of Patients)",
        "",
        "| Search Space | % Below Lower Bound (Raised) | % Above Upper Bound (Lowered) | % Coherent (Unchanged) |",
        "|---|---|---|---|",
    ]

    for space in SPACES:
        r = results_by_space[space]
        md_lines.append(
            f"| `{space.upper()}` | "
            f"{r['pct_below_lower']['mean']:.2f}% ± {r['pct_below_lower']['std']:.2f}% | "
            f"{r['pct_above_upper']['mean']:.2f}% ± {r['pct_above_upper']['std']:.2f}% | "
            f"{r['pct_coherent']['mean']:.2f}% ± {r['pct_coherent']['std']:.2f}% |"
        )
    md_lines.append("")

    md_lines.extend([
        "---",
        "",
        "## 2. Model Performance Before vs. After Coherence Clipping",
        "",
        "| Search Space | Metric | Before Clipping | After Clipping | Difference | Lower Bound Alone as CAD Score |",
        "|---|---|---|---|---|---|",
    ])

    for space in SPACES:
        r = results_by_space[space]
        auc_diff_str = f"{r['auc_diff']:+.4f}"
        brier_diff_str = f"{r['brier_diff']:+.4f}"

        md_lines.append(
            f"| `{space.upper()}` | **ROC-AUC** | "
            f"{r['auc_before']['mean']:.4f} ± {r['auc_before']['std']:.4f} | "
            f"**{r['auc_after']['mean']:.4f} ± {r['auc_after']['std']:.4f}** | "
            f"`{auc_diff_str}` | "
            f"{r['auc_lower_bound_score']['mean']:.4f} ± {r['auc_lower_bound_score']['std']:.4f} |"
        )
        md_lines.append(
            f"| `{space.upper()}` | **Brier Score** | "
            f"{r['brier_before']['mean']:.4f} ± {r['brier_before']['std']:.4f} | "
            f"**{r['brier_after']['mean']:.4f} ± {r['brier_after']['std']:.4f}** | "
            f"`{brier_diff_str}` | N/A |"
        )
    md_lines.append("")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))
    print(f"Saved coherence report Markdown to: {md_path}")
    print("\n" + "\n".join(md_lines) + "\n")

    return report_data


def main() -> None:
    """Execute coherence analysis and report generation."""
    generate_coherence_report()


if __name__ == "__main__":
    main()
