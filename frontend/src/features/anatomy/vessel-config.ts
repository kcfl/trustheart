import * as THREE from "three";

export type VesselKey = "LAD" | "LCX" | "RCA";

export interface NormalizedPoint {
  u: number; // 0..1 along bounding box width (X)
  v: number; // 0..1 along bounding box height (Y)
  w: number; // 0..1 along bounding box depth (Z)
}

export interface VesselDefinition {
  key: VesselKey;
  label: string;
  fullName: string;
  description: string;
  points: NormalizedPoint[];
  radiusRatio: number; // Fraction of bounding box height (~1.2% - 1.6%)
  focusPoint: NormalizedPoint; // Midpoint / camera focus target
  zoomFactor: number; // How much closer the camera should move
}

/**
 * Procedural coronary vessel control points in NORMALIZED (0..1) bounding-box coordinates.
 * Allows visual tuning without code modifications.
 */
export const VESSEL_CONFIG: Record<VesselKey, VesselDefinition> = {
  LAD: {
    key: "LAD",
    label: "LAD",
    fullName: "Left Anterior Descending",
    description: "Courses along the anterior interventricular groove to the apex.",
    points: [
      { u: 0.53, v: 0.68, w: 0.90 },
      { u: 0.51, v: 0.60, w: 0.94 },
      { u: 0.48, v: 0.50, w: 0.98 },
      { u: 0.45, v: 0.38, w: 1.00 },
      { u: 0.43, v: 0.26, w: 0.95 },
      { u: 0.41, v: 0.16, w: 0.83 },
      { u: 0.39, v: 0.08, w: 0.62 },
    ],
    radiusRatio: 0.014,
    focusPoint: { u: 0.46, v: 0.40, w: 0.95 },
    zoomFactor: 2.0,
  },
  LCX: {
    key: "LCX",
    label: "LCX",
    fullName: "Left Circumflex",
    description: "Courses along the left atrioventricular groove to the lateral/posterior wall.",
    points: [
      { u: 0.53, v: 0.67, w: 0.91 },
      { u: 0.59, v: 0.64, w: 0.90 },
      { u: 0.67, v: 0.60, w: 0.82 },
      { u: 0.74, v: 0.55, w: 0.82 },
      { u: 0.78, v: 0.48, w: 0.84 },
      { u: 0.76, v: 0.40, w: 0.86 },
      { u: 0.70, v: 0.34, w: 0.89 },
    ],
    radiusRatio: 0.0135,
    focusPoint: { u: 0.70, v: 0.52, w: 0.84 },
    zoomFactor: 1.95,
  },
  RCA: {
    key: "RCA",
    label: "RCA",
    fullName: "Right Coronary Artery",
    description: "Courses through the right atrioventricular sulcus to the inferior surface.",
    points: [
      { u: 0.36, v: 0.70, w: 0.84 },
      { u: 0.30, v: 0.62, w: 0.88 },
      { u: 0.24, v: 0.52, w: 0.90 },
      { u: 0.20, v: 0.42, w: 0.90 },
      { u: 0.21, v: 0.32, w: 0.89 },
      { u: 0.26, v: 0.22, w: 0.84 },
      { u: 0.32, v: 0.15, w: 0.76 },
    ],
    radiusRatio: 0.014,
    focusPoint: { u: 0.24, v: 0.42, w: 0.88 },
    zoomFactor: 1.95,
  },
};

/**
 * Transform normalized (0..1) bounding-box point to model-local 3D coordinates.
 * Accounting for model.position.sub(center).
 */
export function normalizedToModelSpace(
  pt: NormalizedPoint,
  min: THREE.Vector3,
  size: THREE.Vector3,
  center: THREE.Vector3,
): THREE.Vector3 {
  return new THREE.Vector3(
    min.x + pt.u * size.x - center.x,
    min.y + pt.v * size.y - center.y,
    min.z + pt.w * size.z - center.z,
  );
}

/**
 * Creates a smooth 3D CatmullRom curve and TubeGeometry for a vessel.
 */
export function createVesselTube(
  vessel: VesselDefinition,
  min: THREE.Vector3,
  size: THREE.Vector3,
  center: THREE.Vector3,
): { geometry: THREE.TubeGeometry; curve: THREE.CatmullRomCurve3; radius: number } {
  const points = vessel.points.map((p) =>
    normalizedToModelSpace(p, min, size, center),
  );
  const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
  const radius = size.y * vessel.radiusRatio;
  // 64 tubular segments, 12 radial segments for smooth, high-fidelity artery appearance
  const geometry = new THREE.TubeGeometry(curve, 64, radius, 12, false);
  return { geometry, curve, radius };
}
