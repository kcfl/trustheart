"use client";

import { useRef } from "react";
import type { CSSProperties } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

export function centerOutDelay(
  index: number,
  length: number,
  speed = 0.05,
): number {
  return Math.abs(index - (Math.max(1, length) - 1) / 2) * Math.max(0, speed);
}

export type RollingTextProps = {
  text: string;
  speed?: number;
  className?: string;
  duration?: number;
  delay?: number;
  once?: boolean;
  active?: boolean;
};

// Essential geometry is deliberately inline. It must work without Tailwind,
// the host stylesheet, or a network-loaded CSS chunk on the first paint.
const hiddenText: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};
const rootStyle: CSSProperties = {
  position: "relative",
  display: "inline-block",
  whiteSpace: "pre",
  font: "inherit",
  lineHeight: 1,
  color: "inherit",
  letterSpacing: 0,
};
const visualStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "flex-start",
  font: "inherit",
  lineHeight: 1,
  letterSpacing: 0,
  verticalAlign: "top",
};
const glyphStyle: CSSProperties = {
  display: "block",
  flex: "0 0 1em",
  height: "1em",
  margin: 0,
  padding: 0,
  font: "inherit",
  lineHeight: 1,
  textAlign: "center",
  letterSpacing: 0,
  boxSizing: "content-box",
  fontKerning: "none",
};

/** Center-out, viewport-triggered rolling letters. Reusable without external CSS. */
export default function RollingText({
  text,
  speed = 0.05,
  className = "",
  duration = 4,
  delay = 0,
  once = true,
  active,
}: RollingTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once, amount: 0.5 });
  const reduced = useReducedMotion();
  const playing = active ?? visible;
  const letters = Array.from(text);
  return (
    <span
      ref={ref}
      className={`rolling-text ${className}`}
      style={rootStyle}
      data-rolling-active={playing && !reduced ? "true" : "false"}
    >
      <span style={hiddenText}>{text}</span>
      <span
        className="rolling-text-visual"
        aria-hidden="true"
        style={visualStyle}
      >
        {letters.map((letter, index) => (
          <span
            key={`${index}-${letter}`}
            className="rolling-letter"
            data-letter={letter}
            style={{
              display: "block",
              flex: "0 0 auto",
              height: "1em",
              overflow: "hidden",
              font: "inherit",
              lineHeight: 1,
              padding: "0 .025em",
              marginRight: index === letters.length - 1 ? 0 : "-.045em",
              letterSpacing: 0,
              contain: "paint",
              boxSizing: "content-box",
            }}
          >
            <motion.span
              className="rolling-letter-track"
              style={{
                display: "flex",
                flexDirection: "column",
                font: "inherit",
                lineHeight: 1,
                letterSpacing: 0,
                willChange: reduced ? "auto" : "transform",
              }}
              initial={false}
              animate={{ y: reduced ? "0%" : playing ? "-75%" : "0%" }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      y: {
                        duration: Math.max(0.1, duration),
                        delay:
                          Math.max(0, delay) +
                          centerOutDelay(index, letters.length, speed),
                        ease: [0.76, 0, 0.24, 1],
                      },
                    }
              }
              data-roll-delay={centerOutDelay(index, letters.length, speed)}
            >
              {[0, 1, 2, 3].map((row) => (
                <span key={row} className="rolling-glyph" style={glyphStyle}>
                  {letter === " " ? "\u00a0" : letter}
                </span>
              ))}
            </motion.span>
          </span>
        ))}
      </span>
    </span>
  );
}
