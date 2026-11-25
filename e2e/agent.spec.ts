import { test, expect, type Page } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ADMIN, ENGINEER, loginAs } from "./helpers";
import { decideRun, folderParts, parseLs, toPrune } from "../agent/lib.mjs";

const run = promisify(execFile);
const BASE = "http://localhost:3100";

// ── a pretend smbclient that stores files in a local folder, so the agent can be run for real ──
const FAKE = `#!/usr/bin/env node
const fs = require("fs"), path = require("path");
const a = process.argv.slice(2);
const share = a[0], auth = a[a.indexOf("-A") + 1], dIdx = a.indexOf("-D"), dir = dIdx > 0 ? a[dIdx + 1] : "", cmd = a[a.indexOf("-c") + 1];
const text = fs.readFileSync(auth, "utf8");
if (!/username = backup/.test(text) || !/password = s3cret/.test(text)) { console.log("session setup failed: NT_STATUS_LOGON_FAILURE"); process.exit(1); }
if (share !== "//nas/backups") { console.log("tree connect failed: NT_STATUS_BAD_NETWORK_NAME"); process.exit(1); }
const root = path.join(process.env.FAKE_SMB_ROOT, dir);
const q = (s) => [...s.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
for (const c of cmd.split(";").map((s) => s.trim()).filter(Boolean)) {
  const [verb] = c.split(" "), args = q(c);
  if (verb === "mkdir") { try { fs.mkdirSync(path.join(process.env.FAKE_SMB_ROOT, args[0])); } catch { console.log("NT_STATUS_OBJECT_NAME_COLLISION creating remote directory"); process.exit(1); } }
  else if (verb === "put") { fs.copyFileSync(args[0], path.join(root, args[1])); console.log("putting file " + args[0]); }
  else if (verb === "del") fs.rmSync(path.join(root, args[0]));
  else if (verb === "ls") {
    const re = new RegExp("^" + args[0].replace(/[.+]/g, "\\\\$&").replace(/\\*/g, ".*") + "$");
    for (const n of fs.readdirSync(root).filter((n) => re.test(n))) console.log("  " + n.padEnd(48) + "   A " + String(fs.statSync(path.join(root, n)).size).padStart(10) + "  Mon Jan  1 00:00:00 2026");
    console.log("\\n\\t\\t1000000 blocks of size 1024. 500000 blocks available");
  }
}
`;

async function setup(page: Page) {
  await loginAs(page, ADMIN);
  const save = async (data: object) => (await page.request.put("/api/admin/agent", { data })).json();
  const { data } = await (await page.request.post("/api/admin/agent", { data: { action: "token" } })).json();
  return { save, token: data.token as string };
}
const agentApi = (page: Page, token: string, p: string, init: Record<string, unknown> = {}) =>
  page.request.fetch(p, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers as object) } });

test("agent helpers: schedule, retention, listing parser, safe folders", () => {
  const cfg = { share: "//nas/b", enabled: true, days: [1, 2, 3, 4, 5], time: "02:00", runRequestedAt: null };
  const mon = (h: number, m = 0) => new Date(2026, 10, 23, h, m); // Mon 23 Nov 2026
  expect(decideRun(cfg, {}, mon(1, 59))).toBeNull(); // before the time
  expect(decideRun(cfg, {}, mon(2, 0))).toBe("scheduled");
  expect(decideRun(cfg, { lastScheduledDate: "2026-11-23" }, mon(9))).toBeNull(); // already done today
  expect(decideRun(cfg, {}, new Date(2026, 10, 22, 12))).toBeNull(); // Sunday isn't ticked
  expect(decideRun({ ...cfg, enabled: false }, {}, mon(9))).toBeNull();
  expect(decideRun({ ...cfg, share: "" }, {}, mon(9))).toBeNull();
  expect(decideRun(cfg, { lastAttempt: mon(2, 0).toISOString(), lastAttemptOk: false }, mon(2, 5))).toBeNull(); // failed: wait before retry
  expect(decideRun(cfg, { lastAttempt: mon(2, 0).toISOString(), lastAttemptOk: false }, mon(2, 20))).toBe("scheduled");
  const req = { ...cfg, enabled: false, runRequestedAt: "2026-11-23T10:00:00Z" };
  expect(decideRun(req, {}, mon(9))).toBe("manual"); // "Back up now" works even when scheduling is off
  expect(decideRun(req, { lastRequestHandled: "2026-11-23T10:00:00Z" }, mon(9))).toBeNull();

  const names = ["TimeTrack_backup_2026-11-01_020000.json", "TimeTrack_backup_2026-11-02_020000.json", "TimeTrack_backup_2026-11-03_020000.json", "TimeTrack_backup_2026-11-01_020000.xlsx", "TimeTrack_backup_2026-11-02_020000.xlsx", "my-holiday-photo.json", "TimeTrack_backup_notes.json"];
  expect(toPrune(names, 2).sort()).toEqual(["TimeTrack_backup_2026-11-01_020000.json"]); // only the oldest json; other people's files are never touched
  expect(toPrune(names, 1).sort()).toEqual(["TimeTrack_backup_2026-11-01_020000.json", "TimeTrack_backup_2026-11-01_020000.xlsx", "TimeTrack_backup_2026-11-02_020000.json"]);
  expect(parseLs("  .                                   D        0  Mon Jan  1 00:00:00 2026\n  a b.json                            A     1234  Mon Jan  1 00:00:00 2026\n\n\t\t1000 blocks")).toEqual([{ name: "a b.json", size: 1234 }]);
  expect(folderParts("Backups\\TimeTrack/2026")).toEqual(["Backups", "TimeTrack", "2026"]);
  expect(() => folderParts("../etc")).toThrow();
  expect(() => folderParts('a"; rm')).toThrow();
});

