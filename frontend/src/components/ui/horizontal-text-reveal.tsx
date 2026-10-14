"use client";

import { Fragment, useEffect, useRef, useState, type RefObject } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

export type RevealLine = { text: string; emphasis?: boolean };
export type HorizontalTextRevealProps = {
  lines: readonly RevealLine[];
  as?: "h2" | "h3" | "p";
  className?: string;
  /** Optional surrounding section; useful when the heading itself is sticky. */
  scrollTarget?: RefObject<HTMLElement | null>;
};

/** Each word owns a bounded, overlapping interval of section scroll progress. */
export function wordRevealRange(
  index: number,
  count: number,
): [number, number] {
  const start = 0.06 + (Math.max(0, index) / Math.max(1, count - 1)) * 0.52;
  return [start, Math.min(1, start + 0.3)];
}

function RevealWord({
  children,
  index,
  count,
  progress,
}: {
  children: string;
  index: number;
  count: number;
  progress: MotionValue<number>;
}) {
  const range = wordRevealRange(index, count);
  const opacity = useTransform(progress, range, [0.18, 1]);
  const x = useTransform(progress, range, ["0.9em", "0em"]);
  const skewX = useTransform(progress, range, [9, 0]);
  return (
    <motion.span
      className="horizontal-reveal-word"
      data-reveal-word={index}
      style={{
        display: "inline-block",
        opacity,
        x,
        skewX,
        transformOrigin: "left center",
      }}
    >
      {children}
    </motion.span>
  );
}

function AnimatedLines({
  lines,
  target,
  external,
}: {
  lines: readonly RevealLine[];
  target: RefObject<HTMLElement | null>;
  external: boolean;
}) {
  const { scrollYProgress } = useScroll({
    target,
    offset: external ? ["start 0.86", "end 0.68"] : ["start 0.88", "end 0.45"],
  });
  const count = lines.reduce(
    (sum, line) => sum + line.text.trim().split(/\s+/u).filter(Boolean).length,
    0,
  );
  let index = 0;
  return (
    <span className="horizontal-reveal-visual" aria-hidden="true">
      {lines.map((line, lineIndex) => {
        const Line = line.emphasis ? "em" : "span";
        const words = line.text.trim().split(/\s+/u).filter(Boolean);
        return (
          <Line className="horizontal-reveal-line" key={lineIndex}>
            {lineIndex > 0 ? " " : null}
            {words.map((word, wordIndex) => (
              <Fragment key={`${lineIndex}-${wordIndex}`}>
                <RevealWord
                  index={index++}
                  count={count}
                  progress={scrollYProgress}
                >
                  {word}
                </RevealWord>
                {wordIndex < words.length - 1 ? " " : null}
              </Fragment>
            ))}
          </Line>
        );
      })}
    </span>
  );
}

/** Scroll-linked typography for editorial copy; never used for data or controls. */
export function HorizontalTextReveal({
  lines,
  as: Tag = "h2",
  className,
  scrollTarget,
}: HorizontalTextRevealProps) {
  const ref = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  const reduced = useReducedMotion();
  const [stickyViewport, setStickyViewport] = useState(false);
  useEffect(() => {
    const media = matchMedia("(min-width: 961px) and (min-height: 700px)");
    const sync = () => setStickyViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  // When pinning is disabled, reveal against the heading itself so every word
  // is legible before the heading scrolls away on mobile/short viewports.
  const useSection = !!scrollTarget && stickyViewport;
  const label = lines.map((line) => line.text.trim()).join(" ");
  return (
    <Tag
      ref={ref}
      className={cn("horizontal-text-reveal", className)}
      aria-label={label}
      data-horizontal-reveal={reduced ? "static" : "scroll"}
    >
      {reduced ? (
        <span aria-hidden="true">
          {lines.map((line, index) => {
            const Line = line.emphasis ? "em" : "span";
            return (
              <Line className="horizontal-reveal-line" key={index}>
                {index ? " " : ""}
                {line.text}
              </Line>
            );
          })}
        </span>
      ) : (
        <AnimatedLines
          lines={lines}
          target={useSection ? scrollTarget! : ref}
          external={useSection}
        />
      )}
    </Tag>
  );
}

export default HorizontalTextReveal;
