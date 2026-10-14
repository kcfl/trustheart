"use client";

import * as React from "react";

/**
 * Beam Wordmark Footer — supplied component, adapted for the host application.
 * React only. The section and each letter paint the same coordinate-aligned
 * beam; pointer state reaches CSS variables without per-frame React renders.
 */
export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const hexToRgb = (hex: string, fallback = "61, 107, 255"): string => {
  const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec((hex || "").trim());
  if (!m) return fallback;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const n = parseInt(h, 16);
  return ((n >> 16) & 255) + ", " + ((n >> 8) & 255) + ", " + (n & 255);
};

/** Fit text measured at 100px, capped so a short word is not a tower. */
export const fitSize = (
  measuredAt100: number,
  target: number,
  cap: number,
): number => {
  if (!(measuredAt100 > 0) || !(target > 0)) return 0;
  const size = (100 * target) / measuredAt100;
  return cap > 0 ? Math.min(size, cap) : size;
};
export const beamTarget = (u: number, lo = 30, hi = 82): number =>
  lo + (hi - lo) * clamp(Number.isFinite(u) ? u : 0.5, 0, 1);
export const drift = (t: number, centre = 58, amp = 9): number =>
  centre + amp * (0.7 * Math.sin(t * 0.21) + 0.3 * Math.sin(t * 0.077 + 1.3));
export const approach = (
  from: number,
  to: number,
  k: number,
  dt: number,
): number =>
  to + (from - to) * Math.pow(1 - clamp(k, 0, 1), clamp(dt, 0, 0.1) * 60);
export const baselineAt = (ascent: number, descent: number): number => {
  if (!(ascent > 0) || !(descent >= 0)) return 0.8;
  return clamp(((100 - ascent - descent) / 2 + ascent) / 100, 0.5, 1.2);
};
export const wordHeight = (
  fontSize: number,
  baseline: number,
  cut: number,
): number =>
  Math.max(
    0,
    fontSize * (baseline + clamp(Number.isFinite(cut) ? cut : 0, -0.4, 0.4)),
  );

export type SocialIcon =
  "x" | "linkedin" | "youtube" | "instagram" | "github" | "dribbble";
export type FooterSocial = {
  label: string;
  href?: string;
  icon: SocialIcon | React.ReactNode;
};
export type FooterLink = { label: string; href?: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterCredit = {
  lead?: string;
  label: string;
  href?: string;
  tail?: string;
};
export type BeamWordmarkFooterProps = {
  brand?: string;
  wordmark?: string;
  company?: string;
  year?: number;
  socials?: FooterSocial[];
  credits?: FooterCredit[];
  columns?: FooterColumn[];
  /** Optional event supports SPA navigation without losing session state. */
  onLinkClick?: (
    label: string,
    href?: string,
    event?: React.MouseEvent<HTMLAnchorElement>,
  ) => void;
  cut?: number;
  background?: string;
  ink?: string;
  muted?: string;
  accent?: string;
  wordTop?: string;
  wordFoot?: string;
  fontSans?: string;
  wordWeight?: number;
  animate?: boolean;
  className?: string;
  /** Optional legal notice / actions, retained inside the one footer landmark. */
  children?: React.ReactNode;
};

const DEFAULT_SOCIALS: FooterSocial[] = [
  { label: "X", href: "#", icon: "x" },
  { label: "LinkedIn", href: "#", icon: "linkedin" },
  { label: "YouTube", href: "#", icon: "youtube" },
  { label: "Instagram", href: "#", icon: "instagram" },
];
const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    title: "Our Product",
    links: [
      { label: "Features", href: "#" },
      { label: "Benefits", href: "#" },
      { label: "Pricing", href: "#" },
      { label: "Testimonials", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "#" },
      { label: "FAQ", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];
const SANS =
  '"DM Sans", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const ICONS: Record<SocialIcon, React.ReactNode> = {
  x: (
    <path
      d="M17.6 3.5h2.9l-6.3 7.2 7.4 9.8h-5.8l-4.5-5.9-5.2 5.9H3.2l6.7-7.7L2.8 3.5h5.9l4.1 5.4 4.8-5.4Zm-1 15.3h1.6L7.9 5.1H6.2l10.4 13.7Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  ),
  linkedin: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M8 10.5V16M12 16v-5.5M12 13c0-1.6 1-2.6 2.4-2.6s2.1.9 2.1 2.4V16" />
      <circle cx="8" cy="7.7" r=".55" fill="currentColor" />
    </g>
  ),
  youtube: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      <rect x="2.75" y="5.5" width="18.5" height="13" rx="4" />
      <path d="M10.2 9.3v5.4l4.6-2.7-4.6-2.7Z" />
    </g>
  ),
  instagram: (
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17.1" cy="6.9" r=".6" fill="currentColor" stroke="none" />
    </g>
  ),
  github: (
    <path
      d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  dribbble: (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.6 4.2c3.4 4.4 5.4 9.6 6.1 15.6M3.6 10.6c5.6.3 10.4-1 13.9-4.4M5.6 17.6c3.4-4.2 8.6-5.6 14.8-3.6" />
    </g>
  ),
};
const measureBaseline = (
  family: string,
  weight: number,
  text: string,
): number => {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return 0.8;
    ctx.font = weight + " 100px " + family;
    const m = ctx.measureText(text);
    return baselineAt(m.fontBoundingBoxAscent, m.fontBoundingBoxDescent);
  } catch {
    return 0.8;
  }
};
const isIconName = (v: unknown): v is SocialIcon =>
  typeof v === "string" && Object.hasOwn(ICONS, v);

