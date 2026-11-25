/**
 * The Apex billing workbook as a file format: written by the monthly/yearly saves and read back by Import
 * (which also accepts the original macro workbook, .xlsx or .xlsm). Layout, 1-based columns:
 *   TIME SUMMARY - <PERSON>   header row 2, data from row 3:  B item, C day, D DATE, E CUSTOMER, F HOURS, G DESCRIPTION,
 *                            H LUMP SUM, I PARTS, J CONTRACT/PO, K BILLABLE (Y/N), L INVOICED (Y/N)
 *   HELD TIME                header row 3, data from row 4:  C item, D DATE, E CUSTOMER, F HOURS, G DESCRIPTION, H PARTS
 *   LUMP SUM / OTHER         header row 3 / 2:               B item, C CUSTOMER, D DESCRIPTION, E AMOUNT, F NOTES
 *   MACRO DATA               C CUSTOMERS, D LAST INVOICE DATE, E NEW HOURS THIS CYCLE (T/F)
 */
import ExcelJS from "exceljs";

export interface WbEntry {
  date: string;
  customer: string;
  hours: number;
  description: string;
  lumpSum: boolean;
  partsNote: string;
  internalNote: string;
  contractPo: string;
  billable: boolean;
  invoiced: boolean;
}
export interface WbPersonSheet {
  sheet: string;
  /** What follows "TIME SUMMARY - " in the sheet name, e.g. "JEFF". */
  person: string;
  entries: WbEntry[];
}
export interface WbHeld {
  date: string;
  customer: string;
  hours: number;
  description: string;
  partsNote: string;
  internalNote: string;
}
export interface WbItem {
  customer: string;
  description: string;
  amount: number;
  notes: string;
}
export interface ParsedWorkbook {
  people: WbPersonSheet[];
  held: WbHeld[];
  lumpSum: WbItem[];
  other: WbItem[];
}

const clean = (s: unknown) => (s == null ? "" : String(s).replace(/\s+/g, " ").trim());

/** A cell's value with formulas resolved to their last result, and rich text flattened. */
function val(cell: ExcelJS.Cell): unknown {
  const v = cell.value as unknown;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown; error?: string };
    if ("result" in o) return o.result;
    if (o.richText) return o.richText.map((t) => t.text).join("");
    if ("text" in o) return o.text;
    if (o.error) return null;
  }
  return v;
}
const num = (cell: ExcelJS.Cell) => {
  const v = val(cell);
  return typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null;
};
/** Dates are stored as UTC midnight (or a local-time midnight in files from Excel): read the calendar day. */
function day(cell: ExcelJS.Cell): string | null {
  const v = val(cell);
  if (v instanceof Date && !isNaN(v.getTime())) {
    // A date typed in Excel at local midnight arrives a few hours off UTC; round to the nearest day.
    return new Date(Math.round(v.getTime() / 864e5) * 864e5).toISOString().slice(0, 10);
  }
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  return null;
}
function note(cell: ExcelJS.Cell): string {
  const n = cell.note as unknown;
  if (!n) return "";
  const t = typeof n === "string" ? n : ((n as { texts?: { text: string }[] }).texts ?? []).map((x) => x.text).join("");
  return clean(t.replace(/^\s*[A-Za-z]+:\s*/, ""));
}

