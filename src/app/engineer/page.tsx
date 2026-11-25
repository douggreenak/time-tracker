"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, AlertCircle, X, Users } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { PageLoader } from "@/components/ui/loader";
import { Dropdown } from "@/components/ui/dropdown";
import { TimesheetGrid } from "@/components/TimesheetGrid";
import { useDirectory } from "@/lib/useDirectory";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/components/ui";

const USER_KEY = "tt-user";

export default function EngineerPage() {
  const dir = useDirectory();
  const { user: me, isManager } = useAuth();
  const { customers, users } = dir;

  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [entriesReady, setEntriesReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Who is logging? Engineers always log as themselves; accountants/admins can pick anyone
  // (remembered per browser, defaulting to themselves).
  useEffect(() => {
    if (!dir.loaded || !me) return;
    if (!isManager) return void (currentUserId !== me.id && setCurrentUserId(me.id));
    if (users.some((u) => u.id === currentUserId)) return;
    let saved = "";
    try {
      saved = localStorage.getItem(USER_KEY) ?? "";
    } catch {}
    const pick = users.find((u) => u.id === saved) ?? users.find((u) => u.id === me.id) ?? users.find((u) => u.role === "engineer") ?? users[0];
    if (pick) setCurrentUserId(pick.id);
  }, [dir.loaded, users, currentUserId, me, isManager]);

  const chooseUser = (id: string) => {
    setCurrentUserId(id);
    try {
      localStorage.setItem(USER_KEY, id);
    } catch {}
  };

  const loadEntries = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/time-entries?userId=${currentUserId}`).then((r) => r.json());
      if (res.success) setEntries(res.data);
    } catch (err) {
      console.error("Failed to load entries", err);
    } finally {
      setEntriesReady(true);
    }
  }, [currentUserId]);

  useEffect(() => {
    setEntries([]);
    setEntriesReady(false);
    loadEntries();
  }, [loadEntries]);

  // N → jump to the hours box of the entry row
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        document.querySelector<HTMLElement>('[data-r="new"][data-c="hours"]')?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = users.find((u) => u.id === currentUserId);
  const needsPerson = dir.loaded && users.length === 0;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Timesheet</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Type in the highlighted row and press <kbd className="font-mono font-semibold text-foreground">Enter</kbd> — or edit any cell. Everything autosaves, and new customers are created as you type them.
          </p>
        </div>
        {isManager && users.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="engineer-select" className="m3-label">Showing</label>
            <div className="w-52">
              <Dropdown id="engineer-select" aria-label="Showing" value={currentUserId} onChange={chooseUser} options={users.map((u) => ({ value: u.id, label: u.name }))} className="h-10 text-xs font-semibold" />
            </div>
          </div>
        )}
      </div>

      {message && (
        <div
          role="status"
          className={cn(
            "flex animate-m3-rise items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-medium",
            message.type === "success" ? "bg-tertiary-container/60 text-tertiary-on-container" : "bg-destructive/10 text-destructive"
          )}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} aria-label="Dismiss" className="rounded-full p-1 hover:bg-foreground/10">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {needsPerson ? (
        <div className="flex h-[calc(100dvh-14rem)] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-low text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-semibold">Who’s logging time?</p>
            <p className="mt-1 text-sm text-muted-foreground">Add people on the Team page first, then come back to start entering hours.</p>
          </div>
          <Link href="/team" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
            Add a person
          </Link>
        </div>
      ) : dir.loaded && current && entriesReady ? (
        <TimesheetGrid
          entries={entries}
          setEntries={setEntries}
          customers={customers}
          userId={currentUserId}
          userName={current.name}
          isManager={isManager}
          onChanged={loadEntries}
          onMessage={setMessage}
          onCreateCustomer={async (name) => {
            const r = await dir.createCustomer(name);
            if (!r.ok) {
              setMessage({ type: "error", text: r.error });
              return null;
            }
            setMessage({ type: "success", text: `Added customer “${name}”.` });
            return r.data.id;
          }}
        />
      ) : (
        <PageLoader label="Loading your timesheet…" className="h-[calc(100dvh-14rem)]" />
      )}
    </div>
  );
}
