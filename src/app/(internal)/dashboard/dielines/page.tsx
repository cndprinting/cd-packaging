"use client";

import { useEffect, useMemo, useState } from "react";
import { Scissors, Download, Loader2, Info, Sparkles, LayoutGrid, Ruler } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Dieline module. v1 (Benjy 9/22): parametric STE/RTE from Todd's dies + die
// inventory check. v2 (Nitay 10/22): seven carton styles, near-size dies we
// already own, "size it for me" from a product description, and the press
// sheet optimizer with a pressman PDF.
interface Match { id: string; dieNumber: string; customerName: string | null; item: string | null; description: string | null; length: number | null; width: number | null; height: number | null; dielineUrl: string | null; dielineName: string | null; delta?: number[]; maxDelta?: number }
interface StyleInfo { code: string; name: string; aka: string; use: string; dims: string; fitted: boolean }
interface Result { style: StyleInfo; spec: { tuck: number; dust: number; comp: number; glue: number }; flat: { width: number; height: number }; svg: string; matches: Match[]; near: Match[]; unsized: number }
interface Plan { sheetW: number; sheetH: number; label: string; from?: string; nUp: number; grid: string; waste: number; sheets: number }
interface Nest { flat: { width: number; height: number }; plans: Plan[]; pick: Plan; svg: string }
interface Sizing { style: string; L: number; W: number; D: number; arrangement: string; productSize: string; assumptions: string[]; reasoning: string; alternatives: { style: string; why: string }[]; confidence: string; askCustomer: string[] }

const inputCls = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
const fmtDelta = (v: number) => (v === 0 ? "same" : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(3).replace(/\.?0+$/, "")}"`);

