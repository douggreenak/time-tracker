import { NextResponse } from "next/server";
import { getConfig, getStatus, requireAgent, saveConfig, touchAgent, type AgentRun } from "@/lib/agent";

export const dynamic = "force-dynamic";

/** The agent reports a finished run, and which settings version it is now using. */
export async function POST(request: Request) {
  const bad = await requireAgent(request);
  if (bad) return bad;
  const b = await request.json().catch(() => ({}));
  const run: AgentRun | null = b.run
    ? { at: new Date().toISOString(), ok: !!b.run.ok, message: String(b.run.message ?? "").slice(0, 500), files: (Array.isArray(b.run.files) ? b.run.files : []).slice(0, 10).map((f: unknown) => String(f).slice(0, 200)), bytes: Math.max(0, Number(b.run.bytes) || 0), reason: String(b.run.reason ?? "").slice(0, 40) }
    : null;
  const s = await getStatus();
  await touchAgent(request, { appliedAt: typeof b.appliedAt === "string" ? b.appliedAt.slice(0, 40) : s.appliedAt, ...(run ? { lastRun: run, history: [run, ...s.history].slice(0, 20) } : {}) });
  if (run) {
    const c = await getConfig();
    if (c.runRequestedAt) await saveConfig({ ...c, runRequestedAt: null }, true);
  }
  return NextResponse.json({ success: true });
}
