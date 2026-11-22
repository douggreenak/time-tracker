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
  PlusCircle,
  Calendar,
  Briefcase,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Navigation,
  Check,
} from "lucide-react";
import { CustomerItem, ServiceItem, TimeEntryItem, UserItem } from "@/db/mock-data";
import { formatQuickBooksDuration } from "@/lib/quickbooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/components/ui";

type LocationType = "office" | "on_site" | "remote" | "travel";

const LOCATION_OPTS: { id: LocationType; label: string; icon: React.ReactNode }[] = [
  { id: "on_site", label: "On-Site Client", icon: <MapPin className="w-3.5 h-3.5 text-amber-600" /> },
  { id: "office", label: "Office", icon: <Building className="w-3.5 h-3.5 text-blue-600" /> },
  { id: "remote", label: "Remote", icon: <Laptop className="w-3.5 h-3.5 text-emerald-600" /> },
  { id: "travel", label: "Travel / Transit", icon: <Car className="w-3.5 h-3.5 text-purple-600" /> },
];

export default function EngineerPage() {
  const [activeTab, setActiveTab] = useState<"timer" | "manual">("timer");

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

  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualHours, setManualHours] = useState<number | "">("");
  const [manualMinutes, setManualMinutes] = useState<number | "">("");
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [manualJobId, setManualJobId] = useState("");
  const [manualServiceItemId, setManualServiceItemId] = useState("");
  const [manualLocationType, setManualLocationType] = useState<LocationType>("office");
  const [manualLocationName, setManualLocationName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualBillable, setManualBillable] = useState(true);
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
          setManualCustomerId(custRes.data[0].id);
        }
      }
      if (srvRes.success) {
        setServiceItems(srvRes.data);
        if (srvRes.data.length > 0 && !timerServiceItemId) {
          setTimerServiceItemId(srvRes.data[0].id);
          setManualServiceItemId(srvRes.data[0].id);
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

      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setActiveTab("timer");
        return;
      }

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setActiveTab("manual");
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

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = Number(manualHours) || 0;
    const mins = Number(manualMinutes) || 0;
    const totalMinutes = hrs * 60 + mins;

    if (totalMinutes <= 0) {
      setFeedbackMsg({ type: "error", text: "Please enter a duration greater than 0 minutes." });
      return;
    }

    if (!manualCustomerId || !manualServiceItemId) {
      setFeedbackMsg({ type: "error", text: "Please select a Customer and Service Item." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          customerId: manualCustomerId,
          jobId: manualJobId || null,
          serviceItemId: manualServiceItemId,
          date: manualDate,
          durationMinutes: totalMinutes,
          locationType: manualLocationType,
          locationName: manualLocationName || null,
          notes: manualNotes,
          isBillable: manualBillable,
          status: "submitted",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg({ type: "success", text: `Successfully logged ${hrs}h ${mins}m to timesheet!` });
        setManualHours("");
        setManualMinutes("");
        setManualNotes("");
        setManualLocationName("");
        fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to log entry" });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Error submitting time entry" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Delete this timesheet entry?")) return;
    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecentEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  const timerCustJobs = customers.find((c) => c.id === timerCustomerId)?.jobs || [];
  const manualCustJobs = customers.find((c) => c.id === manualCustomerId)?.jobs || [];

  const LocationPill = ({ id, label, icon, active }: { id: LocationType; label: string; icon: React.ReactNode; active: boolean }) => (
    <button
      type="button"
      onClick={() => {}}
      className={cn(
        "flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-semibold border transition",
        active
          ? "bg-primary/10 border-primary/30 text-primary-900 shadow-sm"
          : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary text-primary-foreground text-xs font-semibold mb-2 border border-border/60">
            <span>Field & Office Mobility Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Engineer Timesheet Tracker
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Record on-site stopwatch hours, GPS geo-tags, or enter retroactive logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Engineer:</span>
          <select
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.defaultHourlyRate}/hr)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex p-1.5 bg-secondary/60 rounded-xl border border-border/60 shadow-xs">
          <button
            onClick={() => setActiveTab("timer")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "timer"
                ? "bg-background text-primary-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="w-4 h-4 text-primary" />
            <span>Live Stopwatch</span>
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
              activeTab === "manual"
                ? "bg-background text-primary-foreground shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-primary" />
            <span>Manual Time Entry</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-sm border ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {activeTab === "timer" && (
        <div className="space-y-6">
          <div className="bg-background rounded-xl border border-border/60 shadow-sm p-6 sm:p-8 text-center relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {timerRunning && !timerPaused
                ? "Active Field Session Recording"
                : timerPaused
                ? "Stopwatch Paused"
                : "Ready to Track"}
            </div>

            <div className="text-5xl sm:text-7xl font-extrabold text-foreground tracking-tight font-mono py-2 select-none">
              {formatTime(secondsElapsed)}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              {!timerRunning ? (
                <Button
                  onClick={handleStartTimer}
                  className="px-6 py-3.5 text-sm shadow-sm shadow-primary/20 flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start Stopwatch</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 text-primary rounded border border-primary/20">
                    Space
                  </kbd>
                </Button>
              ) : timerPaused ? (
                <Button
                  onClick={handleResumeTimer}
                  className="px-6 py-3.5 text-sm shadow-sm shadow-primary/20 flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Resume Timer</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 text-primary rounded border border-primary/20">
                    Space
                  </kbd>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={handlePauseTimer}
                  className="px-6 py-3.5 text-sm shadow-sm flex items-center gap-2"
                >
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pause Timer</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 text-primary rounded border border-primary/20">
                    Space
                  </kbd>
                </Button>
              )}

              {timerRunning && (
                <Button
                  variant="destructive"
                  onClick={handleStopAndSaveTimer}
                  disabled={isSubmitting}
                  className="px-6 py-3.5 text-sm shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop & Save Log</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-destructive/10 text-destructive rounded border border-destructive/20">
                    S
                  </kbd>
                </Button>
              )}

              {secondsElapsed > 0 && !timerRunning && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetTimer}
                  className="px-4 py-2"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Session Activity & Site Mapping
                </h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-0">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Client / Customer Account</Label>
                  <Select
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
                </div>

                <div>
                  <Label>QuickBooks Sub-Job (Customer:Job)</Label>
                  <Select
                    value={timerJobId}
                    onChange={(e) => setTimerJobId(e.target.value)}
                  >
                    <option value="">General Project Overhead (No Job)</option>
                    {timerCustJobs.map((j) => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="mt-4">
                <Label>QuickBooks Service Item</Label>
                <Select
                  value={timerServiceItemId}
                  onChange={(e) => setTimerServiceItemId(e.target.value)}
                >
                  {serviceItems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.defaultBillable ? "Billable" : "Non-Billable"})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label>Work Location Type</Label>
                  <button
                    type="button"
                    onClick={handleCaptureGPS}
                    disabled={gpsLoading}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/90 transition"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{gpsLoading ? "Acquiring GPS..." : "Stamp GPS Coordinates"}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  {LOCATION_OPTS.map((loc) => {
                    const active = timerLocationType === loc.id;
                    return (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => setTimerLocationType(loc.id)}
                        className={cn(
                          "flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-semibold border transition",
                          active
                            ? "bg-primary/10 border-primary/30 text-primary-900 shadow-sm"
                            : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
                        )}
                      >
                        {loc.icon}
                        <span>{loc.label}</span>
                      </button>
                    );
                  })}
                </div>

                {gpsCoordinates && (
                  <div className="mt-2 text-[11px] text-emerald-700 font-mono font-medium flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>GPS Lat: {gpsCoordinates.lat}, Lng: {gpsCoordinates.lng} stamped</span>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <Label>Session Field Notes</Label>
                <textarea
                  rows={2}
                  value={timerNotes}
                  onChange={(e) => setTimerNotes(e.target.value)}
                  placeholder="Observed site findings, calibrated bearings, walk notes..."
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-ring/20 focus:outline-none"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "manual" && (
        <form
          onSubmit={handleManualSubmit}
          className="bg-background rounded-xl border border-border/60 shadow-sm p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center justify-between pb-4 border-b border-border/40">
            <div>
              <h3 className="text-base font-bold text-foreground">Log Completed Hours</h3>
              <p className="text-xs text-muted-foreground">Retroactively record engineering time</p>
            </div>
            <Calendar className="w-5 h-5 text-primary" />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Hours</Label>
              <Input
                type="number"
                min="0"
                max="24"
                placeholder="e.g. 3"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Minutes</Label>
              <Input
                type="number"
                min="0"
                max="59"
                placeholder="e.g. 45"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Client / Customer</Label>
              <Select
                value={manualCustomerId}
                onChange={(e) => {
                  setManualCustomerId(e.target.value);
                  setManualJobId("");
                }}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Sub-Job</Label>
              <Select
                value={manualJobId}
                onChange={(e) => setManualJobId(e.target.value)}
              >
                <option value="">General Project Overhead (No Job)</option>
                {manualCustJobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-center">
            <div>
              <Label>Service Item</Label>
              <Select
                value={manualServiceItemId}
                onChange={(e) => setManualServiceItemId(e.target.value)}
              >
                {serviceItems.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div className="pt-6 flex items-center gap-3">
              <input
                type="checkbox"
                id="manual-billable"
                checked={manualBillable}
                onChange={(e) => setManualBillable(e.target.checked)}
                className="rounded text-primary border-input"
              />
              <Label htmlFor="manual-billable" className="text-xs font-semibold text-foreground cursor-pointer">
                Billable to Client
              </Label>
            </div>
          </div>

          <div>
            <Label>Location Type</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
              {LOCATION_OPTS.map((loc) => {
                const active = manualLocationType === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setManualLocationType(loc.id)}
                    className={cn(
                      "flex items-center justify-center gap-2 p-2.5 rounded-lg text-xs font-semibold border transition",
                      active
                        ? "bg-primary/10 border-primary/30 text-primary-900 shadow-sm"
                        : "bg-muted/60 border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {loc.icon}
                    <span>{loc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Description / Notes</Label>
            <textarea
              rows={2}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Performed structural load calculations, reviewed blueprints..."
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-xs font-medium focus:ring-2 focus:ring-ring/20 focus:outline-none"
            />
          </div>

          <Separator className="my-4" />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shadow-sm shadow-primary/20 transition active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? "Logging Timesheet..." : "Add to Timesheet"}
          </button>
        </form>
      )}

      <div className="mt-8 bg-background rounded-xl border border-border/60 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/40">
          <div>
            <h3 className="text-sm font-bold text-foreground">Your Recent Timesheet Records</h3>
            <p className="text-xs text-muted-foreground">Recently logged hours</p>
          </div>
          <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            {recentEntries.length} entries
          </span>
        </div>

        {recentEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No time entries logged yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {recentEntries.slice(0, 6).map((entry) => (
              <div key={entry.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-mono font-semibold text-foreground">{entry.date}</span>
                  <div className="font-semibold text-foreground">
                    {entry.customerName}
                    {entry.jobName && <span className="text-muted-foreground font-normal">:{entry.jobName}</span>}
                  </div>
                  <span className="text-muted-foreground hidden sm:inline">•</span>
                  <span className="text-muted-foreground">{entry.serviceItemName}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-foreground text-sm">
                    {formatQuickBooksDuration(entry.durationMinutes)}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 capitalize">
                    {entry.status}
                  </Badge>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="text-muted-foreground hover:text-rose-600 p-1.5 rounded transition"
                    title="Delete entry"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
