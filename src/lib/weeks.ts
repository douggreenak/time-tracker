/** Pay weeks run Monday–Sunday. Dates are "YYYY-MM-DD" strings. */

/** The Monday that starts the week containing `d`. */
export function weekStart(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return dt.toLocaleDateString("en-CA");
}

/** "Nov 16 – Nov 22" (the year is added only when it isn't this year). */
export function weekRangeLabel(wk: string): string {
  const a = new Date(`${wk}T00:00:00`);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const f = (d: Date, year: boolean) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
  return `${f(a, false)} – ${f(b, b.getFullYear() !== new Date().getFullYear())}`;
}

/** "This week", "Last week", or null. */
export function weekTag(wk: string): string | null {
  const now = weekStart(new Date().toLocaleDateString("en-CA"));
  const d = Math.round((new Date(`${now}T00:00:00`).getTime() - new Date(`${wk}T00:00:00`).getTime()) / 604800000);
  return d === 0 ? "This week" : d === 1 ? "Last week" : null;
}
