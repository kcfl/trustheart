import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PredictResponse } from '../../api/client'
import { HeartView } from './HeartView'
import { VesselPanel } from './VesselPanel'
import { VesselSelectorButtons } from './VesselSelectorButtons'
import { VesselFallbackCards } from './VesselFallbackCards'

const mockPredictionResult: PredictResponse = {
  request_id: 'test-req-123',
  mode: 'quick',
  model_version: 'ml-v1 (e29ed066fe353a882b917c87f28857f11163cb27)',
  disclaimer: 'For clinical research only. Not an automated diagnosis.',
  predictions: {
    CAD: {
      raw_probability: 0.187,
      calibrated_probability: 0.204,
      display_probability: 0.204,
      band: 'lower',
      display_band: 'lower',
      adjusted: true,
      display_note: 'Fréchet lower bound active',
      base: 1.713,
      other_total: 0.0,
      logit_model: -1.359,
      base_rate: 0.7129,
      base_rate_note: 'dataset average',
      model_info: {
        config_name: 'compact|LR|C=0.001',
        n_features: 7,
        features_used: ['Age', 'Sex', 'Typical Chest Pain', 'Atypical', 'Nonanginal', 'DM', 'HTN'],
        source_space: 'quick',
      },
      contributions: [
        {
          feature: 'Typical Chest Pain',
          value: false,
          contribution: -1.25,
          direction: 'down',
          imputed: false,
          stability_tag: 'stable',
        },
      ],
    },
    LAD: {
      raw_probability: 0.204,
      calibrated_probability: 0.204,
      display_probability: 0.204,
      band: 'lower',
      display_band: 'lower',
      adjusted: false,
      display_note: null,
      base: 0.434,
      other_total: 0.0,
      logit_model: -1.359,
      base_rate: 0.5842,
      base_rate_note: 'dataset average (angiography-referred patients); not a population prevalence',
      model_info: {
        config_name: 'compact|LR|C=0.001',
        n_features: 7,
        features_used: ['Age', 'Sex', 'Typical Chest Pain', 'Atypical', 'Nonanginal', 'DM', 'HTN'],
        source_space: 'quick',
      },
      contributions: [
        {
          feature: 'Typical Chest Pain',
          value: false,
          contribution: -0.954,
          direction: 'down',
          imputed: false,
          stability_tag: 'stable',
        },
        {
          feature: 'Age',
          value: 59,
          contribution: 0.421,
          direction: 'up',
          imputed: false,
          stability_tag: 'moderate',
        },
        {
          feature: 'HTN',
          value: true,
          contribution: 0.215,
          direction: 'up',
          imputed: true,
          stability_tag: 'unstable',
        },
      ],
    },
    LCX: {
      raw_probability: 0.222,
      calibrated_probability: 0.222,
      display_probability: 0.222,
      band: 'lower',
      display_band: 'lower',
      adjusted: false,
      display_note: null,
      base: -0.528,
      other_total: 0.0,
      logit_model: -1.251,
      base_rate: 0.3927,
      base_rate_note: 'dataset average',
      model_info: {
        config_name: 'compact|LR|C=0.03',
        n_features: 7,
        features_used: ['Age', 'Sex', 'Typical Chest Pain', 'Atypical', 'Nonanginal', 'DM', 'HTN'],
        source_space: 'quick',
      },
      contributions: [],
    },
    RCA: {
      raw_probability: 0.11,
      calibrated_probability: 0.11,
      display_probability: 0.11,
      band: 'lower',
      display_band: 'lower',
      adjusted: false,
      display_note: null,
      base: -0.668,
      other_total: 0.0,
      logit_model: -2.093,
      base_rate: 0.3762,
      base_rate_note: 'dataset average',
      model_info: {
        config_name: 'compact|LR|C=0.001',
        n_features: 7,
        features_used: ['Age', 'Sex', 'Typical Chest Pain', 'Atypical', 'Nonanginal', 'DM', 'HTN'],
        source_space: 'quick',
      },
      contributions: [],
    },
  },
  consistency: {
    status: 'raised',
    lower: 0.204,
    upper: 0.536,
    p_cad_model: 0.187,
    p_cad_adjusted: 0.204,
  },
  imputed: ['HTN'],
  warnings: [],
  trust: {
    bands_note: 'Bands are display categories, not clinical thresholds.',
    evidence_auc: {},
    similar_patients: [],
    lift: {},
  },
}

