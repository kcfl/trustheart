import React from 'react'
import type { FeatureMetaItem } from '../api/client'
import type { FormState } from '../lib/payload'

interface PatientFormProps {
  mode: 'quick' | 'full'
  metaFeatures: FeatureMetaItem[]
  formState: FormState
  fieldErrors: Record<string, string>
  onChangeField: (featureName: string, value: string) => void
  onSubmit: (e: React.FormEvent) => void
  loading: boolean
}

export function PatientForm({
  mode,
  metaFeatures,
  formState,
  fieldErrors,
  onChangeField,
  onSubmit,
  loading,
}: PatientFormProps) {
  // Filter features based on mode
  const displayedFeatures = metaFeatures.filter((f) => (mode === 'quick' ? f.in_quick : true))

  // Group features by group name
  const groups: Record<string, FeatureMetaItem[]> = {}
  for (const feat of displayedFeatures) {
    const grp = feat.group || 'Clinical Features'
    if (!groups[grp]) {
      groups[grp] = []
    }
    groups[grp].push(feat)
  }

  const renderControl = (feat: FeatureMetaItem) => {
    const val = formState[feat.name] ?? 'unknown'
    const errorMsg = fieldErrors[feat.name]

    if (feat.name === 'Sex') {
      return (
        <select
          id={feat.name}
          name={feat.name}
          className={`form-control ${errorMsg ? 'input-error' : ''}`}
          value={val}
          onChange={(e) => onChangeField(feat.name, e.target.value)}
        >
          <option value="unknown">Unknown (Impute median)</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      )
    }

    if (feat.name === 'BBB') {
      return (
        <select
          id={feat.name}
          name={feat.name}
          className={`form-control ${errorMsg ? 'input-error' : ''}`}
          value={val}
          onChange={(e) => onChangeField(feat.name, e.target.value)}
        >
          <option value="unknown">Unknown (Impute median)</option>
          <option value="N">Normal (N)</option>
          <option value="LBBB">LBBB</option>
          <option value="RBBB">RBBB</option>
        </select>
      )
    }

    if (feat.name === 'VHD') {
      return (
        <select
          id={feat.name}
          name={feat.name}
          className={`form-control ${errorMsg ? 'input-error' : ''}`}
          value={val}
          onChange={(e) => onChangeField(feat.name, e.target.value)}
        >
          <option value="unknown">Unknown (Impute median)</option>
          <option value="N">N (None)</option>
          <option value="mild">mild</option>
          <option value="Moderate">Moderate</option>
          <option value="Severe">Severe</option>
        </select>
      )
    }

    if (feat.kind === 'binary') {
      return (
        <select
          id={feat.name}
          name={feat.name}
          className={`form-control ${errorMsg ? 'input-error' : ''}`}
          value={val}
          onChange={(e) => onChangeField(feat.name, e.target.value)}
        >
          <option value="unknown">Unknown (Impute)</option>
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      )
    }

    if (feat.kind === 'continuous') {
      const displayVal = val === 'unknown' ? '' : val
      return (
        <div className="input-with-hint">
          <input
            type="number"
            step="any"
            id={feat.name}
            name={feat.name}
            className={`form-control ${errorMsg ? 'input-error' : ''}`}
            placeholder="Unknown (Impute)"
            value={displayVal}
            onChange={(e) => onChangeField(feat.name, e.target.value)}
          />
          <span className="field-hint">
            Range in training: {feat.training_min} – {feat.training_max}
          </span>
        </div>
      )
    }

    if (feat.allowed_values && feat.allowed_values.length > 0) {
      return (
        <select
          id={feat.name}
          name={feat.name}
          className={`form-control ${errorMsg ? 'input-error' : ''}`}
          value={val}
          onChange={(e) => onChangeField(feat.name, e.target.value)}
        >
          <option value="unknown">Unknown (Impute)</option>
          {feat.allowed_values.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      )
    }

    // Default text fallback
    return (
      <input
        type="text"
        id={feat.name}
        name={feat.name}
        className={`form-control ${errorMsg ? 'input-error' : ''}`}
        placeholder="Unknown (Impute)"
        value={val === 'unknown' ? '' : val}
        onChange={(e) => onChangeField(feat.name, e.target.value)}
      />
    )
  }

  return (
    <form className="patient-form" onSubmit={onSubmit} aria-label="Patient Clinical Input Form">
      <div className="form-sections">
        {Object.entries(groups).map(([groupName, features]) => (
          <details key={groupName} className="feature-group" open>
            <summary className="group-summary">
              <span className="group-name">{groupName}</span>
              <span className="group-badge">{features.length} inputs</span>
            </summary>
            <div className="group-grid">
              {features.map((feat) => (
                <div key={feat.name} className="form-field">
                  <label htmlFor={feat.name} className="field-label">
                    {feat.label || feat.name}
                  </label>
                  {renderControl(feat)}
                  {fieldErrors[feat.name] && (
                    <span className="field-error-text" role="alert">
                      {fieldErrors[feat.name]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <div className="form-submit-row">
        <button
          type="submit"
          className="btn-predict"
          disabled={loading || displayedFeatures.length === 0}
        >
          {loading ? 'Evaluating Model Inference...' : 'Predict Coronary Stenosis Risk'}
        </button>
      </div>
    </form>
  )
}
