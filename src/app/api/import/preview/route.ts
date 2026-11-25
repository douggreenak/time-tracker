import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import { planImport, readUpload } from "@/lib/import-server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Reads the uploaded workbook and reports what importing it would add. Nothing is saved. */
export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const up = await readUpload(await request.formData());
    if (!up.ok) return NextResponse.json({ success: false, error: up.error }, { status: 400 });
    const users = await dataStore.getUsers();
    // Preview with the sheets matched to the people they most likely belong to.
    const mapping: Record<string, string> = {};
    const { guessPerson } = await import("@/lib/import-server");
    for (const s of up.parsed.people) mapping[s.sheet] = guessPerson(s.person, users) ?? "";
    const { plan } = await planImport(up.parsed, { mapping, heldUserId: g.user.id, includeHeld: true, includeLists: true }, users);
    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    console.error("Import preview failed:", error);
    return NextResponse.json({ success: false, error: "Couldn't read that file." }, { status: 500 });
  }
}
