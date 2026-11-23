"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

/** Shown while the database still holds the bundled sample data. */
export function DemoBanner({ canClear = false }: { canClear?: boolean }) {
  const [isDemo, setIsDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ephemeral, setEphemeral] = useState(false);

  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then((j) => {
        setIsDemo(Boolean(j?.data?.isDemo));
        setEphemeral(j?.data?.storage === "ephemeral");
      })
      .catch(() => {});
  }, []);

  const warn = ephemeral && (
    <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-1.5 text-center text-xs font-medium text-destructive">
      Temporary storage: data on this site will be erased when the server restarts. Connect a database (set DATABASE_URL) to keep it.
    </div>
  );

  if (!isDemo) return warn || null;

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
    <>
    {warn}
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-b border-warning/30 bg-warning-container/50 px-4 py-1.5 text-xs text-foreground">
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Sparkles className="h-3.5 w-3.5 text-warning" />
        You’re looking at sample data.
      </span>
      {canClear ? (
      <button
        onClick={clear}
        disabled={busy}
        data-testid="clear-demo"
        className="rounded-full bg-foreground px-3 py-0.5 font-semibold text-background transition hover:opacity-85 disabled:opacity-50"
      >
        {busy ? "Clearing…" : "Clear sample data & start fresh"}
      </button>
      ) : (
        <span className="text-muted-foreground">An admin can clear it.</span>
      )}
    </div>
    </>
  );
}
