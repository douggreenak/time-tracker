"use client";

import { useCallback, useEffect, useState } from "react";

export interface StayJson { kind: "stay"; id: string; start: number; end: number; minutes: number; lat: number; lon: number; isHome: boolean; src: string; name: string | null; subtitle: string; key: string }
export interface TripJson { kind: "trip"; id: string; start: number; end: number; minutes: number; meters: number; activity: string | null }
export interface DayJson { date: string; items: (StayJson | TripJson)[]; placeMinutes: number }
export interface SuggestionJson { id: string; date: string; start: number; end: number; minutes: number; stayMinutes: number; lat: number; lon: number; name: string | null; subtitle: string; key: string }
export interface LocationData { from: string; to: string; tz: string; days: DayJson[]; suggestions: SuggestionJson[]; counts: { points: number; visits: number }; lastPointAt: number | null }

export const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);
export const timeText = (ms: number, tz: string) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZone: tz });
export const dayText = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" });
export const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`);
export const miles = (m: number) => { const v = m / 1609.344; return v >= 10 ? `${Math.round(v)} mi` : `${v.toFixed(1)} mi`; };

export async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const j = await res.json();
    return j.success ? { ok: true, data: j.data as T } : { ok: false, error: j.error || "Request failed" };
  } catch {
    return { ok: false, error: "Network error" };
  }
}

/** The signed-in person's last 30 days of places, plus proposed time entries. */
export function useLocations(days = 30) {
  const [data, setData] = useState<LocationData | null>(null);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    const tz = browserZone();
    const to = localDay(), from = shiftDay(to, -(days - 1));
    const r = await api<LocationData>(`/api/locations?from=${from}&to=${to}&tz=${encodeURIComponent(tz)}&suggest=14`);
    if (r.ok) { setData(r.data); setError(""); } else setError(r.error);
  }, [days]);
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload, tz: data?.tz ?? browserZone() };
}
