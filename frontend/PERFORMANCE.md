# Rendering performance

## Implemented

- Nebula pause/resume reuses its WebGL program instead of recompiling shaders.
- Decorative sky drawing yields during scroll, wheel, touch, input and pointer-down activity; it resumes after a short quiet period.
- Sustained slow frames can pause the sky automatically. The existing Sky motion control can resume it. The visual remains the last rendered original nebula, not a replaced theme.
- Lower mobile sky resolution, capped decorative cadence and removal of duplicate initial/unchanged-size draws.
- Heart rendering uses a demand-driven scheduler, stops callbacks when idle/hidden/offscreen and during intro replay, and does not preserve an unnecessary drawing buffer.
- Heavy initial heart/studio setup is deferred to an idle slot, leaving the existing static anatomy/interface available first.
- Bounded pixel density, with up to 60fps scheduling for desktop manual interaction and 30fps for auto/scroll-driven changes. These are scheduler caps, not guaranteed actual frame rates.
- On coarse-pointer or low-core devices, automatic model-pose redraws yield while scrolling; compositor-based hero parallax continues and manual controls take priority.
- Glass tint/borders remain, with smaller backdrop filters, particularly on mobile.
- Footer drift paints at a lower idle cadence and avoids rewriting unchanged CSS values. Its pointer interaction remains responsive.

## Limited profiling evidence

A single before/after comparison used headless Chromium with software WebGL, a 1440×1000 viewport and an approximately 3-second scripted scroll. It is not a real-device benchmark, a statistically robust performance guarantee or a Lighthouse/Core Web Vitals score.

| Observation                                          | Before | Optimized sampled version |
| ---------------------------------------------------- | -----: | ------------------------: |
| Shader programs created by sky pause/resume          |      2 |                         0 |
| Median sampled scroll-frame interval                 | ~433ms |                     ~33ms |
| 95th-percentile sampled interval                     | ~867ms |                     ~50ms |
| Sky draw calls during the sampled scroll             |      7 |                         0 |
| Heart draw calls during that low-core sampled scroll |      2 |                         0 |

The final app additionally received startup/hover scheduling fixes after this sample. Actual browser/GPU/device behavior must be measured separately. The application does not persist or transmit performance telemetry or patient input values.

The full browser run and targeted rerun status are recorded accurately in START_HERE_BACKEND.md. Three dedicated rendering tests check shader reuse, draw suspension, usable 3D controls, idle behavior and mobile render limits.
