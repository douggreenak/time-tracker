"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  hint?: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Shown while nothing is chosen (value ""). */
  placeholder?: string;
  disabled?: boolean;
  "aria-label": string;
  title?: string;
  className?: string;
  /** "pill" (default) for toolbars and filters, "field" for form fields. */
  variant?: "pill" | "field";
  autoFocus?: boolean;
  id?: string;
}

/**
 * Our own pick-one dropdown (instead of the browser's native <select>), so it looks the same everywhere:
 * a button that opens a list under it. Keyboard: Enter/Space/↓ open, ↑/↓ move, Enter choose, Esc close,
 * typing jumps to a match.
 */
export function Dropdown({ value, options, onChange, placeholder = "Select…", disabled, title, className, variant = "pill", autoFocus, id, ...rest }: DropdownProps) {
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const typed = React.useRef({ text: "", t: 0 });
  const listId = React.useId();
  const selected = options.find((o) => o.value === value);

  const measure = React.useCallback(() => {
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    measure();
    const on = () => measure();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("scroll", on, true);
    };
  }, [open, measure]);

  React.useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  React.useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (i: number) => {
    const o = options[i];
    setOpen(false);
    btnRef.current?.focus();
    if (o && o.value !== value) onChange(o.value);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (!open) return setOpen(true);
      const n = options.length || 1;
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Home" || e.key === "End") {
      if (open) {
        e.preventDefault();
        setActive(e.key === "Home" ? 0 : options.length - 1);
      }
    } else if (e.key === "Enter" || e.key === " ") {
      if (!open) {
        e.preventDefault();
        setOpen(true);
      } else if (typed.current.text === "" || e.key === "Enter") {
        e.preventDefault();
        choose(active);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
      // Type-ahead: jump to the first option starting with what was typed.
      const now = Date.now();
      typed.current.text = now - typed.current.t > 700 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.t = now;
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) {
        setOpen(true);
        setActive(i);
      }
      setTimeout(() => {
        if (Date.now() - typed.current.t >= 700) typed.current.text = "";
      }, 750);
    }
  };

  const below = rect ? window.innerHeight - rect.bottom : 0;
  const flip = rect ? below < 240 && rect.top > below : false;
  const width = rect ? Math.min(Math.max(rect.width, 192), 352) : 192;
  const left = rect ? Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) : 0;

  return (
    <>
      <button
        ref={btnRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest["aria-label"]}
        title={title}
        disabled={disabled}
        autoFocus={autoFocus}
        onClick={() => !disabled && setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full items-center justify-between gap-2 border border-outline-variant bg-surface-low text-left transition-colors hover:border-outline focus:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50",
          variant === "pill" ? "h-9 rounded-full px-3 text-xs font-medium" : "h-11 rounded-xl px-4 text-sm",
          open && "border-primary ring-2 ring-primary/25",
          className
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={rest["aria-label"]}
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: "fixed", left, width, ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }) }}
            className={cn("m3-scroll z-[100] max-h-64 animate-m3-pop overflow-auto rounded-lg border border-border bg-card py-1 text-[13px] shadow-lg ring-1 ring-black/5", flip ? "origin-bottom" : "origin-top")}
          >
            {options.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">Nothing to choose</li>}
            {options.map((o, i) => {
              const isSel = o.value === value;
              return (
                <li
                  key={o.value || `__${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className={cn(
                    "mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5",
                    i === active ? "bg-foreground/[0.07]" : "",
                    isSel && "font-medium"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-[11px] text-muted-foreground">{o.hint}</span>}
                  {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </>
  );
}
