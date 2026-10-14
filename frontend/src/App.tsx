import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  useLocation,
} from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { ArrowUpRight, Menu, X, RotateCcw } from "lucide-react";
import { useCardReveal } from "@/hooks/use-card-reveal";
import { useGlassLighting } from "@/hooks/use-glass-lighting";
import { useStartupIntro } from "@/components/StartupPreloader";
import NebulaBackdrop from "@/components/NebulaBackdrop";
import { ProgressiveBlur } from "@/components/ui/progressive-blur";
import TrustHeartFooter from "@/components/TrustHeartFooter";
import { Brand, ButtonLink } from "./components/UI";
import Home from "./pages/Home";
import Analysis from "./pages/Analysis";
import Results from "./pages/Results";
import Explainability from "./pages/Explainability";
import Methodology from "./pages/Methodology";
import About from "./pages/About";
import type { ClinicalInputs, PredictionResult } from "./services/prediction-api";
import { emptyInputs } from "./services/prediction-api";

interface AppState {
  inputs: ClinicalInputs;
  setInputs: (value: ClinicalInputs) => void;
  result: PredictionResult | null;
  setResult: (value: PredictionResult | null) => void;
}
const State = createContext<AppState | null>(null);
export function useAppState() {
  const state = useContext(State);
  if (!state) throw new Error("App state is unavailable");
  return state;
}
const navLinks = [
  ["/", "Platform"],
  ["/analysis", "Analysis"],
  ["/explainability", "Model insights"],
  ["/methodology", "Methodology"],
  ["/about", "About"],
];
function Layout() {
  useGlassLighting();
  const mainRef = useRef<HTMLElement>(null);
  useCardReveal(mainRef);
  const { replay } = useStartupIntro();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  // Keep forms, numeric results and model explanations completely unobscured.
  const readingBlur = ["/", "/about", "/methodology"].includes(
    location.pathname,
  );
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    const names: Record<string, string> = {
      "/": "See beyond the prediction",
      "/analysis": "Analysis",
      "/results": "Results",
      "/explainability": "Model insights",
      "/methodology": "Methodology",
      "/about": "About",
    };
    document.title = `TrustHeart 3D — ${names[location.pathname] || "Page not found"}`;
    document.querySelector<HTMLElement>("main")?.focus({ preventScroll: true });
  }, [location.pathname]);
  return (
    <>
      <NebulaBackdrop />
      <div className="app-shell">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            {navLinks.map(([to, title]) => (
              <NavLink end={to === "/"} key={to} to={to}>
                {title}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <span className="research-tag">
              <span />
              RESEARCH PREVIEW
            </span>
            <Link className="header-cta" to="/analysis">
              Start analysis <ArrowUpRight size={15} />
            </Link>
            <button
              className="intro-replay"
              aria-label="Replay intro"
              title="Replay TRUST HEART intro"
              onClick={replay}
            >
              <RotateCcw size={14} />
              <span className="sr-only">Replay intro</span>
            </button>
            <button
              className="menu-button"
              aria-label={menu ? "Close menu" : "Open menu"}
              aria-expanded={menu}
              aria-controls="mobile-nav"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </header>
        {menu && (
          <nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Mobile navigation"
          >
            {navLinks.map(([to, title]) => (
              <NavLink key={to} to={to}>
                {title}
                <ArrowUpRight size={17} />
              </NavLink>
            ))}
            <NavLink to="/results">
              Results
              <ArrowUpRight size={17} />
            </NavLink>
          </nav>
        )}
        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className={readingBlur ? "reading-blur-surface" : undefined}
        >
          {readingBlur && (
            <div
              className="reading-blur-frame"
              aria-hidden="true"
              data-suspended={menu ? "true" : "false"}
            >
              <ProgressiveBlur
                position="top"
                backgroundColor="rgba(8, 4, 15, 0.32)"
                height="var(--reading-blur-height)"
                blurAmount="var(--reading-blur-amount)"
              />
              <ProgressiveBlur
                position="bottom"
                backgroundColor="rgba(8, 4, 15, 0.32)"
                height="var(--reading-blur-height)"
                blurAmount="var(--reading-blur-amount)"
              />
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
            >
              <Routes location={location}>
                <Route path="/" element={<Home />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/results" element={<Results />} />
                <Route path="/explainability" element={<Explainability />} />
                <Route path="/methodology" element={<Methodology />} />
                <Route path="/about" element={<About />} />
                <Route
                  path="*"
                  element={
                    <div className="page-container empty-state">
                      <h1>A different perspective?</h1>
                      <p>
                        This page doesn't exist. Let's get you back to the
                        platform.
                      </p>
                      <ButtonLink to="/">Back to home</ButtonLink>
                    </div>
                  }
                />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </main>
        <TrustHeartFooter />
      </div>
    </>
  );
}
export default function App() {
  const [inputs, setInputs] = useState<ClinicalInputs>({ ...emptyInputs });
  const [result, setResult] = useState<PredictionResult | null>(null);
  return (
    <MotionConfig reducedMotion="user">
      <State.Provider value={{ inputs, setInputs, result, setResult }}>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </State.Provider>
    </MotionConfig>
  );
}
