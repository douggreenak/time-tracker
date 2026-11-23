/** Shared checks for time-entry input. Each returns an error message, or null when fine. */

export const MAX_MINUTES = 24 * 60;
export const MAX_NOTES = 2000;

export function checkDate(d: unknown): string | null {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return "Date must look like 2026-03-31.";
  const t = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) return "That date doesn't exist.";
  return null;
}

export function checkMinutes(m: unknown): string | null {
  const n = Number(m);
  if (!Number.isFinite(n) || n <= 0) return "Duration must be greater than 0.";
  if (n > MAX_MINUTES) return "A single entry can't be longer than 24 hours.";
  return null;
}

export function checkNotes(n: unknown): string | null {
  if (n != null && typeof n !== "string") return "Notes must be text.";
  if (typeof n === "string" && n.length > MAX_NOTES) return `Notes are limited to ${MAX_NOTES} characters.`;
  return null;
}

export const STATUSES = ["submitted", "approved", "exported"] as const;

/** Shortest password we accept (kept low on purpose; people can pick longer). */
export const MIN_PASSWORD = 4;
