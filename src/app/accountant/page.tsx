"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Download, FileSpreadsheet, Calendar, DollarSign, Clock,
  Briefcase, Building, MapPin, RefreshCw, Search,
  Layers, Users, ArrowUpDown, Car, Laptop, Check, CheckCircle2, CheckSquare,
} from "lucide-react";
import { CustomerItem, ServiceItem, TimeEntryItem, UserItem } from "@/db/mock-data";
import { formatQuickBooksDuration } from "@/lib/quickbooks";
import { cn } from "@/components/ui";

type PeriodPreset =
  | "today" | "yesterday" | "this_week" | "last_week"
  | "this_month" | "last_month" | "this_quarter" | "ytd" | "all" | "custom";

type ViewMode = "table" | "customer_summary" | "staff_summary";

const PERIODS: { id: PeriodPreset; label: string }[] = [
  { id: "today",        label: "Today" },
  { id: "this_week",    label: "This week" },
  { id: "last_week",    label: "Last week" },
  { id: "this_month",   label: "This month" },
  { id: "last_month",   label: "Last month" },
  { id: "this_quarter", label: "Quarter" },
  { id: "ytd",          label: "YTD" },
  { id: "all",          label: "All" },
  { id: "custom",       label: "Custom" },
];

export default function AccountantPage() {
  const [entries,      setEntries]      = useState<TimeEntryItem[]>([]);
  const [customers,    setCustomers]    = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users,        setUsers]        = useState<UserItem[]>([]);
  const [loading,      setLoading]      = useState(true);

  const [period,          setPeriod]          = useState<PeriodPreset>("this_week");
  const [customStartDate, setCustomStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().split("T")[0]; });
  const [customEndDate,   setCustomEndDate]   = useState(() => new Date().toISOString().split("T")[0]);

  const [filterCustomer, setFilterCustomer] = useState("all");
  const [filterUser,     setFilterUser]     = useState("all");
  const [filterBillable, setFilterBillable] = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [searchQuery,    setSearchQuery]    = useState("");

  const [viewMode,         setViewMode]         = useState<ViewMode>("table");
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [successMsg,       setSuccessMsg]       = useState<string | null>(null);
  const [sortField,        setSortField]        = useState<"date" | "durationMinutes" | "userName" | "customerName">("date");
  const [sortAsc,          setSortAsc]          = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custRes, srvRes, userRes, entriesRes] = await Promise.all([
        fetch("/api/customers").then(r => r.json()),
        fetch("/api/service-items").then(r => r.json()),
        fetch("/api/users").then(r => r.json()),
        fetch("/api/time-entries").then(r => r.json()),
      ]);
      if (custRes.success)    setCustomers(custRes.data);
      if (srvRes.success)     setServiceItems(srvRes.data);
      if (userRes.success)    setUsers(userRes.data);
      if (entriesRes.success) setEntries(entriesRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const dateRangeBounds = useMemo(() => {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fmt   = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

    switch (period) {
      case "today":        { const s = fmt(today); return { start: s, end: s, label: "Today" }; }
      case "yesterday":    { const y = new Date(today); y.setDate(y.getDate()-1); const s = fmt(y); return { start: s, end: s, label: "Yesterday" }; }
      case "this_week":    { const d = new Date(today); const diff = d.getDate()-d.getDay()+(d.getDay()===0?-6:1); const mon = new Date(d.setDate(diff)); const sun = new Date(mon); sun.setDate(mon.getDate()+6); return { start: fmt(mon), end: fmt(sun), label: "This week" }; }
      case "last_week":    { const d = new Date(today); const diff = d.getDate()-d.getDay()+(d.getDay()===0?-6:1)-7; const mon = new Date(d.setDate(diff)); const sun = new Date(mon); sun.setDate(mon.getDate()+6); return { start: fmt(mon), end: fmt(sun), label: "Last week" }; }
      case "this_month":   { const f = new Date(today.getFullYear(),today.getMonth(),1); const l = new Date(today.getFullYear(),today.getMonth()+1,0); return { start: fmt(f), end: fmt(l), label: "This month" }; }
      case "last_month":   { const f = new Date(today.getFullYear(),today.getMonth()-1,1); const l = new Date(today.getFullYear(),today.getMonth(),0); return { start: fmt(f), end: fmt(l), label: "Last month" }; }
      case "this_quarter": { const q = Math.floor(today.getMonth()/3); const f = new Date(today.getFullYear(),q*3,1); const l = new Date(today.getFullYear(),(q+1)*3,0); return { start: fmt(f), end: fmt(l), label: `Q${q+1}` }; }
      case "ytd":          { const f = new Date(today.getFullYear(),0,1); return { start: fmt(f), end: fmt(today), label: "YTD" }; }
      case "custom":       return { start: customStartDate, end: customEndDate, label: "Custom" };
      default:             return { start: null, end: null, label: "All time" };
    }
  }, [period, customStartDate, customEndDate]);

  const userRateMap = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach(u => map.set(u.id, u.defaultHourlyRate || 145.0));
    return map;
  }, [users]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter(e => {
        if (dateRangeBounds.start && e.date < dateRangeBounds.start) return false;
        if (dateRangeBounds.end   && e.date > dateRangeBounds.end)   return false;
        if (filterCustomer !== "all" && e.customerId !== filterCustomer) return false;
        if (filterUser     !== "all" && e.userId     !== filterUser)     return false;
        if (filterBillable === "billable"     && !e.isBillable) return false;
        if (filterBillable === "non_billable" &&  e.isBillable) return false;
        if (filterStatus   !== "all" && e.status !== filterStatus) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (![e.customerName, e.jobName||"", e.userName, e.serviceItemName, e.notes||"", e.locationName||""].some(x => x.toLowerCase().includes(q))) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "date")            cmp = a.date.localeCompare(b.date);
        if (sortField === "durationMinutes") cmp = a.durationMinutes - b.durationMinutes;
        if (sortField === "userName")        cmp = a.userName.localeCompare(b.userName);
        if (sortField === "customerName")    cmp = a.customerName.localeCompare(b.customerName);
        return sortAsc ? cmp : -cmp;
      });
  }, [entries, dateRangeBounds, filterCustomer, filterUser, filterBillable, filterStatus, searchQuery, sortField, sortAsc]);

  const metrics = useMemo(() => {
    let totalMins = 0, billableMins = 0, revenue = 0;
    const custSet = new Set<string>(), jobSet = new Set<string>();
    filteredEntries.forEach(e => {
      totalMins += e.durationMinutes;
      const hours = e.durationMinutes / 60;
      if (e.isBillable) { billableMins += e.durationMinutes; revenue += hours * (userRateMap.get(e.userId)||145); }
      custSet.add(e.customerId);
      if (e.jobId) jobSet.add(e.jobId);
    });
    return {
      totalHours:    totalMins / 60,
      billableHours: billableMins / 60,
      realizationPct: totalMins > 0 ? (billableMins / totalMins) * 100 : 0,
      revenue,
      customerCount: custSet.size,
      jobCount:      jobSet.size,
    };
  }, [filteredEntries, userRateMap]);

  const customerBreakdown = useMemo(() => {
    const map = new Map<string, { customerId: string; customerName: string; totalMinutes: number; billableMinutes: number; revenue: number; jobs: Map<string,{jobName:string;minutes:number}> }>();
    filteredEntries.forEach(e => {
      let it = map.get(e.customerId);
      if (!it) { it = { customerId: e.customerId, customerName: e.customerName, totalMinutes: 0, billableMinutes: 0, revenue: 0, jobs: new Map() }; map.set(e.customerId, it); }
      it.totalMinutes += e.durationMinutes;
      if (e.isBillable) { it.billableMinutes += e.durationMinutes; it.revenue += (e.durationMinutes/60)*(userRateMap.get(e.userId)||145); }
      const jk = e.jobId||"general"; const jn = e.jobName||"General"; const ej = it.jobs.get(jk); if (ej) ej.minutes += e.durationMinutes; else it.jobs.set(jk,{jobName:jn,minutes:e.durationMinutes});
    });
    return Array.from(map.values()).sort((a,b) => b.totalMinutes - a.totalMinutes);
  }, [filteredEntries, userRateMap]);

  const staffBreakdown = useMemo(() => {
    const map = new Map<string,{userId:string;userName:string;totalMinutes:number;billableMinutes:number;revenue:number;entriesCount:number}>();
    filteredEntries.forEach(e => {
      let it = map.get(e.userId);
      if (!it) { it = {userId:e.userId, userName:e.userName, totalMinutes:0, billableMinutes:0, revenue:0, entriesCount:0}; map.set(e.userId,it); }
      it.totalMinutes += e.durationMinutes; it.entriesCount++;
      if (e.isBillable) { it.billableMinutes += e.durationMinutes; it.revenue += (e.durationMinutes/60)*(userRateMap.get(e.userId)||145); }
    });
    return Array.from(map.values()).sort((a,b) => b.totalMinutes - a.totalMinutes);
  }, [filteredEntries, userRateMap]);

  const allSelected = filteredEntries.length > 0 && selectedEntryIds.size === filteredEntries.length;
  const toggleSelectAll = () => setSelectedEntryIds(allSelected ? new Set() : new Set(filteredEntries.map(e => e.id)));
  const toggleSelectEntry = (id: string) => { const n = new Set(selectedEntryIds); n.has(id) ? n.delete(id) : n.add(id); setSelectedEntryIds(n); };

  const handleUpdateStatus = async (status: "draft"|"submitted"|"approved"|"exported", targetIds?: string[]) => {
    const ids = targetIds || Array.from(selectedEntryIds);
    if (!ids.length) return;
    await Promise.all(ids.map(id => fetch(`/api/time-entries/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({status}) })));
    setEntries(prev => prev.map(e => ids.includes(e.id) ? {...e, status} : e));
    if (!targetIds) setSelectedEntryIds(new Set());
    setSuccessMsg(`Updated ${ids.length} record${ids.length>1?"s":""} → ${status}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const buildParams = () => {
    const p = new URLSearchParams();
    if (dateRangeBounds.start) p.set("startDate", dateRangeBounds.start);
    if (dateRangeBounds.end)   p.set("endDate",   dateRangeBounds.end);
    if (filterCustomer !== "all") p.set("customerId", filterCustomer);
    if (filterUser     !== "all") p.set("userId",     filterUser);
    if (filterStatus   !== "all") p.set("status",     filterStatus);
    return p.toString();
  };

  const toggleSort = (f: typeof sortField) => { if (sortField===f) setSortAsc(!sortAsc); else { setSortField(f); setSortAsc(true); } };
  const hasFilters = filterCustomer !== "all" || filterUser !== "all" || filterBillable !== "all" || filterStatus !== "all" || !!searchQuery;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ── Header ── */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Timesheets</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{dateRangeBounds.label} · {filteredEntries.length} entries</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={() => window.location.href=`/api/export/iif?${buildParams()}`}
            className="m3-fab flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
            <FileSpreadsheet className="h-4 w-4" />
            QuickBooks IIF
          </button>
          <button onClick={() => window.location.href=`/api/export/csv?${buildParams()}`}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted transition">
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button onClick={loadData}
            className="flex items-center justify-center rounded-full border border-border bg-card p-2.5 text-muted-foreground hover:text-foreground transition">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total Hours",  value: `${metrics.totalHours.toFixed(1)}h`,   icon: <Clock className="h-4 w-4" />,      sub: dateRangeBounds.label },
          { label: "Billable",     value: `${metrics.billableHours.toFixed(1)}h`, icon: null,                               sub: `${metrics.realizationPct.toFixed(0)}% utilization`, bar: metrics.realizationPct },
          { label: "Revenue",      value: `$${metrics.revenue.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}`, icon: <DollarSign className="h-4 w-4" />, sub: "est. billable" },
          { label: "Clients",      value: String(metrics.customerCount),          icon: <Briefcase className="h-4 w-4" />, sub: `${metrics.jobCount} jobs` },
        ].map(card => (
          <div key={card.label} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              {card.icon && <span className="text-primary">{card.icon}</span>}
            </div>
            <div className="text-2xl font-bold text-foreground sm:text-3xl">{card.value}</div>
            {"bar" in card && card.bar !== undefined && (
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, card.bar)}%` }} />
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Period Selector ── */}
      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-full border border-border bg-card p-1">
        {PERIODS.map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)}
            className={cn("rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
              period === p.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}>
            {p.label}
          </button>
        ))}
      </div>

      {period === "custom" && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-5 py-3">
          <span className="text-xs text-muted-foreground">From</span>
          <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
          <span className="text-xs text-muted-foreground">to</span>
          <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
      )}

      {/* ── Filters + View Mode ── */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        {/* View mode */}
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {([
            { id: "table",            label: "Table", icon: <CheckSquare className="h-3.5 w-3.5" /> },
            { id: "customer_summary", label: "By Client", icon: <Layers className="h-3.5 w-3.5" /> },
            { id: "staff_summary",    label: "By Staff", icon: <Users className="h-3.5 w-3.5" /> },
          ] as { id: ViewMode; label: string; icon: React.ReactNode }[]).map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)}
              className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                viewMode === v.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              {v.icon} {v.label}
              {v.id === "table" && <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px] font-mono">{filteredEntries.length}</span>}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input id="accountant-search-input" type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search…" className="w-full rounded-full border border-border bg-background pl-9 pr-4 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>

          {/* Dropdowns */}
          {[
            { value: filterCustomer, onChange: setFilterCustomer, options: [["all","All clients"], ...customers.map(c => [c.id, c.name])] as [string,string][] },
            { value: filterUser,     onChange: setFilterUser,     options: [["all","All staff"],   ...users.map(u => [u.id, u.name])] as [string,string][] },
            { value: filterBillable, onChange: setFilterBillable, options: [["all","Billable & non"], ["billable","Billable only"], ["non_billable","Non-billable"]] as [string,string][] },
            { value: filterStatus,   onChange: setFilterStatus,   options: [["all","All statuses"], ["draft","Draft"], ["submitted","Submitted"], ["approved","Approved"], ["exported","Exported"]] as [string,string][] },
          ].map((f, i) => (
            <select key={i} value={f.value} onChange={e => f.onChange(e.target.value)}
              className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer">
              {f.options.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          ))}

          {hasFilters && (
            <button onClick={() => { setFilterCustomer("all"); setFilterUser("all"); setFilterBillable("all"); setFilterStatus("all"); setSearchQuery(""); }}
              className="rounded-full text-xs font-semibold text-primary hover:underline px-2">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Success Banner ── */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMsg}
        </div>
      )}

      {/* ── Batch Action Bar ── */}
      {selectedEntryIds.size > 0 && viewMode === "table" && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg">
          <span className="text-xs font-bold">{selectedEntryIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handleUpdateStatus("approved")}
              className="flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/30 transition">
              <Check className="h-3.5 w-3.5" /> Approve
            </button>
            <button onClick={() => handleUpdateStatus("exported")}
              className="flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/30 transition">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Mark Exported
            </button>
            <button onClick={() => setSelectedEntryIds(new Set())}
              className="rounded-full px-2.5 py-1.5 text-xs text-primary-foreground/60 hover:text-white transition">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="select-none border-b border-border/60 bg-muted/50 text-[11px] font-medium text-muted-foreground">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded text-primary border-input" />
                  </th>
                  {[
                    { label: "Date",     field: "date" as const },
                    { label: "Staff",    field: "userName" as const },
                    { label: "Client / Job", field: "customerName" as const },
                  ].map(col => (
                    <th key={col.field} onClick={() => toggleSort(col.field)} className="cursor-pointer py-3 px-3 hover:text-foreground">
                      <div className="flex items-center gap-1">{col.label} <ArrowUpDown className="h-3 w-3" /></div>
                    </th>
                  ))}
                  <th className="py-3 px-3">Service</th>
                  <th className="py-3 px-3">Location</th>
                  <th onClick={() => toggleSort("durationMinutes")} className="cursor-pointer py-3 px-3 text-right hover:text-foreground">
                    <div className="flex items-center justify-end gap-1">Duration <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="py-3 px-3 text-center">Bill</th>
                  <th className="py-3 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {loading ? (
                  <tr><td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">Loading…</td></tr>
                ) : filteredEntries.length === 0 ? (
                  <tr><td colSpan={9} className="py-16 text-center text-sm text-muted-foreground">No entries for this period</td></tr>
                ) : filteredEntries.map(e => {
                  const checked = selectedEntryIds.has(e.id);
                  const locIcon = e.locationType === "on_site" ? <MapPin className="h-3 w-3" />
                    : e.locationType === "office" ? <Building className="h-3 w-3" />
                    : e.locationType === "remote" ? <Laptop className="h-3 w-3" />
                    : <Car className="h-3 w-3" />;
                  const locCls = e.locationType === "on_site"  ? "bg-tertiary-container/60 text-tertiary-on-container"
                    : e.locationType === "office" ? "bg-primary-container text-primary-on-container"
                    : e.locationType === "remote" ? "bg-secondary-container text-secondary-on-container"
                    : "bg-muted text-muted-foreground";
                  return (
                    <tr key={e.id} className={cn("transition-colors", checked ? "bg-primary/[0.06]" : "hover:bg-muted/30")}>
                      <td className="py-3 px-4">
                        <input type="checkbox" checked={checked} onChange={() => toggleSelectEntry(e.id)} className="rounded text-primary border-input" />
                      </td>
                      <td className="py-3 px-3 font-mono text-foreground whitespace-nowrap">{e.date}</td>
                      <td className="py-3 px-3 font-semibold text-foreground whitespace-nowrap">{e.userName}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-foreground">{e.customerName}</div>
                        {e.jobName && <div className="text-[11px] text-muted-foreground">· {e.jobName}</div>}
                      </td>
                      <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">{e.serviceItemName}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", locCls)}>
                          {locIcon} <span className="capitalize">{e.locationType.replace("_"," ")}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                        {formatQuickBooksDuration(e.durationMinutes)}
                        <span className="ml-1 text-[10px] text-muted-foreground">({(e.durationMinutes/60).toFixed(2)}h)</span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {e.isBillable
                          ? <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">Yes</span>
                          : <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">No</span>}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <select value={e.status}
                          onChange={ev => handleUpdateStatus(ev.target.value as "draft"|"submitted"|"approved"|"exported", [e.id])}
                          className={cn("cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/25 transition-colors",
                            e.status === "approved" ? "border-transparent bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : e.status === "exported" ? "border-transparent bg-primary/10 text-primary"
                            : "border-transparent bg-muted text-foreground"
                          )}>
                          <option value="draft">Draft</option>
                          <option value="submitted">Submitted</option>
                          <option value="approved">Approved</option>
                          <option value="exported">Exported</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CUSTOMER SUMMARY ── */}
      {viewMode === "customer_summary" && (
        <div className="grid gap-4 md:grid-cols-2">
          {customerBreakdown.map(cust => {
            const hours = cust.totalMinutes / 60;
            const billPct = cust.totalMinutes > 0 ? (cust.billableMinutes / cust.totalMinutes) * 100 : 0;
            const jobs = Array.from(cust.jobs.values());
            return (
              <div key={cust.customerId} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{cust.customerName}</h3>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-mono font-bold text-primary">
                    ${cust.revenue.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}
                  </span>
                </div>
                <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{hours.toFixed(1)}h</span>
                  <span>·</span>
                  <span>{billPct.toFixed(0)}% billable</span>
                </div>
                <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100,billPct)}%` }} />
                </div>
                <div className="space-y-1.5 border-t border-border/40 pt-3">
                  {jobs.map((j,i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate max-w-[200px]">{j.jobName}</span>
                      <span className="font-mono font-semibold text-foreground">{(j.minutes/60).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {customerBreakdown.length === 0 && (
            <div className="col-span-2 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No data</div>
          )}
        </div>
      )}

      {/* ── STAFF SUMMARY ── */}
      {viewMode === "staff_summary" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staffBreakdown.map(s => {
            const hours = s.totalMinutes / 60;
            const billH = s.billableMinutes / 60;
            const utilPct = s.totalMinutes > 0 ? (s.billableMinutes / s.totalMinutes) * 100 : 0;
            const rate = userRateMap.get(s.userId) || 145;
            return (
              <div key={s.userId} className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{s.userName}</h3>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">${rate}/hr</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-bold">{hours.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Billable</span>
                    <span className="font-mono font-bold text-green-700 dark:text-green-400">{billH.toFixed(1)}h</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100,utilPct)}%` }} />
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border/40">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-mono font-bold">${s.revenue.toLocaleString("en-US",{minimumFractionDigits:0,maximumFractionDigits:0})}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {staffBreakdown.length === 0 && (
            <div className="col-span-3 rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">No data</div>
          )}
        </div>
      )}
    </div>
  );
}
