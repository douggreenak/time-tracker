import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

/** Settings for the Linux backup agent (agent/). Managed in Admin; the agent polls for them. */
export interface AgentConfig {
  enabled: boolean;
  /** SMB share as //server/share */
  share: string;
  /** Folder inside the share (created if missing) */
  subfolder: string;
  smbUser: string;
  smbDomain: string;
  /** 24h local time on the PC, "02:00" */
  time: string;
  /** Days of the week it runs, 0 = Sunday */
  days: number[];
  /** How many backups of each type to keep on the share */
  keep: number;
  json: boolean;
  xlsx: boolean;
  /** Set by "Run now"; cleared when the agent reports back */
  runRequestedAt: string | null;
  updatedAt: string;
}

export interface AgentRun { at: string; ok: boolean; message: string; files: string[]; bytes: number; reason: string }
export interface AgentStatus { lastSeen: string | null; hostname: string; version: string; platform: string; appliedAt: string | null; lastRun: AgentRun | null; history: AgentRun[] }

export const DEFAULT_CONFIG: AgentConfig = {
  enabled: false, share: "", subfolder: "TimeTrack", smbUser: "", smbDomain: "", time: "02:00", days: [0, 1, 2, 3, 4, 5, 6], keep: 30, json: true, xlsx: true, runRequestedAt: null, updatedAt: "",
};
const EMPTY_STATUS: AgentStatus = { lastSeen: null, hostname: "", version: "", platform: "", appliedAt: null, lastRun: null, history: [] };

const parse = <T,>(s: string | null, fallback: T): T => { try { return s ? { ...fallback, ...JSON.parse(s) } : fallback; } catch { return fallback; } };
export const getConfig = async () => parse<AgentConfig>(await dataStore.getMeta("agent_config"), DEFAULT_CONFIG);
export const getStatus = async () => parse<AgentStatus>(await dataStore.getMeta("agent_status"), EMPTY_STATUS);
export const saveConfig = (c: AgentConfig, keepStamp = false) => dataStore.setMeta("agent_config", JSON.stringify({ ...c, updatedAt: keepStamp ? c.updatedAt : new Date().toISOString() }));
export const saveStatus = (s: AgentStatus) => dataStore.setMeta("agent_status", JSON.stringify(s));

/** Checks and cleans the settings an admin sends. Returns an error message or the clean config. */
export function cleanConfig(input: Partial<AgentConfig>, current: AgentConfig): AgentConfig | string {
  const next = { ...current };
  if (input.enabled !== undefined) next.enabled = !!input.enabled;
  if (input.share !== undefined) {
    const s = String(input.share).trim().replace(/\\/g, "/").replace(/\/+$/, "");
    if (s && !/^\/\/[A-Za-z0-9._-]+\/[A-Za-z0-9 ._$-]+$/.test(s)) return "The share must look like //server/share.";
    next.share = s;
  }
  if (input.subfolder !== undefined) {
    const f = String(input.subfolder).trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (f && (!/^[A-Za-z0-9 ._/-]+$/.test(f) || f.split("/").some((p) => p === ".." || p === "." || p === ""))) return "The folder can only use letters, numbers, spaces and . _ - /";
    next.subfolder = f;
  }
  for (const k of ["smbUser", "smbDomain"] as const)
    if (input[k] !== undefined) {
      const v = String(input[k]).trim();
      if (v.length > 100 || /[\r\n\0"]/.test(v)) return "That user or domain isn't valid.";
      next[k] = v;
    }
  if (input.time !== undefined) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(input.time))) return "Time must be like 02:00.";
    next.time = String(input.time);
  }
  if (input.days !== undefined) {
    const d = Array.isArray(input.days) ? Array.from(new Set(input.days.map(Number))).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6).sort() : [];
    if (!d.length) return "Pick at least one day.";
    next.days = d;
  }
  if (input.keep !== undefined) {
    const k = Number(input.keep);
    if (!Number.isInteger(k) || k < 1 || k > 3650) return "Keep between 1 and 3650 backups.";
    next.keep = k;
  }
  if (input.json !== undefined) next.json = !!input.json;
  if (input.xlsx !== undefined) next.xlsx = !!input.xlsx;
  if (!next.json && !next.xlsx) return "Choose at least one file type to back up.";
  if (next.enabled && !next.share) return "Enter the SMB share before turning backups on.";
  return next;
}

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export async function newAgentToken() {
  const token = `ttagent_${randomBytes(24).toString("hex")}`;
  await dataStore.setMeta("agent_token_hash", hash(token));
  return token;
}
export const hasAgentToken = async () => !!(await dataStore.getMeta("agent_token_hash"));

/** For /api/agent/*: the agent sends `Authorization: Bearer <token>`. */
export async function requireAgent(request: Request): Promise<NextResponse | null> {
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const stored = await dataStore.getMeta("agent_token_hash");
  const ok = !!stored && !!given && (() => { const a = Buffer.from(hash(given)), b = Buffer.from(stored); return a.length === b.length && timingSafeEqual(a, b); })();
  return ok ? null : NextResponse.json({ success: false, error: "Bad agent token." }, { status: 401 });
}

/** Marks the agent as seen (any request it makes). */
export async function touchAgent(request: Request, extra: Partial<AgentStatus> = {}) {
  const s = await getStatus();
  const h = (k: string) => (request.headers.get(k) ?? "").slice(0, 100);
  await saveStatus({ ...s, ...extra, lastSeen: new Date().toISOString(), hostname: h("x-agent-host") || s.hostname, version: h("x-agent-version") || s.version, platform: h("x-agent-platform") || s.platform });
}
