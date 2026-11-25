import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { ACCOUNTANT, ADMIN, ENGINEER, loginAs } from "./helpers";

type Row = { customerId: string; customerName: string; lastInvoiceDate: string | null; newHours: boolean; entriesInRange: number; amountInRange: number; hoursInRange: number };

const customerId = async (page: Page, name: string) => ((await (await page.request.get("/api/customers")).json()).data as { id: string; name: string }[]).find((c) => c.name === name)!.id;
const preview = async (page: Page, id: string, from: string, to: string, parts: unknown[] = [], includeInvoiced = false) =>
  (await (await page.request.post("/api/billing/preview", { data: { from, to, includeInvoiced, customers: [{ id, parts }] } })).json()).data as any[];

test("the billing summary is the workbook's MACRO DATA sheet", async ({ page }) => {
  await loginAs(page, ACCOUNTANT);
  const rows = (await (await page.request.get("/api/billing/summary?from=2026-11-13&to=2026-11-30")).json()).data as Row[];
  const wtp = rows.find((r) => r.customerName === "HARBOR WTP")!;
  expect(wtp.lastInvoiceDate).toBe("2026-11-10"); // invoiced up to the demo's last run
  expect(wtp.newHours).toBe(true); // 11/18 is after that
  expect(wtp.entriesInRange).toBe(1);
  expect(wtp.hoursInRange).toBeCloseTo(3.1, 1);
  expect(wtp.amountInRange).toBe(775); // 3.1 h x $250
});

test("invoice math follows the macro: hours x rate, per-person summary, parts qty x cost, amount due", async ({ page }) => {
  await loginAs(page, ACCOUNTANT);
  const id = await customerId(page, "HARBOR WTP");
  const [inv] = await preview(page, id, "2026-11-13", "2026-11-20", [{ item: "Fuse", qty: 2, desc: "10A", unitCost: 10.5 }]);
  expect(inv.lines).toHaveLength(1);
  expect(inv.lines[0]).toMatchObject({ hours: 3.1, rate: 250, total: 775, personnel: "JEFF GREEN" });
  expect(inv.summary).toEqual([{ personnel: "JEFF GREEN", hours: 3.1, total: 775 }]);
  expect(inv.partsTotal).toBe(21);
  expect(inv.amountDue).toBe(796);
});

test("held, non-billable and already-invoiced time stay off invoices", async ({ page }) => {
  await loginAs(page, ACCOUNTANT);
  const all = (await (await page.request.get("/api/time-entries")).json()).data as any[];
  const held = all.find((e) => e.isHeld);
  const id = held.customerId;
  const inv = await preview(page, id, "2000-01-01", "2099-12-31", [], true);
  for (const l of inv?.[0]?.lines ?? []) expect(l.entryId).not.toBe(held.id);
  const unbillable = all.find((e) => !e.isBillable && !e.isHeld)!;
  const inv2 = await preview(page, unbillable.customerId, "2000-01-01", "2099-12-31", [], true);
  expect((inv2?.[0]?.lines ?? []).some((l: any) => l.entryId === unbillable.id)).toBe(false);
  // already-invoiced time is only included when asked for
  const without = await preview(page, await customerId(page, "BLUE WHALE"), "2026-01-01", "2026-11-12");
  const withIt = await preview(page, await customerId(page, "BLUE WHALE"), "2026-01-01", "2026-11-12", [], true);
  expect(without?.[0]?.lines?.length ?? 0).toBe(0);
  expect(withIt[0].lines.length).toBeGreaterThan(0);
});

test("a person's billing rate drives the invoice", async ({ page }) => {
  await loginAs(page, ADMIN);
  const users = (await (await page.request.get("/api/users")).json()).data as { id: string; name: string; defaultHourlyRate: number }[];
  const jeff = users.find((u) => u.name === "Jeff Green")!;
  expect(jeff.defaultHourlyRate).toBe(250);
  const id = await customerId(page, "HARBOR WWTP");
  try {
    expect((await page.request.put(`/api/users/${jeff.id}`, { data: { defaultHourlyRate: 300 } })).ok()).toBe(true);
    const [inv] = await preview(page, id, "2026-11-13", "2026-11-30");
    expect(inv.lines[0].rate).toBe(300);
    expect(inv.lines[0].total).toBe(Math.round(inv.lines[0].hours * 300 * 100) / 100);
  } finally {
    await page.request.put(`/api/users/${jeff.id}`, { data: { defaultHourlyRate: 250 } });
  }
});

