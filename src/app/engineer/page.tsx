"use client";

import { useState, useEffect } from "react";
import {
  Play,
  Pause,
  Square,
  Clock,
  MapPin,
  Building,
  Car,
  Laptop,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Navigation,
  Check,
} from "lucide-react";
import { CustomerItem, ServiceItem, TimeEntryItem, UserItem } from "@/db/mock-data";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { TimesheetGrid } from "@/components/TimesheetGrid";
import { cn } from "@/components/ui";

type LocationType = "office" | "on_site" | "remote" | "travel";

const LOCATION_OPTS: { id: LocationType; label: string; icon: React.ReactNode }[] = [
  { id: "on_site", label: "On-site client", icon: <MapPin className="h-3.5 w-3.5" /> },
  { id: "office", label: "Office", icon: <Building className="h-3.5 w-3.5" /> },
  { id: "remote", label: "Remote", icon: <Laptop className="h-3.5 w-3.5" /> },
  { id: "travel", label: "Travel", icon: <Car className="h-3.5 w-3.5" /> },
];

export default function EngineerPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState<string>("usr_eng_1");

  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const [timerCustomerId, setTimerCustomerId] = useState("");
  const [timerJobId, setTimerJobId] = useState("");
  const [timerServiceItemId, setTimerServiceItemId] = useState("");
  const [timerLocationType, setTimerLocationType] = useState<LocationType>("on_site");
  const [timerLocationName, setTimerLocationName] = useState("");
  const [timerNotes, setTimerNotes] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [custRes, srvRes, userRes, entriesRes] = await Promise.all([
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/service-items").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch(`/api/time-entries?userId=${currentUserId}`).then((r) => r.json()),
      ]);

      if (custRes.success) {
        setCustomers(custRes.data);
        if (custRes.data.length > 0 && !timerCustomerId) {
          setTimerCustomerId(custRes.data[0].id);
        }
      }
      if (srvRes.success) {
        setServiceItems(srvRes.data);
        if (srvRes.data.length > 0 && !timerServiceItemId) {
          setTimerServiceItemId(srvRes.data[0].id);
        }
      }
      if (userRes.success) setUsers(userRes.data);
      if (entriesRes.success) setRecentEntries(entriesRes.data);
    } catch (err) {
      console.error("Failed to load initial data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentUserId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (timerRunning && !timerPaused) {
      interval = setInterval(() => {
        setSecondsElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerRunning, timerPaused]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if (isInput) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!timerRunning) {
          handleStartTimer();
        } else if (timerPaused) {
          handleResumeTimer();
        } else {
          handlePauseTimer();
        }
        return;
      }

      if (e.key.toLowerCase() === "s" && timerRunning) {
        e.preventDefault();
        handleStopAndSaveTimer();
        return;
      }

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        document.querySelector<HTMLElement>('[data-r="new"][data-c="hours"]')?.focus();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timerRunning, timerPaused]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleStartTimer = () => {
    setTimerRunning(true);
    setTimerPaused(false);
  };

  const handlePauseTimer = () => {
    setTimerPaused(true);
  };

  const handleResumeTimer = () => {
    setTimerPaused(false);
  };

  const handleStopAndSaveTimer = async () => {
    if (secondsElapsed < 10) {
      if (!confirm("This timer has run for less than 10 seconds. Save anyway?")) return;
    }

    const durationMinutes = Math.max(1, Math.round(secondsElapsed / 60));
    setIsSubmitting(true);

    try {
      const selectedCust = customers.find((c) => c.id === timerCustomerId);
      const selectedSrv = serviceItems.find((s) => s.id === timerServiceItemId);

      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          customerId: timerCustomerId,
          jobId: timerJobId || null,
          serviceItemId: timerServiceItemId,
          date: new Date().toISOString().split("T")[0],
          durationMinutes,
          locationType: timerLocationType,
          locationName: timerLocationName || null,
          latitude: gpsCoordinates?.lat || null,
          longitude: gpsCoordinates?.lng || null,
          notes: timerNotes || "Logged via Live Stopwatch",
          isBillable: selectedSrv?.defaultBillable ?? true,
          status: "submitted",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg({
          type: "success",
          text: `Logged ${durationMinutes} minutes (${(durationMinutes / 60).toFixed(2)}h) for ${selectedCust?.name}!`,
        });
        setTimerRunning(false);
        setTimerPaused(false);
        setSecondsElapsed(0);
        setTimerNotes("");
        setGpsCoordinates(null);
        fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to save timer" });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error saving timer" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetTimer = () => {
    if (confirm("Reset stopwatch back to 00:00:00?")) {
      setTimerRunning(false);
      setTimerPaused(false);
      setSecondsElapsed(0);
    }
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoordinates({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setTimerLocationType("on_site");
        if (!timerLocationName) {
          setTimerLocationName(`Site GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        }
        setGpsLoading(false);
      },
      (err) => {
        alert(`Location access unavailable: ${err.message}`);
        setGpsLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const timerCustJobs = customers.find((c) => c.id === timerCustomerId)?.jobs || [];


  const userName = users.find((u) => u.id === currentUserId)?.name ?? "Engineer";
  const kbd = "rounded border border-current/25 px-1 py-px font-mono text-[10px] opacity-80";

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Timesheet</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Type into the blue row and press Enter, or edit any cell below. Press <kbd className="font-mono font-semibold text-foreground">N</kbd> to jump to the new row.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="engineer-select" className="m3-label">Engineer</label>
          <select
            id="engineer-select"
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            className="h-10 cursor-pointer rounded-full border border-outline-variant bg-surface-low px-4 text-xs font-semibold text-foreground transition-colors duration-200 ease-expressive hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.defaultHourlyRate}/hr)
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedbackMsg && (
        <div
          role="status"
          className={`mb-4 flex items-center justify-between gap-4 rounded-xl px-4 py-3 text-sm font-medium ${
            feedbackMsg.type === "success"
              ? "bg-tertiary-container/50 text-tertiary-on-container"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-tertiary" />
            ) : (
              <AlertCircle className="h-5 w-5 text-destructive" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="text-xs underline hover:opacity-80">
            Dismiss
          </button>
        </div>
      )}

      {/* Compact stopwatch: logs a row into the grid when stopped */}
      <section className="mb-4 rounded-2xl border border-border/70 bg-surface-low p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                timerRunning && !timerPaused ? "animate-pulse bg-destructive" : "bg-outline-variant"
              )}
            />
            <div className="select-none font-mono text-3xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-foreground">
              {formatTime(secondsElapsed)}
            </div>
            <span className="m3-label hidden sm:inline">
              {timerRunning && !timerPaused ? "Recording" : timerPaused ? "Paused" : "Stopwatch"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!timerRunning || timerPaused ? (
              <Button onClick={timerRunning ? handleResumeTimer : handleStartTimer} className="gap-2 px-4 py-2 text-sm">
                <Play className="h-4 w-4 fill-current" />
                {timerRunning ? "Resume" : "Start"}
                <kbd className={kbd}>Space</kbd>
              </Button>
            ) : (
              <Button variant="secondary" onClick={handlePauseTimer} className="gap-2 px-4 py-2 text-sm">
                <Pause className="h-4 w-4 fill-current" />
                Pause
                <kbd className={kbd}>Space</kbd>
              </Button>
            )}
            {timerRunning && (
              <Button
                variant="destructive"
                onClick={handleStopAndSaveTimer}
                disabled={isSubmitting}
                className="gap-2 px-4 py-2 text-sm disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                Stop &amp; log row
                <kbd className={kbd}>S</kbd>
              </Button>
            )}
            {secondsElapsed > 0 && !timerRunning && (
              <Button variant="outline" size="sm" onClick={handleResetTimer} className="px-4 py-2">
                Reset
              </Button>
            )}
          </div>

          <div className="ml-auto grid w-full grid-cols-2 gap-2 lg:w-auto lg:grid-cols-[12rem_10rem_12rem_9rem_auto]">
            <Select
              aria-label="Timer customer"
              className="h-9 text-xs"
              value={timerCustomerId}
              onChange={(e) => {
                setTimerCustomerId(e.target.value);
                setTimerJobId("");
              }}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select aria-label="Timer job" className="h-9 text-xs" value={timerJobId} onChange={(e) => setTimerJobId(e.target.value)}>
              <option value="">— no job —</option>
              {timerCustJobs.map((j) => (
                <option key={j.id} value={j.id}>{j.name}</option>
              ))}
            </Select>
            <Select
              aria-label="Timer service item"
              className="h-9 text-xs"
              value={timerServiceItemId}
              onChange={(e) => setTimerServiceItemId(e.target.value)}
            >
              {serviceItems.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <Select
              aria-label="Timer location"
              className="h-9 text-xs"
              value={timerLocationType}
              onChange={(e) => setTimerLocationType(e.target.value as LocationType)}
            >
              {LOCATION_OPTS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </Select>
            <button
              type="button"
              onClick={handleCaptureGPS}
              disabled={gpsLoading}
              title={gpsCoordinates ? `Stamped ${gpsCoordinates.lat}, ${gpsCoordinates.lng}` : "Stamp GPS coordinates on this session"}
              className={cn(
                "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors",
                gpsCoordinates
                  ? "border-transparent bg-tertiary-container text-tertiary-on-container"
                  : "border-outline-variant text-primary hover:bg-foreground/[0.05]"
              )}
            >
              {gpsCoordinates ? <Check className="h-3.5 w-3.5" /> : <Navigation className="h-3.5 w-3.5" />}
              {gpsLoading ? "Locating…" : gpsCoordinates ? "GPS set" : "GPS"}
            </button>
          </div>

          {timerRunning && (
            <input
              value={timerNotes}
              onChange={(e) => setTimerNotes(e.target.value)}
              placeholder="Session notes (saved with the row)…"
              aria-label="Timer notes"
              className="h-9 w-full rounded-full border border-outline-variant bg-card px-4 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
            />
          )}
        </div>
      </section>

      {loading && customers.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-card py-16 text-center text-sm text-muted-foreground">
          Loading timesheet…
        </div>
      ) : (
        <TimesheetGrid
          entries={recentEntries}
          setEntries={setRecentEntries}
          customers={customers}
          serviceItems={serviceItems}
          userId={currentUserId}
          userName={userName}
          onChanged={fetchData}
          onMessage={setFeedbackMsg}
        />
      )}
    </div>
  );
}
