"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Play, Pause, Square, Timer, ChevronUp, CheckCircle, AlertCircle, Navigation, Check, X, Users } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { TimesheetGrid } from "@/components/TimesheetGrid";
import { useDirectory } from "@/lib/useDirectory";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/components/ui";

type LocationType = "office" | "on_site" | "remote" | "travel";

interface ActiveTimer {
  userId: string;
  customerId?: string;
  jobId?: string;
  serviceItemId?: string;
  locationType: LocationType;
  startTime: number;
  elapsedBeforePause: number;
  isRunning: boolean;
  notes?: string;
  serverNow?: number;
}

const LOCATION_OPTS: { id: LocationType; label: string }[] = [
  { id: "on_site", label: "On-site" },
  { id: "office", label: "Office" },
];

const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

const USER_KEY = "tt-user";

export default function EngineerPage() {
  const dir = useDirectory();
  const { user: me, isManager } = useAuth();
  const { customers, serviceItems, users } = dir;

  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Stopwatch — secondary to manual entry. Its state lives in the database (active_timers).
  const [dockOpen, setDockOpen] = useState(false);
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [skew, setSkew] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [tCustomerId, setTCustomerId] = useState("");
  const [tJobId, setTJobId] = useState("");
  const [tServiceId, setTServiceId] = useState("");
  const [tLocation, setTLocation] = useState<LocationType>("on_site");
  const [tNotes, setTNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }
  }, [currentUserId]);

  useEffect(() => {
    setEntries([]);
    loadEntries();
  }, [loadEntries]);

  const adopt = useCallback((t: ActiveTimer | null) => {
    setTimer(t);
    if (t?.serverNow) setSkew(t.serverNow - Date.now());
  }, []);

  // Pick up a timer that's already running (started earlier, in another tab, or before a refresh).
  useEffect(() => {
    if (!currentUserId) return;
    fetch(`/api/timer?userId=${currentUserId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.success) return;
        adopt(j.data);
        if (j.data) {
          setTCustomerId(j.data.customerId ?? "");
          setTJobId(j.data.jobId ?? "");
          setTServiceId(j.data.serviceItemId ?? "");
          setTLocation(j.data.locationType);
          setTNotes(j.data.notes ?? "");
          setDockOpen(true);
        }
      })
      .catch(() => {});
  }, [currentUserId, adopt]);

  // Default the pickers once reference data is in (and if the chosen ones disappear).
  useEffect(() => {
    // Customer, project and task are optional: only clear a choice whose record has been removed.
    if (tCustomerId && !customers.some((c) => c.id === tCustomerId)) setTCustomerId("");
    if (tServiceId && !serviceItems.some((s) => s.id === tServiceId)) setTServiceId("");
  }, [customers, serviceItems, tCustomerId, tServiceId]);

  useEffect(() => {
    if (!timer?.isRunning) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(t);
  }, [timer?.isRunning, timer?.startTime]);

  const running = !!timer;
  const paused = !!timer && !timer.isRunning;
  const seconds = timer
    ? timer.elapsedBeforePause + (timer.isRunning ? Math.max(0, Math.floor((now + skew - timer.startTime) / 1000)) : 0)
    : 0;

  const timerApi = useCallback(
    async (action: string, extra: Record<string, unknown> = {}) => {
      const res = await fetch("/api/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: currentUserId, ...extra }),
      }).then((r) => r.json());
      if (!res.success) throw new Error(res.error || "Timer request failed");
      return res.data;
    },
    [currentUserId]
  );

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Stopwatch error" });
    }
  };

  // Autosave the stopwatch's pickers/notes while a timer exists.
  const saveTimerFields = (patch: Record<string, unknown>) => {
    if (!running) return;
    guard(async () => adopt(await timerApi("update", patch)));
  };

  const start = () =>
    guard(async () => {
      adopt(
        await timerApi("start", {
          customerId: tCustomerId || undefined,
          jobId: tJobId || undefined,
          serviceItemId: tServiceId || undefined,
          locationType: tLocation,
          notes: tNotes,
        })
      );
    });

  const toggleRun = () => {
    if (!running) return start();
    guard(async () => adopt(await timerApi(paused ? "resume" : "pause")));
  };

  const stopAndSave = () =>
    guard(async () => {
      if (seconds < 10 && !confirm("This timer has run for less than 10 seconds. Save anyway?")) return;
      setSaving(true);
      try {
        if (notesTimer.current) clearTimeout(notesTimer.current);
        await timerApi("update", { notes: tNotes });
        const entry = await timerApi("stop");
        if (!entry) throw new Error("Couldn't save the timer — check the customer and task.");
        setMessage({ type: "success", text: `Logged ${(entry.durationMinutes / 60).toFixed(2)}h for ${entry.customerName}.` });
        setTimer(null);
        setTNotes("");
        setGps(null);
        loadEntries();
      } finally {
        setSaving(false);
      }
    });

  const discard = () =>
    guard(async () => {
      if (!confirm("Discard this stopwatch without saving a row?")) return;
      await timerApi("discard");
      setTimer(null);
      setTNotes("");
    });

  const captureGps = () => {
    if (!navigator.geolocation) return setMessage({ type: "error", text: "Geolocation isn't supported by this browser." });
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setTLocation("on_site");
        saveTimerFields({ locationType: "on_site" });
        setGpsLoading(false);
      },
      (err) => {
        setMessage({ type: "error", text: `Location unavailable: ${err.message}` });
        setGpsLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // N → new row · W → stopwatch · Space / S drive the stopwatch only while its dock is open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        e.preventDefault();
        document.querySelector<HTMLElement>('[data-r="new"][data-c="hours"]')?.focus();
      } else if (k === "w") {
        e.preventDefault();
        setDockOpen((o) => !o);
      } else if (dockOpen || running) {
        if (e.code === "Space") {
          e.preventDefault();
          toggleRun();
        } else if (k === "s" && running) {
          e.preventDefault();
          stopAndSave();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = users.find((u) => u.id === currentUserId);
  const showDock = dockOpen || running;
  const kbd = "rounded border border-current/25 px-1 py-px font-mono text-[10px] opacity-80";

  const fail = (error: string) => {
    setMessage({ type: "error", text: error });
    return null;
  };

  const needsPerson = dir.loaded && users.length === 0;

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Timesheet</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Type in the highlighted row and press <kbd className="font-mono font-semibold text-foreground">Enter</kbd> — or edit any cell. Everything autosaves, and
            new customers, projects and tasks are created as you type them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {running && !showDock && (
            <button
              onClick={() => setDockOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-destructive/10 px-4 font-mono text-xs font-semibold tabular-nums text-destructive"
            >
              <span className={cn("h-2 w-2 rounded-full bg-destructive", !paused && "pulse-ring")} />
              {formatTime(seconds)}
            </button>
          )}
          {isManager && users.length > 0 && (
            <>
              <label htmlFor="engineer-select" className="m3-label">Showing</label>
              <select
                id="engineer-select"
                value={currentUserId}
                onChange={(e) => chooseUser(e.target.value)}
                className="m3-select h-10 cursor-pointer appearance-none rounded-full border border-outline-variant bg-surface-low pl-4 pr-9 text-xs font-semibold text-foreground transition-colors hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </>
          )}
        </div>
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
      ) : dir.loaded && current ? (
        <TimesheetGrid
          entries={entries}
          setEntries={setEntries}
          customers={customers}
          serviceItems={serviceItems}
          userId={currentUserId}
          userName={current.name}
          onChanged={loadEntries}
          onMessage={setMessage}
          onCreateCustomer={async (name) => {
            const r = await dir.createCustomer(name);
            if (!r.ok) return fail(r.error);
            setMessage({ type: "success", text: `Added customer “${name}”.` });
            return r.data.id;
          }}
          onCreateJob={async (customerId, name) => {
            const r = await dir.createJob(customerId, name);
            if (!r.ok) return fail(r.error);
            setMessage({ type: "success", text: `Added project “${name}”.` });
            return r.data.id;
          }}
          onCreateService={async (name) => {
            const r = await dir.createService(name);
            if (!r.ok) return fail(r.error);
            setMessage({ type: "success", text: `Added task “${name}”.` });
            return r.data.id;
          }}
        />
      ) : (
        <div className="h-[calc(100dvh-14rem)] animate-pulse rounded-2xl border border-border/70 bg-surface-low" />
      )}

      {/* Stopwatch — secondary way to record time */}
      {current && (
        <section className="rounded-2xl border border-border/70 bg-surface-low">
          <button
            type="button"
            onClick={() => setDockOpen((o) => !o)}
            aria-expanded={showDock}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-foreground/[0.04]"
          >
            <Timer className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Stopwatch</span>
            <span className="text-xs text-muted-foreground">Prefer to time it live? Start a timer and it becomes a row when you stop.</span>
            <kbd className="ml-auto rounded border border-border px-1.5 py-px font-mono text-[10px] text-muted-foreground">W</kbd>
            <ChevronUp className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", !showDock && "rotate-180")} />
          </button>

          {showDock && (
            <div className="flex animate-m3-rise flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/70 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={cn("h-2.5 w-2.5 rounded-full", running && !paused ? "pulse-ring bg-destructive" : "bg-outline-variant")} />
                <span data-testid="stopwatch-time" className="select-none font-mono text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums">{formatTime(seconds)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={toggleRun} variant={running && !paused ? "secondary" : "default"} className="gap-2 px-4 py-2 text-sm">
                  {running && !paused ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                  {!running ? "Start" : paused ? "Resume" : "Pause"}
                  <kbd className={kbd}>Space</kbd>
                </Button>
                {running && (
                  <>
                    <Button variant="destructive" onClick={stopAndSave} disabled={saving} className="gap-2 px-4 py-2 text-sm">
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Stop &amp; log row
                      <kbd className={kbd}>S</kbd>
                    </Button>
                    <Button variant="outline" size="sm" onClick={discard}>Discard</Button>
                  </>
                )}
              </div>
              <div className="ml-auto grid w-full grid-cols-2 gap-2 lg:w-auto lg:grid-cols-[13rem_11rem_13rem_8rem_auto]">
                {[
                  <Combobox key="c" aria-label="Stopwatch customer" placeholder="Customer (optional)…" emptyLabel="— no customer —" value={tCustomerId}
                    options={customers.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name }))}
                    onSelect={(id) => { setTCustomerId(id); setTJobId(""); saveTimerFields({ customerId: id || null, jobId: null }); }}
                    onCreate={async (name) => { const r = await dir.createCustomer(name); if (r.ok) { setTCustomerId(r.data.id); setTJobId(""); saveTimerFields({ customerId: r.data.id, jobId: null }); } else fail(r.error); }} />,
                  <Combobox key="j" aria-label="Stopwatch project" placeholder="Project…" emptyLabel="— no project —" value={tJobId}
                    options={(customers.find((c) => c.id === tCustomerId)?.jobs ?? []).filter((j) => j.isActive).map((j) => ({ id: j.id, label: j.name }))}
                    onSelect={(id) => { setTJobId(id); saveTimerFields({ jobId: id || null }); }}
                    onCreate={tCustomerId ? async (name) => { const r = await dir.createJob(tCustomerId, name); if (r.ok) { setTJobId(r.data.id); saveTimerFields({ jobId: r.data.id }); } else fail(r.error); } : undefined} />,
                  <Combobox key="s" aria-label="Stopwatch task" placeholder="Task (optional)…" emptyLabel="— no task —" value={tServiceId}
                    options={serviceItems.map((s) => ({ id: s.id, label: s.name }))}
                    onSelect={(id) => { setTServiceId(id); saveTimerFields({ serviceItemId: id || null }); }}
                    onCreate={async (name) => { const r = await dir.createService(name); if (r.ok) { setTServiceId(r.data.id); saveTimerFields({ serviceItemId: r.data.id }); } else fail(r.error); }} />,
                  <Combobox key="l" aria-label="Stopwatch location" value={tLocation} options={LOCATION_OPTS}
                    onSelect={(id) => { setTLocation(id as LocationType); saveTimerFields({ locationType: id }); }} />,
                ].map((el) => (
                  <div key={el.key} className="rounded-lg border border-outline-variant bg-card transition-colors focus-within:border-primary hover:border-outline">
                    {el}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={captureGps}
                  disabled={gpsLoading}
                  title={gps ? `Stamped ${gps.lat}, ${gps.lng}` : "Stamp GPS coordinates on this session"}
                  className={cn(
                    "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                    gps ? "border-transparent bg-tertiary-container text-tertiary-on-container" : "border-outline-variant text-primary hover:bg-foreground/[0.05]"
                  )}
                >
                  {gps ? <Check className="h-3.5 w-3.5" /> : <Navigation className="h-3.5 w-3.5" />}
                  {gpsLoading ? "Locating…" : gps ? "GPS set" : "GPS"}
                </button>
              </div>
              {running && (
                <input
                  value={tNotes}
                  onChange={(e) => {
                    setTNotes(e.target.value);
                    if (notesTimer.current) clearTimeout(notesTimer.current);
                    const v = e.target.value;
                    notesTimer.current = setTimeout(() => saveTimerFields({ notes: v }), 600);
                  }}
                  placeholder="Session notes (autosaved, then saved with the row)…"
                  aria-label="Stopwatch notes"
                  className="h-9 w-full rounded-full border border-outline-variant bg-card px-4 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
