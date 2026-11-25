/** Shared checks for time-entry input. Each returns an error message, or null when fine. */

export const MAX_MINUTES = 24 * 60;
export const MAX_NOTES = 2000;

export function checkDate(d: unknown): string | null {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Date must look like 2026-03-31.";
  const t = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) return "That date doesn't exist.";
  return null;
}

/** `allowZero` is for lump-sum days, which the workbook logs with no hours. */
export function checkMinutes(m: unknown, allowZero = false): string | null {
  const n = Number(m);
  if (!Number.isFinite(n) || n < 0 || (n === 0 && !allowZero)) return "Duration must be greater than 0.";
  if (n > MAX_MINUTES) return "A single entry can't be longer than 24 hours.";
  return null;
}

export function checkNotes(n: unknown): string | null {
  if (n != null && typeof n !== "string") return "Notes must be text.";
  if (typeof n === "string" && n.length > MAX_NOTES) return `Notes are limited to ${MAX_NOTES} characters.`;
  return null;
}

/** Shortest password we accept (kept low on purpose; people can pick longer). */
export const MIN_PASSWORD = 4;

/** Text fields on a time entry, with their limits. Returns an error message or null. */
export function checkEntryText(b: Record<string, unknown>): string | null {
  for (const [key, label, max] of [["partsNote", "Parts", 2000], ["internalNote", "Note", 2000], ["contractPo", "Contract / PO", 255]] as const) {
    const v = b[key];
    if (v != null && typeof v !== "string") return `${label} must be text.`;
    if (typeof v === "string" && v.length > max) return `${label} is limited to ${max} characters.`;
  }
  return null;
}
