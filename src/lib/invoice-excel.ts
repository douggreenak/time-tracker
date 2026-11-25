import ExcelJS from "exceljs";
import { cents, partTotal, sheetName, type InvoiceData } from "./invoice";

/** Matches DATA_END_ROW in the workbook's macro: formulas span rows 3-96 (longer if the invoice is). */
const MIN_END_ROW = 96;
const FONT = "Calibri";
const BLACK = { argb: "FF000000" };

type Side = "top" | "bottom" | "left" | "right";
function edge(cell: ExcelJS.Cell, sides: Side[], style: ExcelJS.BorderStyle) {
  const b = { ...(cell.border ?? {}) } as ExcelJS.Borders;
  for (const s of sides) b[s] = { style, color: BLACK };
  cell.border = b;
}
function box(ws: ExcelJS.Worksheet, c1: number, r1: number, c2: number, r2: number) {
  for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
    const sides: Side[] = [];
    if (r === r1) sides.push("top");
    if (r === r2) sides.push("bottom");
    if (c === c1) sides.push("left");
    if (c === c2) sides.push("right");
    if (sides.length) edge(ws.getCell(r, c), sides, "medium");
  }
}
function hline(ws: ExcelJS.Worksheet, c1: number, c2: number, r: number, style: ExcelJS.BorderStyle) {
  for (let c = c1; c <= c2; c++) edge(ws.getCell(r, c), ["bottom"], style);
}
function vline(ws: ExcelJS.Worksheet, c: number, r1: number, r2: number) {
  for (let r = r1; r <= r2; r++) edge(ws.getCell(r, c), ["right"], "thin");
}
const style = (cell: ExcelJS.Cell, o: { size?: number; bold?: boolean; h?: ExcelJS.Alignment["horizontal"]; fmt?: string }) => {
  cell.font = { name: FONT, size: o.size ?? 9, bold: o.bold ?? false, color: BLACK };
  cell.alignment = { horizontal: o.h ?? "left", vertical: "middle" };
  if (o.fmt) cell.numFmt = o.fmt;
};

