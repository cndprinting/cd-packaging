"use client";

// FLEXPACK — flexible packaging estimator.
// Ported from HP's Indigo Wide Web Job Estimator v2.9.7.8, on C&D's own
// machine economics. Laid out in the same order as HP's sheet (job specs →
// production → cost → price) so anyone trained on that workbook recognises it.
//
// Deliberately NOT the amber E&M/DOS skin: this is a new discipline with its
// own tool, and Mary's muscle memory shouldn't be invoked here.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  defaultFlexPackForm, computeFlexPack,
  type FlexPackForm, type PricingMode,
} from "@/lib/flexpack-estimate";

type Any = Record<string, any>;
const money = (v: number) => `$${(Number.isFinite(v) ? v : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const n1 = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString("en-US", { maximumFractionDigits: 1 });

const inp = "w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600";
const lbl = "text-xs font-medium uppercase tracking-wide text-gray-500";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className={lbl}>{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-0.5 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}
function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white">
      <header className="border-b border-gray-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Line({ k, v, strong, accent }: { k: string; v: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1 ${strong ? "border-t border-gray-200 pt-2 mt-1" : ""}`}>
      <span className={`text-sm ${strong ? "font-semibold text-gray-900" : "text-gray-600"}`}>{k}</span>
      <span className={`font-mono text-sm tabular-nums ${accent ? "font-semibold text-teal-700" : strong ? "font-semibold text-gray-900" : "text-gray-800"}`}>{v}</span>
    </div>
  );
}

