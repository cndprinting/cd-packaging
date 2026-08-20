"use client";

// Estimating Tables — Paper Caliper Master + Fold Types.
// Mary's two spec emails (8/20/2026). She owns these values, so she can edit
// every one of them here; the classic estimator reads from them.
//
// Her rules, preserved on the page so they don't get lost:
//   - the table holds the DEFAULT caliper; a supplier's actual caliper wins
//   - folding is not just a speed list: fold + machine + caliper + scoring
//   - Run = Qty x (1 + waste%) / speed;  Total = Setup + Run;  Cost = Total x rate

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Caliper = {
  id: string; category: string; stockName: string; basisWeight: string | null;
  caliperMil: number; paperCategory: string; coated: boolean; coating: string | null;
  foldable: boolean; scoreRequired: string; specialHandling: string | null;
};
type Fold = {
  id: string; name: string; numFolds: number; configuration: string | null;
  machineName: string | null; pockets: string | null; setupMinutes: number;
  speedPerHour: number; scoringRequired: string; minCaliperMil: number | null;
  maxCaliperMil: number | null; wasteSheets: number; specialNotes: string | null;
  isSpecialty: boolean;
};

const cell = "border-b border-gray-100 px-3 py-1.5 text-sm";
const inputCls = "w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default function EstimatingTablesPage() {
  const [tab, setTab] = useState<"caliper" | "fold">("caliper");
  const [calipers, setCalipers] = useState<Caliper[]>([]);
  const [folds, setFolds] = useState<Fold[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/paper-fold-tables")
      .then((r) => r.json())
      .then((d) => { setCalipers(d.calipers || []); setFolds(d.folds || []); })
      .catch(() => setErr("Could not load the tables."));
  }, []);

  const save = useCallback(async (table: "caliper" | "fold", id: string, data: Record<string, unknown>) => {
    setSaving(id); setErr("");
    try {
      const res = await fetch("/api/paper-fold-tables", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id, data }),
      });
      if (!res.ok) throw new Error();
      setSaved(id); setTimeout(() => setSaved((s) => (s === id ? null : s)), 1500);
    } catch { setErr("That change did not save. Try again."); }
    finally { setSaving(null); }
  }, []);

  const byCategory = calipers.reduce<Record<string, Caliper[]>>((acc, c) => {
    (acc[c.category] ||= []).push(c); return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Estimating Tables</h1>
        <Link href="/dashboard/quotes/estimate-classic" className="text-sm text-brand-600 hover:underline">
          ← back to the estimator
        </Link>
      </div>
      <p className="mb-5 max-w-3xl text-sm text-gray-600">
        The reference tables the estimator reads from. Change a value here and every new
        quote picks it up. <strong>The caliper here is the default</strong> — if the mill
        gives an actual caliper for a stock, that always wins.
      </p>

      <div className="mb-4 flex gap-2">
        {(["caliper", "fold"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === t ? "bg-brand-600 text-white" : "border border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            {t === "caliper" ? `Paper Caliper (${calipers.length})` : `Fold Types (${folds.length})`}
          </button>
        ))}
      </div>
      {err && <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

      {tab === "caliper" && (
        <div className="space-y-6">
          {Object.entries(byCategory).map(([cat, rows]) => (
            <div key={cat} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">{cat}</div>
              <table className="w-full">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2 w-32">Caliper (mil)</th>
                    <th className="px-3 py-2 w-36">Score required</th>
                    <th className="px-3 py-2">Special handling</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className={cell}>{c.stockName}</td>
                      <td className={cell}>
                        <input type="number" step="0.1" className={inputCls} defaultValue={c.caliperMil}
                          onBlur={(e) => { const v = parseFloat(e.target.value); if (v !== c.caliperMil) save("caliper", c.id, { caliperMil: v }); }} />
                      </td>
                      <td className={cell}>
                        <select className={inputCls} defaultValue={c.scoreRequired}
                          onChange={(e) => save("caliper", c.id, { scoreRequired: e.target.value })}>
                          <option>No</option><option>Conditional</option><option>Yes</option>
                        </select>
                      </td>
                      <td className={cell}>
                        <input className={inputCls} defaultValue={c.specialHandling || ""} placeholder="—"
                          onBlur={(e) => save("caliper", c.id, { specialHandling: e.target.value })} />
                      </td>
                      <td className={cell + " text-xs text-gray-500"}>
                        {saving === c.id ? "saving…" : saved === c.id ? "saved" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === "fold" && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full min-w-[1000px]">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Fold</th>
                <th className="px-3 py-2 w-20">Folds</th>
                <th className="px-3 py-2">Machine</th>
                <th className="px-3 py-2 w-28">Setup (min)</th>
                <th className="px-3 py-2 w-28">Speed /hr</th>
                <th className="px-3 py-2 w-24">Waste %</th>
                <th className="px-3 py-2 w-32">Scoring</th>
                <th className="px-3 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {folds.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className={cell}>
                    <div className="font-medium text-gray-900">{f.name}</div>
                    {f.isSpecialty && <div className="text-xs text-gray-500">specialty</div>}
                  </td>
                  <td className={cell}>
                    <input type="number" className={inputCls} defaultValue={f.numFolds}
                      onBlur={(e) => save("fold", f.id, { numFolds: parseInt(e.target.value) || 1 })} />
                  </td>
                  <td className={cell}>
                    <input className={inputCls} defaultValue={f.machineName || ""}
                      onBlur={(e) => save("fold", f.id, { machineName: e.target.value })} />
                  </td>
                  <td className={cell}>
                    <input type="number" step="1" className={inputCls} defaultValue={f.setupMinutes}
                      onBlur={(e) => save("fold", f.id, { setupMinutes: parseFloat(e.target.value) || 0 })} />
                  </td>
                  <td className={cell}>
                    <input type="number" step="100" className={inputCls} defaultValue={f.speedPerHour}
                      onBlur={(e) => save("fold", f.id, { speedPerHour: parseInt(e.target.value) || 0 })} />
                  </td>
                  <td className={cell}>
                    <input type="number" step="0.5" className={inputCls} defaultValue={f.wasteSheets}
                      onBlur={(e) => save("fold", f.id, { wasteSheets: parseFloat(e.target.value) || 0 })} />
                  </td>
                  <td className={cell}>
                    <select className={inputCls} defaultValue={f.scoringRequired}
                      onChange={(e) => save("fold", f.id, { scoringRequired: e.target.value })}>
                      <option>No</option><option>Conditional</option><option>Yes</option>
                    </select>
                  </td>
                  <td className={cell + " text-xs text-gray-500"}>
                    {saving === f.id ? "saving…" : saved === f.id ? "saved" : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Folding time = quantity × (1 + waste %) ÷ speed, plus setup. Cost = total time ×
            the folder&apos;s hourly rate. Seeded rows other than Letter fold are best guesses —
            correct them here and the estimator follows.
          </div>
        </div>
      )}
    </div>
  );
}