/** Adds one invoice sheet in the macro's layout: LABOR (A-G), PARTS (I-M), SUMMARY (O-P). */
export function addInvoiceSheet(wb: ExcelJS.Workbook, inv: InvoiceData, taken: Set<string>) {
  const ws = wb.addWorksheet(sheetName(inv.customerName, taken), { views: [{ showGridLines: true }] });

  // ── LABOR ──
  ws.mergeCells("A1:G1");
  ws.getCell("A1").value = "APEX ENGINEERING INVOICE DETAIL";
  style(ws.getCell("A1"), { size: 11, bold: true, h: "center" });
  ["DATE", "CUSTOMER", "HOURS", "TASK", "PERSONNEL", "RATE", "TOTAL"].forEach((h, i) => {
    const c = ws.getCell(2, i + 1);
    c.value = h;
    style(c, { bold: true, h: "center" });
  });
  ws.getRow(2).height = 18;
  inv.lines.forEach((l, i) => {
    const r = 3 + i;
    ws.getCell(r, 1).value = new Date(`${l.date}T00:00:00Z`);
    ws.getCell(r, 2).value = l.customer;
    ws.getCell(r, 3).value = l.hours;
    ws.getCell(r, 4).value = l.task;
    ws.getCell(r, 5).value = l.personnel;
    ws.getCell(r, 6).value = l.rate;
    ws.getCell(r, 7).value = l.isLumpSum ? 0 : { formula: `C${r}*F${r}`, result: l.total };
    style(ws.getCell(r, 1), { h: "center", fmt: "mm/dd/yyyy" });
    style(ws.getCell(r, 2), {});
    style(ws.getCell(r, 3), { h: "center", fmt: "0.0" });
    style(ws.getCell(r, 4), {});
    style(ws.getCell(r, 5), {});
    style(ws.getCell(r, 6), { h: "right", fmt: "#,##0.00" });
    style(ws.getCell(r, 7), { h: "right", fmt: "#,##0.00" });
    ws.getRow(r).height = 15;
  });
  const dataLast = Math.max(2, 2 + inv.lines.length);
  const endRow = Math.max(MIN_END_ROW, dataLast);
  box(ws, 1, 1, 7, dataLast);
  hline(ws, 1, 7, 1, "medium");
  hline(ws, 1, 7, 2, "medium");
  for (let c = 1; c <= 6; c++) vline(ws, c, 1, dataLast);
  for (let r = 3; r < dataLast; r++) hline(ws, 1, 7, r, "thin");

  // ── PARTS ──
  ws.mergeCells("I1:M1");
  ws.getCell("I1").value = "PARTS";
  style(ws.getCell("I1"), { size: 11, h: "center" });
  ["ITEM", "QTY", "DESC", "UNIT COST", "TOTAL COST"].forEach((h, i) => {
    const c = ws.getCell(2, 9 + i);
    c.value = h;
    style(c, { size: 11, h: "center" });
  });
  const parts = inv.parts.length ? inv.parts : [{ item: "", qty: 1, desc: "", unitCost: 0 }];
  parts.forEach((p, i) => {
    const r = 3 + i;
    ws.getCell(r, 9).value = p.item;
    ws.getCell(r, 10).value = p.qty;
    ws.getCell(r, 11).value = p.desc;
    ws.getCell(r, 12).value = p.unitCost || null;
    ws.getCell(r, 13).value = { formula: `L${r}*J${r}`, result: partTotal(p) };
    for (let c = 9; c <= 13; c++) style(ws.getCell(r, c), { size: 11, h: c === 11 ? "left" : "center", fmt: c >= 12 ? "#,##0.00" : undefined });
  });
  const partsLast = 2 + parts.length;
  box(ws, 9, 1, 13, partsLast);
  hline(ws, 9, 13, 1, "medium");
  hline(ws, 9, 13, 2, "medium");
  for (let c = 9; c <= 12; c++) vline(ws, c, 1, partsLast);

  // ── SUMMARY ──
  ws.mergeCells("O1:P1");
  ws.getCell("O1").value = "SUMMARY";
  style(ws.getCell("O1"), { size: 11, h: "center" });
  let row = 2;
  const laborCells: string[] = [];
  const put = (label: string, value: ExcelJS.CellValue, fmt?: string) => {
    ws.getCell(row, 15).value = label;
    ws.getCell(row, 16).value = value;
    style(ws.getCell(row, 15), { size: 11, h: "center" });
    style(ws.getCell(row, 16), { size: 11, h: "center", fmt });
  };
  for (const s of inv.summary) {
    put(`LABOR HOURS (${s.personnel})`, { formula: `SUMIF(E3:E${endRow},"${s.personnel.replace(/"/g, '""')}",C3:C${endRow})`, result: s.hours }, "0.0");
    row++;
    put(`LABOR TOTAL (${s.personnel}):`, { formula: `SUMIF(E3:E${endRow},"${s.personnel.replace(/"/g, '""')}",G3:G${endRow})`, result: s.total }, "#,##0.00");
    laborCells.push(`P${row}`);
    row += 2;
  }
  const partsRow = row;
  put("PARTS TOTAL:", { formula: `SUM(M3:M${endRow})`, result: inv.partsTotal }, "#,##0.00");
  row += 2;
  const dueRow = row;
  put("INVOICE AMT. DUE:", { formula: `SUM(${[...laborCells, `P${partsRow}`].join(",")})`, result: cents(inv.laborTotal + inv.partsTotal) }, "#,##0.00");
  box(ws, 15, 1, 16, dueRow);
  hline(ws, 15, 16, 1, "medium");
  for (let r = 2; r < dueRow; r++) hline(ws, 15, 16, r, "thin");
  vline(ws, 15, 1, dueRow);

  // widths ≈ AutoFit
  const widths: Record<number, number> = { 1: 11, 2: 12, 3: 8, 4: 12, 5: 12, 6: 9, 7: 10, 8: 2, 9: 10, 10: 6, 11: 12, 12: 11, 13: 12, 14: 2, 15: 26, 16: 12 };
  for (const l of inv.lines) {
    widths[2] = Math.max(widths[2], l.customer.length + 2);
    widths[4] = Math.max(widths[4], Math.min(60, l.task.length + 2));
    widths[5] = Math.max(widths[5], l.personnel.length + 2);
  }
  for (const p of parts) {
    widths[9] = Math.max(widths[9], p.item.length + 2);
    widths[11] = Math.max(widths[11], Math.min(50, p.desc.length + 2));
  }
  for (const s of inv.summary) widths[15] = Math.max(widths[15], `LABOR TOTAL (${s.personnel}):`.length + 2);
  for (const [c, w] of Object.entries(widths)) ws.getColumn(Number(c)).width = w;

  // one landscape page
  const lastRow = Math.max(dataLast, dueRow);
  ws.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.25, footer: 0.25 },
    horizontalCentered: true,
    printArea: `A1:P${lastRow}`,
    showGridLines: false,
  };
  return ws;
}

export async function buildInvoiceWorkbook(invoices: InvoiceData[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Apex Engineering";
  wb.created = new Date();
  const taken = new Set<string>();
  for (const inv of invoices) addInvoiceSheet(wb, inv, taken);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
