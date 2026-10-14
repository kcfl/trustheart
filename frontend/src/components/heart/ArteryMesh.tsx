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

  // Dynamic tube geometry based on selection/hover prominence
  const tubularSegments = 64
  const radius = selected ? 0.058 : hovered ? 0.052 : 0.044
  const radialSegments = 8
  const closed = false

  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
  }, [curve, radius])

  const material = useMemo(() => {
    const emissiveColor = selected ? '#ffffff' : hovered ? '#fde047' : '#000000'
    const emissiveIntensity = selected ? 0.4 : hovered ? 0.25 : 0.0
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.25,
      metalness: 0.15,
      emissive: new THREE.Color(emissiveColor),
      emissiveIntensity,
    })
  }, [color, selected, hovered])

  // Explicit disposal on unmount or reconfiguration
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
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
  )
}
