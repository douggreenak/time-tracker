import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const badgeVariants = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary-container text-secondary-on-container",
  destructive: "bg-destructive text-destructive-foreground",
  outline: "border border-outline-variant text-muted-foreground",
};

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.01em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          badgeVariants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
