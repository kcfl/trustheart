import type { CSSProperties } from "react";

export const INTRO_DISPLAY =
  '"ABC Gravity", "Anton", "Arial Black", Arial, sans-serif';
export const INTRO_LABEL = '"Space Grotesk", Inter, Arial, sans-serif';

/** This stylesheet is mounted with the component, never imported as a CSS asset. */
export const STARTUP_STYLES = `
@font-face{font-family:"ABC Gravity";src:local("ABC Gravity"),local("ABCGravity-Black"),local("ABCGravity-Heavy");font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:"Anton";src:url("/fonts/anton.woff2") format("woff2");font-weight:400 900;font-style:normal;font-display:swap}
@font-face{font-family:"Space Grotesk";src:url("/fonts/space-grotesk.ttf") format("truetype");font-weight:300 700;font-style:normal;font-display:swap}
.th-startup-preloader,.th-startup-preloader *{box-sizing:border-box}
.th-startup-preloader .startup-wordmark{font-family:${INTRO_DISPLAY}!important;color:#f6f0e4!important}
.th-startup-preloader .rolling-text{transform:scaleX(1.85);transform-origin:center}
.th-startup-preloader .startup-corner span{font-family:${INTRO_LABEL};font-size:8px;letter-spacing:.1em;color:#aca79f;border-left:1px solid #ffffff24;padding-left:16px}
.th-startup-preloader .startup-skip:hover{background:#ffffff08!important;color:#fff9ed!important}
.th-startup-preloader .startup-skip:focus-visible{outline:1px solid #efe7da!important;outline-offset:5px}
@media(max-width:600px){.th-startup-preloader .startup-caption{display:none!important}.th-startup-preloader .startup-scroll{position:static!important;transform:none!important}.th-startup-preloader .startup-corner span{padding-left:10px;font-size:7px}}
@media(max-width:350px){.th-startup-preloader .rolling-text{transform:scaleX(1.80)}}
@media(prefers-reduced-motion:reduce){.th-startup-preloader .rolling-letter-track{transform:none!important;will-change:auto!important}}
`;

export const wordmarkStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  margin: 0,
  padding: "0 16px",
  gap: ".015em",
  fontFamily: INTRO_DISPLAY,
  fontSize: "clamp(60px, min(20vw, 27vh), 244px)",
  fontWeight: 900,
  fontStyle: "normal",
  lineHeight: 1,
  letterSpacing: 0,
  color: "#f6f0e4",
  textAlign: "center",
  transform: "translateY(-2%)",
};
export const cornerStyle: CSSProperties = {
  position: "absolute",
  top: "clamp(20px,3vw,32px)",
  left: "clamp(20px,3vw,40px)",
  display: "flex",
  alignItems: "center",
  gap: "clamp(10px,2vw,18px)",
  fontFamily: INTRO_LABEL,
  fontWeight: 500,
  fontSize: "clamp(9px,1vw,11px)",
  lineHeight: 1.5,
  letterSpacing: ".09em",
  color: "#ebe6dc",
  margin: 0,
};
export const bottomStyle: CSSProperties = {
  position: "absolute",
  bottom: "clamp(20px,3vw,27px)",
  left: "clamp(20px,3vw,40px)",
  right: "clamp(20px,3vw,40px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 15,
  fontFamily: INTRO_LABEL,
  fontWeight: 500,
  fontSize: 9,
  lineHeight: 1.6,
  letterSpacing: ".09em",
  color: "#aaa49b",
};
export const scrollStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontFamily: INTRO_LABEL,
  fontSize: "clamp(7px,1vw,9px)",
  color: "#d1cabf",
  whiteSpace: "nowrap",
};
export const skipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  minHeight: 44,
  padding: "10px 14px",
  margin: "0 0 0 auto",
  appearance: "none",
  border: "1px solid #ffffff25",
  borderRadius: 8,
  background: "transparent",
  color: "#e2dbce",
  fontFamily: INTRO_LABEL,
  fontWeight: 500,
  fontSize: "clamp(10px,1vw,12px)",
  lineHeight: 1.5,
  letterSpacing: 0,
  cursor: "pointer",
  whiteSpace: "nowrap",
  touchAction: "manipulation",
};
export const screenReaderStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};
