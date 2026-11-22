"use client";

import React from "react";
import { Search, HelpCircle, Lock } from "lucide-react";
import { useKeyboardShortcuts } from "./KeyboardShortcutsProvider";
import { Button } from "@/components/ui/button";

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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsPaletteOpen(true)}
        className="px-3 text-xs"
        title="Quick Commands & Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline ml-1.5">Commands</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsHelpOpen(true)}
        className="w-8 h-8"
        title="Keyboard Shortcuts Cheat Sheet (?)"
      >
        <HelpCircle className="w-4 h-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleLock}
        className="w-8 h-8 text-muted-foreground hover:text-rose-600 hover:bg-rose-50"
        title="Lock System (Require PIN)"
      >
        <Lock className="w-4 h-4" />
      </Button>
    </div>
  );
}