export async function parseWorkbook(data: Buffer | ArrayBuffer): Promise<ParsedWorkbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(data as ArrayBuffer);
  const out: ParsedWorkbook = { people: [], held: [], lumpSum: [], other: [] };

  for (const ws of wb.worksheets) {
    const name = ws.name.trim().toUpperCase();
    const m = name.match(/^TIME SUMMARY\s*-\s*(.+)$/);
    if (m) {
      const entries: WbEntry[] = [];
      ws.eachRow({ includeEmpty: false }, (row, r) => {
        if (r < 3) return;
        const d = day(row.getCell(4));
        const customer = clean(val(row.getCell(5)));
        if (!d || !customer) return; // blank placeholder days
        const description = clean(val(row.getCell(7)));
        let hours = num(row.getCell(6));
        if (hours === null) {
          if (!/LUMP SUM/i.test(description)) return;
          hours = 0; // the workbook logs lump-sum days as zero-hour rows
        }
        const partsCell = clean(val(row.getCell(9)));
        const partsNote = note(row.getCell(9)) || (/^SEE NOTE/i.test(partsCell) ? "" : partsCell);
        const internal = [4, 5, 6, 7, 8, 10, 11, 12].map((c) => note(row.getCell(c))).filter(Boolean).join(" | ");
        const billableRaw = clean(val(row.getCell(11))).toUpperCase();
        entries.push({
          date: d,
          customer,
          hours: Math.round(hours * 10) / 10,
          description,
          lumpSum: Boolean(clean(val(row.getCell(8)))) || /LUMP SUM/i.test(description),
          partsNote: partsNote || (partsCell ? "See notes" : ""),
          internalNote: internal,
          contractPo: clean(val(row.getCell(10))),
          billable: billableRaw !== "N" && !/\bUN-?BILLABLE\b|NOT (REALLY )?BILLABLE/i.test(`${description} ${internal}`),
          invoiced: clean(val(row.getCell(12))).toUpperCase() === "Y",
        });
      });
      out.people.push({ sheet: ws.name, person: clean(m[1]), entries });
    } else if (name === "HELD TIME") {
      ws.eachRow({ includeEmpty: false }, (row, r) => {
        if (r < 4) return;
        const d = day(row.getCell(4));
        const customer = clean(val(row.getCell(5)));
        const hours = num(row.getCell(6));
        if (d && customer && hours !== null)
          out.held.push({ date: d, customer, hours: Math.round(hours * 10) / 10, description: clean(val(row.getCell(7))), partsNote: clean(val(row.getCell(8))), internalNote: [4, 5, 6, 7, 8].map((c) => note(row.getCell(c))).filter(Boolean).join(" | ") });
      });
    } else if (name === "LUMP SUM" || name === "OTHER") {
      const first = name === "LUMP SUM" ? 4 : 3;
      ws.eachRow({ includeEmpty: false }, (row, r) => {
        if (r < first) return;
        const customer = clean(val(row.getCell(3)));
        const description = clean(val(row.getCell(4)));
        if (!customer && !description) return;
        (name === "LUMP SUM" ? out.lumpSum : out.other).push({ customer, description, amount: num(row.getCell(5)) ?? 0, notes: clean(val(row.getCell(6))) });
      });
    }
  }
  return out;
}

// ───────────────────────── writing ─────────────────────────

export interface ExportData {
  users: { id: string; name: string }[];
  customers: { name: string; lastInvoiceDate?: string | null }[];
  entries: {
    userId: string;
    date: string;
    customerName: string;
    durationMinutes: number;
    notes?: string | null;
    isLumpSum: boolean;
    partsNote?: string | null;
    internalNote?: string | null;
    contractPo?: string | null;
    isBillable: boolean;
    isInvoiced: boolean;
    isHeld: boolean;
  }[];
  billingItems: { kind: "lump_sum" | "other"; customer: string; description: string; amount: number; notes: string }[];
}

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const HEAD = { bold: true } as const;

function header(ws: ExcelJS.Worksheet, row: number, firstCol: number, labels: string[]) {
  labels.forEach((l, i) => {
    const c = ws.getCell(row, firstCol + i);
    c.value = l;
    c.font = HEAD;
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = { bottom: { style: "medium" } };
  });
}

