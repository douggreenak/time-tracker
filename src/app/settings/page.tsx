"use client";

import { useState, useEffect } from "react";
import { Building, Briefcase, Users, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { CustomerItem, ServiceItem, UserItem } from "@/db/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<"customers" | "services" | "employees">("customers");

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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center">
        <div>
          <div className="m3-eyebrow mb-3">
            <span>QuickBooks master directory</span>
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[2rem]">
            Directory &amp; Service Item Mapping
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage clients, Customer:Job hierarchies, QuickBooks service items, and engineer rates
          </p>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-tertiary-container/50 px-5 py-4 text-sm font-medium text-tertiary-on-container">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-tertiary" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 flex max-w-md items-center gap-1 rounded-full bg-surface-container p-1.5">
        <button
          onClick={() => setActiveTab("customers")}
          className={`flex-1 rounded-full py-2 text-xs font-medium tracking-tight transition-all duration-200 ease-expressive ${
            activeTab === "customers" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          }`}
        >
          Customers &amp; Jobs
        </button>
        <button
          onClick={() => setActiveTab("services")}
          className={`flex-1 rounded-full py-2 text-xs font-medium tracking-tight transition-all duration-200 ease-expressive ${
            activeTab === "services" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          }`}
        >
          Service Items
        </button>
        <button
          onClick={() => setActiveTab("employees")}
          className={`flex-1 rounded-full py-2 text-xs font-medium tracking-tight transition-all duration-200 ease-expressive ${
            activeTab === "employees" ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"
          }`}
        >
          Engineers &amp; Staff
        </button>
      </div>

      {activeTab === "customers" && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <form onSubmit={handleCreateCustomer} className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-foreground">
                <Building className="w-4 h-4 text-primary" />
                <span>Add New Customer</span>
              </h3>
              <div className="space-y-3.5">
                <div>
                  <Label>Customer / Client Name</Label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Apex Energy Solutions"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>QuickBooks Name (if different)</Label>
                  <Input
                    type="text"
                    placeholder="Exact name in QuickBooks Desktop"
                    value={newCustQbName}
                    onChange={(e) => setNewCustQbName(e.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full py-3"
                >
                  Create Customer
                </Button>
              </div>
            </form>

            <form onSubmit={handleCreateJob} className="rounded-xl border border-border/60 bg-card p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-foreground">
                <Briefcase className="w-4 h-4 text-primary" />
                <span>Add Sub-Job / Phase</span>
              </h3>
              <div className="space-y-3.5">
                <div>
                  <Label>Parent Customer</Label>
                  <Select
                    value={selectedCustomerIdForJob}
                    onChange={(e) => setSelectedCustomerIdForJob(e.target.value)}
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Job / Phase Name</Label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Unit 4 Turbine Upgrade"
                    value={newJobName}
                    onChange={(e) => setNewJobName(e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Exports to QB Desktop as <code>Customer:Job</code>
                  </p>
                </div>
                <Button
                  type="submit"
                  className="w-full py-3"
                >
                  Create Sub-Job
                </Button>
              </div>
            </form>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Active Customers & Sub-Jobs ({customers.length})
                </h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0 divide-y divide-border">
              {customers.map((c) => (
                <div key={c.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground text-sm">{c.name}</span>
                      <span className="text-[11px] text-muted-foreground ml-2 font-mono">QB: {c.qbName}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                      Active
                    </Badge>
                  </div>
                  {c.jobs.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-primary/20 space-y-1.5">
                      {c.jobs.map((j) => (
                        <div key={j.id} className="text-xs text-muted-foreground flex items-center gap-2">
                          <span className="font-mono text-primary font-semibold">↳ {j.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">({j.fullQbJobName})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "services" && (
        <div className="space-y-6">
          <form onSubmit={handleCreateServiceItem} className="max-w-xl rounded-xl border border-border/60 bg-card p-6 shadow-sm">
            <h3 className="mb-4 text-base font-semibold tracking-[-0.01em] text-foreground">Add QuickBooks service item</h3>
            <div className="space-y-3.5">
              <div>
                <Label>Service Item Name</Label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Field Engineering & Inspection"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                />
              </div>
              <div>
                <Label>QuickBooks Item Name (Exact)</Label>
                <Input
                  type="text"
                  placeholder="Item name in QuickBooks Item List"
                  value={newServiceQbName}
                  onChange={(e) => setNewServiceQbName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="billable-check"
                  checked={newServiceBillable}
                  onChange={(e) => setNewServiceBillable(e.target.checked)}
                  className="rounded text-primary border-input"
                />
                <Label htmlFor="billable-check" className="text-xs font-semibold text-foreground cursor-pointer">
                  Default to Billable
                </Label>
              </div>
              <Button
                type="submit"
                className="w-full py-3"
              >
                Create Service Item
              </Button>
            </div>
          </form>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Active QuickBooks Service Items ({serviceItems.length})
                </h3>
              </div>
            </CardHeader>
            <CardContent className="pt-0 divide-y divide-border">
              {serviceItems.map((s) => (
                <div key={s.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-foreground">{s.name}</div>
                    <div className="text-muted-foreground font-mono text-[10px]">QB Item: {s.qbItemName}</div>
                  </div>
                  <div>
                    {s.defaultBillable ? (
                      <Badge variant="secondary" className="text-xs px-2.5 py-0.5">Billable</Badge>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold text-xs">
                        Non-billable
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "employees" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Registered Engineers & Billing Rates ({users.length})
              </h3>
            </div>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border">
            {users.map((u) => (
              <div key={u.id} className="p-5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-foreground text-sm">{u.name}</div>
                  <div className="text-muted-foreground">{u.email}</div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    QuickBooks Employee: {u.qbEmployeeName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-foreground text-sm">
                    ${Number(u.defaultHourlyRate).toFixed(2)}/hr
                  </div>
                  <Badge variant="secondary" className="text-[10px] px-2.5 py-0.5 uppercase tracking-wider">
                    {u.role}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
