"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export const cellBase =
  "block h-9 w-full bg-transparent px-2 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 " +
  "focus:bg-card focus:shadow-[inset_0_0_0_2px_hsl(var(--primary))] disabled:cursor-not-allowed disabled:text-muted-foreground";

/** Text-like cell that keeps a local draft and commits on blur / Enter; Escape reverts. */
export function TextCell({
  value,
  onCommit,
  className,
  disabled,
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  disabled?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "className">) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      {...rest}
      disabled={disabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(cellBase, className)}
    />
  );
}