describe('Heart & Vessel Components Test Suite', () => {
  it('VesselPanel displays CAD probability and Fréchet consistency as a heart-level badge', () => {
    render(
      <VesselPanel
        result={mockPredictionResult}
        selectedVessel="LAD"
        onSelectVessel={() => {}}
      />
    )

    // Heart-level aggregate badge
    expect(screen.getByText(/Overall CAD Risk & Coherence/i)).toBeInTheDocument()
    expect(screen.getAllByText(/20.4%/i).length).toBeGreaterThanOrEqual(1)
    expect(
      screen.getByText(
        /Model estimate 18.7%. Raised to 20.4% so it is not lower than the highest vessel probability/i
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/Fréchet bounds: \[20.4%, 53.6%\]/i)).toBeInTheDocument()
  })

  it('VesselPanel shows the required fixed wording', () => {
    render(
      <VesselPanel
        result={mockPredictionResult}
        selectedVessel="LAD"
        onSelectVessel={() => {}}
      />
    )

    const notice = screen.getByTestId('fixed-medical-notice')
    expect(notice).toHaveTextContent('Per-vessel probability, not lesion location')
  })

  it('VesselPanel displays calibrated probability, base rate, and contributions with stability tags', () => {
    render(
      <VesselPanel
        result={mockPredictionResult}
        selectedVessel="LAD"
        onSelectVessel={() => {}}
      />
    )

    // Selected vessel details
    expect(screen.getByText(/Left Anterior Descending Artery/i)).toBeInTheDocument()
    expect(screen.getByText(/Calibrated Probability/i)).toBeInTheDocument()
    expect(screen.getByText(/Dataset Base Rate/i)).toBeInTheDocument()
    expect(screen.getByText(/58.4%/i)).toBeInTheDocument()

    // Stability tags from API
    expect(screen.getByText('stable')).toBeInTheDocument()
    expect(screen.getByText('moderate')).toBeInTheDocument()
    expect(screen.getByText('unstable')).toBeInTheDocument()

    // Imputed feature indicator
    expect(screen.getByText('imputed')).toBeInTheDocument()
  })

  it('Keyboard navigation in VesselSelectorButtons cycles through vessels with arrow keys', () => {
    const handleSelect = vi.fn()
    render(
      <VesselSelectorButtons
        result={mockPredictionResult}
        selectedVessel="LAD"
        onSelectVessel={handleSelect}
      />
    )

    const ladBtn = screen.getByTestId('select-vessel-LAD')
    ladBtn.focus()

    // Arrow down moves from LAD -> LCX
    fireEvent.keyDown(ladBtn, { key: 'ArrowDown' })
    expect(handleSelect).toHaveBeenCalledWith('LCX')

    // Arrow up moves from LAD -> RCA
    fireEvent.keyDown(ladBtn, { key: 'ArrowUp' })
    expect(handleSelect).toHaveBeenCalledWith('RCA')
  })

  it('Fallback cards render 3 vessels with identical selection behavior when WebGL is unavailable', () => {
    const handleSelect = vi.fn()
    render(
      <VesselFallbackCards
        result={mockPredictionResult}
        selectedVessel="LAD"
        onSelectVessel={handleSelect}
      />
    )

    expect(screen.getByTestId('vessel-fallback-container')).toBeInTheDocument()
    expect(screen.getByText(/2D Fallback Mode/i)).toBeInTheDocument()

    const rcaCard = screen.getByTestId('fallback-vessel-RCA')
    fireEvent.click(rcaCard)
    expect(handleSelect).toHaveBeenCalledWith('RCA')
  })

  it('HeartView in neutral state (result is null) displays neutral mode hints', () => {
    render(<HeartView result={null} defaultVessel={null} />)

    // Neutral prompt in VesselPanel
    expect(screen.getByText(/Select an artery \(LAD, LCX, or RCA\)/i)).toBeInTheDocument()
    // Notice bar still visible
    expect(screen.getByText('Per-vessel probability, not lesion location')).toBeInTheDocument()
  })
})
