"use client";

import React from "react";
import { Search, HelpCircle, Lock } from "lucide-react";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";

export function NavHeaderActions() {
  const { setIsPaletteOpen, setIsHelpOpen } = useKeyboardShortcuts();

  const handleLock = () => {
    try {
      localStorage.removeItem("timetracker_auth_state_v1");
    } catch {}
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Command Palette Trigger */}
      <button
        onClick={() => setIsPaletteOpen(true)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 text-xs font-medium transition"
        title="Quick Commands & Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline">Commands</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded-md shadow-2xs">
          ⌘K
        </kbd>
      </button>

      {/* Keyboard Shortcuts Help */}
      <button
        onClick={() => setIsHelpOpen(true)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
        title="Keyboard Shortcuts Cheat Sheet (?)"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {/* Lock Application */}
      <button
        onClick={handleLock}
        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
        title="Lock System (Require PIN)"
      >
        <Lock className="w-4 h-4" />
      </button>
    </div>
  );
}
