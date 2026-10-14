"use client";

import { Input, SmoothInput } from "./smooth-input";

/** Isolated comparison demo; the live analysis form uses SmoothInput directly. */
export function Skiper106() {
  return (
    <section className="smooth-input-demo" aria-label="Smooth input comparison">
      <p>Try typing below</p>
      <label>
        <span>Spring caret</span>
        <SmoothInput
          placeholder="Smooth input"
          aria-label="Smooth caret input"
          fontSize={24}
        />
      </label>
      <label>
        <span>Native caret</span>
        <Input
          placeholder="Normal input"
          aria-label="Normal input"
          style={{ fontSize: 24 }}
        />
      </label>
    </section>
  );
}
export default Skiper106;
