"use client";

import { useCallback, useEffect, useState } from "react";
import type { CustomerItem, UserItem } from "@/db/mock-data";

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

/** Customers and people, with create/update/delete helpers. */
export function useDirectory() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [c, u] = await Promise.all([fetch("/api/customers").then((r) => r.json()), fetch("/api/users").then((r) => r.json())]);
    if (c.success) setCustomers(c.data);
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
    users,
    loaded,
    reload,
    createCustomer: (name: string) => mutate(call<CustomerItem>("/api/customers", "POST", { name })),
    updateCustomer: (id: string, patch: { name?: string; isActive?: boolean }) => mutate(call(`/api/customers/${id}`, "PUT", patch)),
    deleteCustomer: (id: string) => mutate(call(`/api/customers/${id}`, "DELETE")),
    createUser: (u: { name: string; email: string; role?: string; defaultHourlyRate?: number; password: string }) => mutate(call<UserItem>("/api/users", "POST", u)),
    updateUser: (id: string, patch: Partial<Pick<UserItem, "name" | "email" | "role" | "defaultHourlyRate">> & { password?: string }) =>
      mutate(call(`/api/users/${id}`, "PUT", patch)),
    deleteUser: (id: string) => mutate(call(`/api/users/${id}`, "DELETE")),
  };
}
