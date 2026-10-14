import { useEffect } from "react";
import type { RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);

/** One owner per transform. No wheel interception, scroll hijacking, or pinned form controls. */
export function useHomeMotion(root: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const media = gsap.matchMedia();
    let alive = true;
    media.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        desktop: "(min-width: 961px)",
        pointer: "(hover: hover) and (pointer: fine)",
      },
      ({ conditions }) => {
        if (!conditions?.motion) return;
        const cleanups: (() => void)[] = [];
        const ctx = gsap.context(() => {
          // The CTA stays actionable; no long preloader or text splitting that changes the reading order.
          gsap.from(".hero-line-text", {
            yPercent: 108,
            rotateX: -12,
            duration: 1.1,
            stagger: 0.13,
            ease: "power4.out",
            clearProps: "transform",
          });
          gsap.from(
            ".hero-copy > .eyebrow, .hero-description, .hero-buttons, .hero-assurance",
            {
              y: 17,
              opacity: 0,
              duration: 0.65,
              stagger: 0.085,
              ease: "power2.out",
              clearProps: "opacity,transform",
            },
          );
          gsap.from(".floating-card", {
            opacity: 0,
            duration: 1,
            stagger: 0.16,
            delay: 0.3,
            clearProps: "opacity",
          });
          gsap.from(".visual-caption", {
            opacity: 0,
            duration: 0.8,
            delay: 0.3,
            clearProps: "opacity",
          });

          // This timeline moves the presentation layers; the 3D scene owns its own model rig.
          if (conditions.desktop) {
            gsap
              .timeline({
                scrollTrigger: {
                  trigger: ".hero",
                  start: "top top",
                  end: "bottom top",
                  scrub: 0.7,
                  invalidateOnRefresh: true,
                },
              })
              .to(".hero-copy", { y: -55, ease: "none" }, 0)
              .to(
                ".hero-visual",
                {
                  y: 95,
                  rotateY: -6,
                  rotateX: 3,
                  transformPerspective: 1300,
                  ease: "none",
                },
                0,
              )
              .to(
                ".coronary-card",
                { x: 29, y: -48, rotate: 7, ease: "none" },
                0,
              )
              .to(
                ".insight-card",
                { x: -24, y: 33, rotate: -6, ease: "none" },
                0,
              )
              .to(".hero-visual .orbit-one", { rotation: 5, ease: "none" }, 0)
              .to(
                ".hero-visual .orbit-two",
                { rotation: -48, ease: "none" },
                0,
              );
          }
          gsap.fromTo(
            ".reading-progress-fill",
            { scaleX: 0 },
            {
              scaleX: 1,
              transformOrigin: "left center",
              ease: "none",
              scrollTrigger: {
                trigger: el,
                start: "top top",
                end: "bottom bottom",
                scrub: 0.15,
              },
            },
          );

          gsap.utils
            .toArray<HTMLElement>(
              ".reveal:not(.feature-card):not(.workflow-step):not(.research-section)",
            )
            .forEach((section) => {
              const tween = gsap.from(section, {
                opacity: 0,
                y: conditions.desktop ? 40 : 18,
                duration: 0.8,
                ease: "power3.out",
                clearProps: "opacity,transform",
                scrollTrigger: {
                  trigger: section,
                  start: "top 94%",
                  once: true,
                },
              });
              const focus = () => {
                tween.progress(1);
              };
              section.addEventListener("focusin", focus);
              cleanups.push(() =>
                section.removeEventListener("focusin", focus),
              );
            });
          const cards = gsap.utils.toArray<HTMLElement>(".feature-card");
          // Scroll entrance uses independent CSS translate/opacity; GSAP owns hover tilt.
          cards.forEach((card) => {
            if (!conditions.pointer || !conditions.desktop) return;
            card.dataset.depth = "true";
            gsap.set(card, {
              transformPerspective: 1000,
              transformOrigin: "center center",
            });
            const rx = gsap.quickTo(card, "rotationX", {
              duration: 0.5,
              ease: "power3.out",
            });
            const ry = gsap.quickTo(card, "rotationY", {
              duration: 0.5,
              ease: "power3.out",
            });
            const lift = gsap.quickTo(card, "y", {
              duration: 0.45,
              ease: "power3.out",
            });
            let bounds = card.getBoundingClientRect();
            const enter = () => {
              bounds = card.getBoundingClientRect();
              lift(-5);
            };
            const move = (event: PointerEvent) => {
              const x = (event.clientX - bounds.left) / bounds.width - 0.5,
                y = (event.clientY - bounds.top) / bounds.height - 0.5;
              rx(gsap.utils.clamp(-3.5, 3.5, -y * 7));
              ry(gsap.utils.clamp(-4, 4, x * 8));
            };
            const leave = () => {
              rx(0);
              ry(0);
              lift(0);
            };
            card.addEventListener("pointerenter", enter);
            card.addEventListener("pointermove", move);
            card.addEventListener("pointerleave", leave);
            card.addEventListener("blur", leave);
            cleanups.push(() => {
              card.removeEventListener("pointerenter", enter);
              card.removeEventListener("pointermove", move);
              card.removeEventListener("pointerleave", leave);
              card.removeEventListener("blur", leave);
              delete card.dataset.depth;
              rx.tween.kill();
              ry.tween.kill();
              lift.tween.kill();
            });
          });
          const steps = gsap.utils.toArray<HTMLElement>(".workflow-step");
          gsap.fromTo(
            ".workflow-line-fill",
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: "none",
              transformOrigin: "top",
              scrollTrigger: {
                trigger: ".workflow-steps",
                start: "top 75%",
                end: "bottom 60%",
                scrub: 0.45,
              },
            },
          );
          steps.forEach((step) => {
            ScrollTrigger.create({
              trigger: step,
              start: "top 72%",
              end: "bottom 42%",
              toggleClass: { targets: step, className: "is-current-step" },
            });
          });
          const wave = el.querySelector<SVGPathElement>(
            ".anatomy-graphic svg path",
          );
          if (wave) {
            const length = wave.getTotalLength();
            gsap.fromTo(
              wave,
              { strokeDasharray: length, strokeDashoffset: length },
              {
                strokeDashoffset: 0,
                duration: 1.6,
                ease: "power2.inOut",
                scrollTrigger: {
                  trigger: wave.closest(".feature-card"),
                  start: "top 86%",
                  once: true,
                },
              },
            );
          }
          gsap.from(".research-callout", {
            rotateY: conditions.desktop ? -8 : 0,
            scale: 0.97,
            duration: 1,
            ease: "power3.out",
            transformPerspective: 1000,
            clearProps: "transform",
            scrollTrigger: {
              trigger: ".research-callout",
              start: "top 90%",
              once: true,
            },
          });
        }, el);
        return () => {
          cleanups.forEach((fn) => fn());
          ctx.revert();
        };
      },
    );
    // Font metrics can change section positions, but avoid refresh work on each frame.
    document.fonts.ready.then(() => {
      if (alive) ScrollTrigger.refresh();
    });
    return () => {
      alive = false;
      media.revert();
    };
  }, [root]);
}
