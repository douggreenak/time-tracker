import { readFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";

/** The slice of a time entry the weekly timesheet needs. */
export interface SheetEntry {
  date: string; // YYYY-MM-DD
  customerName: string;
  jobName?: string | null;
  serviceItemName: string;
  durationMinutes: number;
  isBillable: boolean;
  notes?: string | null;
  createdAt?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const str = (ref: string, text: string, style?: string) =>
  `<c r="${ref}"${style ? ` s="${style}"` : ""} t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
const num = (ref: string, n: number, style?: string) => `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${n}</v></c>`;

/** Excel date serial for a YYYY-MM-DD string. */
export const excelDate = (d: string) => {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day) / 86400000 + 25569;
};
const addDays = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return t.toISOString().slice(0, 10);
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Fills the company's Time Sheet template (macros, formatting and layout untouched) with one person's week.
 *  - TIME SUMMARY: one row per entry (date, customer, hours, description, overhead).
 *  - TIME SHEET: the person's name and Sunday–Saturday labor totals.
 * The result is an .xlsm so the template's button macro keeps working.
 */
export async function buildTimesheetWorkbook(opts: { employee: string; weekStart: string; entries: SheetEntry[] }): Promise<Buffer> {
  const template = await readFile(path.join(process.cwd(), "assets", "Time_Sheet_Template.xlsm"));
  const zip = await JSZip.loadAsync(template);

  const entries = [...opts.entries].sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  if (entries.length > 520) throw new Error("Too many entries for one week's template.");

  // ---- TIME SUMMARY (sheet1) -----------------------------------------------------
  let s1 = await zip.file("xl/worksheets/sheet1.xml")!.async("string");
  s1 = s1.replace(/<c r="C2"([^>]*?) t="s"><v>\d+<\/v><\/c>/, `<c r="C2"$1><v>${excelDate(opts.weekStart)}</v></c>`);
  entries.forEach((e, i) => {
    const r = 4 + i;
    const desc = [e.jobName, e.serviceItemName, e.notes].map((x) => (x ?? "").trim()).filter(Boolean);
    const description = desc.length > 1 ? `${desc.slice(0, -1).join(" – ")}${e.notes?.trim() ? ": " : " – "}${desc[desc.length - 1]}` : desc[0] ?? "";
    const overhead = !e.isBillable || !e.customerName ? "Y" : "N";
    const cells =
      num(`B${r}`, i + 1) +
      num(`C${r}`, excelDate(e.date), "1") +
      (e.customerName ? str(`D${r}`, e.customerName) : "") +
      num(`E${r}`, round2(e.durationMinutes / 60)) +
      (description ? str(`H${r}`, description) : "") +
      str(`I${r}`, overhead);
    const row = new RegExp(`<row r="${r}"[^>]*?>[\\s\\S]*?</row>`);
    s1 = s1.replace(row, (m) => {
      const q = m.match(/<c r="Q\d+"[\s\S]*?<\/c>/)?.[0] ?? ""; // the template's Y/N list lives in column Q
      const attrs = m.slice(0, m.indexOf(">")).replace(/ spans="[^"]*"/, "");
      return `${attrs}>${cells}${q}</row>`;
    });
  });
  zip.file("xl/worksheets/sheet1.xml", s1);

  // ---- TIME SHEET (sheet2) ------------------------------------------------------------
  let s2 = await zip.file("xl/worksheets/sheet2.xml")!.async("string");
  const name = opts.employee;
  s2 = s2.replace(/<c r="B3"([^>]*?) t="s"><v>\d+<\/v><\/c>/, `<c r="B3"$1 t="inlineStr"><is><t>${esc(name.toUpperCase())}</t></is></c>`);
  s2 = s2.replace(/<c r="C19"([^>]*?) t="s"><v>\d+<\/v><\/c>/, `<c r="C19"$1 t="inlineStr"><is><t>${esc(name)}</t></is></c>`);
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(opts.weekStart, i);
    const hrs = round2(entries.filter((e) => e.date === day).reduce((n, e) => n + e.durationMinutes, 0) / 60);
    total += hrs;
    const r = 5 + i;
    s2 = s2.replace(new RegExp(`(<c r="C${r}"[^>]*>)<v>[^<]*</v>`), `$1<v>${excelDate(day)}</v>`);
    s2 = s2.replace(new RegExp(`(<c r="D${r}"[^>]*>)<v>[^<]*</v>`), `$1<v>${hrs}</v>`);
  }
  s2 = s2.replace(/(<c r="D13"[^>]*><f>[^<]*<\/f>)<v>[^<]*<\/v>/, `$1<v>${round2(total)}</v>`);
  zip.file("xl/worksheets/sheet2.xml", s2);

  // Recalculate the template's formulas when it opens.
  let wb = await zip.file("xl/workbook.xml")!.async("string");
  wb = wb.replace(/<calcPr calcId="(\d+)"\/>/, '<calcPr calcId="$1" fullCalcOnLoad="1"/>');
  zip.file("xl/workbook.xml", wb);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
