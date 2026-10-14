/**
 * TypeScript definitions copied strictly from OpenAPI / Pydantic schemas:
 * docs/openapi.json and backend/app/schemas.py
 */

export type Target = "CAD" | "LAD" | "LCX" | "RCA";

export const targets: Target[] = ["CAD", "LAD", "LCX", "RCA"];

export const targetNames: Record<Target, string> = {
  CAD: "Coronary artery disease",
  LAD: "Left anterior descending",
  LCX: "Left circumflex",
  RCA: "Right coronary artery",
};

export type PredictionMode = "quick" | "full";

export type ProbabilityBand = "lower" | "intermediate" | "higher";

export type ConsistencyStatus = "ok" | "raised" | "lowered";

export type ContributionDirection = "up" | "down";

export interface PredictRequest {
  mode: PredictionMode;
  inputs: Record<string, unknown>;
  case_id?: number | null;
}

export interface ContributionItem {
  feature: string;
  value: unknown;
  contribution: number;
  direction: ContributionDirection;
  stability_tag?: string | null;
  imputed?: boolean;
}

export interface ModelInfo {
  config_name: string;
  n_features: number;
  features_used: string[];
  source_space: "quick" | "auto";
}

export interface TargetPrediction {
  raw_probability: number;
  calibrated_probability: number;
  band: ProbabilityBand;
  display_probability: number;
  display_band: ProbabilityBand;
  adjusted: boolean;
  display_note?: string | null;
  base: number;
  contributions: ContributionItem[];
  other_total: number;
  logit_model: number;
  model_info: ModelInfo;
  base_rate: number;
  base_rate_note?: string;
}

export interface ConsistencyInfo {
  status: ConsistencyStatus;
  lower: number;
  upper: number;
  p_cad_model: number;
  p_cad_adjusted: number;
}

export interface SimilarPatientItem {
  case_id: number;
  distance: number;
  age_band: string;
  sex: string;
  outcomes: Record<string, number>;
}

export interface LiftItem {
  paired_mean: number;
  p2_5: number;
  p97_5: number;
  selection_identical_fraction: number;
  note?: string;
}

export interface TrustBlock {
  similar_patients: SimilarPatientItem[];
  evidence_estimate?: Record<string, number> | null;
  evidence_auc: Record<string, number>;
  lift: Record<string, LiftItem>;
  bands_note?: string;
}

export interface PredictWarning {
  code: string;
  message?: string | null;
  feature?: string | null;
  target?: string | null;
  value?: unknown;
  min?: number | null;
  max?: number | null;
}

export interface PredictResponse {
  request_id: string;
  mode: PredictionMode;
  model_version: string;
  predictions: Record<Target, TargetPrediction>;
  consistency: ConsistencyInfo;
  trust: TrustBlock;
  imputed: string[];
  warnings: PredictWarning[];
  oof_estimate?: Record<string, number> | null;
  oof_estimate_note?: string | null;
  disclaimer: string;
  limitations: string[];
}

export interface HealthResponse {
  status: string;
  model_version: string;
  git_commit: string;
  models_verified: boolean;
  disclaimer: string;
}

export interface FeatureMetaItem {
  name: string;
  label: string;
  kind: "binary" | "continuous" | "ordinal" | "categorical";
  group: string;
  allowed_values?: unknown[] | null;
  training_min: number;
  training_max: number;
  training_median: number;
  training: { min: number; max: number; median: number };
  in_quick: boolean;
  unit?: string | null;
}

export interface ModeDefinition {
  name: string;
  description: string;
  n_features: number;
  features: string[];
}

export interface BandMetaItem {
  name: string;
  min: number;
  max: number;
}

export interface MetaResponse {
  modes: Record<string, ModeDefinition>;
  features: FeatureMetaItem[];
  bands: BandMetaItem[];
}

export interface SamplePatient {
  case_id: number;
  label: "p10" | "median" | "p90" | "lcx_positive_near_median";
  label_text: string;
  inputs: Record<string, unknown>;
  ground_truth: Record<string, number>;
  ground_truth_note?: string;
  oof_estimate: Record<string, number>;
  oof_estimate_note?: string;
}

export interface SamplesResponse {
  samples: SamplePatient[];
}
