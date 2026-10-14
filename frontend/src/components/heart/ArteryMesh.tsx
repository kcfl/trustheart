import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { VesselTarget } from '../../lib/vesselTheme'

interface ArteryMeshProps {
  vessel: VesselTarget
  curve: THREE.CatmullRomCurve3
  color: string
  selected: boolean
  hovered: boolean
  onSelect: (v: VesselTarget) => void
  onHover: (v: VesselTarget | null) => void
}

export function ArteryMesh({
  vessel,
  curve,
  color,
  selected,
  hovered,
  onSelect,
  onHover,
}: ArteryMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  // Artery tubes about half as thick as before (base 0.022 instead of 0.044)
  const tubularSegments = 64
  const radius = selected ? 0.028 : hovered ? 0.025 : 0.022
  const outlineRadius = radius + 0.0055
  const radialSegments = 10
  const closed = false

  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
  }, [curve, radius])

  const outlineGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, tubularSegments, outlineRadius, radialSegments, closed)
  }, [curve, outlineRadius])

  // MeshStandardMaterial with metalness 0 and roughness 0.6
  // Keep the band color for selected artery, with emissive boost of the SAME hue (never white)
  const material = useMemo(() => {
    const emissiveIntensity = selected ? 0.4 : hovered ? 0.2 : 0.0
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.6,
      metalness: 0.0,
      emissive: new THREE.Color(color),
      emissiveIntensity,
    })
  }, [color, selected, hovered])

  // Thin lighter outline around the artery tube for crisp contrast against myocardium
  const outlineMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(selected ? '#ffffff' : '#cbd5e1'),
      roughness: 0.6,
      metalness: 0.0,
      side: THREE.BackSide,
    })
  }, [selected])

  // Explicit disposal on unmount or reconfiguration
  useEffect(() => {
    return () => {
      geometry.dispose()
      outlineGeometry.dispose()
      material.dispose()
      outlineMaterial.dispose()
    }
  }, [geometry, outlineGeometry, material, outlineMaterial])

  return (
    <group name={`vessel-group-${vessel}`}>
      {/* Outer outline mesh rendered with BackSide for thin lighter border */}
      <mesh
        geometry={outlineGeometry}
        material={outlineMaterial}
        name={`vessel-outline-${vessel}`}
      />
      {/* Primary artery mesh */}
      <mesh
        ref={meshRef}
        name={`vessel-mesh-${vessel}`}
        userData={{ id: `vessel-mesh-${vessel}`, vessel }}
        geometry={geometry}
        material={material}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(vessel)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
          onHover(vessel)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'default'
          onHover(null)
        }}
      />
    </group>
  )
}
