import { test, expect } from "@playwright/test";

for (const width of [320, 390, 1440]) {
  test(`approved credit is visible and unwrapped at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/about");
    const credit = page.locator('footer [data-project-credit="sspro"]');
    await expect(credit).toHaveCount(1);
    await credit.scrollIntoViewIfNeeded();
    await expect(credit).toBeVisible();
    await expect(credit).toHaveText("inspired by SSPRO🎀");
    await expect(credit).toHaveCSS("white-space", "nowrap");
    await expect(
      page.getByText("Progressive blur adapted from", { exact: false }),
    ).toHaveCount(0);
    await expect(
      page
        .locator("footer")
        .getByRole("link", { name: "Skiper UI", exact: true }),
    ).toHaveCount(0);
    const bounds = (await credit.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    if (width === 1440)
      await page
        .locator("footer")
        .screenshot({ path: "checks/sspro-footer.png" });
  });
}

test("the shared credit survives navigation across all six routes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of [
    "/",
    "/analysis",
    "/results",
    "/explainability",
    "/methodology",
    "/about",
  ]) {
    await page.goto(path);
    const credit = page.locator('footer [data-project-credit="sspro"]');
    await expect(credit).toHaveCount(1);
    await expect(credit).toHaveText("inspired by SSPRO🎀");
  }
});
