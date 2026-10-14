import { describe, expect, it } from 'vitest'
import { BAND_LABELS, BANDS_SENTENCE, riskColor } from './theme'

describe('theme.ts riskColor and constants', () => {
  it('interpolates exact endpoint stops: 0 -> #2c7bb6, 0.5 -> #ffffbf, 1 -> #d7191c', () => {
    expect(riskColor(0)).toBe('#2c7bb6')
    expect(riskColor(0.5)).toBe('#ffffbf')
    expect(riskColor(1.0)).toBe('#d7191c')
  })

  it('clamps values outside [0, 1] strictly', () => {
    // Values below 0 should clamp to stop 0 (#2c7bb6)
    expect(riskColor(-0.01)).toBe('#2c7bb6')
    expect(riskColor(-5.0)).toBe('#2c7bb6')

    // Values above 1 should clamp to stop 1 (#d7191c)
    expect(riskColor(1.01)).toBe('#d7191c')
    expect(riskColor(10.0)).toBe('#d7191c')
  })

  it('exports required BAND_LABELS and BANDS_SENTENCE verbatim', () => {
    expect(BANDS_SENTENCE).toBe('Bands are display categories, not clinical thresholds.')
    expect(BAND_LABELS.lower).toContain('Lower')
    expect(BAND_LABELS.intermediate).toContain('Intermediate')
    expect(BAND_LABELS.higher).toContain('Higher')
  })
})
