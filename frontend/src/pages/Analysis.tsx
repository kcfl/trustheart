import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  FlaskConical,
  LockKeyhole,
  ShieldCheck,
  SlidersHorizontal,
  LoaderCircle,
  Activity,
} from "lucide-react";
import { useAppState } from "../App";
import { SmoothInput } from "@/components/ui/smooth-input";
import { PageHeading, Notice } from "../components/UI";
import {
  liveAdapter,
  emptyInputs,
  exampleInputs,
  validateClinicalInputs,
  ApiValidationError,
} from "../services/prediction-api";
import type { ClinicalInputs, InputErrors } from "../services/prediction-api";
import type { SamplesResponse, SamplePatient } from "../services/api-types";
import {
  CLINICAL_GROUPS,
  HARD_FEATURE_RANGES,
} from "../features/analysis/clinical-schema";

export default function Analysis() {
  const { inputs, setInputs, setResult } = useAppState();
  const [errors, setErrors] = useState<InputErrors>({});
  const [step, setStep] = useState<"parameters" | "review" | "loading">(
    "parameters",
  );
  const [fullExpanded, setFullExpanded] = useState(inputs.mode === "full");
  const [consent, setConsent] = useState(false);
  const [failure, setFailure] = useState("");
  const abort = useRef<AbortController | null>(null);
  const navigate = useNavigate();

  useEffect(() => () => abort.current?.abort(), []);

  const change = (key: string, value: string) => {
    const updated: ClinicalInputs = { ...inputs, [key]: value };
    if (key === "mode") {
      setFullExpanded(value === "full");
    }
    setInputs(updated);
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      if (["Typical Chest Pain", "Atypical", "Nonanginal"].includes(key)) {
        delete next.chestPain;
      }
      return next;
    });
    setResult(null);
  };

  function review(e: React.FormEvent) {
    e.preventDefault();
    const next = validateClinicalInputs(inputs);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0];
      requestAnimationFrame(() => {
        document.getElementById(firstKey)?.focus();
      });
      return;
    }
    setStep("review");
    setFailure("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function submit() {
    if (!consent || step === "loading") return;
    setResult(null);
    setFailure("");
    setStep("loading");
    abort.current = new AbortController();

    try {
      const result = await liveAdapter.predict(inputs, abort.current.signal);
      setResult(result);
      navigate("/results");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (e instanceof ApiValidationError) {
        setErrors(e.fieldErrors || {});
        setFailure(e.message);
      } else if (e instanceof Error) {
        setFailure(e.message);
      } else {
        setFailure("An unexpected error occurred. Please try again.");
      }
      setStep("review");
    }
  }

  const fillExample = () => {
    setInputs({ ...exampleInputs, mode: inputs.mode || "quick" });
    setErrors({});
    setResult(null);
  };

  const loadSampleP10 = async () => {
    try {
      setFailure("");
      const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
      const res = await fetch(`${base}/api/samples`);
      if (!res.ok) {
        throw new Error(`Failed to load sample profiles (HTTP ${res.status}).`);
      }
      const data: SamplesResponse = await res.json();
      const p10: SamplePatient | undefined = data.samples?.find((s: SamplePatient) => s.label === "p10");
      if (!p10?.inputs) {
        throw new Error("Sample p10 was not found in response.");
      }
      const sampleInputs: ClinicalInputs = {
        mode: inputs.mode || "quick",
        Age: String(p10.inputs.Age ?? "47"),
        Sex: String(p10.inputs.Sex ?? "Male"),
        chestPain: p10.inputs["Typical Chest Pain"]
          ? "Typical"
          : p10.inputs.Atypical
            ? "Atypical"
            : p10.inputs.Nonanginal
              ? "Non-anginal"
              : "None",
        DM: p10.inputs.DM ? "Yes" : "No",
        HTN: p10.inputs.HTN ? "Yes" : "No",
      };
      // If full mode, also map other fields
      for (const [k, v] of Object.entries(p10.inputs)) {
        if (["Age", "Sex", "Typical Chest Pain", "Atypical", "Nonanginal", "DM", "HTN"].includes(k)) continue;
        if (typeof v === "boolean") {
          sampleInputs[k] = v ? "Yes" : "No";
        } else if (v !== null && v !== undefined) {
          sampleInputs[k] = String(v);
        }
      }
      setInputs(sampleInputs);
      setErrors({});
      setResult(null);
    } catch (err) {
      setFailure(err instanceof Error ? err.message : "Failed to load sample p10 data.");
    }
  };

  return (
    <div className="page-container analysis-page">
      <PageHeading
        number="02"
        eyebrow="THE ANALYSIS WORKSPACE"
        title={
          <>
            Start with <em>the signals.</em>
          </>
        }
        text="Calibrated cardiovascular risk assessment across four coronary targets."
      />

      <div className="analysis-layout">
        <div>
          <div className="stepper" aria-label="Analysis progress">
            {["Parameters", "Review inputs", "Explore results"].map((x, i) => (
              <div
                key={x}
                className={
                  (i === 0 && step === "parameters") ||
                  (i === 1 && step !== "parameters")
                    ? "current"
                    : i === 0
                      ? "complete"
                      : ""
                }
              >
                <span>
                  {i === 0 && step !== "parameters" ? (
                    <Check size={13} />
                  ) : (
                    `0${i + 1}`
                  )}
                </span>
                {x}
                {i < 2 && <i />}
              </div>
            ))}
          </div>

          {step === "parameters" ? (
            <form className="form-panel glass" onSubmit={review} noValidate>
              <div className="panel-heading">
                <div>
                  <span className="card-overline">STEP 01</span>
                  <h2>Clinical parameters</h2>
                  <p>Provide patient features for calibrated multi-target inference.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="small-button"
                    onClick={loadSampleP10}
                    title="Load verified sample patient profile (p10)"
                  >
                    <FlaskConical size={14} /> Sample patient (p10)
                  </button>
                  <button
                    type="button"
                    className="small-button"
                    onClick={fillExample}
                  >
                    Fill example
                  </button>
                </div>
              </div>

              <div className="field choice-field">
                <label className="card-overline">OPERATIONAL MODE</label>
                <div className="segmented-control" role="radiogroup">
                  <label className={inputs.mode !== "full" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="mode"
                      value="quick"
                      checked={inputs.mode !== "full"}
                      onChange={() => change("mode", "quick")}
                    />
                    Quick mode (7 features)
                  </label>
                  <label className={inputs.mode === "full" ? "selected" : ""}>
                    <input
                      type="radio"
                      name="mode"
                      value="full"
                      checked={inputs.mode === "full"}
                      onChange={() => change("mode", "full")}
                    />
                    Full mode (multimodal)
                  </label>
                </div>
              </div>

              <Notice>
                {inputs.mode === "full"
                  ? "Full mode supports 54 multimodal clinical features. Missing fields are automatically imputed using dataset training medians."
                  : "Quick mode uses 7 bedside screening features validated across nested cross-validation."}
              </Notice>

              {/* 1. Basic Information (Quick features) */}
              <div className="form-group-heading">
                <SlidersHorizontal size={15} />
                <h3>Bedside screening features</h3>
                <span>REQUIRED FOR PREDICTION</span>
              </div>

              <div className="form-grid">
                {/* Age */}
                <div className="field">
                  <label htmlFor="Age">Age</label>
                  <div className={`input-wrap ${errors.Age ? "invalid" : ""}`}>
                    <SmoothInput
                      id="Age"
                      name="Age"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      autoComplete="off"
                      spellCheck={false}
                      wrapperClassName="smooth-input-integrated"
                      placeholder="e.g. 58"
                      value={inputs.Age || ""}
                      onChange={(e) => change("Age", e.target.value)}
                      aria-invalid={!!errors.Age}
                      aria-describedby="Age-help"
                    />
                    <span>years</span>
                  </div>
                  <span
                    className={errors.Age ? "field-error" : "field-hint"}
                    id="Age-help"
                  >
                    {errors.Age || "Valid range: 0–120 years"}
                  </span>
                </div>

                {/* Sex */}
                <div className="field">
                  <label htmlFor="Sex">
                    Sex <span>Biologic sex</span>
                  </label>
                  <select
                    id="Sex"
                    value={inputs.Sex || ""}
                    aria-invalid={!!errors.Sex}
                    aria-describedby={errors.Sex ? "Sex-error" : undefined}
                    onChange={(e) => change("Sex", e.target.value)}
                  >
                    <option value="">Select category</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {errors.Sex && (
                    <span className="field-error" id="Sex-error">
                      {errors.Sex}
                    </span>
                  )}
                </div>

                {/* Chest Pain presentation */}
                <div className="field">
                  <label htmlFor="chestPain">
                    Chest pain <span>Clinical presentation</span>
                  </label>
                  <select
                    id="chestPain"
                    value={inputs.chestPain || ""}
                    aria-invalid={!!errors.chestPain}
                    aria-describedby={errors.chestPain ? "chestPain-error" : undefined}
                    onChange={(e) => change("chestPain", e.target.value)}
                  >
                    <option value="">Select presentation</option>
                    <option value="None">None / Asymptomatic</option>
                    <option value="Typical">Typical angina</option>
                    <option value="Atypical">Atypical angina</option>
                    <option value="Non-anginal">Non-anginal chest pain</option>
                  </select>
                  {errors.chestPain && (
                    <span className="field-error" id="chestPain-error">
                      {errors.chestPain}
                    </span>
                  )}
                </div>

                {/* Diabetes (DM) */}
                <fieldset
                  className="field choice-field"
                  id="DM"
                  tabIndex={-1}
                  aria-describedby={errors.DM ? "DM-error" : undefined}
                >
                  <legend>Diabetes mellitus (DM)</legend>
                  <div className="segmented-control">
                    {["Yes", "No"].map((value) => (
                      <label
                        key={value}
                        className={inputs.DM === value ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name="DM"
                          value={value}
                          checked={inputs.DM === value}
                          onChange={() => change("DM", value)}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                  {errors.DM && (
                    <span className="field-error" id="DM-error">
                      {errors.DM}
                    </span>
                  )}
                </fieldset>

                {/* Hypertension (HTN) */}
                <fieldset
                  className="field choice-field"
                  id="HTN"
                  tabIndex={-1}
                  aria-describedby={errors.HTN ? "HTN-error" : undefined}
                >
                  <legend>Hypertension (HTN)</legend>
                  <div className="segmented-control">
                    {["Yes", "No"].map((value) => (
                      <label
                        key={value}
                        className={inputs.HTN === value ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name="HTN"
                          value={value}
                          checked={inputs.HTN === value}
                          onChange={() => change("HTN", value)}
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                  {errors.HTN && (
                    <span className="field-error" id="HTN-error">
                      {errors.HTN}
                    </span>
                  )}
                </fieldset>
              </div>

              {/* Expandable Full Mode section */}
              <div className="subtle-divider mt-6" />
              <div className="mt-4">
                <button
                  type="button"
                  className="w-full text-left py-3 px-4 glass rounded-xl flex items-center justify-between cursor-pointer border border-white/10 hover:border-white/20 transition-all"
                  onClick={() => setFullExpanded(!fullExpanded)}
                  aria-expanded={fullExpanded}
                >
                  <div className="flex items-center gap-3">
                    <Activity size={18} className="text-cyan-400" />
                    <div>
                      <strong className="block text-sm text-white font-medium">
                        More clinical details (Full mode)
                      </strong>
                      <span className="text-xs text-white/50">
                        Demographics, vitals, ECG, labs, and echo (all optional)
                      </span>
                    </div>
                  </div>
                  {fullExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {fullExpanded && (
                  <div className="mt-4 space-y-6 pt-2">
                    {Object.entries(CLINICAL_GROUPS).map(([groupKey, group]) => (
                      <div key={groupKey} className="glass p-4 rounded-xl border border-white/5">
                        <div className="form-group-heading mb-3">
                          <h3>{group.label}</h3>
                          <span>OPTIONAL · BLANK = MISSING</span>
                        </div>
                        <div className="form-grid">
                          {group.fields.map((field) => (
                            <div className="field" key={field.name}>
                              <label htmlFor={field.name}>
                                {field.label}
                                {field.unit && <span>{field.unit}</span>}
                              </label>

                              {field.kind === "continuous" || field.kind === "ordinal" ? (
                                <div
                                  className={`input-wrap ${
                                    errors[field.name] ? "invalid" : ""
                                  }`}
                                >
                                  <SmoothInput
                                    id={field.name}
                                    name={field.name}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    spellCheck={false}
                                    wrapperClassName="smooth-input-integrated"
                                    placeholder={
                                      HARD_FEATURE_RANGES[field.name]
                                        ? `Range: ${HARD_FEATURE_RANGES[field.name][0]}–${HARD_FEATURE_RANGES[field.name][1]}`
                                        : "Optional"
                                    }
                                    value={inputs[field.name] || ""}
                                    onChange={(e) =>
                                      change(field.name, e.target.value)
                                    }
                                    aria-invalid={!!errors[field.name]}
                                  />
                                  {field.unit && <span>{field.unit}</span>}
                                </div>
                              ) : field.kind === "categorical" ? (
                                <select
                                  id={field.name}
                                  value={inputs[field.name] || ""}
                                  onChange={(e) =>
                                    change(field.name, e.target.value)
                                  }
                                >
                                  <option value="">Not recorded (missing)</option>
                                  {field.options?.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <select
                                  id={field.name}
                                  value={inputs[field.name] || ""}
                                  onChange={(e) =>
                                    change(field.name, e.target.value)
                                  }
                                >
                                  <option value="">Not recorded (missing)</option>
                                  <option value="Yes">Yes</option>
                                  <option value="No">No</option>
                                </select>
                              )}

                              {errors[field.name] ? (
                                <span className="field-error">
                                  {errors[field.name]}
                                </span>
                              ) : (
                                HARD_FEATURE_RANGES[field.name] && (
                                  <span className="field-hint">
                                    Range: {HARD_FEATURE_RANGES[field.name][0]}–
                                    {HARD_FEATURE_RANGES[field.name][1]}
                                  </span>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-actions mt-8">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setInputs({ ...emptyInputs });
                    setErrors({});
                    setResult(null);
                  }}
                >
                  Clear inputs
                </button>
                <button type="submit" className="button button-primary">
                  Review inputs <ArrowRight size={16} />
                </button>
              </div>
            </form>
          ) : (
            <div className="form-panel glass">
              <div className="panel-heading">
                <div>
                  <span className="card-overline">STEP 02</span>
                  <h2>
                    {step === "loading"
                      ? "Computing calibrated probabilities"
                      : "Review clinical inputs"}
                  </h2>
                  <p>
                    {step === "loading"
                      ? "Evaluating model inference, Fréchet coherence bounds, and linear contributions..."
                      : "Verify provided features before running model prediction."}
                  </p>
                </div>
                <CheckCheck className="mint" size={26} />
              </div>

              <dl className="review-list">
                <div>
                  <dt>Operational mode</dt>
                  <dd>{inputs.mode === "full" ? "Full mode (Multimodal)" : "Quick mode (Bedside)"}</dd>
                </div>
                <div>
                  <dt>Age</dt>
                  <dd>{inputs.Age || "—"} years</dd>
                </div>
                <div>
                  <dt>Sex</dt>
                  <dd>{inputs.Sex || "—"}</dd>
                </div>
                <div>
                  <dt>Chest pain</dt>
                  <dd>{inputs.chestPain || "—"}</dd>
                </div>
                <div>
                  <dt>Diabetes (DM)</dt>
                  <dd>{inputs.DM || "—"}</dd>
                </div>
                <div>
                  <dt>Hypertension (HTN)</dt>
                  <dd>{inputs.HTN || "—"}</dd>
                </div>
                {inputs.mode === "full" &&
                  Object.entries(inputs).map(([k, v]) => {
                    if (["mode", "Age", "Sex", "chestPain", "DM", "HTN"].includes(k) || !v) return null;
                    return (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    );
                  })}
              </dl>

              <Notice>
                Unspecified optional fields will be treated as missing and imputed using training-set medians.
              </Notice>

              <label className="consent-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={step === "loading"}
                />
                <span>
                  I understand this model is for decision support and research demonstration, not formal diagnosis.
                </span>
              </label>

              {failure && (
                <div role="alert" className="error-alert">
                  {failure}
                </div>
              )}

              <div className="form-actions">
                {step === "loading" ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      abort.current?.abort();
                      setStep("review");
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => setStep("parameters")}
                  >
                    <ArrowLeft size={15} /> Edit inputs
                  </button>
                )}
                <button
                  className="button button-primary"
                  onClick={submit}
                  disabled={!consent || step === "loading"}
                >
                  {step === "loading" ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> Running inference…
                    </>
                  ) : (
                    <>
                      Run prediction <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>

              <span className="sr-only" aria-live="polite">
                {step === "loading" ? "Running prediction..." : ""}
              </span>
            </div>
          )}
        </div>

        <aside className="analysis-sidebar">
          <div data-scroll-card="" className="sidebar-card glass">
            <span className="sidebar-icon">
              <ShieldCheck size={23} strokeWidth={1.3} />
            </span>
            <h3>
              Decision support.
              <br />
              Not a diagnosis.
            </h3>
            <p>
              TrustHeart 3D evaluates statistical risk across four distinct coronary artery targets.
            </p>
            <div className="subtle-divider" />
            <ul className="check-list">
              <li>
                <Check size={14} /> Platt-calibrated probabilities
              </li>
              <li>
                <Check size={14} /> Fréchet joint logical consistency
              </li>
              <li>
                <Check size={14} /> Exact linear logit explainability
              </li>
            </ul>
            <div className="sidebar-note">
              <LockKeyhole size={14} />
              <span>
                Inputs are processed in real-time by the API and are never logged or stored.
              </span>
            </div>
          </div>

          <div className="sidebar-help">
            <span className="card-overline">EVALUATED TARGETS</span>
            <p>
              Coronary artery disease (CAD) overall, plus left anterior descending (LAD),
              left circumflex (LCX), and right coronary artery (RCA).
            </p>
            <span className="target-pills">
              {["CAD", "LAD", "LCX", "RCA"].map((t) => (
                <span key={t}>{t}</span>
              ))}
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