test("Excel download has one sheet per customer in the macro's layout, with live formulas", async ({ page }) => {
  await loginAs(page, ACCOUNTANT);
  const a = await customerId(page, "CEDAR ENERGY");
  const b = await customerId(page, "HARBOR WTP");
  const res = await page.request.post("/api/billing/excel", {
    data: { from: "2026-10-01", to: "2026-11-30", includeInvoiced: true, customers: [{ id: a, parts: [{ item: "Breaker", qty: 2, desc: "Square D", unitCost: 125.5 }] }, { id: b }] },
  });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("spreadsheetml");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()) as any);
  expect(wb.worksheets.map((w) => w.name)).toEqual(["CEDAR ENERGY", "HARBOR WTP"]);
  const ws = wb.getWorksheet("CEDAR ENERGY")!;
  expect(ws.getCell("A1").value).toBe("APEX ENGINEERING INVOICE DETAIL");
  expect(["DATE", "CUSTOMER", "HOURS", "TASK", "PERSONNEL", "RATE", "TOTAL"].map((_, i) => ws.getCell(2, i + 1).value)).toEqual(["DATE", "CUSTOMER", "HOURS", "TASK", "PERSONNEL", "RATE", "TOTAL"]);
  expect((ws.getCell("G3").value as { formula: string }).formula).toBe("C3*F3");
  expect(ws.getCell("I3").value).toBe("Breaker");
  expect((ws.getCell("M3").value as { formula: string }).formula).toBe("L3*J3");
  expect(ws.getCell("O2").value).toBe("LABOR HOURS (JEFF GREEN)");
  expect((ws.getCell("P2").value as { formula: string }).formula).toBe('SUMIF(E3:E96,"JEFF GREEN",C3:C96)');
  expect(ws.getCell("O7").value).toBe("INVOICE AMT. DUE:");
  expect(ws.pageSetup.orientation).toBe("landscape");
  expect(ws.pageSetup.fitToPage).toBe(true);
  // an empty selection is refused rather than producing an empty workbook
  const none = await page.request.post("/api/billing/excel", { data: { from: "2001-01-01", to: "2001-01-02", customers: [{ id: a }] } });
  expect(none.status()).toBe(404);
});

test("create invoices in the UI, edit parts, download, mark invoiced, then undo", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await page.getByLabel("From date").fill("2026-11-13");
  await page.getByLabel("To date").fill("2026-11-30");
  const row = page.getByTestId("billing-row").filter({ hasText: "PINE ELECTRIC" });
  await expect(row).toContainText("TRUE");
  await expect(row.getByRole("checkbox")).toBeEnabled(); // the list has reloaded for the new dates
  // only invoice Samson
  await page.getByLabel("Select all customers").uncheck();
  await row.getByRole("checkbox").check();
  await page.getByTestId("create-invoices").click();
  const card = page.getByTestId("invoice-card");
  await expect(card).toHaveCount(1);
  const before = await card.getByTestId("amount-due").textContent();
  expect(before).toBe("$275.00"); // 1.1 h x $250
  await card.getByRole("button", { name: /Add part/ }).click();
  await card.getByLabel("Part item").fill("Relay");
  await card.getByLabel("Part quantity").fill("3");
  await card.getByLabel("Part unit cost").fill("20");
  await expect(card.getByTestId("amount-due")).toHaveText("$335.00");

  const [dl] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Excel" }).click()]);
  expect(dl.suggestedFilename()).toMatch(/\.xlsx$/);

  page.once("dialog", (d) => d.accept());
  await card.getByRole("button", { name: "Mark as invoiced" }).click();
  await expect(page.getByTestId("invoice-card")).toHaveCount(0);
  await expect(page.getByTestId("invoice-history")).toContainText("PINE ELECTRIC");
  await expect(page.getByTestId("invoice-history")).toContainText("$335.00"); // the parts were saved with it
  const summary = (await (await page.request.get("/api/billing/summary?from=2026-11-13&to=2026-11-30")).json()).data as Row[];
  expect(summary.find((r) => r.customerName === "PINE ELECTRIC")?.entriesInRange ?? 0).toBe(0);

  // undo puts the time back
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete PINE ELECTRIC invoice" }).first().click();
  await expect(page.getByTestId("billing-row").filter({ hasText: "PINE ELECTRIC" })).toContainText("TRUE");
});

