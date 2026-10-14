# TRUST / HEART preloader

## Current display

- Cream-on-black stacked TRUST / HEART, with center-out rolling letters.
- Space Grotesk for labels and controls.
- **Bundled display font: Anton**, optically widened to approach the supplied reference. This replaces the earlier Archivo Black substitute. Anton is not ABC Gravity.
- ABC Gravity remains the preferred locally installed face when available. No licensed ABC Gravity asset was supplied or downloaded.
- Anton was obtained from the Google Fonts repository (https://github.com/google/fonts/tree/main/ofl/anton). Its SIL OFL license is included in `public/fonts/Anton-LICENSE.txt`. `anton.woff2` is a format-converted copy of the original font, preloaded by `index.html`.
- The official ABC Gravity provider requires a license for web use; the official trial form requires contact details and terms acceptance. No purchase, registration, or submission of personal information was performed. Official terms: https://abcdinamo.com/licenses; trial form: https://abcdinamo.com/form/request-trial-fonts.

## Layout fix

The preloader no longer depends on `src/styles.css` or Tailwind for its essential layout. The fixed overlay, stacked heading, letter masks, vertical reels and hidden accessible labels use component-owned inline styles. Font-face definitions and responsive finishing styles are injected with the component from `src/components/startup-preloader-styles.ts`. The overlay is portaled to `document.body` to avoid application ancestor layout effects. Duplicate global preloader rules were removed.

The application mounts after the first curtain exit. Skip, scroll, swipe, Escape, automatic completion and reduced motion remain supported. Replay from the header retains route and form state. Scroll locking is released after exit.

## Verification

Production TypeScript/Vite build passes. **10 focused browser tests pass**, including two tests with global/all stylesheets disabled. Other coverage: display fonts, rolling geometry, center-out timing, automatic exit, skip, scroll, replay/input preservation, reduced motion, and 320/390/768/1440 px sizing. The entire older application browser suite was not rerun for this font update.

Run `npx playwright test e2e/preloader.spec.ts --reporter=list`.
