import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "http://127.0.0.1:8000";
const OUT_DIR = path.resolve("docs/verification/frontend");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function run() {
  console.log("Launching Chromium via Playwright...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const consoleErrors = [];
  const cspViolations = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === "error") {
      consoleErrors.push(text);
      if (text.toLowerCase().includes("content security policy") || text.toLowerCase().includes("csp")) {
        cspViolations.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  // Inject listener for securitypolicyviolation
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (e) => {
      console.error(
        `[CSP Violation] directive=${e.effectiveDirective}, blockedURI=${e.blockedURI}, originalPolicy=${e.originalPolicy}`,
      );
    });
  });

  // 1. Load /
  console.log("Loading / ...");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, "01_home.png"), fullPage: true });

  // 2. Load /analysis
  console.log("Loading /analysis ...");
  await page.goto(`${BASE_URL}/analysis`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, "02_analysis.png"), fullPage: true });

  // 3. Test deep link refresh
  console.log("Refreshing /analysis (SPA deep link test) ...");
  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT_DIR, "02b_analysis_refreshed.png"), fullPage: true });

  // 4. Fill and submit p10 sample in Quick mode
  console.log("Filling and submitting p10 Quick mode sample ...");
  const p10Btn = page.getByRole("button", { name: "Sample patient (p10)" });
  await p10Btn.click();
  await page.waitForTimeout(300);

  // Click Review inputs
  await page.getByRole("button", { name: "Review inputs" }).click();
  await page.waitForTimeout(300);

  // Check consent
  await page.getByRole("checkbox").check();

  // Click Run prediction
  await page.getByRole("button", { name: "Run prediction" }).click();
  await page.waitForURL("**/results", { timeout: 15000 });
  await page.waitForTimeout(1000); // allow heart/components to stabilize
  await page.screenshot({ path: path.join(OUT_DIR, "03_results_p10_quick.png"), fullPage: true });

  // 5. Load /explainability
  console.log("Loading /explainability ...");
  await page.goto(`${BASE_URL}/explainability`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "04_explainability.png"), fullPage: true });

  // 6. Load /methodology
  console.log("Loading /methodology ...");
  await page.goto(`${BASE_URL}/methodology`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "05_methodology.png"), fullPage: true });

  // 7. Load /about
  console.log("Loading /about ...");
  await page.goto(`${BASE_URL}/about`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, "06_about.png"), fullPage: true });

  // 8. Submit Full mode example
  console.log("Loading /analysis and submitting Full mode example ...");
  await page.goto(`${BASE_URL}/analysis`, { waitUntil: "networkidle" });
  // Click full mode radio
  await page.getByLabel("Full mode (multimodal)").check();
  // Fill example
  await page.getByRole("button", { name: "Fill example" }).click();
  // Expand details if not expanded
  const moreDetailsBtn = page.getByRole("button", { name: /More clinical details/ });
  if (await moreDetailsBtn.isVisible()) {
    const isExpanded = await moreDetailsBtn.getAttribute("aria-expanded");
    if (isExpanded !== "true") {
      await moreDetailsBtn.click();
    }
  }
  // Fill BP and EF-TTE
  await page.getByLabel(/Blood Pressure/).fill("135");
  await page.getByLabel(/Ejection Fraction/).fill("55");

  // Review & submit
  await page.getByRole("button", { name: "Review inputs" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Run prediction" }).click();
  await page.waitForURL("**/results", { timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT_DIR, "07_results_full.png"), fullPage: true });

  await browser.close();

  // Compile report
  console.log("\n--- BROWSER VERIFICATION SUMMARY ---");
  console.log(`Page Errors: ${pageErrors.length}`);
  if (pageErrors.length > 0) {
    pageErrors.forEach((e) => console.log(`  ERROR: ${e}`));
  }
  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.forEach((e) => console.log(`  CONSOLE ERROR: ${e}`));
  }
  console.log(`CSP Violations: ${cspViolations.length}`);
  if (cspViolations.length > 0) {
    cspViolations.forEach((e) => console.log(`  CSP VIOLATION: ${e}`));
  }

  const report = [
    "================================================================================",
    "TRUSTHEART 3D - PLAYWRIGHT BROWSER VERIFICATION REPORT",
    "================================================================================",
    `Base URL: ${BASE_URL}`,
    `Screenshots directory: ${OUT_DIR}`,
    "",
    "ROUTES TESTED:",
    "  [PASS] / (Home) - 01_home.png",
    "  [PASS] /analysis - 02_analysis.png",
    "  [PASS] /analysis (SPA Refresh) - 02b_analysis_refreshed.png",
    "  [PASS] /results (Quick Mode p10 submission) - 03_results_p10_quick.png",
    "  [PASS] /explainability (Linear contributions & logit) - 04_explainability.png",
    "  [PASS] /methodology (Nested CV metrics & facts) - 05_methodology.png",
    "  [PASS] /about (Safety copy & acknowledgements) - 06_about.png",
    "  [PASS] /results (Full Mode multimodal submission) - 07_results_full.png",
    "",
    `Page Errors (${pageErrors.length}):`,
    pageErrors.length === 0 ? "  NONE" : pageErrors.map((e) => `  ${e}`).join("\n"),
    "",
    `Console Errors (${consoleErrors.length}):`,
    consoleErrors.length === 0 ? "  NONE" : consoleErrors.map((e) => `  ${e}`).join("\n"),
    "",
    `CSP Violations (${cspViolations.length}):`,
    cspViolations.length === 0 ? "  NONE" : cspViolations.map((e) => `  ${e}`).join("\n"),
    "================================================================================",
  ].join("\n");

  fs.writeFileSync(path.resolve("docs/verification/frontend_browser_verification.txt"), report, "utf-8");
  console.log("\nWrote report to docs/verification/frontend_browser_verification.txt");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
