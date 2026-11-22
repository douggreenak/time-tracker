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
} from "lucide-react";
import { CustomerItem, ServiceItem, TimeEntryItem, UserItem } from "@/db/mock-data";

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
  const [timerStartTime, setTimerStartTime] = useState<number | null>(null);

  // Timer Form Selection
  const [timerCustomerId, setTimerCustomerId] = useState("");
  const [timerJobId, setTimerJobId] = useState("");
  const [timerServiceItemId, setTimerServiceItemId] = useState("");
  const [timerLocationType, setTimerLocationType] = useState<"office" | "on_site" | "remote" | "travel">("office");
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
        if (custRes.data.length > 0) {
          setTimerCustomerId(custRes.data[0].id);
          setManualCustomerId(custRes.data[0].id);
        }
      }
      if (srvRes.success) {
        setServiceItems(srvRes.data);
        if (srvRes.data.length > 0) {
          setTimerServiceItemId(srvRes.data[0].id);
          setManualServiceItemId(srvRes.data[0].id);
        }
      }
      if (userRes.success) {
        setUsers(userRes.data);
      }
      if (entriesRes.success) {
        setRecentEntries(entriesRes.data);
      }
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
    setTimerStartTime(Date.now() - secondsElapsed * 1000);
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
          notes: timerNotes || "Logged via Live Timer",
          isBillable: selectedSrv?.defaultBillable ?? true,
          status: "submitted",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg({ type: "success", text: `Saved ${durationMinutes} minutes for ${selectedCust?.name}!` });
        // Reset timer
        setTimerRunning(false);
        setTimerPaused(false);
        setSecondsElapsed(0);
        setTimerStartTime(null);
        setTimerNotes("");
        setGpsCoordinates(null);
        // Refresh entry list
        fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to save timer" });
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Network error saving timer" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetTimer = () => {
    if (confirm("Reset current timer back to 00:00:00?")) {
      setTimerRunning(false);
      setTimerPaused(false);
      setSecondsElapsed(0);
      setTimerStartTime(null);
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
          setTimerLocationName(`GPS Site (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        }
        setGpsLoading(false);
      },
      (err) => {
        alert(`Location access denied or unavailable: ${err.message}`);
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
        setFeedbackMsg({ type: "success", text: `Successfully logged ${hrs}h ${mins}m!` });
        // Clear manual inputs
        setManualHours("");
        setManualMinutes("");
        setManualNotes("");
        setManualLocationName("");
        fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to log entry" });
      }
    } catch (err) {
      setFeedbackMsg({ type: "error", text: "Error submitting time entry" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete an entry
  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Are you sure you want to delete this time entry?")) return;
    try {
      const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
      if (res.ok) {
        setRecentEntries((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // Current selected customer's jobs
  const timerCustJobs = customers.find((c) => c.id === timerCustomerId)?.jobs || [];
  const manualCustJobs = customers.find((c) => c.id === manualCustomerId)?.jobs || [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Top Banner & Engineer Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Engineer Time Tracker
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Track live on-site hours or enter past project timesheets.
          </p>
        </div>

        {/* Engineer Profile Switcher */}
        <div className="flex items-center gap-2">
          <label htmlFor="user-select" className="text-xs font-semibold text-slate-500">Engineer:</label>
          <select
            id="user-select"
            value={currentUserId}
            onChange={(e) => setCurrentUserId(e.target.value)}
            className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert / Feedback message */}
      {feedbackMsg && (
        <div
          className={`mb-6 p-3.5 rounded-xl text-sm font-medium flex items-center justify-between shadow-sm ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Selector: Live Stopwatch vs Manual Form */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl mb-6 shadow-inner">
        <button
          onClick={() => setActiveTab("timer")}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition ${
            activeTab === "timer"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Live Stopwatch Timer</span>
          {timerRunning && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("manual")}
          className={`flex-1 py-2.5 text-xs sm:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition ${
            activeTab === "manual"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <PlusCircle className="w-4 h-4 text-indigo-600" />
          <span>Manual Entry Mode</span>
        </button>
      </div>

      {/* TAB 1: LIVE STOPWATCH TIMER */}
      {activeTab === "timer" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-8">
          {/* Big Digital Display */}
          <div className="text-center py-6 border-b border-slate-100">
            <div className="font-mono text-5xl sm:text-7xl font-extrabold tracking-tight text-slate-900 select-none">
              {formatTime(secondsElapsed)}
            </div>
            <div className="mt-2 flex items-center justify-center gap-2 text-xs font-semibold">
              {timerRunning ? (
                timerPaused ? (
                  <span className="text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                    PAUSED
                  </span>
                ) : (
                  <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                    LOGGING LIVE TIME
                  </span>
                )
              ) : (
                <span className="text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  STOPPED
                </span>
              )}
            </div>
          </div>

          {/* Timer Controls Buttons */}
          <div className="py-6 flex flex-wrap items-center justify-center gap-3 border-b border-slate-100">
            {!timerRunning ? (
              <button
                onClick={handleStartTimer}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Start Timer</span>
              </button>
            ) : (
              <>
                {timerPaused ? (
                  <button
                    onClick={handleResumeTimer}
                    className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    onClick={handlePauseTimer}
                    className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  onClick={handleStopAndSaveTimer}
                  disabled={isSubmitting}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <Square className="w-4 h-4 fill-current text-rose-500" />
                  <span>{isSubmitting ? "Saving..." : "Stop & Save Entry"}</span>
                </button>

                <button
                  onClick={handleResetTimer}
                  className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                  title="Reset to 0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>

          {/* Pre-fill Details for Current Timer Session */}
          <div className="pt-6 grid sm:grid-cols-2 gap-4">
            {/* Customer Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Customer *
              </label>
              <select
                value={timerCustomerId}
                onChange={(e) => {
                  setTimerCustomerId(e.target.value);
                  setTimerJobId("");
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-Job Dropdown */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sub-Job / Phase (Optional)
              </label>
              <select
                value={timerJobId}
                onChange={(e) => setTimerJobId(e.target.value)}
                disabled={timerCustJobs.length === 0}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition"
              >
                <option value="">-- No Sub-Job (General Customer) --</option>
                {timerCustJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Item */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Service Item (QuickBooks) *
              </label>
              <select
                value={timerServiceItemId}
                onChange={(e) => setTimerServiceItemId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              >
                {serviceItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.defaultBillable ? "Billable" : "Non-billable"})
                  </option>
                ))}
              </select>
            </div>

            {/* Location Category & GPS Capture */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Location Type
                </label>
                <button
                  type="button"
                  onClick={handleCaptureGPS}
                  disabled={gpsLoading}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition"
                >
                  <Navigation className="w-3 h-3 text-emerald-600" />
                  <span>{gpsLoading ? "Acquiring..." : "Get GPS"}</span>
                </button>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "office", label: "Office", icon: Building },
                  { id: "on_site", label: "On-Site", icon: MapPin },
                  { id: "remote", label: "Remote", icon: Laptop },
                  { id: "travel", label: "Travel", icon: Car },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTimerLocationType(id as any)}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center justify-center gap-1 border transition ${
                      timerLocationType === id
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Location Name / Address */}
            <div className="sm:col-span-2">
              <input
                type="text"
                placeholder="Specific Site Address / Office Room / Facility Area (optional)"
                value={timerLocationName}
                onChange={(e) => setTimerLocationName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Activity Notes / Work Performed
              </label>
              <textarea
                rows={2}
                placeholder="Describe engineering tasks performed for the QuickBooks invoice/timesheet..."
                value={timerNotes}
                onChange={(e) => setTimerNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MANUAL TIME ENTRY FORM */}
      {activeTab === "manual" && (
        <form
          onSubmit={handleManualSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 mb-8"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Work Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Duration (Hours & Minutes) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Duration (Hours & Minutes) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="24"
                    placeholder="Hours"
                    value={manualHours}
                    onChange={(e) => setManualHours(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">hrs</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    placeholder="Mins"
                    value={manualMinutes}
                    onChange={(e) => setManualMinutes(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">min</span>
                </div>
              </div>
            </div>

            {/* Customer */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Customer *
              </label>
              <select
                value={manualCustomerId}
                onChange={(e) => {
                  setManualCustomerId(e.target.value);
                  setManualJobId("");
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Job / Project */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Sub-Job / Phase
              </label>
              <select
                value={manualJobId}
                onChange={(e) => setManualJobId(e.target.value)}
                disabled={manualCustJobs.length === 0}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">-- No Sub-Job (General Customer) --</option>
                {manualCustJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Service Item */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Service Item (QuickBooks) *
              </label>
              <select
                value={manualServiceItemId}
                onChange={(e) => {
                  setManualServiceItemId(e.target.value);
                  const s = serviceItems.find((item) => item.id === e.target.value);
                  if (s) setManualBillable(s.defaultBillable);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {serviceItems.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Location
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: "office", label: "Office", icon: Building },
                  { id: "on_site", label: "On-Site", icon: MapPin },
                  { id: "remote", label: "Remote", icon: Laptop },
                  { id: "travel", label: "Travel", icon: Car },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setManualLocationType(id as any)}
                    className={`py-2 px-1 text-xs font-semibold rounded-lg flex flex-col items-center justify-center gap-1 border transition ${
                      manualLocationType === id
                        ? "bg-indigo-50 border-indigo-500 text-indigo-800"
                        : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Location Detail & Billable Toggle */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Location Details (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Field Substation 3, Room 102"
                value={manualLocationName}
                onChange={(e) => setManualLocationName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={manualBillable}
                  onChange={(e) => setManualBillable(e.target.checked)}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">Billable to Customer</span>
                  <p className="text-xs text-slate-500">Includes in QuickBooks billing invoice</p>
                </div>
              </label>
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Work Description / Notes
              </label>
              <textarea
                rows={3}
                placeholder="Describe what was accomplished for accounting and project audit..."
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{isSubmitting ? "Logging Entry..." : "Submit Time Entry"}</span>
            </button>
          </div>
        </form>
      )}

      {/* RECENT ENTRIES LIST */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Recent Logged Entries</span>
            <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
              {recentEntries.length}
            </span>
          </h2>
          <button
            onClick={fetchData}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-slate-400">Loading entries...</div>
        ) : recentEntries.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            No time entries recorded yet. Start the stopwatch timer or add a manual entry above.
          </div>
        ) : (
          <div className="space-y-3">
            {recentEntries.map((entry) => {
              const hrs = Math.floor(entry.durationMinutes / 60);
              const mins = entry.durationMinutes % 60;

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{entry.customerName}</span>
                      {entry.jobName && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {entry.jobName}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          entry.locationType === "on_site"
                            ? "bg-amber-100 text-amber-800"
                            : entry.locationType === "office"
                            ? "bg-blue-100 text-blue-800"
                            : entry.locationType === "travel"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {entry.locationType.replace("_", " ")}
                      </span>
                      {entry.isBillable ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Billable
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                          Non-billable
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-3">
                      <span>{entry.date}</span>
                      <span>•</span>
                      <span>{entry.serviceItemName}</span>
                      {entry.locationName && (
                        <>
                          <span>•</span>
                          <span className="italic">{entry.locationName}</span>
                        </>
                      )}
                    </div>

                    {entry.notes && (
                      <p className="text-xs text-slate-600 pt-1 leading-relaxed">{entry.notes}</p>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 gap-2 shrink-0">
                    <div className="text-base font-extrabold text-slate-900 font-mono">
                      {hrs > 0 ? `${hrs}h ` : ""}
                      {mins}m
                    </div>
                    <button
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="text-slate-400 hover:text-red-600 transition p-1"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
