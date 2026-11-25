#!/usr/bin/env node
/**
 * TimeTrack backup agent: runs on a Linux PC, copies backups from the TimeTrack web app onto an SMB share.
 *
 * Settings (share, folder, schedule, how many to keep) are managed in the web app's Admin page; this program
 * checks in every minute, applies them, and reports each run back. Only the SMB password stays on this PC.
 *
 * Needs: Node 18+, and `smbclient` (Debian/Ubuntu: sudo apt install smbclient).
 * Environment: TT_URL, TT_TOKEN, SMB_PASSWORD  (see agent.env.example).  Flag: --once (one check, then exit).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decideRun, folderParts, parseLs, safeShare, stamp, toPrune, FILE_RE } from "./lib.mjs";

const VERSION = "1.0.0";
const URL_BASE = (process.env.TT_URL || "").replace(/\/+$/, "");
const TOKEN = process.env.TT_TOKEN || "";
const SMB_PASSWORD = process.env.SMB_PASSWORD || "";
const SMBCLIENT = process.env.TT_SMBCLIENT || "smbclient";
const POLL = Math.max(10, Number(process.env.TT_POLL_SECONDS) || 60) * 1000;
const STATE_DIR = process.env.TT_STATE_DIR || path.join(os.homedir(), ".timetrack-agent");
const STATE_FILE = path.join(STATE_DIR, "state.json");

const log = (...a) => console.log(new Date().toISOString(), ...a);

if (!URL_BASE || !TOKEN) {
  console.error("Set TT_URL and TT_TOKEN (see agent.env.example).");
  process.exit(2);
}
fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });

const loadState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { return {}; } };
const saveState = (s) => fs.writeFileSync(STATE_FILE, JSON.stringify(s), { mode: 0o600 });

const headers = () => ({ Authorization: `Bearer ${TOKEN}`, "X-Agent-Host": os.hostname(), "X-Agent-Version": VERSION, "X-Agent-Platform": `${os.type()} ${os.release()}` });
async function api(pathname, init = {}) {
  const res = await fetch(`${URL_BASE}${pathname}`, { ...init, headers: { ...headers(), ...(init.headers || {}) }, signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`${pathname} → HTTP ${res.status}`);
  return res;
}
const report = (body) => api("/api/agent/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch((e) => log("report failed:", e.message));

/** Runs smbclient with an auth file (so the password never shows in the process list). */
function smb(cfg, command, folder) {
  return new Promise((resolve, reject) => {
    const authFile = path.join(STATE_DIR, `.auth-${process.pid}`);
    fs.writeFileSync(authFile, `username = ${cfg.smbUser}\npassword = ${SMB_PASSWORD}\n${cfg.smbDomain ? `domain = ${cfg.smbDomain}\n` : ""}`, { mode: 0o600 });
    const args = [safeShare(cfg.share), "-A", authFile, ...(folder ? ["-D", folder] : []), "-c", command];
    const p = spawn(SMBCLIENT, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    const done = (fn) => { fs.rmSync(authFile, { force: true }); fn(); };
    p.on("error", (e) => done(() => reject(new Error(e.code === "ENOENT" ? "smbclient is not installed (sudo apt install smbclient)" : e.message))));
    p.on("close", (code) => done(() => (code === 0 && !/NT_STATUS_[A-Z_]+/.test(out) ? resolve(out) : reject(new Error(out.trim().split("\n").filter(Boolean).pop() || `smbclient exited ${code}`)))));
  });
}

async function backup(cfg, reason) {
  const parts = folderParts(cfg.subfolder);
  const folder = parts.join("/");
  const kinds = [cfg.json && "json", cfg.xlsx && "xlsx"].filter(Boolean);
  const tmp = fs.mkdtempSync(path.join(STATE_DIR, "run-"));
  const files = [];
  let bytes = 0;
  try {
    // build the folder path one level at a time (an existing folder is fine)
    for (let i = 0; i < parts.length; i++) await smb(cfg, `mkdir "${parts.slice(0, i + 1).join("/")}"`).catch(() => {});
    const name = (ext) => `TimeTrack_backup_${stamp(new Date())}.${ext}`;
    for (const ext of kinds) {
      const res = await api(`/api/agent/backup?format=${ext}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 50) throw new Error(`The ${ext} backup came back empty.`);
      const fileName = name(ext);
      const local = path.join(tmp, fileName);
      fs.writeFileSync(local, buf);
      await smb(cfg, `put "${local}" "${fileName}"`, folder);
      const seen = parseLs(await smb(cfg, `ls "${fileName}"`, folder)).find((f) => f.name === fileName);
      if (!seen || seen.size !== buf.length) throw new Error(`${fileName} did not copy completely.`);
      files.push(fileName);
      bytes += buf.length;
    }
    // keep only the newest N of each type
    const all = parseLs(await smb(cfg, 'ls "TimeTrack_backup_*"', folder)).map((f) => f.name).filter((n) => FILE_RE.test(n));
    const old = toPrune(all, cfg.keep);
    if (old.length) await smb(cfg, old.map((n) => `del "${n}"`).join("; "), folder);
    return { ok: true, message: `Copied ${files.length} file${files.length === 1 ? "" : "s"}${old.length ? `, removed ${old.length} old` : ""}.`, files, bytes, reason };
  } catch (e) {
    return { ok: false, message: String(e.message || e).slice(0, 400), files, bytes, reason };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    const cfg = (await (await api("/api/agent/config")).json()).data;
    const state = loadState();
    if (cfg.updatedAt && cfg.updatedAt !== state.applied) {
      await report({ appliedAt: cfg.updatedAt });
      state.applied = cfg.updatedAt;
      saveState(state);
    }
    const reason = decideRun(cfg, state);
    if (!reason) return;
    log(`backup (${reason}) → ${cfg.share}/${cfg.subfolder}`);
    const run = await backup(cfg, reason);
    log(run.ok ? "done:" : "FAILED:", run.message);
    const s = loadState();
    s.lastAttempt = new Date().toISOString();
    s.lastAttemptOk = run.ok;
    if (reason === "manual") s.lastRequestHandled = cfg.runRequestedAt;
    if (run.ok && reason === "scheduled") s.lastScheduledDate = stamp(new Date()).slice(0, 10);
    if (run.ok && reason === "manual") s.lastRequestHandled = cfg.runRequestedAt;
    if (!run.ok && reason === "manual") s.lastRequestHandled = cfg.runRequestedAt; // a failed manual run is reported, not retried forever
    saveState(s);
    await report({ run, appliedAt: cfg.updatedAt });
  } catch (e) {
    log("check-in failed:", e.message);
  } finally {
    busy = false;
  }
}

log(`TimeTrack backup agent ${VERSION} → ${URL_BASE}`);
await tick();
if (!process.argv.includes("--once")) {
  setInterval(tick, POLL);
  process.on("SIGTERM", () => process.exit(0));
}
