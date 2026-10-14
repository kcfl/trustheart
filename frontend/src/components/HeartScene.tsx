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
import {
  VESSEL_CONFIG,
  createVesselTube,
  normalizedToModelSpace,
  type VesselKey,
} from "@/features/anatomy/vessel-config";
import {
  getVesselColor,
  getVesselHexColor,
  type ProbabilityBand,
} from "@/features/anatomy/vessel-colors";

export type TargetKey = "CAD" | "LAD" | "LCX" | "RCA";

export interface HeartSceneProps {
  compact?: boolean;
  selected?: TargetKey;
  onSelect?: (target: TargetKey) => void;
  probabilities?: Partial<Record<TargetKey, number>>;
  bands?: Partial<Record<TargetKey, ProbabilityBand>>;
}

interface VesselTooltipState {
  visible: boolean;
  x: number;
  y: number;
  vesselKey?: VesselKey;
  label?: string;
  fullName?: string;
  prob?: number;
  band?: ProbabilityBand;
  color?: string;
}

export default function HeartScene({
  compact = false,
  selected = "CAD",
  onSelect,
  probabilities,
  bands,
}: HeartSceneProps) {
  const { active: introActive } = useStartupIntro();
  const introActiveRef = useRef(introActive);
  introActiveRef.current = introActive;
  const mount = useRef<HTMLDivElement>(null);
  const renderControl = useRef<(() => void) | null>(null);

  // Sync refs for dynamic animation
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const probabilitiesRef = useRef(probabilities);
  probabilitiesRef.current = probabilities;
  const bandsRef = useRef(bands);
  bandsRef.current = bands;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const [tooltip, setTooltip] = useState<VesselTooltipState>({
    visible: false,
    x: 0,
    y: 0,
  });

  const updateCameraRef = useRef<((target: TargetKey) => void) | null>(null);
  const updateColorsRef = useRef<(() => void) | null>(null);

  // Handle external selection changes (e.g. from parent tabs or cards)
  useEffect(() => {
    updateCameraRef.current?.(selected);
  }, [selected]);

  // Handle prediction updates
  useEffect(() => {
    updateColorsRef.current?.();
  }, [probabilities, bands]);

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
      const isVesselDebug =
        Boolean(searchParams?.has("debugVessels")) ||
        Boolean(
          typeof window !== "undefined" &&
            (window as unknown as { __DEBUG_VESSELS__?: boolean })
              .__DEBUG_VESSELS__,
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
        "Interactive anatomical heart with color-coded coronary arteries. Use tabs or click vessels to explore.",
      );
      renderer.domElement.setAttribute("role", "img");
      renderer.domElement.style.touchAction = "pan-y";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.065;
      controls.enableZoom = true;
      controls.minDistance = 2.0;
      controls.maxDistance = 14.0;
      controls.enablePan = false;
      controls.autoRotate = false;
      controls.autoRotateSpeed = 0.45;
      controls.addEventListener("change", () => {
        invalidate();
      });
      controls.touches.ONE = THREE.TOUCH.ROTATE;

      // Studio environment lighting
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

      scene.add(new THREE.HemisphereLight(0xffe9e4, 0x2a1418, 0.4));
      const key = new THREE.DirectionalLight(0xffffff, 1.0);
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
      const vesselMeshes: Partial<Record<VesselKey, THREE.Mesh>> = {};
      const vesselMaterials: Partial<Record<VesselKey, THREE.MeshStandardMaterial>> = {};

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

          // --- Create Procedural Vessel Tubes ---
          const vesselKeys: VesselKey[] = ["LAD", "LCX", "RCA"];
          vesselKeys.forEach((vKey) => {
            const def = VESSEL_CONFIG[vKey];
            const { geometry } = createVesselTube(def, box.min, size, center);
            const prob = probabilitiesRef.current?.[vKey] ?? 0.25;
            const band = bandsRef.current?.[vKey];
            const hexColor = getVesselHexColor(prob, band);

            const mat = new THREE.MeshStandardMaterial({
              color: hexColor,
              emissive: hexColor,
              emissiveIntensity: 0.45,
              roughness: 0.35,
              metalness: 0.25,
              polygonOffset: true,
              polygonOffsetFactor: -2,
              polygonOffsetUnits: -2,
              depthTest: true,
              transparent: true,
              opacity:
                selectedRef.current === "CAD" || selectedRef.current === vKey
                  ? 1.0
                  : 0.35,
            });

            const tubeMesh = new THREE.Mesh(geometry, mat);
            tubeMesh.name = `vessel_${vKey}`;
            tubeMesh.userData = { vesselKey: vKey };
            model?.add(tubeMesh);
            vesselMeshes[vKey] = tubeMesh;
            vesselMaterials[vKey] = mat;
          });

          // Optional developer debug mode: control point visualization
          if (isVesselDebug && model) {
            vesselKeys.forEach((vKey) => {
              const def = VESSEL_CONFIG[vKey];
              def.points.forEach((pt) => {
                const pos = normalizedToModelSpace(
                  pt,
                  box.min,
                  size,
                  center,
                );
                const sphere = new THREE.Mesh(
                  new THREE.SphereGeometry(size.y * 0.012, 12, 12),
                  new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
                );
                sphere.position.copy(pos);
                model?.add(sphere);
              });
            });
            if (typeof window !== "undefined") {
              (window as unknown as { __VESSEL_CONFIG__?: unknown }).__VESSEL_CONFIG__ = VESSEL_CONFIG;
            }
          }

          // Camera focus & Zoom function
          const updateCameraPosition = (targetKey: TargetKey) => {
            if (!model) return;
            const reducedMotion =
              matchMedia("(prefers-reduced-motion: reduce)").matches;

            const targetTarget = new THREE.Vector3();
            const targetPos = new THREE.Vector3();

            if (targetKey === "CAD" || !VESSEL_CONFIG[targetKey as VesselKey]) {
              targetTarget.set(0, 0, 0);
              targetPos.copy(home);
            } else {
              const def = VESSEL_CONFIG[targetKey as VesselKey];
              const fpModel = normalizedToModelSpace(
                def.focusPoint,
                box.min,
                size,
                center,
              );
              // Transform to group space
              const fpWorld = fpModel.clone().multiplyScalar(scale);
              targetTarget.copy(fpWorld);

              const zoomDist = home.length() / def.zoomFactor;
              targetPos
                .copy(home)
                .normalize()
                .multiplyScalar(zoomDist)
                .add(fpWorld.clone().multiplyScalar(0.25));
            }

            // Opacity transitions
            vesselKeys.forEach((k) => {
              const m = vesselMaterials[k];
              if (m) {
                const targetOp =
                  targetKey === "CAD" || targetKey === k ? 1.0 : 0.35;
                if (reducedMotion) {
                  m.opacity = targetOp;
                } else {
                  gsap.to(m, {
                    opacity: targetOp,
                    duration: 0.45,
                    ease: "power2.out",
                    onUpdate: invalidate,
                  });
                }
              }
            });

            if (reducedMotion) {
              controls.target.copy(targetTarget);
              camera.position.copy(targetPos);
              controls.update();
              invalidate();
            } else {
              gsap.to(controls.target, {
                x: targetTarget.x,
                y: targetTarget.y,
                z: targetTarget.z,
                duration: 0.85,
                ease: "power2.out",
                onUpdate: () => {
                  controls.update();
                  invalidate();
                },
              });
              gsap.to(camera.position, {
                x: targetPos.x,
                y: targetPos.y,
                z: targetPos.z,
                duration: 0.85,
                ease: "power2.out",
                onUpdate: () => {
                  controls.update();
                  invalidate();
                },
              });
            }
          };

          updateCameraRef.current = updateCameraPosition;

          // Color transition function
          const updateVesselColors = () => {
            vesselKeys.forEach((vKey) => {
              const mat = vesselMaterials[vKey];
              if (mat) {
                const prob = probabilitiesRef.current?.[vKey] ?? 0.25;
                const band = bandsRef.current?.[vKey];
                const targetColor = new THREE.Color(
                  getVesselHexColor(prob, band),
                );
                gsap.to(mat.color, {
                  r: targetColor.r,
                  g: targetColor.g,
                  b: targetColor.b,
                  duration: 0.4,
                  onUpdate: invalidate,
                });
                gsap.to(mat.emissive, {
                  r: targetColor.r,
                  g: targetColor.g,
                  b: targetColor.b,
                  duration: 0.4,
                  onUpdate: invalidate,
                });
              }
            });

            // Subtle heart tissue tinting based on CAD overall risk
            if (
              materials.length > 0 &&
              probabilitiesRef.current?.CAD !== undefined
            ) {
              const cad = probabilitiesRef.current.CAD;
              const tintColor = new THREE.Color(
                cad >= 0.6 ? 0xef4444 : cad >= 0.3 ? 0xf59e0b : 0x22c55e,
              );
              materials.forEach((m) => {
                gsap.to(m.emissive, {
                  r: tintColor.r * 0.12 * cad,
                  g: tintColor.g * 0.12 * cad,
                  b: tintColor.b * 0.12 * cad,
                  duration: 0.4,
                  onUpdate: invalidate,
                });
              });
            }
          };

          updateColorsRef.current = updateVesselColors;

          // Parallax scroll on hero (non-compact)
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
            (
              window as unknown as {
                __setHeartVisible?: (v: boolean) => void;
                __setVesselSelected?: (t: TargetKey) => void;
              }
            ).__setHeartVisible = (v: boolean) => {
              if (model) {
                model.visible = v;
                invalidate();
              }
            };
            (
              window as unknown as {
                __setVesselSelected?: (t: TargetKey) => void;
              }
            ).__setVesselSelected = (t: TargetKey) => {
              onSelectRef.current?.(t);
              updateCameraPosition(t);
            };
          }

          scene.add(group);
          invalidate();
          resize();

          // Initialize camera to current selection if not CAD
          if (selectedRef.current && selectedRef.current !== "CAD") {
            updateCameraPosition(selectedRef.current);
          }
        },
        undefined,
        () => {
          if (!disposed) setState("error");
        },
      );

      // --- Raycasting & Pointer Interactivity ---
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let pointerDown = { x: 0, y: 0 };

      const onPointerMove = (e: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const meshes = Object.values(vesselMeshes).filter(Boolean) as THREE.Mesh[];
        const hits = raycaster.intersectObjects(meshes, false);

        if (hits.length > 0) {
          renderer.domElement.style.cursor = "pointer";
          const hitKey = hits[0].object.userData.vesselKey as VesselKey;
          const def = VESSEL_CONFIG[hitKey];
          const prob = probabilitiesRef.current?.[hitKey] ?? 0;
          const band = bandsRef.current?.[hitKey];

          setTooltip({
            visible: true,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            vesselKey: hitKey,
            label: def.label,
            fullName: def.fullName,
            prob: Math.round(prob * 100),
            band:
              band ??
              (prob >= 0.6
                ? "higher"
                : prob >= 0.3
                  ? "intermediate"
                  : "lower"),
            color: getVesselColor(prob, band),
          });
        } else {
          renderer.domElement.style.cursor = "grab";
          setTooltip((t) => (t.visible ? { ...t, visible: false } : t));
        }
      };

      const onPointerDown = (e: PointerEvent) => {
        pointerDown = { x: e.clientX, y: e.clientY };
      };

      const onPointerUp = (e: PointerEvent) => {
        const moveDist = Math.hypot(
          e.clientX - pointerDown.x,
          e.clientY - pointerDown.y,
        );
        if (moveDist > 6) return; // Ignore drag moves

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const meshes = Object.values(vesselMeshes).filter(Boolean) as THREE.Mesh[];
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
          const hitKey = hits[0].object.userData.vesselKey as VesselKey;
          onSelectRef.current?.(hitKey);
          updateCameraRef.current?.(hitKey);
        }
      };

      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

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
          onSelectRef.current?.("CAD");
          updateCameraRef.current?.("CAD");
          invalidate();
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

        renderer.domElement.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);

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
          delete (window as unknown as { __setHeartVisible?: unknown })
            .__setHeartVisible;
          delete (window as unknown as { __setVesselSelected?: unknown })
            .__setVesselSelected;
          delete (window as unknown as { __VESSEL_CONFIG__?: unknown })
            .__VESSEL_CONFIG__;
        }
      };
    };

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

      {/* Floating Hover Tooltip */}
      {tooltip.visible && tooltip.label && (
        <div
          className="vessel-tooltip"
          style={{
            left: `${tooltip.x + 12}px`,
            top: `${tooltip.y - 12}px`,
          }}
          role="tooltip"
        >
          <div className="tooltip-header">
            <span
              className="tooltip-dot"
              style={{ backgroundColor: tooltip.color }}
            />
            <span className="tooltip-name">{tooltip.label}</span>
            <span className="tooltip-band">{tooltip.band}</span>
          </div>
          <div className="tooltip-fullname">{tooltip.fullName}</div>
          <div className="tooltip-prob">
            Stenosis probability: <strong>{tooltip.prob}%</strong>
          </div>
        </div>
      )}

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
