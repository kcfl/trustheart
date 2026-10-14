import { describe, it, expect } from "vitest";
import {
  getProbabilityBand,
  getVesselColor,
  getVesselEmissive,
  getVesselHexColor,
  BAND_COLORS,
  BAND_EMISSIVE,
  BAND_THRESHOLDS,
} from "./vessel-colors";

describe("vessel-colors mapping", () => {
  it("correctly identifies lower probability band (< 0.30)", () => {
    expect(getProbabilityBand(0.0)).toBe("lower");
    expect(getProbabilityBand(0.15)).toBe("lower");
    expect(getProbabilityBand(0.299)).toBe("lower");
  });

  it("correctly identifies intermediate probability band (0.30 - 0.60)", () => {
    expect(getProbabilityBand(0.30)).toBe("intermediate");
    expect(getProbabilityBand(0.45)).toBe("intermediate");
    expect(getProbabilityBand(0.599)).toBe("intermediate");
  });

  it("correctly identifies higher probability band (>= 0.60)", () => {
    expect(getProbabilityBand(0.60)).toBe("higher");
    expect(getProbabilityBand(0.85)).toBe("higher");
    expect(getProbabilityBand(1.0)).toBe("higher");
  });

  it("maps probability to consistent band colors", () => {
    expect(getVesselColor(0.22)).toBe(BAND_COLORS.lower); // #22c55e (green)
    expect(getVesselColor(0.53)).toBe(BAND_COLORS.intermediate); // #f59e0b (amber)
    expect(getVesselColor(0.85)).toBe(BAND_COLORS.higher); // #ef4444 (red)
  });

  it("respects explicit band override when provided", () => {
    // If backend provided an explicit band for borderline cases
    expect(getVesselColor(0.29, "intermediate")).toBe(BAND_COLORS.intermediate);
    expect(getVesselColor(0.70, "lower")).toBe(BAND_COLORS.lower);
  });

  it("provides valid emissive colors and hex values", () => {
    expect(getVesselEmissive(0.22)).toBe(BAND_EMISSIVE.lower);
    expect(getVesselHexColor(0.22)).toBe(0x22c55e);
    expect(getVesselHexColor(0.50)).toBe(0xf59e0b);
    expect(getVesselHexColor(0.90)).toBe(0xef4444);
  });

  it("has consistent thresholds matching clinical backend config", () => {
    expect(BAND_THRESHOLDS.lowerMax).toBe(0.30);
    expect(BAND_THRESHOLDS.higherMin).toBe(0.60);
  });
});
