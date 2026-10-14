import type { PredictResponse, TargetPrediction } from '../api/client'
import { BAND_LABELS, BANDS_SENTENCE, riskColor } from '../theme'

interface ResultsPanelProps {
  result: PredictResponse | null
  error: string | null
}

const TARGET_ORDER = ['CAD', 'LAD', 'LCX', 'RCA'] as const
const TARGET_FULL_NAMES: Record<string, string> = {
  CAD: 'Coronary Artery Disease (Overall)',
  LAD: 'Left Anterior Descending Artery',
  LCX: 'Left Circumflex Artery',
  RCA: 'Right Coronary Artery',
}

export function ResultsPanel({ result, error }: ResultsPanelProps) {
  if (error) {
    return (
      <section className="results-panel error-state" aria-label="Prediction Results">
        <div className="error-card" role="alert">
          <h2 className="error-title">Inference Error</h2>
          <p className="error-message">{error}</p>
        </div>
      </section>
    )
  }

  if (!result) {
    return (
      <section className="results-panel empty-state" aria-label="Prediction Results">
        <div className="empty-card">
          <p className="empty-message">
            Fill in the patient clinical inputs above or select a benchmark demo patient, then click
            &ldquo;Predict Coronary Stenosis Risk&rdquo;.
          </p>
        </div>
      </section>
    )
  }

  const { predictions, consistency, imputed, warnings, oof_estimate, oof_estimate_note, disclaimer, limitations } = result

  return (
    <section className="results-panel" aria-label="Prediction Results">
      <h2 className="results-header">Target Risk Predictions</h2>

      <div className="target-cards-grid">
        {TARGET_ORDER.map((targetKey) => {
          const pred = predictions[targetKey] as TargetPrediction | undefined
          if (!pred) return null

          const percentStr = (pred.display_probability * 100).toFixed(1) + '%'
          const swatchColor = riskColor(pred.display_probability)
          const bandLabel = BAND_LABELS[pred.display_band] || pred.display_band

          return (
            <article key={targetKey} className="target-card">
              <div className="target-card-top">
                <div className="target-ident">
                  <span className="target-code">{targetKey}</span>
                  <span className="target-name">{TARGET_FULL_NAMES[targetKey] || targetKey}</span>
                </div>
                <div
                  className="risk-swatch"
                  style={{ backgroundColor: swatchColor }}
                  title={`Risk color for ${percentStr}`}
                  aria-hidden="true"
                />
              </div>

              <div className="target-risk-number">
                <span className="prob-value">{percentStr}</span>
                <span className="prob-label">Risk Probability</span>
              </div>

              <div className="target-band-info">
                <span className={`band-badge band-${pred.display_band}`}>{bandLabel}</span>
                <span className="bands-sentence-text">{BANDS_SENTENCE}</span>
              </div>

              {targetKey === 'CAD' && pred.adjusted && pred.display_note && (
                <div className="adjustment-note" role="note">
                  <span className="adjustment-tag">Coherence Adjusted</span>
                  <p className="adjustment-text">{pred.display_note}</p>
                </div>
              )}
            </article>
          )
        })}
      </div>

      {/* Fréchet Consistency Badge */}
      <section className="consistency-section">
        <h3 className="section-title">Fréchet Probability Coherence</h3>
        <div className={`consistency-badge-row status-${consistency.status}`}>
          <span className="badge-tag">Status: {consistency.status.toUpperCase()}</span>
          <span className="bounds-detail">
            Coherence Bounds: [{(consistency.lower * 100).toFixed(1)}%,{' '}
            {(consistency.upper * 100).toFixed(1)}%] | Model CAD:{' '}
            {(consistency.p_cad_model * 100).toFixed(1)}% | Display CAD:{' '}
            {(consistency.p_cad_adjusted * 100).toFixed(1)}%
          </span>
        </div>
      </section>

      {/* Imputed Features List */}
      <section className="imputed-section">
        <h3 className="section-title">Imputed Features ({imputed.length})</h3>
        {imputed.length > 0 ? (
          <ul className="imputed-list">
            {imputed.map((f) => (
              <li key={f} className="imputed-item">
                {f} (filled with training median)
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-items-text">None (all features provided or mode subset complete)</p>
        )}
      </section>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <section className="warnings-section" aria-label="Clinical Warnings">
          <h3 className="section-title">Advisory Notices & Warnings</h3>
          <ul className="warnings-list">
            {warnings.map((w, idx) => (
              <li key={idx} className={`warning-item code-${w.code}`}>
                {w.code === 'important_feature_imputed' ? (
                  <span>
                    <strong>Important feature imputed:</strong> {w.feature} was omitted; this feature
                    strongly impacts prediction of <strong>{w.target}</strong>.
                  </span>
                ) : (
                  <span>{w.message}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Out-of-fold benchmark if case_id was provided */}
      {oof_estimate && (
        <section className="oof-section">
          <h3 className="section-title">Out-of-Fold Cross-Validation Benchmark</h3>
          <div className="oof-grid">
            {TARGET_ORDER.map((t) => {
              const val = oof_estimate[t]
              if (val === undefined) return null
              return (
                <div key={t} className="oof-item">
                  <span className="oof-target">{t}:</span>
                  <span className="oof-val">{(val * 100).toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
          {oof_estimate_note && <p className="oof-note-text">{oof_estimate_note}</p>}
        </section>
      )}

      {/* Disclaimer and Limitations */}
      <section className="disclaimer-limitations-section">
        <h3 className="section-title">Decision Support Disclaimer & Dataset Limitations</h3>
        {disclaimer && <p className="response-disclaimer">{disclaimer}</p>}
        {limitations && limitations.length > 0 && (
          <ul className="limitations-list">
            {limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
