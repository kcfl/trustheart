import React, { useRef } from 'react'
import type { PredictResponse } from '../../api/client'
import type { BandMetaItem } from '../../theme'
import {
  formatVesselBandText,
  getVesselColor,
  VESSEL_FULL_NAMES,
  VESSEL_TARGETS,
  type VesselTarget,
} from '../../lib/vesselTheme'

interface VesselSelectorButtonsProps {
  result: PredictResponse | null
  bands?: BandMetaItem[]
  selectedVessel: VesselTarget | null
  onSelectVessel: (v: VesselTarget) => void
}

export function VesselSelectorButtons({
  result,
  bands,
  selectedVessel,
  onSelectVessel,
}: VesselSelectorButtonsProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      nextIndex = (index + 1) % VESSEL_TARGETS.length
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIndex = (index - 1 + VESSEL_TARGETS.length) % VESSEL_TARGETS.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = VESSEL_TARGETS.length - 1
    }

    if (nextIndex !== null) {
      const nextTarget = VESSEL_TARGETS[nextIndex]
      buttonRefs.current[nextIndex]?.focus()
      onSelectVessel(nextTarget)
    }
  }

  return (
    <div
      className="vessel-selector-group"
      role="group"
      aria-label="Coronary Artery Selection"
    >
      <div className="selector-instruction-row">
        <span className="selector-hint-text">Select Artery to Inspect:</span>
        <span className="keyboard-nav-hint">(Arrow keys / Click to select)</span>
      </div>

      <div className="vessel-button-list">
        {VESSEL_TARGETS.map((target, index) => {
          const isSelected = selectedVessel === target
          const color = getVesselColor(target, result, bands)
          const { percentText, bandLabel } = formatVesselBandText(target, result, bands)
          const fullName = VESSEL_FULL_NAMES[target]

          return (
            <button
              key={target}
              ref={(el) => {
                buttonRefs.current[index] = el
              }}
              type="button"
              id={`select-vessel-${target}`}
              data-testid={`select-vessel-${target}`}
              className={`vessel-select-btn ${isSelected ? 'active' : ''}`}
              aria-pressed={isSelected}
              onClick={() => onSelectVessel(target)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <span
                className="vessel-swatch"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="vessel-btn-content">
                <span className="vessel-btn-primary">
                  <strong>{target}</strong>
                  <span className="vessel-btn-fullname">{fullName}</span>
                </span>
                <span className="vessel-btn-secondary">
                  <span className="vessel-btn-pct">{percentText}</span>
                  <span className={`vessel-btn-band band-${bandLabel.toLowerCase()}`}>
                    {bandLabel}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
