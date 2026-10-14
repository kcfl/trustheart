"use client";

import * as React from "react";

/** Supplied Halftone Nebula: one raw-WebGL2 fragment pass, no textures or assets. */
export type NebulaParams = {
  pixel: number;
  dotMin: number;
  dotMax: number;
  levels: number;
  scale: number;
  warp: number;
  drift: number;
  density: number;
  threshold: number;
  softness: number;
  band: number;
  bandAngle: number;
  bandOffset: number;
  bandWidth: number;
  haze: number;
  stars: number;
  twinkle: number;
  starDrift: number;
  sparkles: number;
  seed: number;
  spikeWidth: number;
  planet: boolean;
  planetX: number;
  planetY: number;
  planetRadius: number;
  parallax: number;
  lens: number;
  lensRadius: number;
  lensPush: number;
  rippleSpeed: number;
  speed: number;
  vignette: number;
  grain: number;
  voidColor: string;
  hazeColor: string;
  duskColor: string;
  wineColor: string;
  crimsonColor: string;
  hotColor: string;
  starColor: string;
};
export const NEBULA_DEFAULTS: NebulaParams = {
  pixel: 6,
  dotMin: 0.12,
  dotMax: 0.56,
  levels: 7,
  scale: 1.7,
  warp: 1.5,
  drift: 0.035,
  density: 0.5,
  threshold: 0.54,
  softness: 0.5,
  band: 0.5,
  bandAngle: 1.05,
  bandOffset: 0.42,
  bandWidth: 0.34,
  haze: 0.8,
  stars: 1,
  twinkle: 1.4,
  starDrift: 1.2,
  sparkles: 9,
  seed: 11,
  spikeWidth: 1,
  planet: true,
  planetX: 0.26,
  planetY: 0.36,
  planetRadius: 0.075,
  parallax: 1,
  lens: 0.55,
  lensRadius: 170,
  lensPush: 0.3,
  rippleSpeed: 420,
  speed: 1,
  vignette: 0.5,
  grain: 0.035,
  voidColor: "#050309",
  hazeColor: "#161a38",
  duskColor: "#3b1646",
  wineColor: "#5c0d31",
  crimsonColor: "#c01245",
  hotColor: "#ff1f5a",
  starColor: "#f6e2e8",
};
export const NEBULA_PRESETS: Record<string, Partial<NebulaParams>> = {
  crimson: {},
  ultraviolet: {
    hazeColor: "#10183f",
    duskColor: "#2a1a5e",
    wineColor: "#3d1478",
    crimsonColor: "#7b2cf0",
    hotColor: "#c77dff",
    starColor: "#eef0ff",
    bandAngle: 2.2,
    bandOffset: 0.3,
    planetX: 0.74,
    planetY: 0.3,
    seed: 4,
  },
  abyssal: {
    voidColor: "#02060a",
    hazeColor: "#0a1f2e",
    duskColor: "#0d2f3f",
    wineColor: "#0a4453",
    crimsonColor: "#0f8f9f",
    hotColor: "#3ff2e0",
    starColor: "#e4fffb",
    band: 0.5,
    bandAngle: -0.4,
    bandOffset: -0.2,
    planetX: 0.7,
    planetY: 0.66,
    seed: 23,
  },
  solar: {
    voidColor: "#070403",
    hazeColor: "#231208",
    duskColor: "#3d1a07",
    wineColor: "#6e2406",
    crimsonColor: "#d8520c",
    hotColor: "#ffb020",
    starColor: "#fff3d6",
    warp: 1.9,
    band: 0.72,
    bandAngle: 0.4,
    planetRadius: 0.1,
    seed: 5,
  },
  phosphor: {
    voidColor: "#020502",
    hazeColor: "#08170c",
    duskColor: "#0c2412",
    wineColor: "#0e3d18",
    crimsonColor: "#1f9d3a",
    hotColor: "#6dff7a",
    starColor: "#e6ffe8",
    pixel: 5,
    levels: 5,
    planet: false,
    sparkles: 6,
    seed: 31,
  },
};
const MAX_SPARKS = 16,
  MAX_RIPPLES = 4;
