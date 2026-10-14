import type { SampleItem } from '../api/client'

interface SamplePickerProps {
  samples: SampleItem[]
  selectedCaseId: number | null
  onSelectSample: (sample: SampleItem) => void
  onClear: () => void
  disabled?: boolean
}

export function SamplePicker({
  samples,
  selectedCaseId,
  onSelectSample,
  onClear,
  disabled,
}: SamplePickerProps) {
  return (
    <section className="sample-picker-section" aria-label="Preset Sample Patients">
      <div className="sample-picker-header">
        <span className="sample-picker-title">Benchmark Demo Patients</span>
        <button
          type="button"
          className="btn-clear"
          onClick={onClear}
          disabled={disabled}
          title="Clear form inputs and reset patient case"
        >
          Clear Form
        </button>
      </div>
      <div className="sample-buttons-list">
        {samples.map((sample) => {
          const isSelected = selectedCaseId === sample.case_id
          return (
            <button
              key={sample.case_id}
              type="button"
              className={`sample-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectSample(sample)}
              disabled={disabled}
              aria-pressed={isSelected}
            >
              <span className="sample-label-tag">{sample.label}</span>
              <span className="sample-label-text">{sample.label_text}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
