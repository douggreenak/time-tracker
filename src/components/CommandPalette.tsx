"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";
import {
  Search,
  Clock,
  BarChart3,
  Settings,
  FileSpreadsheet,
  FileText,
  Lock,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui";

const AUTH_STORAGE_KEY = "timetracker_auth_state_v1";

export function CommandPalette() {
  const { isPaletteOpen, setIsPaletteOpen, setIsHelpOpen } = useKeyboardShortcuts();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isPaletteOpen]);

  const actions = [
    {
      id: "nav-engineer",
      title: "Track Time",
      subtitle: "Stopwatch timer, GPS site tagging & manual logs",
      icon: <Clock className="h-4 w-4 text-primary" />,
      shortcut: "1",
      perform: () => router.push("/engineer"),
    },
    {
      id: "nav-accountant",
      title: "Review Timesheets",
      subtitle: "Audits, period calculations & QuickBooks exports",
      icon: <BarChart3 className="h-4 w-4 text-primary" />,
      shortcut: "2",
      perform: () => router.push("/accountant"),
    },
    {
      id: "nav-settings",
      title: "Go to Directory & Settings",
      subtitle: "QuickBooks customers, sub-jobs & service items",
      icon: <Settings className="h-4 w-4 text-muted-foreground" />,
      shortcut: "3",
      perform: () => router.push("/settings"),
    },
    {
      id: "export-iif",
      title: "Export QuickBooks Desktop .IIF",
      subtitle: "Download official TIMEACT tab-delimited timer file",
      icon: <FileSpreadsheet className="h-4 w-4 text-tertiary" />,
      shortcut: "I",
      perform: () => {
        window.location.href = "/api/export/iif";
      },
    },
    {
      id: "export-csv",
      title: "Export timesheet .CSV",
      subtitle: "Download full structured CSV for Excel or reporting",
      icon: <FileText className="h-4 w-4 text-primary" />,
      shortcut: "C",
      perform: () => {
        window.location.href = "/api/export/csv";
      },
    },
    {
      id: "shortcuts-help",
      title: "View all keyboard shortcuts",
      subtitle: "Open the full shortcut cheat sheet",
      icon: <HelpCircle className="h-4 w-4 text-muted-foreground" />,
      shortcut: "?",
      perform: () => setIsHelpOpen(true),
    },
    {
      id: "lock-app",
      title: "Lock application",
      subtitle: "Require PIN authentication to continue",
      icon: <Lock className="h-4 w-4 text-destructive" />,
      shortcut: "L",
      perform: () => {
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {}
        window.location.reload();
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length)
      );
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      setIsPaletteOpen(false);
      filtered[selectedIndex].perform();
    }
  };

  if (!isPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/30 p-4 pt-20 backdrop-blur-sm animate-m3-fade"
      onClick={() => setIsPaletteOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl animate-m3-in overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-m3-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, views, or exports…"
            className="h-8 border-0 bg-transparent px-0 text-sm font-normal focus-visible:bg-transparent focus-visible:ring-0"
          />
          <kbd className="rounded-md border border-outline-variant bg-surface-low px-2 py-1 font-mono text-[10px] font-semibold text-muted-foreground">
            Esc
          </kbd>
        </div>

        <div className="m3-scroll max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No commands matching “{query}”
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setIsPaletteOpen(false);
                    item.perform();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 py-3 transition-colors duration-150",
                    isSelected
                      ? "bg-secondary-container text-secondary-on-container"
                      : "text-muted-foreground hover:bg-surface-low"
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        isSelected ? "bg-card" : "bg-surface-container"
                      )}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.shortcut && (
                      <kbd className="rounded-md border border-outline-variant bg-card px-2 py-0.5 font-mono text-[11px] font-semibold text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-surface-low px-5 py-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-outline-variant bg-card px-1 py-0.5 font-mono">
                ↑
              </kbd>
              <kbd className="rounded border border-outline-variant bg-card px-1 py-0.5 font-mono">
                ↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-outline-variant bg-card px-1 py-0.5 font-mono">
                ↵
              </kbd>
              select
            </span>
          </div>
          <span className="font-medium">TimeTrack</span>
        </div>
      </div>
    </div>
  );
}
