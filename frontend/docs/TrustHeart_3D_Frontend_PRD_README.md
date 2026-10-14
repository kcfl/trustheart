# TrustHeart 3D — Frontend Product Requirements Document (PRD)

> **Purpose:** This document is the product and implementation brief for the frontend of TrustHeart 3D. Give it to Claude Code as the primary source of truth before asking it to build the application.
>
> **Product type:** Hackathon prototype / educational clinical decision-support interface.
>
> **Status:** Frontend requirements and proposed UX. Confirm backend contracts, official hackathon rules, and model capabilities with the ML/backend owner before representing any feature as functional.

---

## 1. Product vision

Build **TrustHeart 3D**, a polished, responsive, scientifically responsible AI-assisted cardiac-risk exploration platform. The experience should combine a cinematic, glass-and-light medical-tech landing page with a practical analytics workspace.

The uploaded reference image is the visual direction for the **hero section**: a dark rounded application canvas, large editorial headline, luminous blue anatomical heart, subtle translucent data panels, restrained navigation, atmospheric blue/teal lighting, and a vivid green primary CTA. Treat it as visual inspiration, not as a pixel-perfect template. Improve legibility, accessibility, hierarchy, responsiveness, and product clarity.

This is **not** a generic hospital website, appointment-booking website, or a marketing-only mockup. Its central workflow is to collect model-supported input features, request predictions from the project's backend, and clearly visualize returned results and available explanations.

### Product promise

- Make model outputs easier to explore and understand.
- Show the difference between prediction, evidence, and uncertainty.
- Make the interface visually memorable without sacrificing usability or performance.
- Clearly communicate that the prototype is for education/research and is not a medical diagnosis.

## 2. Source-grounded project context

The current project README describes a machine-learning backend based on the Extension of Z-Alizadeh Sani dataset (UCI dataset ID 411). It mentions 303 samples, multiple model configurations, calibration, feature statistics, coherence checks, bootstrap feature-importance stability analysis, trust-layer aggregation, and automated tests.

The hackathon discussion shared by the team describes Track A as four binary prediction targets: CAD, LAD, LCX, and RCA, with SHAP explanations and a 3D heart whose arteries are colored according to predicted probabilities. These track details must be checked against the official problem statement before final submission.

### Non-negotiable scientific safeguards

1. Do not claim the model diagnoses, prevents, or treats heart disease.
2. Display a visible clinical/educational disclaimer in the interface.
3. Do not invent model accuracy, AUC, F1, sensitivity, specificity, confidence, calibration, feature importance, or patient results.
4. Never fabricate a successful API response. If using demo data, label it **SIMULATED DEMO DATA** in a persistent and unmistakable way.
5. Color-coded arteries represent model-predicted probabilities only; they do not identify a real anatomical blockage or lesion location.
6. Do not interpret RWMA or any other input feature as a localized lesion map.
7. Use only features and output fields confirmed by the backend owner.
8. Do not expose raw patient data in logs, analytics, URLs, or browser storage by default.
9. Present model limitations and the fact that a model probability is not the same as clinical certainty.
10. Do not provide medical advice or emergency triage. Encourage users to consult qualified healthcare professionals for medical concerns.

## 3. Target users

Primary:
- Hackathon judges evaluating technical completeness, usability, visual quality, and responsible AI communication.
- Students and researchers exploring model outputs and explainability.

Secondary:
- A technical reviewer who wants to understand the pipeline, validation approach, and model limitations.

Do not design the initial version as a production clinical system for doctors or patients. Do not imply clinical approval or regulatory certification.

## 4. Product information architecture

Build the following routes/pages. If the project is a single-page app, each major section should still have a clear URL or navigation state where practical.

### A. `/` — Landing / hero experience

**Purpose:** Establish the product identity and guide users into the analysis workflow.

**Visual direction:**
- Full-viewport atmospheric backdrop with a central, rounded, dark application canvas.
- Large editorial typography and short, clear copy.
- A high-quality anatomical heart model as the visual focal point.
- Blue/cyan highlights with restrained teal accents; green may be used for the primary CTA, inspired by the reference.
- Translucent data cards layered around the heart, but only show real metrics if available; otherwise use clearly labelled illustrative UI or non-numeric labels.
- Subtle lighting, grain, vignette, and depth. Avoid excessive neon, clutter, and generic “AI” decorations.

