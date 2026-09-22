"use client";

import { useEffect, useMemo, useState } from "react";
import { Scissors, Download, Loader2, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Dieline module v1 — parametric tuck-end cartons from L x W x D. The rules
// come from Todd's own dies (see src/lib/dieline/tuck-box.ts), so a rep can
// size a box on a call and Todd only reviews; and the inventory check stops
// us ordering a die we already own (1,787 on file).
interface Match { id: string; dieNumber: string; customerName: string | null; item: string | null; description: string | null; length: number | null; width: number | null; height: number | null; dielineUrl: string | null; dielineName: string | null }
interface Result { spec: { tuck: number; dust: number; comp: number; glue: number }; flat: { width: number; height: number }; svg: string; matches: Match[] }

export default function DielinesPage() {
  const [style, setStyle] = useState<"STE" | "RTE">("STE");
  const [L, setL] = useState("3.5"); const [W, setW] = useState("1.5"); const [D, setD] = useState("5.5");
  const [tuck, setTuck] = useState(""); const [dust, setDust] = useState("");
  const [tuckPanel, setTuckPanel] = useState<"far" | "near">("far");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const key = useMemo(() => JSON.stringify({ style, L, W, D, tuck, dust, tuckPanel }), [style, L, W, D, tuck, dust, tuckPanel]);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!(parseFloat(L) > 0 && parseFloat(W) > 0 && parseFloat(D) > 0)) return;
      setBusy(true);
      try {
        const r = await fetch("/api/dielines", { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
        const d = await r.json();
        if (!r.ok) { setErr(d.error || "Could not generate"); setRes(null); } else { setErr(null); setRes(d); }
      } catch { setErr("Could not reach the server"); }
      setBusy(false);
    }, 300);
    return () => clearTimeout(t);
  }, [key, L, W, D]);

  const download = () => {
    if (!res) return;
    const blob = new Blob([res.svg], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dieline-${style}-${L}x${W}x${D}.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const field = (label: string, v: string, set: (s: string) => void, ph?: string) => (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} inputMode="decimal"
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Scissors className="h-6 w-6 text-brand-600" />Dielines</h1>
        <p className="text-gray-500 text-sm mt-1">Standard tuck-end cartons from a box size. Flap rules match Todd's existing dies; he reviews before anything goes to the die maker.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Box</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="block text-sm">
              <span className="text-gray-600">Style</span>
              <select value={style} onChange={(e) => setStyle(e.target.value as "STE" | "RTE")} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="STE">Straight tuck (STE)</option>
                <option value="RTE">Reverse tuck (RTE)</option>
              </select>
            </label>
            {field("Length (panel width, in)", L, setL)}
            {field("Width (box thickness, in)", W, setW)}
            {field("Depth (panel height, in)", D, setD)}
            <div className="grid grid-cols-2 gap-3">
              {field("Tuck length", tuck, setTuck, res ? `auto ${res.spec.tuck}` : "auto")}
              {field("Dust flap", dust, setDust, res ? `auto ${res.spec.dust}` : "auto")}
            </div>
            {style === "STE" && (
              <label className="block text-sm">
                <span className="text-gray-600">Tucks on</span>
                <select value={tuckPanel} onChange={(e) => setTuckPanel(e.target.value as "far" | "near")} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="far">Back panel (C&D default)</option>
                  <option value="near">Panel next to glue flap</option>
                </select>
              </label>
            )}
            <div className="text-xs text-gray-500 flex gap-2 pt-1"><Info className="h-4 w-4 shrink-0" /><span>Decimals or fractions as decimals (2.125). Glue flap 5/8", 1/32" board comp on the outer side panel and closure panels, 15° dust flaps, slit-lock tucks.</span></div>
            {err && <div className="text-sm text-red-600">{err}</div>}
            {res && (
              <div className="rounded-md bg-gray-50 p-3 text-sm space-y-1">
                <div className="font-medium">Flat blank: {res.flat.width.toFixed(3)} × {res.flat.height.toFixed(3)} in</div>
                <div className="text-gray-500 text-xs">Use this for imposition on the estimator. Tuck {res.spec.tuck}", dust flap {res.spec.dust}".</div>
                <Button size="sm" className="mt-2" onClick={download}><Download className="h-4 w-4 mr-1" />Download SVG</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2">Preview {busy && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}</CardTitle></CardHeader>
            <CardContent>
              {res ? (
                <div className="w-full overflow-auto rounded-md border border-gray-200 bg-white p-2 [&>svg]:max-w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: res.svg }} />
              ) : <div className="text-sm text-gray-400 py-12 text-center">Enter a box size</div>}
              <div className="mt-2 text-xs text-gray-500">Magenta = cut, blue dashed = crease.</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Dies we already own at this size</CardTitle></CardHeader>
            <CardContent>
              {!res || res.matches.length === 0 ? (
                <div className="text-sm text-gray-500">None within 1/16" in the die inventory. A new die would be needed.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-gray-500"><th className="py-1">Die #</th><th>Customer</th><th>Item</th><th>Size</th><th>Dieline</th></tr></thead>
                  <tbody>
                    {res.matches.map((m) => (
                      <tr key={m.id} className="border-t border-gray-100">
                        <td className="py-1 font-mono text-brand-600">{m.dieNumber}</td>
                        <td>{m.customerName || "—"}</td>
                        <td>{m.item || "—"}{m.description ? ` · ${m.description}` : ""}</td>
                        <td>{m.length} × {m.width} × {m.height}</td>
                        <td>{m.dielineUrl ? <a href={m.dielineUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">PDF</a> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="mt-2 text-xs text-gray-500">An existing die means no die charge on the quote.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
