import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import fs from "node:fs";
import { parseWorkbook } from "../src/lib/workbook";

/** Builds a workbook that uses every column and sheet the importer knows about. */
async function fullWorkbook() {
  const wb = new ExcelJS.Workbook();
  for (const [name, who] of [["TIME SUMMARY - JEFF", "Jeff"], ["TIME SUMMARY - MOLLY", "Molly"]] as const) {
    const ws = wb.addWorksheet(name);
    const rows = [
      { d: "2025-01-06", c: "ALPHA CO", h: 1.25, desc: "SITE VISIT", lump: "", parts: "(1) RELAY 40", contract: "PO-77", bill: "Y", inv: "N" },
      { d: "2025-01-07", c: "BETA CO", h: 0.04, desc: "TINY", lump: "", parts: "", contract: "", bill: "Y", inv: "Y" },
      { d: "2025-01-08", c: "ALPHA CO", h: null, desc: "LUMP SUM - PANEL", lump: "Y", parts: "", contract: "", bill: "Y", inv: "N" },
      { d: "2025-01-09", c: "GAMMA CO", h: 2, desc: "NOT BILLABLE TRAINING", lump: "", parts: "", contract: "", bill: "N", inv: "N" },
    ];
    rows.forEach((r, i) => {
      const n = 3 + i;
      ws.getCell(n, 4).value = new Date(`${r.d}T00:00:00Z`);
      ws.getCell(n, 5).value = `${r.c} ${who}`;
      ws.getCell(n, 6).value = r.h;
      ws.getCell(n, 7).value = r.desc;
      ws.getCell(n, 8).value = r.lump || null;
      if (r.parts) { ws.getCell(n, 9).value = "SEE NOTE THIS CELL"; ws.getCell(n, 9).note = r.parts; }
      ws.getCell(n, 10).value = r.contract || null;
      ws.getCell(n, 11).value = r.bill;
      ws.getCell(n, 12).value = r.inv;
    });
    ws.getCell(3, 7).note = "call back"; // a comment on the description
    ws.getCell(4, 11).note = "billing question"; // comments in other columns must not be lost either
    ws.getCell(12, 4).value = new Date("2025-02-01T00:00:00Z"); // a placeholder day with nothing else: not a time entry
  }
  const held = wb.addWorksheet("HELD TIME");
  held.getCell(4, 4).value = new Date("2024-12-30T00:00:00Z"); held.getCell(4, 5).value = "ALPHA CO"; held.getCell(4, 6).value = 2.5; held.getCell(4, 7).value = "WAITING ON PO"; held.getCell(4, 8).value = "(2) FUSE"; held.getCell(4, 4).note = "ask Pat"; held.getCell(4, 4).note = "ask Pat";
  const lump = wb.addWorksheet("LUMP SUM");
  lump.getCell(4, 3).value = "ALPHA CO"; lump.getCell(4, 4).value = "SKID"; lump.getCell(4, 5).value = 1200.5; lump.getCell(4, 6).value = "half now";
  const other = wb.addWorksheet("OTHER");
  other.getCell(3, 3).value = "BETA CO"; other.getCell(3, 4).value = "MILEAGE"; other.getCell(3, 5).value = 80;
  wb.addWorksheet("ALPHA CO"); // an invoice sheet: ignored
  return Buffer.from(await wb.xlsx.writeBuffer());
}

test("every row, column, comment and list in a workbook is read", async () => {
  const p = await parseWorkbook(await fullWorkbook());
  expect(p.people.map((s) => s.person)).toEqual(["JEFF", "MOLLY"]);
  for (const s of p.people) {
    expect(s.entries).toHaveLength(4); // the placeholder day is not an entry
    const [a, b, c, d] = s.entries;
    expect(a).toMatchObject({ date: "2025-01-06", hours: 1.3, description: "SITE VISIT", contractPo: "PO-77", partsNote: "(1) RELAY 40", billable: true, invoiced: false });
    expect(a.internalNote).toContain("call back");
    expect(b).toMatchObject({ hours: 0, invoiced: true });
    expect(b.internalNote).toContain("billing question");
    expect(c).toMatchObject({ lumpSum: true, hours: 0, description: "LUMP SUM - PANEL" });
    expect(d).toMatchObject({ billable: false, hours: 2 });
  }
  expect(p.held).toEqual([{ date: "2024-12-30", customer: "ALPHA CO", hours: 2.5, description: "WAITING ON PO", partsNote: "(2) FUSE", internalNote: "ask Pat" }]);
  expect(p.lumpSum).toEqual([{ customer: "ALPHA CO", description: "SKID", amount: 1200.5, notes: "half now" }]);
  expect(p.other).toEqual([{ customer: "BETA CO", description: "MILEAGE", amount: 80, notes: "" }]);
});

