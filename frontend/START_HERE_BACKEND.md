# TrustHeart 3D — backend handoff

**Handoff date:** 14 October 2026  
**Status:** frontend research prototype ready for backend integration. **No backend, trained model, confirmed feature schema or genuine SHAP/evaluation artifacts are included.**

## 1. Run the frontend

Install Node.js **20.19 or newer** (tested with 20.20.2) and npm. Extract the ZIP, open its `TrustHeart-3D` directory, then run:

```bash
npm ci
npm run dev
```

Open the address Vite prints, normally port 5173. Dependencies are intentionally not included in the ZIP; `npm ci` recreates them from `package-lock.json`.

```bash
npm run build    # includes TypeScript and the required footer-credit checks
npm run preview # inspect the production build locally
npm test        # unit tests
```

The app is a React/TypeScript/Vite SPA, not a server-rendered backend. The current development config binds to 0.0.0.0 and allows hosted preview origins. Do not mistake that setting for authentication; restrict development-server exposure and configure production hosting appropriately.

## 2. What is already implemented

- Six routes: `/`, `/analysis`, `/results`, `/explainability`, `/methodology`, `/about`.
- Input/review/loading/cancel/error/empty/result flows, controlled input state, stale-result invalidation and duplicate-submit protection.
- Fixed, explicitly labelled **SIMULATED DEMO DATA** only.
- Original textured heart, static/error fallback, viewer controls, responsive layouts and accessibility accommodations.
- Nebula/glass design, rolling intro/replay, smooth input carets, progressive blur, card reveals, horizontal word reveals and existing animated footer.
- Adaptive decorative rendering, demand-driven heart rendering and reduced-motion handling.
- A typed adapter boundary and an HTTP helper, **not connected to the analysis workflow**.

## 3. Files the backend developer should read first

