"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Download, Upload } from "lucide-react";

interface Summary { name: string; users: number; customers: number; entries: number; exportedAt?: string }

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold transition hover:bg-foreground/[0.05]";

/** Admin tools: download everything as one file, or replace everything from such a file. */
export function DataBackup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [backup, setBackup] = useState<unknown>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const pick = async (file: File | undefined) => {
    setMsg(null);
    setBackup(null);
    setSummary(null);
    setConfirm("");
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.format !== "timetrack-backup" || !data.tables) throw new Error("not a backup");
      setBackup(data);
      setSummary({
        name: file.name,
        users: data.tables.users?.length ?? 0,
        customers: data.tables.customers?.length ?? 0,
        entries: data.tables.timeEntries?.length ?? 0,
        exportedAt: data.exportedAt,
      });
    } catch {
      setMsg({ ok: false, text: "That file isn't a TimeTrack backup (.json made by Export all data)." });
    }
  };

  const restore = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, backup }),
      });
      const j = await res.json().catch(() => null);
      if (!j?.success) throw new Error(j?.error || "The restore failed. Nothing was changed.");
      setMsg({ ok: true, text: `Restored ${j.data.users} people, ${j.data.customers} customers and ${j.data.timeEntries} time entries. Reloading…` });
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "The restore failed. Nothing was changed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Data backup and restore" className="rounded-[14px] border border-border/70 bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold">Data export &amp; import</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Save everything in the app (people, customers, projects, tasks and all time entries) to one file, or restore it from a file saved earlier.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/70 p-4">
          <h3 className="text-sm font-semibold">Export all data</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Downloads a backup file. It includes everyone’s sign-in (scrambled passwords), so keep it somewhere private.
          </p>
          <a href="/api/admin/backup" download className={`${btn} mt-3`} data-testid="backup-export">
            <Download className="h-3.5 w-3.5" />Export all data
          </a>
        </div>

        <div className="rounded-xl border border-border/70 p-4">
          <h3 className="text-sm font-semibold">Import (restore) data</h3>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Importing replaces everything currently in the app with the file’s contents. Export first if you might want today’s data back.
          </p>
          <input ref={fileRef} type="file" accept=".json,application/json" aria-label="Backup file" onChange={(e) => pick(e.target.files?.[0])} className="mt-3 block w-full text-xs file:mr-3 file:rounded-full file:border file:border-outline-variant file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-semibold" />
          {summary && (
            <div className="mt-3 space-y-2 text-xs">
              <p>
                <span className="font-semibold">{summary.name}</span> — {summary.users} people, {summary.customers} customers, {summary.entries} time entries
                {summary.exportedAt && <> · saved {new Date(summary.exportedAt).toLocaleString()}</>}
              </p>
              <label className="flex flex-wrap items-center gap-2">
                <span>Type <span className="font-mono font-semibold">RESTORE</span> to confirm:</span>
                <input
                  aria-label="Type RESTORE to confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-8 w-28 rounded-lg border border-outline-variant bg-surface-low px-2 font-mono text-xs outline-none focus:border-primary"
                />
              </label>
              <button
                type="button"
                onClick={restore}
                disabled={busy || confirm !== "RESTORE"}
                data-testid="backup-restore"
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-4 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
              >
                <Upload className="h-3.5 w-3.5" />{busy ? "Restoring…" : "Replace all data with this file"}
              </button>
            </div>
          )}
        </div>
      </div>
      {msg && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${msg.ok ? "bg-tertiary-container/60 text-foreground" : "bg-destructive/10 text-destructive"}`}>{msg.text}</p>}
    </section>
  );
}
