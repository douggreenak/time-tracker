import { getTableColumns, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb, storageMode, type Db } from "./client";
import * as t from "./schema";

/** Everything the app stores, in an order that satisfies foreign keys when inserting (reverse it to delete). */
const TABLES = [
  ["users", t.users],
  ["customers", t.customers],
  ["jobs", t.jobs],
  ["serviceItems", t.serviceItems],
  ["timeEntries", t.timeEntries],
  ["activeTimers", t.activeTimers],
  ["billingItems", t.billingItems],
  ["invoices", t.invoices],
] as const;
/** Sections an older backup may not have; they restore as empty. */
const OPTIONAL = new Set<string>(["billingItems", "invoices"]);

export const BACKUP_FORMAT = "timetrack-backup";
export const BACKUP_VERSION = 1;
const CHUNK = 200;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  tables: Record<(typeof TABLES)[number][0], Record<string, unknown>[]>;
  /** Settings such as whether this is sample data. */
  meta: Record<string, string>;
}

const SKIP_META = new Set(["schema_version", "seed_lock", "seeded", "agent_config", "agent_token_hash", "agent_status", "agent_smb_password"]);

export async function exportBackup(): Promise<Backup> {
  const db = await getDb();
  const tables = {} as Backup["tables"];
  for (const [name, table] of TABLES) {
    tables[name] = (await db.select().from(table as PgTable)) as Record<string, unknown>[];
  }
  const meta: Record<string, string> = {};
  for (const m of await db.select().from(t.appMeta)) if (!SKIP_META.has(m.key)) meta[m.key] = m.value ?? "";
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), tables, meta };
}

/** Throws an Error with a plain-English reason if this isn't a usable backup. */
export function validateBackup(data: unknown): asserts data is Backup {
  const b = data as Partial<Backup> | null;
  if (!b || typeof b !== "object" || b.format !== BACKUP_FORMAT) throw new Error("That file isn't a TimeTrack backup.");
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) throw new Error("That backup was made by a newer version of the app.");
  if (!b.tables || typeof b.tables !== "object") throw new Error("The backup has no data in it.");
  for (const [name] of TABLES) {
    const rows = (b.tables as Record<string, unknown>)[name];
    if (rows === undefined && OPTIONAL.has(name)) {
      (b.tables as Record<string, unknown>)[name] = [];
      continue;
    }
    if (!Array.isArray(rows) || rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) throw new Error(`The backup's “${name}” section is damaged.`);
  }
  const users = b.tables.users as Record<string, unknown>[];
  if (!users.some((u) => u.role === "admin" && u.passwordHash)) throw new Error("The backup has no admin who can sign in, so restoring it would lock everyone out.");
}

/** JSON turns timestamps into strings; put them back. */
function revive(table: PgTable, row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(getTableColumns(table))) {
    const v = row[key];
    if (v === undefined) continue;
    out[key] = col.dataType === "date" && typeof v === "string" ? new Date(v) : v;
  }
  return out;
}

/** Replaces everything with the backup, all-or-nothing: if anything is wrong, nothing changes. */
export async function importBackup(b: Backup) {
  const db = await getDb();
  const build = (x: Pick<Db, "insert" | "delete">) => {
    const q: unknown[] = [];
    for (const [, table] of [...TABLES].reverse()) q.push(x.delete(table as PgTable));
    for (const [name, table] of TABLES) {
      const rows = b.tables[name].map((r) => revive(table as PgTable, r));
      for (let i = 0; i < rows.length; i += CHUNK) q.push(x.insert(table as PgTable).values(rows.slice(i, i + CHUNK) as never));
    }
    q.push(x.delete(t.appMeta).where(sql`${t.appMeta.key} not in ('schema_version')`));
    const meta = { ...b.meta, seeded: "true", demo_pw_v1: "true", demo_people_v2: "true" };
    for (const [key, value] of Object.entries(meta)) q.push(x.insert(t.appMeta).values({ key, value }).onConflictDoNothing());
    return q;
  };
  if (storageMode() === "neon") {
    await (db as unknown as { batch: (q: unknown[]) => Promise<unknown> }).batch(build(db));
  } else {
    await db.transaction(async (tx) => {
      for (const q of build(tx as unknown as Db)) await q;
    });
  }
  return Object.fromEntries(TABLES.map(([name]) => [name, b.tables[name].length])) as Record<(typeof TABLES)[number][0], number>;
}
