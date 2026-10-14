import { test, expect } from "@playwright/test";

const intro = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: "TRUST HEART" });

test("paired display typography rolls center-first, then releases the app and scroll lock", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/analysis");
  await expect(intro(page)).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
  await expect(page.locator(".rolling-letter")).toHaveCount(10);
  await expect(page.locator(".startup-preloader")).toHaveAttribute(
    "data-ready",
    "true",
  );
  const fonts = await page.evaluate(() => ({
    headline: getComputedStyle(document.querySelector(".startup-wordmark")!)
      .fontFamily,
    labels: getComputedStyle(document.querySelector(".startup-corner")!)
      .fontFamily,
    fallback: document.fonts.check('900 32px "Anton"'),
  }));
  expect(fonts.headline).toContain("ABC Gravity");
  expect(fonts.labels).toContain("Space Grotesk");
  expect(fonts.fallback).toBe(true);
  const delays = await page
    .locator(".rolling-text")
    .first()
    .locator(".rolling-letter-track")
    .evaluateAll((nodes) =>
      nodes.map((node) => Number((node as HTMLElement).dataset.rollDelay)),
    );
  expect(delays).toEqual([0.13, 0.065, 0, 0.065, 0.13]);
  await page.waitForTimeout(750);
  const transforms = await page
    .locator(".rolling-text")
    .first()
    .locator(".rolling-letter-track")
    .evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).transform),
    );
  expect(transforms[2]).not.toBe("none");
  expect(transforms[2]).not.toBe(transforms[0]);
  await expect(intro(page)).toHaveCount(0, { timeout: 15000 });
  await expect(
    page.getByRole("heading", { name: "Patient parameters" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
  expect(
    await page
      .locator(".app-after-intro")
      .evaluate((el) => (el as HTMLElement).inert),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("skip and replay preserve route and form inputs", async ({ page }) => {
  await page.goto("/analysis");
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(intro(page)).toHaveCount(0, { timeout: 10000 });
  const pause = page.getByRole("button", {
    name: "Pause background animation",
  });
  if (await pause.isVisible()) await pause.click();
  await page.getByRole("button", { name: "Fill example" }).click();
  await page.getByRole("button", { name: "Replay intro", exact: true }).click();
  await expect(intro(page)).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(1);
  expect(
    await page
      .locator(".app-after-intro")
      .evaluate((el) => (el as HTMLElement).inert),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(intro(page)).toHaveCount(0, { timeout: 10000 });
  await expect(page).toHaveURL(/\/analysis$/);
  await expect(page.getByLabel("Age", { exact: true })).toHaveValue("58");
  await expect(
    page.getByRole("button", { name: "Replay intro", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("scroll exits the intro without trapping navigation", async ({ page }) => {
  await page.goto("/about");
  await expect(intro(page)).toBeVisible();
  await page.mouse.wheel(0, 300);
  await expect(intro(page)).toHaveCount(0, { timeout: 10000 });
  await expect(
    page.getByRole("heading", { name: "A more human understanding." }),
  ).toBeVisible();
});

test("reduced motion displays a static wordmark and exits promptly", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  await expect(page.locator(".rolling-letter-track").first()).toHaveCSS(
    "transform",
    "none",
  );
  await expect(intro(page)).toHaveCount(0, { timeout: 5000 });
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

for (const width of [320, 390, 768, 1440])
  test(`preloader wordmark fits ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/analysis");
    await expect(page.locator(".startup-preloader")).toHaveAttribute(
      "data-ready",
      "true",
    );
    const words = await page
      .locator(".startup-wordmark .rolling-text")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          left: node.getBoundingClientRect().left,
          right: node.getBoundingClientRect().right,
        })),
      );
    for (const word of words) {
      expect(word.left).toBeGreaterThanOrEqual(0);
      expect(word.right).toBeLessThanOrEqual(width);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await expect(
      page.getByRole("button", { name: "Skip intro" }),
    ).toBeVisible();
  });

test("preloader has its own layout when the global stylesheet is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const disableGlobalStyles = () => {
      document
        .querySelectorAll<HTMLStyleElement>("style[data-vite-dev-id]")
        .forEach((node) => {
          node.media = "not all";
        });
      document
        .querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
        .forEach((node) => {
          node.media = "not all";
        });
    };
    new MutationObserver(disableGlobalStyles).observe(document, {
      childList: true,
      subtree: true,
    });
  });
  await page.goto("/analysis");
  const loader = page.getByRole("dialog", { name: "TRUST HEART" });
  await expect(loader).toBeVisible();
  await expect(loader).toHaveCSS("position", "fixed");
  await expect(loader).toHaveCSS("display", "flex");
  await expect(loader).toHaveCSS("background-color", "rgb(5, 5, 5)");
  await expect(page.locator(".startup-wordmark")).toHaveCSS("display", "flex");
  await expect(page.locator(".startup-wordmark")).toHaveCSS(
    "flex-direction",
    "column",
  );
  await expect(page.locator(".rolling-letter").first()).toHaveCSS(
    "overflow",
    "hidden",
  );
  await expect(page.locator(".rolling-letter-track").first()).toHaveCSS(
    "flex-direction",
    "column",
  );
  const geometry = await page
    .locator(".rolling-letter")
    .first()
    .evaluate((el) => ({
      mask: el.getBoundingClientRect().height,
      reel: el.querySelector(".rolling-letter-track")!.getBoundingClientRect()
        .height,
    }));
  expect(geometry.mask).toBeGreaterThan(60);
  expect(geometry.reel / geometry.mask).toBeCloseTo(4, 1);
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(loader).toHaveCount(0, { timeout: 10000 });
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("inline glyph masks remain valid even if every stylesheet is disabled", async ({
  page,
}) => {
  await page.goto("/analysis");
  await expect(page.getByRole("dialog", { name: "TRUST HEART" })).toBeVisible();
  await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) sheet.disabled = true;
  });
  await expect(page.locator(".startup-preloader")).toHaveCSS("display", "flex");
  await expect(page.locator(".startup-preloader")).toHaveCSS(
    "position",
    "fixed",
  );
  await expect(page.locator(".rolling-text-visual").first()).toHaveCSS(
    "display",
    "inline-flex",
  );
  await expect(page.locator(".rolling-letter").first()).toHaveCSS(
    "overflow",
    "hidden",
  );
  await expect(page.locator(".rolling-glyph").first()).toHaveCSS(
    "display",
    "block",
  );
  const size = await page
    .locator(".startup-wordmark")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThan(100);
});