| File                                        | Why it matters                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/services/prediction-api.ts`            | `PredictionAdapter<TInput>`, `demoAdapter`, response parser, unused live HTTP helper  |
| `src/features/analysis/demo-schema.ts`      | Six illustrative fields and demo-only validation                                      |
| `src/pages/Analysis.tsx`                    | Currently calls `demoAdapter.predict(...)`; review, cancellation and failure handling |
| `src/App.tsx`                               | In-memory input/result state and route layout                                         |
| `src/pages/Results.tsx`                     | Target selection, probability table, export and demo notices                          |
| `src/pages/Explainability.tsx`              | Global/local scopes and unavailable-artifact states                                   |
| `.env.example`                              | Public frontend API configuration only                                                |
| `src/services/prediction-api.test.ts`       | Existing API-boundary, timeout, cancellation and validation tests                     |
| `docs/TrustHeart_3D_Frontend_PRD_README.md` | Original product brief and scientific/privacy boundaries                              |

## 4. Agree the contract before connecting a model

The displayed age/sex/systolic/cholesterol/diabetes/smoking inputs are a **UI demonstration**, not an approved training/inference feature list. Their ranges are demo UI limits, not medical reference ranges. Do not train or infer from this schema merely because it is in the frontend.

Confirm with the model owner:

1. Actual feature names, order, encodings, units, valid ranges, required/missing-value rules and preprocessing.
2. Endpoint, method, authentication, response/error shapes and deployment origin.
3. Target definitions, calibration context, model/version metadata and request identifiers.
4. Global/local SHAP artifacts, feature alignment, baselines, units and uncertainty/stability information.
5. Real evaluation artifacts, validation strategy and leakage controls.
6. Data retention, access control, logging and consent requirements.

## 5. Existing HTTP utility — proposed output, not an agreed backend API

`requestPrediction(confirmedInput, endpoint, signal)` currently:

- POSTs JSON to `VITE_API_BASE_URL + '/' + endpoint`.
- Uses a 15-second timeout and propagates cancellation.
- Rejects invalid probability ranges, missing targets and an invalid timestamp.
- Reports network/HTTP/JSON errors; it does not invent a successful prediction on failure.
- Does not implement authentication or a backend server.

The normalized response shape currently expected by the parser is:

```ts
{
  probabilities: {
    CAD: number; // finite, 0–1
    LAD: number;
    LCX: number;
    RCA: number;
  };
  createdAt: string; // parseable timestamp; prefer ISO 8601
  modelVersion?: string;
  warnings?: string[];
}
```

This is **proposed frontend normalization**, not proof that any endpoint exists. The parser marks accepted real HTTP responses as `mode: 'live'`; no request is currently made from the demo workflow. The targets are independent binary outputs, not slices that must sum to 100%. No lesion/blockage location can be inferred from them.

## 6. Safe integration sequence

1. Add a backend-approved input schema and mapping; update the form rather than silently reusing the demo schema.
2. Implement a typed live adapter using the agreed endpoint/response contract. Keep the demo adapter separate and available for development.
3. Select the adapter explicitly in the analysis workflow. **Setting `VITE_API_BASE_URL` alone does not enable live mode.**
4. Preserve cancellation, input retention on failure, loading state, duplicate-submit protection and stale-result invalidation.
5. Update all result labels/banners/export metadata to reflect the actual response mode. Some demo notices are currently unconditional. Do not simply remove simulation labels while still returning the fixture.
6. Add validated explanation parsing and rendering only when real artifacts are available. The current parser intentionally ignores unvalidated SHAP payloads.
7. Add integration tests for success, malformed responses, invalid/missing inputs, authorization, offline/timeout, cancellation and stale responses.
8. Review production security, privacy, accessibility, browser/device performance and scientific wording before public/clinical use.

Use a same-origin `/api` reverse proxy where possible. For a development backend inside the same machine/sandbox, configure a **server-side Vite proxy** after agreeing the actual backend port and path. Browser code should use relative API URLs, not a sandbox-local `localhost` address. Configure production routing separately; the ZIP deliberately contains no invented proxy target or backend endpoint.

All `VITE_*` variables are visible to users. Never put API secrets, database credentials or model-service private keys there. The frontend currently stores inputs/results only in React memory; do not add raw patient values to logs, analytics, browser storage, URLs or exports by default.

## 7. Branding, design and licenses

Keep `inspired by SSPRO🎀` in the shared footer. Its dedicated component, build guard and tests catch accidental removal. This is not tamper-proof security against someone with source access; see `PROJECT-CREDIT.md` for repository/deployment controls to arrange with the owner.

Preserve third-party notices and model/font licenses. The exact ABC Gravity font was not supplied: the preloader uses **Anton + Space Grotesk**, with ABC Gravity only preferred when installed locally. Do not claim the commercial font is bundled.

Do not replace the supplied textured heart with a recolored model, remove the Beam Wordmark Footer, invent metrics/SHAP values, or label artery probabilities as blockage locations.

## 8. Verification status and how to rerun

- Latest production build, TypeScript and source/production credit checks pass.
- **61 unit tests pass.**
- **61 browser tests are included** across 10 files.
- The most recent full browser run occurred before the final footer change: 55/57 passed, with two timing-related failures. After correcting the hover readiness check, shader-load wait and related initialization/hover handling, all 6 glass/performance checks passed on rerun. The subsequent footer update passed 5 focused footer/credit checks.
- **The complete final 61-test browser suite has not been rerun as one clean run.** Run it on the backend developer's machine after integration; do not present the included test count as blanket production certification.

```bash
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:credit
```

Browsers/system packages are not inside the ZIP. Hardware performance varies; no fixed 60/120 FPS, Lighthouse score or clinical accuracy is guaranteed.

## 9. Additional documentation

- `README.md` — setup, architecture, scientific boundaries.
- `PRELOADER.md`, `SMOOTH-INPUT.md`, `PROGRESSIVE-BLUR.md`, `CARD-REVEAL.md`, `HORIZONTAL-TEXT-REVEAL.md` — implemented interactions.
- `PERFORMANCE.md` — rendering changes and limited sandbox profiling results.
- `FOOTER-INTEGRATION.md`, `PROJECT-CREDIT.md`, `THIRD_PARTY_NOTICES.md` — footer and attribution requirements.
- `IMPLEMENTATION.md` — earlier milestones; current handoff status is this document.

## 10. ZIP contents

Includes all application source, public assets/fonts/licenses, npm manifests/lockfile, configuration, tests, safeguards, documentation and the original PRD. Excludes `node_modules`, generated builds, browser binaries, screenshots/traces, cache directories, local environment files and secrets. Install/build outputs are recreated by the commands above.