// Scoped styles preserve the component's portability without host CSS resets.
const CSS = `
.bwf{position:relative;isolation:isolate;overflow:hidden;container-type:inline-size;background:var(--bwf-bg);color:var(--bwf-ink);font-family:var(--bwf-sans);-webkit-font-smoothing:antialiased;touch-action:pan-y}
:where(.bwf) a{color:inherit;text-decoration:none}
:where(.bwf) button{font:inherit;color:inherit;background:none;border:0;padding:0;margin:0;cursor:pointer}
:where(.bwf) ul{list-style:none;margin:0;padding:0}
:where(.bwf) p{margin:0}
.bwf svg{max-width:none;display:block}
.bwf .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.bwf-rule{position:absolute;left:0;right:0;top:0;height:1px;z-index:3;background:linear-gradient(90deg,rgba(var(--bwf-acc),.15),rgba(var(--bwf-acc),.55) var(--bwf-b),rgba(var(--bwf-acc),.15))}
.bwf-sky{position:absolute;inset:0;z-index:0;pointer-events:none}
.bwf-wash{position:absolute;inset:0;background:radial-gradient(120% 90% at 8% 0%,rgba(var(--bwf-acc),.2),transparent 55%),radial-gradient(90% 70% at 92% 8%,rgba(var(--bwf-acc),.14),transparent 60%),linear-gradient(180deg,rgba(var(--bwf-acc),.06),transparent 70%)}
.bwf-bands{position:absolute;inset:0;background:repeating-linear-gradient(90deg,rgba(var(--bwf-acc),.05) 0 1.6cqw,transparent 1.6cqw 4.2cqw);-webkit-mask-image:linear-gradient(100deg,#000 0%,transparent 55%);mask-image:linear-gradient(100deg,#000 0%,transparent 55%);opacity:.9}
.bwf-beam{position:absolute;inset:0;filter:blur(calc(1px + 1.6cqw));background:linear-gradient(var(--bwf-ang),transparent calc(var(--bwf-b) - 11%),rgba(var(--bwf-acc),.10) calc(var(--bwf-b) - 5%),rgba(var(--bwf-acc),.34) var(--bwf-b),rgba(var(--bwf-acc),.08) calc(var(--bwf-b) + 4%),transparent calc(var(--bwf-b) + 9%)),linear-gradient(var(--bwf-ang),transparent calc(var(--bwf-b) - 34%),rgba(var(--bwf-acc),.10) calc(var(--bwf-b) - 27%),transparent calc(var(--bwf-b) - 20%))}
.bwf-glow{position:absolute;inset:0;opacity:var(--bwf-g);background:radial-gradient(circle 26cqw at var(--bwf-px) var(--bwf-py),rgba(var(--bwf-acc),.16),transparent 70%)}
.bwf-grain{position:absolute;inset:0;opacity:.14;mix-blend-mode:overlay;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.bwf-inner{position:relative;z-index:2;box-sizing:border-box;max-width:1120px;margin:0 auto;padding:clamp(48px,8.5cqw,104px) clamp(20px,6cqw,88px) 0;display:grid;grid-template-columns:minmax(0,1.62fr) minmax(0,.86fr) minmax(0,.86fr);column-gap:clamp(24px,4cqw,48px);row-gap:44px}
.bwf-label{font-size:12px;line-height:1.4;letter-spacing:.01em;color:rgb(var(--bwf-acc));padding-bottom:13px;position:relative;display:block}
.bwf-label::after{content:'';position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,rgba(var(--bwf-acc),.55),rgba(var(--bwf-acc),.28));transform-origin:0 50%;transform:scaleX(var(--bwf-line,1));transition:transform 1.1s cubic-bezier(.2,.7,.1,1) var(--bwf-d,0ms)}
.bwf[data-in='false'] .bwf-label::after{--bwf-line:0}
.bwf-col{min-width:0}
.bwf-col:nth-child(1){max-width:420px}
.bwf-fade{transition:opacity .9s ease var(--bwf-d,0ms),translate .9s cubic-bezier(.2,.7,.1,1) var(--bwf-d,0ms)}
.bwf[data-in='false'] .bwf-fade{opacity:0;translate:0 14px}
.bwf-socials{display:flex;flex-wrap:wrap;gap:16px;margin-top:13px}
.bwf-soc{position:relative;width:36px;height:36px;display:grid;place-items:center;border-radius:5px;color:rgba(var(--bwf-ink-rgb),.72);background:linear-gradient(180deg,rgba(var(--bwf-ink-rgb),.09),rgba(var(--bwf-ink-rgb),.025));box-shadow:inset 0 0 0 1px rgba(var(--bwf-ink-rgb),.16),inset 0 1px 0 rgba(var(--bwf-ink-rgb),.14),0 6px 14px -8px rgba(0,0,0,.8);transition:color .25s,box-shadow .35s,translate .35s cubic-bezier(.2,.8,.2,1),background .35s}
.bwf-soc svg{width:17px;height:17px}
.bwf-soc:hover,.bwf-soc:focus-visible{color:var(--bwf-ink);translate:0 -2px;background:linear-gradient(180deg,rgba(var(--bwf-acc),.32),rgba(var(--bwf-acc),.08));box-shadow:inset 0 0 0 1px rgba(var(--bwf-acc),.75),inset 0 1px 0 rgba(var(--bwf-ink-rgb),.3),0 10px 26px -8px rgba(var(--bwf-acc),.75)}
.bwf-soc:focus-visible{outline:2px solid rgb(var(--bwf-acc));outline-offset:4px}
.bwf-tip{position:absolute;z-index:5;left:50%;top:calc(100% + 9px);translate:-50% -4px;white-space:nowrap;font-size:11px;line-height:1;padding:6px 8px;border-radius:4px;background:rgba(var(--bwf-acc),.95);color:var(--bwf-bg);opacity:0;pointer-events:none;transition:opacity .2s,translate .25s}
.bwf-tip::after{content:'';position:absolute;left:50%;bottom:100%;margin-left:-4px;border:4px solid transparent;border-bottom-color:rgba(var(--bwf-acc),.95)}
.bwf-soc:hover .bwf-tip,.bwf-soc:focus-visible .bwf-tip{opacity:1;translate:-50% 0}
.bwf-credits{margin-top:21px;font-size:14px;line-height:1.6;color:var(--bwf-muted)}
.bwf .bwf-credits p{color:var(--bwf-muted)}
.bwf-credits p+p{margin-top:2px}
.bwf-credits b{font-weight:400;color:var(--bwf-ink)}
.bwf-credits a{color:var(--bwf-ink);background:linear-gradient(rgb(var(--bwf-acc)),rgb(var(--bwf-acc))) 0 100%/0 1px no-repeat;transition:background-size .35s cubic-bezier(.2,.8,.2,1),color .25s}
.bwf-credits a:hover,.bwf-credits a:focus-visible{background-size:100% 1px;color:#fff}
.bwf-credits a:focus-visible{outline:2px solid rgb(var(--bwf-acc));outline-offset:4px}
.bwf-links{margin-top:13px;display:flex;flex-direction:column;gap:0}
.bwf-link{position:relative;display:inline-flex;align-items:center;gap:8px;padding:9px 0;font-size:14.5px;line-height:24px;color:rgba(var(--bwf-ink-rgb),.82);transition:color .25s}
.bwf-link-t{display:inline-block;transition:translate .35s cubic-bezier(.2,.8,.2,1)}
.bwf-link::before{content:'';position:absolute;left:0;top:50%;width:6px;height:1px;background:rgb(var(--bwf-acc));transform:scaleX(0);transform-origin:0 50%;transition:transform .35s cubic-bezier(.2,.8,.2,1)}
.bwf-link svg{width:12px;height:12px;opacity:0;translate:-6px 0;color:rgb(var(--bwf-acc));transition:opacity .25s,translate .35s cubic-bezier(.2,.8,.2,1)}
.bwf-link:hover,.bwf-link:focus-visible{color:#fff}
.bwf-link:hover::before,.bwf-link:focus-visible::before{transform:scaleX(1)}
.bwf-link:hover .bwf-link-t,.bwf-link:focus-visible .bwf-link-t{translate:12px 0}
.bwf-link:hover svg,.bwf-link:focus-visible svg{opacity:1;translate:10px 0}
.bwf-link:focus-visible{outline:2px solid rgb(var(--bwf-acc));outline-offset:4px;border-radius:2px}
.bwf-link:focus-visible .bwf-link-t{text-decoration:underline;text-underline-offset:4px;text-decoration-color:rgba(var(--bwf-acc),.8)}
.bwf-extra{position:relative;z-index:2;max-width:1120px;margin:36px auto 0;padding:0 clamp(20px,6cqw,88px)}
.bwf-word{position:relative;z-index:1;overflow:hidden;margin-top:clamp(28px,7cqw,96px)}
.bwf-word-box{padding:0 clamp(20px,6cqw,88px);max-width:1120px;margin:0 auto;box-sizing:border-box}
.bwf-word-in{display:inline-flex;white-space:nowrap;font-weight:var(--bwf-ww);line-height:1;letter-spacing:-.045em;user-select:none;-webkit-user-select:none}
.bwf-lw{display:inline-block;translate:0 0;transition:translate 1.25s cubic-bezier(.16,.84,.2,1) var(--bwf-d,0ms)}
.bwf[data-in='false'] .bwf-lw{translate:0 85%}
.bwf-l{display:inline-block;cursor:pointer;color:transparent;-webkit-background-clip:text;background-clip:text;background-repeat:no-repeat;background-size:var(--bwf-rw) var(--bwf-rh);background-position:calc(var(--bwf-x) * -1) calc(var(--bwf-y) * -1);background-image:radial-gradient(circle 22cqw at var(--bwf-px) var(--bwf-py),rgba(var(--bwf-lit),calc(var(--bwf-g) * .85)),transparent 70%),linear-gradient(var(--bwf-ang),transparent calc(var(--bwf-b) - 9%),rgba(var(--bwf-lit),.55) calc(var(--bwf-b) - 1.5%),rgba(var(--bwf-lit),.7) var(--bwf-b),rgba(var(--bwf-lit),.2) calc(var(--bwf-b) + 3.5%),transparent calc(var(--bwf-b) + 8%)),linear-gradient(180deg,var(--bwf-wt) var(--bwf-top),var(--bwf-wf) var(--bwf-bot));transition:transform .5s cubic-bezier(.2,.9,.25,1.2),filter .4s;transform-origin:50% 100%}
.bwf-l:hover{transform:translateY(-.045em);filter:brightness(1.35) saturate(1.1)}
.bwf-l.is-hop{animation:bwf-hop .75s cubic-bezier(.2,.8,.2,1)}
@keyframes bwf-hop{0%{transform:translateY(0) scale(1,1)}18%{transform:translateY(.02em) scale(1.06,.9)}45%{transform:translateY(-.14em) scale(.97,1.05)}70%{transform:translateY(.01em) scale(1.02,.97)}100%{transform:translateY(-.045em) scale(1,1)}}
.bwf-foot{position:absolute;left:0;right:0;bottom:0;height:34%;z-index:2;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(var(--bwf-bg-rgb),.55) 55%,var(--bwf-bg))}
@container (max-width:760px){.bwf-inner{grid-template-columns:minmax(0,1fr) minmax(0,1fr);row-gap:36px}.bwf-col:nth-child(1){grid-column:1/-1;max-width:none}.bwf-link{font-size:13px;min-height:44px}.bwf-soc{width:44px;height:44px}}
@media (prefers-reduced-motion:reduce){.bwf .bwf-lw,.bwf .bwf-fade,.bwf .bwf-label::after,.bwf .bwf-l,.bwf .bwf-soc,.bwf .bwf-link-t,.bwf .bwf-link svg{transition:none!important;animation:none!important}.bwf[data-in='false'] .bwf-lw,.bwf[data-in='false'] .bwf-fade{translate:none;opacity:1}.bwf[data-in='false'] .bwf-label::after{--bwf-line:1}.bwf .bwf-l:hover{transform:none}}
`;