export default function FlexPackPage() {
  const [form, setForm] = useState<FlexPackForm>(() => defaultFlexPackForm());
  const [ref, setRef] = useState<{ materials: Any[]; structures: Any[]; machines: Any[]; formats: Any[]; settings: Any | null; quotes: Any[] }>(
    { materials: [], structures: [], machines: [], formats: [], settings: null, quotes: [] });
  const [draftQuoteId, setDraftQuoteId] = useState<string | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Same customer source as the classic and wizard estimators, so FlexPack
  // ties to the real Godzilla customer list. Free-typed names still work.
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    fetch("/api/companies").then((r) => r.json())
      .then((d) => setCompanies(d.companies || [])).catch(() => {});
  }, []);

  const set = useCallback(<K extends keyof FlexPackForm>(k: K, v: FlexPackForm[K]) =>
    setForm((f) => ({ ...f, [k]: v })), []);

  // Load reference data and adopt C&D's real machine rates.
  useEffect(() => {
    fetch("/api/flexpack").then((r) => r.json()).then((d) => {
      setRef(d);
      setForm((f) => {
        const next = { ...f };
        const by = (role: string) => (d.machines || []).find((m: Any) => m.role === role);
        const rate = (m: Any) => (m?.costPerHourOverride > 0 ? m.costPerHourOverride : 0);
        const press = by("press");
        if (press) {
          next.pressCostPerHour = rate(press) || next.pressCostPerHour;
          next.pressSetupMinutes = press.mrMinutes ?? next.pressSetupMinutes;
          next.pressSetupLinFt = press.mrLinFt ?? next.pressSetupLinFt;
          next.pressSetupLinFtPerSku = press.mrLinFtPerSku ?? next.pressSetupLinFtPerSku;
        }
        for (const [role, key] of [["lamination","lamination"],["slitRewind","slitRewind"],["seaming","seaming"],
                                   ["cutting","cutting"],["inspection","inspection"],["bagMaking","bagMaking"]] as const) {
          const m = by(role);
          if (!m) continue;
          (next as Any)[key] = {
            ...(next as Any)[key],
            costPerHour: rate(m) || (next as Any)[key].costPerHour,
            setupMinutes: m.mrMinutes ?? (next as Any)[key].setupMinutes,
            setupMinutesPerSku: m.mrMinutesPerSku ?? (next as Any)[key].setupMinutesPerSku,
            setupLinFt: m.mrLinFt ?? (next as Any)[key].setupLinFt,
            speedFpm: m.speedFpm ?? (next as Any)[key].speedFpm,
          };
        }
        const s = d.settings;
        if (s) {
          next.clickRates = { cmyovg: s.clickCmyovg, k: s.clickK, white: s.clickWhite,
                              premiumWhite: s.clickPremiumWhite, spot: s.clickSpot };
          next.prepressRatePerHour = s.prepressRatePerHour;
          next.prepressMinutesFirstSku = s.prepressMinsFirst;
          next.prepressMinutesPerSku = s.prepressMinsPerSku;
          next.runningWastePct = s.runningWastePct;
          next.substrateWidthIn = s.substrateWidthIn;
        }
        return next;
      });
    }).catch(() => setMsg("Could not load the reference tables."));
  }, []);

  // Reopen a saved FlexPack quote (Resume from Quotes & Estimates).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draftId");
    if (!id) return;
    fetch(`/api/quotes?id=${id}`).then((r) => r.json()).then((d) => {
      const q = d.quote || (Array.isArray(d.quotes) ? d.quotes[0] : null);
      if (!q?.specs) return;
      try {
        const parsed = JSON.parse(q.specs);
        if (parsed.method !== "flexpack" || !parsed.flexForm) return;
        setForm({ ...defaultFlexPackForm(), ...parsed.flexForm });
        setDraftQuoteId(q.id);
        setQuoteNumber(q.quoteNumber);
      } catch { /* not ours */ }
    }).catch(() => {});
  }, []);

  const calc = useMemo(() => computeFlexPack(form), [form]);

  const pickStructure = (name: string) => {
    const st = (ref.structures || []).find((x: Any) => x.name === name);
    if (!st) { set("structureName", name); return; }
    let names: string[] = [];
    try { names = JSON.parse(st.layers || "[]"); } catch { names = []; }
    const layers = names.map((ln) => {
      const m = (ref.materials || []).find((x: Any) => x.name === ln);
      return { name: ln, costPerMsi: m?.costPerMsi ?? 0, yieldIn2PerLb: m?.yieldIn2PerLb ?? undefined };
    });
    setForm((f) => ({ ...f, structureName: name, primerCostMsi: st.primerCostMsi, primerCostPerMsi: st.primerCostMsi ?? 0.015, layers } as FlexPackForm));
  };

  const save = async () => {
    if (!form.customerName.trim() || !form.jobTitle.trim()) { setMsg("Customer and job title are required."); return; }
    // /api/quotes rejects a quote with no quantity, so catch it here with a
    // useful message rather than a bare 400.
    if (!form.quantity || form.quantity <= 0) { setMsg("Enter a quantity before saving."); return; }
    setBusy(true); setMsg("");
    try {
      // Save into the MAIN quote table, the same way the classic estimator
      // does (specs.method tags which estimator made it). That way a FlexPack
      // quote shows up in Quotes & Estimates with every existing action —
      // send, print, archive, convert to job — instead of living in a silo.
      const payload = {
        customerName: form.customerName,
        productType: "FLEXIBLE_PACKAGING",
        productName: form.jobTitle,
        description: [
          form.structureName,
          form.bagWidthIn && form.bagLengthIn ? `${form.bagWidthIn}x${form.bagLengthIn}${form.gussetIn ? `x${form.gussetIn}` : ""} pouch` : "",
          `${form.skus} SKU${form.skus === 1 ? "" : "s"}`,
        ].filter(Boolean).join(" — "),
        quantity: form.quantity,
        unitPrice: calc.pricePerUnit,
        notes: "",
        specs: { method: "flexpack", flexForm: form },
      };
      const res = draftQuoteId
        ? await fetch("/api/quotes", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: draftQuoteId, ...payload, specs: JSON.stringify(payload.specs) }) })
        : await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, specs: JSON.stringify(payload.specs) }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Save failed");
      const q = d.quote || d;
      setDraftQuoteId(q.id); setQuoteNumber(q.quoteNumber);
      setMsg(`Saved as ${q.quoteNumber} — it's now in Quotes & Estimates.`);
    } catch (e: any) { setMsg(e.message || "Save failed."); }
    finally { setBusy(false); }
  };

  const convert = async () => {
    if (!draftQuoteId) { setMsg("Save the quote first."); return; }
    setBusy(true); setMsg("");
    try {
      // Same endpoint a carton quote uses, so a pouch job lands in the normal
      // production queue with every downstream step attached.
      const res = await fetch("/api/quotes", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftQuoteId, status: "ACCEPTED" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not convert");
      setMsg(d.job?.jobNumber
        ? `Job ticket ${d.job.jobNumber} created — it's in Jobs & Job Tickets.`
        : "Quote accepted. Open it in Quotes & Estimates to create the job ticket.");
    } catch (e: any) { setMsg(e.message || "Could not convert."); }
    finally { setBusy(false); }
  };

  const procRow = (key: "lamination" | "slitRewind" | "seaming" | "cutting" | "inspection" | "bagMaking", label: string) => {
    const p = (form as Any)[key];
    return (
      <label key={key} className="flex items-center justify-between gap-3 border-b border-gray-100 py-1.5 last:border-0">
        <span className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={!!p.enabled}
            onChange={(e) => setForm((f) => ({ ...f, [key]: { ...(f as Any)[key], enabled: e.target.checked } } as FlexPackForm))} />
          {label}
        </span>
        <span className="font-mono text-xs tabular-nums text-gray-400">
          {money(p.costPerHour)}/hr · {p.speedFpm || 0} fpm
        </span>
      </label>
    );
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-gray-900">FlexPack</h1>
            <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">Flexible Packaging Estimator</span>
            {quoteNumber && <span className="font-mono text-xs text-gray-500">{quoteNumber}</span>}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">
            HP Indigo wide web · linear feet and MSI · C&amp;D machine rates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/quotes" className="text-sm text-gray-500 hover:text-gray-800">Sheetfed quotes</Link>
          <button onClick={save} disabled={busy}
            className="rounded-md bg-teal-700 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50">
            {draftQuoteId ? "Save changes" : "Save quote"}
          </button>
          <button onClick={convert} disabled={busy || !draftQuoteId}
            className="rounded-md border border-gray-300 px-3.5 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40">
            Convert to job ticket
          </button>
        </div>
      </div>
      {msg && <div className="mb-4 rounded-md border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800">{msg}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* ── LEFT: job specs ── */}
        <div className="space-y-5">
          <Card title="Job">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Customer">
                <input className={inp} list="flexpack-customers" placeholder="type to search customers…"
                  value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
                <datalist id="flexpack-customers">
                  {companies.map((c) => <option key={c.id} value={c.name} />)}
                </datalist>
              </Field>
              <Field label="Job title"><input className={inp} value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} /></Field>
              <Field label="Quantity"><input type="number" className={inp} value={form.quantity} onChange={(e) => set("quantity", parseInt(e.target.value) || 0)} /></Field>
              <Field label="SKUs" hint="each extra SKU adds setup"><input type="number" className={inp} value={form.skus} onChange={(e) => set("skus", parseInt(e.target.value) || 1)} /></Field>
            </div>
          </Card>

          <Card title="Structure" sub="The film stack. Picking a structure loads its layers and cost per MSI.">
            <Field label="Structure">
              <select className={inp} value={form.structureName} onChange={(e) => pickStructure(e.target.value)}>
                <option value="">Choose a structure…</option>
                {(ref.structures || []).map((s: Any) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            {form.layers.length > 0 && (
              <div className="mt-3 rounded-md border border-gray-100 bg-gray-50 p-3">
                <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">Layers</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Primer · {form.structureName ? "DigiPrime 050" : ""}</span><span className="font-mono text-xs tabular-nums text-gray-700">{form.primerCostPerMsi.toFixed(3)}/MSI</span></div>
                  {form.layers.map((l, i) => (
                    <div key={i} className="flex justify-between gap-4 text-sm">
                      <span className="truncate text-gray-600">{l.name}</span>
                      <span className="font-mono text-xs tabular-nums text-gray-700">{l.costPerMsi.toFixed(3)}/MSI</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-gray-200 pt-1 text-sm font-medium">
                    <span className="text-gray-900">Total</span>
                    <span className="font-mono text-xs tabular-nums text-gray-900">{calc.materialCostPerMsi.toFixed(3)}/MSI</span>
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card title="Pouch &amp; imposition" sub="Bag geometry, then how many fit across and around the web.">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Field label="Bag width (in)"><input type="number" step="0.01" className={inp} value={form.bagWidthIn} onChange={(e) => set("bagWidthIn", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Bag length (in)"><input type="number" step="0.01" className={inp} value={form.bagLengthIn} onChange={(e) => set("bagLengthIn", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Gusset (in)"><input type="number" step="0.01" className={inp} value={form.gussetIn} onChange={(e) => set("gussetIn", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Gusset location">
                <select className={inp} value={form.gussetLocation} onChange={(e) => set("gussetLocation", e.target.value as any)}>
                  <option>Bottom</option><option>Side</option><option>None</option>
                </select>
              </Field>
              <Field label="Header (in)"><input type="number" step="0.01" className={inp} value={form.headerIn} onChange={(e) => set("headerIn", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Substrate width (in)"><input type="number" step="0.1" className={inp} value={form.substrateWidthIn} onChange={(e) => set("substrateWidthIn", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Usable web (in)" hint="after press marks"><input type="number" step="0.001" className={inp} value={form.usableWebWidthIn} onChange={(e) => set("usableWebWidthIn", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Max repeat (in)" hint="cylinder limit"><input type="number" step="0.1" className={inp} value={form.maxRepeatLengthIn} onChange={(e) => set("maxRepeatLengthIn", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Override across" hint="0 = calculated"><input type="number" className={inp} value={form.overrideAcross} onChange={(e) => set("overrideAcross", parseInt(e.target.value) || 0)} /></Field>
              <Field label="Override around" hint="0 = calculated"><input type="number" className={inp} value={form.overrideAround} onChange={(e) => set("overrideAround", parseInt(e.target.value) || 0)} /></Field>
            </div>
            <div className="mt-3 rounded-md bg-gray-50 px-3 py-2">
              <div className="mb-1 font-mono text-[11px] text-gray-500">
                {form.bagLengthIn || 0}&quot; × 2 {form.gussetLocation !== "None" && `+ ${form.gussetIn || 0}" gusset`} = {calc.printWidthIn.toFixed(2)}&quot; across ·
                {" "}{calc.repeatIn.toFixed(2)}&quot; around → {calc.perFrame} up
              </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-xs tabular-nums text-gray-600">
              <span>{calc.perFrame} per frame</span>
              <span>{calc.productionFrames.toLocaleString()} frames</span>
              <span>{n1(calc.productionLinFt)} production ft</span>
              <span>{n1(calc.setupLinFt)} setup ft</span>
              <span>{n1(calc.totalLinFt)} total ft</span>
              <span>{n1(calc.totalMsi)} MSI</span>
              <span className="text-amber-700">{(calc.wasteFactor * 100).toFixed(1)}% waste</span>
            </div>
            </div>
          </Card>

          <Card title="Colour" sub="Charged per impression as HP click rates, not plates.">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Field label="CMYOVG"><input type="number" className={inp} value={form.colorsCmyovg} onChange={(e) => set("colorsCmyovg", parseInt(e.target.value) || 0)} /></Field>
              <Field label="Black (K)"><input type="number" className={inp} value={form.colorsK} onChange={(e) => set("colorsK", parseInt(e.target.value) || 0)} /></Field>
              <Field label="White"><input type="number" className={inp} value={form.colorsWhite} onChange={(e) => set("colorsWhite", parseInt(e.target.value) || 0)} /></Field>
              <Field label="Premium white" hint="also bills a white click"><input type="number" className={inp} value={form.colorsPremiumWhite} onChange={(e) => set("colorsPremiumWhite", parseInt(e.target.value) || 0)} /></Field>
              <Field label="Spot"><input type="number" className={inp} value={form.colorsSpot} onChange={(e) => set("colorsSpot", parseInt(e.target.value) || 0)} /></Field>
            </div>
          </Card>

          <Card title="Press &amp; finishing" sub="Tick what the job runs through. Rates are C&amp;D's, from the machine table.">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Field label="Press speed (ft/min)"><input type="number" className={inp} value={form.pressSpeedFpm} onChange={(e) => set("pressSpeedFpm", parseFloat(e.target.value) || 0)} /></Field>
                <Field label="Running waste %"><input type="number" step="0.1" className={inp} value={form.runningWastePct} onChange={(e) => set("runningWastePct", parseFloat(e.target.value) || 0)} /></Field>
                <Field label="Zipper $ / bag"><input type="number" step="0.001" className={inp} value={form.zipperCostPerBag} onChange={(e) => set("zipperCostPerBag", parseFloat(e.target.value) || 0)} /></Field>
              </div>
              <div>
                <span className={lbl}>Processes</span>
                <div className="mt-1">
                  {procRow("lamination", "Lamination / OPV")}
                  {procRow("slitRewind", "Slit / rewind")}
                  {procRow("seaming", "Seaming")}
                  {procRow("cutting", "Cutting")}
                  {procRow("inspection", "Inspection")}
                  {procRow("bagMaking", "Bag making")}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
              <label className="flex items-center gap-2 text-sm text-amber-900">
                <input type="checkbox" checked={form.outsourceBags}
                  onChange={(e) => set("outsourceBags", e.target.checked)} />
                Buy pouches out instead of making them here
              </label>
              <p className="mt-1 text-xs text-amber-800">
                For work shipping before the bag line lands, or a format it can&apos;t run. Printing and lamination still run in-house.
              </p>
              {form.outsourceBags && (
                <div className="mt-2">
                  <select className={inp} value={form.outsourced?.format || ""}
                    onChange={(e) => {
                      const fmt = (ref.formats || []).find((x: Any) => x.format === e.target.value);
                      if (!fmt) { set("outsourced", null); return; }
                      let breaks: { qty: number; costPerM: number }[] = [];
                      try { breaks = JSON.parse(fmt.breaks || "[]"); } catch { breaks = []; }
                      const s = ref.settings || {};
                      set("outsourced", {
                        format: fmt.format, breaks,
                        zipperCostPerM: fmt.zipper ? (form.bagWidthIn || 0) * (s.outsourceZipperPerIn ?? 2) : 0,
                        skuCost: s.outsourceSkuCost ?? 25,
                        minimumOrder: s.outsourceMinOrder ?? 300,
                        upliftPct: s.outsourceUpliftPct ?? 0,
                      });
                    }}>
                    <option value="">Choose a pouch format…</option>
                    {(ref.formats || []).map((f: Any) => <option key={f.id} value={f.format}>{f.format}</option>)}
                  </select>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── RIGHT: live cost and price ── */}
        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card title="Cost">
            <Line k="Prepress" v={money(calc.prepressCost)} />
            <Line k="Press" v={money(calc.pressCost)} />
            {calc.laminationCost > 0 && <Line k="Lamination / OPV" v={money(calc.laminationCost)} />}
            {calc.slitRewindCost > 0 && <Line k="Slit / rewind" v={money(calc.slitRewindCost)} />}
            {calc.seamingCost > 0 && <Line k="Seaming" v={money(calc.seamingCost)} />}
            {calc.cuttingCost > 0 && <Line k="Cutting" v={money(calc.cuttingCost)} />}
            {calc.inspectionCost > 0 && <Line k="Inspection" v={money(calc.inspectionCost)} />}
            {calc.bagMakingCost > 0 && <Line k="Bag making" v={money(calc.bagMakingCost)} />}
            {calc.outsourcedBagCost > 0 && <Line k="Outsourced pouching" v={money(calc.outsourcedBagCost)} />}
            <Line k="HP consumables (clicks)" v={money(calc.clickCost)} />
            <Line k="Film material" v={money(calc.materialCost)} />
            {calc.zipperCost > 0 && <Line k="Zipper" v={money(calc.zipperCost)} />}
            <Line k="Total cost" v={money(calc.totalCost)} strong />
            <Line k="Cost / 1,000" v={money(calc.costPerM)} />
            <Line k="Cost / unit" v={`$${calc.costPerUnit.toFixed(4)}`} />
            <div className="mt-2 border-t border-gray-100 pt-2 font-mono text-[11px] tabular-nums text-gray-400">
              {n1(calc.totalMinutes)} min total · {(calc.totalMinutes / 60).toFixed(2)} hrs
            </div>
          </Card>

          <Card title="Price">
            <Field label="Pricing method">
              <select className={inp} value={form.pricingMode} onChange={(e) => set("pricingMode", e.target.value as PricingMode)}>
                <option value="pricePerM">Set price per 1,000</option>
                <option value="markup">Markup on cost</option>
                <option value="margin">Target margin</option>
              </select>
            </Field>
            <div className="mt-3">
              {form.pricingMode === "pricePerM" && <Field label="Price / 1,000"><input type="number" step="1" className={inp} value={form.pricePerM} onChange={(e) => set("pricePerM", parseFloat(e.target.value) || 0)} /></Field>}
              {form.pricingMode === "markup" && <Field label="Markup %"><input type="number" step="1" className={inp} value={form.markupPct} onChange={(e) => set("markupPct", parseFloat(e.target.value) || 0)} /></Field>}
              {form.pricingMode === "margin" && <Field label="Target margin %"><input type="number" step="1" className={inp} value={form.marginPct} onChange={(e) => set("marginPct", parseFloat(e.target.value) || 0)} /></Field>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Turn-time premium %"><input type="number" step="1" className={inp} value={form.turnTimePremiumPct} onChange={(e) => set("turnTimePremiumPct", parseFloat(e.target.value) || 0)} /></Field>
              <Field label="Commission %"><input type="number" step="1" className={inp} value={form.commissionPct} onChange={(e) => set("commissionPct", parseFloat(e.target.value) || 0)} /></Field>
            </div>
            <div className="mt-3">
              <Line k="Price / job" v={money(calc.sellingPrice)} strong accent />
              <Line k="Price / 1,000" v={money(calc.pricePerMOut)} />
              <Line k="Price / unit" v={`$${calc.pricePerUnit.toFixed(4)}`} />
              {calc.commission > 0 && <Line k="Commission" v={money(calc.commission)} />}
              <div className={`mt-2 rounded-md px-3 py-2 text-sm font-medium ${calc.marginPct >= 0.3 ? "bg-emerald-50 text-emerald-800" : calc.marginPct >= 0 ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}>
                Margin {money(calc.marginDollars)} · {(calc.marginPct * 100).toFixed(1)}%
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
