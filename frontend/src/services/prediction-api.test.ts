import { afterEach, describe, expect, it, vi } from "vitest";
import quickFixture from "../../../docs/verification/live_predict_quick.json";
import fullFixture from "../../../docs/verification/live_predict_full.json";
import {
  liveAdapter,
  emptyInputs,
  exampleInputs,
  parsePredictionResponse,
  requestPrediction,
  validateClinicalInputs,
  ApiValidationError,
  PredictionApiError,
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
      "Too many requests. Please retry in 25s.",
    );
  });

  it("maps 400 Bad Request into PredictionApiError with kind bad_request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ detail: "Malformed parameter" }),
      }),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("bad_request");
      expect((err as PredictionApiError).status).toBe(400);
    }
  });

  it("maps 403 Forbidden into PredictionApiError with kind forbidden", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ detail: "Forbidden" }),
      }),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("forbidden");
      expect((err as PredictionApiError).status).toBe(403);
    }
  });

  it("maps 413 Payload Too Large into PredictionApiError with kind payload_too_large", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 413,
        json: async () => ({ detail: "Payload too large" }),
      }),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("payload_too_large");
      expect((err as PredictionApiError).status).toBe(413);
    }
  });

  it("maps 500 Internal Server Error into PredictionApiError with kind server_error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: "Internal error" }),
      }),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("server_error");
      expect((err as PredictionApiError).status).toBe(500);
    }
  });

  it("maps 502 Bad Gateway and 503 Service Unavailable into service_unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ detail: "Service starting up" }),
      }),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("service_unavailable");
      expect((err as PredictionApiError).status).toBe(503);
    }
  });

  it("handles non-JSON error bodies gracefully without crashing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
        text: async () => "<html><body>502 Bad Gateway</body></html>",
      }),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("service_unavailable");
    }
  });

  it("wraps malformed JSON response bodies into parse PredictionApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token in JSON at position 0");
        },
      }),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("parse");
    }
  });

  it("handles network failure cleanly without fallback to fake demo numbers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    try {
      await requestPrediction(validPayload);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(PredictionApiError);
      expect((err as PredictionApiError).kind).toBe("network");
    }
  });

  it("supports cancellation via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      requestPrediction(validPayload, "/api/predict", controller.signal),
    ).rejects.toHaveProperty("name", "AbortError");
  });
});

describe("Live JSON fixture schema regression tests", () => {
  it("validates live_predict_quick.json matches all UI-consumed fields", () => {
    expect(quickFixture).toBeDefined();
    const parsed = parsePredictionResponse(quickFixture);

    expect(parsed.mode).toBe("quick");
    expect(typeof parsed.modelVersion).toBe("string");
    expect(parsed.modelVersion.length).toBeGreaterThan(0);
    expect(typeof parsed.disclaimer).toBe("string");
    expect(parsed.disclaimer.length).toBeGreaterThan(0);

    // Consistency
    expect(["ok", "raised", "lowered"]).toContain(parsed.consistency.status);
    expect(typeof parsed.consistency.lower).toBe("number");
    expect(typeof parsed.consistency.upper).toBe("number");
    expect(typeof parsed.consistency.p_cad_model).toBe("number");
    expect(typeof parsed.consistency.p_cad_adjusted).toBe("number");

    // Targets
    for (const t of ["CAD", "LAD", "LCX", "RCA"] as const) {
      expect(parsed.display_probabilities[t]).toBeGreaterThanOrEqual(0);
      expect(parsed.display_probabilities[t]).toBeLessThanOrEqual(1);
      expect(parsed.calibrated_probabilities[t]).toBeGreaterThanOrEqual(0);
      expect(parsed.calibrated_probabilities[t]).toBeLessThanOrEqual(1);
      expect(typeof parsed.adjusted[t]).toBe("boolean");
      expect(["lower", "intermediate", "higher"]).toContain(parsed.display_bands[t]);
      expect(typeof parsed.base[t]).toBe("number");
      expect(typeof parsed.logit_model[t]).toBe("number");
      expect(Array.isArray(parsed.contributions[t])).toBe(true);
    }

    // Trust
    expect(Array.isArray(parsed.similar_patients)).toBe(true);
    expect(parsed.similar_patients.length).toBeGreaterThan(0);
    const firstPatient = parsed.similar_patients[0];
    expect(typeof firstPatient.case_id).toBe("number");
    expect(typeof firstPatient.distance).toBe("number");
    expect(typeof firstPatient.age_band).toBe("string");
    expect(typeof firstPatient.sex).toBe("string");
    expect(typeof firstPatient.outcomes.CAD).toBe("number");
  });

  it("validates live_predict_full.json matches all UI-consumed fields", () => {
    expect(fullFixture).toBeDefined();
    const parsed = parsePredictionResponse(fullFixture);

    expect(parsed.mode).toBe("full");
    expect(typeof parsed.modelVersion).toBe("string");
    expect(typeof parsed.disclaimer).toBe("string");

    // Check full-mode contributions
    expect(parsed.contributions.CAD.length).toBeGreaterThanOrEqual(5);
    const contrib = parsed.contributions.CAD[0];
    expect(typeof contrib.feature).toBe("string");
    expect(typeof contrib.contribution).toBe("number");
    expect(["up", "down"]).toContain(contrib.direction);
    expect(typeof contrib.imputed).toBe("boolean");

    // Check model info
    expect(parsed.model_info.CAD.config_name).toContain("full");
    expect(parsed.model_info.CAD.n_features).toBe(54);
    expect(parsed.model_info.CAD.features_used).toHaveLength(54);
  });
});
