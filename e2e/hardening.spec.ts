import { test, expect } from "@playwright/test";
import { ENGINEER, loginAs } from "./helpers";

async function base(page: import("@playwright/test").Page) {
  const me = (await (await page.request.get("/api/auth/me")).json()).data;
  const dir = (await (await page.request.get("/api/customers")).json()).data;
  return { userId: me.id, customerId: dir[0].id };
}

test("health endpoint reports the database", async ({ request }) => {
  const j = await (await request.get("/api/health")).json();
  expect(j.ok).toBe(true);
});

test("bad input is rejected", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const b = await base(page);
  const ok = await page.request.post("/api/time-entries", { data: { ...b, date: "2026-01-05", durationMinutes: 60 } });
  expect(ok.status()).toBe(201);
  for (const bad of [
    { date: "2026-13-40", durationMinutes: 60 },
    { date: "yesterday", durationMinutes: 60 },
    { date: "2026-01-05", durationMinutes: -5 },
    { date: "2026-01-05", durationMinutes: 99999 },
    { date: "2026-01-05", durationMinutes: "abc" },
  ]) {
    const r = await page.request.post("/api/time-entries", { data: { ...b, ...bad } });
    expect(r.status(), JSON.stringify(bad)).toBe(400);
  }
  const id = (await ok.json()).data.id;
  expect((await page.request.put(`/api/time-entries/${id}`, { data: { durationMinutes: 0 } })).status()).toBe(400);
  expect((await page.request.put(`/api/time-entries/${id}`, { data: { customerId: "nope" } })).status()).toBe(400);
});

test("billing requests are validated", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const b = await base(page);
  for (const bad of [
    { from: "x", to: "2026-01-02", customers: [{ id: b.customerId }] },
    { from: "2026-02-01", to: "2026-01-02", customers: [{ id: b.customerId }] },
    { from: "2026-01-01", to: "2026-01-02", customers: [] },
  ]) expect((await page.request.post("/api/billing/preview", { data: bad })).status()).toBe(400);
  expect((await page.request.get("/api/billing/summary?from=bad&to=bad")).status()).toBe(400);
  // signed-out visitors get nothing
  await page.request.post("/api/auth/logout");
  expect((await page.request.get("/api/billing/summary?from=2026-01-01&to=2026-01-02")).status()).toBe(401);
  expect((await page.request.get("/api/invoices")).status()).toBe(401);
});

test("CSV export: formulas are defused and columns follow the workbook", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const b = await base(page);
  await page.request.post("/api/time-entries", { data: { ...b, date: "2026-01-06", durationMinutes: 30, notes: "=HYPERLINK(\"http://x\")" } });
  const res = await page.request.get("/api/export/csv?startDate=2026-01-06&endDate=2026-01-06");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text.split("\n")[0]).toMatch(/DATE/i);
  expect(text).toContain("'=HYPERLINK");
  expect(text).not.toMatch(/"=HYPERLINK/);
});

test.describe("first visit to the bare address", () => {
  test("/ is a real server redirect (works with JavaScript off)", async ({ request, browser }) => {
    const res = await request.get("/", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()["location"]).toMatch(/\/engineer$/);
    const ctx = await browser.newContext({ baseURL: "http://localhost:3100", javaScriptEnabled: false });
    const p = await ctx.newPage();
    await p.goto("/");
    await expect(p).toHaveURL(/\/engineer$/);
    await ctx.close();
  });

  test("the old addresses still lead somewhere", async ({ request }) => {
    for (const [from, to] of [["/accountant", "/billing"], ["/tasks", "/customers"]]) {
      const res = await request.get(from, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(res.headers()["location"]).toMatch(new RegExp(`${to}$`));
    }
  });

  test("auto-translate is switched off for the page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("translate", "no");
  });

  test("the first visit shows the sign-in screen with no errors, even with fresh storage and no cookies", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: "http://localhost:3100" });
    const p = await ctx.newPage();
    const errors: string[] = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto("/");
    await expect(p.getByRole("button", { name: "Sign in" })).toBeVisible();
    await p.waitForTimeout(800);
    expect(errors).toEqual([]);
    await ctx.close();
  });
});
