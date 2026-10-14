import { useState } from "react";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Fingerprint,
  Layers3,
  Info,
  LockKeyhole,
  Activity,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAppState } from "../App";
import { PageHeading, Notice } from "../components/UI";
import { targets, targetNames } from "../services/prediction-api";
import type { Target } from "../services/prediction-api";

export default function Explainability() {
  const [tab, setTab] = useState<"global" | "prediction">("prediction");
  const [selectedTarget, setSelectedTarget] = useState<Target>("CAD");
  const { result } = useAppState();

  const changeTab = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "global"
        : event.key === "End"
          ? "prediction"
          : tab === "global"
            ? "prediction"
            : "global";
    setTab(next);
    document.getElementById(`${next}-tab`)?.focus();
  };

  const contributions = result?.contributions?.[selectedTarget] || [];
  const baseValue = result?.base?.[selectedTarget] ?? 0;
  const logitValue = result?.logit_model?.[selectedTarget] ?? 0;
  const otherTotal = result?.other_total?.[selectedTarget] ?? 0;

  return (
    <div className="page-container explainability-page">
      <PageHeading
        number="04"
        eyebrow="EXPLAINABLE BY DESIGN"
        title={
          <>
            Behind every <em>prediction.</em>
          </>
        }
        text="Exact linear logit decomposition and feature contributions for each coronary target."
      />

      <div className="insight-summary-grid">
        <div data-scroll-card="" className="glass summary-card">
          <Layers3 size={23} />
          <span className="card-overline">EXPLANATION METHOD</span>
          <h3>Exact Linear Logit</h3>
          <p>Standardized logit decomposition · β · (x - μ) / σ</p>
        </div>
        <div data-scroll-card="" className="glass summary-card">
          <ChartNoAxesCombined size={23} />
          <span className="card-overline">GLOBAL PERSPECTIVE</span>
          <h3>Dataset-level summary</h3>
          <p>Described in methodology & model card</p>
        </div>
        <div data-scroll-card="" className="glass summary-card">
          <Fingerprint size={23} />
          <span className="card-overline">LOCAL PERSPECTIVE</span>
          <h3>Live patient inference</h3>
          <p>
            {result
              ? `${contributions.length} features evaluated for ${selectedTarget}`
              : "Awaiting prediction run"}
          </p>
        </div>
      </div>

      <section className="explanation-panel glass">
        <div className="panel-heading">
          <div>
            <span className="card-overline">FEATURE CONTRIBUTIONS</span>
            <h2>Evidence deserves a closer look.</h2>
          </div>
          <div
            className="tabs"
            role="tablist"
            aria-label="Explanation scope"
            onKeyDown={changeTab}
          >
            <button
              role="tab"
              tabIndex={tab === "prediction" ? 0 : -1}
              aria-selected={tab === "prediction"}
              aria-controls="explanation-content"
              id="prediction-tab"
              onClick={() => setTab("prediction")}
            >
              This prediction
            </button>
            <button
              role="tab"
              tabIndex={tab === "global" ? 0 : -1}
              aria-selected={tab === "global"}
              aria-controls="explanation-content"
              id="global-tab"
              onClick={() => setTab("global")}
            >
              Global importance
            </button>
          </div>
        </div>

        <div
          id="explanation-content"
          role="tabpanel"
          aria-labelledby={`${tab}-tab`}
          className="explanation-body"
        >
          {tab === "prediction" ? (
            result ? (
              <div className="w-full space-y-6">
                {/* Target selector */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-cyan-400" />
                    <span className="text-sm font-medium text-white">
                      Target: {targetNames[selectedTarget]}
                    </span>
                  </div>
                  <div className="segmented-control" role="group">
                    {targets.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={selectedTarget === t ? "selected" : ""}
                        onClick={() => setSelectedTarget(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logit decomposition summary bar */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-white/5 border border-white/5 text-sm">
                  <div>
                    <span className="text-xs text-white/50 block">Base Intercept (β₀)</span>
                    <strong className="text-white text-base">{baseValue.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-white/50 block">Feature Contributions</span>
                    <strong className="text-cyan-300 text-base">
                      {(logitValue - baseValue - otherTotal >= 0 ? "+" : "") +
                        (logitValue - baseValue - otherTotal).toFixed(3)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-white/50 block">Model Logit</span>
                    <strong className="text-white text-base">{logitValue.toFixed(3)}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-white/50 block">Calibrated Probability</span>
                    <strong className="text-emerald-400 text-base">
                      {Math.round(result.display_probabilities[selectedTarget] * 100)}%
                    </strong>
                  </div>
                </div>

                {/* Contributions list */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-white/40 px-2 py-1">
                    <span>FEATURE & OBSERVED VALUE</span>
                    <span>LOGIT CONTRIBUTION (Δ)</span>
                  </div>
                  {contributions.map((c) => {
                    const isPositive = c.contribution > 0;
                    return (
                      <div
                        key={c.feature}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{c.feature}</span>
                          <span className="text-xs text-white/50">
                            = {String(c.value)}
                          </span>
                          {c.imputed && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Imputed
                            </span>
                          )}
                          {c.stability_tag && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {c.stability_tag}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-mono font-semibold text-sm ${
                              isPositive ? "text-cyan-300" : "text-rose-300"
                            }`}
                          >
                            {isPositive ? `+${c.contribution.toFixed(3)}` : c.contribution.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {result.imputed && result.imputed.length > 0 && (
                  <Notice>
                    <strong>Imputation Note:</strong> Features labelled "Imputed" were unspecified by the user.
                    Contributions for imputed values come from the median-vs-training-mean difference.
                  </Notice>
                )}
              </div>
            ) : (
              <div className="unavailable-copy">
                <span className="status-badge">
                  <span /> AWAITING PREDICTION
                </span>
                <h3>Every prediction needs its own evidence.</h3>
                <p>
                  Run an analysis in the workspace to inspect the exact logit decomposition
                  and per-feature linear contributions.
                </p>
                <Link to="/analysis" className="text-link">
                  Go to analysis <ArrowUpRight size={16} />
                </Link>
              </div>
            )
          ) : (
            <div className="unavailable-copy">
              <span className="status-badge">
                <span /> LOCAL DECOMPOSITION ACTIVE
              </span>
              <h3>Insight, without invention.</h3>
              <p>
                Global SHAP feature importance is not exposed as a distinct server endpoint by
                the backend contract. Global evaluation metrics and model coefficients are documented
                in the published model card and methodology page. In this build, linear per-prediction
                logit contributions are computed live for each patient evaluation.
              </p>
              <Link to="/methodology" className="text-link">
                Explore the model methodology <ArrowUpRight size={16} />
              </Link>
            </div>
          )}
        </div>
      </section>

      <div className="explain-bottom-grid">
        <section className="glass reading-guide">
          <span className="card-overline">HOW TO READ LINEAR CONTRIBUTIONS</span>
          <h3>Contribution is not causation.</h3>
          <div className="guide-row">
            <span className="contribution plus">+</span>
            <div>
              <h4>Positive logit contribution</h4>
              <p>
                Shifts the model log-odds higher relative to the baseline training population.
              </p>
            </div>
          </div>
          <div className="guide-row">
            <span className="contribution minus">−</span>
            <div>
              <h4>Negative logit contribution</h4>
              <p>
                Shifts the model log-odds lower relative to the baseline training population.
                It is a statistical association, not a clinical protective guarantee.
              </p>
            </div>
          </div>
          <Notice>
            Model contributions describe mathematical influence within the fitted logistic
            regression pipeline. They do not represent causal treatment effects.
          </Notice>
        </section>

        <section className="glass integration-status">
          <LockKeyhole size={24} strokeWidth={1.3} />
          <h3>Context before confidence.</h3>
          <p>Pipeline specifications anchored to frozen models (ml-v1):</p>
          {[
            ["Feature standardization", "Z-score (StandardScaler)"],
            ["Logit decomposition", "Exact linear (β · z)"],
            ["Calibration scaling", "Platt scaling (a · logit + b)"],
            ["Logical consistency", "Fréchet inequality bounds"],
            ["Training cohort", "303 patients (UCI ID 411)"],
          ].map(([k, v]) => (
            <div className="artifact-row" key={k}>
              <span>{k}</span>
              <span className="font-medium text-white/80">{v}</span>
            </div>
          ))}
          <Link className="text-link" to="/methodology">
            Model insights & limitations <ArrowRight size={15} />
          </Link>
        </section>
      </div>

      <div className="fine-print inline-flex items-center gap-2">
        <Info size={13} /> Decision support only. Predictions represent per-vessel stenosis risks
        from a single-centre dataset, not anatomical lesion locations.
      </div>
    </div>
  );
}
