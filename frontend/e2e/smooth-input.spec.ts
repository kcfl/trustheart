import { test, expect, type Page } from "@playwright/test";

async function openForm(page: Page) {
  await page.goto("/analysis");
  await page.getByRole("button", { name: "Skip intro", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "TRUST HEART" })).toHaveCount(
    0,
  );
  const pause = page.getByRole("button", {
    name: "Pause background animation",
  });
  if (await pause.isVisible()) await pause.click();
}
async function mountSample(
  page: Page,
  options: { type?: string; defaultValue?: string; dir?: string } = {},
) {
  await page.evaluate(async (options) => {
    const reactPath = "/node_modules/.vite/deps/react.js";
    const domPath = "/node_modules/.vite/deps/react-dom_client.js";
    const inputPath = "/src/components/ui/smooth-input.tsx";
    const { createElement: h } = (await import(/* @vite-ignore */ reactPath))
      .default;
    const { createRoot } = (await import(/* @vite-ignore */ domPath)).default;
    const { SmoothInput } = await import(/* @vite-ignore */ inputPath);
    const host = document.createElement("div");
    host.id = "smooth-test-host";
    Object.assign(host.style, {
      position: "fixed",
      top: "50px",
      left: "20px",
      width: "280px",
      padding: "16px",
      background: "#100818",
      zIndex: "2147483600",
    });
    document.body.appendChild(host);
    createRoot(host).render(
      h(
        "form",
        {},
        h(SmoothInput, { ...options, "aria-label": "Sample input" }),
        h("button", { type: "reset" }, "Reset sample"),
      ),
    );
  }, options);
  await expect(page.getByLabel("Sample input")).toBeVisible();
}

test("analysis fields use a measured spring caret and preserve normal selection/editing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openForm(page);
  const age = page.getByLabel("Age", { exact: true });
  const wrapper = page.locator(".smooth-input-wrapper").first();
  const caret = wrapper.locator(".smooth-input-caret");
  await age.fill("58");
  await expect(wrapper).toHaveAttribute("data-caret-mode", "smooth");
  await expect(caret).toHaveCSS("opacity", "1");
  await expect(age).toHaveCSS("caret-color", "rgba(0, 0, 0, 0)");
  await expect
    .poll(
      async () =>
        await wrapper.evaluate((el) => {
          const input = el.querySelector("input")!;
          const marker = el.querySelector(".smooth-input-caret")!;
          const measure = el.querySelector(
            ".smooth-input-measure",
          )! as HTMLElement;
          const x = new DOMMatrix(getComputedStyle(marker).transform).m41;
          return Math.abs(
            x -
              (parseFloat(getComputedStyle(input).paddingLeft) +
                measure.offsetWidth -
                input.scrollLeft),
          );
        }),
    )
    .toBeLessThan(1);
  await age.press("Home");
  await expect
    .poll(
      async () =>
        await caret.evaluate(
          (el) => new DOMMatrix(getComputedStyle(el).transform).m41,
        ),
    )
    .toBeCloseTo(13, 0);
  await age.press("Shift+End");
  await expect(caret).toHaveCSS("opacity", "0");
  await age.press("6");
  await expect(age).toHaveValue("6");
  await expect(caret).toHaveCSS("opacity", "1");
  await age.press("Backspace");
  await expect(age).toHaveValue("");
  await age.fill("61");
  await page.screenshot({ path: "checks/smooth-input-analysis.png" });
  await page.getByLabel("Systolic blood pressure", { exact: true }).focus();
  await expect(caret).toHaveCSS("display", "none");
  expect(errors).toEqual([]);
});

