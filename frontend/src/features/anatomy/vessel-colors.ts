/**
 * Vessel risk-band and color mapping utilities.
 * Consistent with backend app/config.py and frontend design tokens:
 * - lower (< 0.30): #22c55e (Green)
 * - intermediate (0.30 - 0.60): #f59e0b (Amber)
 * - higher (>= 0.60): #ef4444 (Red)
 */

export type ProbabilityBand = "lower" | "intermediate" | "higher";

export const BAND_COLORS: Record<ProbabilityBand, string> = {
  lower: "#22c55e",       // Green
  intermediate: "#f59e0b",// Amber
  higher: "#ef4444",      // Red
};

export const BAND_EMISSIVE: Record<ProbabilityBand, string> = {
  lower: "#15803d",
  intermediate: "#d97706",
  higher: "#b91c1c",
};

export const BAND_THRESHOLDS = {
  lowerMax: 0.30,
  higherMin: 0.60,
};

/**
 * Determine the display-only probability band from a numerical probability.
 */
export function getProbabilityBand(prob: number): ProbabilityBand {
  if (prob < BAND_THRESHOLDS.lowerMax) {
    return "lower";
  }
  if (prob < BAND_THRESHOLDS.higherMin) {
    return "intermediate";
  }
  return "higher";
}

/**
 * Returns hex color string corresponding to probability or explicit band.
 */
export function getVesselColor(prob: number, explicitBand?: ProbabilityBand): string {
  const band = explicitBand ?? getProbabilityBand(prob);
  return BAND_COLORS[band];
}

/**
 * Returns emissive color string for high-visibility tube rendering.
 */
export function getVesselEmissive(prob: number, explicitBand?: ProbabilityBand): string {
  const band = explicitBand ?? getProbabilityBand(prob);
  return BAND_EMISSIVE[band];
}

/**
 * Returns numerical hex value for Three.js Color / material properties.
 */
export function getVesselHexColor(prob: number, explicitBand?: ProbabilityBand): number {
  const hex = getVesselColor(prob, explicitBand);
  return parseInt(hex.replace("#", "0x"), 16);
}
