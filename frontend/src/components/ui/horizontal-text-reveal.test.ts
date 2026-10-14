import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  HorizontalTextReveal,
  wordRevealRange,
} from "./horizontal-text-reveal";

describe("HorizontalTextReveal", () => {
  it("assigns ordered, overlapping word intervals that finish before the chapter exits", () => {
    const ranges = Array.from({ length: 8 }, (_, i) => wordRevealRange(i, 8));
    expect(ranges[0][0]).toBeCloseTo(0.06);
    expect(ranges[7][1]).toBeCloseTo(0.88);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][0]);
      expect(ranges[i][0]).toBeLessThan(ranges[i - 1][1]);
    }
  });
  it("handles a single word without division by zero", () => {
    expect(wordRevealRange(0, 1)).toEqual([0.06, 0.36]);
  });
  it("keeps one semantic heading name and the original emphasis without requiring browser globals", () => {
    const html = renderToStaticMarkup(
      createElement(HorizontalTextReveal, {
        lines: [
          { text: "One heart." },
          { text: "More ways to understand.", emphasis: true },
        ],
      }),
    );
    expect(html).toContain("<h2");
    expect(html).toContain('aria-label="One heart. More ways to understand."');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("<em");
    expect(html.match(/data-reveal-word=/g)?.length).toBe(6);
  });
});
