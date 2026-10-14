import { createElement, createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Input, SmoothInput } from "./smooth-input";
import {
  validateDemoInputs,
  exampleInputs,
} from "@/features/analysis/demo-schema";

describe("SmoothInput", () => {
  it("server renders without reading navigator or document and keeps a native caret until ready", () => {
    const html = renderToStaticMarkup(
      createElement(SmoothInput, {
        "aria-label": "Example",
        defaultValue: "Fictional text",
      }),
    );
    expect(html).toContain('data-caret-mode="native"');
    expect(html).toContain('value="Fictional text"');
    expect(html).toContain("caret-color:auto");
    expect(html).toContain('aria-hidden="true"');
  });
  it("forwards standard accessibility, state and form attributes", () => {
    const html = renderToStaticMarkup(
      createElement(SmoothInput, {
        id: "example",
        name: "example",
        value: "58",
        readOnly: true,
        required: true,
        "aria-invalid": true,
        "aria-describedby": "help",
        inputMode: "numeric",
        className: "custom-input",
        wrapperClassName: "custom-wrapper",
        ref: createRef<HTMLInputElement>(),
      }),
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="help"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('name="example"');
    expect(html).toContain("custom-input");
    expect(html).toContain("custom-wrapper");
  });
  it("does not replace an intentionally empty placeholder", () => {
    const html = renderToStaticMarkup(
      createElement(SmoothInput, { placeholder: "" }),
    );
    expect(html).toContain('placeholder=""');
    expect(html).not.toContain('placeholder="smooth input"');
  });
  it("exports a normal native comparison input", () => {
    const html = renderToStaticMarkup(
      createElement(Input, { type: "text", defaultValue: "Native" }),
    );
    expect(html).toContain('value="Native"');
    expect(html).not.toContain("smooth-input-caret");
  });
});

describe("decimal demo values in smooth text fields", () => {
  for (const age of ["0x3a", "5e1", "58.5", "NaN", "hello"])
    it(`rejects ${age} rather than interpreting it as an accepted decimal age`, () => {
      expect(validateDemoInputs({ ...exampleInputs, age }).age).toBeTruthy();
    });
  it("retains valid whole numbers and the existing ranges", () => {
    expect(validateDemoInputs({ ...exampleInputs, age: "61" })).toEqual({});
    expect(
      validateDemoInputs({ ...exampleInputs, age: "101" }).age,
    ).toBeTruthy();
  });
});
