import { test, expect, type Browser, type Page } from "@playwright/test";
import { ADMIN, loginAs, DEMO_PASSWORD } from "./helpers";

const PAGES = ["/engineer", "/billing", "/customers", "/lump-sum", "/other", "/held", "/team", "/account", "/admin", "/"];
const ZONES = ["America/Anchorage", "UTC", "Pacific/Auckland", "Asia/Kolkata", "America/New_York", "Europe/London"];
const LOCALES = ["en-US", "en-GB", "de-DE", "ja-JP"];

function watch(page: Page, errors: string[]) {
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource|favicon|manifest|fonts\.g/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
}

async function makeUser(page: Page, role: string) {
  const name = `Sweep ${role} ${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const res = await page.request.post("/api/users", { data: { name, email: `${name.replace(/\W/g, "").toLowerCase()}@example.com`, role, password: "sweep-pass-1" } });
  expect(res.status()).toBe(201);
  return name;
}

async function signIn(browser: Browser, name: string, opts: { timezoneId?: string; locale?: string } = {}) {
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100", ...opts });
  const page = await ctx.newPage();
  const errors: string[] = [];
  watch(page, errors);
  await page.goto("/engineer");
  await page.getByRole("combobox", { name: "Who are you?", exact: true }).click();
  await page.getByRole("listbox", { name: "Who are you?" }).getByRole("option", { name }).first().click();
  await page.getByLabel("Password", { exact: true }).fill("sweep-pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByLabel("New entry hours")).toBeVisible();
  return { ctx, page, errors };
}

for (const role of ["engineer", "accountant"]) {
  test(`brand-new ${role}: every page, no client errors`, async ({ page, browser }) => {
    await loginAs(page, ADMIN);
    const name = await makeUser(page, role);
    const { ctx, page: p, errors } = await signIn(browser, name);
    for (const path of PAGES) {
      await p.goto(path);
      await p.waitForTimeout(700);
      await expect(p.getByText(/Application error|client-side exception/i)).toHaveCount(0);
    }
    // use the timesheet like a first-time user
    await p.goto("/engineer");
    await p.getByLabel("New entry hours").fill("2");
    await p.getByLabel("New entry hours").press("Enter");
    await p.waitForTimeout(800);
    await p.reload();
    await p.waitForTimeout(800);
    await p.getByTestId("weeks-toggle-all").click().catch(() => {});
    expect(errors, errors.join("\n")).toEqual([]);
    await ctx.close();
  });
}

for (const tz of ZONES) {
  for (const locale of LOCALES) {
    test(`timezone ${tz} / locale ${locale}: timesheet + billing render`, async ({ page, browser }) => {
      await loginAs(page, ADMIN);
      const name = await makeUser(page, "engineer");
      const { ctx, page: p, errors } = await signIn(browser, name, { timezoneId: tz, locale });
      for (const path of ["/engineer", "/billing", "/customers", "/held", "/team"]) {
        await p.goto(path);
        await p.waitForTimeout(500);
        await expect(p.getByText(/Application error|client-side exception/i)).toHaveCount(0);
      }
      await p.goto("/engineer");
      await p.getByLabel("New entry hours").fill("1:30");
      await p.getByLabel("New entry hours").press("Enter");
      await p.waitForTimeout(600);
      expect(errors, errors.join("\n")).toEqual([]);
      await ctx.close();
    });
  }
}

test("storage blocked (private mode / strict settings): app still loads", async ({ page, browser }) => {
  await loginAs(page, ADMIN);
  const name = await makeUser(page, "engineer");
  const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
  await ctx.addInitScript(() => {
    const boom = () => { throw new DOMException("denied", "SecurityError"); };
    Object.defineProperty(window, "localStorage", { get: boom });
    Object.defineProperty(window, "sessionStorage", { get: boom });
  });
  const p = await ctx.newPage();
  const errors: string[] = [];
  watch(p, errors);
  await p.goto("/engineer");
  await p.getByRole("combobox", { name: "Who are you?", exact: true }).click();
  await p.getByRole("listbox", { name: "Who are you?" }).getByRole("option", { name }).first().click();
  await p.getByLabel("Password", { exact: true }).fill("sweep-pass-1");
  await p.getByRole("button", { name: "Sign in" }).click();
  await expect(p.getByLabel("New entry hours")).toBeVisible();
  for (const path of ["/billing", "/customers", "/lump-sum", "/team"]) { await p.goto(path); await p.waitForTimeout(400); }
  expect(errors, errors.join("\n")).toEqual([]);
  await ctx.close();
});
