"use client";

import React from "react";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";
import { X, Command, HardHat, BarChart3, Settings, Play, CheckSquare, Download, Search, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function KeyboardShortcutsModal() {
  const { isHelpOpen, setIsHelpOpen } = useKeyboardShortcuts();

  if (!isHelpOpen) return null;

  const shortcutSections = [
    {
      title: "Global Navigation",
      items: [
        { keys: ["⌘", "K"], desc: "Open Command Palette / Quick Search" },
        { keys: ["1"], desc: "Switch to Engineer Tracker view" },
        { keys: ["2"], desc: "Switch to Accountant Audits & Exports view" },
        { keys: ["3"], desc: "Switch to Customers & Service Items directory" },
        { keys: ["0"], desc: "Return to Home Overview" },
        { keys: ["?"], desc: "Toggle this Keyboard Shortcuts dialog" },
        { keys: ["Esc"], desc: "Close active modal, palette, or menu" },
      ],
    },
    {
      title: "Engineer Mode (Field & Office)",
      items: [
        { keys: ["Space"], desc: "Start, pause, or resume live stopwatch timer" },
        { keys: ["S"], desc: "Stop active timer and log time entry" },
        { keys: ["T"], desc: "Switch to Live Timer tab" },
        { keys: ["N"], desc: "Switch to Manual Time Entry tab" },
      ],
    },
    {
      title: "Accountant Portal",
      items: [
        { keys: ["P"], desc: "Cycle calculation time period (Today, Week, Month, etc.)" },
        { keys: ["/"], desc: "Focus search filter input" },
        { keys: ["A"], desc: "Batch approve selected timesheet entries" },
        { keys: ["X"], desc: "Batch mark selected entries as exported" },
        { keys: ["I"], desc: "Direct download QuickBooks Desktop .IIF file" },
        { keys: ["C"], desc: "Direct download structured CSV audit file" },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={() => setIsHelpOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-background rounded-xl shadow-2xl border border-border/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm border border-primary/20">
              ⌘
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Keyboard Shortcuts</h3>
              <p className="text-xs text-muted-foreground">Navigate and execute actions with precision</p>
            </div>
          </div>
          <button
            onClick={() => setIsHelpOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {shortcutSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                {section.title}
              </h4>
              <div className="bg-muted/50 rounded-lg border border-border/40 divide-y divide-border/60 overflow-hidden">
                {section.items.map((item, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-foreground font-medium text-xs sm:text-sm">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-1 text-xs font-mono font-semibold text-foreground bg-background border border-border rounded-lg shadow-sm min-w-[24px] text-center"
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

        <div className="px-6 py-3.5 bg-muted border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Press <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-background border rounded">Esc</kbd> to dismiss
          </span>
          <span className="text-primary font-semibold">TimeTrack</span>
        </div>
      </div>
    </div>
  );
}
