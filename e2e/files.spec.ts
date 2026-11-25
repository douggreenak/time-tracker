import { test, expect, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { ACCOUNTANT, ENGINEER, loginAs } from "./helpers";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** A small workbook laid out like the original macro workbook (TIME SUMMARY - JEFF, HELD TIME, LUMP SUM, OTHER). */
async function oldWorkbook(tag: string) {
  const wb = new ExcelJS.Workbook();
  const ts = wb.addWorksheet("TIME SUMMARY - JEFF");
  ["ITEM", "DAY OF WEEK", "DATE", "CUSTOMER", "HOURS", "DESCRIPTION", "LUMP SUM", "PARTS", "CONTRACT / PO", "BILLABLE (Y/N)", "INVOICED (Y/N)"].forEach((h, i) => (ts.getCell(2, 2 + i).value = h));
  const rows: [string, string, number | null, string, string | null, string | null, string, string][] = [
    ["2019-03-04", `Old Customer ${tag}`, 2.3, "PUMP STARTUP", null, null, "Y", "Y"],
    ["2019-03-05", `Old Customer ${tag}`, 1.1, "UNBILLABLE - TRAVEL", null, null, "N", "N"],
    ["2019-03-06", `Other Old ${tag}`, null, "LUMP SUM - SKID", "LUMP SUM", null, "Y", "N"],
    ["2019-03-07", `Old Customer ${tag}`, 0.8, "VALVE WORK", null, "SEE NOTE THIS CELL", "Y", "Y"],
  ] as never;
  rows.forEach(([d, c, h, desc, lump, parts, bill, inv], i) => {
    const r = 3 + i;
    ts.getCell(r, 2).value = i + 1;
    ts.getCell(r, 4).value = new Date(`${d}T00:00:00Z`);
    ts.getCell(r, 5).value = c;
    ts.getCell(r, 6).value = h;
    ts.getCell(r, 7).value = desc;
    ts.getCell(r, 8).value = lump;
    if (parts) { ts.getCell(r, 9).value = parts; ts.getCell(r, 9).note = "Jeff: (2) FUSE: 10.50 TOTAL: 21"; }
    ts.getCell(r, 11).value = bill;
    ts.getCell(r, 12).value = inv;
  });
  ts.getCell(8, 2).value = 5; // a blank placeholder day (no date, no customer) must be ignored
  const held = wb.addWorksheet("HELD TIME");
  ["ITEM", "DATE", "CUSTOMER", "HOURS", "DESCRIPTION", "PARTS"].forEach((h, i) => (held.getCell(3, 3 + i).value = h));
  held.getCell(4, 3).value = 1; held.getCell(4, 4).value = new Date("2019-02-01T00:00:00Z"); held.getCell(4, 5).value = `Old Customer ${tag}`; held.getCell(4, 6).value = 1.5; held.getCell(4, 7).value = "HELD MEETING";
  const lump = wb.addWorksheet("LUMP SUM");
  ["ITEM", "CUSTOMER", "DESCRIPTION", "AMOUNT", "NOTES"].forEach((h, i) => (lump.getCell(3, 2 + i).value = h));
  lump.getCell(4, 2).value = 1; lump.getCell(4, 3).value = `Other Old ${tag}`; lump.getCell(4, 4).value = "SKID"; lump.getCell(4, 5).value = 1200;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const api = async (page: Page, path: string, init?: Record<string, unknown>) => (await page.request.get(path, init)).json();

test("importing an old workbook in the UI adds history, then skips duplicates", async ({ page }) => {
  const tag = String(Date.now()).slice(-6);
  await loginAs(page, ACCOUNTANT, "/files");
  await expect(page.getByRole("heading", { name: "Import & saved spreadsheets" })).toBeVisible();
  // slow the server down a little so the loading wheel and progress bar can be seen
  let slowed = false;
  await page.route("**/api/import/preview", async (r) => { if (!slowed) { slowed = true; await new Promise((x) => setTimeout(x, 900)); } await r.continue(); });
  await page.route("**/api/import", async (r) => { await new Promise((x) => setTimeout(x, 900)); await r.continue(); });
  await page.getByTestId("import-file").setInputFiles({ name: "2019_APEX BILLING.xlsm", mimeType: XLSX, buffer: await oldWorkbook(tag) });
  const bar = page.getByTestId("import-progress");
  await expect(bar).toContainText(/Uploading|Reading the spreadsheet/);
  await expect(bar.getByRole("progressbar")).toBeVisible();
  await expect(bar.locator(".m3-spinner")).toBeVisible(); // the loading wheel
  const plan = page.getByTestId("import-plan");
  await expect(plan).toContainText("TIME SUMMARY - JEFF");
  await expect(plan.getByRole("combobox", { name: "Person for TIME SUMMARY - JEFF" })).toContainText("Jeff Green"); // matched by first name
  await expect(plan).toContainText("2019-03-04 → 2019-03-07");
  await expect(page.getByTestId("import-run")).toContainText("Import 6 new rows"); // 4 time rows + held + lump sum list
  await page.getByTestId("import-run").click();
  await expect(page.getByTestId("import-progress")).toContainText(/Importing 6 new rows|Uploading/);
  await expect(page.getByTestId("import-run")).toBeDisabled();
  await expect(page.getByTestId("import-progress")).toHaveCount(0, { timeout: 10000 }); // gone when it finishes
  await expect(page.getByRole("status")).toContainText("Added 5 time entries");

  const jeff = ((await api(page, "/api/users")).data as { id: string; name: string }[]).find((u) => u.name === "Jeff Green")!;
  const mine = ((await api(page, `/api/time-entries?userId=${jeff.id}&startDate=2019-01-01&endDate=2019-12-31`)).data as any[]).filter((e) => e.customerName.endsWith(tag));
  expect(mine).toHaveLength(4);
  const byNote = (n: string) => mine.find((e) => (e.notes ?? "").startsWith(n))!;
  expect(byNote("PUMP STARTUP")).toMatchObject({ date: "2019-03-04", durationMinutes: 138, isBillable: true, isInvoiced: true });
  expect(byNote("UNBILLABLE")).toMatchObject({ isBillable: false });
  expect(byNote("LUMP SUM")).toMatchObject({ isLumpSum: true, durationMinutes: 0 });
  expect(byNote("VALVE")).toMatchObject({ partsNote: "(2) FUSE: 10.50 TOTAL: 21" }); // the cell comment becomes the parts note
  const held = ((await api(page, "/api/time-entries?held=true")).data as any[]).find((e) => e.customerName.endsWith(tag));
  expect(held).toMatchObject({ isHeld: true, notes: "HELD MEETING", date: "2019-02-01" }); // held time goes under the person chosen for it (you, by default)
  expect(((await api(page, "/api/billing-items?kind=lump_sum")).data as any[]).some((i) => i.description === "SKID" && i.amount === 1200)).toBe(true);
  expect(((await api(page, "/api/customers")).data as any[]).some((c) => c.name === `Old Customer ${tag}`)).toBe(true);

  // the same file again adds nothing
  await page.getByTestId("import-file").setInputFiles({ name: "again.xlsx", mimeType: XLSX, buffer: await oldWorkbook(tag) });
  await expect(page.getByTestId("import-run")).toBeDisabled();
  await expect(page.getByTestId("import-plan")).toContainText("Nothing new to add");
});

test("the saved spreadsheet layout can be imported back (round trip)", async ({ page }) => {
  await loginAs(page, ACCOUNTANT);
  const res = await page.request.get("/api/export/workbook");
  expect(res.status()).toBe(200);
  const buf = await res.body();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const names = wb.worksheets.map((w) => w.name);
  expect(names).toEqual(expect.arrayContaining(["TIME SUMMARY - JEFF GREEN", "HELD TIME", "LUMP SUM", "OTHER", "MACRO DATA"]));
  const jeff = wb.getWorksheet("TIME SUMMARY - JEFF GREEN")!;
  expect(jeff.getCell("D2").value).toBe("DATE");
  expect(jeff.getCell("E3").value).toBeTruthy();
  const prev = await page.request.post("/api/import/preview", { multipart: { file: { name: "all.xlsx", mimeType: XLSX, buffer: buf } } });
  const plan = (await prev.json()).data;
  const s = plan.sheets.find((x: any) => x.sheet === "TIME SUMMARY - JEFF GREEN");
  expect(s.guessUserId).toBeTruthy();
  expect(s.newRows).toBe(0); // everything in it is already in the app
  expect(s.duplicateRows).toBe(s.rows);
  expect(s.rows).toBeGreaterThan(200);
  // a single year only holds that year
  const y = new ExcelJS.Workbook();
  await y.xlsx.load((await (await page.request.get("/api/export/workbook?year=2026")).body()) as any);
  const rows: string[] = [];
  y.getWorksheet("TIME SUMMARY - JEFF GREEN")!.eachRow((r, i) => i > 2 && rows.push(String((r.getCell(4).value as Date).toISOString().slice(0, 4))));
  expect(new Set(rows)).toEqual(new Set(["2026"]));
});

test("monthly and yearly saves are kept and can be downloaded", async ({ page }) => {
  await loginAs(page, ACCOUNTANT, "/files");
  // visiting the app already saved this month's full-data file
  const list0 = (await api(page, "/api/snapshots")).data as any[];
  const month = new Date().toISOString().slice(0, 7);
  expect(list0.some((s) => s.kind === "monthly" && s.period === month)).toBe(true);

  await page.getByTestId("save-yearly").click();
  await expect(page.getByRole("status")).toContainText("Saved the");
  const list = (await api(page, "/api/snapshots")).data as any[];
  const yearly = list.find((s) => s.kind === "yearly" && s.period === String(new Date().getFullYear()))!;
  expect(yearly.fileName).toMatch(/TimeTrack_Year_\d{4}\.xlsx/);
  await expect(page.getByTestId("saved-list")).toContainText(yearly.fileName);
  const file = await page.request.get(`/api/snapshots/${yearly.id}`);
  expect(file.headers()["content-type"]).toContain("spreadsheetml");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await file.body()) as any);
  expect(wb.worksheets.length).toBeGreaterThan(3);
  // saving again replaces rather than piling up
  await page.request.post("/api/snapshots", { data: { kind: "yearly", year: String(new Date().getFullYear()) } });
  const again = ((await api(page, "/api/snapshots")).data as any[]).filter((s) => s.kind === "yearly" && s.period === yearly.period);
  expect(again).toHaveLength(1);
});

