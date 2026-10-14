import { test, expect } from "@playwright/test";

test("clear glass preserves controls, original material and scroll depth", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const pause = page.getByRole("button", {
    name: "Pause background animation",
    exact: true,
  });
  if (await pause.isVisible()) await pause.click();
  await expect(
    page.getByRole("button", { name: "Rotate heart", exact: true }),
  ).toBeEnabled({ timeout: 30000 });
  await expect(page.locator(".three-mount canvas")).toHaveAttribute(
    "data-material-mode",
    "original",
  );
  const glass = await page.locator(".coronary-card").evaluate((el) => ({
    filter: getComputedStyle(el).backdropFilter,
    background: getComputedStyle(el).backgroundColor,
    position: getComputedStyle(el).position,
  }));
  expect(glass.filter).toContain("blur(15px)");
  expect(glass.background).toContain("0.19");
  expect(glass.position).toBe("absolute");
  await page.evaluate(() => window.scrollTo({ top: 240, behavior: "instant" }));
  await expect
    .poll(() =>
      page
        .locator(".hero-visual")
        .evaluate((el) => getComputedStyle(el).transform),
    )
    .not.toBe("none");
  await page
    .getByRole("link", { name: /See the bigger picture/ })
    .scrollIntoViewIfNeeded();
  await expect(page.locator("[data-depth]")).toHaveCount(3);
  const card = page.locator(".feature-card").first();
  await expect(card).toHaveAttribute("data-card-reveal", "visible");
  const rect = await card.boundingBox();
  await page.mouse.move(
    rect!.x + rect!.width * 0.7,
    rect!.y + rect!.height * 0.3,
  );
  await expect
    .poll(() =>
      card.evaluate((el) => el.style.getPropertyValue("--glass-light-on")),
    )
    .toBe(".12");
  await expect
    .poll(() => card.evaluate((el) => getComputedStyle(el).transform))
    .toContain("matrix3d");
  await card.click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole("heading", { name: "Your perspective starts here." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("reduced motion leaves content readable and removes depth effects", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("[data-depth]")).toHaveCount(0);
  await expect(page.locator(".reading-progress")).toBeHidden();
  expect(
    await page
      .locator(".hero-visual")
      .evaluate((el) => getComputedStyle(el).transform),
  ).toBe("none");
  await expect(
    page
      .locator(".hero-buttons")
      .getByRole("link", { name: "Start analysis", exact: true }),
  ).toBeVisible();
  await page.locator(".feature-card").first().scrollIntoViewIfNeeded();
  await expect(page.locator(".feature-card h3").first()).toBeVisible();
  expect(
    await page
      .locator(".feature-card")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity),
  ).toBe("1");
});

test("touch layout keeps transparent floating cards in the 3D panel and the footer intact", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const visual = await page.locator(".hero-visual").boundingBox(),
    coronary = await page.locator(".coronary-card").boundingBox();
  expect(coronary!.x).toBeGreaterThanOrEqual(visual!.x - 10);
  expect(coronary!.x + coronary!.width).toBeLessThanOrEqual(390);
  expect(
    await page
      .locator(".coronary-card")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("absolute");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await expect(page.locator("[data-depth]")).toHaveCount(0);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toContainText(
    "Not a medical diagnosis",
  );
});
