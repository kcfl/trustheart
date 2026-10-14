import { describe, expect, it } from "vitest";
import {
  approach,
  baselineAt,
  beamTarget,
  clamp,
  drift,
  fitSize,
  hexToRgb,
  wordHeight,
} from "./beam-wordmark-footer";

describe("beam-wordmark footer geometry", () => {
  it("clamps values to a closed interval", () => {
    expect(clamp(-3, 0, 1)).toBe(0);
    expect(clamp(4, 0, 1)).toBe(1);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
  it("parses full hexadecimal accents", () =>
    expect(hexToRgb("#3d6bff")).toBe("61, 107, 255"));
  it("parses short and case-insensitive hexadecimal accents", () =>
    expect(hexToRgb(" #AbC ")).toBe("170, 187, 204"));
  it("uses a safe fallback for unsupported colors", () =>
    expect(hexToRgb("rgba(1,2,3,1)", "0, 0, 0")).toBe("0, 0, 0"));
  it("scales a measured word into its container", () =>
    expect(fitSize(400, 800, 1000)).toBe(200));
  it("caps very short words", () => expect(fitSize(10, 800, 300)).toBe(300));
  it("rejects invalid dimensions", () => {
    expect(fitSize(0, 800, 1000)).toBe(0);
    expect(fitSize(50, -10, 1000)).toBe(0);
    expect(fitSize(NaN, 800, 1000)).toBe(0);
  });
  it("bounds the pointer's beam target", () => {
    expect(beamTarget(-1)).toBe(30);
    expect(beamTarget(2)).toBe(82);
    expect(beamTarget(NaN)).toBe(56);
  });
  it("keeps idle drift inside its amplitude", () => {
    for (let t = 0; t < 500; t += 0.5)
      expect(Math.abs(drift(t) - 58)).toBeLessThanOrEqual(9);
  });
  it("approaches without overshooting", () => {
    const x = approach(0, 100, 0.1, 1 / 60);
    expect(x).toBeCloseTo(10);
  });
  it("is frame-rate independent", () =>
    expect(
      approach(approach(0, 100, 0.1, 1 / 60), 100, 0.1, 1 / 60),
    ).toBeCloseTo(approach(0, 100, 0.1, 2 / 60)));
  it("bounds timing after an inactive tab", () =>
    expect(approach(0, 100, 0.1, 10)).toBe(approach(0, 100, 0.1, 0.1)));
  it("derives the baseline from actual font metrics", () =>
    expect(baselineAt(80, 20)).toBe(0.8));
  it("uses baseline fallbacks for missing font metrics", () => {
    expect(baselineAt(NaN, NaN)).toBe(0.8);
    expect(baselineAt(0, 20)).toBe(0.8);
  });
  it("clips the wordmark at the requested baseline cut", () =>
    expect(wordHeight(100, 0.8, 0.1)).toBe(90));
  it("guards the crop against invalid or excessive input", () => {
    expect(wordHeight(100, 0.8, NaN)).toBe(80);
    expect(wordHeight(100, 0.8, -10)).toBe(40);
    expect(wordHeight(-100, 0.8, 0.1)).toBe(0);
  });
});
