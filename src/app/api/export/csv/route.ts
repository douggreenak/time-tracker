import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const q = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`; // a spreadsheet must not run typed text as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

/** The time log as a spreadsheet, in the same column order as the workbook's TIME SUMMARY sheets. */
export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const entries = await dataStore.getTimeEntries({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      customerId: searchParams.get("customerId") || undefined,
      userId: isManager(g.user) ? searchParams.get("userId") || undefined : g.user.id,
    });
    const rows = [["ITEM", "DAY OF WEEK", "DATE", "CUSTOMER", "HOURS", "DESCRIPTION", "LUMP SUM", "PARTS", "CONTRACT / PO", "BILLABLE (Y/N)", "INVOICED (Y/N)", "PERSON", "HELD"]];
    [...entries].reverse().forEach((e, i) =>
      rows.push([
        String(i + 1), day(e.date), e.date, e.customerName, (e.durationMinutes / 60).toFixed(1), e.notes ?? "",
        e.isLumpSum ? "Y" : "", e.partsNote ?? "", e.contractPo ?? "", e.isBillable ? "Y" : "N", e.isInvoiced ? "Y" : "N", e.userName, e.isHeld ? "Y" : "",
      ])
    );
    const csv = rows.map((r) => r.map(q).join(",")).join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return new Response("﻿" + csv, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="TimeSummary_${stamp}.csv"`, "Cache-Control": "no-cache" },
    });
  } catch (error) {
    console.error("CSV Export Error:", error);
    return NextResponse.json({ success: false, error: "Failed to export CSV" }, { status: 500 });
  }
}
