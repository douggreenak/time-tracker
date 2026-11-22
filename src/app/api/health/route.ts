import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, storageMode } from "@/db/client";

export const dynamic = "force-dynamic";

/** Public deploy check: is the database reachable, and is it the kind that keeps data? No secrets or records. */
export async function GET() {
  const storage = storageMode();
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, storage, persistent: storage !== "ephemeral", authSecretSet: Boolean(process.env.AUTH_SECRET) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, storage, error: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }
}
