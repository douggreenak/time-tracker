"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerItem, ServiceItem, UserItem } from "@/db/mock-data";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T = unknown>(url: string, method: string, body?: unknown): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    return json.success ? { ok: true, data: json.data as T } : { ok: false, error: json.error || "Request failed" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** Customers, projects (jobs), service items and users, with create/update/delete helpers. */
export function useDirectory() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [c, s, u] = await Promise.all([
      fetch("/api/customers").then((r) => r.json()),
      fetch("/api/service-items").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]);
    // Copy so React sees new references even though the dev store is mutated in place.
    if (c.success) setCustomers(JSON.parse(JSON.stringify(c.data)));
    if (s.success) setServiceItems(s.data);
    if (u.success) setUsers(u.data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const mutate = async <T,>(p: Promise<Result<T>>) => {
    const r = await p;
    if (r.ok) await reload();
    return r;
  };

  return {
    customers,
    serviceItems,
    users,
    loaded,
    reload,
    createCustomer: (name: string, qbName?: string) =>
      mutate(call<CustomerItem>("/api/customers", "POST", { name, qbName })),
    updateCustomer: (id: string, patch: { name?: string; qbName?: string; isActive?: boolean }) =>
      mutate(call(`/api/customers/${id}`, "PUT", patch)),
    deleteCustomer: (id: string) => mutate(call(`/api/customers/${id}`, "DELETE")),
    createJob: (customerId: string, name: string) =>
      mutate(call<{ id: string }>("/api/customers", "POST", { type: "job", customerId, name })),
    updateJob: (id: string, patch: { name?: string; isActive?: boolean }) =>
      mutate(call(`/api/jobs/${id}`, "PUT", patch)),
    deleteJob: (id: string) => mutate(call(`/api/jobs/${id}`, "DELETE")),
    createService: (name: string, defaultBillable = true, qbItemName?: string) =>
      mutate(call<ServiceItem>("/api/service-items", "POST", { name, defaultBillable, qbItemName })),
    updateService: (id: string, patch: { name?: string; qbItemName?: string; defaultBillable?: boolean }) =>
      mutate(call(`/api/service-items/${id}`, "PUT", patch)),
    deleteService: (id: string) => mutate(call(`/api/service-items/${id}`, "DELETE")),
  };
}