**Suggested content:**
- Brand: TrustHeart 3D.
- Eyebrow: “CARDIAC RISK EXPLORATION • EXPLAINABLE ML”.
- Headline: “See the Signals Behind the Prediction.”
- Supporting copy: “Explore model-estimated cardiac risk with transparent evidence and interactive 3D visualization.”
- Primary CTA: “Start Analysis”.
- Secondary CTA: “Explore the Method”.
- Visible disclaimer: “Educational/research prototype only. Not a medical diagnosis or a substitute for professional medical evaluation.”

**Interactions:**
- Smooth entrance animation with restrained stagger.
- Gentle heart rotation or pointer-responsive movement on capable devices.
- CTA transitions to `/analysis`.
- “Explore the Method” scrolls to or routes to the methodology section.
- Respect `prefers-reduced-motion`; provide a static fallback.
- Navigation links: Platform, Methodology, Model Insights, About.

**Hero acceptance criteria:**
- The primary CTA is visible and usable at common laptop and mobile sizes.
- Headline and controls remain legible over the 3D scene.
- No essential information exists only inside an animation.
- The page works if the 3D asset fails to load.

### B. `/analysis` — Input and analysis workflow

**Purpose:** Collect valid model-supported inputs and submit a prediction request.

**Layout:**
- Clear page title and concise instructions.
- A step-based or grouped form rather than one overwhelming wall of fields.
- Group fields according to the actual backend schema, not guessed medical categories.
- Show labels, units, accepted ranges, required/optional status, and inline validation only when confirmed by the model contract.
- Provide “Review inputs” before submission when useful.
- Submit action: “Run Analysis”.
- Show loading, success, validation error, network error, and backend error states.
- Prevent duplicate submissions while a request is in progress.

**Required behavior:**
- Build a typed API client in `src/services/prediction-api.ts`.
- Validate inputs with a shared schema where possible.
- Keep API base URL in environment configuration, e.g. `VITE_API_BASE_URL`.
- Never hardcode private API keys in frontend code.
- Use mock data only behind an explicit demo/mock mode.
- If no backend contract exists yet, build the form shell and a typed adapter interface; do not pretend the integration is complete.

**Acceptance criteria:**
- Every field maps to a documented backend input.
- Invalid data cannot be submitted.
- Errors are actionable and do not erase user input.
- The form is keyboard accessible and usable on mobile.

### C. `/results` or analysis result state — Prediction results

**Purpose:** Explain the response returned by the model.

**Display only fields that actually exist in the API response:**
- CAD probability/classification.
- LAD, LCX, and RCA probabilities/classifications.
- Model/version metadata, if available.
- Timestamp or request identifier, if appropriate and safe.
- Calibration or validation context, if returned or published by the project.

**Visualization:**
- Clear probability cards or bars with textual values.
- A 3D heart panel with selectable coronary arteries, if the supplied 3D asset supports this.
- A legend with explicit probability meaning.
- A data table or text alternative for accessibility.
- A concise explanation of what the model output does and does not mean.

**Important consistency behavior:**
- Do not silently modify returned probabilities to make the visualization look consistent.
- If the project defines cross-target coherence rules, show a transparent validation warning when the backend reports an inconsistency; do not invent a clinical rule in the frontend.
- Do not use red/green alone to communicate meaning. Pair color with labels and numeric values.
- If no results exist, show an empty state and a CTA back to analysis.

### D. `/explainability` — Evidence and feature insights

**Purpose:** Make the model's available explanations understandable.

**Potential UI components, only when supported by backend artifacts:**
- SHAP global feature-importance chart.
- Per-prediction SHAP contribution chart.
- Positive/negative contribution display.
- Feature-importance stability summary.
- Explanation method and model/version metadata.
- Plain-language interpretation notes.

**Rules:**
- Clearly distinguish global feature importance from an explanation for one prediction.
- Do not claim correlation or model contribution proves causation.
- Do not invent explanations when SHAP output is missing.
- When a component is unavailable, show a clear “Not available in this build” state rather than fabricated content.

