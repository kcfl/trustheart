import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const outDir = path.join(repoRoot, "docs", "verification", "frontend");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function verifyHeart() {
  console.log("Launching Chromium with SwiftShader WebGL flags...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });

  const report = [];

  try {
    // 0. VERIFY PRESERVEDRAWINGBUFFER IS ONLY ENABLED WITH ?e2e=1
    console.log("\n--- Checking preserveDrawingBuffer flag behavior ---");
    const nonE2EContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const nonE2EPage = await nonE2EContext.newPage();
    await nonE2EPage.goto("http://127.0.0.1:8000/", { waitUntil: "networkidle" });
    await nonE2EPage.waitForTimeout(1000);
    const nonE2EPreserve = await nonE2EPage.evaluate(() => {
      const canvas = document.querySelector(".three-mount canvas, canvas[role='img']");
      if (!canvas) return null;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      return gl ? gl.getContextAttributes()?.preserveDrawingBuffer : null;
    });
    console.log(`preserveDrawingBuffer on '/' (no ?e2e=1): ${nonE2EPreserve} (expected: false or null)`);
    if (nonE2EPreserve === true) {
      throw new Error("Security check failed: preserveDrawingBuffer must NOT be true in standard production without ?e2e=1");
    }
    await nonE2EContext.close();

    // 1. DESKTOP TEST (1280x800) WITH E2E PRESERVEDRAWINGBUFFER
    console.log("\n--- Testing Desktop (1280x800) with ?e2e=1 ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const desktopPage = await desktopContext.newPage();

    // Enable E2E preserveDrawingBuffer flag
    await desktopPage.addInitScript(() => {
      window.__E2E__ = true;
    });

    console.log("Navigating to /analysis?e2e=1...");
    await desktopPage.goto("http://127.0.0.1:8000/analysis?e2e=1", { waitUntil: "networkidle" });

    // Click sample p10
    console.log("Loading p10 sample...");
    await desktopPage.getByRole("button", { name: "Sample patient (p10)" }).click();
    await desktopPage.waitForTimeout(400);

    // Review inputs
    console.log("Clicking Review inputs...");
    await desktopPage.getByRole("button", { name: "Review inputs" }).click();
    await desktopPage.waitForTimeout(400);

    // Consent
    await desktopPage.getByRole("checkbox").check();
    await desktopPage.waitForTimeout(200);

    // Run prediction
    console.log("Clicking Run prediction...");
    await desktopPage.getByRole("button", { name: "Run prediction" }).click();

    console.log("Waiting for /results navigation and 3D heart canvas...");
    await desktopPage.waitForURL("**/results*", { timeout: 15000 });
    await desktopPage.waitForSelector(".result-heart canvas, canvas[role='img']", { timeout: 15000 });

    // Allow Three.js PMREM and GLTF to render
    await desktopPage.waitForTimeout(3500);

    // Helper to read pixels from the canvas
    const getCanvasPixels = async () => {
      return await desktopPage.evaluate(() => {
        const canvas = document.querySelector(".result-heart canvas") || document.querySelector("canvas[role='img']");
        if (!canvas) return { error: "Canvas not found" };
        const rect = canvas.getBoundingClientRect();
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
        if (!gl) return { error: "WebGL context not available" };

        const w = canvas.width;
        const h = canvas.height;
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        let nonZeroCount = 0;
        let nonTransparentCount = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) {
            nonZeroCount++;
          }
          if (pixels[i + 3] > 0) {
            nonTransparentCount++;
          }
        }

        return {
          domWidth: rect.width,
          domHeight: rect.height,
          bufferWidth: w,
          bufferHeight: h,
          totalPixels: w * h,
          nonZeroCount,
          nonTransparentCount,
          pctDrawn: (nonZeroCount / (w * h)) * 100,
          pixelData: Array.from(pixels),
        };
      });
    };

    // 1A: Whole heart selection (default CAD)
    console.log("\nCapturing 'Whole heart' view...");
    const wholeStats = await getCanvasPixels();
    if (wholeStats.error || wholeStats.nonZeroCount === 0) {
      throw new Error(`Whole heart render failed: ${wholeStats.error || "0 non-zero pixels"}`);
    }
    const wholeShot = path.join(outDir, "vessel_whole.png");
    await desktopPage.screenshot({ path: wholeShot });
    console.log(`[PASS] Whole heart canvas: ${wholeStats.nonZeroCount} px drawn (${wholeStats.pctDrawn.toFixed(2)}%) -> ${wholeShot}`);

    // Also save legacy screenshot names for backwards compatibility
    await desktopPage.screenshot({ path: path.join(outDir, "heart_desktop.png") });
    await desktopPage.screenshot({ path: path.join(outDir, "heart_normal.png") });

    // 1B: Select LAD
    console.log("\nSelecting 'LAD' vessel...");
    await desktopPage.locator(".artery-selector").getByRole("button", { name: "LAD", exact: true }).click();
    await desktopPage.waitForTimeout(1500); // Wait for zoom and opacity transition
    const ladStats = await getCanvasPixels();
    if (ladStats.error || ladStats.nonZeroCount === 0) {
      throw new Error(`LAD render failed: ${ladStats.error || "0 non-zero pixels"}`);
    }
    const ladShot = path.join(outDir, "vessel_lad.png");
    await desktopPage.screenshot({ path: ladShot });
    console.log(`[PASS] LAD selected canvas: ${ladStats.nonZeroCount} px drawn (${ladStats.pctDrawn.toFixed(2)}%) -> ${ladShot}`);

    // 1C: Select LCX
    console.log("\nSelecting 'LCX' vessel...");
    await desktopPage.locator(".artery-selector").getByRole("button", { name: "LCX", exact: true }).click();
    await desktopPage.waitForTimeout(1500);
    const lcxStats = await getCanvasPixels();
    if (lcxStats.error || lcxStats.nonZeroCount === 0) {
      throw new Error(`LCX render failed: ${lcxStats.error || "0 non-zero pixels"}`);
    }
    const lcxShot = path.join(outDir, "vessel_lcx.png");
    await desktopPage.screenshot({ path: lcxShot });
    console.log(`[PASS] LCX selected canvas: ${lcxStats.nonZeroCount} px drawn (${lcxStats.pctDrawn.toFixed(2)}%) -> ${lcxShot}`);

    // 1D: Select RCA
    console.log("\nSelecting 'RCA' vessel...");
    await desktopPage.locator(".artery-selector").getByRole("button", { name: "RCA", exact: true }).click();
    await desktopPage.waitForTimeout(1500);
    const rcaStats = await getCanvasPixels();
    if (rcaStats.error || rcaStats.nonZeroCount === 0) {
      throw new Error(`RCA render failed: ${rcaStats.error || "0 non-zero pixels"}`);
    }
    const rcaShot = path.join(outDir, "vessel_rca.png");
    await desktopPage.screenshot({ path: rcaShot });
    console.log(`[PASS] RCA selected canvas: ${rcaStats.nonZeroCount} px drawn (${rcaStats.pctDrawn.toFixed(2)}%) -> ${rcaShot}`);

    // 1E: Calculate pixel difference between LAD selected and RCA selected
    console.log("\nComputing pixel difference: LAD selected vs. RCA selected...");
    const ladPixels = ladStats.pixelData;
    const rcaPixels = rcaStats.pixelData;

    let vesselDiffPixels = 0;
    for (let i = 0; i < ladPixels.length; i += 4) {
      const dr = Math.abs(ladPixels[i] - rcaPixels[i]);
      const dg = Math.abs(ladPixels[i + 1] - rcaPixels[i + 1]);
      const db = Math.abs(ladPixels[i + 2] - rcaPixels[i + 2]);
      if (dr + dg + db > 15) {
        vesselDiffPixels++;
      }
    }

    const totalPx = ladStats.totalPixels;
    const vesselDiffPct = (vesselDiffPixels / totalPx) * 100;
    const VESSEL_DIFF_THRESHOLD = 2000;

    console.log(`Vessel Selection Diff Stats (LAD vs RCA):`);
    console.log(`  Diff Pixels: ${vesselDiffPixels}`);
    console.log(`  Diff Percentage: ${vesselDiffPct.toFixed(2)}%`);
    console.log(`  Threshold Required: > ${VESSEL_DIFF_THRESHOLD} px`);

    if (vesselDiffPixels <= VESSEL_DIFF_THRESHOLD) {
      throw new Error(
        `Vessel selection diff failed: difference (${vesselDiffPixels} px) did not exceed threshold (${VESSEL_DIFF_THRESHOLD} px)`
      );
    }
    console.log(`[PASS] LAD vs RCA vessel selection zoom/highlight verified (diff = ${vesselDiffPixels} px > ${VESSEL_DIFF_THRESHOLD} px)!`);

    // 1F: Test Hide Heart hook (mesh hide proof)
    console.log("\nTesting window.__setHeartVisible(false)...");
    await desktopPage.evaluate(() => {
      window.__setHeartVisible?.(false);
    });
    await desktopPage.waitForTimeout(1000);
    const hiddenShot = path.join(outDir, "heart_hidden.png");
    await desktopPage.screenshot({ path: hiddenShot });

    report.push({
      test: "vessel_render_and_selection",
      mode: "desktop",
      viewport: "1280x800",
      domDimensions: `${wholeStats.domWidth.toFixed(0)}x${wholeStats.domHeight.toFixed(0)}`,
      bufferDimensions: `${wholeStats.bufferWidth}x${wholeStats.bufferHeight}`,
      wholePixelsDrawn: wholeStats.nonZeroCount,
      ladPixelsDrawn: ladStats.nonZeroCount,
      lcxPixelsDrawn: lcxStats.nonZeroCount,
      rcaPixelsDrawn: rcaStats.nonZeroCount,
      vesselDiffPixels,
      vesselDiffPct: vesselDiffPct.toFixed(2) + "%",
      vesselDiffThreshold: VESSEL_DIFF_THRESHOLD,
      screenshots: [
        "docs/verification/frontend/vessel_whole.png",
        "docs/verification/frontend/vessel_lad.png",
        "docs/verification/frontend/vessel_lcx.png",
        "docs/verification/frontend/vessel_rca.png",
      ],
      status: "PASS",
    });

    await desktopContext.close();

    // 2. MOBILE TEST (390x844)
    console.log("\n--- Testing Mobile (390x844) ---");
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => {
      window.__E2E__ = true;
    });

    console.log("Navigating mobile to /analysis?e2e=1...");
    await mobilePage.goto("http://127.0.0.1:8000/analysis?e2e=1", { waitUntil: "networkidle" });
    await mobilePage.getByRole("button", { name: "Sample patient (p10)" }).click();
    await mobilePage.waitForTimeout(400);
    await mobilePage.getByRole("button", { name: "Review inputs" }).click();
    await mobilePage.waitForTimeout(400);
    await mobilePage.getByRole("checkbox").check();
    await mobilePage.waitForTimeout(200);
    await mobilePage.getByRole("button", { name: "Run prediction" }).click();

    await mobilePage.waitForURL("**/results*", { timeout: 15000 });
    await mobilePage.waitForSelector(".result-heart canvas, canvas[role='img']", { timeout: 15000 });
    await mobilePage.waitForTimeout(3500);

    const mobilePixelStats = await mobilePage.evaluate(() => {
      const canvas = document.querySelector(".result-heart canvas") || document.querySelector("canvas[role='img']");
      if (!canvas) return { error: "Canvas not found" };
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return { error: "WebGL context not available" };
      const w = canvas.width;
      const h = canvas.height;
      const pixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let nonZeroCount = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0) nonZeroCount++;
      }
      return {
        totalPixels: w * h,
        nonZeroCount,
        pctDrawn: (nonZeroCount / (w * h)) * 100,
      };
    });

    if (mobilePixelStats.nonZeroCount === 0) {
      throw new Error("Mobile canvas rendered 0 pixels");
    }
    const mobileShot = path.join(outDir, "heart_mobile.png");
    await mobilePage.screenshot({ path: mobileShot });
    console.log(`[PASS] Mobile canvas: ${mobilePixelStats.nonZeroCount} px drawn (${mobilePixelStats.pctDrawn.toFixed(2)}%) -> ${mobileShot}`);

    report.push({
      test: "mobile_render",
      mode: "mobile",
      viewport: "390x844",
      totalPixels: mobilePixelStats.totalPixels,
      renderedPixels: mobilePixelStats.nonZeroCount,
      pctDrawn: mobilePixelStats.pctDrawn.toFixed(2) + "%",
      screenshot: "docs/verification/frontend/heart_mobile.png",
      status: "PASS",
    });

    await mobileContext.close();
  } catch (err) {
    console.error("FATAL ERROR in verifyHeart:", err);
    throw err;
  } finally {
    await browser.close();
  }

  // Save report
  const proofFile = path.join(repoRoot, "docs", "verification", "heart_render_proof.txt");
  fs.writeFileSync(proofFile, JSON.stringify(report, null, 2), "utf-8");
  console.log(`\nWrote heart proof to ${proofFile}`);

  console.log("\n================================================================================");
  console.log("HEART & CORONARY VESSELS RENDER PROOF SUMMARY");
  console.log("================================================================================");
  report.forEach((r) => {
    console.log(JSON.stringify(r, null, 2));
  });
  console.log("================================================================================");
}

verifyHeart().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
