"use client";

import { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

const PHRASE = "DELETE ALL DATA";

const GROUPS = [
  { id: "entries", label: "Time entries", help: "every logged row, including held time" },
  { id: "invoices", label: "Invoice history", help: "saved invoices (time stays marked as invoiced)" },
  { id: "lists", label: "Lump sum & other lists", help: "the Data tab’s two lists" },
  { id: "customers", label: "Customers", help: "also deletes all time entries" },
  { id: "people", label: "People & sign-ins", help: "also deletes all time entries, and signs everyone out" },
  { id: "saved", label: "Saved spreadsheets", help: "the monthly and yearly saves (this clear’s own copy is kept)" },
] as const;

/** Admin: wipe the whole app. Asks twice (typed phrase + your password) and saves exports first. */
export function DataClear() {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set(GROUPS.map((g) => g.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Customers and people own the time entries, so choosing either also chooses time entries.
  const forced = (id: string) => id === "entries" && (picked.has("customers") || picked.has("people"));
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const everything = picked.size === GROUPS.length;

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

      const res = await fetch("/api/admin/clear", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: phrase, password, parts: Array.from(picked) }) });
      const j = await res.json().catch(() => null);
      if (!j?.success) throw new Error(j?.error || "Couldn't clear the data.");
      window.location.href = "/engineer"; // (goes to first-time setup if everyone was deleted)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't clear the data.");
      setBusy(false);
    }
  };

  return (
    <section aria-label="Clear all data" className="rounded-[22px] border border-destructive/40 bg-card p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-destructive">Clear all data</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Permanently deletes the parts of the app you choose. Before deleting, a backup file is downloaded to your computer and a spreadsheet copy of everything is saved under Import &amp; saves.
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
                <p className="mt-1 text-sm text-muted-foreground">Tick what to delete. {picked.has("people") ? "People are included, so everyone is signed out and you’ll create a new admin afterwards. " : ""}This can’t be undone except by restoring the backup.</p>
              </div>
              <button onClick={close} disabled={busy} aria-label="Cancel" className="rounded-full p-1 hover:bg-foreground/10 disabled:opacity-40"><X className="h-4 w-4" /></button>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-1 flex w-full items-center justify-between text-xs font-semibold text-muted-foreground">
                What to delete
                <button type="button" onClick={() => setPicked(everything ? new Set() : new Set(GROUPS.map((g) => g.id)))} disabled={busy} className="font-semibold text-primary hover:underline">{everything ? "Select none" : "Select all"}</button>
              </legend>
              <ul className="divide-y divide-border/60 rounded-xl border border-border/70">
                {GROUPS.map((g) => {
                  const on = picked.has(g.id) || forced(g.id);
                  return (
                    <li key={g.id}>
                      <label className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm">
                        <input type="checkbox" checked={on} disabled={busy || forced(g.id)} onChange={() => toggle(g.id)} aria-label={g.label} className="mt-1 h-4 w-4 accent-[hsl(var(--destructive))]" />
                        <span><span className="font-medium">{g.label}</span><span className="block text-xs text-muted-foreground">{g.help}</span></span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
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
              <button onClick={run} disabled={busy || phrase !== PHRASE || !password || picked.size === 0} data-testid="clear-all-confirm" className="inline-flex h-10 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
                <Trash2 className="h-4 w-4" />{busy ? "Saving exports, then deleting…" : everything ? "Save export & delete everything" : "Save export & delete selected"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