const Arrow = () => (
  <svg viewBox="0 0 12 12" aria-hidden="true">
    <path
      d="M2.5 9.5l7-7M4 2.5h5.5V8"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function BeamWordmarkFooter({
  brand = "Zephyr",
  wordmark,
  company,
  year = new Date().getFullYear(),
  socials = DEFAULT_SOCIALS,
  credits,
  columns = DEFAULT_COLUMNS,
  onLinkClick,
  cut = 0.14,
  background = "#02040b",
  ink = "#eef1f8",
  muted = "#8a91a6",
  accent = "#3d6bff",
  wordTop = "#1d3fa3",
  wordFoot = "#060b22",
  fontSans = SANS,
  wordWeight = 500,
  animate = true,
  className = "",
  children,
}: BeamWordmarkFooterProps) {
  const word = (wordmark ?? brand).trim() || brand;
  const letters = React.useMemo(() => Array.from(word), [word]);
  const credit = credits ?? [
    {
      lead: brand + " template by ",
      label: "Kedhar",
      href: "https://21st.dev/@kedhareswer",
    },
    { lead: "Part of ", label: "Night Shift", tail: " collection" },
  ];
  const rootRef = React.useRef<HTMLElement>(null);
  const wordRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState(0);
  const [base, setBase] = React.useState(0.8);
  const [seen, setSeen] = React.useState(false);
  const ptr = React.useRef({ u: 0.5, x: 0, y: 0, inside: false });

  React.useLayoutEffect(() => {
    const root = rootRef.current,
      box = wordRef.current,
      inner = innerRef.current;
    if (!root || !box || !inner) return;
    let frame = 0;
    const place = () => {
      const r = root.getBoundingClientRect();
      root.style.setProperty("--bwf-rw", r.width + "px");
      root.style.setProperty("--bwf-rh", r.height + "px");
      const spans = inner.querySelectorAll<HTMLElement>(".bwf-l");
      let top = 0;
      spans.forEach((s, i) => {
        let x = 0,
          y = 0;
        let el: HTMLElement | null = s;
        while (el && el !== root) {
          x += el.offsetLeft;
          y += el.offsetTop;
          el = el.offsetParent as HTMLElement | null;
        }
        s.style.setProperty("--bwf-x", x + "px");
        s.style.setProperty("--bwf-y", y + "px");
        if (i === 0) top = y;
      });
      root.style.setProperty("--bwf-top", top + "px");
      root.style.setProperty(
        "--bwf-bot",
        top + (parseFloat(inner.style.fontSize) || 0) * 0.92 + "px",
      );
    };
    const fit = () => {
      const wb = inner.parentElement ?? box;
      const pad = parseFloat(getComputedStyle(wb).paddingLeft) || 0;
      const target = wb.clientWidth - pad * 2;
      inner.style.fontSize = "100px";
      const measured = inner.offsetWidth;
      setBase(
        measureBaseline(getComputedStyle(inner).fontFamily, wordWeight, word),
      );
      const next = fitSize(measured, target, target * 0.42);
      inner.style.fontSize = next + "px";
      setSize(next);
      place();
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    fit();
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    let alive = true;
    document.fonts?.ready.then(() => alive && schedule());
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [word, fontSans, wordWeight]);

  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      ([e]) => {
        setVisible(e.isIntersecting);
        if (e.isIntersecting) setSeen(true);
      },
      { threshold: 0.12 },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  const [reduced, setReduced] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [documentActive, setDocumentActive] = React.useState(true);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMq = () => setReduced(mq.matches);
    const onVisibility = () => setDocumentActive(!document.hidden);
    onMq();
    onVisibility();
    mq.addEventListener("change", onMq);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mq.removeEventListener("change", onMq);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const painted = new Map<string, string>();
    const set = (b: number, px: number, py: number, g: number) => {
      const values = {
        "--bwf-b": b.toFixed(2) + "%",
        "--bwf-px": px.toFixed(1) + "px",
        "--bwf-py": py.toFixed(1) + "px",
        "--bwf-g": g.toFixed(3),
      };
      Object.entries(values).forEach(([name, value]) => {
        if (painted.get(name) !== value) {
          root.style.setProperty(name, value);
          painted.set(name, value);
        }
      });
    };
    if (reduced || !animate || !visible || !documentActive) {
      const p = ptr.current;
      set(58, p.x, p.y, p.inside ? 1 : 0);
      return;
    }
    let raf = 0,
      last = performance.now(),
      t = last / 1000,
      b = 58;
    let px = ptr.current.x,
      py = ptr.current.y,
      g = 0;
    const tick = (now: number) => {
      // Quiet decorative drift needs fewer paints than active pointer tracking.
      if (now - last < 1000 / (ptr.current.inside ? 60 : 30)) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      t += dt;
      const p = ptr.current,
        idle = drift(t);
      const target = p.inside ? beamTarget(p.u) * 0.75 + idle * 0.25 : idle;
      b = approach(b, target, 0.035, dt);
      px = approach(px, p.x, 0.16, dt);
      py = approach(py, p.y, 0.16, dt);
      g = approach(g, p.inside ? 1 : 0, 0.06, dt);
      set(b, px, py, g);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, animate, visible, documentActive]);

  const onPointer = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect(),
      p = ptr.current;
    p.x = e.clientX - r.left;
    p.y = e.clientY - r.top;
    p.u = r.width ? p.x / r.width : 0.5;
    p.inside = e.type !== "pointerleave";
    // Update after the pointer ref, not from an earlier native listener.
    // This also clears the stationary/reduced-motion glow correctly on leave.
    if (reduced || !animate) {
      e.currentTarget.style.setProperty("--bwf-px", p.x.toFixed(1) + "px");
      e.currentTarget.style.setProperty("--bwf-py", p.y.toFixed(1) + "px");
      e.currentTarget.style.setProperty("--bwf-g", p.inside ? "1" : "0");
    }
  };
  const hop = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (reduced) return;
    const el = e.currentTarget;
    el.classList.remove("is-hop");
    void el.offsetWidth;
    el.classList.add("is-hop");
  };
  const follow = (
    e: React.MouseEvent<HTMLAnchorElement>,
    label: string,
    href?: string,
  ) => {
    if (!href || href === "#") e.preventDefault();
    onLinkClick?.(label, href, e);
  };
  const vars = {
    "--bwf-bg": background,
    "--bwf-bg-rgb": hexToRgb(background, "2, 4, 11"),
    "--bwf-ink": ink,
    "--bwf-ink-rgb": hexToRgb(ink, "238, 241, 248"),
    "--bwf-muted": muted,
    "--bwf-acc": hexToRgb(accent),
    "--bwf-lit": hexToRgb(accent),
    "--bwf-wt": wordTop,
    "--bwf-wf": wordFoot,
    "--bwf-sans": fontSans,
    "--bwf-ww": String(wordWeight),
    "--bwf-ang": "118deg",
    "--bwf-b": "58%",
    "--bwf-px": "50%",
    "--bwf-py": "50%",
    "--bwf-g": "0",
    "--bwf-top": "0px",
    "--bwf-bot": "100%",
  } as React.CSSProperties;
  const label = company ?? brand + " LLC";
  let d = 0;
  const delay = () => ({ "--bwf-d": (d += 70) + "ms" }) as React.CSSProperties;

  return (
    <footer
      ref={rootRef}
      className={"bwf " + className}
      style={vars}
      data-in={seen || reduced ? "true" : "false"}
      onPointerMove={onPointer}
      onPointerEnter={onPointer}
      onPointerLeave={onPointer}
    >
      <style>{CSS}</style>
      <div className="bwf-rule" aria-hidden="true" />
      <div className="bwf-sky" aria-hidden="true">
        <div className="bwf-wash" />
        <div className="bwf-bands" />
        <div className="bwf-beam" />
        <div className="bwf-glow" />
        <div className="bwf-grain" />
      </div>
      <div className="bwf-inner">
        <div className="bwf-col">
          <p className="bwf-label" style={delay()}>
            © {year} {label}
          </p>
          {socials.length > 0 && (
            <ul className="bwf-socials">
              {socials.map((s, i) => (
                <li key={s.label + i} className="bwf-fade" style={delay()}>
                  <a
                    className="bwf-soc"
                    href={s.href || "#"}
                    aria-label={s.label}
                    onClick={(e) => follow(e, s.label, s.href)}
                    {...(s.href && /^https?:/.test(s.href)
                      ? { target: "_blank", rel: "noreferrer" }
                      : {})}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {isIconName(s.icon) ? ICONS[s.icon] : s.icon}
                    </svg>
                    <span className="bwf-tip" aria-hidden="true">
                      {s.label}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          {credit.length > 0 && (
            <div className="bwf-credits">
              {credit.map((c, i) => (
                <p key={i} className="bwf-fade" style={delay()}>
                  {c.lead}
                  {c.href ? (
                    <a
                      href={c.href}
                      onClick={(e) => follow(e, c.label, c.href)}
                      {...(/^https?:/.test(c.href)
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                    >
                      {c.label}
                    </a>
                  ) : (
                    <b>{c.label}</b>
                  )}
                  {c.tail}
                </p>
              ))}
            </div>
          )}
        </div>
        {columns.map((col, ci) => (
          <nav key={col.title + ci} className="bwf-col" aria-label={col.title}>
            <p className="bwf-label" style={delay()}>
              {col.title}
            </p>
            <ul className="bwf-links">
              {col.links.map((l, li) => (
                <li key={l.label + li} className="bwf-fade" style={delay()}>
                  <a
                    className="bwf-link"
                    href={l.href || "#"}
                    onClick={(e) => follow(e, l.label, l.href)}
                  >
                    <span className="bwf-link-t">{l.label}</span>
                    <Arrow />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      {children && <div className="bwf-extra">{children}</div>}
      <div
        ref={wordRef}
        className="bwf-word"
        style={{
          height: size
            ? wordHeight(size, base, cut)
            : "calc(" + (0.8 + cut) * 26 + "cqw)",
        }}
      >
        <p className="sr-only">{word}</p>
        <div className="bwf-word-box">
          <div ref={innerRef} className="bwf-word-in" aria-hidden="true">
            {letters.map((ch, i) => (
              <span
                key={i}
                className="bwf-lw"
                style={
                  { "--bwf-d": 260 + i * 75 + "ms" } as React.CSSProperties
                }
              >
                <span
                  className="bwf-l"
                  onClick={hop}
                  onAnimationEnd={(e) =>
                    e.currentTarget.classList.remove("is-hop")
                  }
                >
                  {ch === " " ? "\u00a0" : ch}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="bwf-foot" aria-hidden="true" />
      </div>
    </footer>
  );
}
