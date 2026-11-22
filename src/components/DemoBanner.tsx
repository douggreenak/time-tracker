"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/** Shown while the database still holds the bundled sample data. */
export function DemoBanner() {
  const [isDemo, setIsDemo] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then((j) => setIsDemo(Boolean(j?.data?.isDemo)))
      .catch(() => {});
  }, []);

  if (!isDemo) return null;

  const clear = async () => {
    if (
      !confirm(
        "Remove ALL sample data and start fresh?\n\nThis permanently deletes every customer, project, task, person and time entry currently in the database — including anything you've added since."
      )
    )
      return;
    setBusy(true);
    const res = await fetch("/api/demo", { method: "DELETE" });
    if (res.ok) window.location.href = "/engineer";
    else setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-warning/30 bg-warning-container/50 px-4 py-1.5 text-xs text-foreground">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Sparkles className="h-3.5 w-3.5 text-warning" />
        You’re looking at sample data.
      </span>
      <button
        onClick={clear}
        disabled={busy}
        data-testid="clear-demo"
        className="rounded-full bg-foreground px-3 py-0.5 font-semibold text-background transition hover:opacity-85 disabled:opacity-50"
      >
        {busy ? "Clearing…" : "Clear sample data & start fresh"}
      </button>
    </div>
  );
}
