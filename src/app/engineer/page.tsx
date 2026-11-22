"use client";

import { useState, useEffect } from "react";
import {
  Play, Pause, Square, Clock, MapPin, Building, Car, Laptop,
  PlusCircle, Calendar, Trash2, Navigation, Check, RefreshCw,
  CheckCircle, AlertCircle,
} from "lucide-react";
import { CustomerItem, ServiceItem, TimeEntryItem, UserItem } from "@/db/mock-data";

type LocationType = "office" | "on_site" | "remote" | "travel";

const LOCATION_OPTS: { id: LocationType; label: string; icon: React.ReactNode; badge: string }[] = [
  { id: "on_site",  label: "On-Site",  icon: <MapPin   className="h-3.5 w-3.5" />, badge: "loc-on-site" },
  { id: "office",   label: "Office",   icon: <Building className="h-3.5 w-3.5" />, badge: "loc-office" },
  { id: "remote",   label: "Remote",   icon: <Laptop   className="h-3.5 w-3.5" />, badge: "loc-remote" },
  { id: "travel",   label: "Travel",   icon: <Car      className="h-3.5 w-3.5" />, badge: "loc-travel" },
];

function formatTime(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

export default function EngineerPage() {
  const [activeTab, setActiveTab] = useState<"timer" | "manual">("timer");
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [recentEntries, setRecentEntries] = useState<TimeEntryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("usr_eng_1");

  // Timer
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

  // Manual form
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
        fetch("/api/customers").then(r => r.json()),
        fetch("/api/service-items").then(r => r.json()),
        fetch("/api/users").then(r => r.json()),
        fetch(`/api/time-entries?userId=${currentUserId}`).then(r => r.json()),
      ]);
      if (custRes.success) { setCustomers(custRes.data); if (custRes.data[0] && !timerCustomerId) { setTimerCustomerId(custRes.data[0].id); setManualCustomerId(custRes.data[0].id); } }
      if (srvRes.success) { setServiceItems(srvRes.data); if (srvRes.data[0] && !timerServiceItemId) { setTimerServiceItemId(srvRes.data[0].id); setManualServiceItemId(srvRes.data[0].id); } }
      if (userRes.success) setUsers(userRes.data);
      if (entriesRes.success) setRecentEntries(entriesRes.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [currentUserId]);

  useEffect(() => {
    if (!timerRunning || timerPaused) return;
    const id = setInterval(() => setSecondsElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [timerRunning, timerPaused]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement;
      if (["INPUT","TEXTAREA","SELECT"].includes(tgt.tagName) || tgt.isContentEditable) return;
      if (e.code === "Space") { e.preventDefault(); if (!timerRunning) handleStartTimer(); else if (timerPaused) handleResumeTimer(); else handlePauseTimer(); }
      if (e.key.toLowerCase() === "s" && timerRunning) { e.preventDefault(); handleStopAndSaveTimer(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [timerRunning, timerPaused]);

  const handleStartTimer = () => { setTimerRunning(true); setTimerPaused(false); };
  const handlePauseTimer = () => setTimerPaused(true);
  const handleResumeTimer = () => setTimerPaused(false);
  const handleResetTimer = () => { if (confirm("Reset stopwatch?")) { setTimerRunning(false); setTimerPaused(false); setSecondsElapsed(0); } };

  const handleStopAndSaveTimer = async () => {
    if (secondsElapsed < 10 && !confirm("Timer ran for less than 10 seconds. Save anyway?")) return;
    const durationMinutes = Math.max(1, Math.round(secondsElapsed / 60));
    setIsSubmitting(true);
    try {
      const selectedCust = customers.find(c => c.id === timerCustomerId);
      const selectedSrv = serviceItems.find(s => s.id === timerServiceItemId);
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId, customerId: timerCustomerId, jobId: timerJobId || null,
          serviceItemId: timerServiceItemId, date: new Date().toISOString().split("T")[0],
          durationMinutes, locationType: timerLocationType, locationName: timerLocationName || null,
          latitude: gpsCoordinates?.lat ?? null, longitude: gpsCoordinates?.lng ?? null,
          notes: timerNotes || "Recorded via stopwatch", isBillable: selectedSrv?.defaultBillable ?? true,
          status: "submitted",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg({ type: "success", text: `Logged ${Math.floor(durationMinutes/60)}h ${durationMinutes%60}m · ${selectedCust?.name}` });
        setTimerRunning(false); setTimerPaused(false); setSecondsElapsed(0);
        setTimerNotes(""); setGpsCoordinates(null); fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to save" });
      }
    } catch { setFeedbackMsg({ type: "error", text: "Network error" }); }
    finally { setIsSubmitting(false); }
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsCoordinates({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) });
        setTimerLocationType("on_site");
        if (!timerLocationName) setTimerLocationName(`GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
        setGpsLoading(false);
      },
      err => { alert(`GPS unavailable: ${err.message}`); setGpsLoading(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalMinutes = (Number(manualHours) || 0) * 60 + (Number(manualMinutes) || 0);
    if (totalMinutes <= 0) { setFeedbackMsg({ type: "error", text: "Duration must be greater than 0." }); return; }
    if (!manualCustomerId || !manualServiceItemId) { setFeedbackMsg({ type: "error", text: "Select a customer and service item." }); return; }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/time-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId, customerId: manualCustomerId, jobId: manualJobId || null,
          serviceItemId: manualServiceItemId, date: manualDate, durationMinutes: totalMinutes,
          locationType: manualLocationType, locationName: manualLocationName || null,
          notes: manualNotes, isBillable: manualBillable, status: "submitted",
        }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg({ type: "success", text: `Logged ${Math.floor(totalMinutes/60)}h ${totalMinutes%60}m` });
        setManualHours(""); setManualMinutes(""); setManualNotes(""); setManualLocationName(""); fetchData();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to log" });
      }
    } catch { setFeedbackMsg({ type: "error", text: "Network error" }); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Delete this entry?")) return;
    const res = await fetch(`/api/time-entries/${id}`, { method: "DELETE" });
    if (res.ok) setRecentEntries(prev => prev.filter(e => e.id !== id));
  };

  const timerCustJobs = customers.find(c => c.id === timerCustomerId)?.jobs || [];
  const manualCustJobs = customers.find(c => c.id === manualCustomerId)?.jobs || [];
  const isActive = timerRunning && !timerPaused;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">

      {/* Feedback */}
      {feedbackMsg && (
        <div className={`mb-5 flex items-center justify-between gap-4 rounded-2xl px-4 py-3 text-sm font-medium ${
          feedbackMsg.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800"
            : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
        }`}>
          <div className="flex items-center gap-2">
            {feedbackMsg.type === "success"
              ? <CheckCircle className="h-4 w-4 shrink-0" />
              : <AlertCircle className="h-4 w-4 shrink-0" />}
            {feedbackMsg.text}
          </div>
          <button onClick={() => setFeedbackMsg(null)} className="shrink-0 opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Who is tracking */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <select
            value={currentUserId}
            onChange={e => setCurrentUserId(e.target.value)}
            className="bg-transparent text-sm font-semibold text-foreground focus:outline-none"
          >
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setActiveTab("timer")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "timer" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            Timer
            {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "manual" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Manual
          </button>
        </div>
      </div>

      {/* ══ TIMER TAB ══ */}
      {activeTab === "timer" && (
        <div className="space-y-4">
          {/* Clock display */}
          <div className={`relative overflow-hidden rounded-[32px] transition-all duration-500 p-8 text-center shadow-xl sm:p-12 ${
            isActive ? "bg-gradient-to-b from-primary to-indigo-700"
            : timerPaused ? "bg-gradient-to-b from-amber-500 to-orange-600"
            : "bg-surface-container"
          }`}>
            {isActive && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-72 w-72 rounded-full border-2 border-white/10 pulse-ring" />
                <div className="absolute h-56 w-56 rounded-full border border-white/10 pulse-ring" style={{ animationDelay: "0.5s" }} />
              </div>
            )}

            <p className={`relative mb-1 text-xs font-medium ${timerRunning ? "text-white/60" : "text-muted-foreground"}`}>
              {isActive ? "● Recording" : timerPaused ? "⏸ Paused" : "Ready"}
            </p>

            <div className={`relative select-none font-mono text-[4rem] font-bold leading-none tracking-tighter tabular-nums sm:text-[6rem] ${
              timerRunning ? "text-white" : "text-foreground"
            }`}>
              {formatTime(secondsElapsed)}
            </div>

            {secondsElapsed > 0 && (
              <p className={`relative mt-1 text-sm font-medium ${timerRunning ? "text-white/50" : "text-muted-foreground"}`}>
                {(secondsElapsed / 3600).toFixed(2)} hrs
              </p>
            )}

            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {!timerRunning ? (
                <button
                  onClick={handleStartTimer}
                  className="m3-fab flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold"
                >
                  <Play className="h-5 w-5 fill-current" />
                  Start
                </button>
              ) : timerPaused ? (
                <>
                  <button onClick={handleResumeTimer} className="m3-fab flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold">
                    <Play className="h-4 w-4 fill-current" /> Resume
                  </button>
                  <button onClick={handleStopAndSaveTimer} disabled={isSubmitting}
                    className="m3-fab-green flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-50">
                    <Square className="h-4 w-4 fill-current" />
                    {isSubmitting ? "Saving…" : "Save"}
                  </button>
                  <button onClick={handleResetTimer} className="rounded-full border border-border bg-card/80 px-4 py-3 text-xs font-semibold text-muted-foreground hover:bg-card transition">
                    Reset
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handlePauseTimer}
                    className="flex items-center gap-2 rounded-full border-2 border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur hover:bg-white/20 transition">
                    <Pause className="h-4 w-4 fill-current" /> Pause
                  </button>
                  <button onClick={handleStopAndSaveTimer} disabled={isSubmitting}
                    className="m3-fab-green flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">
                    <Square className="h-4 w-4 fill-current" />
                    {isSubmitting ? "Saving…" : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Session fields */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer">
                <select value={timerCustomerId} onChange={e => { setTimerCustomerId(e.target.value); setTimerJobId(""); }} className={sel}>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Job">
                <select value={timerJobId} onChange={e => setTimerJobId(e.target.value)} className={sel}>
                  <option value="">— None —</option>
                  {timerCustJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Service">
              <select value={timerServiceItemId} onChange={e => setTimerServiceItemId(e.target.value)} className={sel}>
                {serviceItems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>

            {/* Location */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Location</span>
                <button onClick={handleCaptureGPS} disabled={gpsLoading}
                  className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
                  <Navigation className="h-3 w-3" />
                  {gpsLoading ? "…" : "GPS"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {LOCATION_OPTS.map(loc => (
                  <button key={loc.id} type="button" onClick={() => setTimerLocationType(loc.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                      timerLocationType === loc.id
                        ? `${loc.badge} border-transparent shadow-sm`
                        : "border-border bg-card text-muted-foreground hover:bg-muted"
                    }`}>
                    {loc.icon} {loc.label}
                    {timerLocationType === loc.id && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                ))}
              </div>
              {gpsCoordinates && (
                <p className="mt-1.5 text-[11px] font-mono text-green-700 dark:text-green-400">
                  ✓ {gpsCoordinates.lat}, {gpsCoordinates.lng}
                </p>
              )}
            </div>

            <Field label="Notes">
              <textarea rows={2} value={timerNotes} onChange={e => setTimerNotes(e.target.value)}
                placeholder="Site notes…" className={area} />
            </Field>
          </div>
        </div>
      )}

      {/* ══ MANUAL TAB ══ */}
      {activeTab === "manual" && (
        <form onSubmit={handleManualSubmit} className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date">
              <input type="date" required value={manualDate} onChange={e => setManualDate(e.target.value)} className={inp} />
            </Field>
            <Field label="Hours">
              <input type="number" min="0" max="24" placeholder="0" value={manualHours}
                onChange={e => setManualHours(e.target.value === "" ? "" : Number(e.target.value))} className={inp} />
            </Field>
            <Field label="Minutes">
              <input type="number" min="0" max="59" step="5" placeholder="0" value={manualMinutes}
                onChange={e => setManualMinutes(e.target.value === "" ? "" : Number(e.target.value))} className={inp} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer">
              <select value={manualCustomerId} onChange={e => { setManualCustomerId(e.target.value); setManualJobId(""); }} className={sel}>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Job">
              <select value={manualJobId} onChange={e => setManualJobId(e.target.value)} className={sel}>
                <option value="">— None —</option>
                {manualCustJobs.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Service">
            <select value={manualServiceItemId}
              onChange={e => { setManualServiceItemId(e.target.value); const s = serviceItems.find(x => x.id === e.target.value); if (s) setManualBillable(s.defaultBillable); }}
              className={sel}>
              {serviceItems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          {/* Location */}
          <div>
            <span className="mb-2 block text-xs font-medium text-muted-foreground">Location</span>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_OPTS.map(loc => (
                <button key={loc.id} type="button" onClick={() => setManualLocationType(loc.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ${
                    manualLocationType === loc.id
                      ? `${loc.badge} border-transparent shadow-sm`
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  }`}>
                  {loc.icon} {loc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Billable toggle */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-2.5">
            <input type="checkbox" checked={manualBillable} onChange={e => setManualBillable(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus:ring-primary" />
            <span className="text-sm font-medium text-foreground">Billable</span>
            {manualBillable && (
              <span className="ml-auto rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300">
                ✓
              </span>
            )}
          </label>

          <Field label="Notes">
            <textarea rows={2} value={manualNotes} onChange={e => setManualNotes(e.target.value)}
              placeholder="Description…" className={area} />
          </Field>

          <button type="submit" disabled={isSubmitting}
            className="m3-fab-green w-full rounded-2xl py-3.5 text-sm font-bold disabled:opacity-50">
            {isSubmitting ? "Saving…" : "Add to Timesheet"}
          </button>
        </form>
      )}

      {/* ══ RECENT ENTRIES ══ */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Recent</span>
          <button onClick={fetchData} className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : recentEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-12 text-center">
            <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No entries yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentEntries.slice(0, 8).map(entry => {
              const h = Math.floor(entry.durationMinutes / 60);
              const m = entry.durationMinutes % 60;
              const locOpt = LOCATION_OPTS.find(l => l.id === entry.locationType);
              return (
                <div key={entry.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md">
                  {/* Duration bubble */}
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <span className="font-mono text-xs font-bold leading-none">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}</span>
                    <span className="text-[8px] font-semibold uppercase tracking-wide opacity-60">hrs</span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-semibold text-sm text-foreground truncate">{entry.customerName}</span>
                      {entry.jobName && <span className="text-xs text-muted-foreground">· {entry.jobName}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{entry.date}</span>
                      <span>·</span>
                      <span>{entry.serviceItemName}</span>
                      {locOpt && (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${locOpt.badge}`}>
                          {locOpt.label}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                      entry.status === "approved" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                      : entry.status === "exported" ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                    }`}>
                      {entry.status}
                    </span>
                    <button onClick={() => handleDeleteEntry(entry.id)}
                      className="rounded-full p-1.5 text-muted-foreground transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40">
                      <Trash2 className="h-3.5 w-3.5" />
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

// ── Shared style strings ──
const inp = "mt-1 block w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
const sel = "mt-1 block w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-colors";
const area = "mt-1 block w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
