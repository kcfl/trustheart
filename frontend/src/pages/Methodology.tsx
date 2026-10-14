import { useState } from "react";
import {
  ArrowUpRight,
  Database,
  FlaskConical,
  Plus,
  Minus,
  ShieldCheck,
  FileCheck2,
  ArrowRight,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeading, Eyebrow, Notice } from "../components/UI";
import facts from "../generated/facts.json";

export default function Methodology() {
  const [open, setOpen] = useState<number | null>(0);
  const targets = ["CAD", "LAD", "LCX", "RCA"] as const;

  return (
    <div className="page-container methodology-page">
      <PageHeading
        number="05"
        eyebrow="THE SCIENCE & ITS BOUNDARIES"
        title={
          <>
            Trust starts with <em>context.</em>
          </>
        }
        text="A transparent view of dataset demographics, nested cross-validation performance, calibration, and clinical boundaries."
      />

      <Notice>
        All statistics and performance metrics are verified against the frozen model artifacts (tag ml-v1)
        evaluated over 10 repeats × 5 folds nested cross-validation.
      </Notice>

      {/* Dataset section */}
      <section data-scroll-card="" className="method-dataset glass">
        <div className="dataset-info">
          <Eyebrow number="01">THE DATASET</Eyebrow>
          <h2>
            Extension of
            <br />
            <em>Z-Alizadeh Sani.</em>
          </h2>
          <p>
            An angiography-referred cohort from Tehran Heart Center, evaluating
            both overall coronary artery disease and vessel-specific diameter stenosis (≥ 50%).
          </p>
          <a
            className="text-link"
            href={facts.cohort.uci_source}
            target="_blank"
            rel="noreferrer"
          >
            View the UCI source (ID {facts.cohort.uci_id}) <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="dataset-facts">
          <Database size={28} strokeWidth={1.2} />
          <div>
            <strong>
              {facts.cohort.n_samples}
              <span>verified samples</span>
            </strong>
            <strong>
              {facts.cohort.uci_id}
              <span>UCI dataset ID</span>
            </strong>
          </div>
          <p>
            Demographics: {facts.cohort.demographics.age_min}–{facts.cohort.demographics.age_max} years
            (mean: {facts.cohort.demographics.age_mean});{" "}
            {facts.cohort.demographics.sex_counts.Male} Male, {facts.cohort.demographics.sex_counts.Fmale} Female.
          </p>
        </div>
      </section>

      {/* Dataset prevalence breakdown */}
      <section className="glass p-6 rounded-2xl border border-white/10 mt-6">
        <div className="form-group-heading mb-4">
          <Activity size={18} className="text-cyan-400" />
          <h3>Target prevalences in cohort (303 angiography-referred patients)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {targets.map((t) => {
            const prev = (facts.cohort.prevalences as Record<string, { count_positive: number; total: number; prevalence_pct: number }>)[t];
            return (
              <div key={t} className="p-4 rounded-xl bg-white/5 border border-white/5">
                <span className="card-overline">{t}</span>
                <strong className="text-2xl text-white block mt-1">
                  {prev.prevalence_pct.toFixed(1)}%
                </strong>
                <span className="text-xs text-white/50">
                  {prev.count_positive} / {prev.total} positive
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Intended Pipeline */}
      <section className="method-pipeline mt-10">
        <div className="section-heading">
          <div>
            <Eyebrow number="02">THE MODEL PIPELINE</Eyebrow>
            <h2>
              From data to <em>perspective.</em>
            </h2>
          </div>
          <span className="status-badge">FROZEN SPECIFICATION (ml-v1)</span>
        </div>
        <div className="pipeline-grid">
          {[
            {
              n: "01",
              icon: Database,
              title: "Leakage-Free Preprocessing",
              text: "Strict exclusion of catheterization leakage columns. Train-only standardization via StandardScaler with median imputation.",
            },
            {
              n: "02",
              icon: FlaskConical,
              title: "1-SE Simplicity Selection",
              text: "10-repeat 5-fold nested cross-validation. For LCX and RCA, the 1-SE rule chose the compact 7-feature model to prevent overparameterization.",
            },
            {
              n: "03",
              icon: FileCheck2,
              title: "Platt Calibration",
              text: "Post-hoc Platt scaling fitted on out-of-fold logit predictions to ensure well-calibrated probabilities.",
            },
            {
              n: "04",
              icon: ShieldCheck,
              title: "Fréchet Joint Coherence",
              text: "Enforces joint probability inequality: P(CAD) ≥ max(P(LAD), P(LCX), P(RCA)) ensuring anatomical and logical coherence.",
            },
          ].map(({ n, icon: Icon, title, text }) => (
            <div data-scroll-card="" className="pipeline-card glass" key={n}>
              <div>
                <Icon size={22} strokeWidth={1.2} />
                <span>{n}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Model Performance (Auto vs Quick) */}
      <section data-scroll-card="" className="metrics-panel glass mt-10">
        <div className="mb-6">
          <span className="card-overline">VALIDATED PERFORMANCE</span>
          <h3>Nested Cross-Validation (Auto vs Quick Mode)</h3>
          <p>
            Evaluated over 10 repeats × 5 folds nested CV (50 out-of-fold test evaluations).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-left">
            <thead>
              <tr>
                <th>Target</th>
                <th>Mode</th>
                <th>ROC-AUC (Mean ± Std)</th>
                <th>PR-AUC (Mean ± Std)</th>
                <th>Brier Score</th>
                <th>Expected Calib. Error (ECE)</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => {
                const auto = (facts.performance as any)[t]?.auto;
                const quick = (facts.performance as any)[t]?.quick;
                return [
                  <tr key={`${t}-auto`}>
                    <th scope="row" className="font-semibold text-white">
                      {t} (Auto)
                    </th>
                    <td>Full (55 feat)</td>
                    <td>
                      <strong>
                        {auto.roc_auc_mean.toFixed(4)} ± {auto.roc_auc_std.toFixed(4)}
                      </strong>
                    </td>
                    <td>
                      {auto.pr_auc_mean.toFixed(4)} ± {auto.pr_auc_std.toFixed(4)}
                    </td>
                    <td>{auto.brier_mean.toFixed(4)}</td>
                    <td>{auto.ece_mean.toFixed(4)}</td>
                  </tr>,
                  <tr key={`${t}-quick`} className="border-b border-white/10">
                    <th scope="row" className="text-white/70">
                      {t} (Quick)
                    </th>
                    <td>Quick (7 feat)</td>
                    <td>
                      {quick.roc_auc_mean.toFixed(4)} ± {quick.roc_auc_std.toFixed(4)}
                    </td>
                    <td>
                      {quick.pr_auc_mean.toFixed(4)} ± {quick.pr_auc_std.toFixed(4)}
                    </td>
                    <td>{quick.brier_mean.toFixed(4)}</td>
                    <td>{quick.ece_mean.toFixed(4)}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Limitations */}
      <section className="limitations-section mt-12">
        <div>
          <Eyebrow number="03">IMPORTANT LIMITATIONS</Eyebrow>
          <h2>
            Know what
            <br />
            <em>we don't know.</em>
          </h2>
          <p>
            Responsible exploration requires explicit acknowledgment of boundaries.
            These limitations are fundamental context for interpreting model outputs.
          </p>
        </div>
        <div className="accordion">
          {facts.limitations.map((text, i) => (
            <div
              className={`accordion-item ${open === i ? "open" : ""}`}
              key={text}
            >
              <h3>
                <button
                  aria-expanded={open === i}
                  aria-controls={`limitation-${i}`}
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span>0{i + 1}</span>
                  {text.split(".")[0]}.
                  {open === i ? <Minus size={16} /> : <Plus size={16} />}
                </button>
              </h3>
              <div id={`limitation-${i}`} hidden={open !== i}>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="method-bottom mt-10">
        <ShieldCheck size={24} />
        <p>
          Built for education and research demonstration.
          <br />
          <strong>Not validated for independent clinical decision-making.</strong>
        </p>
        <Link className="text-link" to="/about">
          Meet the project <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
