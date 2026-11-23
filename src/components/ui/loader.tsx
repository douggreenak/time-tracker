import { cn } from "@/lib/utils";

/**
 * The Material (Google) indeterminate circular progress indicator: an arc that grows and shrinks
 * while the whole ring turns. Pass `label` to show text under it.
 */
export function Spinner({ size = 16, className, stroke }: { size?: number; className?: string; stroke?: string }) {
  return (
    <svg className={cn("m3-spinner", className)} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle className="m3-spinner-arc" cx="24" cy="24" r="20" fill="none" strokeWidth="5" strokeLinecap="round" style={stroke ? { stroke } : undefined} />
    </svg>
  );
}

export function Loader({ size = 48, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-4", className)}>
      <Spinner size={size} />
      <span className={label ? "text-sm font-medium text-muted-foreground" : "sr-only"}>{label ?? "Loading"}</span>
    </div>
  );
}

/** A centred loader for a page or panel that is still fetching. */
export function PageLoader({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex min-h-[40vh] w-full items-center justify-center", className)}>
      <Loader label={label} />
    </div>
  );
}
