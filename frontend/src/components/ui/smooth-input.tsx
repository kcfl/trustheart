"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
} from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type SpringOptions,
} from "motion/react";
import { cn } from "@/lib/utils";

export type InputFieldProps = ComponentPropsWithoutRef<"input"> & {
  wrapperClassName?: string;
};
export type SmoothInputProps = Omit<InputFieldProps, "type"> & {
  type?: "text" | "password";
  spring?: SpringOptions;
  fontSize?: CSSProperties["fontSize"];
};
const DEFAULT_SPRING = { stiffness: 500, damping: 30, mass: 0.5 };

export const Input = forwardRef<HTMLInputElement, InputFieldProps>(
  function Input({ className, wrapperClassName, ...props }, ref) {
    return (
      <div className={cn("smooth-input-wrapper", wrapperClassName)}>
        <input
          {...props}
          ref={ref}
          className={cn("smooth-input-control", className)}
        />
      </div>
    );
  },
);

/**
 * Production adaptation of the user-supplied Skiper106 smooth-caret example.
 * Uses the project's existing Motion library; DialKit is only a demo tuner and
 * is deliberately not shipped. The real input owns editing, selection, undo,
 * autofill, form semantics and uncontrolled state. No synthetic change events.
 * Passwords, RTL/complex scripts, IME, reduced motion and forced colors use the
 * native caret rather than approximating browser-specific editing geometry.
 */
