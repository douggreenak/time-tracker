"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  CheckCircle2,
  Calendar,
  DollarSign,
  Clock,
  Briefcase,
  Building,
  MapPin,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  Users,
  CheckSquare,
  ArrowUpDown,
  Car,
  Laptop,
  Check,
} from "lucide-react";
import { CustomerItem, ServiceItem, TimeEntryItem, UserItem } from "@/db/mock-data";
import { formatQuickBooksDuration, formatQuickBooksJob } from "@/lib/quickbooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/components/ui";

type PeriodPreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "ytd"
  | "all"
  | "custom";

type ViewMode = "table" | "customer_summary" | "engineer_summary";

export default function AccountantPage() {
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<PeriodPreset>("this_week");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedBillable, setSelectedBillable] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"date" | "durationMinutes" | "userName" | "customerName">("date");
  const [sortAsc, setSortAsc] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custRes, srvRes, userRes, entriesRes] = await Promise.all([
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/service-items").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/time-entries").then((r) => r.json()),
      ]);

      if (custRes.success) setCustomers(custRes.data);
      if (srvRes.success) setServiceItems(srvRes.data);
      if (userRes.success) setUsers(userRes.data);
      if (entriesRes.success) setEntries(entriesRes.data);
    } catch (err) {
      console.error("Error fetching accountant data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        const presets: PeriodPreset[] = [
          "today", "yesterday", "this_week", "last_week", "this_month",
          "last_month", "this_quarter", "all",
        ];
        setPeriod((prev) => {
          const idx = presets.indexOf(prev);
          return presets[(idx + 1) % presets.length];
        });
        return;
      }

      if (e.key === "/") {
        e.preventDefault();
        const searchInput = document.getElementById("accountant-search-input") as HTMLInputElement | null;
        searchInput?.focus();
        return;
      }

      if (e.key.toLowerCase() === "a" && selectedEntryIds.size > 0) {
        e.preventDefault();
        handleUpdateStatus("approved");
        return;
      }

      if (e.key.toLowerCase() === "x" && selectedEntryIds.size > 0) {
        e.preventDefault();
        handleUpdateStatus("exported");
        return;
      }

      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        handleDownloadIIF();
        return;
      }

      if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        handleDownloadCSV();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEntryIds, period]);

  const dateRangeBounds = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const formatDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    switch (period) {
      case "today": {
        const s = formatDate(today);
        return { start: s, end: s, label: "Today" };
      }
      case "yesterday": {
        const y = new Date(today);
        y.setDate(today.getDate() - 1);
        const s = formatDate(y);
        return { start: s, end: s, label: "Yesterday" };
      }
      case "this_week": {
        const d = new Date(today);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return { start: formatDate(monday), end: formatDate(sunday), label: "This Week" };
      }
      case "last_week": {
        const d = new Date(today);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
        const lastMonday = new Date(d.setDate(diff));
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        return { start: formatDate(lastMonday), end: formatDate(lastSunday), label: "Last Week" };
      }
      case "this_month": {
        const first = new Date(today.getFullYear(), today.getMonth(), 1);
        const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return { start: formatDate(first), end: formatDate(last), label: "This Month" };
      }
      case "last_month": {
        const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const last = new Date(today.getFullYear(), today.getMonth(), 0);
        return { start: formatDate(first), end: formatDate(last), label: "Last Month" };
      }
      case "this_quarter": {
        const currentQuarter = Math.floor(today.getMonth() / 3);
        const first = new Date(today.getFullYear(), currentQuarter * 3, 1);
        const last = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
        return { start: formatDate(first), end: formatDate(last), label: `Q${currentQuarter + 1}` };
      }
      case "ytd": {
        const first = new Date(today.getFullYear(), 0, 1);
        return { start: formatDate(first), end: formatDate(today), label: "Year to Date" };
      }
      case "custom": {
        return { start: customStartDate, end: customEndDate, label: "Custom Range" };
      }
      case "all":
      default:
        return { start: null, end: null, label: "All Time" };
    }
  }, [period, customStartDate, customEndDate]);

  const userRateMap = useMemo(() => {
    const map = new Map<string, number>();
    users.forEach((u) => map.set(u.id, u.defaultHourlyRate || 145.0));
    return map;
  }, [users]);

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        if (dateRangeBounds.start && e.date < dateRangeBounds.start) return false;
        if (dateRangeBounds.end && e.date > dateRangeBounds.end) return false;
        if (selectedCustomerId !== "all" && e.customerId !== selectedCustomerId) return false;
        if (selectedUserId !== "all" && e.userId !== selectedUserId) return false;
        if (selectedBillable === "billable" && !e.isBillable) return false;
        if (selectedBillable === "non_billable" && e.isBillable) return false;
        if (selectedStatus !== "all" && e.status !== selectedStatus) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            e.customerName.toLowerCase().includes(q) ||
            (e.jobName && e.jobName.toLowerCase().includes(q)) ||
            e.userName.toLowerCase().includes(q) ||
            e.serviceItemName.toLowerCase().includes(q) ||
            (e.notes && e.notes.toLowerCase().includes(q)) ||
            (e.locationName && e.locationName.toLowerCase().includes(q));
          if (!match) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === "date") cmp = a.date.localeCompare(b.date);
        else if (sortField === "durationMinutes") cmp = a.durationMinutes - b.durationMinutes;
        else if (sortField === "userName") cmp = a.userName.localeCompare(b.userName);
        else if (sortField === "customerName") cmp = a.customerName.localeCompare(b.customerName);
        return sortAsc ? cmp : -cmp;
      });
  }, [
    entries,
    dateRangeBounds,
    selectedCustomerId,
    selectedUserId,
    selectedBillable,
    selectedStatus,
    searchQuery,
    sortField,
    sortAsc,
  ]);

  const metrics = useMemo(() => {
    let totalMinutes = 0;
    let billableMinutes = 0;
    let totalRevenue = 0;
    let totalCost = 0;
    const activeCustomersSet = new Set<string>();
    const activeJobsSet = new Set<string>();

    filteredEntries.forEach((e) => {
      totalMinutes += e.durationMinutes;
      const rate = userRateMap.get(e.userId) || 145.0;
      const hours = e.durationMinutes / 60;

      const costRate = 75.0;
      totalCost += hours * costRate;

      if (e.isBillable) {
        billableMinutes += e.durationMinutes;
        totalRevenue += hours * rate;
      }

      activeCustomersSet.add(e.customerId);
      if (e.jobId) activeJobsSet.add(e.jobId);
    });

    const totalHours = totalMinutes / 60;
    const billableHours = billableMinutes / 60;
    const nonBillableHours = totalHours - billableHours;
    const realizationRate = totalMinutes > 0 ? (billableMinutes / totalMinutes) * 100 : 0;
    const grossMargin = totalRevenue - totalCost;
    const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;

    return {
      totalMinutes,
      totalHours,
      billableHours,
      nonBillableHours,
      realizationRate,
      totalRevenue,
      totalCost,
      grossMargin,
      marginPct,
      activeCustomerCount: activeCustomersSet.size,
      activeJobCount: activeJobsSet.size,
    };
  }, [filteredEntries, userRateMap]);

  const customerBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        totalMinutes: number;
        billableMinutes: number;
        revenue: number;
        jobs: Map<string, { jobName: string; minutes: number }>;
      }
    >();

    filteredEntries.forEach((e) => {
      let item = map.get(e.customerId);
      if (!item) {
        item = {
          customerId: e.customerId,
          customerName: e.customerName,
          totalMinutes: 0,
          billableMinutes: 0,
          revenue: 0,
          jobs: new Map(),
        };
        map.set(e.customerId, item);
      }

      item.totalMinutes += e.durationMinutes;
      const rate = userRateMap.get(e.userId) || 145.0;
      const hours = e.durationMinutes / 60;

      if (e.isBillable) {
        item.billableMinutes += e.durationMinutes;
        item.revenue += hours * rate;
      }

      const jobKey = e.jobId || "general";
      const jobName = e.jobName || "General Services";
      const existingJob = item.jobs.get(jobKey);
      if (existingJob) {
        existingJob.minutes += e.durationMinutes;
      } else {
        item.jobs.set(jobKey, { jobName, minutes: e.durationMinutes });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredEntries, userRateMap]);

  const engineerBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        userId: string;
        userName: string;
        totalMinutes: number;
        billableMinutes: number;
        revenue: number;
        entriesCount: number;
      }
    >();

    filteredEntries.forEach((e) => {
      let item = map.get(e.userId);
      if (!item) {
        item = {
          userId: e.userId,
          userName: e.userName,
          totalMinutes: 0,
          billableMinutes: 0,
          revenue: 0,
          entriesCount: 0,
        };
        map.set(e.userId, item);
      }

      item.totalMinutes += e.durationMinutes;
      item.entriesCount += 1;
      const rate = userRateMap.get(e.userId) || 145.0;
      const hours = e.durationMinutes / 60;

      if (e.isBillable) {
        item.billableMinutes += e.durationMinutes;
        item.revenue += hours * rate;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [filteredEntries, userRateMap]);

  const allSelected = filteredEntries.length > 0 && selectedEntryIds.size === filteredEntries.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const toggleSelectEntry = (id: string) => {
    const next = new Set(selectedEntryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntryIds(next);
  };

  const handleUpdateStatus = async (
    status: "draft" | "submitted" | "approved" | "exported",
    targetIds?: string[]
  ) => {
    const idsToUpdate = targetIds || Array.from(selectedEntryIds);
    if (idsToUpdate.length === 0) return;

    try {
      await Promise.all(
        idsToUpdate.map((id) =>
          fetch(`/api/time-entries/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );

      setEntries((prev) =>
        prev.map((e) => (idsToUpdate.includes(e.id) ? { ...e, status } : e))
      );

      if (!targetIds) {
        setSelectedEntryIds(new Set());
      }

      setActionSuccessMsg(`Updated ${idsToUpdate.length} record(s) to "${status}"`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const handleDownloadIIF = () => {
    const params = new URLSearchParams();
    if (dateRangeBounds.start) params.set("startDate", dateRangeBounds.start);
    if (dateRangeBounds.end) params.set("endDate", dateRangeBounds.end);
    if (selectedCustomerId !== "all") params.set("customerId", selectedCustomerId);
    if (selectedUserId !== "all") params.set("userId", selectedUserId);
    if (selectedStatus !== "all") params.set("status", selectedStatus);

    window.location.href = `/api/export/iif?${params.toString()}`;
  };

  const handleDownloadCSV = () => {
    const params = new URLSearchParams();
    if (dateRangeBounds.start) params.set("startDate", dateRangeBounds.start);
    if (dateRangeBounds.end) params.set("endDate", dateRangeBounds.end);
    if (selectedCustomerId !== "all") params.set("customerId", selectedCustomerId);
    if (selectedUserId !== "all") params.set("userId", selectedUserId);
    if (selectedStatus !== "all") params.set("status", selectedStatus);

    window.location.href = `/api/export/csv?${params.toString()}`;
  };

  const toggleSort = (field: "date" | "durationMinutes" | "userName" | "customerName") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 mb-6 border-b border-border/60">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-secondary text-primary-foreground text-xs font-semibold mb-2 border border-border/60">
            <span>Accounting & QuickBooks Controller</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Timesheet Audits & Financial Calculations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Calculate period realization, verify labor costs, and export to QuickBooks Desktop (.IIF)
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            onClick={handleDownloadIIF}
            variant="default"
            className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download .IIF</span>
          </Button>

          <Button
            onClick={handleDownloadCSV}
            variant="outline"
            className="flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>CSV Audit</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Calculation Time Period
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-muted/50 p-1.5 rounded-xl border border-border/40">
              {[
                { id: "today", label: "Today" },
                { id: "yesterday", label: "Yesterday" },
                { id: "this_week", label: "This Week" },
                { id: "last_week", label: "Last Week" },
                { id: "this_month", label: "This Month" },
                { id: "last_month", label: "Last Month" },
                { id: "this_quarter", label: "This Quarter" },
                { id: "ytd", label: "YTD" },
                { id: "all", label: "All Time" },
                { id: "custom", label: "Custom Range" },
              ].map((p) => {
                const active = period === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPeriod(p.id as PeriodPreset)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                      active
                        ? "bg-background text-primary shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {period === "custom" && (
            <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">From:</span>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono font-medium"
                />
              </div>
              <span className="text-xs text-muted-foreground italic">
                Active Range: {customStartDate} &rarr; {customEndDate}
              </span>
            </div>
          )}
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total Period Hours
              </span>
              <Clock className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight font-mono">
              {metrics.totalHours.toFixed(2)}h
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
              {formatQuickBooksDuration(metrics.totalMinutes)} in {dateRangeBounds.label}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Billable Realization
              </span>
              <Badge className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {metrics.realizationRate.toFixed(1)}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
              {metrics.billableHours.toFixed(2)}h
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, metrics.realizationRate)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Est. Billable Revenue
              </span>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight font-mono">
              ${metrics.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
              Calculated via engineer billing rates
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Active Coverage
              </span>
              <Briefcase className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight font-mono">
              {metrics.activeCustomerCount} <span className="text-sm text-muted-foreground font-normal">Clients</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 font-medium">
              Across {metrics.activeJobCount} projects / job sites
            </div>
          </CardContent>
        </Card>
      </div>

      {actionSuccessMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            onClick={() => setActionSuccessMsg(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 bg-muted/50 p-1.5 rounded-xl border border-border/40">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition",
                  viewMode === "table"
                    ? "bg-background text-primary shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Detailed Audit Table</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-mono">
                  {filteredEntries.length}
                </span>
              </button>

              <button
                onClick={() => setViewMode("customer_summary")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition",
                  viewMode === "customer_summary"
                    ? "bg-background text-primary shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>By Customer ({customerBreakdown.length})</span>
              </button>

              <button
                onClick={() => setViewMode("engineer_summary")}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition",
                  viewMode === "engineer_summary"
                    ? "bg-background text-primary shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                <span>By Engineer ({engineerBreakdown.length})</span>
              </button>
            </div>

            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                id="accountant-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes, engineers, jobs, sites... (Press / to focus)"
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-muted border border-border text-xs font-medium focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/20 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center gap-3">
            <Select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-auto min-w-[180px]"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>

            <Select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-auto min-w-[180px]"
            >
              <option value="all">All Engineers</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>

            <Select
              value={selectedBillable}
              onChange={(e) => setSelectedBillable(e.target.value)}
              className="w-auto min-w-[160px]"
            >
              <option value="all">Billable & Non-Billable</option>
              <option value="billable">Billable Only</option>
              <option value="non_billable">Non-Billable Only</option>
            </Select>

            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-auto min-w-[160px]"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="exported">Exported to QB</option>
            </Select>

            {(selectedCustomerId !== "all" ||
              selectedUserId !== "all" ||
              selectedBillable !== "all" ||
              selectedStatus !== "all" ||
              searchQuery) && (
              <button
                onClick={() => {
                  setSelectedCustomerId("all");
                  setSelectedUserId("all");
                  setSelectedBillable("all");
                  setSelectedStatus("all");
                  setSearchQuery("");
                }}
                className="text-xs font-semibold text-primary hover:text-primary/90 ml-auto"
              >
                Reset Filters
              </button>
            )}
          </div>
        </CardHeader>
      </Card>

      {selectedEntryIds.size > 0 && viewMode === "table" && (
        <div className="mb-4 p-3 rounded-xl bg-primary text-primary-foreground flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20">
              {selectedEntryIds.size} Selected
            </span>
            <span className="text-xs text-primary-foreground/80 hidden sm:inline">
              Choose batch action for QuickBooks approval workflow:
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => handleUpdateStatus("approved")}
              variant="secondary"
              className="flex items-center gap-1.5 text-xs shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve (A)</span>
            </Button>

            <Button
              onClick={() => handleUpdateStatus("exported")}
              variant="secondary"
              className="flex items-center gap-1.5 text-xs shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Mark Exported (X)</span>
            </Button>

            <button
              onClick={() => setSelectedEntryIds(new Set())}
              className="px-2.5 py-1.5 text-xs text-primary-foreground/70 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {viewMode === "table" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-muted text-muted-foreground font-semibold uppercase tracking-wider text-[11px] border-b border-border/60 select-none">
                <tr>
                  <th className="py-3.5 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="rounded text-primary border-input focus:ring-ring/50"
                    />
                  </th>
                  <th
                    onClick={() => toggleSort("date")}
                    className="py-3.5 px-3 cursor-pointer hover:text-foreground"
                  >
                    <div className="flex items-center gap-1">
                      <span>Date</span>
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort("userName")}
                    className="py-3.5 px-3 cursor-pointer hover:text-foreground"
                  >
                    <div className="flex items-center gap-1">
                      <span>Engineer</span>
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort("customerName")}
                    className="py-3.5 px-3 cursor-pointer hover:text-foreground"
                  >
                    <div className="flex items-center gap-1">
                      <span>QuickBooks Job</span>
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3">Service Item</th>
                  <th className="py-3.5 px-3">Location</th>
                  <th
                    onClick={() => toggleSort("durationMinutes")}
                    className="py-3.5 px-3 text-right cursor-pointer hover:text-foreground"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Duration</span>
                      <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </th>
                  <th className="py-3.5 px-3 text-center">Billable</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium text-muted-foreground">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      Loading timesheet records...
                    </td>
                  </tr>
                ) : filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      No timesheet entries found for the selected period and filters.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((e) => {
                    const isChecked = selectedEntryIds.has(e.id);

                    return (
                      <tr
                        key={e.id}
                        className={cn(
                          "hover:bg-muted/60 transition",
                          isChecked ? "bg-primary/10" : ""
                        )}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectEntry(e.id)}
                            className="rounded text-primary border-input focus:ring-ring/50"
                          />
                        </td>

                        <td className="py-3 px-3 font-mono text-foreground whitespace-nowrap">
                          {e.date}
                        </td>

                        <td className="py-3 px-3 font-semibold text-foreground whitespace-nowrap">
                          {e.userName}
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-foreground">{e.customerName}</div>
                          {e.jobName && (
                            <div className="text-[11px] text-muted-foreground font-mono">
                              :{e.jobName}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                          {e.serviceItemName}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full",
                            e.locationType === "on_site"
                              ? "bg-amber-50 text-amber-800 border border-amber-100"
                              : e.locationType === "office"
                              ? "bg-blue-50 text-blue-800 border border-blue-100"
                              : e.locationType === "remote"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                              : "bg-purple-50 text-purple-800 border border-purple-100"
                          )}>
                            {e.locationType === "on_site" && <MapPin className="w-3 h-3 text-amber-600" />}
                            {e.locationType === "office" && <Building className="w-3 h-3 text-blue-600" />}
                            {e.locationType === "remote" && <Laptop className="w-3 h-3 text-emerald-600" />}
                            {e.locationType === "travel" && <Car className="w-3 h-3 text-purple-600" />}
                            <span className="capitalize">{e.locationType.replace("_", " ")}</span>
                          </span>
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                          {formatQuickBooksDuration(e.durationMinutes)}
                          <span className="text-[10px] text-muted-foreground font-normal ml-1">
                            ({(e.durationMinutes / 60).toFixed(2)}h)
                          </span>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {e.isBillable ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Yes
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                              No
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <select
                            value={e.status}
                            onChange={(evt) =>
                              handleUpdateStatus(
                                evt.target.value as "draft" | "submitted" | "approved" | "exported",
                                [e.id]
                              )
                            }
                            className={cn(
                              "text-[11px] font-bold rounded-lg px-2 py-1 border transition focus:outline-none focus:ring-2 focus:ring-ring/20",
                              e.status === "approved"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                                : e.status === "exported"
                                ? "bg-purple-50 text-purple-800 border-purple-100"
                                : "bg-amber-50 text-amber-800 border-amber-100"
                            )}
                          >
                            <option value="draft">Draft</option>
                            <option value="submitted">Submitted</option>
                            <option value="approved">Approved</option>
                            <option value="exported">Exported</option>
                          </select>
                        </td>

                        <td className="py-3 px-4 text-muted-foreground max-w-xs truncate" title={e.notes || ""}>
                          {e.notes || <span className="text-muted-foreground/50 italic">No notes</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {viewMode === "customer_summary" && (
        <div className="grid md:grid-cols-2 gap-4">
          {customerBreakdown.map((cust) => {
            const hours = cust.totalMinutes / 60;
            const billablePct = cust.totalMinutes > 0 ? (cust.billableMinutes / cust.totalMinutes) * 100 : 0;
            const jobsList = Array.from(cust.jobs.values());

            return (
              <Card
                key={cust.customerId}
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-foreground">{cust.customerName}</h3>
                    <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                      ${cust.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span>{hours.toFixed(2)} Total Hours</span>
                    <span>•</span>
                    <span>{billablePct.toFixed(0)}% Billable</span>
                    <span>•</span>
                    <span>{jobsList.length} Job(s)</span>
                  </div>

                  <div className="space-y-2 pt-3 border-t border-border/40">
                    {jobsList.map((j, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium truncate max-w-xs">{j.jobName}</span>
                        <span className="font-mono text-foreground font-semibold">
                          {(j.minutes / 60).toFixed(2)}h
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {viewMode === "engineer_summary" && (
        <div className="grid md:grid-cols-3 gap-4">
          {engineerBreakdown.map((eng) => {
            const hours = eng.totalMinutes / 60;
            const billableHours = eng.billableMinutes / 60;
            const utilPct = eng.totalMinutes > 0 ? (eng.billableMinutes / eng.totalMinutes) * 100 : 0;
            const rate = userRateMap.get(eng.userId) || 145.0;

            return (
              <Card
                key={eng.userId}
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-bold text-foreground">{eng.userName}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      ${rate}/hr
                    </span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Period Hours:</span>
                      <span className="font-mono font-bold text-foreground">{hours.toFixed(2)}h</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Billable Hours:</span>
                      <span className="font-mono font-bold text-emerald-700">{billableHours.toFixed(2)}h</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Utilization Rate:</span>
                      <span className="font-bold text-primary">{utilPct.toFixed(1)}%</span>
                    </div>

                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden my-2">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.min(100, utilPct)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40">
                      <span className="text-muted-foreground">Revenue Generated:</span>
                      <span className="font-mono font-bold text-foreground">
                        ${eng.revenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
