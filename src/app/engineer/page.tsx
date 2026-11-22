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

export default function EngineerPage() {
  // Mode toggle: Live Timer vs Manual Entry
  const [activeTab, setActiveTab] = useState<"timer" | "manual">("timer");

  // Data lists
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Engineer User (Doug Mitchell by default)
  const [currentUserId, setCurrentUserId] = useState<string>("usr_eng_1");

  // Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Timer Form Selection
  const [timerCustomerId, setTimerCustomerId] = useState("");
  const [timerJobId, setTimerJobId] = useState("");
  const [timerServiceItemId, setTimerServiceItemId] = useState("");
  const [timerLocationType, setTimerLocationType] = useState<"office" | "on_site" | "remote" | "travel">("on_site");
  const [timerLocationName, setTimerLocationName] = useState("");
  const [timerNotes, setTimerNotes] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Manual Entry Form State
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [manualHours, setManualHours] = useState<number | "">("");
  const [manualMinutes, setManualMinutes] = useState<number | "">("");
  const [manualCustomerId, setManualCustomerId] = useState("");
  const [manualJobId, setManualJobId] = useState("");
  const [manualServiceItemId, setManualServiceItemId] = useState("");
  const [manualLocationType, setManualLocationType] = useState<"office" | "on_site" | "remote" | "travel">("office");
  const [manualLocationName, setManualLocationName] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualBillable, setManualBillable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch initial data
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

  // Stopwatch interval timer
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

  // Keyboard Shortcuts for Engineer Page
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

      // Space -> Start / Pause / Resume timer
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

      // S -> Stop and save timer
      if (e.key.toLowerCase() === "s" && timerRunning) {
        e.preventDefault();
        handleStopAndSaveTimer();
        return;
      }

      // T -> Timer mode
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setActiveTab("timer");
        return;
      }

      // N -> New manual entry mode
      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setActiveTab("manual");
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timerRunning, timerPaused, secondsElapsed, timerCustomerId, timerJobId, timerServiceItemId, timerLocationType, timerLocationName, timerNotes]);

  // Format seconds to HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Timer controls
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
      const selectedJob = selectedCust?.jobs.find((j) => j.id === timerJobId);
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

  // HTML5 GPS Geolocation capture
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

  // Submit manual time entry
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

  // Delete an entry
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top Banner & Engineer Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200/80 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold mb-2">
            <span>Field & Office Mobility Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Engineer Timesheet Tracker
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Record on-site stopwatch hours, GPS geo-tags, or enter retroactive logs
          </p>
        </div>

        {/* Engineer Profile Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Engineer:</span>
          <select
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/20"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} (${u.defaultHourlyRate}/hr)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode Switcher: Expressive Segmented Tabs */}
      <div className="flex items-center justify-center mb-6">
        <div className="inline-flex p-1.5 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-2xs">
          <button
            onClick={() => setActiveTab("timer")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "timer"
                ? "bg-white text-emerald-800 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Live Stopwatch</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-mono bg-slate-100 text-slate-400 rounded">
              T
            </kbd>
          </button>

          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
              activeTab === "manual"
                ? "bg-white text-indigo-800 shadow-xs font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <PlusCircle className="w-4 h-4 text-indigo-600" />
            <span>Manual Time Entry</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-mono bg-slate-100 text-slate-400 rounded">
              N
            </kbd>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {feedbackMsg && (
        <div
          className={`mb-6 p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between shadow-2xs animate-in fade-in duration-150 ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
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

      {/* Tab 1: Live Stopwatch */}
      {activeTab === "timer" && (
        <div className="space-y-6">
          {/* Stopwatch Digital Display Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-center relative overflow-hidden">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              {timerRunning && !timerPaused
                ? "Active Field Session Recording"
                : timerPaused
                ? "Stopwatch Paused"
                : "Ready to Track"}
            </div>

            {/* Huge Monospace Timer */}
            <div className="text-5xl sm:text-7xl font-extrabold text-slate-900 tracking-tight font-mono py-2 select-none">
              {formatTime(secondsElapsed)}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
              {!timerRunning ? (
                <button
                  onClick={handleStartTimer}
                  className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Start Stopwatch</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-700/80 rounded text-emerald-100">
                    Space
                  </kbd>
                </button>
              ) : timerPaused ? (
                <button
                  onClick={handleResumeTimer}
                  className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Resume Timer</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-700/80 rounded text-emerald-100">
                    Space
                  </kbd>
                </button>
              ) : (
                <button
                  onClick={handlePauseTimer}
                  className="px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-amber-500/20 transition flex items-center gap-2"
                >
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Pause Timer</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-600/80 rounded text-amber-100">
                    Space
                  </kbd>
                </button>
              )}

              {timerRunning && (
                <button
                  onClick={handleStopAndSaveTimer}
                  disabled={isSubmitting}
                  className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop & Save Log</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-indigo-700/80 rounded text-indigo-100">
                    S
                  </kbd>
                </button>
              )}

              {secondsElapsed > 0 && !timerRunning && (
                <button
                  onClick={handleResetTimer}
                  className="px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Timer Classification & Location Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Session Activity & Site Mapping
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Customer */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Client / Customer Account
                </label>
                <select
                  value={timerCustomerId}
                  onChange={(e) => {
                    setTimerCustomerId(e.target.value);
                    setTimerJobId("");
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sub-Job */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  QuickBooks Sub-Job (Customer:Job)
                </label>
                <select
                  value={timerJobId}
                  onChange={(e) => setTimerJobId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
                >
                  <option value="">General Project Overhead (No Job)</option>
                  {timerCustJobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Service Item */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                QuickBooks Service Item
              </label>
              <select
                value={timerServiceItemId}
                onChange={(e) => setTimerServiceItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              >
                {serviceItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.defaultBillable ? "Billable" : "Non-Billable"})
                  </option>
                ))}
              </select>
            </div>

            {/* Location Category Pills */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Work Location Type
                </label>
                <button
                  type="button"
                  onClick={handleCaptureGPS}
                  disabled={gpsLoading}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{gpsLoading ? "Acquiring GPS..." : "Stamp GPS Coordinates"}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "on_site", label: "On-Site Client", icon: <MapPin className="w-3.5 h-3.5 text-amber-600" /> },
                  { id: "office", label: "Office", icon: <Building className="w-3.5 h-3.5 text-blue-600" /> },
                  { id: "remote", label: "Remote", icon: <Laptop className="w-3.5 h-3.5 text-emerald-600" /> },
                  { id: "travel", label: "Travel / Transit", icon: <Car className="w-3.5 h-3.5 text-purple-600" /> },
                ].map((loc) => {
                  const active = timerLocationType === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => setTimerLocationType(loc.id as any)}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition ${
                        active
                          ? "bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-2xs"
                          : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
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

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Session Field Notes (Transferred into QuickBooks TIMEACT Note)
              </label>
              <textarea
                rows={2}
                value={timerNotes}
                onChange={(e) => setTimerNotes(e.target.value)}
                placeholder="Observed turbine harmonic frequencies, calibrated bearings, site walk findings..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Manual Time Entry Form */}
      {activeTab === "manual" && (
        <form
          onSubmit={handleManualSubmit}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5"
        >
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">Log Completed Hours</h3>
              <p className="text-xs text-slate-500">Retroactively record engineering time</p>
            </div>
            <Calendar className="w-5 h-5 text-indigo-600" />
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date</label>
              <input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-mono font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              />
            </div>

            {/* Hours */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Hours</label>
              <input
                type="number"
                min="0"
                max="24"
                placeholder="e.g. 3"
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              />
            </div>

            {/* Minutes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Minutes</label>
              <input
                type="number"
                min="0"
                max="59"
                placeholder="e.g. 45"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Customer & Job */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Client / Customer</label>
              <select
                value={manualCustomerId}
                onChange={(e) => {
                  setManualCustomerId(e.target.value);
                  setManualJobId("");
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Sub-Job</label>
              <select
                value={manualJobId}
                onChange={(e) => setManualJobId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              >
                <option value="">General Project Overhead (No Job)</option>
                {manualCustJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Service Item & Billable */}
          <div className="grid sm:grid-cols-2 gap-4 items-center">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Service Item</label>
              <select
                value={manualServiceItemId}
                onChange={(e) => setManualServiceItemId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
              >
                {serviceItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-6 flex items-center gap-3">
              <input
                type="checkbox"
                id="manual-billable"
                checked={manualBillable}
                onChange={(e) => setManualBillable(e.target.checked)}
                className="rounded text-indigo-600 border-slate-300 w-4 h-4 focus:ring-indigo-500"
              />
              <label htmlFor="manual-billable" className="text-xs font-semibold text-slate-800 cursor-pointer">
                Billable to Client (QuickBooks Status: 1)
              </label>
            </div>
          </div>

          {/* Location Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Location Type</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "office", label: "Office", icon: <Building className="w-3.5 h-3.5 text-blue-600" /> },
                { id: "on_site", label: "On-Site Client", icon: <MapPin className="w-3.5 h-3.5 text-amber-600" /> },
                { id: "remote", label: "Remote", icon: <Laptop className="w-3.5 h-3.5 text-emerald-600" /> },
                { id: "travel", label: "Travel / Transit", icon: <Car className="w-3.5 h-3.5 text-purple-600" /> },
              ].map((loc) => {
                const active = manualLocationType === loc.id;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setManualLocationType(loc.id as any)}
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold border transition ${
                      active
                        ? "bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-2xs"
                        : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {loc.icon}
                    <span>{loc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description / Notes</label>
            <textarea
              rows={2}
              value={manualNotes}
              onChange={(e) => setManualNotes(e.target.value)}
              placeholder="Performed structural load calculations, reviewed blueprints with client..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting ? "Logging Timesheet..." : "Add to Timesheet"}
          </button>
        </form>
      )}

      {/* Recent Entries Section for Current Engineer */}
      <div className="mt-8 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Your Recent Timesheet Records</h3>
            <p className="text-xs text-slate-400">Recently logged hours by Doug Mitchell</p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
            {recentEntries.length} entries
          </span>
        </div>

        {recentEntries.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">No time entries logged yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentEntries.slice(0, 6).map((entry) => (
              <div key={entry.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                  <span className="font-mono font-semibold text-slate-800">{entry.date}</span>
                  <div className="font-semibold text-slate-900">
                    {entry.customerName}
                    {entry.jobName && <span className="text-slate-400 font-normal"> :{entry.jobName}</span>}
                  </div>
                  <span className="text-slate-400 hidden sm:inline">•</span>
                  <span className="text-slate-500">{entry.serviceItemName}</span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {formatQuickBooksDuration(entry.durationMinutes)}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      entry.status === "approved"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : entry.status === "exported"
                        ? "bg-purple-50 text-purple-800 border border-purple-200"
                        : "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}
                  >
                    {entry.status}
                  </span>
                  <button
                    onClick={() => handleDeleteEntry(entry.id)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
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
