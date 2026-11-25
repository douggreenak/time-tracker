"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Copy, HardDrive, KeyRound, Play, Save } from "lucide-react";
import { cn } from "@/components/ui";
import type { AgentConfig, AgentStatus } from "@/lib/agent";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const field = "h-10 w-full rounded-lg border border-outline-variant bg-surface-low px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25";
const btn = "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold transition hover:bg-foreground/[0.05]";
const ago = (iso: string | null) => {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  return s < 90 ? "just now" : s < 5400 ? `${Math.round(s / 60)} min ago` : s < 129600 ? `${Math.round(s / 3600)} h ago` : new Date(iso).toLocaleDateString();
};

/** Admin: manage the Linux backup agent that copies backups to an SMB share. The agent reads these settings and reports back. */
export function AgentSettings() {
  const [cfg, setCfg] = useState<AgentConfig | null>(null);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (keepForm = false) => {
    const j = await fetch("/api/admin/agent").then((r) => r.json()).catch(() => null);
    if (!j?.success) return;
    setStatus(j.data.status);
    setHasToken(j.data.hasToken);
    if (!keepForm) setCfg(j.data.config);
    else setCfg((c) => (c ? { ...c, runRequestedAt: j.data.config.runRequestedAt, updatedAt: j.data.config.updatedAt } : j.data.config));
  }, []);
  useEffect(() => { load(); const t = setInterval(() => load(true), 15000); return () => clearInterval(t); }, [load]);

  const call = async (init: RequestInit, ok: string) => {
    setBusy(true);
    setMsg(null);
    const j = await fetch("/api/admin/agent", { ...init, headers: { "Content-Type": "application/json" } }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j?.success) { setMsg({ ok: false, text: j?.error ?? "Couldn't save." }); return null; }
    setMsg({ ok: true, text: ok });
    setStatus(j.data.status); setHasToken(j.data.hasToken); setCfg(j.data.config); setDirty(false);
    return j.data;
  };

  if (!cfg || !status) return null;
  const set = <K extends keyof AgentConfig>(k: K, v: AgentConfig[K]) => { setCfg({ ...cfg, [k]: v }); setDirty(true); };
  const online = !!status.lastSeen && Date.now() - new Date(status.lastSeen).getTime() < 3 * 60_000;
  const applied = !!cfg.updatedAt && status.appliedAt === cfg.updatedAt;
  const run = status.lastRun;

  return (
    <section aria-label="Backup agent" className="rounded-[22px] border border-border/70 bg-card p-4 shadow-sm sm:p-5" data-testid="agent-section">
      <h2 className="flex items-center gap-2 text-base font-semibold"><HardDrive className="h-4 w-4" />Backup agent (SMB share)</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        A small program on a Linux PC copies a full backup (restore file + spreadsheet) to a network share on a schedule. Everything below is managed here; the agent checks in every minute and applies it. Only the share’s password stays on that PC.
      </p>

      {/* status */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border/70 bg-surface-low px-4 py-3 text-sm" data-testid="agent-status">
        <span className="flex items-center gap-2 font-semibold">
          <span className={cn("h-2.5 w-2.5 rounded-full", online ? "bg-emerald-500" : "bg-muted-foreground/50")} />
          {online ? "Agent online" : status.lastSeen ? "Agent offline" : "No agent has connected yet"}
        </span>
        {status.lastSeen && <span className="text-xs text-muted-foreground">{status.hostname || "unknown PC"} · v{status.version} · seen {ago(status.lastSeen)}</span>}
        {status.lastSeen && <span className={cn("text-xs font-medium", applied ? "text-muted-foreground" : "text-amber-600")}>{applied ? "Settings applied" : "Waiting for the agent to pick up the latest settings"}</span>}
        {run && (
          <span className={cn("flex items-center gap-1.5 text-xs font-medium", run.ok ? "text-emerald-600" : "text-destructive")} data-testid="agent-last-run">
            {run.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            Last backup {ago(run.at)}: {run.message}
          </span>
        )}
      </div>

      {/* settings */}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={cfg.enabled} onChange={(e) => set("enabled", e.target.checked)} aria-label="Scheduled backups on" className="h-4 w-4 accent-[hsl(var(--primary))]" />
          <span className="font-medium">Run scheduled backups</span>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">SMB share
          <input aria-label="SMB share" placeholder="//server/share" value={cfg.share} onChange={(e) => set("share", e.target.value)} className={cn(field, "mt-1 font-mono")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Folder inside the share
          <input aria-label="Folder inside the share" placeholder="TimeTrack" value={cfg.subfolder} onChange={(e) => set("subfolder", e.target.value)} className={cn(field, "mt-1 font-mono")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">SMB user name
          <input aria-label="SMB user name" autoComplete="off" value={cfg.smbUser} onChange={(e) => set("smbUser", e.target.value)} className={cn(field, "mt-1")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Domain / workgroup (optional)
          <input aria-label="Domain" autoComplete="off" value={cfg.smbDomain} onChange={(e) => set("smbDomain", e.target.value)} className={cn(field, "mt-1")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Time of day (on the agent PC)
          <input aria-label="Backup time" type="time" value={cfg.time} onChange={(e) => set("time", e.target.value)} className={cn(field, "mt-1")} />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">Backups to keep (of each type)
          <input aria-label="Backups to keep" type="number" min={1} max={3650} value={cfg.keep} onChange={(e) => set("keep", Number(e.target.value))} className={cn(field, "mt-1")} />
        </label>
        <fieldset className="md:col-span-2">
          <legend className="text-xs font-semibold text-muted-foreground">Days</legend>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => {
              const on = cfg.days.includes(i);
              return (
                <button key={d} type="button" aria-pressed={on} aria-label={d} onClick={() => set("days", on ? cfg.days.filter((x) => x !== i) : [...cfg.days, i].sort())}
                  className={cn("h-9 w-12 rounded-full border text-xs font-semibold transition", on ? "border-primary bg-primary text-primary-foreground" : "border-outline-variant text-muted-foreground hover:bg-foreground/[0.05]")}>{d}</button>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-1 text-sm md:col-span-2">
          <legend className="text-xs font-semibold text-muted-foreground">Files</legend>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.json} onChange={(e) => set("json", e.target.checked)} aria-label="Restore file (.json)" className="accent-[hsl(var(--primary))]" />Restore file (.json)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={cfg.xlsx} onChange={(e) => set("xlsx", e.target.checked)} aria-label="Spreadsheet (.xlsx)" className="accent-[hsl(var(--primary))]" />Spreadsheet (.xlsx)</label>
        </fieldset>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !dirty} onClick={() => call({ method: "PUT", body: JSON.stringify(cfg) }, "Saved. The agent will pick this up within a minute.")} data-testid="agent-save" className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110">
          <Save className="h-4 w-4" />Save settings
        </button>
        <button type="button" disabled={busy || dirty || !cfg.share || !!cfg.runRequestedAt} onClick={() => call({ method: "POST", body: JSON.stringify({ action: "run" }) }, "Asked the agent to back up now.")} data-testid="agent-run" className={btn}>
          <Play className="h-3.5 w-3.5" />{cfg.runRequestedAt ? "Backup requested…" : "Back up now"}
        </button>
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
      </div>
      {msg && <p role="status" className={cn("mt-3 rounded-lg px-3 py-2 text-sm font-medium", msg.ok ? "bg-tertiary-container/60 text-foreground" : "bg-destructive/10 text-destructive")}>{msg.text}</p>}

      {/* token / install */}
      <div className="mt-5 rounded-xl border border-border/70 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" />Connect an agent</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {hasToken ? "An agent token exists. Making a new one disconnects the current agent until it’s given the new token." : "Make a token, then put it in the agent’s settings on the Linux PC."} See <span className="font-mono">agent/README.md</span> in the project for the 3-step install.
        </p>
        <button type="button" disabled={busy} onClick={async () => { const d = await call({ method: "POST", body: JSON.stringify({ action: "token" }) }, "New token made. Copy it now — it won’t be shown again."); if (d) setToken(d.token); }} data-testid="agent-token" className={cn(btn, "mt-3")}>
          <KeyRound className="h-3.5 w-3.5" />{hasToken ? "Make a new agent token" : "Make an agent token"}
        </button>
        {token && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-low px-3 py-2">
            <code data-testid="agent-token-value" className="min-w-0 flex-1 break-all font-mono text-xs">{token}</code>
            <button type="button" aria-label="Copy token" onClick={() => navigator.clipboard?.writeText(token)} className="rounded-full p-1.5 hover:bg-foreground/10"><Copy className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {status.history.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Recent backups ({status.history.length})</summary>
          <ul className="mt-2 divide-y divide-border/60 rounded-lg border border-border/70" data-testid="agent-history">
            {status.history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 px-3 py-1.5">
                <span className={h.ok ? "text-emerald-600" : "text-destructive"}>{h.ok ? "OK" : "Failed"}</span>
                <span className="text-muted-foreground">{new Date(h.at).toLocaleString()} · {h.reason}</span>
                <span className="min-w-0 flex-1 truncate">{h.message}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
