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
  ExternalLink,
  ChevronDown,
  Info,
} from "lucide-react";
import { CustomerItem, ServiceItem, TimeEntryItem, UserItem } from "@/db/mock-data";
import { formatQuickBooksDuration, formatQuickBooksJob } from "@/lib/quickbooks";

export default function AccountantPage() {
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "this_week" | "last_week" | "this_month">("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("all");
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedBillable, setSelectedBillable] = useState<string>("all"); // 'all', 'billable', 'non_billable'
  const [selectedStatus, setSelectedStatus] = useState<string>("all"); // 'all', 'submitted', 'approved', 'exported'
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Selected entry IDs for batch operations
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Load data
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

  // Filter logic
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      // Date filter
      if (dateFilter !== "all") {
        const today = new Date();
        const entryDate = new Date(e.date);

        if (dateFilter === "today") {
          const todayStr = today.toISOString().split("T")[0];
          if (e.date !== todayStr) return false;
        } else if (dateFilter === "this_week") {
          const firstDayOfWeek = new Date(today);
          firstDayOfWeek.setDate(today.getDate() - today.getDay());
          firstDayOfWeek.setHours(0, 0, 0, 0);
          if (entryDate < firstDayOfWeek) return false;
        } else if (dateFilter === "this_month") {
          if (entryDate.getMonth() !== today.getMonth() || entryDate.getFullYear() !== today.getFullYear()) {
            return false;
          }
        }
      }

      // Customer
      if (selectedCustomerId !== "all" && e.customerId !== selectedCustomerId) return false;

      // Engineer / User
      if (selectedUserId !== "all" && e.userId !== selectedUserId) return false;

      // Billable
      if (selectedBillable === "billable" && !e.isBillable) return false;
      if (selectedBillable === "non_billable" && e.isBillable) return false;

      // Status
      if (selectedStatus !== "all" && e.status !== selectedStatus) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCust = e.customerName.toLowerCase().includes(q);
        const matchJob = (e.jobName || "").toLowerCase().includes(q);
        const matchNotes = (e.notes || "").toLowerCase().includes(q);
        const matchUser = e.userName.toLowerCase().includes(q);
        if (!matchCust && !matchJob && !matchNotes && !matchUser) return false;
      }

      return true;
    });
  }, [entries, dateFilter, selectedCustomerId, selectedUserId, selectedBillable, selectedStatus, searchQuery]);

  // Key KPI Calculations
  const metrics = useMemo(() => {
    let totalMinutes = 0;
    let billableMinutes = 0;
    let nonBillableMinutes = 0;
    let totalBillableAmount = 0;

    const rateMap: Record<string, number> = {};
    users.forEach((u) => {
      rateMap[u.id] = Number(u.defaultHourlyRate) || 125.0;
    });

    filteredEntries.forEach((e) => {
      totalMinutes += e.durationMinutes;
      if (e.isBillable) {
        billableMinutes += e.durationMinutes;
        const rate = rateMap[e.userId] || 125.0;
        totalBillableAmount += (e.durationMinutes / 60) * rate;
      } else {
        nonBillableMinutes += e.durationMinutes;
      }
    });

    return {
      totalHours: (totalMinutes / 60).toFixed(1),
      billableHours: (billableMinutes / 60).toFixed(1),
      nonBillableHours: (nonBillableMinutes / 60).toFixed(1),
      billablePercent: totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0,
      totalBillableAmount: totalBillableAmount.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      }),
    };
  }, [filteredEntries, users]);

  // Breakdown by Customer
  const customerBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEntries.forEach((e) => {
      map[e.customerName] = (map[e.customerName] || 0) + e.durationMinutes;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredEntries]);

  // Breakdown by Location
  const locationBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredEntries.forEach((e) => {
      map[e.locationType] = (map[e.locationType] || 0) + e.durationMinutes;
    });
    return Object.entries(map);
  }, [filteredEntries]);

  // Table batch selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedEntryIds(new Set(filteredEntries.map((entry) => entry.id)));
    } else {
      setSelectedEntryIds(new Set());
    }
  };

  const toggleSelectEntry = (id: string) => {
    const next = new Set(selectedEntryIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntryIds(next);
  };

  // Update Status (Single or Batch)
  const handleUpdateStatus = async (status: "submitted" | "approved" | "exported", targetIds?: string[]) => {
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

      // Local update
      setEntries((prev) =>
        prev.map((e) => (idsToUpdate.includes(e.id) ? { ...e, status } : e))
      );
      setActionSuccessMsg(`Updated ${idsToUpdate.length} entries to status: "${status}"`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  // QuickBooks Export Download Handlers
  const handleDownloadIIF = () => {
    // Construct query parameters matching currently filtered items
    const params = new URLSearchParams();
    if (selectedCustomerId !== "all") params.set("customerId", selectedCustomerId);
    if (selectedUserId !== "all") params.set("userId", selectedUserId);
    if (selectedStatus !== "all") params.set("status", selectedStatus);

    window.location.href = `/api/export/iif?${params.toString()}`;
  };

  const handleDownloadCSV = () => {
    const params = new URLSearchParams();
    if (selectedCustomerId !== "all") params.set("customerId", selectedCustomerId);
    if (selectedUserId !== "all") params.set("userId", selectedUserId);
    if (selectedStatus !== "all") params.set("status", selectedStatus);

    window.location.href = `/api/export/csv?${params.toString()}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Top Header & Export Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              Accountant & Controller Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Timesheet Audits & QuickBooks Desktop Export
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Audit project hours by customer, approve logs, and generate native QuickBooks Desktop IIF files.
          </p>
        </div>

        {/* Export Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadIIF}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition active:scale-95"
            title="Download QuickBooks Desktop Timer IIF file"
          >
            <Download className="w-4 h-4" />
            <span>Download QuickBooks .IIF</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs sm:text-sm shadow-sm flex items-center gap-2 transition active:scale-95"
            title="Download Excel / CSV spreadsheet"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Download CSV / Excel</span>
          </button>
        </div>
      </div>

      {/* Success feedback pill */}
      {actionSuccessMsg && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Filtered Hours</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {metrics.totalHours} <span className="text-sm font-semibold text-slate-400">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Across {filteredEntries.length} entries</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Billable Hours</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
              {metrics.billablePercent}%
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono">
            {metrics.billableHours} <span className="text-sm font-semibold text-slate-400">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.nonBillableHours} hrs non-billable
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Est. Billable Revenue</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {metrics.totalBillableAmount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Based on engineer billing rates</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Customers</span>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono">
            {customerBreakdown.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">With logged hours in view</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 mb-8">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          <span>Filters & Audit Controls</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Date range filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Time Period</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {/* Customer filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Customer</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Engineer filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Engineer</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Engineers</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Billable filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Billing Type</label>
            <select
              value={selectedBillable}
              onChange={(e) => setSelectedBillable(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">Billable & Non-billable</option>
              <option value="billable">Billable Only</option>
              <option value="non_billable">Non-billable Only</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Approval Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted (Pending Review)</option>
              <option value="approved">Approved</option>
              <option value="exported">Exported to QuickBooks</option>
            </select>
          </div>
        </div>

        {/* Search bar */}
        <div className="mt-3 relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search notes, jobs, customers, or engineer names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Visual Analytics Split (Customer & Location) */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Hours by Customer */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center justify-between">
            <span>Hours by Customer</span>
            <span className="text-slate-400 text-[10px]">Ranked</span>
          </h3>
          <div className="space-y-3">
            {customerBreakdown.length === 0 ? (
              <div className="text-xs text-slate-400 italic py-4">No matching hours for this filter.</div>
            ) : (
              customerBreakdown.map(([custName, mins]) => {
                const totalFilteredMinutes = Number(metrics.totalHours) * 60;
                const percent = totalFilteredMinutes > 0 ? Math.round((mins / totalFilteredMinutes) * 100) : 0;
                const hrs = (mins / 60).toFixed(1);

                return (
                  <div key={custName} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 truncate pr-2">{custName}</span>
                      <span className="text-slate-600 font-mono shrink-0">
                        {hrs} hrs ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Hours by Location */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center justify-between">
            <span>Hours by Location Type</span>
            <span className="text-slate-400 text-[10px]">Field vs. Office</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {locationBreakdown.map(([locType, mins]) => {
              const hrs = (mins / 60).toFixed(1);
              return (
                <div key={locType} className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {locType.replace("_", " ")}
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{hrs} hrs</div>
                </div>
              );
            })}
          </div>

          {/* QuickBooks Help Box */}
          <div className="mt-4 p-3.5 bg-emerald-50 rounded-xl border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-900">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>QuickBooks Desktop Tip:</strong> Exported <code>.iif</code> files import automatically into QuickBooks Desktop timesheets via{" "}
              <code>File &gt; Utilities &gt; Import &gt; IIF Files</code>. All billable hours transfer directly to the client invoice generator.
            </div>
          </div>
        </div>
      </div>

      {/* Main Timesheet Review Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        {/* Table actions bar */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">
              Showing {filteredEntries.length} Records
            </span>
            {selectedEntryIds.size > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                {selectedEntryIds.size} Selected
              </span>
            )}
          </div>

          {/* Batch Status Actions */}
          {selectedEntryIds.size > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleUpdateStatus("approved")}
                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleUpdateStatus("exported")}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition"
              >
                Mark as Exported
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={
                      filteredEntries.length > 0 &&
                      selectedEntryIds.size === filteredEntries.length
                    }
                    onChange={handleSelectAll}
                    className="rounded text-indigo-600 border-slate-300"
                  />
                </th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Engineer</th>
                <th className="py-3 px-3">QuickBooks Job</th>
                <th className="py-3 px-3">Service Item</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-right">Duration</th>
                <th className="py-3 px-3 text-center">Billable</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Loading records...
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No time entries found matching selected filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((e) => {
                  const isChecked = selectedEntryIds.has(e.id);
                  const qbFormattedJob = formatQuickBooksJob(e.customerName, e.jobName);
                  const hrs = Math.floor(e.durationMinutes / 60);
                  const mins = e.durationMinutes % 60;

                  return (
                    <tr
                      key={e.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isChecked ? "bg-indigo-50/40" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectEntry(e.id)}
                          className="rounded text-indigo-600 border-slate-300"
                        />
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-800 whitespace-nowrap">
                        {e.date}
                      </td>

                      <td className="py-3.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                        {e.userName}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-900">{e.customerName}</div>
                        {e.jobName && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            :{e.jobName}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3 text-slate-600 whitespace-nowrap">
                        {e.serviceItemName}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            e.locationType === "on_site"
                              ? "bg-amber-100 text-amber-800"
                              : e.locationType === "office"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {e.locationType.replace("_", " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {formatQuickBooksDuration(e.durationMinutes)}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">
                          ({(e.durationMinutes / 60).toFixed(2)}h)
                        </span>
                      </td>

                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {e.isBillable ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-400">
                            No
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <select
                          value={e.status}
                          onChange={(evt) =>
                            handleUpdateStatus(
                              evt.target.value as "submitted" | "approved" | "exported",
                              [e.id]
                            )
                          }
                          className={`text-[11px] font-bold rounded-lg px-2 py-1 border transition focus:outline-none ${
                            e.status === "approved"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : e.status === "exported"
                              ? "bg-purple-50 text-purple-800 border-purple-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          <option value="submitted">Submitted</option>
                          <option value="approved">Approved</option>
                          <option value="exported">Exported</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={e.notes || ""}>
                        {e.notes || <span className="text-slate-300 italic">No notes</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
