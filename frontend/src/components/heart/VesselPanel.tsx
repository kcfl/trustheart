import type { PredictResponse, TargetPrediction } from '../../api/client'
import type { BandMetaItem } from '../../theme'
import {
  formatVesselBandText,
  VESSEL_FULL_NAMES,
  VESSEL_WORDING,
  type VesselTarget,
} from '../../lib/vesselTheme'

interface VesselPanelProps {
  result: PredictResponse | null
  bands?: BandMetaItem[]
  selectedVessel: VesselTarget | null
  onSelectVessel: (v: VesselTarget) => void
}

export function VesselPanel({
  result,
  bands,
  selectedVessel,
  onSelectVessel,
}: VesselPanelProps) {
  const isNeutral = result === null
  const cadPred = result?.predictions?.CAD as TargetPrediction | undefined
  const consistency = result?.consistency

  return (
    <div
      className="vessel-detail-panel"
      data-testid="vessel-detail-panel"
      aria-label="Vessel Risk Decomposition & Clinical Details"
    >
      {/* 1. Heart-Level Badge: Overall CAD & Fréchet Coherence (not an artery) */}
      <section className="heart-level-badge-card" aria-label="Overall Heart Assessment">
        <div className="badge-header-row">
          <span className="heart-badge-title">Overall CAD Risk & Coherence</span>
          <span className="heart-level-indicator">Heart-Level Aggregate</span>
        </div>

        {cadPred && consistency ? (
          <div className="heart-badge-body">
            <div className="cad-summary-row">
              <span className="cad-label">P(CAD) Overall:</span>
              <strong className="cad-value">
                {(cadPred.display_probability * 100).toFixed(1)}%
              </strong>
              <span className={`band-badge band-${cadPred.display_band}`}>
                {cadPred.display_band.toUpperCase()}
              </span>
              {cadPred.adjusted && (
                <span className="coherence-adjusted-pill" title="Clipped into Fréchet bounds">
                  Coherence Clipped
                </span>
              )}
            </div>

            <div className="coherence-status-row">
              <span className={`coherence-pill status-${consistency.status}`}>
                Fréchet Coherence: {consistency.status.toUpperCase()}
              </span>
              <span className="coherence-bounds-text">
                Bounds: [{(consistency.lower * 100).toFixed(1)}%,{' '}
                {(consistency.upper * 100).toFixed(1)}%]
              </span>
            </div>

            {cadPred.adjusted && cadPred.display_note && (
              <p className="coherence-note-text">{cadPred.display_note}</p>
            )}
          </div>
        ) : (
          <div className="heart-badge-empty">
            <span>Overall CAD & Fréchet coherence will appear once a prediction is calculated.</span>
          </div>
        )}
      </section>

      {/* 2. Mandatory Fixed Medical Notice */}
      <div className="fixed-medical-notice-bar" role="note" data-testid="fixed-medical-notice">
        <span className="notice-icon" aria-hidden="true">ℹ</span>
        <span className="notice-text">{VESSEL_WORDING}</span>
      </div>

      {/* 3. Selected Artery Detail View */}
      {selectedVessel ? (
        (() => {
          const pred = result?.predictions?.[selectedVessel] as TargetPrediction | undefined
          const fullName = VESSEL_FULL_NAMES[selectedVessel]
          const { percentText, bandLabel } = formatVesselBandText(selectedVessel, result, bands)

          if (!pred) {
            return (
              <div className="selected-vessel-card neutral-state">
                <h3 className="vessel-title">
                  {selectedVessel} &ndash; {fullName}
                </h3>
                <p className="vessel-neutral-prompt">
                  No prediction calculated yet for this artery. Enter patient clinical inputs and
                  run prediction to evaluate risk.
                </p>
              </div>
            )
          }

          const calPercent = (pred.calibrated_probability * 100).toFixed(1) + '%'
          const baseRatePercent = (pred.base_rate * 100).toFixed(1) + '%'

          return (
            <div className="selected-vessel-card" data-testid="selected-vessel-card">
              <div className="vessel-card-header">
                <div>
                  <span className="vessel-badge-code">{selectedVessel}</span>
                  <h3 className="vessel-title">{fullName}</h3>
                </div>
                <div className="vessel-risk-pill">
                  <span className="vessel-prob-display">{percentText}</span>
                  <span className={`band-badge band-${pred.display_band}`}>{bandLabel}</span>
                </div>
              </div>

              {/* Probabilities and Base Rate */}
              <div className="vessel-stats-grid">
                <div className="stat-box">
                  <span className="stat-label">Calibrated Probability</span>
                  <span className="stat-value">{calPercent}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Dataset Base Rate</span>
                  <span className="stat-value">{baseRatePercent}</span>
                  <span className="stat-note" title={pred.base_rate_note}>
                    (dataset average)
                  </span>
                </div>
              </div>

              {/* Top Feature Contributions Breakdown */}
              <div className="contributions-section">
                <div className="contributions-header-row">
                  <h4 className="contributions-title">Top Feature Contributions (Logit Space)</h4>
                  <span className="model-config-tag">{pred.model_info.config_name}</span>
                </div>

                <div className="contributions-table-wrapper">
                  <table className="contributions-table">
                    <thead>
                      <tr>
                        <th>Feature</th>
                        <th>Value</th>
                        <th>Direction</th>
                        <th>Contribution</th>
                        <th>Stability</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pred.contributions.map((c) => {
                        const isPos = c.contribution >= 0
                        const signStr = isPos ? '+' : ''
                        const valDisplay =
                          typeof c.value === 'boolean'
                            ? c.value
                              ? 'Yes'
                              : 'No'
                            : String(c.value)

                        return (
                          <tr key={c.feature} className="contribution-row">
                            <td className="feat-name-cell">
                              <span>{c.feature}</span>
                              {c.imputed && (
                                <span className="imputed-mini-tag" title="Imputed with median">
                                  imputed
                                </span>
                              )}
                            </td>
                            <td className="feat-val-cell">{valDisplay}</td>
                            <td className="feat-dir-cell">
                              <span className={`dir-arrow dir-${c.direction}`}>
                                {c.direction === 'up' ? '▲ up' : '▼ down'}
                              </span>
                            </td>
                            <td className={`feat-contrib-cell ${isPos ? 'pos' : 'neg'}`}>
                              {signStr}
                              {c.contribution.toFixed(3)}
                            </td>
                            <td className="feat-stability-cell">
                              <span className={`stability-tag tag-${c.stability_tag || 'none'}`}>
                                {c.stability_tag || 'unrated'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                      <tr className="other-total-row">
                        <td colSpan={3} className="other-label-cell">
                          Other Features Combined Total:
                        </td>
                        <td className="feat-contrib-cell">
                          {pred.other_total >= 0 ? '+' : ''}
                          {pred.other_total.toFixed(3)}
                        </td>
                        <td className="other-note-cell">&mdash;</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()
      ) : (
        <div className="no-vessel-selected-card" data-testid="no-vessel-selected">
          <p className="prompt-text">
            {isNeutral
              ? 'Select an artery (LAD, LCX, or RCA) on the 3D heart or in the button list above to inspect its clinical pathway.'
              : 'Click any coronary artery on the 3D heart model or use the selector buttons above to view risk decomposition and feature contributions.'}
          </p>
          <div className="quick-select-pills">
            <span>Quick Select:</span>
            <button
              type="button"
              className="quick-pick-btn"
              onClick={() => onSelectVessel('LAD')}
            >
              LAD
            </button>
            <button
              type="button"
              className="quick-pick-btn"
              onClick={() => onSelectVessel('LCX')}
            >
              LCX
            </button>
            <button
              type="button"
              className="quick-pick-btn"
              onClick={() => onSelectVessel('RCA')}
            >
              RCA
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
