import { dataStore } from "@/db/store";
import type { UserItem } from "@/db/mock-data";
import { parseWorkbook, type ParsedWorkbook } from "@/lib/workbook";

export const MAX_UPLOAD = 4 * 1024 * 1024; // Vercel's request limit is 4.5 MB

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const key = (userId: string, date: string, customer: string, minutes: number, desc: string, held: boolean) =>
  [held ? "H" : "T", userId, date, norm(customer), Math.round(minutes / 6) * 6, norm(desc)].join("|");

/** Which person a "TIME SUMMARY - JEFF" sheet probably belongs to. */
export function guessPerson(sheetPerson: string, users: UserItem[]): string | null {
  const p = norm(sheetPerson);
  const full = users.filter((u) => norm(u.name) === p);
  if (full.length === 1) return full[0].id;
  const first = users.filter((u) => norm(u.name).split(" ")[0] === p);
  if (first.length === 1) return first[0].id;
  const starts = users.filter((u) => norm(u.name).startsWith(p));
  return starts.length === 1 ? starts[0].id : null;
}

export interface ImportOptions {
  /** sheet name -> user id ("" or missing = leave that sheet out) */
  mapping: Record<string, string>;
  heldUserId: string;
  includeHeld: boolean;
  includeLists: boolean;
}

export interface ImportPlan {
  sheets: { sheet: string; person: string; guessUserId: string | null; rows: number; hours: number; newRows: number; duplicateRows: number; from: string | null; to: string | null }[];
  held: { rows: number; newRows: number };
  lumpSum: { rows: number; newRows: number };
  other: { rows: number; newRows: number };
  newCustomers: string[];
}

/** Works out what an import would add (and what is already here), without changing anything. */
export async function planImport(parsed: ParsedWorkbook, opts: Partial<ImportOptions>, users: UserItem[]) {
  const [existing, customers, items] = await Promise.all([dataStore.getTimeEntries(), dataStore.getCustomers(), dataStore.getBillingItems()]);
  // each existing row can absorb one identical row from the file, so importing the same file twice adds nothing
  const have = new Map<string, number>();
  for (const e of existing) {
    const k = key(e.userId, e.date, e.customerName, e.durationMinutes, e.notes ?? "", e.isHeld);
    have.set(k, (have.get(k) ?? 0) + 1);
  }
  const take = (k: string) => {
    const n = have.get(k) ?? 0;
    if (n > 0) {
      have.set(k, n - 1);
      return false;
    }
    return true;
  };
  const known = new Set(customers.map((c) => norm(c.name)));
  const newCustomers = new Set<string>();
  const noteCustomer = (c: string) => c && !known.has(norm(c)) && newCustomers.add(c.trim());

  const toInsert = [] as { userId: string; customer: string; date: string; minutes: number; notes: string; isLumpSum: boolean; partsNote: string; internalNote: string; contractPo: string; isBillable: boolean; isInvoiced: boolean; isHeld: boolean }[];
  const plan: ImportPlan = { sheets: [], held: { rows: 0, newRows: 0 }, lumpSum: { rows: 0, newRows: 0 }, other: { rows: 0, newRows: 0 }, newCustomers: [] };

  for (const s of parsed.people) {
    const userId = opts.mapping?.[s.sheet] ?? "";
    let newRows = 0;
    for (const e of s.entries) {
      if (!userId) continue;
      const minutes = Math.round(e.hours * 60);
      if (take(key(userId, e.date, e.customer, minutes, e.description, false))) {
        newRows++;
        noteCustomer(e.customer);
        toInsert.push({ userId, customer: e.customer, date: e.date, minutes, notes: e.description, isLumpSum: e.lumpSum, partsNote: e.partsNote, internalNote: e.internalNote, contractPo: e.contractPo, isBillable: e.billable, isInvoiced: e.invoiced, isHeld: false });
      }
    }
    const dates = s.entries.map((e) => e.date).sort();
    plan.sheets.push({
      sheet: s.sheet,
      person: s.person,
      guessUserId: guessPerson(s.person, users),
      rows: s.entries.length,
      hours: Math.round(s.entries.reduce((n, e) => n + e.hours, 0) * 10) / 10,
      newRows: userId ? newRows : s.entries.length,
      duplicateRows: userId ? s.entries.length - newRows : 0,
      from: dates[0] ?? null,
      to: dates[dates.length - 1] ?? null,
    });
  }

  plan.held.rows = parsed.held.length;
  for (const h of parsed.held) {
    const fresh = take(key(opts.heldUserId ?? "", h.date, h.customer, Math.round(h.hours * 60), h.description, true));
    if (fresh) {
      plan.held.newRows++;
      if (opts.includeHeld && opts.heldUserId) {
        noteCustomer(h.customer);
        toInsert.push({ userId: opts.heldUserId, customer: h.customer, date: h.date, minutes: Math.round(h.hours * 60), notes: h.description, isLumpSum: false, partsNote: h.partsNote, internalNote: h.internalNote, contractPo: "", isBillable: true, isInvoiced: false, isHeld: true });
      }
    }
  }

  const listRows = [] as { kind: "lump_sum" | "other"; customer: string; description: string; amount: number; notes: string }[];
  const haveItems = new Set(items.map((i) => [i.kind, norm(i.customer), norm(i.description), i.amount].join("|")));
  for (const [kind, rows, into] of [["lump_sum", parsed.lumpSum, plan.lumpSum], ["other", parsed.other, plan.other]] as const) {
    into.rows = rows.length;
    for (const r of rows) {
      const k = [kind, norm(r.customer), norm(r.description), r.amount].join("|");
      if (haveItems.has(k)) continue;
      haveItems.add(k);
      into.newRows++;
      if (opts.includeLists) listRows.push({ kind, ...r });
    }
  }
  plan.newCustomers = Array.from(newCustomers).sort();
  return { plan, toInsert, listRows };
}

/** Reads an uploaded file, or returns a plain-English problem. */
export async function readUpload(form: FormData): Promise<{ ok: true; parsed: ParsedWorkbook } | { ok: false; error: string }> {
  const file = form.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Choose a spreadsheet to import." };
  if (file.size > MAX_UPLOAD) return { ok: false, error: "That file is over 4 MB. Save it without the extra sheets (or split it by year) and try again." };
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) return { ok: false, error: "Import works with Excel files (.xlsx or .xlsm)." };
  try {
    const parsed = await parseWorkbook(await file.arrayBuffer());
    if (!parsed.people.length && !parsed.held.length && !parsed.lumpSum.length && !parsed.other.length)
      return { ok: false, error: "No “TIME SUMMARY - …” sheets were found in that file, so there's nothing to import." };
    return { ok: true, parsed };
  } catch {
    return { ok: false, error: "Couldn't read that file. Is it a valid Excel workbook?" };
  }
}
