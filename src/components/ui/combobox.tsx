"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboOption {
  id: string;
  label: string;
  hint?: string;
}

interface ComboboxProps {
  value: string;
  options: ComboOption[];
  onSelect: (id: string) => void;
  /** When set, typing a value that isn't in the list offers to add it. */
  onCreate?: (label: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  /** Label for an empty/"none" selection, e.g. "— no job —". Selecting it calls onSelect(""). */
  emptyLabel?: string;
  className?: string;
  "aria-label"?: string;
  "data-r"?: string;
  "data-c"?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Searchable select. Type to filter, ↑/↓ to move, Enter/Tab to pick, Esc to cancel.
 * Renders its list in a portal so it is never clipped by a scrolling grid.
 */
export function Combobox({
  value,
  options,
  onSelect,
  onCreate,
  placeholder,
  disabled,
  emptyLabel,
  className,
  "aria-label": ariaLabel,
  "data-r": dataR,
  "data-c": dataC,
}: ComboboxProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState<string | null>(null); // null = not typing
  const [active, setActive] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const listId = React.useId();

  const selected = options.find((o) => o.id === value);
  const shown = query ?? selected?.label ?? "";

  const items = React.useMemo(() => {
    const q = norm(query ?? "");
    const base = q ? options.filter((o) => norm(o.label).includes(q) || norm(o.hint ?? "").includes(q)) : options;
    const list: { key: string; kind: "opt" | "empty" | "create"; opt?: ComboOption; label: string }[] = [];
    // "None" is only offered as a way to clear a choice; with nothing chosen it would just repeat the empty box.
    if (emptyLabel && !q && value) list.push({ key: "__empty", kind: "empty", label: emptyLabel });
    base.forEach((o) => list.push({ key: o.id, kind: "opt", opt: o, label: o.label }));
    const exact = options.some((o) => norm(o.label) === q);
    if (onCreate && q && !exact) list.push({ key: "__create", kind: "create", label: (query ?? "").trim() });
    return list;
  }, [options, query, emptyLabel, onCreate, value]);

  const measure = React.useCallback(() => {
    if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
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

  // Start on the current selection, or on the best match while typing.
  React.useEffect(() => {
    if (!open) return;
    const q = norm(query ?? "");
    if (!q) {
      const i = items.findIndex((it) => it.kind === "opt" && it.opt?.id === value);
      setActive(i >= 0 ? i : 0);
    } else {
      const i = items.findIndex((it) => it.kind === "opt" && norm(it.label).startsWith(q));
      setActive(i >= 0 ? i : 0);
    }
  }, [open, query, items, value]);

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const close = () => {
    setOpen(false);
    setQuery(null);
  };

  const choose = async (it: (typeof items)[number] | undefined) => {
    if (!it) return;
    close();
    if (it.kind === "create") await onCreate?.(it.label);
    else if (it.kind === "empty") onSelect("");
    else if (it.opt && it.opt.id !== value) onSelect(it.opt.id);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.stopPropagation(); // don't let the grid move rows while a list is in play
      e.preventDefault();
      if (!open) return setOpen(true);
      const n = items.length || 1;
      setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter") {
      if (open && items[active]) {
        e.preventDefault();
        e.stopPropagation();
        choose(items[active]);
      }
    } else if (e.key === "Tab") {
      // Typed something? Accept the highlighted match, then let Tab move on.
      if (open && query !== null && norm(query) && items[active] && items[active].kind !== "create") choose(items[active]);
      else close();
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        close();
      }
    }
  };

  const below = rect ? window.innerHeight - rect.bottom : 0;
  const flip = rect ? below < 240 && rect.top > below : false;
  const width = rect ? Math.min(Math.max(rect.width, 224), 352) : 224;
  const left = rect ? Math.min(rect.left, window.innerWidth - width - 8) : 0;

  return (
    <div className={cn("group/combo relative", className)}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        data-r={dataR}
        data-c={dataC}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={shown}
        onFocus={(e) => {
          e.currentTarget.select();
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => close()}
        onKeyDown={onKeyDown}
        className="block h-9 w-full truncate bg-transparent pl-2 pr-7 text-sm text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-card focus:shadow-[inset_0_0_0_2px_hsl(var(--primary))] disabled:cursor-not-allowed disabled:text-muted-foreground"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Show options"
        onMouseDown={(e) => {
          e.preventDefault();
          if (open) close();
          else {
            inputRef.current?.focus();
            setOpen(true);
          }
        }}
        className="absolute inset-y-0 right-0 flex w-6 items-center justify-center text-muted-foreground/70 transition-colors hover:text-foreground disabled:opacity-30"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {open &&
        rect &&
        typeof document !== "undefined" &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            onMouseDown={(e) => e.preventDefault()}
            style={{
              position: "fixed",
              left,
              width,
              ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
            }}
            className={cn("m3-scroll z-[100] max-h-60 animate-m3-pop overflow-auto rounded-lg border border-border bg-card py-1 text-[15px] leading-snug shadow-lg ring-1 ring-black/5", flip ? "origin-bottom" : "origin-top")}
          >
            {items.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No matches</li>}
            {items.map((it, i) => {
              const isSel = it.kind === "opt" ? it.opt?.id === value : it.kind === "empty" && value === "";
              return (
                <li
                  key={it.key}
                  data-i={i}
                  role="option"
                  aria-selected={isSel}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(it)}
                  className={cn(
                    "mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5",
                    i === active ? "bg-foreground/[0.07] text-foreground" : "text-foreground/90",
                    isSel && "font-medium",
                    it.kind === "create" && "font-medium text-primary",
                    it.kind === "empty" && "text-muted-foreground italic"
                  )}
                >
                  {it.kind === "create" ? (
                    <>
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Add “{it.label}”</span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate">{it.label}</span>
                      {it.opt?.hint && <span className="shrink-0 text-xs text-muted-foreground">{it.opt.hint}</span>}
                      {isSel && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body
        )}
    </div>
  );
}