test("example, clear, errors, review and editing retain the controlled form values", async ({
  page,
}) => {
  await openForm(page);
  await page.getByRole("button", { name: "Fill example", exact: true }).click();
  const age = page.getByLabel("Age", { exact: true });
  await expect(age).toHaveValue("58");
  await age.fill("0x3a");
  await page
    .getByRole("button", { name: "Review inputs", exact: true })
    .click();
  await expect(age).toHaveAttribute("aria-invalid", "true");
  await expect(age).toBeFocused();
  await age.fill("61");
  await page
    .getByRole("button", { name: "Review inputs", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "One last look." }),
  ).toBeVisible();
  await expect(page.locator(".review-list")).toContainText("61 years");
  await page.getByRole("button", { name: "Edit inputs", exact: true }).click();
  await expect(age).toHaveValue("61");
  await page.getByRole("button", { name: "Clear inputs", exact: true }).click();
  await expect(age).toHaveValue("");
  await expect(
    page.getByLabel("Systolic blood pressure", { exact: true }),
  ).toHaveValue("");
});

test("long uncontrolled text scrolls correctly, supports reset and adds no page overflow", async ({
  page,
}) => {
  await openForm(page);
  await mountSample(page, { defaultValue: "Starting text" });
  const input = page.getByLabel("Sample input");
  const wrapper = page.locator("#smooth-test-host .smooth-input-wrapper");
  const text =
    "A long fictional example with enough words to scroll inside the input rather than the page.";
  await input.fill(text);
  await expect(input).toHaveValue(text);
  await expect(wrapper).toHaveAttribute("data-caret-mode", "smooth");
  await expect
    .poll(() => input.evaluate((el) => (el as HTMLInputElement).scrollLeft))
    .toBeGreaterThan(0);
  await expect(wrapper.locator(".smooth-input-caret")).toHaveCSS(
    "opacity",
    "1",
  );
  await input.press("Home");
  await expect
    .poll(() => input.evaluate((el) => (el as HTMLInputElement).scrollLeft))
    .toBe(0);
  await page.getByRole("button", { name: "Reset sample", exact: true }).click();
  await expect(input).toHaveValue("Starting text");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    1440,
  );
});

test("IME and non-Latin text fall back to the native caret without altering input", async ({
  page,
}) => {
  await openForm(page);
  await mountSample(page);
  const input = page.getByLabel("Sample input");
  const wrapper = page.locator("#smooth-test-host .smooth-input-wrapper");
  await input.fill("Sample");
  await expect(wrapper).toHaveAttribute("data-caret-mode", "smooth");
  await input.dispatchEvent("compositionstart", { data: "" });
  await expect(wrapper).toHaveAttribute("data-caret-mode", "native");
  await input.dispatchEvent("compositionend", { data: "" });
  await expect(wrapper).toHaveAttribute("data-caret-mode", "smooth");
  await input.fill("नमस्ते");
  await expect(input).toHaveValue("नमस्ते");
  await expect(wrapper).toHaveAttribute("data-caret-mode", "native");
});

test("password values never enter the measuring span", async ({ page }) => {
  await openForm(page);
  await mountSample(page, { type: "password" });
  const input = page.getByLabel("Sample input");
  await input.fill("fictional-test-password");
  await expect(input).toHaveAttribute("type", "password");
  await expect(
    page.locator("#smooth-test-host .smooth-input-wrapper"),
  ).toHaveAttribute("data-caret-mode", "native");
  await expect(
    page.locator("#smooth-test-host .smooth-input-measure"),
  ).toHaveText("");
});

test("mobile numeric keyboard, reduced motion and forced colors preserve a visible native caret", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openForm(page);
  const input = page.getByLabel("Age", { exact: true });
  await input.fill("58");
  await expect(input).toHaveAttribute("inputmode", "numeric");
  await expect(input).toHaveCSS("font-size", "16px");
  await expect(page.locator(".smooth-input-wrapper").first()).toHaveAttribute(
    "data-caret-mode",
    "native",
  );
  expect(
    await input.evaluate((el) => getComputedStyle(el).caretColor),
  ).not.toBe("rgba(0, 0, 0, 0)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.emulateMedia({
    reducedMotion: "no-preference",
    forcedColors: "active",
  });
  await expect(page.locator(".smooth-input-wrapper").first()).toHaveAttribute(
    "data-caret-mode",
    "native",
  );
});
