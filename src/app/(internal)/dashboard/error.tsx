"use client";

// Route-level error boundary for the whole dashboard segment (Benjy 6/21).
// Before this, the app had NO error boundary anywhere — any render-time throw
// (e.g. one bad value deep in the 5k-line estimator math) tore down the whole
// page and left every input dead, with no recovery. That was the most likely
// cause of Mary's "it stopped letting me enter anything" freeze.
//
// Now a throw lands here instead: the user gets a recoverable screen, their
// work is auto-saved as a draft, and — crucially — we log the exact error +
// stack so the NEXT occurrence pinpoints the offending line.

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real stack so we can find what threw. Shows in the browser
    // console; ask Mary to screenshot this if it recurs.
    // eslint-disable-next-line no-console
    console.error("[Godzilla] Dashboard render error:", error, error?.stack);
    // Best-effort server log so we capture it even without the console.
    try {
      fetch("/api/client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: error?.message || String(error),
          stack: error?.stack || null,
          digest: error?.digest || null,
          path: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
          at: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-amber-200 bg-amber-50/60 p-6 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="mt-3 text-lg font-semibold text-gray-900">Something hit a snag</h1>
        <p className="mt-2 text-sm text-gray-600">
          This screen ran into an error and stopped. Your work is auto-saved as a draft, so nothing is lost —
          try again, or head back to Quotes and reopen the draft.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-md bg-white/70 border border-amber-200 px-3 py-2 text-left text-xs font-mono text-gray-500 break-words">
            {error.message}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => reset()} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => { window.location.href = "/dashboard/quotes"; }}>
            <FileText className="h-4 w-4" /> Back to Quotes
          </Button>
        </div>
      </div>
    </div>
  );
}
