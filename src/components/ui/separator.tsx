import * as React from "react";
import { cn } from "../../lib/utils";

export interface SeparatorProps
  extends React.HTMLAttributes<HTMLHRElement> {}

export const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <hr
        ref={ref}
        className={cn(
          "mx-auto border-slate-200 h-[1px] w-full bg-border",
          className
        )}
        {...props}
      />
    );
  }
);
Separator.displayName = "Separator";
