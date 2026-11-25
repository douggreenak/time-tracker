import { mkdirSync } from "node:fs";
import { sql } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";
import { DDL } from "./ddl";
import { demoHash, demoSeedStatements, seedId } from "./seed";
import { initialUsers } from "./mock-data";

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
    // no-store: Next.js must never cache database responses (it would serve stale rows).
    db = drizzle(neon(url, { fetchOptions: { cache: "no-store" } }), { schema }) as unknown as Db;
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

const isSeeded = async (db: Db) => (await db.select().from(schema.appMeta).where(sql`${schema.appMeta.key} = 'seeded'`)).length > 0;

/**
 * Loads the sample data once. Seeding uses fixed ids and skips rows that already exist, so it is safe
 * to repeat and safe if two server instances do it at the same moment (no lock to get stuck on).
 */
async function seedIfEmpty(db: Db) {
  if (await isSeeded(db)) return;
  await db.delete(schema.appMeta).where(sql`${schema.appMeta.key} = 'seed_lock'`); // leftover from an earlier version

  if (process.env.ENABLE_DEMO_DATA !== "false") {
    const users = await db.select({ id: schema.users.id }).from(schema.users);
    const have = new Set(users.map((u) => u.id));
    const complete = initialUsers.every((u) => have.has(seedId(u.id)));
    const wipe = users.length > 0 && !complete; // an interrupted earlier setup: nobody could sign in, so start clean
    const hash = await demoHash();

    // Everything in ONE all-or-nothing step, so a crash or a second server can never leave half a seed behind.
    const build = (x: Pick<Db, "insert" | "delete">) => [
      ...(wipe
        ? [schema.invoices, schema.billingItems, schema.activeTimers, schema.timeEntries, schema.jobs, schema.customers, schema.serviceItems, schema.users].map((t) => x.delete(t))
        : []),
      ...demoSeedStatements(x, hash),
      x.insert(schema.appMeta).values({ key: "demo", value: "true" }).onConflictDoNothing(),
      x.insert(schema.appMeta).values({ key: "seeded", value: "true" }).onConflictDoNothing(),
      x.insert(schema.appMeta).values({ key: "demo_pw_v1", value: "true" }).onConflictDoNothing(),
      x.insert(schema.appMeta).values({ key: "demo_people_v2", value: "true" }).onConflictDoNothing(),
    ];
    if (storageMode() === "neon") {
      await (db as unknown as { batch: (q: unknown[]) => Promise<unknown> }).batch(build(db));
    } else {
      await db.transaction(async (tx) => {
        for (const q of build(tx as unknown as Db)) await q;
      });
    }
    return;
  }
  await db.insert(schema.appMeta).values({ key: "seeded", value: "true" }).onConflictDoNothing();
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
