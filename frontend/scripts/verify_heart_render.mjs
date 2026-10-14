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

    console.log("Navigating to /analysis...");
    await desktopPage.goto("http://127.0.0.1:8000/analysis", { waitUntil: "networkidle" });

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
    await desktopPage.waitForURL("**/results", { timeout: 15000 });
    await desktopPage.waitForSelector(".result-heart canvas, canvas[role='img']", { timeout: 15000 });

    // Allow Three.js PMREM and GLTF to render
    await desktopPage.waitForTimeout(3000);

    const desktopPixelStats = await desktopPage.evaluate(() => {
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

    console.log("Desktop Canvas Stats:", desktopPixelStats);
    if (desktopPixelStats.error) {
      throw new Error(`Desktop WebGL check failed: ${desktopPixelStats.error}`);
    }
    if (desktopPixelStats.domWidth === 0 || desktopPixelStats.domHeight === 0) {
      throw new Error("Desktop canvas has 0 DOM dimensions");
    }
    if (desktopPixelStats.nonZeroCount === 0) {
      throw new Error("Desktop canvas is completely blank (0 rendered non-zero pixels)");
    }

    const desktopShot = path.join(outDir, "heart_desktop.png");
    await desktopPage.screenshot({ path: desktopShot });
    console.log(`Saved desktop screenshot to ${desktopShot}`);

    report.push({
      mode: "desktop",
      viewport: "1280x800",
      domDimensions: `${desktopPixelStats.domWidth.toFixed(0)}x${desktopPixelStats.domHeight.toFixed(0)}`,
      bufferDimensions: `${desktopPixelStats.bufferWidth}x${desktopPixelStats.bufferHeight}`,
      totalPixels: desktopPixelStats.totalPixels,
      renderedPixels: desktopPixelStats.nonZeroCount,
      pctDrawn: desktopPixelStats.pctDrawn.toFixed(2) + "%",
      screenshot: "heart_desktop.png",
      status: "PASS",
    });

    await desktopContext.close();

    // 2. MOBILE TEST (390x844)
    console.log("\n--- Testing Mobile (390x844) ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const mobilePage = await mobileContext.newPage();

    console.log("Navigating mobile to /analysis...");
    await mobilePage.goto("http://127.0.0.1:8000/analysis", { waitUntil: "networkidle" });

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
    await mobilePage.waitForURL("**/results", { timeout: 15000 });
    await mobilePage.waitForSelector(".result-heart canvas, canvas[role='img']", { timeout: 15000 });

    await mobilePage.waitForTimeout(3000);

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

    console.log("\n================================================================================");
    console.log("HEART RENDER PROOF SUMMARY");
    console.log("================================================================================");
    for (const r of report) {
      console.log(`[${r.status}] ${r.mode} (${r.viewport}): DOM ${r.domDimensions}, Buffer ${r.bufferDimensions}, Rendered Pixels: ${r.renderedPixels} (${r.pctDrawn}) -> ${r.screenshot}`);
    }
    console.log("================================================================================");

    const reportFile = path.join(repoRoot, "docs", "verification", "heart_render_proof.txt");
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), "utf-8");
  } finally {
    await browser.close();
  }
}

verifyHeart().catch((err) => {
  console.error("FATAL ERROR in verifyHeart:", err);
  process.exit(1);
});
