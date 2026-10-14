import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProgressiveBlur } from "./progressive-blur";

describe("ProgressiveBlur", () => {
  it("is decorative and does not intercept pointer events", () => {
    const html = renderToStaticMarkup(createElement(ProgressiveBlur));
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events:none");
    expect(html).not.toContain("tabindex");
  });
  it("defaults to a subtle 4px top blur with a 150px band", () => {
    const html = renderToStaticMarkup(createElement(ProgressiveBlur));
    expect(html).toContain("top:0");
    expect(html).toContain("height:150px");
    expect(html).toContain("backdrop-filter:blur(4px)");
  });
  it("uses opaque masks independent of translucent backgrounds, including WebKit", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressiveBlur, { backgroundColor: "rgba(8,4,15,.2)" }),
    );
    expect(html).toContain(
      "mask-image:linear-gradient(to bottom, #000 0%, #000 12%, transparent 100%)",
    );
    expect(html).toContain("-webkit-mask-image:");
    expect(html).toContain("-webkit-backdrop-filter:");
  });
  it("supports bottom placement, custom tint, size, strength and class name", () => {
    const html = renderToStaticMarkup(
      createElement(ProgressiveBlur, {
        position: "bottom",
        backgroundColor: "#100818",
        height: "96px",
        blurAmount: "6px",
        className: "reading-edge",
      }),
    );
    expect(html).toContain("bottom:0");
    expect(html).not.toContain("top:0");
    expect(html).toContain("height:96px");
    expect(html).toContain("blur(6px)");
    expect(html).toContain("linear-gradient(to bottom, transparent, #100818)");
    expect(html).toContain('class="progressive-blur reading-edge"');
  });
});
