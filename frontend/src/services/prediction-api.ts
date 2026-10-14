/**
 * TrustHeart 3D Live Prediction API Client
 * Connects to live FastAPI backend at POST /api/predict.
 * Strictly adheres to docs/API_CONTRACT.md and docs/openapi.json.
 */

import {
  preparePredictPayload,
  validateClinicalInputs,
  emptyInputs,
  exampleInputs,
} from "../features/analysis/clinical-schema";
import type {
  ClinicalInputs,
  InputErrors,
} from "../features/analysis/clinical-schema";
import type {
  Target,
  PredictResponse,
  PredictRequest,
  ContributionItem,
  ModelInfo,
  ConsistencyInfo,
  SimilarPatientItem,
  TrustBlock,
  PredictWarning,
  ProbabilityBand,
  TargetPrediction,
} from "./api-types";
import { targets, targetNames } from "./api-types";

export {
  validateClinicalInputs,
  emptyInputs,
  exampleInputs,
  targets,
  targetNames,
};
export type { ClinicalInputs, InputErrors, Target };
export type { DemoInputs } from "../features/analysis/demo-schema";
export { validateDemoInputs } from "../features/analysis/demo-schema";

export interface PredictionResult {
  mode: "quick" | "full";
  // Primary display probabilities per target:
  probabilities: Record<Target, number>;
  display_probabilities: Record<Target, number>;
  calibrated_probabilities: Record<Target, number>;
  raw_probabilities: Record<Target, number>;
  bands: Record<Target, ProbabilityBand>;
  display_bands: Record<Target, ProbabilityBand>;
  adjusted: Record<Target, boolean>;
  display_notes: Record<Target, string | null | undefined>;
  consistency: ConsistencyInfo;
  contributions: Record<Target, ContributionItem[]>;
  base: Record<Target, number>;
  logit_model: Record<Target, number>;
  other_total: Record<Target, number>;
  model_info: Record<Target, ModelInfo>;
  similar_patients: SimilarPatientItem[];
  trust: TrustBlock;
  imputed: string[];
  warnings: string[];
  rawWarnings: PredictWarning[];
  createdAt: string;
  modelVersion: string;
  disclaimer: string;
  limitations: string[];
  predictions: Record<Target, TargetPrediction>;
  rawResponse: PredictResponse;
}

export interface PredictionAdapter<TInput> {
  predict(input: TInput, signal?: AbortSignal): Promise<PredictionResult>;
}

export type PredictionErrorKind =
  | "validation"
  | "rate_limit"
  | "bad_request"
  | "forbidden"
  | "payload_too_large"
  | "server_error"
  | "service_unavailable"
  | "network"
  | "parse"
  | "abort";

export class PredictionApiError extends Error {
  kind: PredictionErrorKind;
  fieldErrors?: Record<string, string>;
  retryAfter?: number;
  status?: number;

  constructor(
    message: string,
    kind: PredictionErrorKind,
    options?: { fieldErrors?: Record<string, string>; retryAfter?: number; status?: number },
  ) {
    super(message);
    this.name = "PredictionApiError";
    this.kind = kind;
    this.fieldErrors = options?.fieldErrors;
    this.retryAfter = options?.retryAfter;
    this.status = options?.status;
  }
}

export class ApiValidationError extends PredictionApiError {
  constructor(message: string, fieldErrors: Record<string, string>) {
    super(message, "validation", { fieldErrors, status: 422 });
    this.name = "ApiValidationError";
  }
}

/**
 * Extracts per-field validation errors from FastAPI 422 detail string or error array.
 */
export function parse422Errors(detail: unknown): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  if (!detail) return fieldErrors;

  if (typeof detail === "string") {
    const parts = detail.split("; ");
    for (const part of parts) {
      const match = part.match(/(?:body -> inputs -> |inputs -> )?([^:]+):\s*(.+)/);
      if (match) {
        const field = match[1].trim();
        const msg = match[2].trim();
        fieldErrors[field] = msg;
        if (["Typical Chest Pain", "Atypical", "Nonanginal"].includes(field)) {
          fieldErrors.chestPain = msg;
        }
      } else {
        fieldErrors.general = part;
      }
    }
  } else if (Array.isArray(detail)) {
    for (const err of detail) {
      const loc = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : "general";
      const msg = err.msg || "Validation error";
      fieldErrors[loc] = msg;
      if (["Typical Chest Pain", "Atypical", "Nonanginal"].includes(loc)) {
        fieldErrors.chestPain = msg;
      }
    }
  }
  return fieldErrors;
}

/**
 * Parses and verifies backend prediction response against contract.
 */
