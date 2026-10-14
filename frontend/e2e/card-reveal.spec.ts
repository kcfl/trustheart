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

test("offscreen cards fade upward once, with desktop stagger and no layout shift", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openPage(page);
  const cards = page.locator(".team-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toHaveAttribute("data-card-reveal", "pending");
  await expect(cards.first()).toHaveCSS("opacity", "0");
  const beforeHeight = await page
    .locator("main")
    .evaluate((e) => e.getBoundingClientRect().height);
  // Observe the real transition start rather than relying on screenshot timing.
  const starts = await page.evaluate(async () => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>(".team-card"),
    );
    return await new Promise<string[]>((resolve) => {
      const observer = new MutationObserver(() => {
        if (cards.every((card) => card.dataset.cardReveal === "entering")) {
          const delays = cards.map((card) =>
            card.style.getPropertyValue("--card-reveal-delay"),
          );
          observer.disconnect();
          resolve(delays);
        }
      });
      cards.forEach((card) =>
        observer.observe(card, {
          attributes: true,
          attributeFilter: ["data-card-reveal"],
        }),
      );
      window.scrollTo({ top: 600, behavior: "instant" });
    });
  });
  expect(starts).toEqual(["0ms", "75ms", "150ms"]);
  await expect(cards.first()).toHaveAttribute("data-card-reveal", "visible");
  await expect(cards.last()).toHaveAttribute("data-card-reveal", "visible");
  await expect(cards.first()).toHaveCSS("opacity", "1");
  await expect(cards.first()).toHaveCSS("translate", "none");
  await expect(cards.first()).toHaveCSS("will-change", "auto");
  expect(
    await page
      .locator("main")
      .evaluate((e) => e.getBoundingClientRect().height),
  ).toBeCloseTo(beforeHeight, 0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await expect(cards.first()).toHaveAttribute("data-card-reveal", "visible");
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await page.screenshot({ path: "checks/card-reveal-desktop.png" });
  expect(errors).toEqual([]);
});

test("keyboard focus reveals a pending card immediately and navigation discovers new cards", async ({
  page,
}) => {
  await openPage(page);
  const credit = page.locator(".acknowledgements");
  await expect(credit).toHaveAttribute("data-card-reveal", "pending");
  await credit.getByRole("link").first().focus();
  await expect(credit).toHaveAttribute("data-card-reveal", "visible");
  await expect(credit).toHaveCSS("opacity", "1");
  await page
    .locator(".desktop-nav")
    .getByRole("link", { name: "Methodology", exact: true })
    .click();
  await expect(page.locator(".pipeline-card")).toHaveCount(4);
  await expect(page.locator(".pipeline-card").last()).toHaveAttribute(
    "data-card-reveal",
    /pending|visible|entering/,
  );
  await page.locator(".pipeline-card").last().scrollIntoViewIfNeeded();
  await expect(page.locator(".pipeline-card").last()).toHaveAttribute(
    "data-card-reveal",
    "visible",
  );
});

test("reduced motion and live preference changes never leave hidden cards", async ({
  page,
}) => {
  await openPage(page);
  await expect(page.locator(".team-card").first()).toHaveAttribute(
    "data-card-reveal",
    "pending",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const card of await page.locator("[data-scroll-card]").all()) {
    await expect(card).toHaveAttribute("data-card-reveal", "visible");
    await expect(card).toHaveCSS("opacity", "1");
    await expect(card).toHaveCSS("translate", "none");
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".team-card").first()).toHaveAttribute(
    "data-card-reveal",
    "visible",
  );
});

test("mobile cards use a smaller lift and leave the footer and form untouched", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page);
  const card = page.locator(".team-card").first();
  await expect(card).toHaveAttribute("data-card-reveal", "pending");
  await expect(card).toHaveCSS("translate", "0px 16px");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toHaveAttribute("data-card-reveal", "visible");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await expect(page.locator("footer [data-scroll-card]")).toHaveCount(0);
  await page.goto("/analysis");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expect(page.locator(".form-panel[data-scroll-card]")).toHaveCount(0);
  await page.getByLabel("Age", { exact: true }).fill("58");
  await expect(page.getByLabel("Age", { exact: true })).toHaveValue("58");
});
