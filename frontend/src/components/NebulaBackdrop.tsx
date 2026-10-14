import { lazy, Suspense, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useStartupIntro } from "@/components/StartupPreloader";
import type { NebulaParams } from "@/components/ui/halftone-nebula";

const HalftoneNebula = lazy(() => import("@/components/ui/halftone-nebula"));
// Decorative-only theme values. No patient/model data enters the renderer.
const SKY_PARAMS: Partial<NebulaParams> = {
  pixel: 5,
  sparkles: 6,
  stars: 0.65,
  density: 0.6,
  haze: 0.85,
  band: 0.65,
  speed: 0.45,
  grain: 0.025,
  planetX: 0.79,
  planetY: 0.67,
  planetRadius: 0.05,
};

export default function NebulaBackdrop() {
  const { active: introActive } = useStartupIntro();
  const [paused, setPaused] = useState(false);
  return (
    <>
      <div className="nebula-backdrop" aria-hidden="true">
        <Suspense fallback={<div className="nebula-loading-fallback" />}>
          <HalftoneNebula
            height="100%"
            preset="crimson"
            params={SKY_PARAMS}
            interactive={false}
            touch="scroll"
            maxDpr={0.65}
            maxFps={16}
            performanceAware
            onPerformancePause={() => setPaused(true)}
            paused={paused || introActive}
          />
        </Suspense>
        <div className="nebula-readability-veil" />
      </div>
      <button
        className="sky-motion-control"
        aria-label={
          paused ? "Resume background animation" : "Pause background animation"
        }
        aria-pressed={paused}
        title={paused ? "Resume nebula animation" : "Pause nebula animation"}
        onClick={() => setPaused(!paused)}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
        <span>Sky motion</span>
      </button>
    </>
  );
}
