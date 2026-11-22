"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";
import {
  Search,
  HardHat,
  BarChart3,
  Settings,
  Clock,
  PlusCircle,
  FileSpreadsheet,
  FileText,
  Lock,
  ArrowRight,
  HelpCircle,
} from "lucide-react";

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
      title: "Go to Engineer View",
      subtitle: "Stopwatch timer, GPS site tagging & manual logs",
      icon: <HardHat className="w-4 h-4 text-emerald-600" />,
      shortcut: "1",
      perform: () => router.push("/engineer"),
    },
    {
      id: "nav-accountant",
      title: "Go to Accountant View",
      subtitle: "Audits, time period calculations & QuickBooks exports",
      icon: <BarChart3 className="w-4 h-4 text-indigo-600" />,
      shortcut: "2",
      perform: () => router.push("/accountant"),
    },
    {
      id: "nav-settings",
      title: "Go to Directory & Settings",
      subtitle: "QuickBooks customers, sub-jobs & service items",
      icon: <Settings className="w-4 h-4 text-slate-600" />,
      shortcut: "3",
      perform: () => router.push("/settings"),
    },
    {
      id: "export-iif",
      title: "Export QuickBooks Desktop .IIF",
      subtitle: "Download official TIMEACT tab-delimited timer file",
      icon: <FileSpreadsheet className="w-4 h-4 text-purple-600" />,
      shortcut: "I",
      perform: () => {
        window.location.href = "/api/export/iif";
      },
    },
    {
      id: "export-csv",
      title: "Export Timesheet .CSV",
      subtitle: "Download full structured CSV for Excel / reporting",
      icon: <FileText className="w-4 h-4 text-blue-600" />,
      shortcut: "C",
      perform: () => {
        window.location.href = "/api/export/csv";
      },
    },
    {
      id: "shortcuts-help",
      title: "View All Keyboard Shortcuts",
      subtitle: "See full cheat sheet of keyboard commands",
      icon: <HelpCircle className="w-4 h-4 text-amber-600" />,
      shortcut: "?",
      perform: () => setIsHelpOpen(true),
    },
    {
      id: "lock-app",
      title: "Lock Application",
      subtitle: "Require PIN / Password authentication",
      icon: <Lock className="w-4 h-4 text-rose-600" />,
      shortcut: "L",
      perform: () => {
        localStorage.removeItem("timetracker_auth");
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
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      setIsPaletteOpen(false);
      filtered[selectedIndex].perform();
    }
  };

  if (!isPaletteOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsPaletteOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, views, or exports... (Arrow keys to navigate)"
            className="w-full text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400 bg-slate-100 rounded border">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No commands matching "{query}"
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
                  className={`px-4 py-3 rounded-2xl flex items-center justify-between cursor-pointer transition ${
                    isSelected ? "bg-slate-100/90 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white shadow-xs border border-slate-200 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                      <div className="text-xs text-slate-400">{item.subtitle}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs font-mono font-semibold text-slate-500 bg-white border border-slate-200 rounded-md shadow-2xs">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-4 h-4 text-slate-400 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="px-5 py-2.5 bg-slate-50/80 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>Navigate: <kbd className="px-1 py-0.2 font-mono bg-white border rounded">↑</kbd> <kbd className="px-1 py-0.2 font-mono bg-white border rounded">↓</kbd></span>
            <span>Select: <kbd className="px-1 py-0.2 font-mono bg-white border rounded">↵</kbd></span>
          </div>
          <span>TimeTrack Expressive</span>
        </div>
      </div>
    </div>
  );
}
