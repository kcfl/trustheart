import { test, expect, type Page } from "@playwright/test";

async function openPage(page: Page, path = "/about") {
  await page.goto(path);
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "TRUST HEART" })).toHaveCount(
    0,
  );
  const pause = page.getByRole("button", {
    name: "Pause background animation",
  });
  if (await pause.isVisible()) await pause.click();
}

test("desktop scroll reveals CSS-only masked blur while keeping the centre clear", async ({
  page,
}) => {
  await openPage(page);
  const top = page.locator('[data-progressive-blur="top"]');
  const bottom = page.locator('[data-progressive-blur="bottom"]');
  await expect(top).toHaveCSS("backdrop-filter", "blur(6px)");
  await expect(top).toHaveCSS("height", "96px");
  await expect(top).toHaveCSS("pointer-events", "none");
  await expect(top).toHaveAttribute("aria-hidden", "true");
  const mask = await top.evaluate((el) => getComputedStyle(el).maskImage);
  expect(mask).toContain("linear-gradient");
  const timelineSupported = await page.evaluate(() =>
    CSS.supports("animation-timeline", "scroll(root block)"),
  );
  if (timelineSupported) await expect(top).toHaveCSS("opacity", "0");
  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "instant" }));
  if (timelineSupported) await expect(top).toHaveCSS("opacity", "1");
  const topBox = (await top.boundingBox())!;
  const bottomBox = (await bottom.boundingBox())!;
  expect(topBox.y).toBeCloseTo(0, 0);
  expect(bottomBox.y + bottomBox.height).toBeCloseTo(1000, 0);
  expect(bottomBox.y - (topBox.y + topBox.height)).toBeGreaterThan(700);
  await page.screenshot({ path: "checks/progressive-blur-desktop.png" });
});

test("blur ends before the original footer and keeps the project credit", async ({
  page,
}) => {
  await openPage(page);
  await page.locator("footer").scrollIntoViewIfNeeded();
  const footer = (await page.locator("footer").boundingBox())!;
  const frame = (await page.locator(".reading-blur-frame").boundingBox())!;
  expect(frame.y + frame.height).toBeLessThanOrEqual(footer.y + 1);
  await expect(page.locator('footer [data-project-credit="sspro"]')).toHaveText(
    "inspired by SSPRO🎀",
  );
  await expect(
    page.getByRole("button", { name: "Back to top", exact: true }),
  ).toBeVisible();
});

test("mobile uses 4px blur, fits 390px and suspends behind the menu", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page);
  await page.evaluate(() => window.scrollTo({ top: 300, behavior: "instant" }));
  const top = page.locator('[data-progressive-blur="top"]');
  await expect(top).toHaveCSS("backdrop-filter", "blur(4px)");
  await expect(top).toHaveCSS("height", "64px");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "checks/progressive-blur-mobile.png" });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.locator(".reading-blur-frame")).toHaveCSS(
    "visibility",
    "hidden",
  );
});

test("keyboard focus remains crisp and analysis forms have no blur overlays", async ({
  page,
}) => {
  await openPage(page);
  await page.keyboard.press("Tab");
  await page.locator("main a").first().focus();
  await expect(page.locator(".reading-blur-frame")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.locator("main a").first().click();
  await expect(page).toHaveURL(/\/analysis$/);
  await expect(page.locator(".progressive-blur")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Patient parameters" }),
  ).toBeVisible();
});

test("reduced motion disables the blur without hiding content", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openPage(page);
  await expect(page.locator('[data-progressive-blur="top"]')).toHaveCSS(
    "display",
    "none",
  );
  await expect(
    page.getByRole("heading", { name: "A more human understanding." }),
  ).toBeVisible();
  await page.emulateMedia({
    forcedColors: "active",
    reducedMotion: "no-preference",
  });
  await expect(page.locator('[data-progressive-blur="top"]')).toHaveCSS(
    "display",
    "none",
  );
});

for (const viewport of [
  { width: 320, height: 740 },
  { width: 667, height: 375 },
]) {
  test(`reading edges fit ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openPage(page, "/methodology");
    await page.evaluate(() =>
      window.scrollTo({ top: 250, behavior: "instant" }),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
    const edges = page.locator(".reading-blur-frame .progressive-blur");
    await expect(edges).toHaveCount(2);
    const first = (await edges.first().boundingBox())!;
    expect(first.x).toBeGreaterThanOrEqual(0);
    expect(first.x + first.width).toBeLessThanOrEqual(viewport.width);
    expect(first.height).toBe(viewport.height < 500 ? 44 : 64);
  });
}
