"use client";

import React from "react";
import { Search, HelpCircle, Lock } from "lucide-react";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";

const AUTH_STORAGE_KEY = "timetracker_auth_state_v1";

export function NavHeaderActions() {
  const { setIsPaletteOpen, setIsHelpOpen } = useKeyboardShortcuts();

  const handleLock = () => {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {}
    window.location.reload();
  };

  const iconButton =
    "flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 ease-expressive hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setIsPaletteOpen(true)}
        title="Search & commands (⌘K)"
        className="hidden h-10 items-center gap-2 rounded-full bg-surface-container-low px-4 text-xs font-medium text-muted-foreground transition-colors duration-200 ease-expressive hover:bg-surface-container hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex"
      >
        <Search className="h-4 w-4" />
        <span>Search</span>
      </button>

      <button
        type="button"
        onClick={() => setIsPaletteOpen(true)}
        title="Search & commands (⌘K)"
        className={`${iconButton} sm:hidden`}
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => setIsHelpOpen(true)}
        title="Keyboard shortcuts (?)"
        className={iconButton}
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={handleLock}
        title="Lock session"
        className={`${iconButton} hover:text-destructive`}
      >
        <Lock className="h-4 w-4" />
      </button>
    </div>
  );
}
