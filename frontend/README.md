# TrustHeart 3D

A cinematic, scroll-led, glassmorphism research frontend built from the supplied TrustHeart PRD and embedded anatomical heart model.

**Status:** functional frontend prototype in **explicit simulated demo mode**. No prediction model is connected. Not a medical device, diagnosis, or clinical assessment.

## Backend handoff — start here

Send the complete source ZIP to the backend developer and read [START_HERE_BACKEND.md](./START_HERE_BACKEND.md). The frontend is ready for integration work, **not a connected or production-validated medical application**. Setting an environment variable alone does not replace the demo adapter.

Latest UI additions: rolling preloader, progressive blur, smooth input caret, card reveals, horizontal word reveals, adaptive rendering and the owner-approved SSPRO footer credit. See the feature documents listed in the handoff guide.

## Run

Requires Node.js 20.19+ (tested with 20.20.2).

```bash
npm ci
npm run dev
```

The development server binds to `0.0.0.0` on port 5173 and accepts the hosted preview origin. For production, serve the output with your normal static host:

```bash
npm run build
npm run preview
```

Your production host must rewrite non-asset routes to `index.html` (SPA fallback). The relaxed development-host setting is for the sandbox preview, not an authorization mechanism. Fonts, the heart asset, and the static fallback are served locally; no CDN is required at runtime.

## Routes and interactions

| Route             | Implemented                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`               | Editorial hero, actual anatomical 3D model, glass cards, responsive navigation, GSAP scroll reveals, workflow and research sections                                           |
| `/analysis`       | Six **illustrative demo UI fields**, example-fill, required/range/category validation, review, acknowledgement, submission, loading, cancellation, input preservation         |
| `/results`        | Session-aware empty state; fixed, clearly labelled CAD/LAD/LCX/RCA demo outputs; interactive target details; 3D reference; comparison chart/table; JSON export without inputs |
| `/explainability` | Global/prediction tabs, keyboard tab navigation, SHAP interpretation guide, honest unavailable-artifact states, integration requirements                                      |
| `/methodology`    | Brief-attributed dataset information, intended pipeline, unpublished-metric states, expandable limitations                                                                    |
| `/about`          | Product vision, contribution areas without invented names, actual technology stack, source acknowledgements and license links                                                 |

The 3D viewer supports drag-to-rotate, optional automatic rotation, wireframe, reset, and a static-view toggle. It does not capture the mouse wheel, so page scrolling remains usable. It caps pixel density, uses a demand-driven render scheduler (up to 60 fps for desktop manual interaction, 30 fps for automatic/scroll-driven changes), and stops callbacks when idle/offscreen/hidden. These are scheduling limits, not guaranteed device frame rates. Low-power devices defer automatic 3D pose redraws while scrolling; manual controls remain available. Three.js is loaded in a separate lazy chunk. Automatic rotation is off by default, including for reduced-motion users.

## What is real vs. simulated?

**Real frontend behavior:** routing, validation, review, loading/cancellation, session state, data-table switching, target selection, downloadable fixture output, 3D controls, mobile navigation, interactive disclosures, static fallback, reduced-motion support.

**Simulated:** CAD 68%, LAD 54%, LCX 27%, RCA 39%. These are fixed interface fixtures, not model inference. Input changes **do not** calculate a probability. The result banner, card labels, warning, export payload, and footer explicitly identify this. Editing inputs immediately invalidates the old result. Results and inputs are kept only in React memory and disappear on reload.

**Not available:** live predictions, a confirmed backend feature schema, real SHAP charts, validation/calibration statistics, prediction-level explanations, and verified artery mesh mapping. There are no fabricated rankings or scientific performance claims.

The age, sex, blood-pressure, cholesterol, diabetes, and smoking fields demonstrate form UX only. Their allowed ranges are arbitrary **UI validation limits**, not medical reference ranges. They must be replaced with a backend-approved schema before live use. Only use fictional values; do not enter identifiable patient information.

## Architecture

```text
src/
  App.tsx                         Routing, navigation, in-memory session state
  main.tsx                        App bootstrap
  styles.css                      Tokens, glass surfaces, responsive layouts
  components/
    UI.tsx                        Shared controls, notices, headings, lazy viewer
    HeartScene.tsx                Three.js lifecycle, materials, controls/fallback
  features/
    analysis/demo-schema.ts       Explicit demo inputs and shared validation
  pages/
    Home.tsx                      Landing + GSAP/ScrollTrigger choreography
    Analysis.tsx                  Input/review/loading workflow
    Results.tsx                   Target state, probability chart/table/export
    Explainability.tsx            Explanation scopes and unavailable states
    Methodology.tsx               Dataset, validation, limitations
    About.tsx                     Project, stack, acknowledgements
  services/
    prediction-api.ts             Adapter interface, demo adapter, live utility
    prediction-api.test.ts        Unit and API-boundary tests
public/
  heart.glb                       Extracted supplied mesh, ~4.2 MB
  heart-fallback.png              Static rendering of the same licensed model
  fonts/                          Locally hosted fonts and their licenses
  favicon.svg
