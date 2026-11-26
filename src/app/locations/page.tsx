"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Car, Home, MapPin, Pencil, Trash2 } from "lucide-react";
import { PageLoader } from "@/components/ui/loader";
import { Suggestions } from "@/components/Suggestions";
import { ArcImport } from "@/components/ArcImport";
import { api, browserZone, dayText, hm, localDay, miles, shiftDay, timeText, useLocations, type StayJson } from "@/lib/useLocations";
import { cn } from "@/components/ui";

const LocationMap = dynamic(() => import("@/components/LocationMap"), { ssr: false, loading: () => <div className="h-full min-h-[320px] rounded-2xl bg-surface-low" /> });
const ghost = "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold transition hover:bg-foreground/[0.05] disabled:opacity-40";

export default function LocationsPage() {
  const { data, error, reload, tz } = useLocations(60);
  const [day, setDay] = useState(localDay());
  const [track, setTrack] = useState<[number, number, number][]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => { setSelected(null); }, [day]);
  useEffect(() => {
    let live = true;
    api<{ points: [number, number, number][] }>(`/api/locations/track?from=${day}&to=${day}&tz=${encodeURIComponent(browserZone())}`).then((r) => live && setTrack(r.ok ? r.data.points : []));
    return () => { live = false; };
  }, [day, data]);

  const today = localDay();
  const current = data?.days.find((d) => d.date === day);
  const stays = useMemo(() => (current?.items.filter((i) => i.kind === "stay") ?? []) as StayJson[], [current]);
  const empty = data && data.counts.points + data.counts.visits === 0;

  const saveName = async (s: StayJson) => {
    const n = name.trim();
    setEditing(null);
    if (n) { await api("/api/locations/places", "PUT", { places: [{ key: s.key, name: n, subtitle: s.subtitle }] }); reload(); }
  };
  const erase = async () => { setConfirm(false); await api("/api/locations?src=all", "DELETE"); reload(); };

  if (!data && !error) return <PageLoader label="Loading your locations…" />;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Locations</h1>
          <p className="mt-1 text-xs text-muted-foreground">Where you've been, from your phone and any Arc Timeline you import. Only you can see this.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button aria-label="Previous day" className={cn(ghost, "px-2.5")} onClick={() => setDay(shiftDay(day, -1))}><ChevronLeft className="h-4 w-4" /></button>
          <input type="date" aria-label="Day" value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-9 rounded-full border border-outline-variant bg-transparent px-3 text-xs font-semibold" />
          <button aria-label="Next day" disabled={day >= today} className={cn(ghost, "px-2.5")} onClick={() => setDay(shiftDay(day, 1))}><ChevronRight className="h-4 w-4" /></button>
          <button className={ghost} disabled={day === today} onClick={() => setDay(today)}>Today</button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">{error}</p>}

      {data && data.suggestions.length > 0 && (
        <section aria-labelledby="sug">
          <h2 id="sug" className="mb-2 text-sm font-semibold">Proposed time entries</h2>
          <Suggestions items={data.suggestions} tz={tz} onChanged={reload} />
        </section>
      )}

      {empty ? (
        <div className="rounded-2xl border border-border/70 bg-surface-low px-6 py-10 text-center">
          <MapPin className="mx-auto h-8 w-8 text-primary" strokeWidth={1.5} />
          <p className="mt-2 text-sm font-semibold">No location history yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">Turn on Places in the iPhone app and your visits appear here automatically. Or bring your history over from Arc below.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <section aria-label={`Places on ${dayText(day)}`} className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-semibold">{dayText(day)}</h2>
              {current && <span className="text-xs text-muted-foreground">{hm(current.placeMinutes)} at places</span>}
            </div>
            {!current && <p className="rounded-2xl border border-border/70 bg-surface-low px-4 py-6 text-center text-xs text-muted-foreground">Nothing recorded this day.</p>}
            {current?.items.map((it) =>
              it.kind === "trip" ? (
                <div key={it.id} className="flex items-center gap-3 px-4 py-1 text-xs text-muted-foreground"><Car className="h-4 w-4" />{it.activity ? it.activity[0].toUpperCase() + it.activity.slice(1) : "Travel"} · {miles(it.meters)} · {hm(it.minutes)}</div>
              ) : (
                <div key={it.id} role="button" tabIndex={0} aria-pressed={selected === it.id} onClick={() => setSelected(it.id)} onKeyDown={(e) => e.key === "Enter" && setSelected(it.id)}
                  className={cn("cursor-pointer rounded-2xl border bg-surface-low p-3 transition", selected === it.id ? "border-primary" : "border-border/70 hover:border-outline-variant")}>
                  <div className="flex items-start gap-3">
                    {it.isHome ? <Home className="mt-0.5 h-5 w-5 text-muted-foreground" /> : <MapPin className="mt-0.5 h-5 w-5 text-primary" />}
                    <div className="min-w-0 flex-1">
                      {editing === it.id ? (
                        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={() => saveName(it)} onKeyDown={(e) => { if (e.key === "Enter") saveName(it); if (e.key === "Escape") setEditing(null); }}
                          aria-label="Place name" className="w-full rounded-lg border border-outline-variant bg-background px-2 py-1 text-sm font-semibold" />
                      ) : (
                        <p className="truncate text-sm font-semibold">{it.isHome ? "Home" : it.name ?? "Unnamed place"}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{timeText(it.start, tz)} – {timeText(it.end, tz)}{it.subtitle && !it.isHome ? ` · ${it.subtitle}` : ""}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{hm(it.minutes)}</span>
                    <button aria-label="Rename place" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setName(it.name ?? ""); setEditing(it.id); }}><Pencil className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )
            )}
          </section>
          <div className="h-[420px] lg:sticky lg:top-4 lg:h-[560px]">
            <LocationMap stays={stays} track={track} selectedId={selected} onSelect={setSelected} />
          </div>
        </div>
      )}

      <ArcImport onDone={reload} />

      {data && !empty && (
        <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <span>{data.counts.points.toLocaleString()} recorded points · {data.counts.visits.toLocaleString()} imported places</span>
          {confirm ? (
            <span className="flex items-center gap-2"><strong className="text-foreground">Delete all your location history?</strong>
              <button className={cn(ghost, "border-destructive text-destructive")} onClick={erase}>Yes, delete everything</button>
              <button className={ghost} onClick={() => setConfirm(false)}>Cancel</button></span>
          ) : (
            <button className={cn(ghost, "text-destructive")} onClick={() => setConfirm(true)}><Trash2 className="h-3.5 w-3.5" />Delete location history</button>
          )}
        </div>
      )}
    </div>
  );
}
