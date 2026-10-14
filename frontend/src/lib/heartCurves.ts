import * as THREE from 'three'
import type { VesselTarget } from './vesselTheme'

/**
 * Control points for LAD (Left Anterior Descending artery).
 * Originates near anterior aortic root / left main bifurcation, travels down
 * the anterior interventricular groove to the apex.
 */
export const LAD_CONTROL_POINTS: [number, number, number][] = [
  [-0.18, 0.82, 0.62],
  [-0.1, 0.52, 0.82],
  [-0.02, 0.16, 0.94],
  [0.06, -0.25, 0.88],
  [0.1, -0.68, 0.66],
  [0.12, -1.05, 0.38],
]

/**
 * Control points for LCX (Left Circumflex artery).
 * Branches laterally from left main, winds around the left atrioventricular groove
 * towards the posterior and lateral aspect of the left ventricle.
 */
export const LCX_CONTROL_POINTS: [number, number, number][] = [
  [-0.22, 0.8, 0.58],
  [-0.52, 0.68, 0.52],
  [-0.88, 0.42, 0.25],
  [-1.02, 0.08, -0.16],
  [-0.92, -0.32, -0.52],
  [-0.6, -0.66, -0.68],
]

/**
 * Control points for RCA (Right Coronary Artery).
 * Originates from anterior right aortic sinus, descends down the right
 * atrioventricular sulcus, wrapping around the acute margin towards the inferior posterior surface.
 */
export const RCA_CONTROL_POINTS: [number, number, number][] = [
  [0.26, 0.8, 0.54],
  [0.58, 0.6, 0.48],
  [0.85, 0.22, 0.36],
  [0.88, -0.22, 0.2],
  [0.68, -0.62, -0.12],
  [0.35, -0.92, -0.42],
]

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
