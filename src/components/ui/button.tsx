import * as React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "tonal"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

const buttonVariants = {
  base: "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium tracking-tight transition-all duration-200 ease-expressive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
  variants: {
    default:
      "bg-primary text-primary-foreground shadow-xs hover:shadow-sm hover:brightness-110",
    tonal:
      "bg-secondary-container text-secondary-on-container hover:brightness-[0.97] active:brightness-95",
    secondary:
      "bg-secondary-container text-secondary-on-container hover:brightness-[0.97] active:brightness-95",
    destructive:
      "bg-destructive text-destructive-foreground shadow-xs hover:brightness-110",
    outline:
      "border border-outline-variant bg-transparent text-foreground hover:bg-primary/[0.08]",
    ghost: "text-primary hover:bg-primary/[0.08]",
    link: "text-primary underline-offset-4 hover:underline",
  },
  sizes: {
    default: "h-10 px-6 text-sm",
    sm: "h-9 px-4 text-xs",
    lg: "h-12 px-8 text-sm",
    icon: "h-10 w-10",
  },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants.base,
          buttonVariants.variants[variant],
          buttonVariants.sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