type Kind = "f" | "i" | "b" | "c";
type Slot = [keyof NebulaParams, Kind];
const UNIFORMS: Slot[] = [
  ["pixel", "f"],
  ["dotMin", "f"],
  ["dotMax", "f"],
  ["levels", "f"],
  ["scale", "f"],
  ["warp", "f"],
  ["drift", "f"],
  ["density", "f"],
  ["threshold", "f"],
  ["softness", "f"],
  ["band", "f"],
  ["bandAngle", "f"],
  ["bandOffset", "f"],
  ["bandWidth", "f"],
  ["haze", "f"],
  ["stars", "f"],
  ["twinkle", "f"],
  ["starDrift", "f"],
  ["spikeWidth", "f"],
  ["parallax", "f"],
  ["lens", "f"],
  ["lensRadius", "f"],
  ["lensPush", "f"],
  ["rippleSpeed", "f"],
  ["vignette", "f"],
  ["grain", "f"],
  ["voidColor", "c"],
  ["hazeColor", "c"],
  ["duskColor", "c"],
  ["wineColor", "c"],
  ["crimsonColor", "c"],
  ["hotColor", "c"],
  ["starColor", "c"],
];
const uName = (k: string) => "u" + k[0].toUpperCase() + k.slice(1);
const glslType = (kind: Kind) =>
  kind === "c" ? "vec3" : kind === "i" || kind === "b" ? "int" : "float";
const declare = (slots: Slot[]) =>
  slots
    .map(([k, kind]) => "uniform " + glslType(kind) + " " + uName(k) + ";")
    .join("\n");
