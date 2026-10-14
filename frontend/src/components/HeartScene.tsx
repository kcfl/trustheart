import { useEffect, useRef, useState } from "react";
import { useStartupIntro } from "@/components/StartupPreloader";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
gsap.registerPlugin(ScrollTrigger);
import {
  Pause,
  Play,
  RotateCcw,
  Box,
  Image as ImageIcon,
  MoveUpRight,
} from "lucide-react";

export default function HeartScene({ compact = false }: { compact?: boolean }) {
  const { active: introActive } = useStartupIntro();
  const introActiveRef = useRef(introActive);
  introActiveRef.current = introActive;
  const mount = useRef<HTMLDivElement>(null);
  const renderControl = useRef<(() => void) | null>(null);
  useEffect(() => {
    renderControl.current?.();
  }, [introActive]);
  const actions = useRef<{
    rotate: (x: boolean) => void;
    wire: (x: boolean) => void;
    reset: () => void;
  } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rotating, setRotating] = useState(false);
  const [wire, setWire] = useState(false);
  const [staticMode, setStaticMode] = useState(false);
  useEffect(() => {
    const initialize = () => {
      const host = mount.current;
      if (!host || staticMode) return;
      let dirty = true;
      let requestRender = () => {};
      const invalidate = () => {
        dirty = true;
        requestRender();
      };
      let manualView = false;
      let pageScrolling = false,
        scrollIdle = 0;
      const lowPower =
        matchMedia("(pointer: coarse)").matches ||
        (navigator.hardwareConcurrency > 0 &&
          navigator.hardwareConcurrency <= 4);
      let positioned = false;
      let rig: THREE.Group | null = null;
      const scrollMotion = gsap.matchMedia();
      let disposed = false,
        frame = 0,
        visible = true,
        model: THREE.Group | null = null;
      let renderer: THREE.WebGLRenderer;
      const searchParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const isTestE2E =
        Boolean(searchParams?.has("e2e")) ||
        Boolean(
          typeof window !== "undefined" &&
            (window as unknown as { __E2E__?: boolean }).__E2E__,
        );
      const hideHeartTest =
        Boolean(searchParams?.has("hideHeart")) ||
        Boolean(
          typeof window !== "undefined" &&
            (window as unknown as { __HIDE_HEART__?: boolean }).__HIDE_HEART__,
        );

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: "low-power",
          preserveDrawingBuffer: isTestE2E,
        });
      } catch {
        setState("error");
        return;
      }
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, window.innerWidth < 600 ? 1 : 1.5),
      );
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.setAttribute(
        "aria-label",
        "Interactive anatomical heart. Use the controls below or drag to rotate.",
      );
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.style.touchAction = "pan-y";
      host.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.065;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.autoRotate = false;
      controls.autoRotateSpeed = 0.45;
      controls.addEventListener("change", () => {
        invalidate();
      });
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      // Reproduce the studio environment from the uploaded HTML; retain its material/texture maps.
      const studio = new THREE.Scene();
      studio.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(10, 32, 16),
          new THREE.MeshBasicMaterial({
            color: 0x3a2a2c,
            side: THREE.BackSide,
          }),
        ),
      );
      const panel = (
        color: number,
        intensity: number,
        w: number,
        h: number,
        x: number,
        y: number,
        z: number,
      ) => {
        const mesh = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(color).multiplyScalar(intensity),
            side: THREE.DoubleSide,
          }),
        );
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        studio.add(mesh);
      };
      panel(0xfff1e6, 6, 6, 4, 5, 6, 5);
      panel(0xbfd4ff, 2.5, 5, 5, -7, 2, 3);
      panel(0xffd9d0, 3, 8, 2, 0, -2, -8);
      panel(0xffffff, 1.5, 10, 10, 0, 9, 0);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(studio, 0.04);
      scene.environment = env.texture;
      studio.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      pmrem.dispose();
      scene.add(new THREE.HemisphereLight(0xffe9e4, 0x2a1418, 0.35));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(3, 4, 5);
      scene.add(key);
      controls.addEventListener("start", () => {
        manualView = true;
      });
      const home = new THREE.Vector3();
      const resize = () => {
        const w = host.clientWidth,
          h = host.clientHeight;
        if (!w || !h) return;
        invalidate();
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const distance =
          (2.05 / Math.sin(THREE.MathUtils.degToRad(40) / 2)) *
          (camera.aspect < 0.85 ? 0.85 / camera.aspect : 1);
        home.set(0.35, 0.18, 1).normalize().multiplyScalar(distance);
        if (!positioned) {
          camera.position.copy(home);
          controls.target.set(0, 0, 0);
          controls.update();
          positioned = true;
        } else {
          camera.position.setLength(distance);
          controls.update();
        }
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();
      const intersection = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          renderControl.current?.();
        },
        { rootMargin: "100px" },
      );
      intersection.observe(host);
      const materials: THREE.MeshStandardMaterial[] = [];
      const manager = new THREE.LoadingManager();
      manager.addHandler(/^data:image\//, new THREE.TextureLoader(manager));
      new GLTFLoader(manager).load(
        "/heart.glb",
        (gltf) => {
          if (disposed) {
            gltf.scene.traverse((o) => {
              if (o instanceof THREE.Mesh) {
                o.geometry.dispose();
                const m = Array.isArray(o.material) ? o.material : [o.material];
                m.forEach((x) => x.dispose());
              }
            });
            return;
          }
          model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const scale = 3.9 / Math.max(size.x, size.y, size.z);
          const group = new THREE.Group();
          group.add(model);
          model.position.sub(center);
          group.scale.setScalar(scale);
          model.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              const originals = (
                Array.isArray(o.material) ? o.material : [o.material]
              ) as THREE.MeshStandardMaterial[];
              originals.forEach((material) => {
                material.envMapIntensity = 1.0;
                materials.push(material);
              });
            }
          });
          rig = group;
          renderer.domElement.dataset.materialMode = "original";
          const hero = host.closest<HTMLElement>(".hero");
          if (hero && !compact) {
            scrollMotion.add(
              "(min-width: 961px) and (prefers-reduced-motion: no-preference)",
              () => {
                const pose = { x: 0, y: 0 };
                const tween = gsap.to(pose, {
                  x: 0.12,
                  y: -0.55,
                  ease: "none",
                  scrollTrigger: {
                    trigger: hero,
                    start: "top top",
                    end: "bottom top",
                    scrub: 0.75,
                  },
                  onUpdate: () => {
                    if (!manualView) {
                      group.rotation.set(pose.x, pose.y, 0);
                      invalidate();
                    }
                  },
                });
                return () => {
                  tween.scrollTrigger?.kill();
                  tween.kill();
                  group.rotation.set(0, 0, 0);
                  invalidate();
                };
              },
            );
          }
          if (hideHeartTest) {
            model.visible = false;
          }
          if (typeof window !== "undefined") {
            (window as unknown as { __setHeartVisible?: (v: boolean) => void }).__setHeartVisible = (v: boolean) => {
              if (model) {
                model.visible = v;
                invalidate();
              }
            };
          }
          scene.add(group);
          invalidate();
          resize();
          // Keep the static fallback until the first completed 3D render.
        },
        undefined,
        () => {
          if (!disposed) setState("error");
        },
      );
      actions.current = {
        rotate: (x) => {
          manualView = true;
          controls.autoRotate = x;
          invalidate();
        },
        wire: (x) => {
          materials.forEach((m) => {
            m.wireframe = x;
          });
          invalidate();
        },
        reset: () => {
          manualView = true;
          rig?.rotation.set(0, 0, 0);
          invalidate();
          camera.position.copy(home);
          controls.target.set(0, 0, 0);
          controls.update();
        },
      };
      let previous = 0,
        hasRendered = false;
      const canRender = () =>
        !disposed &&
        visible &&
        !document.hidden &&
        !introActiveRef.current &&
        (!lowPower || manualView || !pageScrolling) &&
        !!model;
      const stop = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        renderer.domElement.dataset.renderActivity = "idle";
      };
      const schedule = () => {
        if (!canRender() || frame) return;
        renderer.domElement.dataset.renderActivity = "scheduled";
        frame = requestAnimationFrame(animate);
      };
      const animate = (time: number) => {
        frame = 0;
        if (!canRender()) {
          stop();
          return;
        }
        const fps =
          manualView && !controls.autoRotate && innerWidth >= 600 ? 60 : 30;
        if (time - previous < 1000 / fps - 0.5) {
          schedule();
          return;
        }
        previous = time;
        const wasDirty = dirty;
        dirty = false;
        const changed = controls.update();
        if (wasDirty || dirty || changed || controls.autoRotate) {
          renderer.render(scene, camera);
          dirty = false;
          if (!hasRendered) {
            hasRendered = true;
            setState("ready");
          }
        }
        if (changed || controls.autoRotate || dirty) schedule();
        else if (!frame) renderer.domElement.dataset.renderActivity = "idle";
      };
      requestRender = schedule;
      renderControl.current = () => {
        if (!canRender()) stop();
        else invalidate();
      };
      const visibility = () => renderControl.current?.();
      document.addEventListener("visibilitychange", visibility);
      // On touch/low-core devices, compositor-only hero parallax keeps moving
      // while expensive 3D pose redraws yield to scrolling. Manual controls win.
      const scrolling = () => {
        if (!lowPower || manualView) return;
        pageScrolling = true;
        window.clearTimeout(scrollIdle);
        stop();
        renderer.domElement.dataset.renderActivity = "scroll-paused";
        scrollIdle = window.setTimeout(() => {
          pageScrolling = false;
          invalidate();
        }, 200);
      };
      window.addEventListener("scroll", scrolling, { passive: true });
      window.addEventListener("wheel", scrolling, { passive: true });
      schedule();
      return () => {
        disposed = true;
        scrollMotion.revert();
        stop();
        renderControl.current = null;
        document.removeEventListener("visibilitychange", visibility);
        window.removeEventListener("scroll", scrolling);
        window.removeEventListener("wheel", scrolling);
        window.clearTimeout(scrollIdle);
        observer.disconnect();
        intersection.disconnect();
        controls.dispose();
        env.dispose();
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const ms = Array.isArray(o.material) ? o.material : [o.material];
            ms.forEach((m) => {
              Object.values(m).forEach((value) => {
                if (value instanceof THREE.Texture) value.dispose();
              });
              m.dispose();
            });
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
        actions.current = null;
        if (typeof window !== "undefined") {
          delete (window as unknown as { __setHeartVisible?: unknown }).__setHeartVisible;
        }
      };
    };
    // Paint the usable interface/static anatomy first; defer studio-map and
    // WebGL setup to an idle slot rather than blocking the initial app commit.
    let cleanup: (() => void) | undefined;
    let idle = 0;
    const timer = window.setTimeout(() => {
      if (typeof requestIdleCallback === "function") {
        idle = requestIdleCallback(
          () => {
            cleanup = initialize();
          },
          { timeout: 500 },
        );
      } else cleanup = initialize();
    }, 60);
    return () => {
      window.clearTimeout(timer);
      if (idle) cancelIdleCallback(idle);
      cleanup?.();
    };
  }, [staticMode, compact]);
  return (
    <div className={`heart-scene ${compact ? "compact" : ""}`}>
      <div className="heart-halo" aria-hidden="true" />
      <div className="orbit orbit-one" aria-hidden="true" />
      <div className="orbit orbit-two" aria-hidden="true" />
      <div
        ref={mount}
        className={`three-mount ${staticMode ? "hidden" : ""}`}
      />
      {(staticMode || state !== "ready") && (
        <div className="heart-fallback">
          <img
            src="/heart-fallback.png"
            alt="Original textured anatomical heart model"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          {state === "loading" && !staticMode && (
            <span className="loading-label">
              <span className="tiny-spinner" /> Preparing your perspective
            </span>
          )}
          {state === "error" && !staticMode && (
            <span className="loading-label">
              3D unavailable · static anatomy view
            </span>
          )}
        </div>
      )}
      <div className="scene-footer">
        <span>
          <MoveUpRight size={12} />{" "}
          {staticMode ? "STATIC ANATOMY VIEW" : "DRAG TO EXPLORE"}
        </span>
        <div className="scene-controls" aria-label="3D heart controls">
          {!staticMode && (
            <>
              <button
                aria-label={rotating ? "Pause rotation" : "Rotate heart"}
                title={rotating ? "Pause rotation" : "Rotate heart"}
                aria-pressed={rotating}
                disabled={state !== "ready"}
                onClick={() => {
                  setRotating(!rotating);
                  actions.current?.rotate(!rotating);
                }}
              >
                {rotating ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <button
                aria-label="Toggle wireframe"
                title="Toggle wireframe"
                aria-pressed={wire}
                disabled={state !== "ready"}
                onClick={() => {
                  setWire(!wire);
                  actions.current?.wire(!wire);
                }}
              >
                <Box size={14} />
              </button>
              <button
                aria-label="Reset heart view"
                title="Reset view"
                disabled={state !== "ready"}
                onClick={() => actions.current?.reset()}
              >
                <RotateCcw size={14} />
              </button>
            </>
          )}
          <button
            aria-label={staticMode ? "Enable 3D view" : "Use static view"}
            title={staticMode ? "Enable 3D view" : "Use static view"}
            aria-pressed={staticMode}
            onClick={() => {
              setState("loading");
              setRotating(false);
              setWire(false);
              setStaticMode(!staticMode);
            }}
          >
            <ImageIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
