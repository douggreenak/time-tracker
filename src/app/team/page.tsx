"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, KeyRound, Moon, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Dropdown } from "@/components/ui/dropdown";
import { cellBase } from "@/components/ui/cell";
import { PageLoader } from "@/components/ui/loader";
import { useAuth } from "@/components/AuthProvider";
import { useDirectory } from "@/lib/useDirectory";
import { cn } from "@/components/ui";
import { MIN_PASSWORD } from "@/lib/validate";
import { readMode, setMode, type ThemeMode } from "@/components/ThemeToggle";
import type { UserItem } from "@/db/mock-data";

const ROLES = ["engineer", "accountant", "admin"] as const;
const selectCell = "h-9 rounded-md border-transparent bg-transparent px-2 text-sm capitalize";
const localToday = () => new Date().toLocaleDateString("en-CA");
const dollars = (n: number) => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** Always-light / always-dark / show-the-toggle, for this device. */
function Appearance() {
  const [mode, setM] = useState<ThemeMode>(() => (typeof window === "undefined" ? "toggle" : readMode()));
  const choose = (m: ThemeMode) => { setMode(m); setM(m); };
  const opt = (m: ThemeMode, label: string) => (
    <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => choose(m)}
      className={cn("h-9 rounded-full border px-4 text-sm font-semibold transition", mode === m ? "border-primary bg-primary text-primary-foreground" : "border-outline-variant text-muted-foreground hover:bg-foreground/[0.05]")}>{label}</button>
  );
  return (
    <section aria-label="Appearance" className="flex flex-wrap items-center gap-3 rounded-[22px] border border-border/70 bg-card px-4 py-3 shadow-sm">
      <span className="flex items-center gap-2 text-sm font-semibold"><Moon className="h-4 w-4" />Light / dark mode</span>
      <div role="radiogroup" aria-label="Light or dark mode" className="flex flex-wrap gap-1.5">
        {opt("toggle", "Show the toggle")}{opt("light", "Always light")}{opt("dark", "Always dark")}
      </div>
      <span className="text-xs text-muted-foreground">Saved on this device. Choosing light or dark removes the toggle button.</span>
    </section>
  );
}

/** Asked whenever a billing rate changes, because it can re-price time that's already logged. */
function RateDialog({ name, from, to, onChoose, onCancel }: { name: string; from: number; to: number; onChoose: (scope: "future" | "all") => void; onCancel: () => void }) {
  const [scope, setScope] = useState<"future" | "all">("future");
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label="Change billing rate" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="text-lg font-semibold">Are you sure?</h3>
        <p className="mt-1 text-sm text-foreground/80">Change {name}’s billing rate from <strong>{dollars(from)}</strong> to <strong>{dollars(to)}</strong> per hour. Should this also change time that’s already been logged?</p>
        <fieldset className="mt-4 space-y-2">
          {([["future", "From today on only", "Earlier days keep the old rate. New invoices price past time as before."], ["all", "Retroactive: all time, past and future", "Every day logged so far is re-priced at the new rate on invoices made from now on."]] as const).map(([v, t, d]) => (
            <label key={v} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", scope === v ? "border-primary bg-primary/5" : "border-border")}>
              <input type="radio" name="rate-scope" checked={scope === v} onChange={() => setScope(v)} aria-label={t} className="mt-1 accent-[hsl(var(--primary))]" />
              <span><span className="block text-sm font-semibold">{t}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
            </label>
          ))}
        </fieldset>
        <p className="mt-3 text-xs text-muted-foreground">Invoices you’ve already saved never change.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="h-10 rounded-full border border-outline-variant px-5 text-sm font-semibold hover:bg-foreground/[0.05]">Cancel</button>
          <button onClick={() => onChoose(scope)} data-testid="rate-confirm" className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110">Change rate</button>
        </div>
      </div>
    </div>
  );
}

type Dir = ReturnType<typeof useDirectory>;
type Run = (p: Promise<{ ok: boolean; error?: string }>) => Promise<{ ok: boolean; error?: string }>;

