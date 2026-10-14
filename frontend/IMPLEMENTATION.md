# Implementation & acceptance record

> This file records earlier milestones. Use `START_HERE_BACKEND.md`, `README.md` and the feature documents for the current handoff, test status and implementation details.

## Inspection

The initial workspace contained two uploads and no existing source repository: a frontend PRD and a standalone HTML heart viewer. The viewer contained Three.js, controls, and an embedded 4.2 MB GLB. Asset metadata identifies neshallads as the author, CC BY 4.0 as the license, and a single mesh with one material. No named coronary artery meshes were present.

## Milestones

1. **Inspect / define boundaries — complete.** Reviewed both supplied assets. Identified absent backend contracts, metric artifacts and SHAP outputs. Preserved original uploads.
2. **Foundation — complete.** React, TypeScript, Vite, Tailwind, local fonts, theme tokens, routes, responsive navigation, shared controls, session-only state.
3. **Landing and scroll story — complete.** Editorial typography, original textured anatomical model, layered glass cards, workflow/perspective/research sections, GSAP reveals, reduced-motion handling.
4. **Analysis — complete in demo mode.** Illustrative field schema, validation, review, acknowledgement, loading, cancellation, preserved input and duplicate-submit prevention.
5. **Results and explainability — complete as truthful prototype states.** Fixed labelled demo probabilities, target details, interactive chart/table, export, session empty state. SHAP unavailable states and scope-specific explanatory copy.
6. **3D asset — complete within asset limits.** Lazy Three.js bundle, original textured PBR materials, controls, static fallback, bounded DPR, on-demand idle rendering, hidden/offscreen pause, attribution. No invented artery mapping.
7. **Methodology and About — complete.** Supplied-brief attribution, intended validation pipeline, unpublished metrics, limitations, contribution areas, actual stack and credits.
8. **Responsive, reliability, documentation — complete for prototype.** Tests, production build, responsive checks, documentation and source package.
9. **Backend integration and scientific verification — blocked externally.** Requires the ML owner's schema, endpoint, artifacts and evaluation evidence.

## Acceptance criteria

| Criterion                                                 | Status                      | Evidence / caveat                                                               |
| --------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------- |
| Six required routes are navigable                         | Pass                        | Playwright navigation and responsive tests                                      |
| Cinematic landing, glass cards and scroll transitions     | Pass                        | Actual scene and GSAP reveal implementation                                     |
| Hero usable without WebGL/model loading                   | Pass                        | Static model rendering and CTA independent of canvas                            |
| Supplied heart model, licensed and credited               | Pass                        | Embedded GLB metadata + About/source credits                                    |
| Validated structured analysis and review                  | Pass, demo only             | Shared schema, unit tests and browser workflow                                  |
| Fields match confirmed backend model                      | Blocked                     | No contract supplied; demo fields explicitly identified as illustrative         |
| Honest demo or real integration                           | Pass, demo only             | Persistent labels, fixed fixtures, no fabricated API success                    |
| Results retain original probability values                | Pass                        | Typed boundary parser, direct result rendering                                  |
| CAD/LAD/LCX/RCA selector and text alternatives            | Pass                        | Cards, target descriptions, chart, table, selectors                             |
| Real per-artery coloring                                  | Not supported by asset      | Single mesh; no false mapping shown                                             |
| Real SHAP and numerical evaluation                        | Not available               | Clear unavailable/pending states, no invented artifacts                         |
| Input privacy / no stale result                           | Pass                        | In-memory state, edits invalidate result, export omits input                    |
| Loading / empty / validation / cancel states              | Pass                        | Browser and unit tests                                                          |
| Live network, HTTP, malformed-response and timeout states | Utility tested only         | Not connected to UI until schema approval                                       |
| Responsive without page-level horizontal overflow         | Pass                        | Chromium at 320 / 390 / 768 / 1280 / 1600 px                                    |
| Keyboard controls, focus, labels and reduced motion       | Implemented                 | Semantic buttons and form controls; full assistive-tech audit still recommended |
| Build and automated tests                                 | Pass                        | TypeScript + Vite build; 43 unit tests; 19 browser tests                        |
| Dependency audit                                          | Pass at implementation time | `npm audit`: 0 vulnerabilities                                                  |
| Deployment instructions / known blockers                  | Pass                        | README and `.env.example`                                                       |

## Remaining acceptance gate for a real model demo

A true connected-model milestone is not complete until the approved input schema replaces the illustrative form, actual endpoints work, error paths are tested end to end against that service, mode banners reflect provenance, and SHAP/evaluation artifacts are validated and attributed. The current prototype must not be described as a completed clinical prediction system.

## Recommended next steps

1. Obtain the model contract and supported explanations from the backend owner.
2. Add an explicit provenance-aware live adapter and integration tests; do not silently fall back to simulated data.
3. Obtain an expert-validated coronary artery mesh if real artery coloring is required.
4. Review contrast and screen-reader/touch behavior on physical devices, including iOS Safari.
5. Profile loading and memory on target devices; consider mesh compression after visual comparison.
6. Supply team names, official track definitions, repository links and verified model evaluation.

## Footer update

Replaced the previous footer with the supplied Beam Wordmark Footer on all routes. Added the shadcn UI directory/configuration, TypeScript/Vite aliases, reusable helpers, a TrustHeart wrapper, and isolated styles. Preserved all clinical disclosures and session data across footer navigation. Added 16 unit tests and 9 browser checks; see `FOOTER-INTEGRATION.md`.
