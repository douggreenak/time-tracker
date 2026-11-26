"use client";

import { useRef, useState } from "react";
import JSZip from "jszip";
import { FileUp } from "lucide-react";
import { Spinner } from "@/components/ui/loader";
import { api } from "@/lib/useLocations";

const ghost = "inline-flex h-9 items-center gap-1.5 rounded-full border border-outline-variant px-4 text-xs font-semibold transition hover:bg-foreground/[0.05] disabled:opacity-40";

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const isGzip = (b: Uint8Array) => b.length > 2 && b[0] === 0x1f && b[1] === 0x8b;

/** Every timeline item found in a file: .json, .json.gz, or a .zip of those (what Arc's Export produces). */
async function itemsIn(name: string, bytes: Uint8Array): Promise<unknown[]> {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) { // a zip
    const zip = await JSZip.loadAsync(bytes);
    const out: unknown[] = [];
    for (const f of Object.values(zip.files)) {
      if (f.dir || /(^|\/)(\.|__MACOSX)/.test(f.name) || !/\.(json|gz)$/i.test(f.name)) continue;
      out.push(...(await itemsIn(f.name, await f.async("uint8array"))));
    }
    return out;
  }
  const raw = isGzip(bytes) ? await gunzip(bytes) : bytes;
  const j = JSON.parse(new TextDecoder().decode(raw));
  return Array.isArray(j?.timelineItems) ? j.timelineItems : Array.isArray(j) ? j : [];
}

export function ArcImport({ onDone }: { onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; text: string; error?: boolean }>({ busy: false, text: "" });

  const run = async (files: FileList | null) => {
    if (!files?.length) return;
    let visits = 0, trips = 0, skipped = 0, seen = 0;
    try {
      setState({ busy: true, text: "Reading files…" });
      const all: unknown[] = [];
      for (const f of Array.from(files)) all.push(...(await itemsIn(f.name, new Uint8Array(await f.arrayBuffer()))));
      if (!all.length) return setState({ busy: false, error: true, text: "No Arc timeline items were found in that file. Use Arc's Export (JSON) and pick the .json, .json.gz or .zip it makes." });
      // Send in pieces that stay well under the server's request size limit.
      let chunk: unknown[] = [], size = 0;
      const flush = async () => {
        if (!chunk.length) return;
        const r = await api<{ visits: number; trips: number; skipped: number }>("/api/locations/import", "POST", { items: chunk });
        if (!r.ok) throw new Error(r.error);
        visits += r.data.visits; trips += r.data.trips; skipped += r.data.skipped; seen += chunk.length;
        setState({ busy: true, text: `Imported ${seen.toLocaleString()} of ${all.length.toLocaleString()} items…` });
        chunk = []; size = 0;
      };
      for (const it of all) {
        const n = JSON.stringify(it).length;
        if (chunk.length >= 500 || size + n > 2_500_000) await flush();
        chunk.push(it); size += n;
      }
      await flush();
      setState({ busy: false, text: `Done. ${visits.toLocaleString()} new places and ${trips.toLocaleString()} trips added${skipped ? ` (${skipped} items had no usable time or position)` : ""}. Anything already imported was skipped.` });
      onDone();
    } catch (e) {
      setState({ busy: false, error: true, text: e instanceof Error && !/JSON/.test(e.message) ? e.message : "That file couldn't be read as an Arc Timeline export." });
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-surface-low p-4">
      <p className="text-sm font-semibold">Import from Arc Timeline</p>
      <p className="mt-1 text-xs text-muted-foreground">In Arc, open Settings → Export → Timeline (JSON), then choose the file it makes (a .json, .json.gz or .zip). Your places, trips and routes come across with their names, and you can import more files at any time without duplicates.</p>
      <div className="mt-3 flex items-center gap-3">
        <input ref={input} type="file" multiple accept=".json,.gz,.zip,application/json,application/gzip,application/zip" className="sr-only" id="arc-file" data-testid="arc-file" onChange={(e) => run(e.target.files)} />
        <label htmlFor="arc-file" className={`${ghost} cursor-pointer ${state.busy ? "pointer-events-none opacity-40" : ""}`}>
          {state.busy ? <Spinner size={14} /> : <FileUp className="h-3.5 w-3.5" />}Choose Arc export…
        </label>
        {state.text && <p role="status" className={`text-xs ${state.error ? "font-medium text-destructive" : "text-muted-foreground"}`}>{state.text}</p>}
      </div>
    </div>
  );
}