test("only admins manage the agent; settings are validated", async ({ page }) => {
  await loginAs(page, ENGINEER);
  expect((await page.request.get("/api/admin/agent")).status()).toBe(403);
  expect((await page.request.put("/api/admin/agent", { data: { share: "//x/y" } })).status()).toBe(403);
  await page.request.post("/api/auth/logout");
  const { save } = await setup(page);
  const bad = async (d: object) => expect((await save(d)).success).toBe(false);
  await bad({ share: "not a share" });
  await bad({ share: "//nas/b; rm -rf /" });
  await bad({ subfolder: "../up" });
  await bad({ subfolder: 'a"b' });
  await bad({ time: "25:00" });
  await bad({ days: [] });
  await bad({ keep: 0 });
  await bad({ json: false, xlsx: false });
  await bad({ enabled: true, share: "" });
  const ok = await save({ share: "\\\\nas\\backups\\", subfolder: "TimeTrack/2026", smbUser: "backup", time: "03:30", days: [1, 3, 5], keep: 7, enabled: true });
  expect(ok.data.config).toMatchObject({ share: "//nas/backups", subfolder: "TimeTrack/2026", time: "03:30", days: [1, 3, 5], keep: 7, enabled: true });
});

test("the agent API needs the token, serves settings and backups, and takes reports", async ({ page }) => {
  const { save, token } = await setup(page);
  expect(token).toMatch(/^ttagent_[0-9a-f]{48}$/);
  await save({ share: "//nas/backups", smbUser: "backup", enabled: true });
  const anon = await page.context().browser()!.newContext({ baseURL: BASE });
  for (const p of ["/api/agent/config", "/api/agent/backup?format=json"]) {
    expect((await anon.request.get(p)).status()).toBe(401);
    expect((await anon.request.get(p, { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
  }
  expect((await anon.request.get("/api/agent/config", { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
  expect((await anon.request.post("/api/agent/report", { data: {} })).status()).toBe(401);
  // a session cookie is not an agent token
  expect((await page.request.get("/api/agent/config")).status()).toBe(401);

  const cfg = (await (await agentApi(page, token, "/api/agent/config", { headers: { "X-Agent-Host": "nas-pc", "X-Agent-Version": "9.9.9" } })).json()).data;
  expect(cfg).toMatchObject({ share: "//nas/backups", enabled: true });
  const json = await (await agentApi(page, token, "/api/agent/backup?format=json")).json();
  expect(json.format).toBe("timetrack-backup");
  const xlsx = await (await agentApi(page, token, "/api/agent/backup?format=xlsx")).body();
  expect(xlsx.subarray(0, 2).toString()).toBe("PK");
  expect((await agentApi(page, token, "/api/agent/backup?format=exe")).status()).toBe(400);

  // run-now → report clears the request, records the run, and shows up in the admin view
  expect((await (await page.request.post("/api/admin/agent", { data: { action: "run" } })).json()).data.config.runRequestedAt).toBeTruthy();
  await agentApi(page, token, "/api/agent/report", { method: "POST", headers: { "Content-Type": "application/json" }, data: { appliedAt: cfg.updatedAt, run: { ok: true, message: "Copied 2 files.", files: ["a.json"], bytes: 10, reason: "manual" } } });
  const v = (await (await page.request.get("/api/admin/agent")).json()).data;
  expect(v.config.runRequestedAt).toBeNull();
  expect(v.config.updatedAt).toBe(cfg.updatedAt); // finishing a run doesn't look like a settings change
  expect(v.status).toMatchObject({ hostname: "nas-pc", version: "9.9.9", appliedAt: cfg.updatedAt, lastRun: { ok: true, message: "Copied 2 files." } });

  // a new token locks out the old one
  const t2 = (await (await page.request.post("/api/admin/agent", { data: { action: "token" } })).json()).data.token;
  expect((await agentApi(page, token, "/api/agent/config")).status()).toBe(401);
  expect((await agentApi(page, t2, "/api/agent/config")).status()).toBe(200);
  // backups made through Admin → Backup never carry the agent's token or settings
  const full = await (await page.request.get("/api/admin/backup")).json();
  expect(JSON.stringify(full.meta)).not.toMatch(/agent_/);
});

test("the real agent program backs up to an SMB share (fake smbclient), prunes, and reports", async ({ page }) => {
  test.setTimeout(90_000);
  const { save, token } = await setup(page);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ttagent-"));
  const share = path.join(dir, "share"); fs.mkdirSync(path.join(share, "TimeTrack"), { recursive: true }); // (the folder may pre-exist)
  const fake = path.join(dir, "smbclient"); fs.writeFileSync(fake, FAKE, { mode: 0o755 });
  const env = { ...process.env, TT_URL: BASE, TT_TOKEN: token, SMB_PASSWORD: "s3cret", TT_SMBCLIENT: fake, FAKE_SMB_ROOT: share, TT_STATE_DIR: path.join(dir, "state") };
  const agent = () => run("node", ["agent/backup-agent.mjs", "--once"], { env });
  const lastRun = async () => (await (await page.request.get("/api/admin/agent")).json()).data.status.lastRun;

  await save({ share: "//nas/backups", subfolder: "TimeTrack/Nightly", smbUser: "backup", enabled: false, keep: 1 });
  await agent(); // nothing due: just checks in
  expect(fs.existsSync(path.join(share, "TimeTrack/Nightly"))).toBe(false);

  await page.request.post("/api/admin/agent", { data: { action: "run" } });
  await agent();
  const files = () => fs.readdirSync(path.join(share, "TimeTrack/Nightly")).sort();
  expect(files().map((f) => f.split(".").pop())).toEqual(["json", "xlsx"]);
  const json = files().find((f) => f.endsWith(".json"))!;
  expect(JSON.parse(fs.readFileSync(path.join(share, "TimeTrack/Nightly", json), "utf8")).format).toBe("timetrack-backup");
  let r = await lastRun();
  expect(r).toMatchObject({ ok: true, reason: "manual" });
  expect(r.files).toHaveLength(2);
  expect((await (await page.request.get("/api/admin/agent")).json()).data.config.runRequestedAt).toBeNull();

  await agent(); // the request was handled: nothing more happens
  expect(files()).toHaveLength(2);

  // a second backup (different second in the name) with keep=1 leaves only the newest of each type
  await new Promise((x) => setTimeout(x, 1100));
  await page.request.post("/api/admin/agent", { data: { action: "run" } });
  await agent();
  expect(files()).toHaveLength(2);
  expect(files().find((f) => f.endsWith(".json"))).not.toBe(json);
  expect(await lastRun()).toMatchObject({ ok: true, message: expect.stringContaining("removed 2 old") });

  // a wrong password is reported back, not hidden
  await new Promise((x) => setTimeout(x, 1100));
  await page.request.post("/api/admin/agent", { data: { action: "run" } });
  await run("node", ["agent/backup-agent.mjs", "--once"], { env: { ...env, SMB_PASSWORD: "wrong" } });
  r = await lastRun();
  expect(r.ok).toBe(false);
  expect(r.message).toContain("NT_STATUS_LOGON_FAILURE");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("Admin page: settings, token, run-now and status", async ({ page }) => {
  await loginAs(page, ADMIN);
  await page.request.put("/api/admin/agent", { data: { enabled: false, days: [0, 1, 2, 3, 4, 5, 6], share: "" } });
  await page.goto("/admin");
  const s = page.getByTestId("agent-section");
  await expect(s).toBeVisible();
  await s.getByLabel("SMB share").fill("//fileserver/backups");
  await s.getByLabel("SMB user name").fill("svc-backup");
  await s.getByLabel("Backups to keep").fill("14");
  await s.getByLabel("Sun").click();
  await s.getByLabel("Scheduled backups on").check();
  await s.getByTestId("agent-save").click();
  await expect(s.getByRole("status")).toContainText("Saved");
  const saved = (await (await page.request.get("/api/admin/agent")).json()).data.config;
  expect(saved).toMatchObject({ share: "//fileserver/backups", smbUser: "svc-backup", keep: 14, enabled: true });
  expect(saved.days).not.toContain(0);
  await expect(s.getByTestId("agent-save")).toBeDisabled(); // nothing unsaved
  await s.getByLabel("SMB share").fill("bad share");
  await s.getByTestId("agent-save").click();
  await expect(s.getByRole("status")).toContainText("//server/share");
  await page.reload();
  await expect(page.getByTestId("agent-section").getByLabel("SMB share")).toHaveValue("//fileserver/backups");
  await s.getByTestId("agent-run").click();
  await expect(s.getByTestId("agent-run")).toContainText("Backup requested");
  await s.getByTestId("agent-token").click();
  await expect(s.getByTestId("agent-token-value")).toContainText("ttagent_");
});
