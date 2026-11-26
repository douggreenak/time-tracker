"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { StayJson } from "@/lib/useLocations";

interface Props {
  stays: StayJson[];
  track: [number, number, number][]; // [t, lat, lon]
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/** A street map of one day: the recorded path as a line, and each stop as a numbered dot. */
export default function LocationMap({ stays, track, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const layer = useRef<import("leaflet").LayerGroup | null>(null);
  const L = useRef<typeof import("leaflet") | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  useEffect(() => {
    let dead = false;
    (async () => {
      const leaflet = await import("leaflet");
      if (dead || !el.current || map.current) return;
      L.current = leaflet;
      const m = leaflet.map(el.current, { zoomControl: true, attributionControl: true }).setView([61.2, -149.9], 11);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(m);
      layer.current = leaflet.layerGroup().addTo(m);
      map.current = m;
      m.fire("tt-ready");
      draw();
    })();
    return () => { dead = true; map.current?.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const leaflet = L.current, m = map.current, g = layer.current;
    if (!leaflet || !m || !g) return;
    g.clearLayers();
    const bounds: [number, number][] = [];
    if (track.length > 1) {
      const line = track.map((p) => [p[1], p[2]] as [number, number]);
      leaflet.polyline(line, { color: "#3b82f6", weight: 4, opacity: 0.75 }).addTo(g);
      bounds.push(...line);
    }
    stays.forEach((s, i) => {
      const sel = s.id === selectedId;
      const dot = leaflet.circleMarker([s.lat, s.lon], { radius: sel ? 12 : 9, color: "#fff", weight: 2, fillColor: s.isHome ? "#6b7280" : "#2563eb", fillOpacity: 1 }).addTo(g);
      dot.bindTooltip(`${i + 1}. ${s.isHome ? "Home" : s.name ?? "Unnamed place"}`);
      dot.on("click", () => selectRef.current(s.id));
      bounds.push([s.lat, s.lon]);
    });
    const sel = stays.find((s) => s.id === selectedId);
    if (sel) m.setView([sel.lat, sel.lon], Math.max(m.getZoom(), 15), { animate: true });
    else if (bounds.length) m.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  }

  useEffect(() => { draw(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [stays, track, selectedId]);
  // The map may be created after the data arrives; draw once it exists.
  useEffect(() => {
    const t = setInterval(() => { if (map.current) { draw(); clearInterval(t); } }, 150);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={el} role="application" aria-label="Map of where you were" data-testid="location-map" className="h-full min-h-[320px] w-full overflow-hidden rounded-2xl border border-border/70 [&_.leaflet-tile-pane]:dark:[filter:invert(1)_hue-rotate(180deg)_brightness(0.9)_contrast(0.9)]" />;
}
