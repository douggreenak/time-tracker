"use client";

import React from "react";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";
import { X } from "lucide-react";

export function KeyboardShortcutsModal() {
  const { isHelpOpen, setIsHelpOpen } = useKeyboardShortcuts();

  if (!isHelpOpen) return null;

  const shortcutSections = [
    {
      title: "Global navigation",
      items: [
        { keys: ["⌘", "K"], desc: "Open the command palette" },
        { keys: ["1"], desc: "Go to Time Tracker" },
        { keys: ["2"], desc: "Go to Timesheets & exports" },
        { keys: ["3"], desc: "Go to Customers & projects" },
        { keys: ["0"], desc: "Return to home overview" },
        { keys: ["?"], desc: "Toggle this shortcut sheet" },
        { keys: ["Esc"], desc: "Close an active dialog or palette" },
      ],
    },
    {
      title: "Timer mode",
      items: [
        { keys: ["Space"], desc: "Start, pause, or resume the stopwatch" },
        { keys: ["S"], desc: "Stop the timer and log the entry" },
        { keys: ["N"], desc: "Jump to the new-entry row" },
      ],
    },
    {
      title: "Timesheets",
      items: [
        { keys: ["P"], desc: "Cycle the calculation period" },
        { keys: ["/"], desc: "Focus the search filter" },
        { keys: ["A"], desc: "Approve selected entries" },
        { keys: ["X"], desc: "Mark selected entries as exported" },
        { keys: ["I"], desc: "Download the QuickBooks .IIF file" },
        { keys: ["C"], desc: "Download the CSV audit file" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm animate-m3-fade"
      onClick={() => setIsHelpOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-2xl animate-m3-in overflow-hidden rounded-[28px] border border-border/60 bg-card shadow-m3-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 bg-surface-low px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 font-mono text-sm font-semibold text-primary">
              ⌘
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-[-0.01em] text-foreground">
                Keyboard shortcuts
              </h3>
              <p className="text-xs text-muted-foreground">
                Move through the workspace without leaving the clock
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsHelpOpen(false)}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-expressive hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="m3-scroll max-h-[70vh] space-y-6 overflow-y-auto p-6">
          {shortcutSections.map((section) => (
            <div key={section.title}>
              <h4 className="m3-label mb-2 px-1">{section.title}</h4>
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl bg-surface-low">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-4 px-4 py-2.5"
                  >
                    <span className="text-xs font-normal text-foreground sm:text-sm">
                      {item.desc}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="min-w-[26px] rounded-lg border border-outline-variant bg-card px-2 py-1 text-center font-mono text-[11px] font-semibold text-foreground shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-surface-low px-6 py-3.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            Press
            <kbd className="rounded-md border border-outline-variant bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground">
              Esc
            </kbd>
            to dismiss
          </span>
          <span className="font-medium text-primary">TimeTrack</span>
        </div>
      </div>
    </div>
  );
}
