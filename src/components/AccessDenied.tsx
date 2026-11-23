"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/** Shown when someone lands somewhere they aren't allowed, or when a page crashes. */
export function AccessDenied({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="flex min-h-[60vh] w-full items-center justify-center p-8 text-center">
      <div className="max-w-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-muted-foreground">That page isn&apos;t available to you, or it couldn&apos;t be shown.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/engineer" className="inline-flex h-10 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
            Back to timesheet
          </Link>
          {onRetry && (
            <button onClick={onRetry} className="inline-flex h-10 items-center rounded-full border border-outline-variant px-5 text-sm font-semibold transition hover:bg-foreground/[0.05]">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
