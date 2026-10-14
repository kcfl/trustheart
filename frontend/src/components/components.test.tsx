import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
  it('DisclaimerBanner is non-dismissible and contains no close button', () => {
    const { container } = render(
      <DisclaimerBanner disclaimer="Decision support / educational use only." />
    )
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Decision support/i)).toBeInTheDocument()

    // Assert that there are zero buttons (no close/dismiss button)
    const buttons = container.querySelectorAll('button')
    expect(buttons.length).toBe(0)
  })

  it('PatientForm displays exactly 7 controls in quick mode, 54 in full mode, and BBB is exactly ONE control', () => {
    // 1. Quick mode test
    const { container: quickContainer, unmount } = render(
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

    // Form inputs and selects excluding the submit button
    const quickControls = quickContainer.querySelectorAll(
      '.group-grid input, .group-grid select'
    )
    expect(quickControls.length).toBe(7)

    unmount()

    // 2. Full mode test
    const { container: fullContainer } = render(
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

    const fullControls = fullContainer.querySelectorAll(
      '.group-grid input, .group-grid select'
    )
    expect(fullControls.length).toBe(54)

    // Verify BBB is present as exactly ONE control
    const bbbControls = fullContainer.querySelectorAll('#BBB')
    expect(bbbControls.length).toBe(1)
    expect(bbbControls[0].tagName.toLowerCase()).toBe('select')
  })
})
