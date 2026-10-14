import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import * as apiClient from '../api/client'
import type { FeatureMetaItem } from '../api/client'
import { DisclaimerBanner } from './DisclaimerBanner'
import { PatientForm } from './PatientForm'

// Generate 54 mocked features matching the /api/meta contract
const mock54Features: FeatureMetaItem[] = Array.from({ length: 54 }, (_, i) => {
  if (i === 0) {
    return {
      name: 'BBB',
      label: 'BBB',
      kind: 'categorical',
      group: 'ECG',
      in_quick: false,
      training: { min: 0, max: 2, median: 0 },
      training_min: 0,
      training_max: 2,
      training_median: 0,
    }
  }
  const isQuick = i >= 1 && i <= 7 // exactly 7 quick features
  return {
    name: `Feature_${i}`,
    label: `Feature ${i}`,
    kind: (i % 2 === 0 ? 'continuous' : 'binary') as 'continuous' | 'binary',
    group: i < 20 ? 'Demographics' : i < 40 ? 'Clinical' : 'Laboratory',
    in_quick: isQuick,
    training: { min: 0, max: 100, median: 50 },
    training_min: 0,
    training_max: 100,
    training_median: 50,
  }
})

describe('Component Verification: DisclaimerBanner and PatientForm', () => {
  it('PatientForm in Quick mode shows exactly 7 controls', () => {
    const { container } = render(
      <PatientForm
        mode="quick"
        metaFeatures={mock54Features}
        formState={{}}
        fieldErrors={{}}
        onChangeField={() => {}}
        onSubmit={() => {}}
        loading={false}
      />
    )
    const quickControls = container.querySelectorAll(
      '.group-grid input, .group-grid select'
    )
    expect(quickControls.length).toBe(7)
  })

  it('PatientForm in Full mode shows exactly 54 controls', () => {
    const { container } = render(
      <PatientForm
        mode="full"
        metaFeatures={mock54Features}
        formState={{}}
        fieldErrors={{}}
        onChangeField={() => {}}
        onSubmit={() => {}}
        loading={false}
      />
    )
    const fullControls = container.querySelectorAll(
      '.group-grid input, .group-grid select'
    )
    expect(fullControls.length).toBe(54)
  })

  it('BBB is exactly one control', () => {
    const { container } = render(
      <PatientForm
        mode="full"
        metaFeatures={mock54Features}
        formState={{}}
        fieldErrors={{}}
        onChangeField={() => {}}
        onSubmit={() => {}}
        loading={false}
      />
    )
    const bbbControls = container.querySelectorAll('#BBB')
    expect(bbbControls.length).toBe(1)
    expect(bbbControls[0].tagName.toLowerCase()).toBe('select')
  })

  it('DisclaimerBanner has no close/dismiss button', () => {
    const { container } = render(
      <DisclaimerBanner disclaimer="Decision support / educational use only." />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(0)
  })

  it('DisclaimerBanner shows the text from the health response', () => {
    const healthDisclaimer =
      'Decision support / educational use only. Predictions are per-vessel probabilities from a small single-centre dataset and are not a lesion location. Not a substitute for formal diagnostic imaging or clinical judgement.'
    render(<DisclaimerBanner disclaimer={healthDisclaimer} />)
    expect(screen.getByText(healthDisclaimer)).toBeInTheDocument()
  })

  it('when the user changes ANY input after loading a sample, caseId is set to null and edited notice is displayed', async () => {
    vi.spyOn(apiClient, 'getHealth').mockResolvedValue({
      status: 'ok',
      model_version: 'ml-v1',
      git_commit: 'e29ed066fe353a882b917c87f28857f11163cb27',
      models_verified: true,
      disclaimer: 'Decision support disclaimer',
    })
    vi.spyOn(apiClient, 'getMeta').mockResolvedValue({
      modes: {
        quick: { name: 'quick', description: 'Quick', n_features: 7, features: ['Age', 'Sex'] },
        full: { name: 'full', description: 'Full', n_features: 54, features: ['Age', 'Sex'] },
      },
      features: [
        {
          name: 'Age',
          label: 'Age',
          kind: 'continuous',
          group: 'Demographics',
          in_quick: true,
          training: { min: 30, max: 86, median: 58 },
          training_min: 30,
          training_max: 86,
          training_median: 58,
        },
      ],
      bands: [
        { name: 'lower', min: 0.0, max: 0.3 },
        { name: 'intermediate', min: 0.3, max: 0.6 },
        { name: 'higher', min: 0.6, max: 1.0 },
      ],
    })
    vi.spyOn(apiClient, 'getSamples').mockResolvedValue({
      samples: [
        {
          case_id: 293,
          label: 'p10',
          label_text: '10th percentile CAD risk',
          inputs: { Age: 59 },
          ground_truth: { CAD: 0, LAD: 0, LCX: 0, RCA: 0 },
          ground_truth_note: 'dataset angiography labels, demo only',
          oof_estimate: { CAD: 0.109, LAD: 0.183, LCX: 0.203, RCA: 0.095 },
          oof_estimate_note: 'out-of-fold benchmark',
        },
      ],
    })

    render(<App />)

    // Wait for the sample button to appear
    const sampleBtn = await screen.findByRole('button', { name: /10th percentile/i })
    expect(sampleBtn).toBeInTheDocument()

    // Click sample
    fireEvent.click(sampleBtn)

    // Notice is not shown initially
    expect(
      screen.queryByText(/Edited: dataset comparison \(out-of-fold estimate, case exclusion\) is off\./i)
    ).toBeNull()

    // Find input for Age and edit value
    const ageInput = screen.getByLabelText(/Age/i)
    fireEvent.change(ageInput, { target: { value: '62' } })

    // Notice must now be displayed
    expect(
      screen.getByText(/Edited: dataset comparison \(out-of-fold estimate, case exclusion\) is off\./i)
    ).toBeInTheDocument()
  })
})