/** Sheet names are limited to 31 characters and must be unique. */
function sheetName(base: string, taken: Set<string>) {
  const clean = base.replace(/[\\/*?:[\]]/g, "").trim().slice(0, 31) || "SHEET";
  let n = clean;
  for (let i = 2; taken.has(n.toLowerCase()); i++) n = `${clean.slice(0, 28)} ${i}`;
  taken.add(n.toLowerCase());
  return n;
}

export async function buildDataWorkbook(data: ExportData, title?: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "TimeTrack";
  wb.created = new Date();
  if (title) wb.title = title;
  const taken = new Set<string>();
  const heldIds = (e: ExportData["entries"][number]) => e.isHeld;

  for (const u of data.users) {
    const mine = data.entries.filter((e) => e.userId === u.id && !heldIds(e)).sort((a, b) => a.date.localeCompare(b.date));
    const ws = wb.addWorksheet(sheetName(`TIME SUMMARY - ${u.name.toUpperCase()}`, taken));
    header(ws, 2, 2, ["ITEM", "DAY OF WEEK", "DATE", "CUSTOMER", "HOURS", "DESCRIPTION", "LUMP SUM", "PARTS", "CONTRACT / PO", "BILLABLE (Y/N)", "INVOICED (Y/N)"]);
    mine.forEach((e, i) => {
      const r = 3 + i;
      ws.getCell(r, 2).value = i + 1;
      ws.getCell(r, 3).value = utc(e.date).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
      const d = ws.getCell(r, 4);
      d.value = utc(e.date);
      d.numFmt = "mm/dd/yyyy";
      ws.getCell(r, 5).value = e.customerName;
      const h = ws.getCell(r, 6);
      h.value = e.isLumpSum && e.durationMinutes === 0 ? null : Math.round(e.durationMinutes / 6) / 10;
      h.numFmt = "0.0";
      ws.getCell(r, 7).value = e.notes ?? "";
      ws.getCell(r, 8).value = e.isLumpSum ? "LUMP SUM" : null;
      const parts = ws.getCell(r, 9);
      if (e.partsNote) {
        parts.value = "SEE NOTE THIS CELL";
        parts.note = e.partsNote;
      }
      ws.getCell(r, 10).value = e.contractPo || null;
      ws.getCell(r, 11).value = e.isBillable ? "Y" : "N";
      ws.getCell(r, 12).value = e.isInvoiced ? "Y" : "N";
      if (e.internalNote) ws.getCell(r, 7).note = e.internalNote;
    });
    [[2, 7], [3, 12], [4, 12], [5, 22], [6, 8], [7, 48], [8, 10], [9, 20], [10, 14], [11, 10], [12, 10]].forEach(([c, w]) => (ws.getColumn(c).width = w));
    ws.views = [{ state: "frozen", ySplit: 2 }];
  }

  // HELD TIME
  const held = data.entries.filter(heldIds).sort((a, b) => a.date.localeCompare(b.date));
  const wh = wb.addWorksheet(sheetName("HELD TIME", taken));
  header(wh, 3, 3, ["ITEM", "DATE", "CUSTOMER", "HOURS", "DESCRIPTION", "PARTS"]);
  held.forEach((e, i) => {
    const r = 4 + i;
    wh.getCell(r, 3).value = i + 1;
    wh.getCell(r, 4).value = utc(e.date);
    wh.getCell(r, 4).numFmt = "mm/dd/yyyy";
    wh.getCell(r, 5).value = e.customerName;
    wh.getCell(r, 6).value = Math.round(e.durationMinutes / 6) / 10;
    wh.getCell(r, 7).value = e.notes ?? "";
    wh.getCell(r, 8).value = e.partsNote ?? "";
    if (e.internalNote) wh.getCell(r, 7).note = e.internalNote;
  });
  [[4, 12], [5, 22], [6, 8], [7, 48], [8, 24]].forEach(([c, w]) => (wh.getColumn(c).width = w));

  for (const [kind, title2, headRow] of [["lump_sum", "LUMP SUM", 3], ["other", "OTHER", 2]] as const) {
    const ws = wb.addWorksheet(sheetName(title2, taken));
    header(ws, headRow, 2, ["ITEM", "CUSTOMER", "DESCRIPTION", "AMOUNT", "NOTES"]);
    data.billingItems
      .filter((b) => b.kind === kind)
      .forEach((b, i) => {
        const r = headRow + 1 + i;
        ws.getCell(r, 2).value = i + 1;
        ws.getCell(r, 3).value = b.customer;
        ws.getCell(r, 4).value = b.description;
        ws.getCell(r, 5).value = b.amount;
        ws.getCell(r, 5).numFmt = "#,##0.00";
        ws.getCell(r, 6).value = b.notes;
      });
    [[3, 22], [4, 40], [5, 12], [6, 30]].forEach(([c, w]) => (ws.getColumn(c).width = w));
  }

  // MACRO DATA
  const md = wb.addWorksheet(sheetName("MACRO DATA", taken));
  header(md, 2, 3, ["CUSTOMERS", "LAST INVOICE DATE", "NEW HOURS THIS CYCLE (T/F)"]);
  const waiting = new Set(data.entries.filter((e) => e.isBillable && !e.isInvoiced && !e.isHeld).map((e) => e.customerName));
  data.customers.forEach((c, i) => {
    const r = 3 + i;
    md.getCell(r, 3).value = c.name;
    if (c.lastInvoiceDate) {
      md.getCell(r, 4).value = utc(c.lastInvoiceDate);
      md.getCell(r, 4).numFmt = "mm/dd/yyyy";
    }
    md.getCell(r, 5).value = waiting.has(c.name);
  });
  [[3, 28], [4, 20], [5, 28]].forEach(([c, w]) => (md.getColumn(c).width = w));

  return Buffer.from(await wb.xlsx.writeBuffer());
}
