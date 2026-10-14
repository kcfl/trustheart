# Scroll-triggered card reveals

Cards marked `data-scroll-card` are managed by `useCardReveal` on the main route outlet. Add the attribute to another card to opt in; no wrapper or dependency is needed.

- Offscreen cards fade upward 28px on desktop, 16px on mobile.
- 640ms eased entrance, with 75ms sibling staggering capped at 225ms on desktop; no stagger delay below 768px.
- One reveal per mounted card. Already-visible content is never hidden on initialization.
- One IntersectionObserver, plus a scoped MutationObserver for route/content changes. No continuous scroll or animation-frame loop.
- Only newly added/removed element subtrees are checked; text-only updates from inputs are ignored.
- Reduced motion, forced colors and printing show every card without animation.
- Keyboard focus reveals the containing card immediately; pending cards cannot intercept pointer clicks.
- Observer targets, timers, media listeners and inline delay variables are cleaned up. A completion timeout prevents transitions from leaving unfinished states.
- Uses independent CSS `translate` and opacity, preserving the existing GSAP `transform` hover/3D effects. Older browsers without independent translate still receive the opacity reveal.

Home feature cards, workflow cards, the research callout, About cards, Methodology cards, Model insights summaries, the analysis sidebar and available Results probability cards opt in. Active form panels, preloader, header, floating hero cards and footer do not.

The old duplicate Home card/step entrance tweens were removed. Existing hero motion, hover tilt, workflow indicator, reading-progress line, heart model and Progressive Blur remain.

## Verification

Production build and all 57 unit tests pass. Four new card-reveal browser tests pass (stagger, real scroll, once-only behavior, stable layout, focus, route changes, reduced motion, mobile and form/footer exclusion). All three existing glass-motion tests also pass, verifying original heart material, hover tilt, navigation, reduced motion and mobile/footer preservation. This is seven focused browser checks, not a claim that the entire older application browser suite was rerun.

Files: `src/hooks/use-card-reveal.ts`, `src/App.tsx`, opt-in attributes in page components, and the final card-reveal section of `src/styles.css`.
