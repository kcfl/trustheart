import { useState } from 'react'
import type { PredictResponse } from '../../api/client'
import type { BandMetaItem } from '../../theme'
import type { VesselTarget } from '../../lib/vesselTheme'
import { HeartScene } from './HeartScene'
import { VesselSelectorButtons } from './VesselSelectorButtons'
import { VesselPanel } from './VesselPanel'

interface HeartViewProps {
  result: PredictResponse | null
  bands?: BandMetaItem[]
  defaultVessel?: VesselTarget | null
}

export function HeartView({
  result,
  bands,
  defaultVessel = 'LAD',
}: HeartViewProps) {
  const [selectedVessel, setSelectedVessel] = useState<VesselTarget | null>(defaultVessel)
  const [hoveredVessel, setHoveredVessel] = useState<VesselTarget | null>(null)
  const isNeutral = result === null

  return (
    <section
      className="heart-view-section"
      data-testid="heart-view-section"
      aria-label="3D Heart Model and Coronary Risk Assessment"
    >
      {/* Status banner placed cleanly OUTSIDE the canvas box */}
      {isNeutral && (
        <div className="scene-neutral-banner" role="status">
          <span className="hint-pill">Neutral Mode</span>
          <span className="hint-body">
            Run a prediction using the clinical inputs form to illuminate coronary vessel risk bands.
          </span>
        </div>
      )}

      {/* Full card width canvas container */}
      <div className="heart-canvas-card">
        <HeartScene
          result={result}
          bands={bands}
          selectedVessel={selectedVessel}
          hoveredVessel={hoveredVessel}
          onSelectVessel={setSelectedVessel}
          onHoverVessel={setHoveredVessel}
        />
      </div>

      {/* Vessel selector buttons placed below canvas */}
      <VesselSelectorButtons
        result={result}
        bands={bands}
        selectedVessel={selectedVessel}
        onSelectVessel={setSelectedVessel}
      />

      {/* Twin columns side by side: Overall CAD & Coherence alongside Vessel Risk Panel */}
      <VesselPanel
        result={result}
        bands={bands}
        selectedVessel={selectedVessel}
        onSelectVessel={setSelectedVessel}
      />
    </section>
  )
}
