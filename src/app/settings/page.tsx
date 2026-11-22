"use client";

import { useState, useEffect } from "react";
import { Plus, Building, Briefcase, Users, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { CustomerItem, ServiceItem, UserItem } from "@/db/mock-data";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"customers" | "services" | "employees">("customers");

  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // New Customer Form State
  const [newCustName, setNewCustName] = useState("");
  const [newCustQbName, setNewCustQbName] = useState("");

  // New Job Form State
  const [selectedCustomerIdForJob, setSelectedCustomerIdForJob] = useState("");
  const [newJobName, setNewJobName] = useState("");

  // New Service Item Form State
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
        if (custRes.data.length > 0) setSelectedCustomerIdForJob(custRes.data[0].id);
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
        setFeedback(`Customer "${newCustName}" created successfully!`);
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
        setFeedback(`Sub-job "${newJobName}" created!`);
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
        setFeedback(`Service Item "${newServiceName}" created!`);
        setNewServiceName("");
        setNewServiceQbName("");
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            QuickBooks Directory & Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage Customers, Sub-Jobs, QuickBooks Service Items, and Employee Billing Rates.
          </p>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex bg-slate-200/80 p-1 rounded-xl mb-6 shadow-inner max-w-md">
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === "customers" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          Customers & Jobs
        </button>
        <button
          onClick={() => setActiveTab("services")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === "services" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          Service Items
        </button>
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
            activeTab === "employees" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
          }`}
        >
          Engineers & Staff
        </button>
      </div>

      {/* TAB 1: CUSTOMERS & JOBS */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Create Customer */}
            <form onSubmit={handleCreateCustomer} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-600" />
                <span>Add New Customer</span>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Customer / Client Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Energy Solutions"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">QuickBooks Name (if different)</label>
                  <input
                    type="text"
                    placeholder="Exact name in QuickBooks Desktop"
                    value={newCustQbName}
                    onChange={(e) => setNewCustQbName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Create Customer
                </button>
              </div>
            </form>

            {/* Create Sub-Job */}
            <form onSubmit={handleCreateJob} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <span>Add Sub-Job / Phase</span>
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Parent Customer *</label>
                  <select
                    value={selectedCustomerIdForJob}
                    onChange={(e) => setSelectedCustomerIdForJob(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Job / Phase Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Unit 4 Turbine Upgrade"
                    value={newJobName}
                    onChange={(e) => setNewJobName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Exports to QB Desktop as <code>Customer:Job</code></p>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Create Sub-Job
                </button>
              </div>
            </form>
          </div>

          {/* Directory List */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 font-bold text-xs uppercase text-slate-600">
              Configured Customers &amp; Sub-Jobs ({customers.length})
            </div>
            <div className="divide-y divide-slate-100">
              {customers.map((c) => (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                      <span className="text-[11px] text-slate-400 ml-2 font-mono">QB: {c.qbName}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                      Active
                    </span>
                  </div>
                  {c.jobs.length > 0 && (
                    <div className="mt-2 pl-4 border-l-2 border-slate-200 space-y-1">
                      {c.jobs.map((j) => (
                        <div key={j.id} className="text-xs text-slate-600 flex items-center gap-2">
                          <span className="font-mono text-indigo-600 font-semibold">↳ {j.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({j.fullQbJobName})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SERVICE ITEMS */}
      {activeTab === "services" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateServiceItem} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm max-w-xl">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Add QuickBooks Service Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Service Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Field Engineering & Inspection"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">QuickBooks Item Name (Exact)</label>
                <input
                  type="text"
                  placeholder="Item name in QuickBooks Item List"
                  value={newServiceQbName}
                  onChange={(e) => setNewServiceQbName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="billable-check"
                  checked={newServiceBillable}
                  onChange={(e) => setNewServiceBillable(e.target.checked)}
                  className="rounded text-emerald-600 border-slate-300"
                />
                <label htmlFor="billable-check" className="text-xs font-semibold text-slate-700">
                  Default to Billable
                </label>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                Create Service Item
              </button>
            </div>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/70 border-b border-slate-200 font-bold text-xs uppercase text-slate-600">
              Active QuickBooks Service Items ({serviceItems.length})
            </div>
            <div className="divide-y divide-slate-100">
              {serviceItems.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900">{s.name}</div>
                    <div className="text-slate-400 font-mono text-[10px]">QB Item: {s.qbItemName}</div>
                  </div>
                  <div>
                    {s.defaultBillable ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                        Billable
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">
                        Non-billable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EMPLOYEES & RATES */}
      {activeTab === "employees" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 font-bold text-xs uppercase text-slate-600">
            Registered Engineers &amp; Billing Rates ({users.length})
          </div>
          <div className="divide-y divide-slate-100">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-900">{u.name}</div>
                  <div className="text-slate-500">{u.email}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    QuickBooks Employee: {u.qbEmployeeName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-slate-900 text-sm">
                    ${Number(u.defaultHourlyRate).toFixed(2)}/hr
                  </div>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                    {u.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
