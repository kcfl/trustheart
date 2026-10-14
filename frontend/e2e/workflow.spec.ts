import { test, expect } from "@playwright/test";

test("complete clinical prediction workflow, validation, target selection, chart table, export, and stale-result prevention", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/results");
  await expect(
    page.getByRole("heading", { name: "Your perspective starts here." }),
  ).toBeVisible();

  await page
    .getByRole("link", { name: "Start analysis", exact: true })
    .last()
    .click();

  // Try submitting empty to trigger validation
  await page
    .getByRole("button", { name: "Review inputs", exact: true })
    .click();
  await expect(page.getByText("Age is required.")).toBeVisible();
  await expect(page.getByLabel("Age", { exact: true })).toBeFocused();

  // Fill example
  await page.getByRole("button", { name: "Fill example" }).click();
  await expect(page.getByLabel("Age", { exact: true })).toHaveValue("58");

  await page
    .getByRole("button", { name: "Review inputs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review clinical inputs" }),
  ).toBeVisible();

  // Consent checkbox required
  const submitBtn = page.getByRole("button", { name: "Run prediction" });
  await expect(submitBtn).toBeDisabled();

  await page.getByRole("checkbox").check();
  await expect(submitBtn).toBeEnabled();

  // Route mock or live response if backend running
  await page.route("**/api/predict", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        request_id: "e2e-test",
        mode: "quick",
        model_version: "ml-v1 (test)",
        predictions: {
          CAD: {
            raw_probability: 0.72,
            calibrated_probability: 0.68,
            band: "higher",
            display_probability: 0.68,
            display_band: "higher",
            adjusted: false,
            base: 0.5,
            contributions: [{ feature: "Age", value: 58, contribution: 0.35, direction: "up" }],
            other_total: 0,
            logit_model: 0.85,
            model_info: { config_name: "compact|LR|C=0.001", n_features: 7, features_used: ["Age"], source_space: "quick" },
            base_rate: 0.71,
          },
          LAD: {
            raw_probability: 0.55,
            calibrated_probability: 0.52,
            band: "intermediate",
            display_probability: 0.52,
            display_band: "intermediate",
            adjusted: false,
            base: 0.2,
            contributions: [],
            other_total: 0,
            logit_model: 0.2,
            model_info: { config_name: "compact|LR|C=0.001", n_features: 7, features_used: [], source_space: "quick" },
            base_rate: 0.58,
          },
          LCX: {
            raw_probability: 0.25,
            calibrated_probability: 0.28,
            band: "lower",
            display_probability: 0.28,
            display_band: "lower",
            adjusted: false,
            base: -0.4,
            contributions: [],
            other_total: 0,
            logit_model: -0.4,
            model_info: { config_name: "compact|LR|C=0.03", n_features: 7, features_used: [], source_space: "quick" },
            base_rate: 0.39,
          },
          RCA: {
            raw_probability: 0.35,
            calibrated_probability: 0.38,
            band: "intermediate",
            display_probability: 0.38,
            display_band: "intermediate",
            adjusted: false,
            base: -0.5,
            contributions: [],
            other_total: 0,
            logit_model: -0.5,
            model_info: { config_name: "compact|LR|C=0.001", n_features: 7, features_used: [], source_space: "quick" },
            base_rate: 0.38,
          },
        },
        consistency: { status: "ok", lower: 0.52, upper: 1.0, p_cad_model: 0.68, p_cad_adjusted: 0.68 },
        trust: {
          similar_patients: [{ case_id: 42, distance: 1.1, age_band: "55-64", sex: "Male", outcomes: { CAD: 1, LAD: 1, LCX: 0, RCA: 0 } }],
          evidence_auc: { CAD: 0.89, LAD: 0.78, LCX: 0.72, RCA: 0.73 },
          lift: {},
          bands_note: "Bands note",
        },
        imputed: [],
        warnings: [],
        disclaimer: "Decision support / educational use only.",
        limitations: ["Single-centre dataset."],
      }),
    });
  });

  await submitBtn.click();
  await expect(page).toHaveURL(/\/results$/);

  await expect(page.locator(".probability-card")).toHaveCount(4);
  await expect(page.locator(".probability-card").first()).toContainText("68%");

  await page
    .locator(".artery-selector")
    .getByRole("button", { name: "LAD", exact: true })
    .click();
  await expect(page.locator(".target-detail h2")).toHaveText("LAD");
  await expect(page.locator(".target-detail .selected-value")).toContainText("52%");

  await page.getByRole("button", { name: "Show data table" }).click();
  await expect(page.getByRole("table")).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export results" }).click();
  expect((await download).suggestedFilename()).toContain("trustheart-prediction");

  await expect(
    page.getByRole("button", { name: "Rotate heart", exact: true }),
  ).toBeEnabled({ timeout: 30000 });

  await page.getByRole("link", { name: "New analysis" }).click();
  await page.getByLabel("Age", { exact: true }).fill("61");
  await page
    .locator("footer")
    .getByRole("link", { name: "Results", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your perspective starts here." }),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("3D controls and static fallback work without changing claims", async ({
  page,
}) => {
  await page.goto("/");
  const rotate = page.getByRole("button", {
    name: "Rotate heart",
    exact: true,
  });
  await expect(rotate).toBeEnabled({ timeout: 30000 });
  await rotate.click();
  await expect(
    page.getByRole("button", { name: "Pause rotation" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Toggle wireframe" }).click();
  await expect(
    page.getByRole("button", { name: "Toggle wireframe" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reset heart view" }).click();
  await page.getByRole("button", { name: "Use static view" }).click();
  await expect(
    page.getByAltText("Original textured anatomical heart model"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enable 3D view" }),
  ).toBeVisible();
});

test("mobile navigation, explanation tabs and methodology accordions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator("#mobile-nav")
    .getByRole("link", { name: "Model insights" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Behind every prediction." }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "This prediction" }).click();
  await page.goto("/methodology");
  await page
    .getByRole("button", { name: /A small cohort is not a population|Single-centre dataset/ })
    .click();
});

test("cancel preserves inputs and never creates a result", async ({ page }) => {
  await page.goto("/analysis");
  await page.getByRole("button", { name: "Fill example" }).click();
  await page
    .getByRole("button", { name: "Review inputs", exact: true })
    .click();
  await page.getByRole("checkbox").check();

  // Mock slow route to test cancel
  await page.route("**/api/predict", async () => {
    // Hangs to allow cancel click
  });
  await page.getByRole("button", { name: "Run prediction" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Review clinical inputs" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit inputs" }).click();
  await expect(page.getByLabel("Age", { exact: true })).toHaveValue("58");
});

for (const width of [320, 390, 768, 1280, 1600]) {
  test(`responsive pages at ${width}px, reduced motion and no horizontal overflow`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/",
      "/analysis",
      "/results",
      "/explainability",
      "/methodology",
      "/about",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const heading = await page.locator("h1").boundingBox();
      expect(heading!.x + heading!.width).toBeLessThanOrEqual(width);
    }
  });
}

test("failed 3D asset keeps the static reference and analysis CTA usable", async ({
  page,
}) => {
  await page.route("**/heart.glb", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("3D unavailable · static anatomy view"),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByAltText("Original textured anatomical heart model"),
  ).toBeVisible();
  await page
    .locator(".hero-buttons")
    .getByRole("link", { name: "Start analysis" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Clinical parameters" }),
  ).toBeVisible();
});
