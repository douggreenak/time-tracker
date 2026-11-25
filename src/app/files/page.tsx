"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Save, Upload, X } from "lucide-react";
import { PageLoader } from "@/components/ui/loader";
import { Dropdown } from "@/components/ui/dropdown";
import { useAuth } from "@/components/AuthProvider";
import { useDirectory } from "@/lib/useDirectory";
import { cn } from "@/components/ui";

interface Plan {
  sheets: { sheet: string; person: string; guessUserId: string | null; rows: number; hours: number; newRows: number; duplicateRows: number; from: string | null; to: string | null }[];
  held: { rows: number; newRows: number };
  lumpSum: { rows: number; newRows: number };
  other: { rows: number; newRows: number };
  newCustomers: string[];
}
interface Saved { id: string; kind: "monthly" | "yearly"; period: string; fileName: string; sizeBytes: number; createdAt: string }

const btn = "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold transition hover:bg-foreground/[0.05] disabled:opacity-40";
const primary = "inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40";
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function FilesPage() {
  const dir = useDirectory();
  const { user, isManager } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [heldUserId, setHeldUserId] = useState("");
  const [includeHeld, setIncludeHeld] = useState(true);
  const [includeLists, setIncludeLists] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const loadSaved = useCallback(async () => {
    const j = await fetch("/api/snapshots").then((r) => r.json()).catch(() => null);
    if (j?.success) setSaved(j.data);
  }, []);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  // People you can put time under: everyone for accountants/admins, just yourself for engineers.
  const people = (isManager ? dir.users : dir.users.filter((u) => u.id === user?.id)).map((u) => ({ value: u.id, label: u.name }));
  const personOptions = [{ value: "", label: "— skip this sheet —" }, ...people];

  const body = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    f.set("file", file!);
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };

  const choose = async (picked: File | undefined) => {
    setMsg(null); setPlan(null); setFile(picked ?? null);
    if (!picked) return;
    setBusy(true);
    const f = new FormData();
    f.set("file", picked);
    const j = await fetch("/api/import/preview", { method: "POST", body: f }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j?.success) return setMsg({ ok: false, text: j?.error ?? "Couldn't read that file." });
    const p = j.data as Plan;
    setPlan(p);
    const allowed = new Set(people.map((x) => x.value));
    setMapping(Object.fromEntries(p.sheets.map((s) => [s.sheet, s.guessUserId && allowed.has(s.guessUserId) ? s.guessUserId : isManager ? "" : user?.id ?? ""])));
    setHeldUserId(user?.id ?? "");
  };

  // Re-count what's new whenever the choices change.
  const [live, setLive] = useState<Plan | null>(null);
  useEffect(() => {
    if (!file || !plan) return;
    const t = setTimeout(async () => {
      const f = new FormData();
      f.set("file", file);
      f.set("mapping", JSON.stringify(mapping));
      f.set("heldUserId", heldUserId);
      f.set("includeHeld", String(includeHeld));
      f.set("includeLists", String(includeLists));
      const j = await fetch("/api/import/preview", { method: "POST", body: f }).then((r) => r.json()).catch(() => null);
      if (j?.success) setLive(j.data);
    }, 0);
    return () => clearTimeout(t);
  }, [file, plan, mapping, heldUserId, includeHeld, includeLists]);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    const j = await fetch("/api/import", { method: "POST", body: body({ mapping: JSON.stringify(mapping), heldUserId, includeHeld: String(includeHeld), includeLists: String(includeLists) }) })
      .then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (!j?.success) return setMsg({ ok: false, text: j?.error ?? "The import failed." });
    const d = j.data as { added: number; lists: number; skipped: number; customersCreated: number };
    setMsg({ ok: true, text: `Added ${d.added} time entries${d.lists ? ` and ${d.lists} lump sum / other rows` : ""}${d.customersCreated ? `, created ${d.customersCreated} new customers` : ""}. ${d.skipped} rows were already here and were skipped.` });
    setPlan(null); setLive(null); setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    dir.reload();
    loadSaved();
  };

  const saveNow = async (kind: "monthly" | "yearly") => {
    setBusy(true);
    const j = await fetch("/api/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, year }) }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    setMsg(j?.success ? { ok: true, text: kind === "yearly" ? `Saved the ${year} spreadsheet.` : "Saved this month's full-data spreadsheet." } : { ok: false, text: j?.error ?? "Couldn't save." });
    loadSaved();
  };

  if (!dir.loaded || !saved) return <PageLoader label="Loading…" />;
  const shown = live ?? plan;
  const toAdd = shown ? shown.sheets.reduce((n, s) => n + (mapping[s.sheet] ? s.newRows : 0), 0) + (includeHeld ? shown.held.newRows : 0) + (includeLists ? shown.lumpSum.newRows + shown.other.newRows : 0) : 0;
  const years = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() - i));

  return (
    <div className="flex w-full flex-col gap-5 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Import &amp; saved spreadsheets</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Bring in time from the Apex billing workbook (any year’s file), and keep spreadsheet copies of everything: a full-data save every month and a yearly save, in the same workbook layout so they can be imported again.
        </p>
      </div>

      {msg && (
        <div role="status" className={cn("flex animate-m3-rise items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-medium", msg.ok ? "bg-tertiary-container/60 text-tertiary-on-container" : "bg-destructive/10 text-destructive")}>
          <span className="flex items-center gap-2">{msg.ok ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}{msg.text}</span>
          <button onClick={() => setMsg(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Import */}
      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
        <h2 className="border-b border-border/70 px-4 py-3 text-sm font-semibold">Import a spreadsheet</h2>
        <div className="space-y-4 p-4">
          <p className="text-xs text-muted-foreground">
            Choose a workbook (.xlsx or .xlsm) with “TIME SUMMARY - …” sheets. Rows are added with their original dates, so history fills in. Anything already here is skipped, so importing the same file twice is safe.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm" aria-label="Spreadsheet to import" data-testid="import-file" onChange={(e) => choose(e.target.files?.[0])} className="hidden" />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className={btn} data-testid="import-choose"><Upload className="h-3.5 w-3.5" />Choose spreadsheet…</button>
            {file && <span className="text-xs text-muted-foreground">{file.name}</span>}
          </div>

          {shown && (
            <div className="space-y-3" data-testid="import-plan">
              <div className="m3-scroll overflow-auto rounded-xl border border-border/70">
                <table className="w-full min-w-[40rem] text-left text-xs">
                  <thead className="bg-surface-container text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
                    <tr><th className="px-3 py-2">Sheet</th><th className="w-56 px-2">Put this time under</th><th className="px-2 text-right">Rows</th><th className="px-2 text-right">Hours</th><th className="px-2">Dates</th><th className="px-2 text-right">New</th><th className="px-2 text-right">Already here</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {shown.sheets.map((s) => (
                      <tr key={s.sheet}>
                        <td className="px-3 py-2 font-medium">{s.sheet}</td>
                        <td className="px-2"><Dropdown aria-label={`Person for ${s.sheet}`} value={mapping[s.sheet] ?? ""} onChange={(v) => setMapping({ ...mapping, [s.sheet]: v })} options={personOptions} className="h-8 text-xs" /></td>
                        <td className="px-2 text-right font-mono tabular-nums">{s.rows}</td>
                        <td className="px-2 text-right font-mono tabular-nums">{s.hours.toFixed(1)}</td>
                        <td className="whitespace-nowrap px-2 text-muted-foreground">{s.from ? `${s.from} → ${s.to}` : "—"}</td>
                        <td className="px-2 text-right font-mono tabular-nums">{mapping[s.sheet] ? s.newRows : "—"}</td>
                        <td className="px-2 text-right font-mono tabular-nums text-muted-foreground">{mapping[s.sheet] ? s.duplicateRows : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                {shown.held.rows > 0 && (
                  <label className="flex items-center gap-2"><input type="checkbox" checked={includeHeld} onChange={(e) => setIncludeHeld(e.target.checked)} className="accent-[hsl(var(--primary))]" />Held time ({shown.held.newRows} new of {shown.held.rows}) under
                    <span className="w-44"><Dropdown aria-label="Person for held time" value={heldUserId} onChange={setHeldUserId} options={people} className="h-8 text-xs" /></span></label>
                )}
                {shown.lumpSum.rows + shown.other.rows > 0 && (
                  <label className="flex items-center gap-2"><input type="checkbox" checked={includeLists} onChange={(e) => setIncludeLists(e.target.checked)} className="accent-[hsl(var(--primary))]" />Lump sum &amp; other lists ({shown.lumpSum.newRows + shown.other.newRows} new)</label>
                )}
              </div>
              {shown.newCustomers.length > 0 && <p className="text-xs text-muted-foreground">New customers that will be created ({shown.newCustomers.length}): {shown.newCustomers.slice(0, 12).join(", ")}{shown.newCustomers.length > 12 ? "…" : ""}</p>}
              <div className="flex items-center gap-3">
                <button onClick={run} disabled={busy || toAdd === 0} data-testid="import-run" className={primary}><FileSpreadsheet className="h-3.5 w-3.5" />Import {toAdd} new row{toAdd === 1 ? "" : "s"}</button>
                {toAdd === 0 && <span className="text-xs text-muted-foreground">Nothing new to add — pick a person for each sheet you want, or everything is already here.</span>}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Saved spreadsheets */}
      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <h2 className="mr-auto text-sm font-semibold">Saved spreadsheets</h2>
          <button onClick={() => saveNow("monthly")} disabled={busy} data-testid="save-monthly" className={btn}><Save className="h-3.5 w-3.5" />Save full data now</button>
          <span className="w-24"><Dropdown aria-label="Year" value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} className="h-9 text-xs" /></span>
          <button onClick={() => saveNow("yearly")} disabled={busy} data-testid="save-yearly" className={btn}><Save className="h-3.5 w-3.5" />Save {year}</button>
          <a href={`/api/export/workbook?year=${year}`} download className={btn}><Download className="h-3.5 w-3.5" />Download {year}</a>
          <a href="/api/export/workbook" download className={btn}><Download className="h-3.5 w-3.5" />Download all</a>
        </div>
        <p className="border-b border-border/70 px-4 py-2 text-xs text-muted-foreground">A full-data spreadsheet is saved automatically the first time the app is used each month, and last year’s yearly spreadsheet is saved in January. Saving again replaces that month’s or year’s file.</p>
        <table className="w-full text-left text-xs" data-testid="saved-list">
          <tbody className="divide-y divide-border/60">
            {saved.map((s) => (
              <tr key={s.id} className="hover:bg-surface-low">
                <td className="px-4 py-2"><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", s.kind === "yearly" ? "bg-secondary-container text-secondary-on-container" : "bg-primary/10 text-primary")}>{s.kind === "yearly" ? "Yearly" : "Monthly"}</span></td>
                <td className="px-2 font-medium">{s.period}</td>
                <td className="px-2 text-muted-foreground">{s.fileName}</td>
                <td className="px-2 text-muted-foreground">{kb(s.sizeBytes)}</td>
                <td className="px-2 text-muted-foreground">saved {new Date(s.createdAt).toLocaleDateString()}</td>
                <td className="px-2 text-right"><a href={`/api/snapshots/${s.id}`} download aria-label={`Download ${s.fileName}`} className="inline-flex h-7 items-center gap-1 rounded-full px-2 font-semibold text-primary hover:bg-primary/10"><Download className="h-3.5 w-3.5" />Download</a></td>
              </tr>
            ))}
            {saved.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground">Nothing saved yet — the first save happens automatically, or press “Save full data now”.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