export default function DielinesPage() {
  const [styles, setStyles] = useState<StyleInfo[]>([]);
  const [style, setStyle] = useState("STE");
  const [L, setL] = useState("3.5"); const [W, setW] = useState("1.5"); const [D, setD] = useState("5.5");
  const [tuck, setTuck] = useState(""); const [dust, setDust] = useState("");
  const [tuckPanel, setTuckPanel] = useState<"far" | "near">("far");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // size it for me
  const [ask, setAsk] = useState("");
  const [sizing, setSizing] = useState<Sizing | null>(null);
  const [sizeBusy, setSizeBusy] = useState(false);
  const [sizeErr, setSizeErr] = useState<string | null>(null);
  // sheet optimizer
  const [qty, setQty] = useState("5000");
  const [nest, setNest] = useState<Nest | null>(null);
  const [nestBusy, setNestBusy] = useState(false);
  const [sheet, setSheet] = useState<string>("");

  useEffect(() => { fetch("/api/dielines").then((r) => r.json()).then((d) => setStyles(d.styles || [])).catch(() => {}); }, []);
  const info = styles.find((s) => s.code === style);
  const isTray = style === "RETF";

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

  // sheet plan follows the box + quantity
  useEffect(() => {
    const t = setTimeout(async () => {
      if (!(parseFloat(L) > 0 && parseFloat(W) > 0 && parseFloat(D) > 0)) return;
      setNestBusy(true);
      try {
        const r = await fetch("/api/dielines/nest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...JSON.parse(key), qty, sheet }) });
        const d = await r.json();
        setNest(r.ok ? d : null);
      } catch { setNest(null); }
      setNestBusy(false);
    }, 400);
    return () => clearTimeout(t);
  }, [key, qty, sheet, L, W, D]);

  const sizeIt = async () => {
    if (!ask.trim()) return;
    setSizeBusy(true); setSizeErr(null);
    try {
      const r = await fetch("/api/dielines/size", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: ask }) });
      const d = await r.json();
      if (!r.ok) { setSizeErr(d.error || "Sizing failed"); return; }
      setSizing(d);
      setStyle(d.style); setL(String(d.L)); setW(String(d.W)); setD(String(d.D)); setSheet("");
    } catch { setSizeErr("Sizing failed"); }
    finally { setSizeBusy(false); }
  };

  const download = () => {
    if (!res) return;
    const blob = new Blob([res.svg], { type: "image/svg+xml" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `dieline-${style}-${L}x${W}x${D}.svg`; a.click(); URL.revokeObjectURL(a.href);
  };
  const downloadLayout = async () => {
    const r = await fetch("/api/dielines/nest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...JSON.parse(key), qty, sheet, format: "pdf" }) });
    if (!r.ok) return;
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `press-layout-${style}-${L}x${W}x${D}.pdf`; a.click(); URL.revokeObjectURL(a.href);
  };

  const field = (label: string, v: string, set: (s: string) => void, ph?: string) => (
    <label className="block text-sm">
      <span className="text-gray-600">{label}</span>
      <input value={v} onChange={(e) => set(e.target.value)} placeholder={ph} inputMode="decimal" className={inputCls} />
    </label>
  );

  const dieRow = (m: Match, showDelta: boolean) => (
    <tr key={m.id} className="border-t border-gray-100">
      <td className="py-1 font-mono text-brand-600">{m.dieNumber}</td>
      <td>{m.customerName || "—"}</td>
      <td>{m.item || "—"}{m.description ? ` · ${m.description}` : ""}</td>
      <td className="whitespace-nowrap">{m.length} × {m.width} × {m.height}</td>
      {showDelta && <td className="whitespace-nowrap text-xs text-gray-600">{(m.delta || []).map(fmtDelta).join(" / ")}</td>}
      <td>{m.dielineUrl ? <a href={m.dielineUrl} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">PDF</a> : "—"}</td>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Scissors className="h-6 w-6 text-brand-600" />Dielines</h1>
        <p className="text-gray-500 text-sm mt-1">Size a carton, see the dieline, check the dies we already own, and pick the press sheet. Todd reviews before anything goes to the die maker.</p>
      </div>

      {/* Size it for me */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" />Size it for me</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sizeIt(); }}
              placeholder='e.g. "a box that fits 4 donuts" or "two 2 oz dropper bottles side by side"'
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
            <Button onClick={sizeIt} disabled={sizeBusy || !ask.trim()}>{sizeBusy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Sizing…</> : "Suggest a box"}</Button>
          </div>
          <div className="mt-1 text-xs text-gray-500">When the customer has no measurements. It fills the box below; confirm the real product with the customer before a die is cut.</div>
          {sizeErr && <div className="mt-2 text-sm text-red-600">{sizeErr}</div>}
          {sizing && (
            <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
              <div className="font-medium">{sizing.style} · {sizing.L} × {sizing.W} × {sizing.D} in inside · {sizing.arrangement}{sizing.confidence ? ` · ${sizing.confidence} confidence` : ""}</div>
              {sizing.productSize && <div className="mt-1 text-xs">Product assumed: {sizing.productSize}</div>}
              <div className="mt-1 text-xs">{sizing.reasoning}</div>
              {sizing.assumptions.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs">{sizing.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>}
              {sizing.alternatives.length > 0 && <div className="mt-1 text-xs">Also consider: {sizing.alternatives.map((a) => `${a.style} (${a.why})`).join("; ")}</div>}
              {sizing.askCustomer.length > 0 && <div className="mt-1 text-xs"><span className="font-medium">Ask the customer:</span> {sizing.askCustomer.join(" · ")}</div>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader><CardTitle className="text-base">Box</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <label className="block text-sm">
              <span className="text-gray-600">Style</span>
              <select value={style} onChange={(e) => { setStyle(e.target.value); setSheet(""); }} className={inputCls}>
                {styles.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.aka})</option>)}
              </select>
            </label>
            {info && <div className="rounded-md bg-gray-50 p-2 text-xs text-gray-600"><div>{info.use}</div><div className="mt-1 text-gray-500">{info.dims}.</div>{!info.fitted && <div className="mt-1 text-amber-700">Standard construction, not yet fitted to a C&D die. Todd to confirm flap depths.</div>}</div>}
            {field(isTray ? "Length (tray, lid hinge side, in)" : "Length (panel width, in)", L, setL)}
            {field(isTray ? "Width (tray, in)" : "Width (box thickness, in)", W, setW)}
            {field(isTray ? "Depth (tray height, in)" : "Depth (panel height, in)", D, setD)}
            {["STE", "RTE", "TTAB", "TTSB", "RETF"].includes(style) && (
              <div className="grid grid-cols-2 gap-3">
                {field("Tuck length", tuck, setTuck, res ? `auto ${res.spec.tuck}` : "auto")}
                {style !== "RETF" && field("Dust flap", dust, setDust, res ? `auto ${res.spec.dust}` : "auto")}
              </div>
            )}
            {["STE", "TTAB", "TTSB"].includes(style) && (
              <label className="block text-sm">
                <span className="text-gray-600">Tuck on</span>
                <select value={tuckPanel} onChange={(e) => setTuckPanel(e.target.value as "far" | "near")} className={inputCls}>
                  <option value="far">Back panel (C&D default)</option>
                  <option value="near">Panel next to glue flap</option>
                </select>
              </label>
            )}
            <div className="text-xs text-gray-500 flex gap-2 pt-1"><Info className="h-4 w-4 shrink-0" /><span>Decimals (2.125). Glue flap 5/8", 1/32" board comp, 15° dust flaps, slit-lock tucks.</span></div>
            {err && <div className="text-sm text-red-600">{err}</div>}
            {res && (
              <div className="rounded-md bg-gray-50 p-3 text-sm space-y-1">
                <div className="font-medium">Flat blank: {res.flat.width.toFixed(3)} × {res.flat.height.toFixed(3)} in</div>
                <div className="text-gray-500 text-xs">Tuck {res.spec.tuck}", dust flap {res.spec.dust}". The sheet plan below uses this blank.</div>
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
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Ruler className="h-4 w-4 text-brand-600" />Dies we already own</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-800">This size (within 1/16")</div>
                {!res || res.matches.length === 0 ? (
                  <div className="text-sm text-gray-500">None. A new die would be needed, unless a close size below works for the customer.</div>
                ) : (
                  <table className="w-full text-sm"><thead><tr className="text-left text-gray-500"><th className="py-1">Die #</th><th>Customer</th><th>Item</th><th>Size</th><th>Dieline</th></tr></thead>
                    <tbody>{res.matches.map((m) => dieRow(m, false))}</tbody></table>
                )}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-800">Close sizes (within 1" on every dimension, closest first)</div>
                <div className="text-xs text-gray-500 mb-1">Offer these before cutting a new die: an existing die means no die charge. Difference shown as die minus requested, L / W / D.</div>
                {!res || res.near.length === 0 ? (
                  <div className="text-sm text-gray-500">Nothing within an inch.</div>
                ) : (
                  <table className="w-full text-sm"><thead><tr className="text-left text-gray-500"><th className="py-1">Die #</th><th>Customer</th><th>Item</th><th>Size</th><th>Difference</th><th>Dieline</th></tr></thead>
                    <tbody>{res.near.map((m) => dieRow(m, true))}</tbody></table>
                )}
              </div>
              {res && res.unsized > 0 && <div className="text-xs text-amber-700">{res.unsized.toLocaleString()} dies in the inventory have no size on file and cannot be matched. Adding L × W × D to those records makes this list complete.</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><LayoutGrid className="h-4 w-4 text-brand-600" />Press sheet {nestBusy && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block text-sm w-40"><span className="text-gray-600">Quantity</span><input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" className={inputCls} /></label>
                <label className="block text-sm w-64"><span className="text-gray-600">Sheet</span>
                  <select value={sheet} onChange={(e) => setSheet(e.target.value)} className={inputCls}>
                    <option value="">Best (recommended)</option>
                    {nest?.plans.map((p) => <option key={p.label + (p.from || "")} value={p.label}>{p.label}{p.from ? ` · ${p.from}` : ""}</option>)}
                  </select></label>
                <Button variant="outline" onClick={downloadLayout} disabled={!nest}><Download className="h-4 w-4 mr-1" />Layout PDF for the pressman</Button>
              </div>
              {nest ? (
                <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_380px]">
                  <div>
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <div className="font-medium">Run on {nest.pick.label} in{nest.pick.from ? ` (${nest.pick.from})` : ""}: {nest.pick.nUp} up, {nest.pick.grid}</div>
                      <div className="text-xs mt-0.5">{(nest.pick.waste * 100).toFixed(1)}% waste{nest.pick.sheets ? ` · ${nest.pick.sheets.toLocaleString()} press sheets for ${Number(qty).toLocaleString()} before makeready and spoilage` : ""}. Gripper edge shaded.</div>
                    </div>
                    <div className="mt-2 rounded-md border border-gray-200 bg-white p-2 [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: nest.svg }} />
                  </div>
                  <div>
                    <table className="w-full text-xs"><thead><tr className="text-left text-gray-500"><th className="py-1">Sheet</th><th>Up</th><th>Waste</th><th>Sheets</th></tr></thead>
                      <tbody>{nest.plans.map((p, i) => (
                        <tr key={p.label + (p.from || "")} className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${p.label === nest.pick.label && (p.from || "") === (nest.pick.from || "") ? "bg-emerald-50" : ""}`} onClick={() => setSheet(p.label)}>
                          <td className="py-1">{i === 0 && !sheet ? "★ " : ""}{p.label}{p.from ? <span className="text-gray-400"> · {p.from}</span> : ""}</td><td>{p.nUp}</td><td>{(p.waste * 100).toFixed(0)}%</td><td>{p.sheets ? p.sheets.toLocaleString() : "—"}</td>
                        </tr>))}</tbody></table>
                    <div className="mt-2 text-[11px] text-gray-500">Ranked by fewest sheets for the quantity, then least waste. Komori max 23.25 × 29.75. Blanks are placed on their bounding box with 3/4" gripper, 1/8" side guide and 1/16" per blank dimension, same as the estimator. Grain, color bars and nesting into flap gaps are not counted yet.</div>
                  </div>
                </div>
              ) : <div className="mt-3 text-sm text-gray-500">Enter a box size to see the sheet plan.</div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
