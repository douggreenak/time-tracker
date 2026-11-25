import { dataStore } from "@/db/store";
import { buildDataWorkbook, type ExportData } from "@/lib/workbook";

export const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Everything in the workbook format; with `year`, only that calendar year's time. */
export async function exportData(year?: string): Promise<ExportData> {
  const [users, customers, entries, items] = await Promise.all([dataStore.getUsers(), dataStore.getCustomers(), dataStore.getTimeEntries(), dataStore.getBillingItems()]);
  return {
    users: users.map((u) => ({ id: u.id, name: u.name })),
    customers,
    entries: (year ? entries.filter((e) => e.date.startsWith(year)) : entries).map((e) => ({ ...e })),
    billingItems: items,
  };
}

export async function createSnapshot(kind: "monthly" | "yearly", period: string) {
  const year = kind === "yearly" ? period : undefined;
  const data = await exportData(year);
  const file = await buildDataWorkbook(data, kind === "yearly" ? `TimeTrack ${period}` : `TimeTrack full data ${period}`);
  const fileName = kind === "yearly" ? `TimeTrack_Year_${period}.xlsx` : `TimeTrack_Full_${period}.xlsx`;
  await dataStore.putSavedExport(kind, period, fileName, file);
  return { fileName, entries: data.entries.length };
}

let lastCheck = 0;
/**
 * Makes sure this month's full-data save and last year's yearly save exist. Cheap when they do, and
 * throttled, so it can run on ordinary requests; failures never get in the way of the request.
 */
export async function ensureSnapshots(force = false) {
  if (!force && Date.now() - lastCheck < 10 * 60_000) return;
  lastCheck = Date.now();
  try {
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const lastYear = String(now.getUTCFullYear() - 1);
    const needMonth = !(await dataStore.hasSavedExport("monthly", month));
    const needYear = !(await dataStore.hasSavedExport("yearly", lastYear));
    if (!needMonth && !needYear) return;
    const entries = await dataStore.getTimeEntries();
    if (!entries.length) return; // nothing to save yet
    if (needMonth) await createSnapshot("monthly", month);
    if (needYear && entries.some((e) => e.date.startsWith(lastYear))) await createSnapshot("yearly", lastYear);
  } catch (err) {
    lastCheck = 0; // try again next time
    console.error("Automatic save failed:", err);
  }
}
