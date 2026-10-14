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

  // Stylized low-poly myocardium: Left Ventricle (apex conical sphere) and Right Ventricle
  const leftVentricleGeo = useMemo(() => new THREE.SphereGeometry(0.88, 24, 20), [])
  const rightVentricleGeo = useMemo(() => new THREE.SphereGeometry(0.68, 20, 16), [])
  const atriaGeo = useMemo(() => new THREE.SphereGeometry(0.55, 18, 14), [])
  const aorticRootGeo = useMemo(() => new THREE.CylinderGeometry(0.2, 0.22, 0.65, 16), [])
  const pulmonaryTrunkGeo = useMemo(() => new THREE.CylinderGeometry(0.18, 0.2, 0.55, 16), [])

  const isNeutral = result === null
  const myocardiumColor = isNeutral ? '#94a3b8' : '#7f1d1d' // neutral gray vs deep anatomical myocardium red
  const vesselRootColor = isNeutral ? '#64748b' : '#991b1b'

  const myocardiumMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(myocardiumColor),
      roughness: 0.55,
      metalness: 0.1,
    })
  }, [myocardiumColor])

  const vesselRootMat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(vesselRootColor),
      roughness: 0.45,
      metalness: 0.15,
    })
  }, [vesselRootColor])

  useEffect(() => {
    return () => {
      leftVentricleGeo.dispose()
      rightVentricleGeo.dispose()
      atriaGeo.dispose()
      aorticRootGeo.dispose()
      pulmonaryTrunkGeo.dispose()
      myocardiumMat.dispose()
      vesselRootMat.dispose()
    }
  }, [
    leftVentricleGeo,
    rightVentricleGeo,
    atriaGeo,
    aorticRootGeo,
    pulmonaryTrunkGeo,
    myocardiumMat,
    vesselRootMat,
  ])

  return (
    <group
      name="heart-model-group"
      userData={{ id: 'heart-model-group' }}
      rotation={[0.1, -0.2, 0]}
    >
      {/* Left Ventricle (tilted, squashed towards apex) */}
      <mesh
        geometry={leftVentricleGeo}
        material={myocardiumMat}
        position={[-0.12, -0.15, 0.05]}
        scale={[0.88, 1.25, 0.88]}
        rotation={[0.1, 0, -0.22]}
        castShadow
        receiveShadow
      />

      {/* Right Ventricle (anterior lateral) */}
      <mesh
        geometry={rightVentricleGeo}
        material={myocardiumMat}
        position={[0.34, 0.02, 0.18]}
        scale={[0.9, 1.05, 0.85]}
        rotation={[0.05, 0.1, 0.18]}
        castShadow
        receiveShadow
      />

      {/* Atrial base mass */}
      <mesh
        geometry={atriaGeo}
        material={myocardiumMat}
        position={[-0.05, 0.72, -0.1]}
        scale={[1.15, 0.85, 0.95]}
      />

      {/* Aortic root (ascending aorta trunk) */}
      <mesh
        geometry={aorticRootGeo}
        material={vesselRootMat}
        position={[0.05, 1.02, 0.05]}
        rotation={[0.1, 0, -0.15]}
      />

      {/* Pulmonary trunk */}
      <mesh
        geometry={pulmonaryTrunkGeo}
        material={vesselRootMat}
        position={[-0.18, 0.96, 0.22]}
        rotation={[-0.15, 0, 0.25]}
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
