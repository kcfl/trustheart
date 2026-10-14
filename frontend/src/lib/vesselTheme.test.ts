import { describe, expect, it } from 'vitest'
import type { PredictResponse } from '../api/client'
import {
  ACCESSIBLE_BAND_COLORS,
  formatVesselBandText,
  getBandColor,
  getVesselColor,
  probabilityToBand,
  VESSEL_WORDING,
} from './vesselTheme'

describe('vesselTheme: Pure Function Tests', () => {
  it('correctly maps probabilities to bands with default cutoffs (0.30, 0.60)', () => {
    expect(probabilityToBand(0.15)).toBe('lower')
    expect(probabilityToBand(0.299)).toBe('lower')
    expect(probabilityToBand(0.30)).toBe('intermediate')
    expect(probabilityToBand(0.45)).toBe('intermediate')
    expect(probabilityToBand(0.599)).toBe('intermediate')
    expect(probabilityToBand(0.60)).toBe('higher')
    expect(probabilityToBand(0.92)).toBe('higher')
  })

  it('correctly maps probabilities to bands with injected custom cutoffs from API', () => {
    const customBands = [
      { name: 'lower', min: 0.0, max: 0.25 },
      { name: 'intermediate', min: 0.25, max: 0.7 },
      { name: 'higher', min: 0.7, max: 1.0 },
    ]

    expect(probabilityToBand(0.24, customBands)).toBe('lower')
    expect(probabilityToBand(0.25, customBands)).toBe('intermediate')
    expect(probabilityToBand(0.69, customBands)).toBe('intermediate')
    expect(probabilityToBand(0.70, customBands)).toBe('higher')
  })

  it('maps probabilities to colorblind-safe band colors', () => {
    expect(getBandColor(0.15)).toBe(ACCESSIBLE_BAND_COLORS.lower)
    expect(getBandColor(0.45)).toBe(ACCESSIBLE_BAND_COLORS.intermediate)
    expect(getBandColor(0.85)).toBe(ACCESSIBLE_BAND_COLORS.higher)
    expect(getBandColor(null)).toBe(ACCESSIBLE_BAND_COLORS.neutral)
    expect(getBandColor(undefined)).toBe(ACCESSIBLE_BAND_COLORS.neutral)
    expect(getBandColor(Number.NaN)).toBe(ACCESSIBLE_BAND_COLORS.neutral)
  })

  it('retrieves vessel color from a real PredictResponse object', () => {
    const mockResult = {
      predictions: {
        LAD: {
          display_probability: 0.22,
          display_band: 'lower',
        },
        LCX: {
          display_probability: 0.45,
          display_band: 'intermediate',
        },
        RCA: {
          display_probability: 0.75,
          display_band: 'higher',
        },
      },
    } as unknown as PredictResponse

    expect(getVesselColor('LAD', mockResult)).toBe(ACCESSIBLE_BAND_COLORS.lower)
    expect(getVesselColor('LCX', mockResult)).toBe(ACCESSIBLE_BAND_COLORS.intermediate)
    expect(getVesselColor('RCA', mockResult)).toBe(ACCESSIBLE_BAND_COLORS.higher)
    expect(getVesselColor('LAD', null)).toBe(ACCESSIBLE_BAND_COLORS.neutral)
  })

  it('formats text pairing for accessible display', () => {
    const mockResult = {
      predictions: {
        LAD: {
          display_probability: 0.254,
          display_band: 'lower',
        },
      },
    } as unknown as PredictResponse

    const formatted = formatVesselBandText('LAD', mockResult)
    expect(formatted.percentText).toBe('25.4%')
    expect(formatted.bandLabel).toBe('Lower')
    expect(formatted.fullLabel).toContain('LAD (25.4% - Lower)')

    const unpredicted = formatVesselBandText('LAD', null)
    expect(unpredicted.percentText).toBe('--%')
    expect(unpredicted.bandLabel).toContain('Neutral')
  })

  it('preserves exact fixed medical wording', () => {
    expect(VESSEL_WORDING).toBe('Per-vessel probability, not lesion location')
  })
})
