import type { PredictResponse } from '../../api/client'
import type { BandMetaItem } from '../../theme'
import {
  formatVesselBandText,
  getVesselColor,
  VESSEL_FULL_NAMES,
  VESSEL_TARGETS,
  type VesselTarget,
} from '../../lib/vesselTheme'

interface VesselFallbackCardsProps {
  result: PredictResponse | null
  bands?: BandMetaItem[]
  selectedVessel: VesselTarget | null
  onSelectVessel: (v: VesselTarget) => void
}

export function VesselFallbackCards({
  result,
  bands,
  selectedVessel,
  onSelectVessel,
}: VesselFallbackCardsProps) {
  return (
    <div
      className="vessel-fallback-container"
      data-testid="vessel-fallback-container"
      role="region"
      aria-label="Coronary Vessels (Fallback View)"
    >
      <div className="fallback-notice-banner" role="status">
        <span className="fallback-badge">2D Fallback Mode</span>
        <span className="fallback-explanation">
          3D WebGL rendering is inactive in this browser environment. Coronary vessel data is
          displayed using standard accessible 2D components.
        </span>
      </div>

      <div className="fallback-cards-grid">
        {VESSEL_TARGETS.map((target) => {
          const isSelected = selectedVessel === target
          const color = getVesselColor(target, result, bands)
          const { percentText, bandLabel } = formatVesselBandText(target, result, bands)
          const fullName = VESSEL_FULL_NAMES[target]

          return (
            <button
              key={target}
              type="button"
              id={`fallback-vessel-${target}`}
              data-testid={`fallback-vessel-${target}`}
              className={`fallback-vessel-card ${isSelected ? 'selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onSelectVessel(target)}
            >
              <div className="card-top-row">
                <div className="target-title-block">
                  <span className="target-code-tag">{target}</span>
                  <span className="target-full-title">{fullName}</span>
                </div>
                <span
                  className="fallback-swatch"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
              </div>

              <div className="card-prob-row">
                <span className="fallback-prob-value">{percentText}</span>
                <span className="fallback-band-pill">{bandLabel}</span>
              </div>

              <div className="card-action-hint">
                {isSelected ? '✓ Currently Selected' : 'Click to inspect risk breakdown'}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
