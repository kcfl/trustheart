import { afterEach, describe, expect, it, vi } from "vitest";
import {
  liveAdapter,
  emptyInputs,
  exampleInputs,
  parsePredictionResponse,
  requestPrediction,
  validateClinicalInputs,
  ApiValidationError,
  parse422Errors,
} from "./prediction-api";
import type { PredictResponse, PredictRequest } from "./api-types";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Clinical input validation", () => {
  it("requires all 5 primary screening fields in quick mode", () => {
    const errors = validateClinicalInputs(emptyInputs);
    expect(errors.Age).toBeTruthy();
    expect(errors.Sex).toBeTruthy();
    expect(errors.chestPain).toBeTruthy();
    expect(errors.DM).toBeTruthy();
    expect(errors.HTN).toBeTruthy();
  });

  it("accepts valid example screening inputs", () => {
    expect(validateClinicalInputs(exampleInputs)).toEqual({});
  });

  it.each(["-1", "121", "NaN", "Infinity", "40.5", "abc"])(
    "rejects invalid age %s",
    (Age) => {
      expect(validateClinicalInputs({ ...exampleInputs, Age }).Age).toBeTruthy();
    },
  );

  it("rejects unsupported categories for sex, chest pain, and binary fields", () => {
    const errors = validateClinicalInputs({
      ...exampleInputs,
      Sex: "Other",
      chestPain: "" as any,
      DM: "Maybe" as any,
      HTN: "" as any,
    });
    expect(errors.Sex).toBeTruthy();
    expect(errors.chestPain).toBeTruthy();
    expect(errors.DM).toBeTruthy();
    expect(errors.HTN).toBeTruthy();
  });

  it("enforces physiological HARD_FEATURE_RANGES for full-mode features", () => {
    const errors = validateClinicalInputs({
      ...exampleInputs,
      mode: "full",
      BP: "350", // max 300
      CR: "0.05", // min 0.1
      "EF-TTE": "105", // max 95
    });
    expect(errors.BP).toBeTruthy();
    expect(errors.CR).toBeTruthy();
    expect(errors["EF-TTE"]).toBeTruthy();
  });

  it("allows blank optional fields in full mode", () => {
    const errors = validateClinicalInputs({
      ...exampleInputs,
      mode: "full",
      BP: "",
      PR: "",
      FBS: "",
    });
    expect(errors).toEqual({});
  });
});

const mockValidResponse: PredictResponse = {
  request_id: "test-req-001",
  mode: "quick",
  model_version: "ml-v1 (test)",
  predictions: {
    CAD: {
      raw_probability: 0.72,
      calibrated_probability: 0.68,
      band: "higher",
      display_probability: 0.68,
      display_band: "higher",
      adjusted: false,
      display_note: null,
      base: 0.5,
      contributions: [
        {
          feature: "Age",
          value: 58,
          contribution: 0.35,
          direction: "up",
          stability_tag: null,
          imputed: false,
        },
      ],
      other_total: 0.0,
      logit_model: 0.85,
      model_info: {
        config_name: "compact|LR|C=0.001",
        n_features: 7,
        features_used: ["Age"],
        source_space: "quick",
      },
      base_rate: 0.71,
    },
    LAD: {
      raw_probability: 0.55,
      calibrated_probability: 0.52,
      band: "intermediate",
      display_probability: 0.52,
      display_band: "intermediate",
      adjusted: false,
      display_note: null,
      base: 0.2,
      contributions: [],
      other_total: 0.0,
      logit_model: 0.2,
      model_info: {
        config_name: "compact|LR|C=0.001",
        n_features: 7,
        features_used: [],
        source_space: "quick",
      },
      base_rate: 0.58,
    },
    LCX: {
      raw_probability: 0.25,
      calibrated_probability: 0.28,
      band: "lower",
      display_probability: 0.28,
      display_band: "lower",
      adjusted: false,
      display_note: null,
      base: -0.4,
      contributions: [],
      other_total: 0.0,
      logit_model: -0.4,
      model_info: {
        config_name: "compact|LR|C=0.03",
        n_features: 7,
        features_used: [],
        source_space: "quick",
      },
      base_rate: 0.39,
    },
    RCA: {
      raw_probability: 0.35,
      calibrated_probability: 0.38,
      band: "intermediate",
      display_probability: 0.38,
      display_band: "intermediate",
      adjusted: false,
      display_note: null,
      base: -0.5,
      contributions: [],
      other_total: 0.0,
      logit_model: -0.5,
      model_info: {
        config_name: "compact|LR|C=0.001",
        n_features: 7,
        features_used: [],
        source_space: "quick",
      },
      base_rate: 0.38,
    },
  },
  consistency: {
    status: "ok",
    lower: 0.52,
    upper: 1.0,
    p_cad_model: 0.68,
    p_cad_adjusted: 0.68,
  },
  trust: {
    similar_patients: [
      {
        case_id: 42,
        distance: 1.12,
        age_band: "55-64",
        sex: "Male",
        outcomes: { CAD: 1, LAD: 1, LCX: 0, RCA: 0 },
      },
    ],
    evidence_auc: { CAD: 0.89, LAD: 0.78, LCX: 0.72, RCA: 0.73 },
    lift: {
      CAD: {
        paired_mean: 0.02,
        p2_5: 0.01,
        p97_5: 0.03,
        selection_identical_fraction: 0.06,
        note: "repeat interval",
      },
      LAD: {
        paired_mean: 0.04,
        p2_5: 0.03,
        p97_5: 0.05,
        selection_identical_fraction: 0.0,
        note: "repeat interval",
      },
      LCX: {
        paired_mean: -0.001,
        p2_5: -0.01,
        p97_5: 0.003,
        selection_identical_fraction: 0.9,
        note: "repeat interval",
      },
      RCA: {
        paired_mean: -0.003,
        p2_5: -0.01,
        p97_5: 0.0,
        selection_identical_fraction: 0.92,
        note: "repeat interval",
      },
    },
    bands_note: "Bands are display categories.",
  },
  imputed: [],
  warnings: [],
  disclaimer: "Decision support / educational use only.",
  limitations: ["Single-centre dataset."],
};

