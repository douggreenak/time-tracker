import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const text = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : undefined);
const money = (v: unknown) => (v === undefined || v === "" || v === null ? undefined : Number(v));

export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  const kind = new URL(request.url).searchParams.get("kind");
  return NextResponse.json({ success: true, data: await dataStore.getBillingItems(kind === "lump_sum" || kind === "other" ? kind : undefined) });
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const b = await request.json();
    if (b.kind !== "lump_sum" && b.kind !== "other") return NextResponse.json({ success: false, error: "Unknown list." }, { status: 400 });
    const amount = money(b.amount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) return NextResponse.json({ success: false, error: "Amount must be a number." }, { status: 400 });
    const item = await dataStore.addBillingItem({ kind: b.kind, customer: text(b.customer, 255), description: text(b.description), amount, notes: text(b.notes) });
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
