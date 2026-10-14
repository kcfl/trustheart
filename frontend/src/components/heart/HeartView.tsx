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

  return (
    <section
      className="heart-view-section"
      data-testid="heart-view-section"
      aria-label="3D Heart Model and Coronary Risk Assessment"
    >
      <div className="heart-view-grid">
        {/* Left Column: 3D Canvas Scene + Keyboard accessible buttons */}
        <div className="heart-visual-column">
          <HeartScene
            result={result}
            bands={bands}
            selectedVessel={selectedVessel}
            hoveredVessel={hoveredVessel}
            onSelectVessel={setSelectedVessel}
            onHoverVessel={setHoveredVessel}
          />

          <VesselSelectorButtons
            result={result}
            bands={bands}
            selectedVessel={selectedVessel}
            onSelectVessel={setSelectedVessel}
          />
        </div>

        {/* Right Column: Vessel Risk Panel + Heart-Level CAD badge */}
        <div className="heart-details-column">
          <VesselPanel
            result={result}
            bands={bands}
            selectedVessel={selectedVessel}
            onSelectVessel={setSelectedVessel}
          />
        </div>
      </div>
    </section>
  )
}