export function parsePredictionResponse(value: unknown): PredictionResult {
  if (!value || typeof value !== "object") {
    throw new Error("The backend returned an invalid response.");
  }

  const data = value as PredictResponse;
  if (!data.predictions || typeof data.predictions !== "object") {
    throw new Error("The response must include target predictions.");
  }

  for (const t of targets) {
    const pred = data.predictions[t];
    if (
      !pred ||
      typeof pred.display_probability !== "number" ||
      !Number.isFinite(pred.display_probability) ||
      pred.display_probability < 0 ||
      pred.display_probability > 1
    ) {
      throw new Error(`The response must include CAD, LAD, LCX and RCA probabilities between 0 and 1.`);
    }
  }

  const display_probabilities = {} as Record<Target, number>;
  const calibrated_probabilities = {} as Record<Target, number>;
  const raw_probabilities = {} as Record<Target, number>;
  const bands = {} as Record<Target, ProbabilityBand>;
  const display_bands = {} as Record<Target, ProbabilityBand>;
  const adjusted = {} as Record<Target, boolean>;
  const display_notes = {} as Record<Target, string | null | undefined>;
  const contributions = {} as Record<Target, ContributionItem[]>;
  const base = {} as Record<Target, number>;
  const logit_model = {} as Record<Target, number>;
  const other_total = {} as Record<Target, number>;
  const model_info = {} as Record<Target, ModelInfo>;

  for (const t of targets) {
    const p = data.predictions[t];
    display_probabilities[t] = p.display_probability;
    calibrated_probabilities[t] = p.calibrated_probability;
    raw_probabilities[t] = p.raw_probability;
    bands[t] = p.band;
    display_bands[t] = p.display_band;
    adjusted[t] = p.adjusted;
    display_notes[t] = p.display_note;
    contributions[t] = p.contributions || [];
    base[t] = p.base;
    logit_model[t] = p.logit_model;
    other_total[t] = p.other_total;
    model_info[t] = p.model_info;
  }

  return {
    mode: data.mode || "quick",
    probabilities: display_probabilities,
    display_probabilities,
    calibrated_probabilities,
    raw_probabilities,
    bands,
    display_bands,
    adjusted,
    display_notes,
    consistency: data.consistency,
    contributions,
    base,
    logit_model,
    other_total,
    model_info,
    similar_patients: data.trust?.similar_patients || [],
    trust: data.trust,
    imputed: data.imputed || [],
    warnings: (data.warnings || []).map((w) => w.message || w.code),
    rawWarnings: data.warnings || [],
    createdAt: new Date().toISOString(),
    modelVersion: data.model_version || "ml-v1",
    disclaimer: data.disclaimer || "Decision support / educational use only.",
    limitations: data.limitations || [],
    predictions: data.predictions,
    rawResponse: data,
  };
}

/**
 * Sends prediction request to the live backend.
 * Never logs input data to console or persistent storage.
 */
export async function requestPrediction(
  payload: PredictRequest,
  endpoint = "/api/predict",
  signal?: AbortSignal,
): Promise<PredictionResult> {
  const base = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${base}${cleanEndpoint}`;

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });

  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (response.status === 429) {
      const retryHeader = response.headers.get("Retry-After");
      const seconds = retryHeader ? parseInt(retryHeader, 10) : undefined;
      const msg = seconds && !isNaN(seconds)
        ? `Too many requests. Please retry in ${seconds}s.`
        : "Too many requests. Please try again later.";
      throw new PredictionApiError(msg, "rate_limit", {
        retryAfter: seconds && !isNaN(seconds) ? seconds : undefined,
        status: 429,
      });
    }

    if (response.status === 422) {
      let detail: unknown = null;
      try {
        const errBody = await response.json();
        detail = errBody?.detail;
      } catch {
        detail = await response.text().catch(() => null);
      }
      const fieldErrors = parse422Errors(detail);
      throw new ApiValidationError(
        typeof detail === "string" ? detail : "Validation failed. Please check the highlighted inputs.",
        fieldErrors,
      );
    }

    if (!response.ok) {
      let errorDetail = "";
      try {
        const errBody = await response.json();
        errorDetail = typeof errBody?.detail === "string" ? errBody.detail : JSON.stringify(errBody?.detail || errBody || "");
      } catch {
        errorDetail = await response.text().catch(() => "");
      }

      if (response.status === 400) {
        throw new PredictionApiError(
          `Invalid request (400)${errorDetail ? `: ${errorDetail}` : ". Check your submitted inputs."}`,
          "bad_request",
          { status: 400 },
        );
      }

      if (response.status === 403) {
        throw new PredictionApiError(
          "Access forbidden (403). You do not have permission to access the prediction service.",
          "forbidden",
          { status: 403 },
        );
      }

      if (response.status === 413) {
        throw new PredictionApiError(
          "Request payload is too large (413). Please shorten your inputs.",
          "payload_too_large",
          { status: 413 },
        );
      }

      if (response.status === 500) {
        throw new PredictionApiError(
          "Internal server error (500) on the prediction service. Please try again later.",
          "server_error",
          { status: 500 },
        );
      }

      if (response.status === 502) {
        throw new PredictionApiError(
          "Bad gateway (502). The prediction backend is temporarily unreachable.",
          "service_unavailable",
          { status: 502 },
        );
      }

      if (response.status === 503) {
        throw new PredictionApiError(
          "Service unavailable (503). The prediction engine is starting up or under maintenance.",
          "service_unavailable",
          { status: 503 },
        );
      }

      throw new PredictionApiError(
        `Prediction failed with status ${response.status}${errorDetail ? `: ${errorDetail}` : ""}.`,
        "server_error",
        { status: response.status },
      );
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new PredictionApiError(
        "The model service returned malformed or unreadable JSON.",
        "parse",
      );
    }

    return parsePredictionResponse(data);
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) {
      throw new DOMException("Cancelled", "AbortError");
    }
    if (error instanceof PredictionApiError) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new PredictionApiError(
        "Unable to reach the model service. Check your connection and retry.",
        "network",
      );
    }
    if (error instanceof SyntaxError) {
      throw new PredictionApiError(
        "The model service returned malformed or unreadable data. Please try again.",
        "parse",
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onParentAbort);
  }
}

/**
 * Live prediction adapter wired to POST /api/predict.
 */
export const liveAdapter: PredictionAdapter<ClinicalInputs> = {
  async predict(inputs: ClinicalInputs, signal?: AbortSignal): Promise<PredictionResult> {
    const localErrors = validateClinicalInputs(inputs);
    if (Object.keys(localErrors).length > 0) {
      throw new ApiValidationError("Please check highlighted inputs.", localErrors);
    }
    const payload = preparePredictPayload(inputs);
    return await requestPrediction(payload, "/api/predict", signal);
  },
};

// Aliased for any legacy callsite, strictly executing live inference with no fake fallback
export const demoAdapter = liveAdapter;