const VERT = `#version 300 es
void main(){
 vec2 p=vec2(float((gl_VertexID << 1) & 2),float(gl_VertexID & 2));
 gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;
const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uPointer;
uniform float uPointerOn;
uniform vec2 uLook;
uniform int uSparkCount;
uniform vec4 uSpark[${MAX_SPARKS}];
uniform vec4 uSparkB[${MAX_SPARKS}];
uniform vec4 uRipple[${MAX_RIPPLES}];
uniform vec4 uPlanet;
${declare(UNIFORMS)}
out vec4 frag;
float hash12(vec2 p){
 vec3 p3=fract(vec3(p.xyx)*0.1031);
 p3+=dot(p3,p3.yzx+33.33);
 return fract((p3.x+p3.y)*p3.z);
}
float vnoise(vec2 p){
 vec2 i=floor(p),f=fract(p);
 f=f*f*(3.0-2.0*f);
 float a=hash12(i),b=hash12(i+vec2(1.0,0.0));
 float c=hash12(i+vec2(0.0,1.0)),d=hash12(i+vec2(1.0,1.0));
 return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}
float fbm(vec2 p){
 float s=0.0,a=0.5;
 mat2 r=mat2(0.8,-0.6,0.6,0.8);
 for(int i=0;i<5;i++){s+=a*vnoise(p);p=r*p*2.03+17.1;a*=0.5;}
 return s/0.96875;
}
float bayer4(vec2 c){
 vec2 m=mod(c,4.0);int i=int(m.x)+int(m.y)*4;
 int b[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
 return (float(b[i])+0.5)/16.0;
}
vec3 ramp(float d,vec3 haze){
 vec3 c=mix(uVoidColor,haze,smoothstep(0.0,0.22,d));
 c=mix(c,uWineColor,smoothstep(0.18,0.44,d));
 c=mix(c,uCrimsonColor,smoothstep(0.42,0.72,d));
 return mix(c,uHotColor,smoothstep(0.7,0.96,d));
}
vec2 shift(float depth){return floor(uLook*uParallax*depth*28.0);}
vec3 field(vec2 pos,vec2 resCss){
 float minSide=min(resCss.x,resCss.y);
 vec2 uv=(pos-0.5*resCss)/minSide;
 vec2 p=uv*uScale+uLook*uParallax*0.05;
 vec2 toP=pos-uPointer;
 float lamp=exp(-dot(toP,toP)/(uLensRadius*uLensRadius))*uPointerOn;
 p+=toP/minSide*lamp*uLensPush*uScale;
 float ring=0.0;
 for(int i=0;i<${MAX_RIPPLES};i++){
  vec4 r=uRipple[i];float age=uTime-r.z;
  if(r.w<=0.0||age<0.0||age>2.4)continue;
  vec2 dv=pos-r.xy;float dist=length(dv);float w=14.0+age*26.0;
  float k=exp(-pow((dist-age*uRippleSpeed)/w,2.0))*(1.0-age/2.4)*r.w;
  ring+=k;p+=dv/max(dist,1.0)*k*0.12;
 }
 float t=uTime*uDrift;
 vec2 q=vec2(fbm(p+vec2(0.0,t*0.7)),fbm(p+vec2(5.2,1.3)-t*0.5));
 float n=fbm(p+uWarp*q+vec2(t*0.4,-t*0.25));
 vec2 dir=vec2(cos(uBandAngle),sin(uBandAngle));
 float along=dot(uv,dir);
 float across=dot(uv,vec2(-dir.y,dir.x))-uBandOffset-0.22*sin(along*2.3+t*3.0)-(q.x-0.5)*0.35;
 float river=exp(-across*across/(uBandWidth*uBandWidth));
 float raw=n+river*uBand*0.5+(uDensity-0.5)*0.5;
 float d=smoothstep(uThreshold,uThreshold+uSoftness,raw);
 d=clamp(d+lamp*uLens*0.45+ring*0.55,0.0,1.0);
 for(int i=0;i<${MAX_SPARKS};i++){
  if(i>=uSparkCount)break;
  vec4 s=uSpark[i],b=uSparkB[i];
  float grow=smoothstep(0.0,0.6,uTime-s.w);
  float dist=length(pos-s.xy-shift(1.2));
  d+=exp(-dist/max(b.w*2.2*(1.0+b.z*0.6),1.0))*0.55*grow;
 }
 float hz=smoothstep(0.25,0.75,n+river*0.25)*uHaze;
 float tone=fbm(p*0.45+vec2(11.0,-3.0)+t*0.2);
 return vec3(clamp(d,0.0,1.0),hz,tone);
}
void main(){
 vec2 resCss=uRes/uDpr,css=gl_FragCoord.xy/uDpr;
 float px=max(uPixel,1.0);
 vec2 cell=floor(css/px),cellC=(cell+0.5)*px,f=fract(css/px)-0.5;
 float L=max(uLevels,2.0),dith=bayer4(cell);
 vec3 g=field(cellC,resCss);
 vec3 hazeCol=mix(uHazeColor,uDuskColor,smoothstep(0.38,0.62,g.z));
 float dq=clamp(floor(g.x*L+dith)/L,0.0,1.0),hq=floor(g.y*3.0+dith)/3.0;
 vec3 bg=mix(uVoidColor,hazeCol,hq*0.7);
 bg=mix(bg,ramp(dq*0.7,hazeCol)*0.42,smoothstep(0.0,0.3,dq));
 float r=mix(uDotMin,uDotMax,sqrt(dq));
 float dotMask=step(length(f),r);
 vec3 dotCol=dq<0.01?mix(uVoidColor,hazeCol,0.35+hq*0.5):ramp(min(dq+0.1,1.0),hazeCol);
 vec3 col=mix(bg,dotCol,dotMask);
 vec3 starAcc=vec3(0.0);float starA=0.0;
 for(int l=0;l<3;l++){
  float fl=float(l),depth=0.3+fl*0.4,gpx=px*(l==2?2.0:1.0);
  vec2 sp=css+shift(depth)+vec2(0.0,floor(uTime*uStarDrift*depth));
  vec2 id=floor(sp/gpx),fr=fract(sp/gpx)-0.5;
  float prob=uStars*(l==0?0.009:l==1?0.014:0.01),h=hash12(id+fl*71.3);
  if(h>1.0-prob){
   float h2=hash12(id*1.7+3.1+fl);
   float tw=0.45+0.55*(0.5+0.5*sin(uTime*uTwinkle*(0.6+h2*2.5)+h2*40.0));
   float rad=l==2?0.42:0.26+h2*0.22,m=step(length(fr),rad);
   vec3 c=(l==0||h2>0.82)?uStarColor:uHotColor;
   starAcc=max(starAcc,c*m*tw);starA=max(starA,m*tw);
  }
 }
 col=mix(col,starAcc/max(starA,1e-3),starA*(1.0-g.x*0.55));
 if(uPlanet.w>0.5){
  vec2 pc=uPlanet.xy+shift(0.8);float R=uPlanet.z;vec2 dc=cellC-pc;
  if(length(dc)<R){
   vec2 n2=dc/R;float z=sqrt(max(1.0-dot(n2,n2),0.0));
   float lit=clamp(dot(vec3(n2,z),normalize(vec3(-0.45,0.55,0.7))),0.0,1.0);
   float surf=fbm(vec2(n2.x*1.4+uTime*0.015,n2.y*4.2)*1.6+9.0);
   float pd=clamp(lit*1.05-smoothstep(0.55,0.75,surf)*0.45*(1.0-lit*0.5)+0.05,0.0,1.0);
   float pq=floor(pd*L+dith)/L;
   vec3 pbg=mix(mix(uVoidColor,uWineColor,0.35),uWineColor,pq);
   float pr=mix(0.2,0.62,sqrt(pq));vec3 pdot=ramp(min(pq*0.85+0.25,1.0),hazeCol);
   col=mix(pbg,pdot,step(length(f),pr));
  }
 }
 vec2 sh=shift(1.2);
 for(int i=0;i<${MAX_SPARKS};i++){
  if(i>=uSparkCount)break;
  vec4 s=uSpark[i],b=uSparkB[i];float age=uTime-s.w;if(age<0.0)continue;
  float grow=smoothstep(0.0,0.55,age)*(1.0+0.3*exp(-age*3.0)*sin(age*13.0));
  float tw=0.84+0.16*sin(uTime*uTwinkle*1.7+b.y),flare=1.0+b.z*0.6;
  float reach=s.z*grow*tw*flare,core=b.w*grow*flare;
  vec3 tint=mix(uHotColor,uStarColor,b.x);vec2 c=s.xy+sh,d=css-c;
  float th=uSpikeWidth*0.5+0.25;
  float hx=step(abs(d.y),th)*pow(max(1.0-abs(d.x)/max(reach,1.0),0.0),1.1);
  float vy=step(abs(d.x),th)*pow(max(1.0-abs(d.y)/max(reach,1.0),0.0),1.1);
  vec2 rd=vec2(d.x+d.y,d.x-d.y)*0.7071;
  float diag=step(0.5,core/px-1.5)*0.45*max(step(abs(rd.y),th)*pow(max(1.0-abs(rd.x)/max(reach*0.22,1.0),0.0),2.0),step(abs(rd.x),th)*pow(max(1.0-abs(rd.y)/max(reach*0.22,1.0),0.0),2.0));
  col=mix(col,tint,clamp(max(max(hx,vy),diag),0.0,1.0));
  float hp=px*0.5;vec2 dcell=(floor(css/hp)+0.5)*hp-(floor(c/hp)+0.5)*hp;
  float disc=step(length(dcell),core),glow=exp(-length(d)/max(core*1.4,1.0))*(1.0-disc);
  col+=tint*glow*0.35;col=mix(col,tint,disc);
  float cross=max(step(abs(d.y),th)*step(abs(d.x),core*0.85),step(abs(d.x),th)*step(abs(d.y),core*0.85));
  col=mix(col,uStarColor,cross*disc*0.9);
 }
 vec2 vu=gl_FragCoord.xy/uRes-0.5;
 col*=1.0-uVignette*smoothstep(0.35,0.95,length(vu*vec2(uRes.x/uRes.y,1.0)*1.1));
 col+=(hash12(floor(css)+fract(uTime)*91.0)-0.5)*uGrain;
 frag=vec4(max(col,vec3(0.0)),1.0);
}`;