### E. `/methodology` — Methodology, validation and limitations

**Purpose:** Help reviewers assess reproducibility and scientific honesty.

**Sections:**
- Dataset description and source attribution.
- Prediction targets and definitions confirmed by the official brief/backend.
- Preprocessing and feature exclusion rules documented by the ML owner.
- Validation strategy and metrics actually produced by the pipeline.
- Calibration method, if applicable.
- Model comparison summary, if available.
- Feature-importance stability approach, if available.
- Known limitations, small dataset concerns, class imbalance, domain limitations, and intended use.
- Clinical disclaimer.

Do not invent numerical results. Render a graceful “Metrics will appear when published by the model pipeline” state if values are not available.

### F. `/about` — Project and team

**Purpose:** Explain the project and identify contributors.

Include:
- Short project summary.
- Team member roles, using names only when supplied by the team.
- Technology stack actually used.
- Links to repository/demo only when provided.
- Dataset and project acknowledgements.

Do not invent affiliations, endorsements, hospital partnerships, or certifications.

## 5. Global design system

### Visual principles
- Premium, cinematic, restrained, precise.
- High contrast and strong typographic hierarchy.
- Use negative space deliberately.
- Keep the heart as the main visual signature; dashboard content should remain calm and legible.
- Prefer a small, consistent spacing and radius scale over ad hoc styling.
- Avoid excessive glassmorphism, random gradients, constant motion, and decorative charts with no data.

### Suggested tokens (adjust after implementation)
- Background: near-black / deep navy.
- Surface: charcoal-blue.
- Primary accent: icy cyan / medical blue.
- Secondary accent: muted teal.
- CTA accent: green inspired by the reference image.
- Text: off-white, with muted blue-gray secondary text.
- Semantic status colors must also include text labels/icons.

Suggested CSS variables:
- `--color-bg`
- `--color-surface`
- `--color-surface-raised`
- `--color-text`
- `--color-text-muted`
- `--color-primary`
- `--color-secondary`
- `--color-accent`
- `--color-border`
- `--radius-card`
- `--space-*`

Typography:
- Use one expressive display face for large headlines and a highly readable sans-serif for body/UI.
- Use fluid type scaling (`clamp`) and avoid overly tight line-height for paragraphs.
- Numeric metrics should use tabular figures when practical.

Components:
- Button variants, input fields, select controls, tooltips, cards, badges, tabs, alert banners, dialogs, skeletons, empty states, error states, chart wrappers, and navigation should share consistent variants and states.

## 6. 3D heart requirements

- Use a properly licensed anatomical heart asset; document its source and license.
- Prefer GLB/GLTF.
- Confirm whether coronary arteries are separate mesh objects. If not, determine whether to overlay selectable tube geometries along carefully authored curves.
- Do not assume any downloaded model has individually addressable LAD, LCX, and RCA meshes.
- The 3D scene must support loading, error, and static fallback states.
- Use realistic but restrained lighting and material treatment; avoid obscuring anatomical detail.
- Optimize texture sizes, mesh complexity, and rendering settings.
- Lazy-load the 3D scene and pause/reduce rendering when not visible where practical.
- Support touch input without requiring hover.
- Make the visualization optional on lower-powered devices.
- Do not make a medical claim based on the appearance of the model.

## 7. Motion and interaction requirements

Use Motion for local UI transitions and GSAP/ScrollTrigger only where scroll choreography genuinely improves the story. Avoid two libraries controlling the same element.

Motion guidelines:
- Prefer opacity and transform animations.
- Avoid layout-thrashing animations.
- Use subtle, deliberate easing.
- Keep interactions fast and interruptible.
- Respect reduced-motion settings.
- Disable or simplify pointer-following effects on touch devices.
- Never delay access to forms/results until a decorative animation completes.

## 8. Responsive behavior

Design and test at minimum:
- Small mobile: 320–375 px.
- Standard mobile: 390–430 px.
- Tablet: 768 px.
- Laptop: 1280–1440 px.
- Wide desktop: 1600 px and above.

