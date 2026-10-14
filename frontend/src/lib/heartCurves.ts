import * as THREE from 'three'
import type { VesselTarget } from './vesselTheme'

/**
 * Projects a 3D point onto the surface of an ellipsoid model of the ventricles
 * with an outward offset so that the procedural artery tube floats cleanly
 * along the myocardial surface.
 */
export function projectToHeartSurface(
  point: [number, number, number],
  center: [number, number, number] = [0, -0.12, 0],
  radii: [number, number, number] = [0.92, 1.25, 0.88],
  offset: number = 0.038
): [number, number, number] {
  const dx = (point[0] - center[0]) / radii[0]
  const dy = (point[1] - center[1]) / radii[1]
  const dz = (point[2] - center[2]) / radii[2]
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
  if (dist === 0) return point
  const factor = (1 + offset / Math.min(radii[0], radii[1], radii[2])) / dist
  return [
    center[0] + dx * radii[0] * factor,
    center[1] + dy * radii[1] * factor,
    center[2] + dz * radii[2] * factor,
  ]
}

const RAW_LAD_POINTS: [number, number, number][] = [
  [-0.14, 0.82, 0.52],
  [-0.08, 0.50, 0.72],
  [-0.02, 0.15, 0.82],
  [0.05, -0.25, 0.78],
  [0.08, -0.65, 0.58],
  [0.10, -1.05, 0.32],
]

const RAW_LCX_POINTS: [number, number, number][] = [
  [-0.18, 0.80, 0.50],
  [-0.45, 0.68, 0.48],
  [-0.75, 0.45, 0.35],
  [-0.90, 0.12, 0.15],
  [-0.85, -0.30, -0.18],
  [-0.60, -0.65, -0.42],
]

const RAW_RCA_POINTS: [number, number, number][] = [
  [0.22, 0.80, 0.50],
  [0.52, 0.62, 0.45],
  [0.78, 0.25, 0.35],
  [0.82, -0.20, 0.22],
  [0.65, -0.60, 0.05],
  [0.35, -0.92, -0.15],
]

export const LAD_CONTROL_POINTS: [number, number, number][] = RAW_LAD_POINTS.map((p) =>
  projectToHeartSurface(p)
)

export const LCX_CONTROL_POINTS: [number, number, number][] = RAW_LCX_POINTS.map((p) =>
  projectToHeartSurface(p)
)

export const RCA_CONTROL_POINTS: [number, number, number][] = RAW_RCA_POINTS.map((p) =>
  projectToHeartSurface(p)
)

export function buildCatmullRomCurve(points: [number, number, number][]): THREE.CatmullRomCurve3 {
  const vectors = points.map(([x, y, z]) => new THREE.Vector3(x, y, z))
  return new THREE.CatmullRomCurve3(vectors, false, 'centripetal', 0.5)
}

export function getLADCurve(): THREE.CatmullRomCurve3 {
  return buildCatmullRomCurve(LAD_CONTROL_POINTS)
}

export function getLCXCurve(): THREE.CatmullRomCurve3 {
  return buildCatmullRomCurve(LCX_CONTROL_POINTS)
}

export function getRCACurve(): THREE.CatmullRomCurve3 {
  return buildCatmullRomCurve(RCA_CONTROL_POINTS)
}

export function getAllVesselCurves(): Record<VesselTarget, THREE.CatmullRomCurve3> {
  return {
    LAD: getLADCurve(),
    LCX: getLCXCurve(),
    RCA: getRCACurve(),
  }
}