export type Sparkle = {
  x: number;
  y: number;
  reach: number;
  core: number;
  tint: number;
  phase: number;
  born: number;
  user: boolean;
};
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function layoutSparkles(seed: number, count: number): Sparkle[] {
  const rand = mulberry32(seed),
    out: Sparkle[] = [];
  const n = Math.max(0, Math.min(Math.floor(count), MAX_SPARKS));
  for (let i = 0; i < n; i++) {
    const hero = i === 0,
      pale = i === 1;
    let x = 0.5,
      y = 0.5;
    for (let tries = 0; tries < 40; tries++) {
      x = 0.08 + 0.84 * rand();
      y = hero ? 0.58 + 0.28 * rand() : 0.08 + 0.84 * rand();
      if (out.every((s) => Math.hypot(s.x - x, s.y - y) > (hero ? 0.2 : 0.13)))
        break;
    }
    out.push({
      x,
      y,
      reach: hero
        ? 0.2 + 0.05 * rand()
        : pale
          ? 0.08 + 0.03 * rand()
          : 0.025 + 0.055 * rand(),
      core: hero ? 0.024 : pale ? 0.011 : 0.004 + 0.006 * rand(),
      tint: pale ? 1 : 0,
      phase: rand() * 6.283,
      born: -10,
      user: false,
    });
  }
  return out;
}
export function pushSparkle(
  list: Sparkle[],
  next: Sparkle,
  max = MAX_SPARKS,
): Sparkle[] {
  if (list.length < max) return [...list, next];
  const oldest = list.findIndex((s) => s.user);
  if (oldest === -1) return list;
  return [...list.slice(0, oldest), ...list.slice(oldest + 1), next];
}
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
  const v = parseInt(h, 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}
