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
    // 1. DESKTOP TEST (1280x800)
    console.log("\n--- Testing Desktop (1280x800) ---");
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

    // 1A: Measure normal heart canvas
    const normalStats = await desktopPage.evaluate(() => {
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

      // Store normal pixels globally in window for diffing
      window.__normalPixels = pixels;

      return {
        domWidth: rect.width,
        domHeight: rect.height,
        bufferWidth: w,
        bufferHeight: h,
        totalPixels: w * h,
        nonZeroCount,
        nonTransparentCount,
        pctDrawn: (nonZeroCount / (w * h)) * 100,
      };
    });

    console.log("Desktop Normal Canvas Stats:", normalStats);
    if (normalStats.error) {
      throw new Error(`Desktop WebGL check failed: ${normalStats.error}`);
    }
    if (normalStats.domWidth === 0 || normalStats.domHeight === 0) {
      throw new Error("Desktop canvas has 0 DOM dimensions");
    }
    if (normalStats.nonZeroCount === 0) {
      throw new Error("Desktop canvas is completely blank (0 rendered non-zero pixels)");
    }

    // Save normal screenshot
    const normalShot = path.join(outDir, "heart_desktop.png");
    await desktopPage.screenshot({ path: normalShot });
    console.log(`Saved desktop screenshot to ${normalShot}`);

    const normalShotAlt = path.join(outDir, "heart_normal.png");
    await desktopPage.screenshot({ path: normalShotAlt });
    console.log(`Saved heart_normal screenshot to ${normalShotAlt}`);

    // 1B: Hide heart mesh and measure difference
    console.log("Hiding heart mesh via window.__setHeartVisible(false)...");
    const hideHookResult = await desktopPage.evaluate(() => {
      if (typeof window.__setHeartVisible === "function") {
        window.__setHeartVisible(false);
        return true;
      }
      return false;
    });

    if (!hideHookResult) {
      throw new Error("window.__setHeartVisible hook was not found on the page");
    }

    // Wait for canvas to re-render with hidden heart
    await desktopPage.waitForTimeout(1000);

    // Save hidden screenshot
    const hiddenShot = path.join(outDir, "heart_hidden.png");
    await desktopPage.screenshot({ path: hiddenShot });
    console.log(`Saved heart_hidden screenshot to ${hiddenShot}`);

    // 1C: Compute pixel difference
    const diffStats = await desktopPage.evaluate(() => {
      const canvas = document.querySelector(".result-heart canvas") || document.querySelector("canvas[role='img']");
      if (!canvas) return { error: "Canvas not found" };
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return { error: "WebGL context not available" };

      const w = canvas.width;
      const h = canvas.height;
      const hiddenPixels = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, hiddenPixels);

      const normalPixels = window.__normalPixels;
      if (!normalPixels || normalPixels.length !== hiddenPixels.length) {
        return { error: "Normal pixels buffer missing or length mismatch" };
      }

      let diffCount = 0;
      let hiddenNonZero = 0;
      for (let i = 0; i < normalPixels.length; i += 4) {
        if (hiddenPixels[i] !== 0 || hiddenPixels[i + 1] !== 0 || hiddenPixels[i + 2] !== 0) {
          hiddenNonZero++;
        }
        const dr = Math.abs(normalPixels[i] - hiddenPixels[i]);
        const dg = Math.abs(normalPixels[i + 1] - hiddenPixels[i + 1]);
        const db = Math.abs(normalPixels[i + 2] - hiddenPixels[i + 2]);
        if (dr + dg + db > 15) {
          diffCount++;
        }
      }

      return {
        diffCount,
        hiddenNonZero,
        diffPct: (diffCount / (w * h)) * 100,
      };
    });

    console.log("Desktop Canvas Diff Stats (Normal vs Hidden):", diffStats);
    if (diffStats.error) {
      throw new Error(`Pixel diff failed: ${diffStats.error}`);
    }

    const DIFF_THRESHOLD = 5000;
    if (diffStats.diffCount <= DIFF_THRESHOLD) {
      throw new Error(
        `Heart mesh hide diff failed: difference (${diffStats.diffCount} px) did not exceed threshold (${DIFF_THRESHOLD} px)`
      );
    }
    console.log(
      `[PASS] Pixel diff test: ${diffStats.diffCount} pixels differed (${diffStats.diffPct.toFixed(2)}% of canvas, threshold > ${DIFF_THRESHOLD})`
    );

    report.push({
      mode: "desktop",
      viewport: "1280x800",
      domDimensions: `${normalStats.domWidth.toFixed(0)}x${normalStats.domHeight.toFixed(0)}`,
      bufferDimensions: `${normalStats.bufferWidth}x${normalStats.bufferHeight}`,
      totalPixels: normalStats.totalPixels,
      renderedPixelsNormal: normalStats.nonZeroCount,
      renderedPixelsHidden: diffStats.hiddenNonZero,
      diffPixels: diffStats.diffCount,
      diffPct: diffStats.diffPct.toFixed(2) + "%",
      diffThreshold: DIFF_THRESHOLD,
      pctDrawn: normalStats.pctDrawn.toFixed(2) + "%",
      screenshotNormal: "heart_desktop.png (heart_normal.png)",
      screenshotHidden: "heart_hidden.png",
      status: "PASS",
    });

    await desktopContext.close();

    // 2. MOBILE TEST (390x844)
    console.log("\n--- Testing Mobile (390x844) ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileContext.newPage();

    // Enable E2E preserveDrawingBuffer flag on mobile
    await mobilePage.addInitScript(() => {
      window.__E2E__ = true;
    });

    console.log("Navigating mobile to /analysis?e2e=1...");
    await mobilePage.goto("http://127.0.0.1:8000/analysis?e2e=1", { waitUntil: "networkidle" });

    console.log("Loading p10 sample on mobile...");
    await mobilePage.getByRole("button", { name: "Sample patient (p10)" }).click();
    await mobilePage.waitForTimeout(400);

    console.log("Clicking Review inputs on mobile...");
    await mobilePage.getByRole("button", { name: "Review inputs" }).click();
    await mobilePage.waitForTimeout(400);

    await mobilePage.getByRole("checkbox").check();
    await mobilePage.waitForTimeout(200);

    console.log("Clicking Run prediction on mobile...");
    await mobilePage.getByRole("button", { name: "Run prediction" }).click();

    console.log("Waiting for mobile /results navigation and 3D heart canvas...");
    await mobilePage.waitForURL("**/results*", { timeout: 15000 });
    await mobilePage.waitForSelector(".result-heart canvas, canvas[role='img']", { timeout: 15000 });

    await mobilePage.waitForTimeout(3500);

    const mobilePixelStats = await mobilePage.evaluate(() => {
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
      };
    });

    console.log("Mobile Canvas Stats:", mobilePixelStats);
    if (mobilePixelStats.error) {
      throw new Error(`Mobile WebGL check failed: ${mobilePixelStats.error}`);
    }
    if (mobilePixelStats.domWidth === 0 || mobilePixelStats.domHeight === 0) {
      throw new Error("Mobile canvas has 0 DOM dimensions");
    }
    if (mobilePixelStats.nonZeroCount === 0) {
      throw new Error("Mobile canvas is completely blank (0 rendered non-zero pixels)");
    }

    const mobileShot = path.join(outDir, "heart_mobile.png");
    await mobilePage.screenshot({ path: mobileShot });
    console.log(`Saved mobile screenshot to ${mobileShot}`);

    report.push({
      mode: "mobile",
      viewport: "390x844",
      domDimensions: `${mobilePixelStats.domWidth.toFixed(0)}x${mobilePixelStats.domHeight.toFixed(0)}`,
      bufferDimensions: `${mobilePixelStats.bufferWidth}x${mobilePixelStats.bufferHeight}`,
      totalPixels: mobilePixelStats.totalPixels,
      renderedPixels: mobilePixelStats.nonZeroCount,
      pctDrawn: mobilePixelStats.pctDrawn.toFixed(2) + "%",
      screenshot: "heart_mobile.png",
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
  console.log("HEART RENDER PROOF SUMMARY");
  console.log("================================================================================");
  report.forEach((r) => {
    if (r.diffPixels !== undefined) {
      console.log(
        `[${r.status}] ${r.mode} (${r.viewport}): DOM ${r.domDimensions}, Buffer ${r.bufferDimensions}, Rendered Pixels: ${r.renderedPixelsNormal} (${r.pctDrawn}) | Diff vs Hidden: ${r.diffPixels} px (${r.diffPct}, threshold > ${r.diffThreshold}) -> ${r.screenshotNormal}, ${r.screenshotHidden}`
      );
    } else {
      console.log(
        `[${r.status}] ${r.mode} (${r.viewport}): DOM ${r.domDimensions}, Buffer ${r.bufferDimensions}, Rendered Pixels: ${r.renderedPixels} (${r.pctDrawn}) -> ${r.screenshot}`
      );
    }
  });
  console.log("================================================================================");
}

verifyHeart().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
