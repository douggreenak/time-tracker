"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Loader2, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "idle" | "saving" | "saved" | "error";

/**
 * Autosave status. Wraps window.fetch once and tracks every write (POST/PUT/PATCH/DELETE),
 * so any edit anywhere in the app shows up here without per-screen plumbing.
 */
export function SaveIndicator() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    const w = window as unknown as { __ttFetchWrapped?: boolean; __ttSaveListeners?: Set<(s: State) => void> };
    w.__ttSaveListeners ??= new Set();
    const listeners = w.__ttSaveListeners;
    const emit = (s: State) => listeners.forEach((l) => l(s));

    if (!w.__ttFetchWrapped) {
      w.__ttFetchWrapped = true;
      const original = window.fetch.bind(window);
      let pending = 0;
      let failed = false;
      window.fetch = async (input, init) => {
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        if (method === "GET" || method === "HEAD") return original(input, init);
        pending++;
        failed = false;
        emit("saving");
        try {
          const res = await original(input, init);
          if (!res.ok) failed = true;
          return res;
        } catch (err) {
          failed = true;
          throw err;
        } finally {
          pending--;
          if (pending === 0) emit(failed ? "error" : "saved");
        }
      };
    }
    listeners.add(setState);
    return () => void listeners.delete(setState);
  }, []);

  // "Saved" settles back to a quiet resting label.
  useEffect(() => {
    if (state !== "saved") return;
    const t = setTimeout(() => setState("idle"), 2500);
    return () => clearTimeout(t);
  }, [state]);

  const view = {
    idle: { icon: <Cloud className="h-3.5 w-3.5" />, text: "Autosave on", cls: "text-muted-foreground" },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: "Saving…", cls: "text-muted-foreground" },
    saved: { icon: <Check className="h-3.5 w-3.5" />, text: "All changes saved", cls: "text-tertiary" },
    error: { icon: <AlertCircle className="h-3.5 w-3.5" />, text: "Couldn’t save — retry your last change", cls: "text-destructive" },
  }[state];

  return (
    <div
      aria-live="polite"
      data-save-state={state}
      className={cn("hidden items-center gap-1.5 text-xs font-medium transition-colors duration-300 md:flex", view.cls)}
    >
      {view.icon}
      <span>{view.text}</span>
    </div>
  );
}
