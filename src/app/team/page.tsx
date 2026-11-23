"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Plus, Trash2, X } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { TextCell, cellBase } from "@/components/ui/cell";
import { DataBackup } from "@/components/DataBackup";
import { RequireAdmin } from "@/components/AuthProvider";
import { useDirectory } from "@/lib/useDirectory";
import { cn } from "@/components/ui";
import { MIN_PASSWORD } from "@/lib/validate";

const ROLES = ["engineer", "accountant", "admin"] as const;
const selectCell = cn(cellBase, "m3-select cursor-pointer appearance-none pr-7 capitalize [background-position:right_0.5rem_center] [background-size:12px_12px]");

function TeamPage() {
  const dir = useDirectory();
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [draft, setDraft] = useState({ name: "", email: "", role: "engineer", rate: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState<string | null>(null);
  const [pwKey, setPwKey] = useState(0);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  /** A readable one-time password (no look-alike characters). Shown once; the person should change it after signing in. */
  const makeTemp = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  };

  useEffect(() => {
    fetch("/api/time-entries").then((r) => r.json()).then((j) => j.success && setEntries(j.data)).catch(() => {});
  }, []);

  const minutes = useMemo(() => {
    const m = new Map<string, number>();
    entries.forEach((e) => m.set(e.userId, (m.get(e.userId) ?? 0) + e.durationMinutes));
    return m;
  }, [entries]);

  const run = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    setError(r.ok ? null : r.error ?? "Something went wrong");
    return r;
  };

  const resetPassword = async (id: string, name: string) => {
    const password = makeTemp();
    const r = await run(dir.updateUser(id, { password }));
    if (r.ok) { setTemp({ name, password }); setCopied(false); }
  };

  const add = async () => {
    if (!draft.name.trim() || !draft.email.trim()) return setError("Enter a name and an email to add someone.");
    if (draft.password.length < MIN_PASSWORD) return setError(`Give them a starting password of at least ${MIN_PASSWORD} characters.`);
    const rate = draft.rate.trim() === "" ? undefined : Number(draft.rate);
    if (rate !== undefined && !Number.isFinite(rate)) return setError("Hourly rate must be a number.");
    const r = await run(dir.createUser({ name: draft.name.trim(), email: draft.email.trim(), role: draft.role, defaultHourlyRate: rate, password: draft.password }));
    if (r.ok) setDraft({ name: "", email: "", role: draft.role, rate: "", password: "" });
  };
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && add();

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">Team</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Admins manage everyone here: add people, change roles and rates, and set or reset passwords. Engineers appear in the timesheet’s engineer picker; the QuickBooks name must match the employee name in QuickBooks.
        </p>
      </div>

      {temp && (
        <div role="status" className="flex animate-m3-rise flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-tertiary/30 bg-tertiary-container/60 px-4 py-3 text-sm">
          <span>New temporary password for <strong>{temp.name}</strong>:</span>
          <code data-testid="temp-password" className="rounded-md bg-card px-2 py-1 font-mono text-[13px] tracking-wide">{temp.password}</code>
          <button
            onClick={() => { navigator.clipboard?.writeText(temp.password); setCopied(true); }}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-outline-variant bg-card px-3 text-xs font-semibold hover:bg-foreground/[0.05]"
          >{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}</button>
          <span className="text-xs text-muted-foreground">Shown once — it can’t be looked up later. Ask them to change it from their Account page.</span>
          <button onClick={() => setTemp(null)} aria-label="Dismiss" className="ml-auto rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      {error && (
        <div role="alert" className="flex animate-m3-rise items-center justify-between gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      <section className="overflow-hidden rounded-[14px] border border-border/70 bg-card shadow-sm">
        <div className="stack-table-wrap m3-scroll max-h-[calc(100dvh-13rem)] min-h-[8rem] overflow-auto">
          <table className="stack-table w-full min-w-[64rem] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th>Name</th>
                <th>Email</th>
                <th className="w-36">Role</th>
                <th>QuickBooks employee name</th>
                <th className="w-28 text-right">Rate / hr</th>
                <th className="w-24 text-right">Hours</th>
                <th className="w-44">Password</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              <tr className="bg-primary-container/40">
                <td data-label="Name" className="span-2"><input aria-label="New person name" placeholder="Full name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={onEnter} className={cellBase} /></td>
                <td data-label="Email" className="span-2"><input aria-label="New person email" type="email" placeholder="email@company.com" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} onKeyDown={onEnter} className={cellBase} /></td>
                <td data-label="Role">
                  <select aria-label="New person role" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} className={selectCell}>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td data-label="QuickBooks name" className="px-2 text-[11px] text-muted-foreground text-[11px] cell-hide-mobile">{draft.name.trim() || "Same as name"}</td>
                <td data-label="Rate / hr"><input aria-label="New person rate" inputMode="decimal" placeholder="125" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} onKeyDown={onEnter} className={cn(cellBase, "text-right font-mono tabular-nums")} /></td>
                <td className="cell-hide-mobile" />
                <td data-label="Starting password">
                  <input aria-label="New person password" type="password" autoComplete="new-password" placeholder={`${MIN_PASSWORD}+ characters`} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} onKeyDown={onEnter} className={cellBase} />
                </td>
                <td className="actions-cell px-2">
                  <button onClick={add} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110">
                    <Plus className="h-3.5 w-3.5" />Add
                  </button>
                </td>
              </tr>
              {dir.users.map((u) => (
                <tr key={u.id} className="group bg-card hover:bg-surface-low">
                  <td data-label="Name" className="span-2"><TextCell aria-label="Name" value={u.name} onCommit={(v) => v.trim() && run(dir.updateUser(u.id, { name: v.trim() }))} /></td>
                  <td data-label="Email" className="span-2"><TextCell aria-label="Email" type="text" value={u.email} onCommit={(v) => v.trim() && run(dir.updateUser(u.id, { email: v.trim() }))} /></td>
                  <td data-label="Role">
                    <select aria-label="Role" value={u.role} onChange={(e) => run(dir.updateUser(u.id, { role: e.target.value as typeof u.role }))} className={selectCell}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td data-label="QuickBooks employee name" className="span-2"><TextCell aria-label="QuickBooks employee name" value={u.qbEmployeeName} onCommit={(v) => v.trim() && run(dir.updateUser(u.id, { qbEmployeeName: v.trim() }))} className="font-mono text-xs" /></td>
                  <td data-label="Rate / hr"><TextCell aria-label="Rate" inputMode="decimal" value={String(u.defaultHourlyRate)} onCommit={(v) => { const n = Number(v); if (v.trim() !== "" && Number.isFinite(n) && n >= 0) run(dir.updateUser(u.id, { defaultHourlyRate: n })); else setError("Hourly rate must be a number."); }} className="text-right font-mono tabular-nums" /></td>
                  <td data-label="Hours" className="px-2 text-right font-mono text-[13px] tabular-nums">{((minutes.get(u.id) ?? 0) / 60).toFixed(2)}</td>
                  <td data-label="New password" className="span-2">
                    <div className="flex items-center">
                    <TextCell
                      key={`${u.id}-pw-${pwKey}`}
                      aria-label={`Set password for ${u.name}`}
                      type="password"
                      autoComplete="new-password"
                      value=""
                      placeholder={pwDone === u.id ? "Password updated ✓" : "Set new password…"}
                      onCommit={async (v) => {
                        if (!v) return;
                        if (v.length < MIN_PASSWORD) return setError(`Passwords need at least ${MIN_PASSWORD} characters.`);
                        const r = await run(dir.updateUser(u.id, { password: v }));
                        if (r.ok) { setPwKey((k) => k + 1); setPwDone(u.id); setTimeout(() => setPwDone(null), 3000); }
                      }}
                    />
                    <button
                      onClick={() => resetPassword(u.id, u.name)}
                      aria-label={`Generate a temporary password for ${u.name}`}
                      title="Generate a temporary password"
                      className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
                    ><KeyRound className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                  <td className="actions-cell text-center">
                    <button
                      onClick={() => confirm(`Remove ${u.name}? This can't be undone.`) && run(dir.deleteUser(u.id))}
                      aria-label={`Remove ${u.name}`}
                      title="Remove person"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
              {dir.loaded && dir.users.length === 0 && (
                <tr className="group-row"><td colSpan={8} className="py-10 text-center text-xs text-muted-foreground">No one yet — add yourself in the highlighted row above, then head to the Timesheet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">Passwords are stored scrambled, so nobody — admins included — can read one back. Set a new one, or use the key button to generate a temporary one. People can only be removed while they have no time entries. Edits save as you leave a cell.</div>
      </section>
      <DataBackup />
    </div>
  );
}

export default function Page() {
  return (
    <RequireAdmin>
      <TeamPage />
    </RequireAdmin>
  );
}
