import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  STARTUP_STYLES,
  wordmarkStyle,
  cornerStyle,
  bottomStyle,
  scrollStyle,
  skipStyle,
  screenReaderStyle,
} from "./startup-preloader-styles";
import { useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import RollingText from "@/components/ui/rolling-text";

type Phase = "intro" | "exiting" | "complete";
const StartupContext = createContext({ active: false, replay: () => {} });
export const useStartupIntro = () => useContext(StartupContext);

/** The application mounts only AFTER the curtain exits; a replay never remounts it. */
export default function StartupPreloader({
  children,
}: {
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [mounted, setMounted] = useState(false);
  const [sequence, setSequence] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(null);
  const active = phase !== "complete";
  const beginExit = useCallback(
    () => setPhase((current) => (current === "intro" ? "exiting" : current)),
    [],
  );
  const finish = useCallback(() => {
    setPhase("complete");
    setMounted(true);
  }, []);
  const replay = useCallback(() => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSequence((current) => current + 1);
    setPhase("intro");
  }, []);
  const context = useMemo(() => ({ active, replay }), [active, replay]);

  useEffect(() => {
    if (!active) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [active]);

  useEffect(() => {
    if (phase !== "complete") return;
    const frame = requestAnimationFrame(() => {
      const target = returnFocus.current?.isConnected
        ? returnFocus.current
        : document.querySelector<HTMLElement>("main");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  return (
    <StartupContext.Provider value={context}>
      {mounted && (
        <div
          className="app-after-intro"
          inert={active}
          aria-hidden={active ? true : undefined}
        >
          {children}
        </div>
      )}
      {active &&
        createPortal(
          <IntroOverlay
            key={sequence}
            phase={phase}
            beginExit={beginExit}
            finish={finish}
          />,
          document.body,
        )}
    </StartupContext.Provider>
  );
}

function IntroOverlay({
  phase,
  beginExit,
  finish,
}: {
  phase: Phase;
  beginExit: () => void;
  finish: () => void;
}) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLElement>(null);
  const skip = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | null>(null);
  const elapsed = useRef(0);
  const [fontsReady, setFontsReady] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [tabVisible, setTabVisible] = useState(() => !document.hidden);
  const running = fontsReady && inViewport && tabVisible && phase === "intro";

  useEffect(() => {
    let alive = true;
    // A failed/slow local font must never trap the user on the intro screen.
    const timeout = window.setTimeout(() => {
      if (alive) setFontsReady(true);
    }, 900);
    document.fonts.ready.then(() => {
      if (alive) setFontsReady(true);
    });
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry.isIntersecting),
      { threshold: 0.05 },
    );
    if (root.current) observer.observe(root.current);
    const visibility = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", visibility);
    skip.current?.focus({ preventScroll: true });
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const start = performance.now();
    const total = reduced ? 650 : 3700;
    const timer = window.setTimeout(
      beginExit,
      Math.max(0, total - elapsed.current),
    );
    return () => {
      elapsed.current += performance.now() - start;
      window.clearTimeout(timer);
    };
  }, [running, reduced, beginExit]);

  useEffect(() => {
    if (phase !== "exiting") return;
    // Not coupled to AnimatePresence, requestAnimationFrame, fonts or WebGL.
    // Even if transitionend is dropped, this removes the curtain and restores scrolling.
    const timeout = window.setTimeout(finish, reduced ? 80 : 620);
    return () => window.clearTimeout(timeout);
  }, [phase, reduced, finish]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (["Escape", "ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        beginExit();
      }
      // The one intro action is a deliberate, escapable keyboard focus boundary.
      if (event.key === "Tab") {
        event.preventDefault();
        skip.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [beginExit]);

  return (
    <section
      ref={root}
      className="startup-preloader th-startup-preloader"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        margin: 0,
        padding: 0,
        border: 0,
        borderRadius: 0,
        boxSizing: "border-box",
        background: "#050505",
        color: "#f6f0e4",
        isolation: "isolate",
        touchAction: "pan-y",
        transform:
          phase === "exiting" && !reduced
            ? "translate3d(0,-100%,0)"
            : "translate3d(0,0,0)",
        opacity: phase === "exiting" && reduced ? 0 : 1,
        transition: reduced
          ? "opacity .06s linear"
          : "transform .52s cubic-bezier(.76,0,.24,1)",
        pointerEvents: phase === "exiting" ? "none" : "auto",
      }}
      data-phase={phase}
      data-ready={running ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-title"
      aria-describedby="startup-description"
      onTransitionEnd={(event) => {
        if (event.target === event.currentTarget && phase === "exiting")
          finish();
      }}
      onWheel={(event) => {
        if (event.deltaY > 5) beginExit();
      }}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientY ?? null;
      }}
      onTouchEnd={(event) => {
        const y = event.changedTouches[0]?.clientY;
        if (
          touchStart.current !== null &&
          y !== undefined &&
          touchStart.current - y > 25
        )
          beginExit();
        touchStart.current = null;
      }}
    >
      <style data-startup-styles="true">{STARTUP_STYLES}</style>
      <div className="startup-corner" aria-hidden="true" style={cornerStyle}>
        TRUSTHEART 3D <span>RESEARCH PREVIEW</span>
      </div>
      <h1
        id="startup-title"
        className="startup-wordmark"
        style={wordmarkStyle}
        aria-label="TRUST HEART"
      >
        <RollingText
          text="TRUST"
          speed={0.065}
          duration={2.4}
          delay={0.1}
          active={fontsReady && inViewport && tabVisible}
        />
        <RollingText
          text="HEART"
          speed={0.065}
          duration={2.4}
          delay={0.24}
          active={fontsReady && inViewport && tabVisible}
        />
      </h1>
      <p id="startup-description" style={screenReaderStyle}>
        Welcome to TrustHeart. The introduction closes automatically. Scroll,
        swipe up, or use Skip intro to enter now.
      </p>
      <div className="startup-bottom" style={bottomStyle}>
        <span
          className="startup-caption"
          style={{ fontSize: 9, color: "#aaa49b" }}
        >
          A NEW PERSPECTIVE.
        </span>
        <span className="startup-scroll" aria-hidden="true" style={scrollStyle}>
          <ArrowDown size={13} /> SCROLL TO ENTER
        </span>
        <button
          ref={skip}
          className="startup-skip"
          style={skipStyle}
          onClick={beginExit}
        >
          Skip intro <ArrowUpRight size={15} />
        </button>
      </div>
    </section>
  );
}
