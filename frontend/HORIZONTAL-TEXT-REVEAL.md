# Horizontal Text Reveal

`src/components/ui/horizontal-text-reveal.tsx` provides reusable word-by-word, scroll-linked opacity, horizontal translation and skew using the existing `motion/react` dependency.

Applied to three editorial homepage headings: “One heart”, “Complex science” and “Transparency isn't a feature”. Original wording/emphasis are preserved. Forms, outputs, disclaimers and actions remain unanimated text.

The workflow introduction uses native sticky positioning on viewports at least 961px wide and 700px tall. Its words follow section progress. On mobile and short viewports, pinning is disabled and progress instead tracks the heading itself so the sentence is fully revealed before leaving the screen. There is no scroll interception.

Words move from 0.9em right with a 9-degree skew and 0.18 opacity toward their original position/full opacity. Their bounded, overlapping progress intervals finish by 0.88. Scrolling back reverses the effect. Semantic headings expose one complete accessible name; visual word spans are decorative to screen readers.

Reduced motion renders complete static lines without scroll subscriptions. Forced colors and printing override visual transforms/opacity and disable pinning. Three unit tests and five focused browser tests passed when this feature was added, covering order, reversible scroll progress, sticky behavior, 320/390px layouts and accessible fallbacks.
