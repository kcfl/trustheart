import { test, expect, type Page } from "@playwright/test";

type Probe = { programs: number; heart: number; sky: number };
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const win = window as typeof window & { renderProbe: Probe };
    win.renderProbe = { programs: 0, heart: 0, sky: 0 };
    const proto = WebGL2RenderingContext.prototype;
    const create = proto.createProgram;
    proto.createProgram = function () {
      if ((this.canvas as HTMLCanvasElement).closest(".nebula-backdrop"))
        win.renderProbe.programs++;
      return create.call(this);
    };
    for (const key of ["drawArrays", "drawElements"] as const) {
      const original = proto[key] as (...args: number[]) => void;
      proto[key] = function (this: WebGL2RenderingContext, ...args: number[]) {
        const canvas = this.canvas as HTMLCanvasElement;
        if (canvas.closest(".three-mount")) win.renderProbe.heart++;
        if (canvas.closest(".nebula-backdrop")) win.renderProbe.sky++;
        return original.apply(this, args);
      };
    }
  });
}
async function open(page: Page, path = "/about") {
  await page.goto(path);
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "TRUST HEART" })).toHaveCount(
    0,
  );
  await expect(page.locator("[data-nebula-state]")).toHaveAttribute(
    "data-nebula-state",
    "ready",
    { timeout: 20000 },
  );
}
const probe = (page: Page) =>
  page.evaluate(
    () => (window as typeof window & { renderProbe: Probe }).renderProbe,
  );

test("sky pause/resume reuses its WebGL program and stops draws during scroll", async ({
  page,
}) => {
  await instrument(page);
  await open(page);
  const canvas = await page.locator(".nebula-backdrop canvas").elementHandle();
  const before = await probe(page);
  await page.locator(".sky-motion-control").click();
  await page.locator(".sky-motion-control").click();
  expect((await probe(page)).programs).toBe(before.programs);
  expect(
    await canvas!.evaluate(
      (el) => el === document.querySelector(".nebula-backdrop canvas"),
    ),
  ).toBe(true);
  const draws = await page.evaluate(async () => {
    const win = window as typeof window & { renderProbe: Probe };
    // Yield before sampling; drive a real series of native scroll events.
    window.dispatchEvent(new Event("scroll"));
    const before = win.renderProbe.sky;
    await new Promise<void>((resolve) => {
      let start = 0;
      function frame(t: number) {
        if (!start) start = t;
        window.scrollTo({
          top: (300 * (t - start)) / 500,
          behavior: "instant",
        });
        if (t - start < 500) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    return win.renderProbe.sky - before;
  });
  expect(draws).toBe(0);
});

test("heart is render-on-demand while idle, but rotate, pause and wireframe remain usable", async ({
  page,
}) => {
  await instrument(page);
  await open(page, "/");
  const rotate = page.getByRole("button", {
    name: "Rotate heart",
    exact: true,
  });
  await expect(rotate).toBeEnabled({ timeout: 30000 });
  const skyPause = page.getByRole("button", {
    name: "Pause background animation",
    exact: true,
  });
  if (await skyPause.isVisible()) await skyPause.click();
  const canvas = page.locator(".three-mount canvas");
  await expect(canvas).toHaveAttribute("data-material-mode", "original");
  await expect(canvas).toHaveAttribute("data-render-activity", "idle", {
    timeout: 10000,
  });
  const idle = await probe(page);
  await page.waitForTimeout(250);
  expect((await probe(page)).heart).toBe(idle.heart);
  await rotate.click();
  await expect
    .poll(async () => (await probe(page)).heart)
    .toBeGreaterThan(idle.heart);
  await page
    .getByRole("button", { name: "Pause rotation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle wireframe", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Toggle wireframe", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Reset heart view", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-render-activity", "idle", {
    timeout: 10000,
  });
});

test("mobile rendering uses bounded resolution and lighter glass", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const size = await page.locator(".nebula-backdrop canvas").evaluate((el) => ({
    pixels: (el as HTMLCanvasElement).width,
    css: el.clientWidth,
  }));
  expect(size.pixels).toBeLessThanOrEqual(size.css * 0.5 + 1);
  await expect(page.locator(".about-intro")).toHaveCSS(
    "backdrop-filter",
    "blur(8px) saturate(1.4)",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});
