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

  for (const stmt of DDL) await db.execute(sql.raw(stmt));
  await seedIfEmpty(db);
  return db;
}

async function seedIfEmpty(db: Db) {
  const [seeded] = await db.select().from(schema.appMeta).where(sql`${schema.appMeta.key} = 'seeded'`);
  if (seeded) return;
  const existing = await db.select({ id: schema.users.id }).from(schema.users).limit(1);
  if (existing.length === 0 && process.env.ENABLE_DEMO_DATA !== "false") {
    await seedDemoData(db);
    await db.insert(schema.appMeta).values({ key: "demo", value: "true" }).onConflictDoNothing();
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
