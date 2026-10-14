import { test, expect } from "@playwright/test";

test("footer routes without a page reload and preserves the analysis session", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/analysis");
  await page.getByRole("button", { name: "Fill example" }).click();
  await page.evaluate(() => {
    (window as Window & { footerTestMarker?: boolean }).footerTestMarker = true;
  });
  const footer = page.getByRole("contentinfo");
  await footer
    .getByRole("link", { name: "About the project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("h1")).toHaveText("A more human understanding.");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { footerTestMarker?: boolean }).footerTestMarker,
    ),
  ).toBe(true);
  await footer
    .getByRole("link", { name: "Start analysis", exact: true })
    .click();
  await expect(page.getByLabel("Age", { exact: true })).toHaveValue("58");
  await expect(page.locator("footer")).toHaveCount(1);
  await expect(footer).toContainText("Not a medical diagnosis");
  await expect(footer).toContainText("SIMULATED DEMO");
  await expect(footer.locator('a[href="#"]')).toHaveCount(0);
});

test("reduced-motion footer is visible with a still beam; pointer glow clears on leave", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toHaveAttribute("data-in", "true");
  await page.waitForTimeout(100);
  expect(
    await footer.evaluate((el) => el.style.getPropertyValue("--bwf-b")),
  ).toBe("58.00%");
  const box = await footer.boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + 100);
  await expect
    .poll(() => footer.evaluate((el) => el.style.getPropertyValue("--bwf-g")))
    .toBe("1");
  await page.mouse.move(0, 0);
  await expect
    .poll(() => footer.evaluate((el) => el.style.getPropertyValue("--bwf-g")))
    .toBe("0");
  await page.waitForTimeout(250);
  expect(
    await footer.evaluate((el) => el.style.getPropertyValue("--bwf-b")),
  ).toBe("58.00%");
  const letter = footer.locator(".bwf-l").first();
  await letter.click();
  await expect(letter).not.toHaveClass(/is-hop/);
});

test("animated beam responds, letters hop and animation pauses offscreen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/about");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  await expect(footer).toHaveAttribute("data-in", "true");
  await expect
    .poll(() => footer.evaluate((el) => el.style.getPropertyValue("--bwf-b")))
    .not.toBe("58.00%");
  await page.waitForTimeout(1600);
  const letter = footer.locator(".bwf-l").nth(2);
  await letter.click();
  await expect(letter).toHaveClass(/is-hop/);
  await expect(letter).not.toHaveClass(/is-hop/, { timeout: 2000 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect
    .poll(() => footer.evaluate((el) => el.style.getPropertyValue("--bwf-b")))
    .toBe("58.00%");
  expect(errors).toEqual([]);
});

test("footer keyboard link and back-to-top keep predictable focus", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const footer = page.getByRole("contentinfo");
  await footer.scrollIntoViewIfNeeded();
  const link = footer.getByRole("link", { name: "Methodology", exact: true });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/methodology$/);
  await footer.getByRole("button", { name: "Back to top" }).click();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator(".site-header .brand")).toBeFocused();
});

for (const width of [320, 390, 768, 1280, 1600])
  test(`footer fits ${width}px with correct letter placement`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/about");
    const footer = page.getByRole("contentinfo");
    await footer.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await expect(footer.locator(".bwf-l")).toHaveCount(10);
    const bounds = await footer.boundingBox();
    const data = await footer.evaluate((el) => ({
      width: document.documentElement.scrollWidth,
      fontSize: parseFloat(
        (el.querySelector(".bwf-word-in") as HTMLElement).style.fontSize,
      ),
      rects: Array.from(el.querySelectorAll(".bwf-l")).map((x) => ({
        left: x.getBoundingClientRect().left,
        right: x.getBoundingClientRect().right,
      })),
    }));
    expect(data.width).toBeLessThanOrEqual(width);
    expect(data.fontSize).toBeGreaterThan(20);
    for (const rect of data.rects) {
      expect(rect.left).toBeGreaterThanOrEqual(bounds!.x);
      expect(rect.right).toBeLessThanOrEqual(bounds!.x + bounds!.width);
    }
    await expect(
      footer.getByRole("button", { name: "Back to top" }),
    ).toBeVisible();
  });
