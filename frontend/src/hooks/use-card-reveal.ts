import { useEffect, type RefObject } from "react";

const SELECTOR = "[data-scroll-card]";
const DURATION = 640;

/** One observer for the route outlet. CSS translate never overwrites GSAP tilt transforms. */
export function useCardReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scope = root.current;
    if (!scope) return;
    const reduce = matchMedia(
      "(prefers-reduced-motion: reduce), (forced-colors: active)",
    );
    const cards = new Set<HTMLElement>();
    const timers = new Map<HTMLElement, number>();
    let observer: IntersectionObserver | undefined;

    const finish = (card: HTMLElement) => {
      observer?.unobserve(card);
      const timer = timers.get(card);
      if (timer !== undefined) window.clearTimeout(timer);
      timers.delete(card);
      card.dataset.cardReveal = "visible";
      card.style.removeProperty("--card-reveal-delay");
    };
    const reveal = (card: HTMLElement, delay = 0) => {
      if (card.dataset.cardReveal !== "pending") return;
      if (reduce.matches || card.contains(document.activeElement)) {
        finish(card);
        return;
      }
      observer?.unobserve(card);
      card.style.setProperty("--card-reveal-delay", `${delay}ms`);
      card.dataset.cardReveal = "entering";
      // Transition events can be dropped when a tab is hidden or styles change.
      timers.set(
        card,
        window.setTimeout(() => finish(card), DURATION + delay + 100),
      );
    };

    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const groups = new Map<Element | null, number>();
          entries
            .filter((entry) => entry.isIntersecting)
            .sort(
              (a, b) =>
                a.boundingClientRect.top - b.boundingClientRect.top ||
                a.boundingClientRect.left - b.boundingClientRect.left,
            )
            .forEach((entry) => {
              const card = entry.target as HTMLElement;
              const index = groups.get(card.parentElement) ?? 0;
              groups.set(card.parentElement, index + 1);
              reveal(card, innerWidth < 768 ? 0 : Math.min(index, 3) * 75);
            });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
      );
    }

    const prepare = (card: HTMLElement) => {
      if (cards.has(card)) return;
      cards.add(card);
      const rect = card.getBoundingClientRect();
      // Never hide already-visible content on mount, restoration or late hydration.
      if (
        !observer ||
        reduce.matches ||
        rect.top < innerHeight * 0.92 ||
        card.contains(document.activeElement)
      ) {
        finish(card);
        return;
      }
      card.dataset.cardReveal = "pending";
      observer.observe(card);
    };
    const visit = (node: Node, callback: (card: HTMLElement) => void) => {
      if (!(node instanceof Element)) return;
      if (node.matches(SELECTOR)) callback(node as HTMLElement);
      node.querySelectorAll<HTMLElement>(SELECTOR).forEach(callback);
    };
    const forget = (card: HTMLElement) => {
      if (card.isConnected && scope.contains(card)) return;
      observer?.unobserve(card);
      const timer = timers.get(card);
      if (timer !== undefined) window.clearTimeout(timer);
      timers.delete(card);
      cards.delete(card);
      delete card.dataset.cardReveal;
      card.style.removeProperty("--card-reveal-delay");
    };
    visit(scope, prepare);
    // Route transitions and conditionally rendered results can add cards later.
    // Attribute/text updates (including smooth-input measurements) do not trigger scans.
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => {
        record.removedNodes.forEach((node) => visit(node, forget));
        record.addedNodes.forEach((node) => visit(node, prepare));
      });
    });
    mutations.observe(scope, { childList: true, subtree: true });
    const focus = (event: FocusEvent) => {
      const card =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(SELECTOR)
          : null;
      if (card && scope.contains(card)) finish(card);
    };
    const transitioned = (event: TransitionEvent) => {
      const card = event.target;
      if (
        card instanceof HTMLElement &&
        card.matches(SELECTOR) &&
        card.dataset.cardReveal === "entering" &&
        event.propertyName === "opacity"
      )
        finish(card);
    };
    const revealAll = () => cards.forEach(finish);
    const preference = () => {
      if (reduce.matches) revealAll();
    };
    scope.addEventListener("focusin", focus);
    scope.addEventListener("transitionend", transitioned);
    reduce.addEventListener("change", preference);
    window.addEventListener("beforeprint", revealAll);
    return () => {
      observer?.disconnect();
      mutations.disconnect();
      timers.forEach((timer) => window.clearTimeout(timer));
      scope.removeEventListener("focusin", focus);
      scope.removeEventListener("transitionend", transitioned);
      reduce.removeEventListener("change", preference);
      window.removeEventListener("beforeprint", revealAll);
      cards.forEach((card) => {
        delete card.dataset.cardReveal;
        card.style.removeProperty("--card-reveal-delay");
      });
    };
  }, [root]);
}
