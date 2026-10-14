import { useEffect } from "react";

/** One delegated pointer listener, frame-throttled. No React render on pointer movement. */
export function useGlassLighting() {
  useEffect(() => {
    const media = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    let frame = 0,
      active: HTMLElement | null = null,
      x = 0,
      y = 0;
    const reset = () => {
      if (active) {
        active.style.removeProperty("--glass-light-x");
        active.style.removeProperty("--glass-light-y");
        active.style.removeProperty("--glass-light-on");
      }
      active = null;
    };
    const paint = () => {
      frame = 0;
      if (!active?.isConnected) {
        reset();
        return;
      }
      const b = active.getBoundingClientRect();
      active.style.setProperty(
        "--glass-light-x",
        `${(((x - b.left) / b.width) * 100).toFixed(1)}%`,
      );
      active.style.setProperty(
        "--glass-light-y",
        `${(((y - b.top) / b.height) * 100).toFixed(1)}%`,
      );
      active.style.setProperty("--glass-light-on", ".12");
    };
    const move = (event: PointerEvent) => {
      if (!media.matches || event.pointerType === "touch") return;
      const target = (event.target as Element)?.closest<HTMLElement>(
        ".glass, .feature-card, .header-cta",
      );
      if (target !== active) {
        reset();
        active = target || null;
      }
      x = event.clientX;
      y = event.clientY;
      if (active && !frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      reset();
    };
    document.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    media.addEventListener("change", leave);
    return () => {
      leave();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerover", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      media.removeEventListener("change", leave);
    };
  }, []);
}
