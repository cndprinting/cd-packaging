"use client";

// Invoice lines (Denise 11/24/26): quantity, description, amount per line; add as many as needed.
import { Plus, Trash2 } from "lucide-react";

export type LineDraft = { qty: string; description: string; amount: string };
export const emptyLine = (): LineDraft => ({ qty: "", description: "", amount: "" });
const n = (v: string) => { const x = Number(String(v).replace(/[$,\s]/g, "")); return Number.isFinite(x) ? x : 0; };
export const draftSubtotal = (lines: LineDraft[]) => Math.round(lines.reduce((t, l) => t + n(l.amount), 0) * 100) / 100;
export const draftsFrom = (lines: { qty: number | null; description: string; amount: number }[] | null | undefined, fallback?: { description?: string | null; subtotal?: number }) =>
  lines && lines.length ? lines.map((l) => ({ qty: l.qty ? String(l.qty) : "", description: l.description, amount: String(l.amount) }))
    : [{ qty: "", description: fallback?.description || "", amount: fallback?.subtotal ? String(fallback.subtotal) : "" }];
export const draftsOut = (lines: LineDraft[]) => lines.map((l) => ({ qty: l.qty, description: l.description, amount: l.amount }));

const cell = "h-9 w-full rounded-md border border-gray-300 px-2 text-sm focus:border-brand-500 focus:outline-none";

export function LinesEditor({ lines, onChange }: { lines: LineDraft[]; onChange: (l: LineDraft[]) => void }) {
  const set = (i: number, k: keyof LineDraft, v: string) => onChange(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="text-sm">
      <div className="grid grid-cols-[80px_1fr_110px_28px] gap-2 text-xs font-medium text-gray-500">
        <span>Quantity</span><span>Description</span><span>Amount ($)</span><span />
      </div>
      {lines.map((l, i) => (
        <div key={i} className="mt-1 grid grid-cols-[80px_1fr_110px_28px] items-center gap-2">
          <input aria-label={`Line ${i + 1} quantity`} className={cell} value={l.qty} onChange={(e) => set(i, "qty", e.target.value)} inputMode="numeric" placeholder="Qty" />
          <input aria-label={`Line ${i + 1} description`} className={cell} value={l.description} onChange={(e) => set(i, "description", e.target.value)} placeholder={i === 0 ? "What this bills for" : "Another line"} autoComplete="off" />
          <input aria-label={`Line ${i + 1} amount`} className={cell} value={l.amount} onChange={(e) => set(i, "amount", e.target.value)} inputMode="decimal" placeholder="0.00" />
          <button type="button" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => onChange(lines.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between">
        <button type="button" onClick={() => onChange([...lines, emptyLine()])} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"><Plus className="h-3.5 w-3.5" />Add a line</button>
        <span className="text-xs text-gray-500">Leave the amount blank for a description-only line.</span>
      </div>
    </div>
  );
}

/** Deposit as a % or a flat $ amount. */
export function DepositInput({ mode, value, onMode, onValue, hint }: { mode: "pct" | "flat"; value: string; onMode: (m: "pct" | "flat") => void; onValue: (v: string) => void; hint?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-gray-600">
        <label htmlFor="gz-deposit">Deposit {mode === "pct" ? "(%)" : "($)"}</label>
        <span role="group" aria-label="Deposit type" className="inline-flex overflow-hidden rounded border border-gray-300 text-xs">
          <button type="button" onClick={() => onMode("pct")} aria-pressed={mode === "pct"} className={`px-2 py-0.5 ${mode === "pct" ? "bg-gray-800 text-white" : "text-gray-600"}`}>%</button>
          <button type="button" onClick={() => onMode("flat")} aria-pressed={mode === "flat"} className={`px-2 py-0.5 ${mode === "flat" ? "bg-gray-800 text-white" : "text-gray-600"}`}>$ flat</button>
        </span>
      </div>
      <input id="gz-deposit" className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm focus:border-brand-500 focus:outline-none" value={value} onChange={(e) => onValue(e.target.value)} inputMode="decimal" placeholder={mode === "pct" ? "50" : "0.00"} />
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </div>
  );
}