describe("Response boundary parsing", () => {
  it("parses and validates live API response without inventing fields", () => {
    const result = parsePredictionResponse(mockValidResponse);
    expect(result.display_probabilities.CAD).toBe(0.68);
    expect(result.calibrated_probabilities.CAD).toBe(0.68);
    expect(result.adjusted.CAD).toBe(false);
    expect(result.consistency.status).toBe("ok");
    expect(result.similar_patients).toHaveLength(1);
    expect(result.modelVersion).toBe("ml-v1 (test)");
  });

  it.each([
    null,
    {},
    { predictions: { CAD: 0.5 } },
    { ...mockValidResponse, predictions: { ...mockValidResponse.predictions, LAD: null as any } },
    {
      ...mockValidResponse,
      predictions: {
        ...mockValidResponse.predictions,
        LCX: { ...mockValidResponse.predictions.LCX, display_probability: 1.5 },
      },
    },
  ])("rejects malformed responses", (value) => {
    expect(() => parsePredictionResponse(value)).toThrow();
  });
});

describe("422 validation error parsing", () => {
  it("maps FastAPI string detail onto field names", () => {
    const detail =
      "body -> inputs -> Age: Value 130.0 for feature 'Age' is outside valid range [0.0, 120.0].; body -> inputs -> BP: Value 20.0 for feature 'BP' is outside valid range [30.0, 300.0].";
    const mapped = parse422Errors(detail);
    expect(mapped.Age).toContain("outside valid range");
    expect(mapped.BP).toContain("outside valid range");
  });

  it("maps chest pain binary fields to chestPain form control", () => {
    const detail = "body -> inputs -> Typical Chest Pain: Expected boolean.";
    const mapped = parse422Errors(detail);
    expect(mapped.chestPain).toContain("Expected boolean");
  });
});

describe("Live API request utility", () => {
  const validPayload: PredictRequest = {
    mode: "quick",
    inputs: {
      Age: 58,
      Sex: "Male",
      "Typical Chest Pain": true,
      Atypical: false,
      Nonanginal: false,
      DM: false,
      HTN: true,
    },
    case_id: null,
  };

  it("handles successful live response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockValidResponse,
      }),
    );
    const result = await requestPrediction(validPayload);
    expect(result.display_probabilities.CAD).toBe(0.68);
  });

  it("maps 422 Unprocessable Entity into ApiValidationError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          detail: "body -> inputs -> Age: Value 130.0 for feature 'Age' is outside valid range [0.0, 120.0].",
        }),
      }),
    );
    await expect(requestPrediction(validPayload)).rejects.toThrow(ApiValidationError);
  });

  it("maps 429 Rate Limit into friendly retry message using Retry-After header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "Retry-After": "25" }),
        json: async () => ({ detail: "Rate limit exceeded" }),
      }),
    );
    await expect(requestPrediction(validPayload)).rejects.toThrow(
      "Too many requests. Please retry in 25 seconds.",
    );
  });

  it("maps 413 Payload Too Large into friendly error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({ detail: "Payload too large" }),
      }),
    );
    await expect(requestPrediction(validPayload)).rejects.toThrow(
      "Request payload is too large",
    );
  });

  it("maps 500 Internal Server Error cleanly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Server error" }),
      }),
    );
    await expect(requestPrediction(validPayload)).rejects.toThrow(
      "Internal server error",
    );
  });

  it("handles network failure cleanly without fallback to fake demo numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(requestPrediction(validPayload)).rejects.toThrow(
      "Unable to reach the model service",
    );
  });

  it("supports cancellation via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestPrediction(validPayload, "/api/predict", controller.signal),
    ).rejects.toHaveProperty("name", "AbortError");
  });
});
