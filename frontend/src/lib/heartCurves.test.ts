import { describe, expect, it } from 'vitest'
import {
  getAllVesselCurves,
  getLADCurve,
  getLCXCurve,
  getRCACurve,
  LAD_CONTROL_POINTS,
  LCX_CONTROL_POINTS,
  RCA_CONTROL_POINTS,
} from './heartCurves'

describe('heartCurves: Procedural Curve Validation', () => {
  it('has valid finite control points for all three vessels', () => {
    for (const [pts, name] of [
      [LAD_CONTROL_POINTS, 'LAD'],
      [LCX_CONTROL_POINTS, 'LCX'],
      [RCA_CONTROL_POINTS, 'RCA'],
    ] as const) {
      expect(pts.length, `${name} must have at least 4 control points`).toBeGreaterThanOrEqual(4)
      for (const [x, y, z] of pts) {
        expect(Number.isFinite(x), `${name} x must be finite`).toBe(true)
        expect(Number.isFinite(y), `${name} y must be finite`).toBe(true)
        expect(Number.isFinite(z), `${name} z must be finite`).toBe(true)
      }
    }
  })

  it('generates smooth CatmullRomCurve3 instances with non-zero arc length', () => {
    const lad = getLADCurve()
    const lcx = getLCXCurve()
    const rca = getRCACurve()

    expect(lad.getLength()).toBeGreaterThan(1.0)
    expect(lcx.getLength()).toBeGreaterThan(1.0)
    expect(rca.getLength()).toBeGreaterThan(1.0)
  })

  it('samples 50 equidistant points along curves and verifies all coordinates are finite', () => {
    const curves = getAllVesselCurves()

    for (const key of ['LAD', 'LCX', 'RCA'] as const) {
      const curve = curves[key]
      const points = curve.getPoints(50)
      expect(points.length).toBe(51)

      for (const pt of points) {
        expect(Number.isFinite(pt.x)).toBe(true)
        expect(Number.isFinite(pt.y)).toBe(true)
        expect(Number.isFinite(pt.z)).toBe(true)
      }

      // Check start and end points are distinct
      const start = points[0]
      const end = points[points.length - 1]
      const distance = start.distanceTo(end)
      expect(distance).toBeGreaterThan(0.5)
    }
  })
})
