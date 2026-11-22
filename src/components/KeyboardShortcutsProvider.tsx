"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface KeyboardShortcutsContextType {
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  isPaletteOpen: boolean;
  setIsPaletteOpen: (open: boolean) => void;
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType>({
  isHelpOpen: false,
  setIsHelpOpen: () => {},
  isPaletteOpen: false,
  setIsPaletteOpen: () => {},
});

export const useKeyboardShortcuts = () => useContext(KeyboardShortcutsContext);

export function KeyboardShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // Cmd+K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
        return;
      }

      // Escape -> Close any modal
      if (e.key === "Escape") {
        if (isPaletteOpen) {
          e.preventDefault();
          setIsPaletteOpen(false);
          return;
        }
        if (isHelpOpen) {
          e.preventDefault();
          setIsHelpOpen(false);
          return;
        }
      }

      // If user is inside an input, don't trigger navigation / single-key shortcuts
      if (isInput) return;

      // '?' or 'Shift + /' -> Keyboard Shortcuts Help
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsHelpOpen((prev) => !prev);
        return;
      }

      // Navigation shortcuts
      if (e.key === "1") {
        e.preventDefault();
        router.push("/engineer");
        return;
      }
      if (e.key === "2") {
        e.preventDefault();
        router.push("/accountant");
        return;
      }
      if (e.key === "3") {
        e.preventDefault();
        router.push("/customers");
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        router.push("/");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPaletteOpen, isHelpOpen, router]);

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        isHelpOpen,
        setIsHelpOpen,
        isPaletteOpen,
        setIsPaletteOpen,
      }}
    >
      {children}
    </KeyboardShortcutsContext.Provider>
  );
}