```

React + TypeScript + Vite, Tailwind CSS v4 with bespoke CSS tokens/layouts, Three.js, GSAP/ScrollTrigger for scroll reveals, Motion for route transitions, Lucide icons. GSAP and Motion do not animate the same element. Vitest and Playwright provide automated checks.

## API integration — deliberately not enabled yet

`src/services/prediction-api.ts` defines a generic `PredictionAdapter<TInput>` and an unconnected `requestPrediction(confirmedInput, endpoint, signal)` utility. The utility handles timeout/cancellation, HTTP/network failure, unreadable JSON, missing fields, and invalid probability values. It does not fabricate a fallback success.

Copy `.env.example` if preparing a real integration. `VITE_API_BASE_URL` is optional and currently unused by the demo flow; setting it alone **does not turn on a model**. All `VITE_*` values are public, so do not put secrets there.

The utility's **proposed, unconfirmed** normalized output shape is:

```ts
{
  probabilities: { CAD: number, LAD: number, LCX: number, RCA: number },
  createdAt: string,              // ISO-compatible timestamp
  modelVersion?: string,
  warnings?: string[]
}
```

The probabilities must be finite numbers between 0 and 1. They are not altered to enforce an invented cross-target rule. Outputs are separate binary targets, not portions of one distribution.

Before wiring the live workflow, obtain:

1. Official target definitions and hackathon problem statement.
2. Exact endpoint/method and request schema, feature names, encodings, units, ranges, required/optional fields, missing-value behavior, and preprocessing rules.
3. API base URL and safe authentication/CORS or same-origin proxy requirements.
4. Real response schema, error format, request identifier policy, model/version metadata, and output calibration context.
5. SHAP global/local artifacts, supported targets, baseline, feature identifiers, output units, and stability output.
6. Published evaluation metrics, split/validation strategy, leakage controls, class imbalance handling, and any backend coherence warnings.
7. Deployment/privacy requirements and team names/repository URLs if desired.

Then implement the approved schema and adapter, explicitly select demo or live mode, and render the mode from the actual response. Do not merely remove the demo banner. The current response parser deliberately does not accept unvalidated explanation artifacts.

## Scientific boundaries

- 303 samples and UCI dataset ID 411 are attributed to the supplied project brief, not independently validated model results.
- Metric placeholders mean **unpublished**, not zero.
- SHAP explains model behavior, not causation. No explanation values are invented.
- The model is one combined mesh. It does **not** contain distinct coronary artery objects. Target selection updates textual details, cards, and charts only. No artery is falsely colored or identified as blocked.
- Clinical anatomy annotations require expert validation. The hero labels the asset as an anatomical reference, not a lesion map.
- No clinical confidence, approval, endorsement, prevention, or treatment claims are made.

## Privacy, accessibility and performance

No analytics, raw-input logs, localStorage, sessionStorage, URL-encoded inputs, or patient-data exports are used. Exported JSON contains only the simulated result and its disclaimer.

Semantic headings and controls, labelled form inputs, linked errors, focus indication, a skip link, keyboard-operable navigation/tabs/disclosures, text alternatives for probabilities, and reduced-motion styles are implemented. The interactive 3D asset has a static fallback. Production accessibility and assistive-technology review is still recommended; this is not a claim of complete WCAG certification.

Responsive checks cover 320, 390, 768, 1280 and 1600 px. GPU throughput and mobile memory usage vary by device. No unmeasured Lighthouse score or clinical performance metric is claimed. The GLB could be further optimized with compression after geometry/normal quality and attribution are preserved.

## Checks

```bash
npm run typecheck
npm run build
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm audit
```

Implemented checks:

- 61 passing unit tests for API/demo boundaries, UI utilities, typography, inputs, footer and project-credit safeguards.
- 61 browser tests are included across 10 files, covering workflows, visual interactions, accessibility, rendering controls and responsive layouts. See `START_HERE_BACKEND.md` for the exact latest execution status; the presence of a test is not a claim that the final combined suite has been rerun.
- Production build and TypeScript compilation.

See `IMPLEMENTATION.md` for milestones, acceptance status, and integration blockers.

## Beam wordmark footer

The shared footer now uses the supplied animated beam-wordmark component, customized for TrustHeart, with preserved route state and research disclosures. The project has a configured shadcn-style `src/components/ui` folder and `@` import alias. See [FOOTER-INTEGRATION.md](./FOOTER-INTEGRATION.md) for paths, props, setup, accessibility, and integration details.

## Credits

**3D asset:** “Realistic Human Heart” by **neshallads**.

- Source: https://sketchfab.com/3d-models/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089
- Author: https://sketchfab.com/neshallads
- License: https://creativecommons.org/licenses/by/4.0/
- Extracted from the supplied HTML viewer. The supplied GLB geometry and original textured materials are preserved. Studio lighting, framing and controls are adapted for the interface. The static fallback renders the same original textured model. Attribution is also visible on `/about`.

**Fonts:** Space Grotesk, Anton, Inter, Manrope, Instrument Serif and the earlier Archivo Black fallback, distributed with their license files in `public/fonts/`. ABC Gravity is not bundled. The preloader uses Anton unless a suitable ABC Gravity face is installed locally.

**Dataset context:** Extension of Z-Alizadeh Sani, UCI Machine Learning Repository, ID 411. https://archive.ics.uci.edu/dataset/411/extension+of+z+alizadeh+sani+dataset

**Input brief:** `TrustHeart_3D_Frontend_PRD_README.md`, supplied by the project owner. Team names, affiliations and repository links have not been invented.
