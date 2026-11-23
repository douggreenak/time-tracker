import { cn } from "@/lib/utils";

/**
 * Loading indicator: a single shape that morphs between circle, squircle and leaf while it turns and
 * shifts colour (see .m3-loader in globals.css). Pass `label` to show text beside it.
 */
export function Loader({ size = 48, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex flex-col items-center gap-4", className)}>
      <span className="m3-loader-wrap" style={{ width: size, height: size }}>
        <span className="m3-loader" />
      </span>
      <span className={label ? "text-sm font-medium text-muted-foreground" : "sr-only"}>{label ?? "Loading"}</span>
    </div>
  );
}
