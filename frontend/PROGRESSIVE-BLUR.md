# Progressive Blur

## Integration

CSS-only top/bottom progressive blur is enabled on **Home, About and Methodology**. The existing nebula theme, content, routing, preloader, heart model and Beam Wordmark Footer remain in place.

- 6px blur / 96px edge height on desktop.
- 4px blur / 64px edge height below 768px.
- 44px edge height for short landscape screens.
- Only the two narrow edge bands receive backdrop filters; the center stays unfiltered.
- Native CSS scroll timelines fade in the edge effect over the first 140px of scrolling where supported. Other browsers retain the sticky edge reveal without scroll-driven opacity.
- A shared grid cell lets the sticky frame overlay content without adding empty page height. Its normal-sized sticky box stops at the end of main, before the footer.
- No JS scroll listener, requestAnimationFrame, IntersectionObserver, GSAP, Motion, or new runtime dependency is used by this effect.
- Analysis, Results and Model insights deliberately remain unblurred to preserve readability of inputs, numerical outputs and model explanations.

## Reuse

`src/components/ui/progressive-blur.tsx` exports `ProgressiveBlur` and its props:

```tsx
import { ProgressiveBlur } from "@/components/ui/progressive-blur";

<div style={{ position: "relative" }}>
  {/* scrolling text/content */}
  <ProgressiveBlur
    position="top"
    backgroundColor="rgba(8, 4, 15, 0.32)"
    height="96px"
    blurAmount="6px"
    className="custom-edge"
  />
</div>;
```

Defaults match the supplied interface: `className=""`, `backgroundColor="#f5f4f3"`, `position="top"`, `height="150px"`, `blurAmount="4px"`.

`src/components/ui/progressive-blur-demo.tsx` exports a standalone `Skiper41` demo with a keyboard-scrollable text region. It is not an extra application route or an additional nested scroll area in the existing site.

Essential overlay styles are inline. Application integration, demo styling and accessibility media queries live in the Progressive Blur section of `src/styles.css`.

## Accessibility and compatibility

Overlays are `aria-hidden`, non-focusable and `pointer-events: none`; underlying text remains selectable. Keyboard-focused links and controls suppress the main-page overlays. Opening the mobile menu suppresses them too. Reduced motion, reduced transparency and forced colors disable blur via CSS. Unsupported backdrop-filter implementations retain a low-opacity gradient fallback. Both standard and WebKit mask/backdrop-filter properties are supplied.

The mask uses opaque black independently of the chosen background tint so translucent theme colors do not accidentally weaken the filter twice.

## Performance

The shipped effect uses only 4–6px. Start in that range. 8–10px may be useful for a stronger effect; avoid values above 15px without profiling real target devices. Acceleration, memory use and frame rates depend on the browser/device and the rest of the page; no fixed performance guarantee is implied. There are no full-screen blur layers or persistent `will-change` hints.

## Attribution

Adapted from the Skiper UI Skiper41 code supplied by the user, by **@gurvinder-singh02** (https://gxuri.me): https://skiper-ui.com/v1/skiper41.

Inspired by and adapted from **Devouring Details**: https://devouringdetails.com/.

The supplied free-use notice requires Skiper UI attribution. It is retained here, in the component source and in `THIRD_PARTY_NOTICES.md`. The visible footer now carries the owner-requested SSPRO project inspiration credit; that branding does not replace third-party provenance. No affiliation, endorsement or ownership of the original interaction design is claimed. The supplied source was integrated directly; the shadcn registry installer was not run, and no dependencies were added.

## Checks

- `npm run build`
- `npm test`
- `npx playwright test e2e/progressive-blur.spec.ts`

Browser checks cover real scroll positioning, computed masks/blur, a clear central reading area, footer boundaries, attribution, mobile navigation, 320px/mobile/landscape fit, keyboard focus, unblurred analysis inputs, reduced motion and forced colors.