test("engineers can import only their own time; bad files are rejected", async ({ page }) => {
  await loginAs(page, ENGINEER);
  const me = (await api(page, "/api/auth/me")).data;
  const users = (await api(page, "/api/users")).data as { id: string }[];
  const other = users.find((u) => u.id !== me.id)!;
  const buf = await oldWorkbook("eng");
  const post = (mapping: Record<string, string>) =>
    page.request.post("/api/import", { multipart: { file: { name: "x.xlsx", mimeType: XLSX, buffer: buf }, mapping: JSON.stringify(mapping), heldUserId: me.id, includeHeld: "false", includeLists: "false" } });
  expect((await post({ "TIME SUMMARY - JEFF": other.id })).status()).toBe(403);
  expect((await post({ "TIME SUMMARY - JEFF": "not-a-user" })).status()).toBe(400);
  const bad = await page.request.post("/api/import/preview", { multipart: { file: { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") } } });
  expect(bad.status()).toBe(400);
  const junk = await page.request.post("/api/import/preview", { multipart: { file: { name: "junk.xlsx", mimeType: XLSX, buffer: Buffer.from("not a zip") } } });
  expect(junk.status()).toBe(400);
  expect((await post({ "TIME SUMMARY - JEFF": me.id })).status()).toBe(200);
  await page.request.post("/api/auth/logout");
  expect((await page.request.get("/api/snapshots")).status()).toBe(401);
});
