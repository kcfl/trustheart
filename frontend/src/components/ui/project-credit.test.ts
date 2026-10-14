import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectCredit } from "./project-credit";

describe("owner-approved project credit", () => {
  it("renders the exact credit once in a dedicated element", () => {
    const html = renderToStaticMarkup(createElement(ProjectCredit));
    expect(html).toContain('data-project-credit="sspro"');
    expect(html.match(/inspired by SSPRO🎀/gu)).toHaveLength(1);
    expect(html).not.toContain("aria-hidden");
    expect(html).not.toContain("Skiper UI");
    expect(html).not.toContain("Devouring Details");
  });
});
