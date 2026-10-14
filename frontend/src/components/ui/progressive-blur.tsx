import type { CSSProperties } from "react";

export type ProgressiveBlurProps = {
  className?: string;
  backgroundColor?: string;
  position?: "top" | "bottom";
  height?: string;
  blurAmount?: string;
};

/**
 * Adapted from the user-supplied Skiper UI Skiper41 example.
 * Credit: Skiper UI / @gurvinder-singh02 (https://skiper-ui.com/v1/skiper41).
 * Inspired by https://devouringdetails.com/; no affiliation implied.
 * See PROGRESSIVE-BLUR.md for attribution and usage/performance notes.
 *
 * CSS only: no scroll handlers, animation loop, canvas or additional dependency.
 * Put this over content inside a positioned container. The mask fades the
 * backdrop filter itself, not just a background painted over blurred text.
 */
export function ProgressiveBlur({
  className = "",
  backgroundColor = "#f5f4f3",
  position = "top",
  height = "150px",
  blurAmount = "4px",
}: ProgressiveBlurProps) {
  const towardEdge = position === "top" ? "to top" : "to bottom";
  const awayFromEdge = position === "top" ? "to bottom" : "to top";
  // Use an opaque mask independent of the overlay tint. A translucent
  // backgroundColor must not accidentally reduce the mask's alpha again.
  const mask = `linear-gradient(${awayFromEdge}, #000 0%, #000 12%, transparent 100%)`;
  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    [position]: 0,
    width: "100%",
    height,
    pointerEvents: "none",
    userSelect: "none",
    WebkitUserSelect: "none",
    background: `linear-gradient(${towardEdge}, transparent, ${backgroundColor})`,
    maskImage: mask,
    WebkitMaskImage: mask,
    backdropFilter: `blur(${blurAmount})`,
    WebkitBackdropFilter: `blur(${blurAmount})`,
  };
  return (
    <div
      aria-hidden="true"
      data-progressive-blur={position}
      className={`progressive-blur ${className}`.trim()}
      style={style}
    />
  );
}

export default ProgressiveBlur;
