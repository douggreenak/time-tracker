import { test, expect } from "@playwright/test";
import { ENGINEER, expandAllWeeks, loginAs } from "./helpers";

test("demo data comes from the Apex workbook", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const all = (await (await page.request.get("/api/time-entries")).json()).data as { durationMinutes: number; isHeld: boolean; customerName: string }[];
  const logged = all.filter((e) => !e.isHeld && (e as any).createdAt === "2026-11-20T12:00:00.000Z"); // the workbook rows (other tests add their own)
  expect(logged.length).toBe(263);
  expect(logged.reduce((n, e) => n + e.durationMinutes, 0) / 60).toBeCloseTo(743.5, 1);
  expect(all.filter((e) => e.isHeld).length).toBe(9);
  expect(new Set(logged.map((e) => e.customerName)).size).toBeGreaterThanOrEqual(30);
  const customers = (await (await page.request.get("/api/customers")).json()).data as { name: string }[];
  expect(customers.length).toBeGreaterThanOrEqual(43); // other tests may add more
  expect(customers.map((c) => c.name)).toContain("HARBOR WTP");
});

test("every old week starts collapsed; the gap row and expand-all work", async ({ page }) => {
  await loginAs(page, ENGINEER);
  await expect(page.getByTestId("entry-week-gap")).toHaveCount(1);
  const toggles = page.getByTestId("week-toggle");
  await expect(toggles.first()).toBeVisible();
  // only the week containing today may start open (other tests may have logged time today)
  const open = await toggles.evaluateAll((els) => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    const thisWeek = d.toLocaleDateString("en-CA");
    return els.filter((e) => e.getAttribute("aria-expanded") === "true" && e.closest("tr")?.getAttribute("data-week") !== thisWeek).length;
  });
  expect(open).toBe(0);
  await expandAllWeeks(page);
  await expect(page.getByLabel("Hours").first()).toBeVisible();
});

test("log a row: customer is created as you type, hours snap to tenths", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const desc = `desc-${Date.now()}`;
  await page.getByLabel("New entry customer").fill("Brand New Customer");
  await page.getByLabel("New entry customer").press("Enter");
  await page.getByLabel("New entry description").fill(desc);
  await page.getByLabel("New entry hours").fill("1:30");
  await page.getByLabel("New entry hours").press("Enter");
  const row = page.locator(`input[value="${desc}"]`);
  await expect(row).toHaveCount(1);
  await expect(page.locator('input[aria-label="Hours"][value="1.5"]').first()).toBeVisible();
  // odd minutes round to the nearest tenth (7 min -> 0.1 h)
  const res = await page.request.post("/api/time-entries", {
    data: { userId: (await (await page.request.get("/api/auth/me")).json()).data.id, date: "2026-11-24", durationMinutes: 7, notes: "tenth" },
  });
  expect((await res.json()).data.durationMinutes).toBe(6);
});

test("hours calculator matches the workbook's HOUR DIFFERENCES sheet", async ({ page }) => {
  await loginAs(page, ENGINEER);
  await page.getByTestId("hours-calc-toggle").click();
  await page.getByLabel("Start", { exact: true }).fill("1304");
  await page.getByLabel("End", { exact: true }).fill("1650");
  await expect(page.getByTestId("hours-calc-result")).toContainText("3.8");
  await page.getByLabel("Minus (lunch…)").fill("30m");
  await expect(page.getByTestId("hours-calc-result")).toContainText("3.3");
  await page.getByTestId("hours-calc-use").click();
  await expect(page.getByLabel("New entry hours")).toHaveValue("3.3");
});

test("lump-sum entries may have zero hours; plain entries may not", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const me = (await (await page.request.get("/api/auth/me")).json()).data.id;
  const bad = await page.request.post("/api/time-entries", { data: { userId: me, date: "2026-11-24", durationMinutes: 0 } });
  expect(bad.status()).toBe(400);
  const ok = await page.request.post("/api/time-entries", { data: { userId: me, date: "2026-11-24", durationMinutes: 0, isLumpSum: true, notes: "fixed price" } });
  expect(ok.status()).toBe(201);
});

test("engineers can't delete or un-invoice invoiced time", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const all = (await (await page.request.get("/api/time-entries")).json()).data as { id: string; isInvoiced: boolean }[];
  const inv = all.find((e) => e.isInvoiced)!;
  expect((await page.request.delete(`/api/time-entries/${inv.id}`)).status()).toBe(409);
  const put = await (await page.request.put(`/api/time-entries/${inv.id}`, { data: { isInvoiced: false } })).json();
  expect(put.data.isInvoiced).toBe(true);
});
