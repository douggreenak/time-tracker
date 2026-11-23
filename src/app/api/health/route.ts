import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, storageMode } from "@/db/client";
import * as schema from "@/db/schema";
import { seedId } from "@/db/seed";
import { verifyPassword } from "@/lib/password";
import { DEMO_PASSWORD } from "@/db/seed";
import { initialUsers } from "@/db/mock-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // first request after a cold start may create the tables

/** Public deploy check: is the database reachable, and is it the kind that keeps data? No secrets or records. */
export async function GET() {
  const storage = storageMode();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    const meta = (await db.select().from(schema.appMeta)).map((m) => m.key).sort();
    const users = await db.select({ id: schema.users.id, hasPassword: schema.users.passwordHash }).from(schema.users);
    const samplePasswordWorks = (await Promise.all(users.map((u) => verifyPassword(DEMO_PASSWORD, u.hasPassword)))).filter(Boolean).length;
    const hashLengths = Array.from(new Set(users.map((u) => (u.hasPassword ?? "").length)));
    const ids = new Set(users.map((u) => u.id));
    return NextResponse.json({
      ok: true,
      storage,
      persistent: storage !== "ephemeral",
      authSecretSet: Boolean(process.env.AUTH_SECRET),
      setup: {
        meta,
        people: users.length,
        samplePasswordWorks,
        hashLengths,
        peopleWithPassword: users.filter((u) => u.hasPassword).length,
        samplePeopleInRepeatableForm: initialUsers.filter((u) => ids.has(seedId(u.id))).length,
        demoDisabled: process.env.ENABLE_DEMO_DATA === "false",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, storage, error: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}
