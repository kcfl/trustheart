import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { PredictResponse } from '../../api/client'
import type { BandMetaItem } from '../../theme'
import { getAllVesselCurves } from '../../lib/heartCurves'
import { getVesselColor, VESSEL_TARGETS, type VesselTarget } from '../../lib/vesselTheme'
import { ArteryMesh } from './ArteryMesh'

interface HeartModelProps {
  result: PredictResponse | null
  bands?: BandMetaItem[]
  selectedVessel: VesselTarget | null
  hoveredVessel: VesselTarget | null
  onSelectVessel: (v: VesselTarget) => void
  onHoverVessel: (v: VesselTarget | null) => void
}

export function HeartModel({
  result,
  bands,
  selectedVessel,
  hoveredVessel,
  onSelectVessel,
  onHoverVessel,
}: HeartModelProps) {
  const curves = useMemo(() => getAllVesselCurves(), [])

  // Low-poly anatomical primitives
  const leftVentricleGeo = useMemo(() => new THREE.SphereGeometry(0.85, 24, 20), [])
  const apexTaperGeo = useMemo(() => new THREE.ConeGeometry(0.38, 0.55, 16), [])
  const rightVentricleGeo = useMemo(() => new THREE.SphereGeometry(0.68, 20, 16), [])
  const leftAtriumGeo = useMemo(() => new THREE.SphereGeometry(0.48, 16, 14), [])
  const rightAtriumGeo = useMemo(() => new THREE.SphereGeometry(0.46, 16, 14), [])
  const aortaStubGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.22, 0.6, 16), [])
  const pulmonaryTrunkGeo = useMemo(() => new THREE.CylinderGeometry(0.18, 0.2, 0.55, 16), [])

  // Muted neutral tone (#5B4A55) for the heart body in BOTH neutral and predicted states.
  // The body color does NOT encode risk, allowing colored arteries (including Higher #D7263D) to stand out clearly.
  const myocardiumColor = '#5B4A55'
  const greatVesselColor = '#4D3E47'

  const myocardiumMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(myocardiumColor),
      roughness: 0.6,
      metalness: 0.0,
    })
  }, [])

  const greatVesselMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(greatVesselColor),
      roughness: 0.6,
      metalness: 0.0,
    })
  }, [])

  useEffect(() => {
    return () => {
      leftVentricleGeo.dispose()
      apexTaperGeo.dispose()
      rightVentricleGeo.dispose()
      leftAtriumGeo.dispose()
      rightAtriumGeo.dispose()
      aortaStubGeo.dispose()
      pulmonaryTrunkGeo.dispose()
      myocardiumMat.dispose()
      greatVesselMat.dispose()
    }
  }, [
    leftVentricleGeo,
    apexTaperGeo,
    rightVentricleGeo,
    leftAtriumGeo,
    rightAtriumGeo,
    aortaStubGeo,
    pulmonaryTrunkGeo,
    myocardiumMat,
    greatVesselMat,
  ])

  return (
    <group
      name="heart-model-group"
      userData={{ id: 'heart-model-group' }}
      rotation={[0.06, -0.22, 0]}
    >
      {/* Left Ventricle (conical ellipsoid) */}
      <mesh
        geometry={leftVentricleGeo}
        material={myocardiumMat}
        position={[-0.14, -0.15, 0.05]}
        scale={[0.86, 1.25, 0.86]}
        rotation={[0.1, 0, -0.2]}
      />

      {/* Apex taper */}
      <mesh
        geometry={apexTaperGeo}
        material={myocardiumMat}
        position={[0.08, -1.15, 0.05]}
        rotation={[Math.PI - 0.1, 0, 0.2]}
      />

      {/* Right Ventricle (anterior lateral) */}
      <mesh
        geometry={rightVentricleGeo}
        material={myocardiumMat}
        position={[0.34, 0.0, 0.18]}
        scale={[0.88, 1.05, 0.82]}
        rotation={[0.05, 0.1, 0.18]}
      />

      {/* Left Atrium */}
      <mesh
        geometry={leftAtriumGeo}
        material={myocardiumMat}
        position={[-0.32, 0.72, -0.12]}
        scale={[1.0, 0.9, 0.95]}
      />

      {/* Right Atrium */}
      <mesh
        geometry={rightAtriumGeo}
        material={myocardiumMat}
        position={[0.36, 0.68, -0.05]}
        scale={[0.95, 0.9, 0.9]}
      />

      {/* Aorta stub */}
      <mesh
        geometry={aortaStubGeo}
        material={greatVesselMat}
        position={[0.02, 1.05, -0.05]}
        rotation={[0.12, 0, -0.15]}
      />

      {/* Pulmonary trunk */}
      <mesh
        geometry={pulmonaryTrunkGeo}
        material={greatVesselMat}
        position={[-0.18, 0.96, 0.22]}
        rotation={[-0.18, 0, 0.25]}
      />

      {/* 3 Procedural Artery Tubes */}
      {VESSEL_TARGETS.map((target) => (
        <ArteryMesh
          key={target}
          vessel={target}
          curve={curves[target]}
          color={getVesselColor(target, result, bands)}
          selected={selectedVessel === target}
          hovered={hoveredVessel === target}
          onSelect={onSelectVessel}
          onHover={onHoverVessel}
        />
      ))}
    </group>
  )
}
