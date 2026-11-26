"use client";

import { PageLoader } from "@/components/ui/loader";
import { Suggestions } from "@/components/Suggestions";
import { useLocations } from "@/lib/useLocations";
import Link from "next/link";

export default function ProposedPage() {
  const { data, error, reload, tz } = useLocations(14);
  if (!data && !error) return <PageLoader label="Finding places you've been…" />;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Proposed time entries</h1>
        <p className="mt-1 text-xs text-muted-foreground">Based on where your phone says you spent time in the last 14 days. Nothing is logged until you add it.</p>
      </div>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">{error}</p>}
      {data && data.counts.points + data.counts.visits === 0 && (
        <div className="rounded-2xl border border-border/70 bg-surface-low px-4 py-3 text-xs text-muted-foreground">
          No location history yet. Turn on Places in the iPhone app, or <Link href="/locations" className="font-semibold text-primary underline">import your Arc Timeline</Link>.
        </div>
      )}
      {data && <Suggestions items={data.suggestions} tz={tz} onChanged={reload} />}
    </div>
  );
}
