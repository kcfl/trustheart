import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Info,
  Download,
  RotateCcw,
  Activity,
  Users,
  ShieldAlert,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAppState } from "../App";
import {
  Heart,
  PageHeading,
  EmptyState,
  ButtonLink,
  Notice,
} from "../components/UI";
import { targetNames, targets } from "../services/prediction-api";
import type { Target } from "../services/prediction-api";

const descriptions: Record<Target, string> = {
  CAD: "Overall coronary artery disease probability (stenosis ≥ 50%). Coherently bounded by vessel-specific probabilities via Fréchet joint inequality.",
  LAD: "Left Anterior Descending artery stenosis probability. LAD carries significant myocardial blood flow to the anterior wall and septum.",
  LCX: "Left Circumflex artery stenosis probability. LCX supplies blood to the posterolateral myocardium.",
  RCA: "Right Coronary Artery stenosis probability. RCA supplies blood to the right ventricle, inferior wall, and conduction system.",
};

export default function Results() {
  const { result } = useAppState();
  const [selected, setSelected] = useState<Target>("CAD");
  const [table, setTable] = useState(false);

  const exportData = () => {
    if (!result) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            disclaimer: result.disclaimer,
            modelVersion: result.modelVersion,
            createdAt: result.createdAt,
            display_probabilities: result.display_probabilities,
            calibrated_probabilities: result.calibrated_probabilities,
            raw_probabilities: result.raw_probabilities,
            consistency: result.consistency,
            trust: result.trust,
            imputed: result.imputed,
            warnings: result.warnings,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trustheart-prediction-${result.modelVersion.replace(/[\s/]/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container results-page">
      <PageHeading
        number="03"
        eyebrow="THE RESULTS WORKSPACE"
        title={
          <>
            A wider <em>perspective.</em>
          </>
        }
        text="Four targets. One coherent perspective on coronary risk."
      >
        {result && (
          <button className="small-button" onClick={exportData}>
            <Download size={14} /> Export results
          </button>
        )}
      </PageHeading>

      {!result ? (
        <EmptyState
          title="Your perspective starts here."
          text="There is no analysis in this session yet. Provide clinical features in the analysis workspace to evaluate real calibrated risk."
        >
          <ButtonLink to="/analysis">Start analysis</ButtonLink>
        </EmptyState>
      ) : (
        <>
          <div className="result-meta">
            <span>
              <span className="live-dot" /> LIVE MODEL INFERENCE READY
            </span>
            <span>
              Model {result.modelVersion} · Session time:{" "}
              {new Date(result.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <Link to="/analysis">
              <RotateCcw size={12} /> New analysis
            </Link>
          </div>

          {/* Probability cards grid */}
          <div className="probability-grid">
            {targets.map((target, index) => {
              const displayProb = result.display_probabilities[target];
              const pct = Math.round(displayProb * 100);
              const isAdjusted = result.adjusted[target];
              return (
                <button
                  key={target}
                  data-scroll-card=""
                  className={`probability-card glass ${
                    selected === target ? "selected" : ""
                  }`}
                  aria-pressed={selected === target}
                  onClick={() => setSelected(target)}
                >
                  <div className="flex justify-between items-start">
                    <span className="card-overline">{target}</span>
                    <span className="target-index">
                      0{index + 1}
                      <ArrowUpRight size={15} />
                    </span>
                  </div>
                  <p>{targetNames[target]}</p>
                  <strong>
                    {pct}
                    <span>%</span>
                  </strong>
                  <div className="probability-track">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/50 mt-1">
                    <span>
                      Band: <strong>{result.display_bands[target]}</strong>
                    </span>
                    {isAdjusted && (
                      <span className="text-amber-400 text-[10px] font-medium">
                        ADJUSTED
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Consistency notice if adjusted */}
          {result.consistency.status !== "ok" && (
            <Notice>
              <div className="flex items-start gap-2">
                <ShieldAlert size={16} className="text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <strong>Raised to match the vessel-level probability (consistency rule):</strong>
                  <p className="text-sm mt-0.5">
                    Original CAD model probability was{" "}
                    <strong>
                      {Math.round(result.calibrated_probabilities.CAD * 100)}%
                    </strong>
                    , adjusted to{" "}
                    <strong>
                      {Math.round(result.display_probabilities.CAD * 100)}%
                    </strong>{" "}
                    to satisfy Fréchet logical bounds [
                    {Math.round(result.consistency.lower * 100)}%,{" "}
                    {Math.round(result.consistency.upper * 100)}%].
                  </p>
                </div>
              </div>
            </Notice>
          )}

          <div className="results-grid">
            {/* Heart 3D display */}
            <section className="anatomy-panel glass">
              <div className="panel-heading">
                <div>
                  <span className="card-overline">INTERACTIVE ANATOMY</span>
                  <h2>The heart, in perspective.</h2>
                </div>
                <span className="small-badge">3D EXPLORER</span>
              </div>
              <div className="result-heart">
                <Heart
                  compact
                  selected={selected}
                  onSelect={setSelected}
                  probabilities={result.display_probabilities}
                  bands={result.display_bands}
                />
                <div className="result-heart-label">
                  <Activity size={16} />
                  {selected}: {Math.round(result.display_probabilities[selected] * 100)}%
                  <span>Selected target</span>
                </div>
              </div>

              {/* Color-coded vessel risk legend */}
              <div className="vessel-legend" aria-label="Risk band color legend">
                <span className="legend-item">
                  <span className="legend-dot dot-lower" /> Lower (&lt;30%)
                </span>
                <span className="legend-item">
                  <span className="legend-dot dot-intermediate" /> Intermediate (30–60%)
                </span>
                <span className="legend-item">
                  <span className="legend-dot dot-higher" /> Higher (&gt;60%)
                </span>
              </div>

              <div
                className="artery-selector"
                aria-label="Select prediction target"
              >
                {targets.map((t) => (
                  <button
                    key={t}
                    className={selected === t ? "active" : ""}
                    aria-pressed={selected === t}
                    onClick={() => setSelected(t)}
                  >
                    {t === "CAD" ? "Whole heart" : t}
                  </button>
                ))}
              </div>
              <p className="vessel-overlay-caption">
                Vessel overlay is schematic. Colors show per-vessel stenosis probability, not lesion location.
              </p>
              <p className="anatomy-disclaimer">
                <Info size={13} /> Anatomical reference only. Probabilities represent
                per-vessel stenosis likelihood (≥ 50% diameter reduction), not
                anatomical lesion location.
              </p>
            </section>

            {/* Target details */}
            <section className="target-detail glass" aria-live="polite">
              <div className="detail-top">
                <span className="card-overline">SELECTED PERSPECTIVE</span>
                <span className="outline-icon">
                  <ScanIcon />
                </span>
              </div>
              <h2>{selected}</h2>
              <h3>{targetNames[selected]}</h3>
              <p>{descriptions[selected]}</p>

              <div className="selected-value">
                <strong>
                  {Math.round(result.display_probabilities[selected] * 100)}
                  <span>%</span>
                </strong>
                <span>
                  CALIBRATED
                  <br />
                  PROBABILITY
                </span>
              </div>

              <div className="probability-track large">
                <span
                  style={{
                    width: `${Math.round(result.display_probabilities[selected] * 100)}%`,
                  }}
                />
              </div>

              <div className="chart-scale">
                <span>0% (Lower)</span>
                <span>30%</span>
                <span>60%</span>
                <span>100% (Higher)</span>
              </div>

              {result.adjusted[selected] && (
                <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  Raised to match vessel-level probability. Unadjusted model value:{" "}
                  {Math.round(result.calibrated_probabilities[selected] * 100)}%.
                </div>
              )}

              <div className="subtle-divider" />
              <h4>A number, not a certainty.</h4>
              <p>
                Predictions reflect statistical probabilities from a small single-centre
                cohort (303 patients). Decision support and research demonstration only;
                not a substitute for diagnostic angiography.
              </p>
              <Link to="/explainability" className="text-link">
                Look behind the prediction <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>

          {/* Comparison table / chart */}
          <section className="result-chart-panel glass">
            <div className="panel-heading">
              <div>
                <span className="card-overline">TARGET COMPARISON</span>
                <h2>Four outputs. Distinct questions.</h2>
              </div>
              <button
                className="small-button"
                onClick={() => setTable(!table)}
              >
                {table ? "Show chart" : "Show data table"}
              </button>
            </div>

            {table ? (
              <table className="data-table">
                <caption className="sr-only">
                  Calibrated probabilities for each prediction target
                </caption>
                <thead>
                  <tr>
                    <th>Target</th>
                    <th>Description</th>
                    <th>Model probability</th>
                    <th>Display probability</th>
                    <th>Band</th>
                    <th>Adjusted</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.map((t) => (
                    <tr key={t}>
                      <th scope="row">{t}</th>
                      <td>{targetNames[t]}</td>
                      <td>{Math.round(result.calibrated_probabilities[t] * 100)}%</td>
                      <td>
                        <strong>{Math.round(result.display_probabilities[t] * 100)}%</strong>
                      </td>
                      <td>{result.display_bands[t]}</td>
                      <td>{result.adjusted[t] ? "Yes (Fréchet)" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="horizontal-chart">
                {targets.map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelected(t)}
                    className={selected === t ? "active" : ""}
                    aria-label={`Select ${t}, probability ${Math.round(
                      result.display_probabilities[t] * 100,
                    )} percent`}
                  >
                    <span>{t}</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.round(
                            result.display_probabilities[t] * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <strong>
                      {Math.round(result.display_probabilities[t] * 100)}%
                    </strong>
                  </button>
                ))}
              </div>
            )}
            <p className="fine-print">
              Targets represent independent binary stenosis criteria (≥ 50%) and do not sum to 100%.
            </p>
          </section>

          {/* Similar Patients Panel */}
          {result.similar_patients && result.similar_patients.length > 0 && (
            <section className="glass p-6 rounded-2xl border border-white/10 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users size={20} className="text-cyan-400" />
                  <h3 className="text-base font-semibold text-white">
                    Clinically Similar Patients (Nearest Neighbours in Out-of-Fold Cohort)
                  </h3>
                </div>
                <span className="text-xs text-white/50">
                  {result.similar_patients.length} reference profiles
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {result.similar_patients.map((sp, idx) => (
                  <div
                    key={sp.case_id || idx}
                    className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs space-y-2"
                  >
                    <div className="flex justify-between items-center text-white/70">
                      <span className="font-semibold text-white">
                        Patient #{sp.case_id}
                      </span>
                      <span>Distance: {sp.distance.toFixed(2)}</span>
                    </div>
                    <div className="text-white/60">
                      <span>
                        {sp.sex}, Age band: {sp.age_band}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-white/10 flex justify-between text-[11px]">
                      <span>CAD: {sp.outcomes?.CAD ? "Pos" : "Neg"}</span>
                      <span>LAD: {sp.outcomes?.LAD ? "Pos" : "Neg"}</span>
                      <span>LCX: {sp.outcomes?.LCX ? "Pos" : "Neg"}</span>
                      <span>RCA: {sp.outcomes?.RCA ? "Pos" : "Neg"}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="fine-print mt-3 text-white/50 text-[11px]">
                Nearest neighbours from the 303-patient training dataset (standardized Gower distance).
                Actual catheterization outcomes are retrospective labels from the Z-Alizadeh Sani cohort.
              </p>
            </section>
          )}

          {/* Mandatory Clinical Disclaimer */}
          <Notice>
            <strong>Mandatory Clinical Notice:</strong>{" "}
            {result.disclaimer ||
              "Decision support / educational use only. Predictions are per-vessel probabilities from a small single-centre dataset and are not a lesion location. Not a substitute for formal diagnostic imaging or clinical judgement."}{" "}
            <Link to="/methodology" className="inline-flex items-center gap-1 text-cyan-300 ml-1">
              Review methodology & limitations <ArrowRight size={12} />
            </Link>
          </Notice>
        </>
      )}
    </div>
  );
}

function ScanIcon() {
  return (
    <svg
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth="1.3"
    >
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8M12 8v8" />
    </svg>
  );
}
