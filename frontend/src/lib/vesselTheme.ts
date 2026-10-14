import type { PredictResponse } from '../api/client'
import type { BandMetaItem } from '../theme'

export type VesselTarget = 'LAD' | 'LCX' | 'RCA'

export const VESSEL_TARGETS: VesselTarget[] = ['LAD', 'LCX', 'RCA']

export const VESSEL_FULL_NAMES: Record<VesselTarget, string> = {
  LAD: 'Left Anterior Descending Artery',
  LCX: 'Left Circumflex Artery',
  RCA: 'Right Coronary Artery',
}

/**
 * Fixed medical wording required by protocol.
 */
export const VESSEL_WORDING = 'Per-vessel probability, not lesion location'

/**
 * Colorblind-safe accessible palette:
 * - Lower: accessible cool blue (#2b83ba)
 * - Intermediate: accessible amber / warm gold (#e69f00)
 * - Higher: accessible vermilion / crimson (#d55e00)
 * - Neutral: clean slate (#94a3b8)
 */
export const ACCESSIBLE_BAND_COLORS: Record<'lower' | 'intermediate' | 'higher' | 'neutral', string> = {
  lower: '#4C9BE8',
  intermediate: '#F5B83D',
  higher: '#D7263D',
  neutral: '#8A94A6',
}

/**
 * Map a probability to a band name using dynamic API cutoffs.
 * Cutoffs default to (0.30, 0.60) if not supplied.
 */
export function probabilityToBand(
  probability: number,
  bands?: BandMetaItem[]
): 'lower' | 'intermediate' | 'higher' {
  if (bands && bands.length >= 3) {
    for (const b of bands) {
      if (probability >= b.min && (probability < b.max || (b.max >= 1.0 && probability <= 1.0))) {
        if (b.name === 'lower' || b.name === 'intermediate' || b.name === 'higher') {
          return b.name
        }
      }
    }
  }

  // Fallback cutoffs from spec: < 0.30, 0.30 - 0.60, >= 0.60
  if (probability < 0.30) {
    return 'lower'
  }
  if (probability < 0.60) {
    return 'intermediate'
  }
  return 'higher'
}

/**
 * Get the color for a probability and given band cutoffs.
 */
export function getBandColor(
  probability: number | null | undefined,
  bands?: BandMetaItem[]
): string {
  if (probability === null || probability === undefined || !Number.isFinite(probability)) {
    return ACCESSIBLE_BAND_COLORS.neutral
  }
  const band = probabilityToBand(probability, bands)
  return ACCESSIBLE_BAND_COLORS[band]
}

/**
 * Get the display color for a vessel given a prediction result.
 */
export function getVesselColor(
  vessel: VesselTarget,
  result: PredictResponse | null,
  bands?: BandMetaItem[]
): string {
  if (!result || !result.predictions || !result.predictions[vessel]) {
    return ACCESSIBLE_BAND_COLORS.neutral
  }
  const pred = result.predictions[vessel]
  // Prefer display_band from API if valid, otherwise compute from display_probability
  if (pred.display_band === 'lower' || pred.display_band === 'intermediate' || pred.display_band === 'higher') {
    return ACCESSIBLE_BAND_COLORS[pred.display_band]
  }
  return getBandColor(pred.display_probability, bands)
}

/**
 * Formats band label and percentage for accessible pairing of color with text.
 */
export function formatVesselBandText(
  vessel: VesselTarget,
  result: PredictResponse | null,
  bands?: BandMetaItem[]
): { percentText: string; bandLabel: string; fullLabel: string } {
  if (!result || !result.predictions || !result.predictions[vessel]) {
    return {
      percentText: '--%',
      bandLabel: 'Neutral (Not predicted)',
      fullLabel: `${vessel}: Neutral (No prediction yet)`,
    }
  }

  const pred = result.predictions[vessel]
  const pct = (pred.display_probability * 100).toFixed(1) + '%'
  const bandName = pred.display_band || probabilityToBand(pred.display_probability, bands)
  const capBand = bandName.charAt(0).toUpperCase() + bandName.slice(1)

  return {
    percentText: pct,
    bandLabel: capBand,
    fullLabel: `${vessel} (${pct} - ${capBand})`,
  }
}

/**
 * Builds a plain sentence explaining model CAD prediction and coherence adjustment
 * using only API fields (p_cad_model, p_cad_adjusted, lower, upper).
 */
export function buildCoherenceSentence(consistency?: {
  status: 'ok' | 'raised' | 'lowered'
  lower: number
  upper: number
  p_cad_model: number
  p_cad_adjusted: number
} | null): string {
  if (!consistency) return ''
  const modelPct = (consistency.p_cad_model * 100).toFixed(1) + '%'
  const adjPct = (consistency.p_cad_adjusted * 100).toFixed(1) + '%'

  if (consistency.status === 'raised') {
    return `Model estimate ${modelPct}. Raised to ${adjPct} so it is not lower than the highest vessel probability.`
  }
  if (consistency.status === 'lowered') {
    return `Model estimate ${modelPct}. Lowered to ${adjPct} so it does not exceed the sum of vessel probabilities.`
  }
  return `Model estimate ${modelPct}. Within coherence bounds [${(consistency.lower * 100).toFixed(1)}%, ${(consistency.upper * 100).toFixed(1)}%].`
}