export function driftPos(t: number) {
  const x = 0.5 + 0.32 * Math.sin(t * 0.21) + 0.1 * Math.sin(t * 0.077 + 1.3),
    y = 0.5 + 0.26 * Math.cos(t * 0.17) + 0.12 * Math.cos(t * 0.053 + 4.2);
  return [Math.min(Math.max(x, 0.05), 0.95), Math.min(Math.max(y, 0.05), 0.95)];
}

export type HalftoneNebulaProps = {
  height?: string;
  preset?: keyof typeof NEBULA_PRESETS;
  params?: Partial<NebulaParams>;
  interactive?: boolean;
  touch?: "scroll" | "draw";
  maxDpr?: number;
  children?: React.ReactNode;
  className?: string;
  /** Host accessibility/performance controls. These do not modify the sky data. */
  paused?: boolean;
  maxFps?: number;
  /** Yield decorative GPU work during input/scroll and adapt on overloaded devices. */
  performanceAware?: boolean;
  onPerformancePause?: () => void;
};
export default function HalftoneNebula({
  height = "100svh",
  preset = "crimson",
  params,
  interactive = true,
  touch = "scroll",
  maxDpr = 2,
  children,
  className = "",
  paused = false,
  maxFps = 30,
  performanceAware = false,
  onPerformancePause,
}: HalftoneNebulaProps) {
  const rootRef = React.useRef<HTMLElement>(null),
    canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = React.useState(false),
    [ready, setReady] = React.useState(false),
    [generation, setGeneration] = React.useState(0);
  const [reduced, setReduced] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const repaint = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const P = React.useMemo<NebulaParams>(
    () => ({
      ...NEBULA_DEFAULTS,
      ...(NEBULA_PRESETS[preset] ?? {}),
      ...(params ?? {}),
    }),
    [preset, params],
  );
  const paramsRef = React.useRef(P);
  paramsRef.current = P;
  const still = reduced || paused;
  const stillRef = React.useRef(still);
  stillRef.current = still;
  const performancePauseRef = React.useRef(onPerformancePause);
  performancePauseRef.current = onPerformancePause;
  const motionControl = React.useRef<(() => void) | null>(null);
  React.useEffect(() => {
    const root = rootRef.current,
      canvas = canvasRef.current;
    if (!root || !canvas) return;
    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        depth: false,
        powerPreference: "low-power",
      });
    } catch {
      setFailed(true);
      return;
    }
    if (!gl) {
      setFailed(true);
      return;
    }
    // Keep the canvas mounted on failure/context loss, allowing context restoration.
    const context = gl;
    const compile = (type: number, src: string) => {
      const s = context.createShader(type);
      if (!s) return null;
      context.shaderSource(s, src);
      context.compileShader(s);
      if (!context.getShaderParameter(s, context.COMPILE_STATUS)) {
        context.deleteShader(s);
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT),
      fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const program = vs && fs ? gl.createProgram() : null;
    if (!program || !vs || !fs) {
      if (vs) gl.deleteShader(vs);
      if (fs) gl.deleteShader(fs);
      if (program) gl.deleteProgram(program);
      setFailed(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      setFailed(true);
      return;
    }
    const vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(program);
      setFailed(true);
      return;
    }
    const loc = (n: string) => context.getUniformLocation(program, n);
    const tuned = UNIFORMS.map(
      ([k, kind]) => [loc(uName(k)), k, kind] as const,
    );
    const U = {
      res: loc("uRes"),
      dpr: loc("uDpr"),
      time: loc("uTime"),
      pointer: loc("uPointer"),
      pointerOn: loc("uPointerOn"),
      look: loc("uLook"),
      sparkCount: loc("uSparkCount"),
      spark: loc("uSpark[0]"),
      sparkB: loc("uSparkB[0]"),
      ripple: loc("uRipple[0]"),
      planet: loc("uPlanet"),
    };
    let cssW = 1,
      cssH = 1,
      dpr = 1,
      raf = 0,
      visible = true,
      lost = false,
      interacting = false,
      budgetPaused = false,
      idleTimer = 0,
      slowFrames = 0;
    let sparks = layoutSparkles(
        paramsRef.current.seed,
        paramsRef.current.sparkles,
      ),
      laidOut = paramsRef.current.seed + ":" + paramsRef.current.sparkles;
    const flare = new Float32Array(MAX_SPARKS),
      sparkA = new Float32Array(MAX_SPARKS * 4),
      sparkB = new Float32Array(MAX_SPARKS * 4),
      ripples = new Float32Array(MAX_RIPPLES * 4);
    let rippleNext = 0,
      lastClock = 0;
    let lastTime = performance.now(),
      skyTime = 14;
    const clock = () => {
      const now = performance.now();
      if (
        !stillRef.current &&
        !interacting &&
        !budgetPaused &&
        visible &&
        !document.hidden
      )
        skyTime +=
          Math.min((now - lastTime) / 1000, 0.1) * paramsRef.current.speed;
      lastTime = now;
      return skyTime;
    };
    let targetX = 0.5,
      targetY = 0.5,
      lampX = 0.5,
      lampY = 0.5,
      lookX = 0,
      lookY = 0,
      lampOn = 0,
      inside = false,
      lastTouched = -1e9;
    const toUv = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return [
        Math.min(Math.max((e.clientX - r.left) / Math.max(r.width, 1), 0), 1),
        Math.min(
          Math.max(1 - (e.clientY - r.top) / Math.max(r.height, 1), 0),
          1,
        ),
      ];
    };
    const onMove = (e: PointerEvent) => {
      if (!interactive) return;
      [targetX, targetY] = toUv(e);
      inside = true;
      lastTouched = performance.now() / 1000;
    };
    const onLeave = () => {
      inside = false;
    };
    let paintedParams: NebulaParams | null = null;
    const paint = () => {
      if (lost) return;
      paintedParams = paramsRef.current;
      const p = paramsRef.current,
        key = p.seed + ":" + p.sparkles;
      if (key !== laidOut) {
        sparks = [
          ...layoutSparkles(p.seed, p.sparkles),
          ...sparks.filter((s) => s.user),
        ].slice(0, MAX_SPARKS);
        laidOut = key;
      }
      const t = clock(),
        dt = Math.min(Math.max(t - lastClock, 0), 0.1);
      lastClock = t;
      const idle = !inside || performance.now() / 1000 - lastTouched > 6;
      const [gx, gy] = driftPos(t * 0.6),
        wantX = idle ? gx : targetX,
        wantY = idle ? gy : targetY,
        k = stillRef.current ? 1 : 1 - Math.exp(-dt * (idle ? 1.5 : 7));
      lampX += (wantX - lampX) * k;
      lampY += (wantY - lampY) * k;
      lookX += ((wantX - 0.5) * 2 - lookX) * k;
      lookY += ((wantY - 0.5) * 2 - lookY) * k;
      const onTarget = interactive && !stillRef.current ? (idle ? 0.55 : 1) : 0;
      lampOn +=
        (onTarget - lampOn) * (stillRef.current ? 1 : 1 - Math.exp(-dt * 3));
      const minSide = Math.min(cssW, cssH),
        n = Math.min(sparks.length, MAX_SPARKS);
      for (let i = 0; i < n; i++) {
        const s = sparks[i],
          reach = s.reach * minSide,
          d = Math.hypot(s.x * cssW - lampX * cssW, s.y * cssH - lampY * cssH),
          want =
            interactive && !stillRef.current
              ? Math.exp(-(d * d) / Math.max(reach * reach * 0.6, 400))
              : 0;
        flare[i] +=
          (want - flare[i]) * (stillRef.current ? 1 : 1 - Math.exp(-dt * 6));
        sparkA.set([s.x * cssW, s.y * cssH, reach, s.born], i * 4);
        sparkB.set(
          [s.tint, s.phase, flare[i], Math.max(s.core * minSide, 1.5)],
          i * 4,
        );
      }
      context.useProgram(program);
      context.bindVertexArray(vao);
      context.bindFramebuffer(context.FRAMEBUFFER, null);
      context.viewport(0, 0, canvas.width, canvas.height);
      for (const [l, key, kind] of tuned) {
        const v = p[key];
        if (kind === "c") context.uniform3fv(l, hexToRgb(v as string));
        else if (kind === "i" || kind === "b")
          context.uniform1i(l, Number(v) | 0);
        else context.uniform1f(l, v as number);
      }
      context.uniform2f(U.res, canvas.width, canvas.height);
      context.uniform1f(U.dpr, canvas.width / cssW);
      context.uniform1f(U.time, t);
      context.uniform2f(U.pointer, lampX * cssW, lampY * cssH);
      context.uniform1f(U.pointerOn, lampOn);
      context.uniform2f(U.look, lookX, lookY);
      context.uniform1i(U.sparkCount, n);
      context.uniform4fv(U.spark, sparkA);
      context.uniform4fv(U.sparkB, sparkB);
      context.uniform4fv(U.ripple, ripples);
      context.uniform4f(
        U.planet,
        p.planetX * cssW,
        p.planetY * cssH,
        p.planetRadius * minSide,
        p.planet ? 1 : 0,
      );
      context.drawArrays(context.TRIANGLES, 0, 3);
    };
    repaint.current = () => {
      if (paintedParams !== paramsRef.current) paint();
    };
    let previousWidth = 0,
      previousHeight = 0;
    const resize = () => {
      const limit =
        performanceAware && innerWidth < 768 ? Math.min(maxDpr, 0.5) : maxDpr;
      dpr = Math.min(window.devicePixelRatio || 1, Math.max(limit, 0.35));
      cssW = Math.max(canvas.clientWidth, 1);
      cssH = Math.max(canvas.clientHeight, 1);
      const w = Math.floor(cssW * dpr),
        h = Math.floor(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      // A ResizeObserver's first delivery often has the exact initial size.
      // Avoid an extra expensive draw unless dimensions genuinely changed.
      if (w !== previousWidth || h !== previousHeight) {
        previousWidth = w;
        previousHeight = h;
        paint();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!interactive || e.button > 0) return;
      if (
        (e.target as HTMLElement | null)?.closest(
          "a,button,input,textarea,select,label,[role=button]",
        )
      )
        return;
      const [x, y] = toUv(e);
      targetX = x;
      targetY = y;
      inside = true;
      lastTouched = performance.now() / 1000;
      const now = clock(),
        rand = Math.random();
      sparks = pushSparkle(sparks, {
        x,
        y,
        reach: 0.045 + 0.08 * rand,
        core: 0.006 + 0.008 * rand,
        tint: Math.random() < 0.2 ? 1 : 0,
        phase: Math.random() * 6.283,
        born: stillRef.current ? now - 10 : now,
        user: true,
      });
      ripples.set(
        [x * cssW, y * cssH, now, stillRef.current ? 0 : 1],
        rippleNext * 4,
      );
      rippleNext = (rippleNext + 1) % MAX_RIPPLES;
      if (stillRef.current) paint();
    };
    let lastFrame = 0;
    const activity = () => {
      root.dataset.nebulaActivity = budgetPaused
        ? "budget-paused"
        : stillRef.current
          ? "paused"
          : interacting
            ? "interaction-paused"
            : "running";
    };
    const frame = (now: number) => {
      raf = 0;
      if (
        lost ||
        !visible ||
        document.hidden ||
        stillRef.current ||
        interacting ||
        budgetPaused
      )
        return;
      const gap = now - lastFrame;
      if (gap >= 1000 / Math.max(1, maxFps)) {
        // This is a load signal, not a hardware/FPS promise. Prefer a still
        // original sky over repeatedly missing interaction frames.
        if (performanceAware && lastFrame && gap > Math.max(150, 2500 / maxFps))
          slowFrames++;
        else slowFrames = Math.max(0, slowFrames - 1);
        if (slowFrames >= 3) {
          budgetPaused = true;
          activity();
          performancePauseRef.current?.();
          return;
        }
        paint();
        lastFrame = now;
      }
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      activity();
      if (
        stillRef.current ||
        interacting ||
        budgetPaused ||
        document.hidden ||
        !visible ||
        lost
      ) {
        cancelAnimationFrame(raf);
        raf = 0;
        lastTime = performance.now();
        return;
      }
      if (!raf) {
        lastFrame = 0;
        lastTime = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    // Pausing changes the schedule, not the WebGL program or canvas.
    motionControl.current = () => {
      budgetPaused = false;
      slowFrames = 0;
      wake();
    };
    const yieldToInteraction = () => {
      if (!performanceAware) return;
      interacting = true;
      window.clearTimeout(idleTimer);
      wake();
      idleTimer = window.setTimeout(() => {
        interacting = false;
        wake();
      }, 200);
    };
    const interactionEvents = [
      "scroll",
      "wheel",
      "touchmove",
      "input",
      "pointerdown",
    ] as const;
    if (performanceAware)
      interactionEvents.forEach((name) =>
        window.addEventListener(name, yieldToInteraction, { passive: true }),
      );
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cancelAnimationFrame(raf);
      raf = 0;
      setFailed(true);
      setReady(false);
    };
    const onRestored = () => {
      setFailed(false);
      setGeneration((g) => g + 1);
    };
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerdown", onDown);
    root.addEventListener("pointerleave", onLeave);
    root.addEventListener("pointercancel", onLeave);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      wake();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", wake);
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    setFailed(false);
    setReady(true);
    wake();
    return () => {
      repaint.current = null;
      motionControl.current = null;
      window.clearTimeout(idleTimer);
      if (performanceAware)
        interactionEvents.forEach((name) =>
          window.removeEventListener(name, yieldToInteraction),
        );
      delete root.dataset.nebulaActivity;
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", wake);
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerdown", onDown);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("pointercancel", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      context.deleteVertexArray(vao);
      context.deleteProgram(program);
    };
  }, [interactive, generation, maxDpr, maxFps, performanceAware]);
  React.useEffect(() => {
    motionControl.current?.();
  }, [still]);
  React.useEffect(() => {
    repaint.current?.();
  }, [P]);
  return (
    <section
      ref={rootRef}
      className={
        "relative w-full overflow-hidden " +
        (interactive ? "cursor-crosshair " : "") +
        (touch === "draw" ? "touch-none " : "touch-pan-y ") +
        className
      }
      style={{ height, background: P.voidColor }}
      aria-label="A pixel-art nebula printed in halftone dots"
      data-nebula-state={failed ? "fallback" : ready ? "ready" : "loading"}
      data-nebula-motion={still ? "still" : "animated"}
    >
      <div
        className="absolute inset-0"
        data-nebula-fallback=""
        style={{
          background: `radial-gradient(60% 45% at 12% 88%, ${P.hotColor} 0%, ${P.crimsonColor} 22%, ${P.wineColor} 50%, transparent 75%),radial-gradient(45% 30% at 22% 22%, ${P.wineColor} 0%, transparent 70%),radial-gradient(40% 30% at 80% 30%, ${P.duskColor} 0%, transparent 70%),${P.voidColor}`,
          opacity: failed || !ready ? 1 : 0,
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 block h-full w-full"
        style={{ opacity: failed ? 0 : 1 }}
      />
      {children ? (
        <div className="pointer-events-none relative z-10 flex h-full w-full flex-col">
          {children}
        </div>
      ) : null}
    </section>
  );
}
