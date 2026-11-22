import { NextResponse } from "next/server";
import { dataStore } from "@/db/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "usr_eng_1";
    const timer = await dataStore.getActiveTimer(userId);
    return NextResponse.json({ success: true, data: timer });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, userId, customerId, jobId, serviceItemId, locationType, locationName, notes } = body;

    const targetUserId = userId || "usr_eng_1";

    if (action === "start") {
      const timer = await dataStore.startTimer({
        userId: targetUserId,
        customerId,
        jobId,
        serviceItemId,
        locationType: locationType || "office",
        locationName,
        notes,
      });
      return NextResponse.json({ success: true, data: timer });
    }

    if (action === "pause") {
      const timer = await dataStore.pauseTimer(targetUserId);
      return NextResponse.json({ success: true, data: timer });
    }

    if (action === "resume") {
      const timer = await dataStore.resumeTimer(targetUserId);
      return NextResponse.json({ success: true, data: timer });
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
