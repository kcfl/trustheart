import { Suspense, Component, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { PredictResponse } from '../../api/client'
import type { BandMetaItem } from '../../theme'
import { type VesselTarget } from '../../lib/vesselTheme'
import { useReducedMotion } from '../../lib/useReducedMotion'
import { isWebGLAvailable } from '../../lib/webgl'
import { HeartModel } from './HeartModel'
import { VesselFallbackCards } from './VesselFallbackCards'

interface HeartSceneProps {
  result: PredictResponse | null
  bands?: BandMetaItem[]
  selectedVessel: VesselTarget | null
  hoveredVessel: VesselTarget | null
  onSelectVessel: (v: VesselTarget) => void
  onHoverVessel: (v: VesselTarget | null) => void
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class SceneErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    // Graceful error logging without crashing user session
    console.warn('3D Scene WebGL Error captured, rendering fallback:', error.message)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

export function HeartScene({
  result,
  bands,
  selectedVessel,
  hoveredVessel,
  onSelectVessel,
  onHoverVessel,
}: HeartSceneProps) {
  const prefersReduced = useReducedMotion()
  const webGLReady = isWebGLAvailable()

  const fallbackUI = (
    <VesselFallbackCards
      result={result}
      bands={bands}
      selectedVessel={selectedVessel}
      onSelectVessel={onSelectVessel}
    />
  )

  if (!webGLReady) {
    return fallbackUI
  }

  const isNeutral = result === null

  return (
    <SceneErrorBoundary fallback={fallbackUI}>
      <div
        className="heart-scene-container"
        data-testid="heart-scene-container"
        aria-label="Interactive 3D Heart Visualizer"
      >
        {isNeutral && (
          <div className="scene-neutral-hint" role="status">
            <span className="hint-pill">Neutral Mode</span>
            <span className="hint-body">
              Run a prediction using the form on the left to illuminate coronary vessel risk bands.
            </span>
          </div>
        )}

        <div className="canvas-wrapper">
          <Canvas
            camera={{ position: [0, 0, 3.8], fov: 45 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            style={{ width: '100%', height: '100%', touchAction: 'none' }}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[4, 5, 4]} intensity={1.1} />
            <directionalLight position={[-4, -3, -3]} intensity={0.4} />

            <Suspense fallback={null}>
              <HeartModel
                result={result}
                bands={bands}
                selectedVessel={selectedVessel}
                hoveredVessel={hoveredVessel}
                onSelectVessel={onSelectVessel}
                onHoverVessel={onHoverVessel}
              />
            </Suspense>

            <OrbitControls
              enablePan={false}
              minDistance={2.0}
              maxDistance={5.5}
              enableDamping={!prefersReduced}
              autoRotate={!prefersReduced && !selectedVessel}
              autoRotateSpeed={0.7}
            />
          </Canvas>
        </div>

        <div className="scene-legend-bar" aria-label="Risk Color Legend">
          <span className="legend-title">Bands:</span>
          <span className="legend-item">
            <span className="legend-swatch band-lower" style={{ backgroundColor: '#2b83ba' }} />
            Lower (&lt;30%)
          </span>
          <span className="legend-item">
            <span className="legend-swatch band-intermediate" style={{ backgroundColor: '#e69f00' }} />
            Intermediate (30%-60%)
          </span>
          <span className="legend-item">
            <span className="legend-swatch band-higher" style={{ backgroundColor: '#d55e00' }} />
            Higher (&ge;60%)
          </span>
          {isNeutral && (
            <span className="legend-item">
              <span className="legend-swatch band-neutral" style={{ backgroundColor: '#94a3b8' }} />
              Neutral (Unpredicted)
            </span>
          )}
        </div>
      </div>
    </SceneErrorBoundary>
  )
}
