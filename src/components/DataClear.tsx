"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

const PHRASE = "DELETE ALL DATA";

/** Admin: wipe the whole app. Asks twice (typed phrase + your password) and saves exports first. */
export function DataClear() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setOpen(false); setPhrase(""); setPassword(""); setError(null); };

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // The full backup file goes to your computer first; if that fails, nothing is deleted.
      const b = await fetch("/api/admin/backup");
      if (!b.ok) throw new Error("Couldn't download the backup file first, so nothing was deleted.");
      const url = URL.createObjectURL(await b.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `TimeTrack_before_clearing_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const res = await fetch("/api/admin/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: phrase, password }) });
      const j = await res.json().catch(() => null);
      if (!j?.success) throw new Error(j?.error || "Couldn't clear the data.");
      window.location.href = "/engineer";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear the data.");
      setBusy(false);
    }
  };

  return (
    <section aria-label="Clear all data" className="rounded-[22px] border border-destructive/40 bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-destructive">Clear all data</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Permanently deletes every person, customer, time entry, invoice and list, and returns the app to first-time setup. Before deleting, a backup file is downloaded to your computer and a spreadsheet copy is saved under Import &amp; saves.
      </p>
      <button type="button" onClick={() => setOpen(true)} data-testid="clear-all-open" className="mt-3 inline-flex h-10 items-center gap-2 rounded-full border border-destructive px-5 text-sm font-semibold text-destructive transition hover:bg-destructive/10">
        <Trash2 className="h-4 w-4" />Clear all data…
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={() => !busy && close()}>
          <div role="dialog" aria-modal="true" aria-label="Clear all data" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && !busy && close()} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold">Are you sure?</h3>
                <p className="mt-1 text-sm text-muted-foreground">This deletes <strong>everything</strong> in the app, including every sign-in. You’ll be asked to create a new admin afterwards. This can’t be undone except by restoring the backup.</p>
              </div>
              <button onClick={close} disabled={busy} aria-label="Cancel" className="rounded-full p-1 hover:bg-foreground/10 disabled:opacity-40"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Type <span className="font-mono text-foreground">{PHRASE}</span> to confirm</span>
                <input aria-label={`Type ${PHRASE} to confirm`} value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-surface-low px-3 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-muted-foreground">Your admin password</span>
                <input aria-label="Your admin password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && phrase === PHRASE && password && !busy && run()} className="mt-1 h-10 w-full rounded-lg border border-outline-variant bg-surface-low px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/25" />
              </label>
              {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={close} disabled={busy} className="h-10 rounded-full border border-outline-variant px-5 text-sm font-semibold hover:bg-foreground/[0.05] disabled:opacity-40">Cancel</button>
              <button onClick={run} disabled={busy || phrase !== PHRASE || !password} data-testid="clear-all-confirm" className="inline-flex h-10 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
                <Trash2 className="h-4 w-4" />{busy ? "Saving exports, then deleting…" : "Save export & delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
