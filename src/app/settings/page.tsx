"use client";

import { useState, useEffect } from "react";
import { Building, Briefcase, Plus, CheckCircle2 } from "lucide-react";
import { CustomerItem, ServiceItem, UserItem } from "@/db/mock-data";
import { cn } from "@/components/ui";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"customers" | "services" | "team">("customers");

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCustName, setNewCustName] = useState("");
  const [newCustQbName, setNewCustQbName] = useState("");

  const [selectedCustomerIdForJob, setSelectedCustomerIdForJob] = useState("");
  const [newJobName, setNewJobName] = useState("");

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceQbName, setNewServiceQbName] = useState("");
  const [newServiceBillable, setNewServiceBillable] = useState(true);

  const [feedback, setFeedback] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [custRes, srvRes, userRes] = await Promise.all([
        fetch("/api/customers").then((r) => r.json()),
        fetch("/api/service-items").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
      ]);

      if (custRes.success) {
        setCustomers(custRes.data);
        if (custRes.data.length > 0 && !selectedCustomerIdForJob) {
          setSelectedCustomerIdForJob(custRes.data[0].id);
        }
      }
      if (srvRes.success) setServiceItems(srvRes.data);
      if (userRes.success) setUsers(userRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustName.trim(),
          qbName: newCustQbName.trim() || newCustName.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback(`Customer "${newCustName}" created`);
        setNewCustName("");
        setNewCustQbName("");
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobName.trim() || !selectedCustomerIdForJob) return;

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "job",
          customerId: selectedCustomerIdForJob,
          name: newJobName.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback(`Job "${newJobName}" created`);
        setNewJobName("");
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateServiceItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    try {
      const res = await fetch("/api/service-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newServiceName.trim(),
          qbItemName: newServiceQbName.trim() || newServiceName.trim(),
          defaultBillable: newServiceBillable,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedback(`Service "${newServiceName}" created`);
        setNewServiceName("");
        setNewServiceQbName("");
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Directory</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">QuickBooks clients, jobs, and services</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-full border border-border bg-card p-1">
          {[
            { id: "customers" as const, label: "Clients & Jobs" },
            { id: "services" as const, label: "Services" },
            { id: "team" as const, label: "Team" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* ── CLIENTS & JOBS ── */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* New Customer */}
            <form onSubmit={handleCreateCustomer} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                <Building className="h-4 w-4 text-primary" />
                <span>Add Client</span>
              </div>
              <input
                type="text"
                required
                placeholder="Client name"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="QuickBooks name (if different)"
                value={newCustQbName}
                onChange={(e) => setNewCustQbName(e.target.value)}
                className={inputCls}
              />
              <button
                type="submit"
                className="m3-fab flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Client
              </button>
            </form>

            {/* New Job */}
            <form onSubmit={handleCreateJob} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
                <Briefcase className="h-4 w-4 text-primary" />
                <span>Add Job / Phase</span>
              </div>
              <select
                value={selectedCustomerIdForJob}
                onChange={(e) => setSelectedCustomerIdForJob(e.target.value)}
                className={selectCls}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Job name"
                value={newJobName}
                onChange={(e) => setNewJobName(e.target.value)}
                className={inputCls}
              />
              <button
                type="submit"
                className="m3-fab flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> Add Job
              </button>
            </form>
          </div>

          {/* List */}
          <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
            {customers.map((c) => (
              <div key={c.id} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-foreground">{c.name}</span>
                  <span className="text-[11px] font-mono text-muted-foreground">{c.qbName}</span>
                </div>
                {c.jobs.length > 0 && (
                  <div className="mt-2.5 space-y-1 pl-3 border-l-2 border-primary/20">
                    {c.jobs.map((j) => (
                      <div key={j.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>↳ {j.name}</span>
                        <span className="font-mono text-[10px]">{j.fullQbJobName}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SERVICES ── */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateServiceItem} className="max-w-md rounded-2xl border border-border bg-card p-5 space-y-3">
            <span className="block font-semibold text-sm text-foreground">Add Service Item</span>
            <input
              type="text"
              required
              placeholder="Service name"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="QuickBooks item name (exact)"
              value={newServiceQbName}
              onChange={(e) => setNewServiceQbName(e.target.value)}
              className={inputCls}
            />
            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={newServiceBillable}
                onChange={(e) => setNewServiceBillable(e.target.checked)}
                className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
              />
              <span className="text-xs font-medium text-foreground">Billable by default</span>
            </label>
            <button
              type="submit"
              className="m3-fab flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Add Service
            </button>
          </form>

          <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
            {serviceItems.map((s) => (
              <div key={s.id} className="flex items-center justify-between p-4 text-xs">
                <div>
                  <div className="font-semibold text-sm text-foreground">{s.name}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">QB: {s.qbItemName}</div>
                </div>
                {s.defaultBillable ? (
                  <span className="rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300">
                    Billable
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Non-billable
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TEAM ── */}
      {activeTab === "team" && (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border/60">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-4 text-xs">
              <div>
                <div className="font-semibold text-sm text-foreground">{u.name}</div>
                <div className="text-muted-foreground">{u.email}</div>
                <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                  QB: {u.qbEmployeeName}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm font-bold text-foreground">
                  ${Number(u.defaultHourlyRate).toFixed(2)}/hr
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                  {u.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "block w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";
const selectCls =
  "block w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:border-outline focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-colors";
