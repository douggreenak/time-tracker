import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cleanConfig, getConfig, getStatus, getSmbPassword, hasAgentToken, hasSmbPassword, newAgentToken, saveConfig, setSmbPassword } from "@/lib/agent";

export const dynamic = "force-dynamic";

const view = async () => ({ config: await getConfig(), status: await getStatus(), hasToken: await hasAgentToken(), hasSmbPassword: await hasSmbPassword() });

export async function GET() {
  const g = await requireUser({ admin: true });
  if (!g.ok) return g.res;
  return NextResponse.json({ success: true, data: await view() });
}

/** Save settings: PUT { …settings }. */
export async function PUT(request: Request) {
  const g = await requireUser({ admin: true });
  if (!g.ok) return g.res;
  const body = await request.json().catch(() => ({}));
  const next = cleanConfig(body, await getConfig());
  if (typeof next === "string") return NextResponse.json({ success: false, error: next }, { status: 400 });
  // Password is write-only: a non-empty string sets it, clearSmbPassword removes it, otherwise it's left alone.
  if (typeof body.smbPassword === "string" && body.smbPassword) {
    if (body.smbPassword.length > 200 || /[\r\n\0]/.test(body.smbPassword)) return NextResponse.json({ success: false, error: "That password isn't valid." }, { status: 400 });
    await setSmbPassword(body.smbPassword);
  } else if (body.clearSmbPassword) await setSmbPassword(null);
  await saveConfig(next);
  return NextResponse.json({ success: true, data: await view() });
}

/** Actions: { action: "token" } makes a new agent token (shown once); { action: "run" } asks the agent to back up now. */
export async function POST(request: Request) {
  const g = await requireUser({ admin: true });
  if (!g.ok) return g.res;
  const { action } = await request.json().catch(() => ({}));
  if (action === "token") {
    const token = await newAgentToken();
    return NextResponse.json({ success: true, data: { ...(await view()), token } });
  }
  if (action === "run") {
    const c = await getConfig();
    if (!c.share) return NextResponse.json({ success: false, error: "Enter the SMB share first." }, { status: 400 });
    await saveConfig({ ...c, runRequestedAt: new Date().toISOString() }, true); // not a settings change
    return NextResponse.json({ success: true, data: await view() });
  }
  return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
}