/** One person. Nothing saves until Save is pressed. */
function PersonRow({ u, dir, run, setError, isAdmin, meId, askRate }: { u: UserItem; dir: Dir; run: Run; setError: (e: string | null) => void; isAdmin: boolean; meId?: string; askRate: (u: UserItem, to: number, go: (scope: "future" | "all") => void) => void }) {
  const [name, setName] = useState(u.name);
  const [email, setEmail] = useState(u.email);
  const [rate, setRate] = useState(String(u.defaultHourlyRate));
  const [pw, setPw] = useState("");
  const [pwDone, setPwDone] = useState(false);
  const [saved, setSaved] = useState(false);
  const rateNum = Number(rate);
  const dirty = name.trim() !== u.name || email.trim().toLowerCase() !== u.email || rate.trim() !== String(u.defaultHourlyRate);

  const save = async () => {
    if (!name.trim() || !email.trim()) return setError("Name and email can't be empty.");
    if (rate.trim() === "" || !Number.isFinite(rateNum) || rateNum < 0) return setError("Hourly rate must be a number.");
    const patch: Parameters<Dir["updateUser"]>[1] = {};
    if (name.trim() !== u.name) patch.name = name.trim();
    if (email.trim().toLowerCase() !== u.email) patch.email = email.trim();
    const commit = async (extra: object = {}) => {
      const r = await run(dir.updateUser(u.id, { ...patch, ...extra }));
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    };
    if (rateNum !== u.defaultHourlyRate) askRate(u, rateNum, (scope) => commit({ defaultHourlyRate: rateNum, rateScope: scope, effectiveFrom: localToday() }));
    else await commit();
  };

  const setPassword = async () => {
    if (pw.length < MIN_PASSWORD) return setError(`Passwords need at least ${MIN_PASSWORD} characters.`);
    if (!confirm(`Are you sure you want to overwrite ${u.name}'s password? Their current password will stop working.`)) return;
    const r = await run(dir.updateUser(u.id, { password: pw }));
    if (r.ok) { setPw(""); setPwDone(true); setTimeout(() => setPwDone(false), 3000); }
  };

  return (
    <tr className="group bg-card hover:bg-surface-low">
      <td data-label="Name" className="span-2"><input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={cellBase} /></td>
      <td data-label="Email" className="span-2"><input aria-label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoCapitalize="none" spellCheck={false} className={cellBase} /></td>
      <td data-label="Role">
        {isAdmin ? (
          <Dropdown aria-label="Role" value={u.role} onChange={(v) => run(dir.updateUser(u.id, { role: v as typeof u.role }))} options={ROLES.map((r) => ({ value: r, label: r }))} className={selectCell} />
        ) : (
          <span className="px-2 text-sm capitalize">{u.role}</span>
        )}
      </td>
      <td data-label="Billing rate / hr"><input aria-label="Rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className={cn(cellBase, "text-right font-mono tabular-nums")} /></td>
      <td data-label="New password" className="span-2">
        {isAdmin ? (
          <div className="flex items-center">
            <input aria-label={`Set password for ${u.name}`} type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={pwDone ? "Password updated ✓" : "Set new password…"} className={cellBase} />
            {pw && <button onClick={setPassword} aria-label={`Save password for ${u.name}`} className="mr-1 h-7 shrink-0 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground hover:brightness-110">Set</button>}
            <button onClick={() => { const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const t = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => chars[b % chars.length]).join(""); if (!confirm(`Are you sure you want to overwrite ${u.name}'s password with a new temporary one? Their current password will stop working.`)) return; run(dir.updateUser(u.id, { password: t })).then((r) => r.ok && window.dispatchEvent(new CustomEvent("tt-temp-password", { detail: { name: u.name, password: t } }))); }}
              aria-label={`Generate a temporary password for ${u.name}`} title="Generate a temporary password"
              className="mr-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><KeyRound className="h-3.5 w-3.5" /></button>
          </div>
        ) : <span className="px-2 text-xs text-muted-foreground">Admins only</span>}
      </td>
      <td className="actions-cell px-2">
        <div className="flex items-center justify-end gap-1">
          <button onClick={save} disabled={!dirty} aria-label={`Save ${u.name}`} className="inline-flex h-8 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110">
            {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}{saved ? "Saved" : "Save"}
          </button>
          {u.id !== meId && (u.role !== "admin" || isAdmin) && (
            <button onClick={() => confirm(`Remove ${u.name}? This can't be undone.`) && run(dir.deleteUser(u.id))} aria-label={`Remove ${u.name}`} title="Remove person"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
      </td>
    </tr>
  );
}

function TeamPage() {
  const dir = useDirectory();
  const { isAdmin, user: me } = useAuth();
  const [draft, setDraft] = useState({ name: "", email: "", role: "engineer", rate: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [ask, setAsk] = useState<{ u: UserItem; to: number; go: (scope: "future" | "all") => void } | null>(null);

  // a generated temporary password is shown once, here
  useEffect(() => {
    const on = ((e: CustomEvent) => { setTemp(e.detail); setCopied(false); }) as EventListener;
    window.addEventListener("tt-temp-password", on);
    return () => window.removeEventListener("tt-temp-password", on);
  }, []);

  const shownUsers = useMemo(() => {
    const s = q.trim().toLowerCase();
    return dir.users.filter((u) => (roleFilter === "all" || u.role === roleFilter) && (!s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)));
  }, [dir.users, q, roleFilter]);

  const run: Run = async (p) => {
    const r = await p;
    setError(r.ok ? null : r.error ?? "Something went wrong");
    return r;
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
          Anyone can add or remove people and change names, emails and billing rates. Only admins change roles or set passwords. Changes save when you press Save. The billing rate is what that person is charged out at on invoices; when you change it you choose whether past time is re-priced too, and saved invoices never change.
        </p>
      </div>
      <Appearance />
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

      <div role="group" aria-label="Team filters" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" aria-label="Search team" className="h-9 w-full rounded-full border border-outline-variant bg-surface-low pl-8 pr-3 text-xs outline-none hover:border-outline focus:border-primary focus:ring-2 focus:ring-primary/25" />
        </div>
        <div className="w-44"><Dropdown aria-label="Filter role" value={roleFilter} onChange={setRoleFilter} options={[{ value: "all", label: "All roles" }, ...ROLES.map((r) => ({ value: r, label: r }))]} /></div>
      </div>

      <section className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-sm">
        <div className="stack-table-wrap m3-scroll max-h-[calc(100dvh-13rem)] min-h-[8rem] overflow-auto">
          <table className="stack-table w-full min-w-[56rem] border-separate border-spacing-0 text-left">
            <thead className="sticky top-0 z-10">
              <tr className="[&_th]:h-9 [&_th]:border-b [&_th]:border-r [&_th]:border-border [&_th]:bg-surface-container [&_th]:px-2 [&_th]:text-[11px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.06em] [&_th]:text-muted-foreground [&_th:last-child]:border-r-0">
                <th>Name</th>
                <th>Email</th>
                <th className="w-36">Role</th>
                <th className="w-32 text-right">Billing rate / hr</th>
                <th className="w-44">Password</th>
                <th className="w-24" />
              </tr>
            </thead>
            <tbody className="[&_td]:border-b [&_td]:border-r [&_td]:border-border/70 [&_td:last-child]:border-r-0">
              <tr className="bg-primary-container/40">
                <td data-label="Name" className="span-2"><input aria-label="New person name" placeholder="Full name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} onKeyDown={onEnter} className={cellBase} /></td>
                <td data-label="Email" className="span-2"><input aria-label="New person email" type="email" placeholder="email@company.com" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value.toLowerCase() })} autoCapitalize="none" autoCorrect="off" spellCheck={false} onKeyDown={onEnter} className={cellBase} /></td>
                <td data-label="Role">
                  <Dropdown aria-label="New person role" value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })} options={(isAdmin ? ROLES : ROLES.filter((r) => r !== "admin")).map((r) => ({ value: r, label: r }))} className={selectCell} />
                </td>
                <td data-label="Billing rate / hr"><input aria-label="New person rate" inputMode="decimal" placeholder="250" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: e.target.value })} onKeyDown={onEnter} className={cn(cellBase, "text-right font-mono tabular-nums")} /></td>
                <td data-label="Starting password">
                  <input aria-label="New person password" type="password" autoComplete="new-password" placeholder={`${MIN_PASSWORD}+ characters`} value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} onKeyDown={onEnter} className={cellBase} />
                </td>
                <td className="actions-cell px-2">
                  <button onClick={add} className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-110">
                    <Plus className="h-3.5 w-3.5" />Add
                  </button>
                </td>
              </tr>
              {shownUsers.map((u) => (
                <PersonRow key={u.id} u={u} dir={dir} run={run} setError={setError} isAdmin={isAdmin} meId={me?.id} askRate={(u, to, go) => setAsk({ u, to, go })} />
              ))}
              {dir.loaded && dir.users.length === 0 && (
                <tr className="group-row"><td colSpan={6} className="py-10 text-center text-xs text-muted-foreground">No one yet — add yourself in the highlighted row above, then head to the Timesheet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">Passwords are stored scrambled, so nobody — admins included — can read one back. Set a new one, or use the key button to generate a temporary one. People can only be removed while they have no time entries.</div>
      </section>
      {ask && <RateDialog name={ask.u.name} from={ask.u.defaultHourlyRate} to={ask.to} onCancel={() => setAsk(null)} onChoose={(scope) => { const go = ask.go; setAsk(null); go(scope); }} />}
    </div>
  );
}

export default function Page() {
  const dir = useDirectory();
  if (!dir.loaded) return <PageLoader label="Loading team…" />;
  return <TeamPage />;
}