export const SmoothInput = forwardRef<HTMLInputElement, SmoothInputProps>(
  function SmoothInput(
    {
      className,
      wrapperClassName,
      value,
      defaultValue,
      type = "text",
      style,
      fontSize,
      spring = DEFAULT_SPRING,
      onChange,
      onInput,
      onFocus,
      onBlur,
      onSelect,
      onKeyUp,
      onPointerUp,
      onCompositionStart,
      onCompositionEnd,
      ...props
    },
    forwardedRef,
  ) {
    const inputRef = useRef<HTMLInputElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const frameRef = useRef<number | null>(null);
    const pendingReveal = useRef(false);
    const composing = useRef(false);
    const alive = useRef(false);
    const modeRef = useRef<"native" | "smooth">("native");
    const [mode, setMode] = useState<"native" | "smooth">("native");
    const [forcedColors, setForcedColors] = useState(false);
    const reduced = useReducedMotion();
    const caretX = useMotionValue(0);
    const caretY = useMotionValue(0);
    const caretHeight = useMotionValue(14);
    const caretOpacity = useMotionValue(0);
    const springX = useSpring(caretX, spring);

    const setInputRef = useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof forwardedRef === "function") return forwardedRef(node);
        if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const switchMode = (next: "native" | "smooth") => {
      if (modeRef.current !== next) {
        modeRef.current = next;
        setMode(next);
      }
    };
    const nativeCaret = () => {
      caretOpacity.set(0);
      if (measureRef.current) measureRef.current.textContent = "";
      switchMode("native");
    };

    const updateCaret = (reveal: boolean) => {
      const input = inputRef.current;
      const measure = measureRef.current;
      if (!alive.current || !input || !measure) return;
      if (
        document.activeElement !== input ||
        input.disabled ||
        input.readOnly ||
        reduced ||
        forcedColors ||
        composing.current ||
        input.type !== "text"
      ) {
        nativeCaret();
        return;
      }
      const css = getComputedStyle(input);
      // Prefix measurement is not a substitute for a bidi/shaping engine.
      if (
        css.direction !== "ltr" ||
        !["start", "left"].includes(css.textAlign) ||
        /[^\u0020-\u007e]/u.test(input.value) ||
        input.selectionStart === null
      ) {
        nativeCaret();
        return;
      }
      const start = input.selectionStart;
      const end = input.selectionEnd ?? start;
      const index = input.selectionDirection === "backward" ? start : end;
      Object.assign(measure.style, {
        font: css.font,
        fontSize: css.fontSize,
        fontFamily: css.fontFamily,
        fontWeight: css.fontWeight,
        fontStyle: css.fontStyle,
        letterSpacing: css.letterSpacing,
        fontFeatureSettings: css.fontFeatureSettings,
        fontVariationSettings: css.fontVariationSettings,
        textTransform: css.textTransform,
        fontKerning: css.fontKerning,
        wordSpacing: css.wordSpacing,
      });
      measure.textContent = input.value.slice(0, index);
      const paddingLeft = parseFloat(css.paddingLeft) || 0;
      const paddingRight = parseFloat(css.paddingRight) || 0;
      const width = paddingLeft + measure.offsetWidth;
      const maxScroll = Math.max(0, input.scrollWidth - input.clientWidth);
      if (reveal) {
        const visibleRight =
          input.scrollLeft + input.clientWidth - paddingRight - 2;
        const visibleLeft = input.scrollLeft + paddingLeft;
        if (width > visibleRight)
          input.scrollLeft = Math.min(
            maxScroll,
            width - input.clientWidth + paddingRight + 2,
          );
        else if (width < visibleLeft)
          input.scrollLeft = Math.max(0, width - paddingLeft);
      }
      const x = width - input.scrollLeft + input.offsetLeft + input.clientLeft;
      const minX = input.offsetLeft + input.clientLeft + paddingLeft;
      const maxX =
        input.offsetLeft +
        input.clientLeft +
        input.clientWidth -
        paddingRight -
        2;
      const target = Math.max(minX, Math.min(x, maxX));
      const height = parseFloat(css.fontSize) * 0.95;
      caretHeight.set(height);
      caretY.set(
        input.offsetTop + input.clientTop + (input.clientHeight - height) / 2,
      );
      // Jump only on focus/mode changes; subsequent edits and arrow keys spring.
      if (modeRef.current !== "smooth") springX.jump(target);
      caretX.set(target);
      switchMode("smooth");
      caretOpacity.set(start !== end || x < minX - 1 || x > maxX + 2 ? 0 : 1);
    };
    const updateRef = useRef(updateCaret);
    updateRef.current = updateCaret;
    const schedule = useCallback((reveal = true) => {
      if (!alive.current) return;
      pendingReveal.current ||= reveal;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const shouldReveal = pendingReveal.current;
        pendingReveal.current = false;
        updateRef.current(shouldReveal);
      });
    }, []);

    useEffect(() => {
      alive.current = true;
      const input = inputRef.current;
      const stage = stageRef.current;
      if (!input || !stage) return;
      const focused = () => {
        if (document.activeElement === input) schedule();
      };
      const scroll = () => {
        if (document.activeElement === input) schedule(false);
      };
      const reset = () => schedule();
      const colors = matchMedia("(forced-colors: active)");
      const updateColors = () => setForcedColors(colors.matches);
      updateColors();
      colors.addEventListener("change", updateColors);
      document.addEventListener("selectionchange", focused);
      document.fonts.addEventListener("loadingdone", focused);
      void document.fonts.ready.then(() => {
        if (alive.current) focused();
      });
      input.addEventListener("scroll", scroll);
      const form = input.form;
      form?.addEventListener("reset", reset);
      const resize = new ResizeObserver(focused);
      resize.observe(stage);
      focused();
      return () => {
        alive.current = false;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        pendingReveal.current = false;
        colors.removeEventListener("change", updateColors);
        document.removeEventListener("selectionchange", focused);
        document.fonts.removeEventListener("loadingdone", focused);
        input.removeEventListener("scroll", scroll);
        form?.removeEventListener("reset", reset);
        resize.disconnect();
      };
    }, [schedule]);

    useEffect(() => {
      schedule();
    }, [
      value,
      defaultValue,
      type,
      fontSize,
      style,
      className,
      reduced,
      forcedColors,
      props.disabled,
      props.readOnly,
      props.dir,
      schedule,
    ]);

    return (
      <div
        className={cn("smooth-input-wrapper", wrapperClassName)}
        data-caret-mode={mode}
      >
        <div
          ref={stageRef}
          className="smooth-input-stage"
          style={{
            position: "relative",
            minWidth: 0,
            width: "100%",
            overflow: "hidden",
          }}
        >
          <input
            {...props}
            {...(value !== undefined ? { value } : { defaultValue })}
            ref={setInputRef}
            type={type}
            className={cn("smooth-input-control", className)}
            style={{
              ...style,
              ...(fontSize === undefined ? {} : { fontSize }),
              caretColor:
                mode === "smooth"
                  ? "transparent"
                  : (style?.caretColor ?? "auto"),
            }}
            onChange={(event) => {
              onChange?.(event);
              schedule();
            }}
            onInput={(event) => {
              onInput?.(event);
              schedule();
            }}
            onFocus={(event) => {
              onFocus?.(event);
              schedule();
            }}
            onBlur={(event) => {
              nativeCaret();
              onBlur?.(event);
            }}
            onSelect={(event) => {
              onSelect?.(event);
              schedule();
            }}
            onKeyUp={(event) => {
              onKeyUp?.(event);
              schedule();
            }}
            onPointerUp={(event) => {
              onPointerUp?.(event);
              schedule();
            }}
            onCompositionStart={(event) => {
              composing.current = true;
              nativeCaret();
              onCompositionStart?.(event);
            }}
            onCompositionEnd={(event) => {
              composing.current = false;
              onCompositionEnd?.(event);
              schedule();
            }}
          />
          <span
            ref={measureRef}
            className="smooth-input-measure"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              height: 0,
              width: "max-content",
              whiteSpace: "pre",
              visibility: "hidden",
              pointerEvents: "none",
            }}
          />
          <motion.span
            aria-hidden="true"
            className="smooth-input-caret"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: 2,
              pointerEvents: "none",
              x: springX,
              y: caretY,
              height: caretHeight,
              opacity: caretOpacity,
              display: mode === "smooth" ? "block" : "none",
              background: "var(--color-accent, #ff5c8d)",
              borderRadius: 1,
            }}
          />
        </div>
      </div>
    );
  },
);
