import { mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { DDL } from "./ddl";
import { seedDemoData } from "./seed";

export type Db = PgliteDatabase<typeof schema>;

/**
 * One shared database handle per process.
 *  - DATABASE_URL set  → Postgres over HTTP (Neon).
 *  - otherwise         → embedded Postgres (PGlite) persisted in ./.data/pglite
 *                         (set PGLITE_DIR=memory:// for a throwaway in-memory DB, e.g. tests).
 * Tables are created automatically; demo data is loaded once into an empty database
 * unless ENABLE_DEMO_DATA=false.
 */
/** Where data lives: "neon" (hosted Postgres), "local" (file on this machine), or "ephemeral" (lost on restart). */
export function storageMode(): "neon" | "local" | "ephemeral" {
  if (process.env.DATABASE_URL?.trim()) return "neon";
  const dir = process.env.PGLITE_DIR || "";
  if (process.env.VERCEL || dir.startsWith("memory://")) return "ephemeral";
  return "local";
}

const g = globalThis as unknown as { __ttDb?: Promise<Db> };

async function open(): Promise<Db> {
  let db: Db;
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const { drizzle } = await import("drizzle-orm/neon-http");
    db = drizzle(neon(url), { schema }) as unknown as Db;
  } else {
    // Serverless hosts (Vercel) have a read-only project folder; only /tmp is writable, and it is
    // wiped between cold starts. Set DATABASE_URL (e.g. Neon) for data that persists there.
    const dir = process.env.PGLITE_DIR || (process.env.VERCEL ? "/tmp/pglite" : ".data/pglite");
    if (!dir.startsWith("memory://")) mkdirSync(dir, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    db = drizzle(new PGlite(dir), { schema });
  }

  await ensureSchema(db);
  await seedIfEmpty(db);
  return db;
}

const SCHEMA_VERSION = `v${DDL.length}-${DDL.reduce((n, d) => (n * 31 + d.length) % 1000003, 7)}`;

/** Creates/upgrades tables. Remembers the version so later cold starts skip ~30 slow round trips. */
async function ensureSchema(db: Db) {
  try {
    const rows = await db.execute(sql`select value from app_meta where key = 'schema_version'`);
    const list = (Array.isArray(rows) ? rows : (rows as unknown as { rows: { value: string }[] }).rows) as { value: string }[];
    if (list[0]?.value === SCHEMA_VERSION) return;
  } catch {
    /* app_meta doesn't exist yet: first run */
  }
  for (const stmt of DDL) {
    try {
      await db.execute(sql.raw(stmt));
    } catch {
      // Two instances creating the same table at once can collide; the second try sees it exists.
      await db.execute(sql.raw(stmt));
    }
  }
  await db.execute(
    sql`insert into app_meta (key, value) values ('schema_version', ${SCHEMA_VERSION}) on conflict (key) do update set value = excluded.value`
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const isSeeded = async (db: Db) => (await db.select().from(schema.appMeta).where(sql`${schema.appMeta.key} = 'seeded'`)).length > 0;

/**
 * Loads the sample data exactly once, even when several server instances start at the same moment
 * (serverless): whoever inserts the 'seed_lock' row does the seeding, everyone else waits for 'seeded'.
 */
async function seedIfEmpty(db: Db) {
  for (let attempt = 0; attempt < 12; attempt++) {
    if (await isSeeded(db)) return;

    const claimed = await db
      .insert(schema.appMeta)
      .values({ key: "seed_lock", value: String(Date.now()) })
      .onConflictDoNothing()
      .returning({ key: schema.appMeta.key });

    if (claimed.length) {
      try {
        const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
        if (existing.length === 0 && process.env.ENABLE_DEMO_DATA !== "false") {
          await seedDemoData(db);
          await db.insert(schema.appMeta).values({ key: "demo", value: "true" }).onConflictDoNothing();
        }
        await db.insert(schema.appMeta).values({ key: "seeded", value: "true" }).onConflictDoNothing();
      } catch (err) {
        // Don't leave half a seed behind: wipe it so the next start can try cleanly.
        for (const tbl of [schema.activeTimers, schema.timeEntries, schema.jobs, schema.customers, schema.serviceItems, schema.users])
          await db.delete(tbl).catch(() => {});
        throw err;
      } finally {
        await db.delete(schema.appMeta).where(sql`${schema.appMeta.key} = 'seed_lock'`).catch(() => {});
      }
      return;
    }

    // Someone else is seeding. If their lock is stale (they crashed), clear it and try again.
    const [lock] = await db.select().from(schema.appMeta).where(sql`${schema.appMeta.key} = 'seed_lock'`);
    if (lock && Date.now() - Number(lock.value) > 20_000) {
      await db.delete(schema.appMeta).where(sql`${schema.appMeta.key} = 'seed_lock'`);
    }
    await sleep(500);
  }
  throw new Error("The database is still doing its first-time setup. Try again in a few seconds.");
}

export function getDb(): Promise<Db> {
  if (!g.__ttDb) {
    g.__ttDb = open().catch((err) => {
      g.__ttDb = undefined; // allow a retry on the next request
      throw err;
    });
  }
  return g.__ttDb;
}
