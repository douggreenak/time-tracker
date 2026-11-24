"use client";

import { useEffect } from "react";

/** Last-resort screen for a crash in the app shell itself (the normal error page can't catch those). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("TimeTrack crashed:", error);
    // A page opened during a new release can ask for script files that were just replaced.
    // One automatic reload picks up the new release; the guard stops it from looping.
    if (/ChunkLoadError|Loading chunk|Loading CSS chunk|dynamically imported module/i.test(`${error?.name} ${error?.message}`)) {
      try {
        if (sessionStorage.getItem("tt-chunk-reload")) return;
        sessionStorage.setItem("tt-chunk-reload", "1");
      } catch {}
      window.location.reload();
    }
  }, [error]);

  const details = [error?.name, error?.message, error?.digest && `ref ${error.digest}`].filter(Boolean).join(": ");
  return (
    <html lang="en" translate="no">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>TimeTrack hit a problem</h1>
            <p style={{ margin: "0 0 16px", color: "#475569", fontSize: 14 }}>
              Reloading usually fixes it. If it keeps happening, send the line below to whoever manages TimeTrack.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => reset()} style={{ background: "#1d4ed8", color: "#fff", border: 0, borderRadius: 999, padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                Try again
              </button>
              <a href="/engineer" style={{ border: "1px solid #cbd5e1", color: "#0f172a", borderRadius: 999, padding: "10px 22px", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                Reload
              </a>
            </div>
            {details && (
              <code data-testid="crash-details" style={{ display: "block", marginTop: 20, padding: 10, borderRadius: 8, background: "#e2e8f0", fontSize: 12, wordBreak: "break-word", textAlign: "left" }}>
                {details}
              </code>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
