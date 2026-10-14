import { test, expect, type Page, type Locator } from "@playwright/test";

async function openHome(page: Page) {
  // Keep typography checks independent of software WebGL: use the app's real static fallback.
  await page.route("**/heart.glb", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "TRUST HEART" })).toHaveCount(
    0,
  );
  const pause = page.getByRole("button", {
    name: "Pause background animation",
  });
  if (await pause.isVisible()) await pause.click();
  await expect(page.locator("[data-horizontal-reveal]")).toHaveCount(3);
}
async function progressTo(
  page: Page,
  target: Locator,
  progress: number,
  external = false,
) {
  const y = await target.evaluate(
    (el, { progress, external }) => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const start = top - innerHeight * (external ? 0.86 : 0.88);
      const end = top + rect.height - innerHeight * (external ? 0.68 : 0.45);
      return start + (end - start) * progress;
    },
    { progress, external },
  );
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    Math.max(0, y),
  );
}

test("words reveal in order, move right-to-center and reverse with scroll", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openHome(page);
  const heading = page.getByRole("heading", {
    name: "One heart. More ways to understand.",
    exact: true,
  });
  const words = heading.locator("[data-reveal-word]");
  await expect(words).toHaveCount(6);
  await progressTo(page, heading, 0.46);
  await expect
    .poll(async () =>
      Number(
        await words.first().evaluate((el) => getComputedStyle(el).opacity),
      ),
    )
    .toBeGreaterThan(0.95);
  await expect
    .poll(async () =>
      Number(await words.last().evaluate((el) => getComputedStyle(el).opacity)),
    )
    .toBeLessThan(0.4);
  const transform = await words.last().evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.m41, skew: m.m21 };
  });
  expect(transform.x).toBeGreaterThan(5);
  expect(Math.abs(transform.skew)).toBeGreaterThan(0.01);
  await page.screenshot({ path: "checks/horizontal-text-mid-reveal.png" });
  await progressTo(page, heading, 1);
  for (const word of await words.all())
    await expect(word).toHaveCSS("opacity", "1");
  await expect
    .poll(() =>
      words
        .last()
        .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41),
    )
    .toBeCloseTo(0, 0);
  await progressTo(page, heading, 0.05);
  await expect
    .poll(async () =>
      Number(
        await words.first().evaluate((el) => getComputedStyle(el).opacity),
      ),
    )
    .toBeLessThan(0.3);
  expect(errors).toEqual([]);
});

test("workflow words track the section while its introduction stays sticky", async ({
  page,
}) => {
  await openHome(page);
  const track = page.locator(".horizontal-reveal-track");
  const sticky = page.locator(".horizontal-reveal-sticky");
  await expect(sticky).toHaveCSS("position", "sticky");
  const top = await track.evaluate(
    (el) => el.getBoundingClientRect().top + scrollY,
  );
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top,
  );
  const first = (await sticky.boundingBox())!.y;
  await page.evaluate(
    (y) => window.scrollTo({ top: y, behavior: "instant" }),
    top + 80,
  );
  const second = (await sticky.boundingBox())!.y;
  expect(Math.abs(first - second)).toBeLessThan(2);
  await progressTo(page, track, 1, true);
  for (const word of await sticky.locator("[data-reveal-word]").all())
    await expect(word).toHaveCSS("opacity", "1");
  await expect(
    sticky.getByRole("link", { name: "Explore a demo analysis" }),
  ).toBeVisible();
  await page.screenshot({ path: "checks/horizontal-text-sticky.png" });
});

for (const width of [320, 390])
  test(`mobile ${width}px keeps normal scrolling and no horizontal overflow`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await openHome(page);
    await expect(page.locator(".horizontal-reveal-sticky")).toHaveCSS(
      "position",
      "static",
    );
    for (const heading of await page
      .locator("[data-horizontal-reveal]")
      .all()) {
      await progressTo(page, heading, 1);
      for (const word of await heading.locator("[data-reveal-word]").all())
        await expect(word).toHaveCSS("opacity", "1");
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
    }
  });

test("reduced motion provides complete readable headings without sticky pinning", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page);
  await expect(page.locator('[data-horizontal-reveal="static"]')).toHaveCount(
    3,
  );
  await expect(page.locator("[data-reveal-word]")).toHaveCount(0);
  await expect(page.locator(".horizontal-reveal-sticky")).toHaveCSS(
    "position",
    "static",
  );
  await expect(
    page.getByRole("heading", {
      name: "Transparency isn't a feature. It's the foundation.",
      exact: true,
    }),
  ).toHaveCount(1);
  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "active",
  });
  for (const word of await page.locator("[data-reveal-word]").all())
    await expect(word).toHaveCSS("opacity", "1");
  await expect(page.locator(".horizontal-reveal-sticky")).toHaveCSS(
    "position",
    "static",
  );
});
