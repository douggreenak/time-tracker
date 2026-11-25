import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";
import { XLSX } from "@/lib/snapshots";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const s = await dataStore.getSavedExport(params.id);
  if (!s) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(s.data, "base64")), {
    headers: { "Content-Type": XLSX, "Content-Disposition": `attachment; filename="${s.fileName}"`, "Cache-Control": "no-cache" },
  });
}
