import { NextResponse } from "next/server";
import { getConfig, requireAgent, touchAgent } from "@/lib/agent";

export const dynamic = "force-dynamic";

/** The agent polls this: its settings (also serves as its heartbeat). */
export async function GET(request: Request) {
  const bad = await requireAgent(request);
  if (bad) return bad;
  await touchAgent(request);
  return NextResponse.json({ success: true, data: await getConfig() });
}
