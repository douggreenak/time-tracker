"use client";

import React from "react";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";
import { X, Command, HardHat, BarChart3, Settings, Play, CheckSquare, Download, Search, Shield } from "lucide-react";

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsHelpOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-100">
              ⌘
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Keyboard Shortcuts</h3>
              <p className="text-xs text-slate-500">Navigate and execute actions with precision</p>
            </div>
          </div>
          <button
            onClick={() => setIsHelpOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {shortcutSections.map((section) => (
            <div key={section.title}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 px-1">
                {section.title}
              </h4>
              <div className="bg-slate-50/80 rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {section.items.map((item, idx) => (
                  <div key={idx} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <span className="text-slate-700 font-medium text-xs sm:text-sm">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-1 text-xs font-mono font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm min-w-[24px] text-center"
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

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Press <kbd className="px-1.5 py-0.5 font-mono text-[11px] bg-white border rounded">Esc</kbd> to dismiss
          </span>
          <span className="text-indigo-600 font-semibold">Field & Office Time Tracker</span>
        </div>
      </div>
    </div>
  );
}