test("everyone can use billing and delete an invoice", async ({ page }) => {
  await loginAs(page, ENGINEER, "/billing");
  await expect(page.getByRole("heading", { name: "Billing" })).toBeVisible();
  await expect(page.getByTestId("create-invoices")).toBeVisible();
  const inv = (await (await page.request.get("/api/invoices")).json()).data as { id: string }[];
  expect(inv.length).toBeGreaterThan(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^Delete .* invoice$/ }).first().click();
  await expect.poll(async () => ((await (await page.request.get("/api/invoices")).json()).data as unknown[]).length).toBe(inv.length - 1);
});

test("the Data tab is now just Customers; the old list pages are gone but their data stays", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/customers");
  await expect(page.getByRole("link", { name: "Customers", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "Data", exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Data" })).toHaveCount(0); // no sub-tabs
  for (const gone of ["/lump-sum", "/other", "/held"]) expect((await page.request.get(gone)).status()).toBe(404);
  expect(((await (await page.request.get("/api/billing-items?kind=lump_sum")).json()).data as unknown[]).length).toBeGreaterThan(0);
});

test("billing lists only customers with time in the range, unless 'Show all customers' is ticked", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/billing");
  const rows = page.getByTestId("billing-row");
  const api = (await (await page.request.get("/api/billing/summary?from=2026-11-13&to=2026-11-20")).json()).data as Row[];
  const withTime = api.filter((r) => r.entriesInRange > 0).length;
  const all = ((await (await page.request.get("/api/customers")).json()).data as unknown[]).length;
  expect(all).toBeGreaterThan(withTime); // there are customers with nothing in this range
  await page.getByLabel("From date").fill("2026-11-13");
  await page.getByLabel("To date").fill("2026-11-20");
  await expect(rows).toHaveCount(withTime);
  await page.getByTestId("show-all-customers").check();
  await expect(rows).toHaveCount(all);
  await expect(page.getByRole("checkbox", { name: /^Invoice / }).and(page.locator(":disabled")).first()).toBeVisible(); // empty ones can't be picked
  await page.getByTestId("show-all-customers").uncheck();
  await expect(rows).toHaveCount(withTime);
});

test("unavailable buttons look clearly unavailable", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/billing");
  await page.getByLabel("From date").fill("2026-11-13");
  await page.getByLabel("To date").fill("2026-11-20");
  await expect(page.getByTestId("billing-row").first()).toBeVisible();
  await page.getByLabel("Select all customers").uncheck();
  const create = page.getByTestId("create-invoices");
  await expect(create).toBeDisabled();
  const off = await create.evaluate((e) => { const s = getComputedStyle(e); return { bg: s.backgroundColor, op: s.opacity, cur: s.cursor, f: s.filter }; });
  expect(off.cur).toBe("not-allowed");
  expect(Number(off.op)).toBeLessThan(0.7);
  expect(off.f).toContain("grayscale");
  await page.getByLabel("Select all customers").check();
  await expect(create).toBeEnabled();
  const on = await create.evaluate((e) => ({ bg: getComputedStyle(e).backgroundColor, op: getComputedStyle(e).opacity }));
  await expect.poll(async () => await create.evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe(off.bg);
  await expect.poll(async () => Number(await create.evaluate((e) => getComputedStyle(e).opacity))).toBe(1);
});
