// Pure helpers for the backup agent (no network, no disk), so they can be tested.

export const RETRY_MINUTES = 15;
const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const stamp = (d) => `${dateKey(d)}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

/**
 * Decide whether to back up now. `state` = { lastScheduledDate, lastRequestHandled, lastAttempt, lastAttemptOk }.
 * Returns "manual", "scheduled" or null.
 */
export function decideRun(cfg, state, now = new Date()) {
  if (!cfg || !cfg.share) return null;
  const sinceAttempt = state.lastAttempt && !state.lastAttemptOk ? (now - new Date(state.lastAttempt)) / 60000 : Infinity;
  if (sinceAttempt < RETRY_MINUTES) return null; // a failed run waits before retrying
  if (cfg.runRequestedAt && cfg.runRequestedAt !== state.lastRequestHandled) return "manual";
  if (!cfg.enabled) return null;
  if (!cfg.days.includes(now.getDay())) return null;
  const [h, m] = cfg.time.split(":").map(Number);
  const due = now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
  return due && state.lastScheduledDate !== dateKey(now) ? "scheduled" : null;
}

export const MAX_CHECK_MINUTES = 7 * 24 * 60;

/**
 * Minutes until the agent should next check in: the next scheduled run, or a week, whichever is sooner.
 * A failed last run retries after RETRY_MINUTES. Never less than 1 minute.
 */
export function nextCheckMinutes(cfg, state, now = new Date()) {
  if (state && state.lastAttempt && !state.lastAttemptOk) return RETRY_MINUTES;
  let best = MAX_CHECK_MINUTES;
  if (cfg && cfg.enabled && cfg.share && Array.isArray(cfg.days) && /^\d\d:\d\d$/.test(cfg.time || "")) {
    const [h, m] = cfg.time.split(":").map(Number);
    for (let i = 0; i <= 7; i++) {
      const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, h, m, 5);
      if (t > now && cfg.days.includes(t.getDay())) { best = Math.min(best, (t - now) / 60000); break; }
    }
  }
  return Math.max(1, best);
}

export const FILE_RE = /^TimeTrack_backup_\d{4}-\d{2}-\d{2}_\d{6}\.(json|xlsx)$/;

/** Names on the share that fall outside the newest `keep` of each type (only our own files are ever considered). */
export function toPrune(names, keep) {
  const out = [];
  for (const ext of ["json", "xlsx"]) {
    const mine = names.filter((n) => FILE_RE.test(n) && n.endsWith(`.${ext}`)).sort().reverse();
    out.push(...mine.slice(keep));
  }
  return out;
}

/** Parses `smbclient ls` output into [{ name, size }]. */
export function parseLs(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s+(\S.*?)\s{2,}([A-Z]+)\s+(\d+)\s+\w{3}\s/);
    if (m && !m[2].includes("D")) rows.push({ name: m[1], size: Number(m[3]) });
  }
  return rows;
}

/** Folder path pieces that are safe to pass to smbclient. */
export function folderParts(sub) {
  const parts = String(sub || "").replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.some((p) => p === "." || p === ".." || !/^[A-Za-z0-9 ._-]+$/.test(p))) throw new Error(`Unsafe folder name: ${sub}`);
  return parts;
}

export function safeShare(share) {
  if (!/^\/\/[A-Za-z0-9._-]+\/[A-Za-z0-9 ._$-]+$/.test(share)) throw new Error(`Bad share: ${share}`);
  return share;
}
