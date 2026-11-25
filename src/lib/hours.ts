/** Accepts "1.5", "1:30", "90m", "2h", "2h 15m". Returns minutes, or null if unreadable. */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:rs?|ours?)?)?\s*(?:(\d+)\s*m(?:in(?:s|utes)?)?)?$/);
  if (m && (m[1] || m[2])) return Math.round(Number(m[1] || 0) * 60 + Number(m[2] || 0));
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 60);
  return null;
}

/** "1304" / "13:04" / "9:5" → minutes after midnight, or null. */
export function parseClock(raw: string): number | null {
  const s = raw.trim();
  let h: number, m: number;
  const colon = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) [h, m] = [Number(colon[1]), Number(colon[2])];
  else if (/^\d{3,4}$/.test(s)) [h, m] = [Number(s.slice(0, -2)), Number(s.slice(-2))];
  else if (/^\d{1,2}$/.test(s)) [h, m] = [Number(s), 0];
  else return null;
  return h > 24 || m > 59 ? null : h * 60 + m;
}

/**
 * The workbook's HOUR DIFFERENCES sheet: end − start (military time), minus any gaps (lunch), plus any extra
 * block, then whole hours + the leftover minutes rounded to a tenth of an hour. Returns hours, e.g. 3.8.
 */
export function hourDifference(start: string, end: string, minus = "", plus = ""): number | null {
  const a = parseClock(start);
  const b = parseClock(end);
  if (a === null || b === null) return null;
  const sub = minus.trim() ? parseDuration(minus) : 0;
  const add = plus.trim() ? parseDuration(plus) : 0;
  if (sub === null || add === null) return null;
  let min = b - a;
  if (min < 0) min += 24 * 60;
  min = min - sub + add;
  if (min < 0) return null;
  return Math.floor(min / 60) + Math.round(((min % 60) / 60) * 10) / 10;
}

/** Hours shown to one decimal, the way the workbook stores them. */
export const fmtHours = (minutes: number) => (minutes / 60).toFixed(1);
