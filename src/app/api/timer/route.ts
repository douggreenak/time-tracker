import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";
import { isManager, requireUser } from "@/lib/auth";

// serverNow lets the browser correct for clock differences when showing elapsed time.
const withNow = <T extends object | null>(t: T) => (t ? { ...t, serverNow: Date.now() } : t);

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const { searchParams } = new URL(request.url);
    const userId = isManager(g.user) ? searchParams.get("userId") || g.user.id : g.user.id;
    const timer = await dataStore.getActiveTimer(userId);
    return NextResponse.json({ success: true, data: withNow(timer) });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const g = await requireUser();
  if (!g.ok) return g.res;
  try {
    const body = await request.json();
    const { action, userId, customerId, jobId, serviceItemId, locationType, notes } = body;

    const targetUserId = isManager(g.user) ? userId || g.user.id : g.user.id;

    if (action === "start") {
      const timer = await dataStore.startTimer({
        userId: targetUserId,
        customerId,
        jobId,
        serviceItemId,
        locationType: locationType || "office",
        notes,
      });
      return NextResponse.json({ success: true, data: withNow(timer) });
    }

    if (action === "update") {
      const timer = await dataStore.updateTimer(targetUserId, { customerId, jobId, serviceItemId, locationType, notes });
      return NextResponse.json({ success: true, data: withNow(timer) });
    }

    if (action === "pause") {
      const timer = await dataStore.pauseTimer(targetUserId);
      return NextResponse.json({ success: true, data: withNow(timer) });
    }

    if (action === "resume") {
      const timer = await dataStore.resumeTimer(targetUserId);
      return NextResponse.json({ success: true, data: withNow(timer) });
    }

    if (action === "stop") {
      const newEntry = await dataStore.stopTimer(targetUserId);
      return NextResponse.json({ success: true, data: newEntry });
    }

    if (action === "discard") {
      const discarded = await dataStore.discardTimer(targetUserId);
      return NextResponse.json({ success: true, data: { discarded } });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Timer action failed:", error);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