// Local check against your real file (never committed): every dated row, hour, description and comment must be read.
const REAL = process.env.REAL_WORKBOOK || "/Users/doug/Downloads/2026_APEX BILLING_OK_TO_DELETE.xlsm";
test("the real billing workbook: nothing is dropped", async () => {
  test.skip(!fs.existsSync(REAL), "real workbook not on this computer");
  const raw = new ExcelJS.Workbook();
  await raw.xlsx.readFile(REAL);
  const v = (c: ExcelJS.Cell) => { const x = c.value as any; return x && typeof x === "object" && !(x instanceof Date) ? x.result ?? x.richText?.map((t: any) => t.text).join("") ?? null : x; };
  const parsed = await parseWorkbook(fs.readFileSync(REAL));
  for (const ws of raw.worksheets.filter((w) => /^TIME SUMMARY - /.test(w.name))) {
    const sheet = parsed.people.find((s) => s.sheet === ws.name)!;
    expect(sheet).toBeTruthy();
    let expectRows = 0, hours = 0; const comments: string[] = [];
    ws.eachRow((row, r) => {
      if (r < 3) return;
      const c = String(v(row.getCell(5)) ?? "").trim(), h = v(row.getCell(6)), desc = String(v(row.getCell(7)) ?? "");
      const isEntry = v(row.getCell(4)) instanceof Date && c && (typeof h === "number" || /LUMP SUM/i.test(desc));
      if (isEntry) { expectRows++; hours += typeof h === "number" ? Math.round(h * 10) / 10 : 0; }
      if (isEntry) for (const col of [4, 5, 6, 7, 8, 9, 10, 11, 12]) { const n = row.getCell(col).note as any; const t = typeof n === "string" ? n : n?.texts?.map((x: any) => x.text).join(""); if (t?.trim()) comments.push(t.replace(/\s+/g, " ").trim()); }
    });
    expect(sheet.entries).toHaveLength(expectRows);
    expect(sheet.entries.reduce((n, e) => n + e.hours, 0)).toBeCloseTo(hours, 5);
    const kept = sheet.entries.map((e) => `${e.internalNote} ${e.partsNote}`.replace(/\s+/g, " ")).join(" ");
    for (const t of comments) expect(kept, `comment lost: ${t}`).toContain(t.replace(/^[A-Za-z]+:\s*/, "").slice(0, 25));
  }
  const rawCount = (name: string, from: number) => { let n = 0; raw.getWorksheet(name)!.eachRow((row, r) => { if (r >= from && String(v(row.getCell(name === "HELD TIME" ? 5 : 3)) ?? "").trim()) n++; }); return n; };
  const heldKept = parsed.held.map((h) => h.internalNote).join(" ");
  raw.getWorksheet("HELD TIME")!.eachRow((row) => row.eachCell({ includeEmpty: true }, (c) => { const n = c.note as any; const t = typeof n === "string" ? n : n?.texts?.map((x: any) => x.text).join(""); if (t?.trim()) expect(heldKept).toContain(t.replace(/^\s*[A-Za-z]+:\s*/, "").replace(/\s+/g, " ").trim()); }));
  expect(parsed.held).toHaveLength(rawCount("HELD TIME", 4));
  expect(parsed.lumpSum).toHaveLength(rawCount("LUMP SUM", 4));
  expect(parsed.other).toHaveLength(rawCount("OTHER", 3));
});
