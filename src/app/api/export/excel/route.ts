import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";
import { buildTimesheetWorkbook } from "@/lib/excel";
import { checkDate } from "@/lib/validate";

export const dynamic = "force-dynamic";

const addDays = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
};

/** One person's Sunday–Saturday week, filled into the company Time Sheet template. */
export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get("week") ?? "";
    const bad = !week ? "Pick a week first." : checkDate(week);
    if (bad) return NextResponse.json({ success: false, error: bad }, { status: 400 });
    if (new Date(`${week}T00:00:00Z`).getUTCDay() !== 0) {
      return NextResponse.json({ success: false, error: "A week starts on a Sunday." }, { status: 400 });
    }
    const userId = isManager(g.user) ? searchParams.get("userId") || g.user.id : g.user.id;
    const user = (await dataStore.getUsers()).find((u) => u.id === userId);
    if (!user) return NextResponse.json({ success: false, error: "Unknown person." }, { status: 400 });

    const entries = await dataStore.getTimeEntries({ userId, startDate: week, endDate: addDays(week, 6) });
    const file = await buildTimesheetWorkbook({ employee: user.name, weekStart: week, entries });
    const safe = user.name.replace(/[^A-Za-z0-9]+/g, "_");
    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel.sheet.macroEnabled.12",
        "Content-Disposition": `attachment; filename="Time_Sheet_${safe}_${week}.xlsm"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Excel export error:", error);
    return NextResponse.json({ success: false, error: "Failed to build the Excel timesheet." }, { status: 500 });
  }
}
