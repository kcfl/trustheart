import { describe, expect, it } from 'vitest'
import { BAND_LABELS, BANDS_SENTENCE, buildBandLabels, formatBandLabel, riskColor } from './theme'

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
    expect(BAND_LABELS.lower).toBe('Lower')
    expect(BAND_LABELS.intermediate).toBe('Intermediate')
    expect(BAND_LABELS.higher).toBe('Higher')
  })

  it('formats individual band labels accurately with formatBandLabel', () => {
    expect(formatBandLabel({ name: 'lower', min: 0.0, max: 0.30 })).toBe('Lower (< 30%)')
    expect(formatBandLabel({ name: 'intermediate', min: 0.30, max: 0.60 })).toBe('Intermediate (30% - 60%)')
    expect(formatBandLabel({ name: 'higher', min: 0.60, max: 1.0 })).toBe('Higher (>= 60%)')
  })

  it('builds band labels dynamically from meta.bands', () => {
    const metaBands = [
      { name: 'lower', min: 0.0, max: 0.30 },
      { name: 'intermediate', min: 0.30, max: 0.60 },
      { name: 'higher', min: 0.60, max: 1.0 },
    ]
    const labels = buildBandLabels(metaBands)
    expect(labels.lower).toBe('Lower (< 30%)')
    expect(labels.intermediate).toBe('Intermediate (30% - 60%)')
    expect(labels.higher).toBe('Higher (>= 60%)')
  })

  it('buildBandLabels returns fallback without percentages when bands is undefined or empty', () => {
    const labelsEmpty = buildBandLabels([])
    expect(labelsEmpty.lower).toBe('Lower')
    expect(labelsEmpty.intermediate).toBe('Intermediate')
    expect(labelsEmpty.higher).toBe('Higher')

    const labelsUndefined = buildBandLabels(undefined)
    expect(labelsUndefined.lower).toBe('Lower')
  })
})

