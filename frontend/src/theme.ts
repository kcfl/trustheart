/**
 * Visual risk styling and clinical categorization constants for TrustHeart 3D.
 */

export const BANDS_SENTENCE = 'Bands are display categories, not clinical thresholds.'

export const BAND_LABELS: Record<'lower' | 'intermediate' | 'higher', string> = {
  lower: 'Lower (< 20%)',
  intermediate: 'Intermediate (20% - 50%)',
  higher: 'Higher (> 50%)',
}

interface RGB {
  r: number
  g: number
  b: number
}

const COLOR_STOPS: { [key: string]: RGB } = {
  start: { r: 0x2c, g: 0x7b, b: 0xb6 }, // #2c7bb6 at 0.0
  mid: { r: 0xff, g: 0xff, b: 0xbf },   // #ffffbf at 0.5
  end: { r: 0xd7, g: 0x19, b: 0x1c },   // #d7191c at 1.0
}

function componentToHex(c: number): string {
  const hex = Math.round(c).toString(16)
  return hex.length === 1 ? '0' + hex : hex
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`
}

/**
 * Linearly interpolate RGB risk colors between:
 *   0.0 -> #2c7bb6 (cool blue)
 *   0.5 -> #ffffbf (neutral yellow)
 *   1.0 -> #d7191c (warning red)
 * Clamped strictly to [0, 1].
 */
export function riskColor(p: number): string {
  const t = Math.max(0, Math.min(1, p))

  if (t <= 0.5) {
    const u = t / 0.5
    const r = COLOR_STOPS.start.r + u * (COLOR_STOPS.mid.r - COLOR_STOPS.start.r)
    const g = COLOR_STOPS.start.g + u * (COLOR_STOPS.mid.g - COLOR_STOPS.start.g)
    const b = COLOR_STOPS.start.b + u * (COLOR_STOPS.mid.b - COLOR_STOPS.start.b)
    return rgbToHex(r, g, b)
  } else {
    const u = (t - 0.5) / 0.5
    const r = COLOR_STOPS.mid.r + u * (COLOR_STOPS.end.r - COLOR_STOPS.mid.r)
    const g = COLOR_STOPS.mid.g + u * (COLOR_STOPS.end.g - COLOR_STOPS.mid.g)
    const b = COLOR_STOPS.mid.b + u * (COLOR_STOPS.end.b - COLOR_STOPS.mid.b)
    return rgbToHex(r, g, b)
  }
}