Mobile rules:
- Reflow the hero headline and heart instead of shrinking the entire desktop composition.
- Reduce or disable expensive 3D and particle effects.
- Convert multi-column forms into a single column.
- Make charts scrollable or provide table alternatives where necessary.
- Ensure touch targets are comfortably sized.
- No horizontal overflow.

## 9. Performance, accessibility and reliability

### Performance
- Lazy-load 3D and chart-heavy components.
- Optimize and compress assets.
- Avoid unnecessary rerenders and excessive state at the application root.
- Provide a static hero fallback.
- Aim for responsive interaction and stable layout; measure performance rather than claiming untested scores.
- Avoid autoplay audio.

### Accessibility
- Semantic HTML and logical heading order.
- Full keyboard navigation and visible focus.
- Labels and useful error messages for every form control.
- Sufficient contrast.
- Text/table alternatives for charts and 3D-only information.
- Reduced-motion support.
- Do not encode status through color alone.

### Reliability
- Type API responses.
- Handle timeout, network failure, server errors, malformed responses, and missing fields.
- Use environment variables for public configuration.
- Do not place secrets in `VITE_*` variables; they are bundled into the client.
- Add tests for form validation, API states, result rendering, and key navigation.
- Never show a stale result as if it belongs to a new submission.

## 10. Suggested implementation plan

Build in small, reviewable milestones:

1. **Inspect the repository:** identify current framework, files, scripts, and existing work before changing anything.
2. **Confirm contracts:** obtain model input schema, output schema, API URL/auth expectations, SHAP artifacts, and actual available metrics from the backend owner.
3. **Create foundation:** routing, TypeScript types, design tokens, typography, layout, navigation, and reusable UI components.
4. **Build the landing page:** implement the reference-inspired hero with a static placeholder first.
5. **Build the analysis flow:** fields based on the real contract, validation, review, loading and error states.
6. **Build results and explainability:** start with typed fixture data explicitly labelled as simulated, then connect real endpoints.
7. **Integrate the 3D asset:** verify license and mesh structure, add interaction and fallback.
8. **Add methodology and about pages:** use only verified project details.
9. **Polish:** mobile behavior, accessibility, reduced motion, error cases, and performance.
10. **Test and document:** run project scripts, fix errors, and record any incomplete integration honestly.

Do not rewrite the whole repository without inspecting it. Preserve working functionality and follow the project's existing conventions when sensible.

## 11. Definition of done

The frontend is ready for a hackathon demo when:

- All required pages/routes are navigable.
- The landing page matches the intended visual direction and works without the 3D asset.
- The analysis form uses documented model inputs and validates them.
- Real backend integration works, or demo mode is clearly marked as simulated.
- Results are rendered from actual response fields without invented metrics.
- Explainability components use real artifacts or honest unavailable states.
- 3D arteries are correctly mapped only if the model asset supports it.
- The clinical disclaimer is visible.
- Responsive layouts work without horizontal overflow.
- Keyboard access, focus states, labels, and reduced motion are supported.
- Loading, empty, error, and success states are implemented.
- Automated tests and production build pass, or remaining failures are explicitly reported.
- README documents setup, environment variables, API assumptions, data limitations, and demo mode.

## 12. Instructions to Claude Code

Act as a **senior frontend engineer, product designer, and creative developer**. Do not merely produce a pretty landing page.

Before coding:
1. Inspect the current repository and report its framework, structure, existing components, and runnable commands.
2. Identify unknowns and list the backend/API details that need confirmation.
3. Propose a concise implementation plan with milestones.
4. Preserve existing project work unless a change is justified.

Then implement the product incrementally. Prioritize a coherent, functional end-to-end experience over adding every visual effect. Use clean TypeScript, reusable components, accessible interaction patterns, and responsive layouts. Do not invent backend behavior or scientific claims. Use explicit simulated fixtures only when necessary and label them clearly.

After each milestone:
- Run available lint, type-check, test, and build commands.
- Fix errors before continuing where feasible.
- Summarize files changed, functionality completed, tests run, and remaining blockers.

When finished, provide:
- How to run the frontend.
- Required environment variables.
- Backend endpoints/contracts still needed.
- Which features are real versus simulated.
- Known limitations and recommended next steps.

**First task:** inspect the repository and prepare the implementation plan. Do not start by generating a large amount of unreviewed code.
