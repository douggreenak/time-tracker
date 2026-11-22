"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Pause, Square, Timer, ChevronUp, CheckCircle, AlertCircle, Navigation, Check, X } from "lucide-react";
import type { TimeEntryItem } from "@/db/mock-data";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { TimesheetGrid } from "@/components/TimesheetGrid";
import { useDirectory } from "@/lib/useDirectory";
import { cn } from "@/components/ui";

type LocationType = "office" | "on_site" | "remote" | "travel";

const LOCATION_OPTS: { id: LocationType; label: string }[] = [
  { id: "on_site", label: "On-site" },
  { id: "office", label: "Office" },
  { id: "remote", label: "Remote" },
  { id: "travel", label: "Travel" },
];

const formatTime = (totalSeconds: number) => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
};

export default function EngineerPage() {
  const dir = useDirectory();
  const { customers, serviceItems, users } = dir;

  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [currentUserId, setCurrentUserId] = useState("usr_eng_1");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Stopwatch (secondary to manual entry)
  const [dockOpen, setDockOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [tCustomerId, setTCustomerId] = useState("");
  const [tJobId, setTJobId] = useState("");
  const [tServiceId, setTServiceId] = useState("");
  const [tLocation, setTLocation] = useState<LocationType>("on_site");
  const [tNotes, setTNotes] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/time-entries?userId=${currentUserId}`).then((r) => r.json());
      if (res.success) setEntries(res.data);
    } catch (err) {
      console.error("Failed to load entries", err);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Default the stopwatch's pickers once reference data is in.
  useEffect(() => {
    if (!tCustomerId) setTCustomerId(customers.find((c) => c.isActive)?.id ?? "");
    if (!tServiceId) setTServiceId(serviceItems[0]?.id ?? "");
  }, [customers, serviceItems, tCustomerId, tServiceId]);

  useEffect(() => {
    if (!running || paused) return;
    const t = setInterval(() => setSeconds((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [running, paused]);

  const stopAndSave = async () => {
    if (seconds < 10 && !confirm("This timer has run for less than 10 seconds. Save anyway?")) return;
    const durationMinutes = Math.max(1, Math.round(seconds / 60));
    const srv = serviceItems.find((s) => s.id === tServiceId);
    const cust = customers.find((c) => c.id === tCustomerId);
    if (!cust || !srv) {
      setMessage({ type: "error", text: "Choose a customer and service item for the stopwatch first." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          customerId: tCustomerId,
          jobId: tJobId || null,
          serviceItemId: tServiceId,
          date: new Date().toLocaleDateString("en-CA"),
          durationMinutes,
          locationType: tLocation,
          latitude: gps?.lat ?? null,
          longitude: gps?.lng ?? null,
          notes: tNotes || "Logged with stopwatch",
          isBillable: srv.defaultBillable,
          status: "submitted",
        }),
      }).then((r) => r.json());
      if (res.success) {
        setMessage({ type: "success", text: `Logged ${(durationMinutes / 60).toFixed(2)}h for ${cust.name}.` });
        setRunning(false);
        setPaused(false);
        setSeconds(0);
        setTNotes("");
        setGps(null);
        loadEntries();
      } else setMessage({ type: "error", text: res.error || "Failed to save timer" });
    } catch {
      setMessage({ type: "error", text: "Network error saving timer" });
    } finally {
      setSaving(false);
    }
  };

  const captureGps = () => {
    if (!navigator.geolocation) return setMessage({ type: "error", text: "Geolocation isn't supported by this browser." });
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) });
        setTLocation("on_site");
        setGpsLoading(false);
      },
      (err) => {
        setMessage({ type: "error", text: `Location unavailable: ${err.message}` });
        setGpsLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const toggleRun = () => {
    if (!running) {
      setRunning(true);
      setPaused(false);
    } else setPaused((p) => !p);
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

  const userName = users.find((u) => u.id === currentUserId)?.name ?? "Engineer";
  const showDock = dockOpen || running;
  const kbd = "rounded border border-current/25 px-1 py-px font-mono text-[10px] opacity-80";

  const fail = (error: string) => {
    setMessage({ type: "error", text: error });
    return null;
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Timesheet</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Type in the highlighted row and press <kbd className="font-mono font-semibold text-foreground">Enter</kbd> — or edit any cell. New customers,
            projects and service items are created as you type them.
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
          <label htmlFor="engineer-select" className="m3-label">Engineer</label>
          <select
            id="engineer-select"
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            className="m3-select h-10 cursor-pointer appearance-none rounded-full border border-outline-variant bg-surface-low pl-4 pr-9 text-xs font-semibold text-foreground transition-colors hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            {users
              .filter((u) => u.role === "engineer" || u.id === currentUserId)
              .map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
          </select>
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

      {dir.loaded ? (
        <TimesheetGrid
          entries={entries}
          setEntries={setEntries}
          customers={customers}
          serviceItems={serviceItems}
          userId={currentUserId}
          userName={userName}
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
            setMessage({ type: "success", text: `Added service item “${name}”.` });
            return r.data.id;
          }}
        />
      ) : (
        <div className="h-[calc(100dvh-14rem)] animate-pulse rounded-2xl border border-border/70 bg-surface-low" />
      )}

      {/* Stopwatch — secondary way to record time */}
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
              <span className="select-none font-mono text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums">{formatTime(seconds)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={toggleRun} variant={running && !paused ? "secondary" : "default"} className="gap-2 px-4 py-2 text-sm">
                {running && !paused ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
                {!running ? "Start" : paused ? "Resume" : "Pause"}
                <kbd className={kbd}>Space</kbd>
              </Button>
              {running && (
                <Button variant="destructive" onClick={stopAndSave} disabled={saving} className="gap-2 px-4 py-2 text-sm">
                  <Square className="h-3.5 w-3.5 fill-current" />
                  Stop &amp; log row
                  <kbd className={kbd}>S</kbd>
                </Button>
              )}
              {seconds > 0 && !running && (
                <Button variant="outline" size="sm" onClick={() => confirm("Reset stopwatch?") && setSeconds(0)}>
                  Reset
                </Button>
              )}
            </div>
            <div className="ml-auto grid w-full grid-cols-2 gap-2 lg:w-auto lg:grid-cols-[13rem_11rem_13rem_8rem_auto]">
              {[
                <Combobox key="c" aria-label="Stopwatch customer" placeholder="Customer…" value={tCustomerId}
                  options={customers.filter((c) => c.isActive).map((c) => ({ id: c.id, label: c.name }))}
                  onSelect={(id) => { setTCustomerId(id); setTJobId(""); }}
                  onCreate={async (name) => { const r = await dir.createCustomer(name); if (r.ok) { setTCustomerId(r.data.id); setTJobId(""); } else fail(r.error); }} />,
                <Combobox key="j" aria-label="Stopwatch project" placeholder="Project…" emptyLabel="— no project —" value={tJobId}
                  options={(customers.find((c) => c.id === tCustomerId)?.jobs ?? []).filter((j) => j.isActive).map((j) => ({ id: j.id, label: j.name }))}
                  onSelect={setTJobId}
                  onCreate={tCustomerId ? async (name) => { const r = await dir.createJob(tCustomerId, name); if (r.ok) setTJobId(r.data.id); else fail(r.error); } : undefined} />,
                <Combobox key="s" aria-label="Stopwatch service item" placeholder="Service item…" value={tServiceId}
                  options={serviceItems.map((s) => ({ id: s.id, label: s.name }))}
                  onSelect={setTServiceId}
                  onCreate={async (name) => { const r = await dir.createService(name); if (r.ok) setTServiceId(r.data.id); else fail(r.error); }} />,
                <Combobox key="l" aria-label="Stopwatch location" value={tLocation} options={LOCATION_OPTS}
                  onSelect={(id) => setTLocation(id as LocationType)} />,
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
                onChange={(e) => setTNotes(e.target.value)}
                placeholder="Session notes (saved with the row)…"
                aria-label="Stopwatch notes"
                className="h-9 w-full rounded-full border border-outline-variant bg-card px-4 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}
