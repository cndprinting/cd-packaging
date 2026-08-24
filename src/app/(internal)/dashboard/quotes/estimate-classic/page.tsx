"use client";

// ─────────────────────────────────────────────────────────────────────────
// CLASSIC ESTIMATOR — E&M Parsec-style 9-screen flow (built for Mary).
// One screen visible at a time, Enter advances field-to-field, PgUp/PgDn
// (or the numbered bar / Next / Back) move between screens. Every rate and
// difficulty factor is an editable number prefilled with a default, exactly
// like the DOS system. Nothing persists until "Save Quote".
// ─────────────────────────────────────────────────────────────────────────

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BINDERY_OPERATIONS,
  COATING_TYPES,
  ClassicForm,
  ClassicPart,
  JOB_TYPES,
  JobType,
  computeClassic,
  computeQuantityBreaks,
  defaultClassicForm,
  defaultClassicPart,
  defaultPressRun,
  planBooklet,
} from "@/lib/classic-estimate";
import { DigitalClickStandards, InkConfig, getDigitalSizeTier, inferInkConfig } from "@/lib/digital-clicks";

// ── Plant standards / presses (same endpoint the wizard estimator uses) ──
interface PressConfigData {
  id: string;
  configNumber: number;
  name: string;
  setupMinutes: number;
  speedUncoated: number;
  speedCoated: number;
  numColors: number;
  addToHourlyRate: number;
  numHelpers: number;
  plateCost: number;
}
interface PressData {
  id: string;
  pressNumber: number;
  name: string;
  pressType: string;
  costPerHour: number;
  helperCostPerHour: number;
  configurations: PressConfigData[];
}

const SCREENS = [
  "Main Entry",
  "Additional Instructions",
  "Job Type Selector",
  "Electronic Prepress",
  "Camera/Stripping/Platemaking",
  "Paper/Stock",
  "Press",
  "Bindery",
  "Cost Summary",
];

// ── Dense field primitives (amber-on-dark, monospace numbers) ──
const inputCls =
  "h-7 w-full rounded-sm border border-amber-700/60 bg-black/60 px-2 font-mono text-[13px] text-amber-200 " +
  "placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400";

function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`grid items-center gap-2 py-[3px] ${wide ? "grid-cols-[220px_1fr]" : "grid-cols-[220px_160px]"}`}>
      <div className="text-[12px] uppercase tracking-wide text-amber-400/90">{label}</div>
      {children}
    </div>
  );
}

// A PLANT-STANDARD row: a rate, speed or difficulty that is set once per
// machine, not decided per quote. E&M never put these on the quoting screens.
// Hidden behind the "Standards" toggle so Mary only sees what she must decide
// (Mary 8/19: "I'm just guessing what it wants ... the questions are not
// making sense"). Prefilled from PlantStandard; still editable when shown.
function StdRow({ label, children, show, wide }: {
  label: string; children: React.ReactNode; show: boolean; wide?: boolean;
}) {
  if (!show) return null;
  return (
    <div className={`grid items-center gap-2 py-[3px] ${wide ? "grid-cols-[220px_1fr]" : "grid-cols-[220px_160px]"}`}>
      <div className="text-[12px] uppercase tracking-wide text-amber-600/70">{label}</div>
      {children}
    </div>
  );
}

function Num({ value, onChange, step, readOnly }: {
  value: number; onChange?: (v: number) => void; step?: number; readOnly?: boolean;
}) {
  return (
    <input
      type="number"
      step={step ?? "any"}
      className={inputCls + " text-right" + (readOnly ? " opacity-60" : "")}
      value={Number.isFinite(value) ? value : 0}
      readOnly={readOnly}
      onChange={(e) => onChange && onChange(parseFloat(e.target.value) || 0)}
      onFocus={(e) => e.target.select()}
    />
  );
}

function Txt({ value, onChange, placeholder, list }: {
  value: string; onChange: (v: string) => void; placeholder?: string; list?: string;
}) {
  return (
    <input
      type="text"
      className={inputCls}
      value={value}
      placeholder={placeholder}
      list={list}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const money = (v: number) => `$${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
const hrs = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)} hrs`;

export default function ClassicEstimatorPage() {
  // useSearchParams requires a Suspense boundary in App Router client pages
  // (same pattern as the wizard estimator).
  return <Suspense><ClassicEstimatorContent /></Suspense>;
}

function ClassicEstimatorContent() {
  const searchParams = useSearchParams();
  const fromRequestId = searchParams.get("from");
  const draftIdFromUrl = searchParams.get("draftId");

  const [screen, setScreen] = useState(1); // 1..9
  // Plant standards (rates/speeds/difficulties) are hidden by default so the
  // quoting screens show only what Mary actually decides (Benjy/Mary 8/19).
  const [showStd, setShowStd] = useState(false);
  // ── AI ASSIST (Benjy 8/21) ── Mary describes the job in plain English and
  // the assistant fills the form; or she asks a question and gets an answer
  // in the context of what's on her screen. Nothing saves without her.
  const [aiOpen, setAiOpen] = useState(true);
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState<false | "fill" | "ask">(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiNotes, setAiNotes] = useState<string[]>([]);
  const [aiMissing, setAiMissing] = useState<string[]>([]);
  // Save-time sanity checker (#3): advisory flags after a manual save.
  const [checkFlags, setCheckFlags] = useState<string[] | null>(null);
  const [checking, setChecking] = useState(false);
  const runAssist = async (mode: "fill" | "ask") => {
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(mode); setAiAnswer(""); setAiNotes([]); setAiMissing([]);
    try {
      const res = await fetch("/api/estimator-assist", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, text: aiText, form, partIndex }),
      });
      const d = await res.json();
      if (!res.ok) { setAiAnswer(d.error || "That didn't work — try again."); return; }
      if (mode === "ask") { setAiAnswer(d.answer || "No answer came back."); return; }
      let planNote = "";
      // Apply: job-level fields flat; part 1 also flat; parts 2..N into parts[]
      setForm((f) => {
        let next: ClassicForm = { ...f, ...(d.job || {}) };
        const parts: Partial<ClassicPart>[] = d.parts || [];
        if (parts[0]) next = { ...next, ...parts[0] };
        if (parts.length > 1) {
          const rest = [...(next.parts || [])];
          parts.slice(1).forEach((p, i) => {
            rest[i] = { ...defaultClassicPart(), ...(rest[i] || {}), ...p };
          });
          next = { ...next, parts: rest, numParts: Math.max(next.numParts || 1, parts.length) };
        }
        // Booklet? Run the signature planner on what the AI just set and
        // fill the press runs too -- Mary asked the system to compute the
        // sig breakdown itself (8/24), so a fill should finish the job.
        const plan = planBooklet(
          Number(next.numPages) || 0,
          Number(next.finishedWidthIn) || 0, Number(next.finishedHeightIn) || 0,
          Number(next.sheetWidthRun) || 0, Number(next.sheetHeightRun) || 0,
          Number(next.runColorsSide1) || 0, Number(next.runColorsSide2) || 0);
        if (plan && !((next.runs || []).length)) {
          const qty = Number(next.quantity) || 0;
          next = {
            ...next,
            signatureRuns: 1, sheetsPerPiece: 1,
            runs: plan.sigs.map((sig) => ({
              ...defaultPressRun(),
              label: `(${sig.style === "SHEETWISE" ? sig.sheetsPerPiece : 1}) ${sig.pages}pg sig ${sig.style}${sig.outs > 1 ? ` ${sig.outs} out` : ""}`,
              sheets: Math.ceil(qty * sig.sheetsPerPiece),
              workAndTurn: sig.style === "WORK & TURN",
              runColorsSide1: Number(next.runColorsSide1) || 0,
              runColorsSide2: Number(next.runColorsSide2) || 0,
              plates: sig.plates,
              makereadySheets: sig.plates * 100 + 100,
              runWastePct: 3,
            })),
          };
          planNote = "Signatures planned for you: " + plan.text;
        }
        return next;
      });
      if (planNote) d.notes = [...(d.notes || []), planNote];
      setAiNotes(d.notes || []);
      setAiMissing(d.missing || []);
      if (!(d.notes || []).length && !(d.missing || []).length) setAiAnswer("Nothing in that description mapped to the form — try adding sizes, quantity, colors, or the fold.");
    } catch {
      setAiAnswer("The assistant hit a snag — try again.");
    } finally { setAiBusy(false); }
  };
  // Bindery machines from plant standards — E&M picks a folder/stitcher by
  // name and takes its speed and rate from the machine (Benjy 8/19).
  const [folders, setFolders] = useState<{ name: string; rate: number; speed: number; setupHrs: number }[]>([]);
  const [stitchers, setStitchers] = useState<{ name: string; rate: number; speed: number }[]>([]);
  // Mary's two reference tables (8/20) — Paper Caliper Master and Fold Types.
  const [foldTypes, setFoldTypes] = useState<any[]>([]);
  const [calipers, setCalipers] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/paper-fold-tables").then((r) => r.json())
      .then((d) => { setFoldTypes(d.folds || []); setCalipers(d.calipers || []); })
      .catch(() => {});
  }, []);
  // "Start from a past quote" -- searches EVERY saved quote (each stores its
  // full form in specs) plus the 45 validated E&M seeds. Debounced typeahead.
  const [templates, setTemplates] = useState<{ source: string; label: string; form: any }[]>([]);
  const [tplQuery, setTplQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      fetch("/api/quote-templates?q=" + encodeURIComponent(tplQuery))
        .then((r) => r.json())
        .then((d) => setTemplates(d.templates || [])).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [tplQuery]);
  const [form, setForm] = useState<ClassicForm>(defaultClassicForm);
  // Resume-from-draft: once set, Save updates this quote instead of creating
  // a new one each time (mirrors the wizard's draftQuoteId flow).
  const [draftQuoteId, setDraftQuoteId] = useState<string | null>(draftIdFromUrl);
  const [draftQuoteNumber, setDraftQuoteNumber] = useState<string | null>(null);
  // Multi-part: which part Screens 6-8 are editing (0 = Part 1 / flat fields)
  const [partIndex, setPartIndex] = useState(0);
  // Pickup Estimate (E&M reprint pickup) — searchable list of past Classic quotes
  const [classicQuotes, setClassicQuotes] = useState<{ id: string; quoteNumber: string; customerName: string }[]>([]);
  const [pickupValue, setPickupValue] = useState("");
  const [pickupLoaded, setPickupLoaded] = useState<string | null>(null);
  // Die inventory lookup (1,842 CuttingDie rows via /api/dies?search=)
  const [dieOptions, setDieOptions] = useState<{ dieNumber: string; customerName: string | null; item: string | null; description: string | null; length: number | null; width: number | null; height: number | null }[]>([]);
  // Stock picker — E&M paper history (PaperUsage: description + pricePerM + weight)
  const [stockOptions, setStockOptions] = useState<{ description: string; pricePerM: number | null; weight: string | null; size: string | null }[]>([]);
  const [presses, setPresses] = useState<PressData[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null }[]>([]);
  const [standards, setStandards] = useState<(DigitalClickStandards & Record<string, unknown>) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ quoteNumber: string; id: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Draft autosave (Mary 8/10 lost an unsaved quote). Once the minimum fields
  // exist, edits quietly persist as a DRAFT so nothing is lost by navigating
  // away — the same failure the notes and inline-edit autosave already fixed.
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const set = useCallback(<K extends keyof ClassicForm>(key: K, value: ClassicForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // Load plant standards + presses once; prefill editable defaults from them.
  useEffect(() => {
    fetch("/api/plant-standards")
      .then((r) => r.json())
      .then((data) => {
        if (data.presses) setPresses(data.presses);
        if (data.standards) {
          const s = data.standards;
          {
          setFolders([1, 2, 3].map((i) => ({
            name: String((s as any)[`folder${i}Name`] || "").trim(),
            rate: Number((s as any)[`folder${i}Rate`]) || 48,
            speed: Number((s as any)[`folder${i}Speed`]) || 6500,
            setupHrs: (Number((s as any)[`folder${i}SetupMinutes`]) || 20) / 60,
          })).filter((m) => m.name));
          setStitchers([1, 2].map((i) => ({
            name: String((s as any)[`saddleStitch${i}Name`] || "").trim(),
            rate: Number((s as any)[`saddleStitch${i}Rate`]) || 95,
            speed: Number((s as any)[`saddleStitch${i}Speed`]) || 8000,
          })).filter((m) => m.name));
                  }

          setStandards(s);
          setForm((f) => ({
            ...f,
            // Markups deliberately KEEP the E&M defaults (33/16/24/40) rather than
            // loading PlantStandard's — parity with Mary's screens wins; she
            // overrides per job exactly like Parsec (Benjy 7/20).
            // Proof charges from Phase-1 plant standards
            colorProofCharge: Number(s.hiResProofCost) || f.colorProofCharge,
            laserProofCharge: Number(s.lowResProofCost) || f.laserProofCharge,
            // Ink factor: thousand sq-in per lb (coated color coverage)
            inkFactorMsqinPerLb: Number(s.coverageColorCoated) || f.inkFactorMsqinPerLb,
            skidCost: Number(s.skidCost) || f.skidCost,
            cartonCost: Number(s.carton1Cost) || f.cartonCost,
            // E&M-seeded standards found in PlantStandard (Benjy 7/20) — these
            // replace the hand-picked placeholders:
            inkBlackDollarsPerLb: Number(s.inkBlackPerLb) || f.inkBlackDollarsPerLb,   // $10.81/lb
            inkDollarsPerLb: Number(s.inkColorPerLb) || f.inkDollarsPerLb,           // process $10.81/lb
            inkPmsDollarsPerLb: Number(s.inkPmsPerLb) || f.inkPmsDollarsPerLb,       // $19.50/lb (LED has no std - placeholder)
            varnishDollarsPerLb: Number(s.inkVarnishPerLb) || f.varnishDollarsPerLb,  // $5.50/lb
            prepressRate: Number(s.artworkRate) || f.prepressRate,                    // $60/hr
            drillHrsPerHole: Number(s.drillTimePerHoleSec) > 0 ? Number(s.drillTimePerHoleSec) / 3600 : f.drillHrsPerHole, // 4 sec/hole
            bundleRatePerHr: Number(s.wrapLaborMinutesPerBundle) > 0 ? 60 / Number(s.wrapLaborMinutesPerBundle) : f.bundleRatePerHr, // 1 min/bundle = 60/hr
            binderyHourlyRate: Number(s.trimmingRate) || f.binderyHourlyRate,         // $45/hr trimming rate
            cutSecPerCut: Number(s.cutTimePerCutSec) || f.cutSecPerCut,               // 8 sec/cut
            // Speed-cap rules (E&M-seeded): heavy coverage + thick board caps
            solidCoverageSpeed: Number(s.solidCoveragePressSpeed) || f.solidCoverageSpeed,
            heavyCoveragePct: Number(s.heavyCoverageThresholdPct) || f.heavyCoveragePct,
            boardCapInches: Number(s.boardThicknessCapInches) || f.boardCapInches,
            boardCapSpeed: Number(s.boardThicknessMaxSpeed) || f.boardCapSpeed,
            // Press helper rate (Mary 7/21): DB presses mostly carry $0
            // helperCostPerHour, so default the helper rate to the hand-
            // bindery rate ($22.50) — press select only overrides it when
            // the press has its own nonzero rate.
            helperHourlyRate: f.helperHourlyRate || Number(s.handBinderyRate) || 22.5,
            // Folder machine rate (E&M #348538 folding line ≈ $48/hr)
            folderRatePerHr: Number(s.folder1Rate) || f.folderRatePerHr,
            folderConfig: f.folderConfig || String(s.folder1Name || ""),
            folderSpeedPerHr: Number(s.folder1Speed) || f.folderSpeedPerHr,
            foldSetupHrs: f.foldSetupHrs || (Number(s.folder1SetupMinutes) || 0) / 60,
            // Saddle stitcher (Mueller) rate + speed from plant standards
            // (Mary 8/10 — the whole saddle line was missing before).
            stitchRatePerHr: Number(s.saddleStitch1Rate) || f.stitchRatePerHr,
            stitchSpeed: Number(s.saddleStitch1Speed) || f.stitchSpeed,
            stitchHelpRatePerHr: Number(s.handBinderyRate) || f.stitchHelpRatePerHr,
          }));
        }
      })
      .catch(() => {});
    // Customer list — same source as the wizard estimator, so Screen 1 ties to
    // the uploaded Godzilla customers (Benjy 7/20). Free-typed names still work.
    fetch("/api/companies")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies || []))
      .catch(() => {});
    // Pickup list — past Classic quotes only (estimateMethod flag from the list API).
    fetch("/api/quotes")
      .then((r) => r.json())
      .then((d) => setClassicQuotes(
        (d.quotes || [])
          .filter((q: { estimateMethod?: string }) => q.estimateMethod === "classic")
          .map((q: { id: string; quoteNumber: string; customerName: string }) => ({ id: q.id, quoteNumber: q.quoteNumber, customerName: q.customerName }))
      ))
      .catch(() => {});
    // Stock picker source — E&M paper purchase history (has real prices/M).
    fetch("/api/paper-usage")
      .then((r) => r.json())
      .then((d) => {
        const seen = new Set<string>();
        const opts: { description: string; pricePerM: number | null; weight: string | null; size: string | null }[] = [];
        for (const rec of d.records || []) {
          const desc = (rec.description || "").trim();
          if (!desc || seen.has(desc.toLowerCase())) continue; // newest first — keep latest price
          seen.add(desc.toLowerCase());
          opts.push({ description: desc, pricePerM: Number(rec.pricePerM) || null, weight: rec.weight || null, size: rec.size || null });
        }
        setStockOptions(opts);
      })
      .catch(() => {});
  }, []);

  // ── Multi-part plumbing ──────────────────────────────────────────────
  const numParts = Math.max(1, Math.floor(form.numParts || 1));
  // Keep parts[] padded to numParts-1 entries (never trim — Mary may flip back).
  useEffect(() => {
    setForm((f) => {
      const need = Math.max(0, Math.floor(f.numParts || 1) - 1);
      if ((f.parts?.length || 0) >= need) return f;
      const parts = [...(f.parts || [])];
      while (parts.length < need) parts.push(defaultClassicPart());
      return { ...f, parts };
    });
  }, [form.numParts]);
  useEffect(() => { setPartIndex((i) => Math.min(i, numParts - 1)); }, [numParts]);

  // Part-aware read/write for Screen 6-8 fields: part 1 = flat form fields,
  // part N = parts[N-2]. Everything else keeps using form/set directly.
  const pv = useCallback(<K extends keyof ClassicPart>(k: K): ClassicPart[K] => {
    if (partIndex === 0) return form[k];
    return ((form.parts[partIndex - 1] || defaultClassicPart()) as ClassicPart)[k];
  }, [form, partIndex]);
  const patchP = useCallback((patch: Partial<ClassicPart>) => {
    setForm((f) => {
      if (partIndex === 0) return { ...f, ...patch };
      const parts = [...(f.parts || [])];
      parts[partIndex - 1] = { ...defaultClassicPart(), ...(parts[partIndex - 1] || {}), ...patch };
      return { ...f, parts };
    });
  }, [partIndex]);
  const setP = useCallback(<K extends keyof ClassicPart>(k: K, v: ClassicPart[K]) => {
    patchP({ [k]: v } as Partial<ClassicPart>);
  }, [patchP]);

  // ── Die lookup: debounced search of the die inventory as Mary types ──
  const activeDieNumber = String(
    partIndex === 0 ? form.dieNumber : (form.parts[partIndex - 1]?.dieNumber ?? "")
  );
  useEffect(() => {
    const q = activeDieNumber.trim();
    if (q.length < 2) { setDieOptions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/dies?search=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setDieOptions(d.dies || []))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [activeDieNumber]);
  const dieMatch = useMemo(() => {
    const q = activeDieNumber.trim().toLowerCase();
    if (!q) return null;
    return dieOptions.find((d) => d.dieNumber.toLowerCase() === q) || null;
  }, [dieOptions, activeDieNumber]);

  // ── Pickup Estimate: load a past Classic quote as a NEW estimate ──
  const onPickup = useCallback((v: string) => {
    setPickupValue(v);
    const m = classicQuotes.find(
      (q) => `${q.quoteNumber} — ${q.customerName}` === v || q.quoteNumber === v.trim()
    );
    if (!m) return;
    fetch(`/api/quotes?id=${m.id}`)
      .then((r) => r.json())
      .then((d) => {
        const q = (d.quotes || [])[0];
        if (!q) return;
        let specs: { method?: string; classicForm?: Partial<ClassicForm> } = {};
        try { specs = q.specs ? JSON.parse(q.specs) : {}; } catch {}
        if (specs.method !== "classic" || !specs.classicForm) return;
        const cf = specs.classicForm;
        setForm({
          ...defaultClassicForm(),
          ...cf,
          jobType: "Exact Reprint", // pickup default — Mary flips to Reprint w/Changes as needed
          instructions: [`Picked up from ${m.quoteNumber}`, cf.instructions || ""].filter(Boolean).join("\n"),
        });
        // A pickup is a NEW estimate — never overwrite the source quote.
        setDraftQuoteId(null);
        setDraftQuoteNumber(null);
        setSaved(null);
        setPartIndex(0);
        setPickupLoaded(m.quoteNumber);
      })
      .catch(() => {});
  }, [classicQuotes]);

  // ── Stock picker: exact description match prefills price/M + caliper ──
  const onStockDescription = useCallback((v: string) => {
    const m = stockOptions.find((o) => o.description.toLowerCase() === v.trim().toLowerCase());
    if (!m) { setP("stockDescription", v); return; }
    patchP({
      stockDescription: v,
      ...(m.pricePerM && m.pricePerM > 0 ? { pricePerM: m.pricePerM } : {}),
      ...(m.weight ? { caliperBasisWeight: m.weight } : {}),
    });
  }, [stockOptions, setP, patchP]);

  // ── Coating type change: prefill $/lb from PlantStandard (AQ/UV →
  // inkAqueousPerLb, Varnish → inkVarnishPerLb) — but only when the $ field
  // still holds 0 or a prior auto value, so a hand-typed price sticks. ──
  const coatingAutoRate = useCallback((type: string): number => {
    if (!type) return 0;
    if (type === "Varnish") return Number(standards?.inkVarnishPerLb) || 5.5;
    // Gloss/Matte/Satin AQ and UV all prefill from the aqueous rate (UV has
    // no dedicated PlantStandard rate — Mary overrides as needed).
    return Number(standards?.inkAqueousPerLb) || 18;
  }, [standards]);
  const onCoatingType = useCallback((type: string) => {
    const cur = Number(pv("coatingDollarsPerLb")) || 0;
    const autoValues = [0, 5.5, 18, Number(standards?.inkVarnishPerLb) || 5.5, Number(standards?.inkAqueousPerLb) || 18];
    patchP({
      coatingType: type,
      ...(autoValues.includes(cur) ? { coatingDollarsPerLb: coatingAutoRate(type) } : {}),
    });
  }, [pv, patchP, standards, coatingAutoRate]);

  // ── Pre-fill from a Quote Request (?from=<quoteRequestId>) — same source
  // and field mapping the wizard uses, translated to E&M vocabulary. ──
  useEffect(() => {
    if (!fromRequestId) return;
    fetch("/api/quote-requests")
      .then((r) => r.json())
      .then((d) => {
        const req = (d.requests || []).find((x: { id: string }) => x.id === fromRequestId) as Record<string, unknown> | undefined;
        if (!req) return;
        const r = req as Record<string, any>;
        const qrLineItems: Record<string, any>[] = Array.isArray(r.lineItems) ? r.lineItems : [];
        const firstLine = qrLineItems[0] || {};
        const primaryQty = qrLineItems.length > 0
          ? Number(firstLine.quantity) || 0
          : Number(r.quantity1 || r.quantity2 || r.quantity3 || 0);
        const flatW = Number(firstLine.flatWidth) || Number(r.flatWidth) || 0;
        const flatH = Number(firstLine.flatHeight) || Number(r.flatHeight) || 0;
        // Same colors mapping the wizard uses (colorsSide1/2 enum → counts).
        const mapColors = (c: string | null | undefined, isBack: boolean): number | null => {
          if (!c) return null;
          if (c === "4_process") return 4;
          if (c === "process_1pms") return 5;
          if (c === "process_2pms") return 6;
          if (c === "black" || c === "pms") return 1;
          if (isBack && c === "none") return 0;
          return null;
        };
        const s1 = mapColors(r.colorsSide1, false);
        const s2 = mapColors(r.colorsSide2, true);
        // Line Notes labeled per version — parity with the wizard (Benjy 7/20).
        const instructions = [
          r.specialInstructions, r.customColorCoatingNotes, r.artworkNotes,
          ...qrLineItems.filter((li) => li.notes).map((li, i) => `${li.version || `Line ${i + 1}`}: ${li.notes}`),
        ].filter(Boolean).join(" | ");
        setForm((f) => ({
          ...f,
          customerName: r.customerName || f.customerName,
          jobTitle: r.jobTitle || r.descriptionType || f.jobTitle,
          quantity: primaryQty || f.quantity,
          numParts: qrLineItems.length > 1 ? qrLineItems.length : f.numParts,
          sheetWidthRun: flatW || f.sheetWidthRun,
          sheetHeightRun: flatH || f.sheetHeightRun,
          numPages: Number(r.pages) || f.numPages,
          runColorsSide1: s1 ?? f.runColorsSide1,
          runColorsSide2: s2 ?? f.runColorsSide2,
          // Keep the digital branch consistent in case Mary flips to Digital Direct.
          digitalInkConfig: s1 != null ? inferInkConfig(s1, s2 ?? 0) : f.digitalInkConfig,
          stockDescription: r.paperDescription || f.stockDescription,
          caliperBasisWeight: r.paperWeight ? String(r.paperWeight) : f.caliperBasisWeight,
          deliveryZone: r.deliveryInstructions || f.deliveryZone,
          instructions: instructions || f.instructions,
          // Job type stays at the "New With Pre-Press" default — QuoteRequest
          // has no offset/digital flag; Mary picks on Screen 3.
        }));
      })
      .catch(() => {});
  }, [fromRequestId]);

  // ── Resume a Classic draft (?draftId=<quoteId>) — the full form was stashed
  // in specs JSON on save; merge over defaults so old drafts survive new fields. ──
  useEffect(() => {
    if (!draftIdFromUrl) return;
    fetch(`/api/quotes?id=${draftIdFromUrl}`)
      .then((r) => r.json())
      .then((d) => {
        const q = (d.quotes || []).find((x: { id: string }) => x.id === draftIdFromUrl);
        if (!q) return;
        let specs: { method?: string; classicForm?: Partial<ClassicForm> } = {};
        try { specs = q.specs ? JSON.parse(q.specs) : {}; } catch {}
        if (specs.method === "classic" && specs.classicForm) {
          setForm({ ...defaultClassicForm(), ...specs.classicForm });
        }
        setDraftQuoteId(q.id);
        setDraftQuoteNumber(q.quoteNumber || null);
      })
      .catch(() => {});
  }, [draftIdFromUrl]);

  // Exact-name match (case-insensitive) → auto-fill address + customer # once.
  const onCustomerName = useCallback((name: string) => {
    setForm((f) => {
      const match = companies.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (!match) return { ...f, customerName: name };
      const addr = [match.address, [match.city, match.state].filter(Boolean).join(", "), match.zip].filter(Boolean).join(", ");
      return {
        ...f,
        customerName: match.name,
        address: f.address || addr,
        customerNumber: f.customerNumber || match.id.slice(-6).toUpperCase(),
      };
    });
  }, [companies]);

  const calc = useMemo(() => computeClassic(form, standards), [form, standards]);
  // Quantity tiers — primary quantity first, then each additional quantity.
  const quantityBreaks = useMemo(() => computeQuantityBreaks(form, standards), [form, standards]);
  // Active part's computed detail for the Screen 6-8 readouts.
  const pcalc = calc.partCalcs[Math.min(partIndex, calc.partCalcs.length - 1)] || calc.partCalcs[0];

  // Press selection for the ACTIVE part (Screen 7 UI)...
  const selectedPress = useMemo(
    () => presses.find((p) => p.id === pv("pressId")) || null,
    [presses, pv]
  );
  // ...and for part 1 (used by the save payload's jobTicket).
  const part1Press = useMemo(
    () => presses.find((p) => p.id === form.pressId) || null,
    [presses, form.pressId]
  );

  // ── Keyboard: Enter advances field-to-field; PgUp/PgDn change screens ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "PageDown") { e.preventDefault(); setScreen((s) => Math.min(9, s + 1)); return; }
    if (e.key === "PageUp") { e.preventDefault(); setScreen((s) => Math.max(1, s - 1)); return; }
    if (e.key !== "Enter") return;
    const t = e.target as HTMLElement;
    if (t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A") return;
    e.preventDefault();
    const root = bodyRef.current;
    if (!root) return;
    const fields = Array.from(
      root.querySelectorAll<HTMLElement>("input:not([readonly]):not([disabled]), select:not([disabled]), textarea:not([disabled])")
    );
    const idx = fields.indexOf(t);
    if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus();
    else if (idx === fields.length - 1) setScreen((s) => Math.min(9, s + 1));
  }, []);

  // Focus the first field whenever the screen changes.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>("input:not([readonly]), select, textarea");
    first?.focus();
  }, [screen]);

  // ── Save: POST to the real quotes API (produces a quote in /dashboard/quotes) ──
  async function saveQuote(opts?: { silent?: boolean }) {
    const silent = opts?.silent === true;
    if (!silent) setSaveError(null);
    if (!form.customerName || !form.jobTitle || !form.quantity) {
      // Autosave just waits until the minimum fields exist — no error, no jump.
      if (silent) return;
      setSaveError("Customer name, job title and quantity are required (Screen 1).");
      setScreen(1);
      return;
    }
    // A hand save must win over an in-flight autosave; never run two at once.
    if (silent) { if (saving || autoSaving) return; setAutoSaving(true); }
    else setSaving(true);
    try {
      const qty = form.quantity || 1;
      const isDigital = calc.isDigital;
      const cfg = part1Press?.configurations.find((c) => c.id === form.pressConfigId) || null;
      // Effective parts (part 1 = flat fields) for die #s and part notes.
      const allParts: ClassicPart[] = [form, ...(form.parts || []).slice(0, Math.max(0, numParts - 1))];
      const dieNumbers = allParts.map((p) => (p.dieNumber || "").trim()).filter(Boolean);

      // ── costBreakdown — same field semantics as the wizard so the quote
      // detail page and margin reports read Classic quotes identically:
      //   materials = substrate + ink + consumables, tooling = dies,
      //   labor = press+prepress labor, finishing = bindery labor,
      //   waste = MR waste sheets at paper cost, shipping = freight/outside,
      //   markup = total markup $, commission = commission $.
      // Buckets sum to calc.totalCost.
      const outOfParent = Math.max(1, form.sheetsOutOfParent || 1);
      const wasteCost = Math.min(
        calc.paperCost,
        ((calc.mrWasteSheets / outOfParent) / 1000) * (form.pricePerM || 0)
      );
      // E&M #348538 bucket restructure: materials = paper + prep materials +
      // cartons + INK + COATING + PLATES; labor = prep + press HOURS labor
      // (pressLaborCost no longer contains ink/coating).
      const costBreakdown = {
        materials: Math.max(0, calc.paperCost - wasteCost) + calc.prepMaterials
          + calc.inkCost + calc.coatingCost + calc.plateMaterialsCost,
        tooling: calc.pressMaterialsCost, // die cost (all parts)
        labor: calc.prepLabor + calc.pressLaborCost,
        // Todd's in-house finishing rows are REAL C&D cost -> finishing
        // bucket; only true vendor buyouts ride the outside/shipping bucket
        // (Benjy 7/21).
        finishing: calc.binderyLabor + calc.outsideToddCost,
        waste: wasteCost,
        // Outside bucket rides "shipping" — the detail page applies Outside
        // markup to this field (freight + additional + outside purchases,
        // incl. digital clicks which E&M books as outside).
        shipping: calc.freightAndAdditional + calc.outsideVendorCost,
        markup: calc.sellingSubtotal - calc.totalCost,
        commission: calc.commission,
      };

      // ── jobTicket — same shape the wizard sends; the quotes API conversion
      // path (specs.jobTicket) hydrates the Job from these fields.
      const jobTicket = {
        flatSizeWidth: form.sheetWidthRun || null,
        flatSizeHeight: form.sheetHeightRun || null,
        finishedWidth: null,
        finishedHeight: null,
        numberUp: form.numberUp || null,
        numPages: form.numPages || null,
        // Coating flows to the job ticket: Varnish rides the `varnish` column,
        // AQ/UV types ride `coating` (matches Job model + wizard usage).
        varnish: form.coatingType === "Varnish" ? "Varnish" : null,
        coating: form.coatingType && form.coatingType !== "Varnish" ? form.coatingType : null,
        pressAssignment: isDigital ? "Digital" : part1Press?.name || null,
        pressFormat: cfg?.name || null,
        makeReadyCount: calc.mrWasteSheets || null,
        stockDescription: [form.stockDescription, form.caliperBasisWeight, form.brandColorFinish]
          .filter(Boolean).join(" / ") || null,
        runSheetWidth: form.sheetWidthRun || null,
        runSheetHeight: form.sheetHeightRun || null,
        isMillItem: false,
        millItemLeadTime: null,
        binderyFold: !!form.folderConfig || form.binderyOperation === 3,
        binderyStitch: form.binderyOperation === 2 || form.binderyOperation === 4 || form.binderyOperation === 5,
        binderyScore: (form.scorePerfHrs || 0) > 0,
        binderyDrill: (form.drillHoles || 0) > 0,
        binderyGlue: false,
        binderyWrap: !!(form.wrapIn || (form.wrapHrs || 0) > 0 || (form.skids || 0) > 0),
        binderyNotes: [
          form.folderConfig ? `Folder: ${form.folderConfig}` : "",
          form.handOp1.description ? `Hand: ${form.handOp1.description}` : "",
          form.handOp2.description ? `Hand: ${form.handOp2.description}` : "",
          (form.drillHoles || 0) > 0 ? `${form.drillHoles} drill holes` : "",
          form.bandIn ? `Band: ${form.bandIn}` : "",
          form.padIn ? `Pad: ${form.padIn}` : "",
          form.wrapIn ? `Wrap: ${form.wrapIn}` : "",
          // Multi-part summary — one line per part so the ticket shows passes
          ...(numParts > 1
            ? allParts.map((p, i) =>
                `Part ${i + 1}: ${[
                  p.stockDescription,
                  p.sheetWidthRun && p.sheetHeightRun ? `${p.sheetWidthRun}x${p.sheetHeightRun}` : "",
                  isDigital ? p.digitalInkConfig : `${p.runColorsSide1}/${p.runColorsSide2}`,
                  p.dieNumber ? `die ${p.dieNumber}` : "",
                ].filter(Boolean).join(" · ") || "—"}`)
            : []),
        ].filter(Boolean).join("; ") || null,
        inkFront: isDigital
          ? `${form.digitalInkConfig.split("/")[0]}/0 digital`
          : form.runColorsSide1 > 0 ? `${form.runColorsSide1}/0` : null,
        inkBack: isDigital
          ? `${form.digitalInkConfig.split("/")[1]}/0 digital`
          : form.runColorsSide2 > 0 ? `${form.runColorsSide2}/0` : null,
        dieNumber: dieNumbers.join(", ") || null,
        fscCertified: false,
        pressCheck: (form.pressCheckHrs || 0) > 0,
        softCover: false,
        plusCover: false,
        hasBleeds: !!form.bleedAllowance,
        blanketNumber: null,
        deliveryTo: form.deliveryZone || null,
        samplesRequired: false,
        samplesTo: null,
        pressNotes: form.instructions || null,
        estimatedHours: calc.pressHrs + calc.prepHours + calc.binderyHrs,
        laborCostRate: form.pressHourlyRate || null,
      };

      const specs = JSON.stringify({
        method: "classic",
        classicForm: form,
        // Rendered by /dashboard/quotes/[id] + print pages (wizard parity)
        dimensions: form.sheetWidthRun && form.sheetHeightRun ? `${form.sheetWidthRun}x${form.sheetHeightRun}` : undefined,
        sheetSize: form.sheetWidthRun && form.sheetHeightRun ? `${form.sheetWidthRun}x${form.sheetHeightRun}` : undefined,
        colors: isDigital ? form.digitalInkConfig : `${form.runColorsSide1}F/${form.runColorsSide2}B`,
        pressName: isDigital ? "Digital" : part1Press?.name || "",
        pressConfig: cfg?.name || "",
        paperStock: form.stockDescription || undefined,
        // Quantity tiers — wizard key/shape so the quote detail page renders
        // them (primary quantity first).
        quantityTiers: quantityBreaks.length > 1 ? quantityBreaks : undefined,
        markups: { paper: form.markupPaperPct, material: form.markupMaterialPct, labor: form.markupLaborPct, outside: form.markupOutsidePct },
        commission: { percent: form.commissionPct, amount: calc.commission },
        costBreakdown,
        jobTicket,
        costSheet: {
          paper: { cost: calc.paperCost, selling: calc.paperSelling, orderSheets: calc.orderSheets },
          prep: { hours: calc.prepHours, cost: calc.prepCost, selling: calc.prepSelling },
          press: { hours: calc.pressHrs, inkLbs: calc.inkLbs, cost: calc.pressCost, selling: calc.pressSelling },
          bindery: { hours: calc.binderyHrs, cost: calc.binderyCost, selling: calc.binderySelling },
          outside: { cost: calc.outsideCost, selling: calc.outsideSelling },
          freightAndAdditional: calc.freightAndAdditional,
          commission: calc.commission,
          totalCost: calc.totalCost,
          total: calc.total,
        },
      });

      const summaryFields = {
        customerName: form.customerName,
        productName: form.jobTitle,
        description: [
          form.stockDescription,
          form.sheetWidthRun && form.sheetHeightRun ? `${form.sheetWidthRun}x${form.sheetHeightRun} sheet` : "",
          form.jobType,
        ].filter(Boolean).join(" — "),
        quantity: qty,
        unitPrice: calc.total / qty,
        // quote.notes prints VERBATIM on the customer letter (print page's
        // "Notes" block) — so it carries ONLY Mary's quote-letter notes.
        // The classic method marker lives in specs; internal instructions
        // live in specs.classicForm + jobTicket.pressNotes.
        // One-time die/cutting fees and the card surcharge are LETTER text in
        // E&M ("Includes 1 time new die fee of $X", "3% Surcharge added if
        // paying by Credit Card") -- they are deliberately NOT in the price,
        // so they have to ride the notes or the customer never sees them.
        notes: [
          form.quoteNotes || "",
          ...(form.oneTimeCharges || [])
            .filter((c) => c.description.trim() || c.amount > 0)
            .map((c) => `Includes 1 time ${c.description.trim() || "charge"} of $${c.amount.toFixed(2)}`),
          form.millItemStock ? "Mill Item Stock — please allow additional time for delivery." : "",
          (form.cardSurchargePct || 0) > 0
            ? `${form.cardSurchargePct}% Surcharge added if paying by Credit/Debit`
            : "",
        ].filter(Boolean).join(String.fromCharCode(10)),
      };

      let res: Response;
      let savedQuote: { id: string; quoteNumber: string } | null = null;
      if (draftQuoteId) {
        // Update the existing draft in place (wizard parity — Mary can come
        // and go; the API's specs-without-status path keeps it a DRAFT).
        res = await fetch("/api/quotes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: draftQuoteId, specs, ...summaryFields }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Save failed");
        savedQuote = { id: draftQuoteId, quoteNumber: saved?.quoteNumber || draftQuoteNumber || "draft" };
      } else {
        res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...summaryFields,
            productType: "COMMERCIAL_PRINT",
            quoteRequestId: fromRequestId || undefined,
            specs,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.quote) throw new Error(data.error || "Save failed");
        savedQuote = { id: data.quote.id, quoteNumber: data.quote.quoteNumber };
        setDraftQuoteId(data.quote.id);
        setDraftQuoteNumber(data.quote.quoteNumber);
      }
      if (silent) { setLastAutoSavedAt(Date.now()); setAutoSaveFailed(false); return; }
      setSaved(savedQuote);
      // Double-check AFTER the save lands -- the quote is safe either way,
      // and any flag names the screen/field so Mary fixes instead of
      // distrusting the system. API trouble = no flags, never an error.
      setChecking(true); setCheckFlags(null);
      fetch("/api/estimator-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form }),
      }).then((r) => r.json()).then((d) => setCheckFlags(d.flags || []))
        .catch(() => setCheckFlags([]))
        .finally(() => setChecking(false));

      // Started from a quote request → mark it completed so it leaves the
      // Quote Requests queue (exactly like the wizard). Autosave must NOT do
      // this — an in-progress draft shouldn't clear the request queue.
      if (fromRequestId && savedQuote?.id) {
        try {
          await fetch("/api/quote-requests", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: fromRequestId, status: "completed", convertedQuoteId: savedQuote.id }),
          });
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      // Autosave failures are silent on screen (they retry on the next edit),
      // but recorded so the indicator can warn if nothing has saved in a while.
      if (silent) setAutoSaveFailed(true);
      else setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      if (silent) setAutoSaving(false);
      else setSaving(false);
    }
  }

  // Keep the latest saveQuote reachable from the debounced effect without
  // making it an effect dependency (it closes over form/calc every render).
  const saveQuoteRef = useRef(saveQuote);
  saveQuoteRef.current = saveQuote;

  // Debounced draft autosave: every edit resets a 2.5s timer; when the user
  // pauses, the draft persists. Fires only once the required fields exist and
  // no manual save is mid-flight. Nothing is ever lost to navigating away.
  useEffect(() => {
    if (!form.customerName || !form.jobTitle || !form.quantity) return;
    if (saving) return;
    const t = setTimeout(() => { saveQuoteRef.current({ silent: true }); }, 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // ── Screen bodies ──────────────────────────────────────────────────────

  function screen1() {
    return (
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <SectionTitle>Customer</SectionTitle>
          <Row label="Customer Name" wide><Txt value={form.customerName} onChange={onCustomerName} list="classic-customers" placeholder="type to search customers…" /></Row>
          <datalist id="classic-customers">
            {companies.map((c) => <option key={c.id} value={c.name} />)}
          </datalist>
          <Row label="Customer #" wide><Txt value={form.customerNumber} onChange={(v) => set("customerNumber", v)} placeholder="optional" /></Row>
          <Row label="Address" wide><Txt value={form.address} onChange={(v) => set("address", v)} /></Row>
          <SectionTitle>Job</SectionTitle>
          <Row label="Job Title" wide><Txt value={form.jobTitle} onChange={(v) => set("jobTitle", v)} /></Row>
          <Row label="Quantity"><Num value={form.quantity} onChange={(v) => set("quantity", v)} step={1} /></Row>
          {[0, 1, 2].map((i) => (
            <Row key={i} label={`Add'l Quantity ${i + 2}`}>
              <Num
                value={form.additionalQuantities[i] || 0}
                step={1}
                onChange={(v) => {
                  const a = [...(form.additionalQuantities || [])];
                  while (a.length < 3) a.push(0);
                  a[i] = v;
                  set("additionalQuantities", a);
                }}
              />
            </Row>
          ))}
          <Row label="No. of Parts"><Num value={form.numParts} onChange={(v) => set("numParts", v)} step={1} /></Row>
        </div>
        <div>
          <SectionTitle>Pickup Estimate</SectionTitle>
          <Row label="Pickup From Quote #" wide>
            <Txt value={pickupValue} onChange={onPickup} list="classic-pickups" placeholder="type a past Classic quote #…" />
          </Row>
          <datalist id="classic-pickups">
            {classicQuotes.map((q) => <option key={q.id} value={`${q.quoteNumber} — ${q.customerName}`} />)}
          </datalist>
          {pickupLoaded && (
            <div className="mb-1 border border-amber-500/50 bg-amber-400/5 px-2 py-1 font-mono text-[12px] text-amber-300">
              Picked up {pickupLoaded} as a NEW estimate — Job Type set to Exact Reprint (flip to Reprint w/Changes if needed).
            </div>
          )}
          <SectionTitle>Markup Overrides (this job)</SectionTitle>
          <Row label="Paper %"><Num value={form.markupPaperPct} onChange={(v) => set("markupPaperPct", v)} /></Row>
          <Row label="Material %"><Num value={form.markupMaterialPct} onChange={(v) => set("markupMaterialPct", v)} /></Row>
          <Row label="Outside %"><Num value={form.markupOutsidePct} onChange={(v) => set("markupOutsidePct", v)} /></Row>
          <Row label="Labor %"><Num value={form.markupLaborPct} onChange={(v) => set("markupLaborPct", v)} /></Row>
          <Row label="Commission Mode" wide>
            <select className={inputCls} value={form.commissionMode || "pct"}
              onChange={(e) => set("commissionMode", e.target.value as "pct" | "flat" | "none")}>
              <option value="pct">Percent of cost</option>
              <option value="flat">Flat dollar amount</option>
              <option value="none">None (broker job)</option>
            </select>
          </Row>
          <Row label="Commission %"><Num value={form.commissionPct} onChange={(v) => set("commissionPct", v)} /></Row>
          {form.commissionMode === "flat" && (
            <Row label="Commission $ Flat"><Num value={form.commissionFlat} onChange={(v) => set("commissionFlat", v)} /></Row>
          )}
        </div>
      </div>
    );
  }

  function screen2() {
    return (
      <div>
        <SectionTitle>Additional Instructions</SectionTitle>
        <textarea
          className={inputCls + " h-64 w-full py-2 leading-5"}
          value={form.instructions}
          onChange={(e) => set("instructions", e.target.value)}
          placeholder="Free-text job instructions…"
        />
      </div>
    );
  }

  function screen3() {
    return (
      <div>
        <SectionTitle>Job Type</SectionTitle>
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
          {JOB_TYPES.map((jt, i) => (
            <label
              key={jt}
              className={`flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2 font-mono text-[13px] ${
                form.jobType === jt
                  ? "border-amber-400 bg-amber-400/10 text-amber-200"
                  : "border-amber-700/40 text-amber-400/80 hover:border-amber-500"
              }`}
            >
              <input
                type="radio"
                name="jobType"
                className="accent-amber-400"
                checked={form.jobType === jt}
                onChange={() => set("jobType", jt as JobType)}
              />
              <span className="w-6 text-amber-500/70">{i + 1}.</span>
              {jt}
            </label>
          ))}
        </div>
        {form.jobType === "Digital Direct" && (
          <div className="mt-3 border border-amber-500/50 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-300">
            DIGITAL DIRECT — Screen 7 will use the digital click-charge engine (tier × ink config) instead of offset press math.
          </div>
        )}
      </div>
    );
  }

  function screen4() {
    return (
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <SectionTitle>Hours</SectionTitle>
          <Row label="Design/Layout/Artwork Hrs"><Num value={form.designHours} onChange={(v) => set("designHours", v)} /></Row>
          <Row label="Photoshop Hrs"><Num value={form.photoshopHours} onChange={(v) => set("photoshopHours", v)} /></Row>
          <StdRow label="Prepress Rate $/Hr" show={showStd}><Num value={form.prepressRate} onChange={(v) => set("prepressRate", v)} /></StdRow>
          <Row label="Type/Output Hrs"><Num value={form.typeOutputHrs} onChange={(v) => set("typeOutputHrs", v)} /></Row>
          <StdRow label="Type/Output $/Hr" show={showStd}><Num value={form.typeOutputRate} onChange={(v) => set("typeOutputRate", v)} /></StdRow>
          <StdRow label="Proof Matl $/Plate" show={showStd}><Num value={form.proofMaterialPerPlate} onChange={(v) => set("proofMaterialPerPlate", v)} /></StdRow>
          {/* Scans section removed per Mary 7/21 — she only uses the Hours
              block. Fields remain in the data model (old drafts still price). */}
        </div>
        <div>
          <SectionTitle>Disks & Proofs</SectionTitle>
          <Row label="Furnished Disks"><Num value={form.furnishedDisks} onChange={(v) => set("furnishedDisks", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.furnishedDiskCharge} onChange={(v) => set("furnishedDiskCharge", v)} /></Row>
          {/* These are PART 1's proofs — parts 2+ key theirs on the Press screen */}
          <Row label="Laser Proofs"><Num value={form.laserProofs} onChange={(v) => set("laserProofs", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.laserProofCharge} onChange={(v) => set("laserProofCharge", v)} /></Row>
          <Row label="Color Proofs"><Num value={form.colorProofs} onChange={(v) => set("colorProofs", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.colorProofCharge} onChange={(v) => set("colorProofCharge", v)} /></Row>
          <Readout label="Prepress Labor" value={money(calc.prepLabor)} />
          {/* ONLY Screen 4+5 items here — carton/skid $ shows on Screen 8's
              Carton Pack where it's entered (Benjy/Mary 7/21). */}
          <Readout label="Prepress Materials" value={money(calc.prepMaterials - calc.cartonSkidCost)} />
        </div>
      </div>
    );
  }

  function screen5() {
    return (
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <SectionTitle>Camera / Stripping / Platemaking</SectionTitle>
          <Row label="Plate Diff Factor"><Num value={form.plateDiffFactor} onChange={(v) => set("plateDiffFactor", v)} /></Row>
          <Row label="Dylux Proofs"><Num value={form.dyluxProofs} onChange={(v) => set("dyluxProofs", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.dyluxCharge} onChange={(v) => set("dyluxCharge", v)} /></Row>
          <Row label="Matchprint Proofs"><Num value={form.matchprintProofs} onChange={(v) => set("matchprintProofs", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.matchprintCharge} onChange={(v) => set("matchprintCharge", v)} /></Row>
          <Row label="Separations"><Num value={form.separations} onChange={(v) => set("separations", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.separationCharge} onChange={(v) => set("separationCharge", v)} /></Row>
        </div>
        <div>
          <SectionTitle>Note</SectionTitle>
          <p className="max-w-sm text-[12px] leading-5 text-amber-400/60">
            Legacy conventional-prepress screen. These usually stay 0 on modern work —
            enter counts only when the job actually uses film/proofs from this era.
            Charges roll into Prep at Material markup, times the Plate Diff Factor.
          </p>
        </div>
      </div>
    );
  }

  // Part tab bar for Screens 6-8 (only when No. of Parts > 1)
  function partTabs() {
    if (numParts <= 1) return null;
    return (
      <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-amber-700/40 pb-2">
        <span className="mr-1 font-mono text-[11px] uppercase tracking-widest text-amber-500/80">Part:</span>
        {Array.from({ length: numParts }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPartIndex(i)}
            className={`rounded-sm px-3 py-1 font-mono text-[12px] ${
              partIndex === i
                ? "bg-amber-400 font-bold text-black"
                : "border border-amber-700/50 text-amber-400/80 hover:bg-amber-400/10"
            }`}
          >
            {/* Show the part's NAME once given — a 5-part case-bound book
                reading "Part 1 / Part 2 / Part 3" is unusable (Kolter #343786
                is End sheet / 128pgs / Fold out / 6 inserts / 1 insert). */}
            {(() => {
              const nm = String((i === 0 ? form.partName : form.parts[i - 1]?.partName) || "").trim();
              return nm ? `${i + 1}. ${nm}` : `Part ${i + 1}`;
            })()}
          </button>
        ))}
      </div>
    );
  }

  function screen6() {
    return (
      <div>
        {partTabs()}
        <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
          <div>
            <SectionTitle>Sheet</SectionTitle>
            {/* Mary 7/20: Size to Order comes FIRST, and each block is
                height-then-width, matching her E&M entry order. */}
            <Row label="Size To Order — Height"><Num value={pv("sheetHeightOrder")} onChange={(v) => setP("sheetHeightOrder", v)} /></Row>
            <Row label="Size To Order — Width"><Num value={pv("sheetWidthOrder")} onChange={(v) => setP("sheetWidthOrder", v)} /></Row>
            <Row label="Size To Run — Height"><Num value={pv("sheetHeightRun")} onChange={(v) => setP("sheetHeightRun", v)} /></Row>
            <Row label="Size To Run — Width"><Num value={pv("sheetWidthRun")} onChange={(v) => setP("sheetWidthRun", v)} /></Row>
            <Row label="Number Of Pages"><Num value={pv("numPages")} onChange={(v) => setP("numPages", v)} step={1} /></Row>
            <Row label="Number Up"><Num value={pv("numberUp")} onChange={(v) => setP("numberUp", v)} step={1} /></Row>
            <Row label="Sheets per Piece"><Num value={pv("sheetsPerPiece")} onChange={(v) => setP("sheetsPerPiece", v)} step={1} /></Row>
            <Row label="Out of Parent"><Num value={pv("sheetsOutOfParent")} onChange={(v) => setP("sheetsOutOfParent", v)} step={1} /></Row>
            <Row label="Bind Waste Shts"><Num value={pv("bindWasteSheets")} onChange={(v) => setP("bindWasteSheets", v)} step={1} /></Row>
            {/* Caliper from Mary's Paper Caliper Master. Her rule: this is the
                DEFAULT — a mill's actual caliper overrides it, so the box stays
                editable and the lookup only fills it in. */}
            <Row label="Stock (caliper lookup)" wide>
              <select className={inputCls} value=""
                onChange={(e) => {
                  const c = calipers.find((x) => x.stockName === e.target.value);
                  if (!c) return;
                  // Speed by stock (Darrin 8/24): top 12,000; 50# uncoated
                  // runs 9,000; 18pt C1S 11-12,000; 24-32pt board 9-10,000.
                  // Only adjusts a press speed already loaded (offset jobs) --
                  // digital/carrier passes keep 0 and Mary can always retype.
                  const mil = c.caliperMil || 0;
                  const stockSpeed = mil >= 20 ? 9500 : mil >= 14 ? 11500 : mil <= 4 ? 9000 : 12000;
                  patchP({
                    caliperBasisWeight: `${c.stockName} (${c.caliperMil} pt)`,
                    ...((pv("runSpeedSph") || 0) > 0 ? { runSpeedSph: stockSpeed } : {}),
                  });
                }}>
                <option value="">pick a stock to fill the caliper…</option>
                {calipers.map((c) => (
                  <option key={c.id} value={c.stockName}>
                    {c.stockName} — {c.caliperMil} mil{c.scoreRequired !== "No" ? `, score ${String(c.scoreRequired).toLowerCase()}` : ""}
                  </option>
                ))}
              </select>
            </Row>
            {/* FINISHED SIZE (Mary 8/21) — real numbers, not "8.5 x 11" text.
                A box is W x D x H; a flat product is W x H. The flat BLANK for
                a box still comes from the die below, not from these. */}
            <Row label="Product Type" wide>
              <select className={inputCls} value={String(pv("productKind") || "flat")}
                onChange={(e) => setP("productKind", e.target.value as "flat" | "box")}>
                <option value="flat">Flat printed product</option>
                <option value="box">Box / packaging</option>
              </select>
            </Row>
            {String(pv("productKind") || "flat") === "box" ? (
              <>
                <Row label="Finished Box W"><Num value={pv("boxWidthIn")} onChange={(v) => setP("boxWidthIn", v)} /></Row>
                <Row label="Finished Box D"><Num value={pv("boxDepthIn")} onChange={(v) => setP("boxDepthIn", v)} /></Row>
                <Row label="Finished Box H"><Num value={pv("boxHeightIn")} onChange={(v) => setP("boxHeightIn", v)} /></Row>
              </>
            ) : (
              <>
                <Row label="Finished Width"><Num value={pv("finishedWidthIn")} onChange={(v) => setP("finishedWidthIn", v)} /></Row>
                <Row label="Finished Height"><Num value={pv("finishedHeightIn")} onChange={(v) => setP("finishedHeightIn", v)} /></Row>
              </>
            )}
            <Row label="Flat Size — Width" ><Num value={pv("flatWidthIn")} onChange={(v) => setP("flatWidthIn", v)} /></Row>
            <Row label="Flat Size — Height"><Num value={pv("flatHeightIn")} onChange={(v) => setP("flatHeightIn", v)} /></Row>
            <div className="col-span-2 pl-[224px] text-[11px] text-amber-400/70">
              The produced piece flat, before folding — not the paper. Paper is
              &ldquo;Size To Run&rdquo; and &ldquo;Size To Order&rdquo; below.
            </div>
            <Row label="Part Name" wide>
              <Txt value={String(pv("partName") || "")} onChange={(v) => setP("partName", v)}
                placeholder="e.g. End sheet, 128pgs, Fold out, 6 inserts" />
            </Row>
            <Row label="Buy Rounding (Shts)"><Num value={pv("paperBuyRounding")} onChange={(v) => setP("paperBuyRounding", v)} step={10} /></Row>
            <Row label="Paper Handling Hrs"><Num value={pv("paperHandlingHrs")} onChange={(v) => setP("paperHandlingHrs", v)} /></Row>
            <StdRow label="Paper Handling $/Hr" show={showStd}><Num value={pv("paperHandlingRate")} onChange={(v) => setP("paperHandlingRate", v)} /></StdRow>
            <Row label="Preprinted 2nd Pass" wide>
              <label className="flex items-center gap-2 text-[12px] text-amber-200/80">
                <input type="checkbox" checked={!!pv("preprintedPass")} onChange={(e) => setP("preprintedPass", e.target.checked)} />
                sheets already in-house (no paper cost, no cartons) — LED-UV re-pass
              </label>
            </Row>
            {/* Cuts derive from the sheet info above (Mary 7/20) — number-up
                and out-of-parent drive the cutting math on Pg 8. */}
            <Readout label="Cuts To Final (Auto)" value={String(pcalc.cutsUsed)} />
            <Row label="Bleed Allowance" wide><Txt value={pv("bleedAllowance")} onChange={(v) => setP("bleedAllowance", v)} /></Row>
          </div>
          <div>
            <SectionTitle>Stock</SectionTitle>
            <Row label="Stock Description" wide>
              <Txt value={pv("stockDescription")} onChange={onStockDescription} list="classic-stocks" placeholder="type to search paper history…" />
            </Row>
            <datalist id="classic-stocks">
              {stockOptions.map((o) => <option key={o.description} value={o.description} />)}
            </datalist>
            {(() => {
              const m = stockOptions.find((o) => o.description.toLowerCase() === String(pv("stockDescription") || "").trim().toLowerCase());
              return m ? (
                <div className="mb-1 border border-amber-500/40 bg-amber-400/5 px-2 py-1 font-mono text-[11px] text-amber-300">
                  PAPER HISTORY — {m.description}{m.size ? ` · ${m.size}` : ""}{m.weight ? ` · ${m.weight}` : ""}{m.pricePerM ? ` · $${m.pricePerM.toFixed(2)}/M (prefilled, override below)` : " · no price on record"}
                </div>
              ) : null;
            })()}
            <Row label="Caliper / Basis Weight" wide><Txt value={pv("caliperBasisWeight")} onChange={(v) => setP("caliperBasisWeight", v)} /></Row>
            <Row label="Weight (Lbs / M Shts)"><Num value={pv("weightPerMSheets")} onChange={(v) => setP("weightPerMSheets", v)} /></Row>
            <Row label="Brand/Color/Finish" wide><Txt value={pv("brandColorFinish")} onChange={(v) => setP("brandColorFinish", v)} /></Row>
            <Row label="Price Per M Sheets $"><Num value={pv("pricePerM")} onChange={(v) => setP("pricePerM", v)} /></Row>
            <SectionTitle>{numParts > 1 ? `Computed — Part ${partIndex + 1}` : "Computed"}</SectionTitle>
            <Readout label="Press Sheets" value={String(pcalc.pressSheets)} />
            <Readout label="+ Makeready Waste" value={String(pcalc.mrWasteSheets)} />
            <Readout label="Sheets To Order" value={String(pcalc.orderSheets)} />
            <Readout label="Paper Cost" value={money(pcalc.paperCost)} />
          </div>
        </div>
      </div>
    );
  }

  // Die cutting block — lives on Screen 8 (Bindery) per Mary 7/20; hours still
  // bill at the press rate in the calc (E&M press-screen lineage) until she
  // says otherwise.
  function dieCuttingSection() {
    return (
      <>
        <SectionTitle>Die Cutting</SectionTitle>
        <Row label="Die Cut Time (Hrs)"><Num value={pv("dieCutHrs")} onChange={(v) => setP("dieCutHrs", v)} /></Row>
        <Row label="Scoring / Perforating" wide>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12px] text-amber-200/80">
              <input type="checkbox" checked={(pv("scorePerfHrs") || 0) > 0}
                onChange={(e) => setP("scorePerfHrs", e.target.checked ? 0.1 : 0)} />
              score / perf this job
            </label>
            {(pv("scorePerfHrs") || 0) > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-400/70">hrs</span>
                <div className="w-[90px]"><Num value={pv("scorePerfHrs")} onChange={(v) => setP("scorePerfHrs", v)} /></div>
              </div>
            )}
          </div>
        </Row>
        {(pv("scorePerfHrs") || 0) > 0 && (
          <div className="pl-[224px] text-[11px] text-amber-400/70">
            E&amp;M bills this as a 0.1 hr hand-bindery line. If the score is bought out,
            add the vendor charge as an Outside Purchase on Screen 9.
          </div>
        )}
        <Row label="Die #" wide>
          <Txt value={String(pv("dieNumber") || "")} onChange={(v) => setP("dieNumber", v)} list="classic-dies" placeholder="existing die # (blank = new die)" />
        </Row>
        <datalist id="classic-dies">
          {dieOptions.map((d) => <option key={d.dieNumber} value={d.dieNumber} />)}
        </datalist>
        {dieMatch && (
          <div className="mb-1 border border-amber-500/40 bg-amber-400/5 px-2 py-1 font-mono text-[11px] text-amber-300">
            <div>
              DIE {dieMatch.dieNumber} ON FILE — {[
                dieMatch.customerName, dieMatch.item, dieMatch.description,
                dieMatch.length && dieMatch.width ? `${dieMatch.length}x${dieMatch.width}${dieMatch.height ? `x${dieMatch.height}` : ""}` : "",
              ].filter(Boolean).join(" · ") || "no detail"} · existing die, no die charge needed
            </div>
            {/* Mary 8/21: "I'm guessing that eventually I can enter a Die # and
                it will auto fill just by that?" — yes, for the finished box
                size, which is what the die record actually stores. The FLAT
                blank isn't on the die record, so she still enters that. About
                a quarter of the 1,787 dies carry dimensions today. */}
            {dieMatch.length && dieMatch.width ? (
              <button type="button"
                className="mt-1 border border-amber-600/60 px-2 py-0.5 text-[11px] text-amber-200 hover:bg-amber-900/40"
                onClick={() => patchP({
                  productKind: "box",
                  boxWidthIn: dieMatch.length || 0,
                  boxDepthIn: dieMatch.width || 0,
                  boxHeightIn: dieMatch.height || 0,
                } as any)}>
                Use this die&apos;s finished size ({dieMatch.length} × {dieMatch.width}{dieMatch.height ? ` × ${dieMatch.height}` : ""})
              </button>
            ) : (
              <div className="mt-0.5 text-amber-500/70">
                no size recorded on this die — enter the finished size by hand
              </div>
            )}
          </div>
        )}
        <Row label="Die Cost $"><Num value={pv("dieCost")} onChange={(v) => setP("dieCost", v)} /></Row>
      </>
    );
  }

  function screen7() {
    const digital = form.jobType === "Digital Direct";
    return (
      <div>
        {partTabs()}
        <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
          <div>
            <SectionTitle>{digital ? "Digital Press" : "Press Selection"}</SectionTitle>
            <Row label="Press" wide>
              <select
                className={inputCls}
                value={pv("pressId")}
                onChange={(e) => {
                  const press = presses.find((p) => p.id === e.target.value);
                  const cfg = press?.configurations[0];
                  patchP({
                    pressId: e.target.value,
                    pressConfigId: cfg?.id || "",
                    ...(press ? { pressHourlyRate: press.costPerHour + (cfg?.addToHourlyRate || 0) } : {}),
                    // Helper rate: press's own rate wins only when nonzero;
                    // otherwise keep the hand-bindery default already loaded
                    // (Mary 7/21 — "it's not putting in press helper").
                    ...(press && press.helperCostPerHour > 0 ? { helperHourlyRate: press.helperCostPerHour } : {}),
                    ...(cfg ? {
                      runSpeedSph: cfg.speedUncoated,
                      baseMakereadyHrsPerPlate: Math.round((cfg.setupMinutes / 60) * 100) / 100,
                      plateCostEach: cfg.plateCost || 0, // KOMII 5C = $19 (E&M #348538)
                    } : {}),
                    // Never reset a helper count Mary already typed; only
                    // adopt the config's crew size when it actually has one.
                    ...(cfg && cfg.numHelpers > 0 ? { helpers: cfg.numHelpers } : {}),
                  });
                }}
              >
                <option value="">— select press —</option>
                {presses.map((p) => (
                  <option key={p.id} value={p.id}>#{p.pressNumber} {p.name} ({p.pressType})</option>
                ))}
              </select>
            </Row>
            {selectedPress && (
              <Row label="Configuration" wide>
                <select
                  className={inputCls}
                  value={pv("pressConfigId")}
                  onChange={(e) => {
                    const cfg = selectedPress.configurations.find((c) => c.id === e.target.value);
                    patchP({
                      pressConfigId: e.target.value,
                      pressHourlyRate: selectedPress.costPerHour + (cfg?.addToHourlyRate || 0),
                      ...(cfg ? {
                        runSpeedSph: cfg.speedUncoated,
                        baseMakereadyHrsPerPlate: Math.round((cfg.setupMinutes / 60) * 100) / 100,
                        plateCostEach: cfg.plateCost || 0,
                      } : {}),
                      // Keep Mary's typed helper count (Mary 7/21).
                      ...(cfg && cfg.numHelpers > 0 ? { helpers: cfg.numHelpers } : {}),
                    });
                  }}
                >
                  {selectedPress.configurations.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.numColors}c, {c.speedUncoated} sph</option>
                  ))}
                </select>
              </Row>
            )}
            <StdRow label="Press Rate $/Hr" show={showStd}><Num value={pv("pressHourlyRate")} onChange={(v) => setP("pressHourlyRate", v)} /></StdRow>
            <Row label="Digital On This Part" wide>
              <label className="flex items-center gap-2 text-[12px] text-amber-200/80">
                <input type="checkbox" checked={!!pv("digitalOnPart")} onChange={(e) => setP("digitalOnPart", e.target.checked)} />
                buy the printing out as clicks (carrier press) even on an offset job
              </label>
            </Row>
            <Row label="Ink Lbs (0 = From Coverage)"><Num value={pv("inkLbsManual")} onChange={(v) => setP("inkLbsManual", v)} /></Row>
            {partIndex > 0 && (
              <>
                {/* Proof material is per part in E&M; part 1's lives on Screen 4/5 */}
                <Row label="Laser Proofs (this part)"><Num value={pv("laserProofs")} onChange={(v) => setP("laserProofs", v)} step={1} /></Row>
                <Row label="  @ $ each"><Num value={pv("laserProofCharge")} onChange={(v) => setP("laserProofCharge", v)} /></Row>
                <Row label="Color Proofs (this part)"><Num value={pv("colorProofs")} onChange={(v) => setP("colorProofs", v)} step={1} /></Row>
                <Row label="  @ $ each"><Num value={pv("colorProofCharge")} onChange={(v) => setP("colorProofCharge", v)} /></Row>
              </>
            )}

            {digital ? (
              <>
                <Row label="Ink Config" wide>
                  <select
                    className={inputCls + " w-[160px]"}
                    value={pv("digitalInkConfig")}
                    onChange={(e) => setP("digitalInkConfig", e.target.value as InkConfig)}
                  >
                    {(["1/0", "1/1", "4/0", "4/1", "4/4"] as InkConfig[]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Row>
                <Row label="Makeready Sheets"><Num value={pv("digitalMakereadySheets")} onChange={(v) => setP("digitalMakereadySheets", v)} step={1} /></Row>
                <Row label="Overs For Clicks"><Num value={pv("digitalOversSheets")} onChange={(v) => setP("digitalOversSheets", v)} step={1} /></Row>
                <Row label="Vendor $ (wins over calc)"><Num value={pv("digitalVendorAmount")} onChange={(v) => setP("digitalVendorAmount", v)} /></Row>
                <Row label="Variable Data" wide>
                  <label className="flex items-center gap-2 font-mono text-[13px] text-amber-200">
                    <input
                      type="checkbox"
                      className="accent-amber-400"
                      checked={pv("digitalVariableData")}
                      onChange={(e) => setP("digitalVariableData", e.target.checked)}
                    />
                    VD per-side adder + setup
                  </label>
                </Row>
                {pv("digitalVariableData") && (
                  <Row label="VD Setup Hrs"><Num value={pv("digitalVDSetupHrs")} onChange={(v) => setP("digitalVDSetupHrs", v)} /></Row>
                )}
              </>
            ) : (
              <>
                <Row label="Run Side 1 Colors"><Num value={pv("runColorsSide1")} onChange={(v) => setP("runColorsSide1", v)} step={1} /></Row>
                <Row label="Run Side 2 Colors"><Num value={pv("runColorsSide2")} onChange={(v) => setP("runColorsSide2", v)} step={1} /></Row>
                {/* WORK & TURN (E&M #348538): same plates print both sides —
                    plates/washups/makereadys = max(side1, side2). */}
                <Row label="Work & Turn" wide>
                  <label className="flex items-center gap-2 font-mono text-[13px] text-amber-200">
                    <input
                      type="checkbox"
                      className="accent-amber-400"
                      checked={!!pv("workAndTurn")}
                      onChange={(e) => setP("workAndTurn", e.target.checked)}
                    />
                    same plates both sides
                  </label>
                </Row>
                <StdRow label="Plate Cost $ Each" show={showStd}><Num value={pv("plateCostEach")} onChange={(v) => setP("plateCostEach", v)} /></StdRow>
                <Readout label="Plates (Material)" value={`${pcalc.plates} × ${money(pv("plateCostEach"))} = ${money(pcalc.plateMaterialsCost)}`} />
                {/* Press helper crew — near the top so Mary can't miss it (7/21) */}
                <Row label="Helpers"><Num value={pv("helpers")} onChange={(v) => setP("helpers", v)} step={1} /></Row>
                <StdRow label="Helper Rate $/Hr" show={showStd}><Num value={pv("helperHourlyRate")} onChange={(v) => setP("helperHourlyRate", v)} /></StdRow>
                <StdRow label="Base Makeready Hrs/Plate" show={showStd}><Num value={pv("baseMakereadyHrsPerPlate")} onChange={(v) => setP("baseMakereadyHrsPerPlate", v)} /></StdRow>
                <Row label="Setup Hrs"><Num value={pv("pressSetupHrs")} onChange={(v) => setP("pressSetupHrs", v)} /></Row>
                <Row label="Setup Diff"><Num value={pv("pressSetupDiff")} onChange={(v) => setP("pressSetupDiff", v)} /></Row>
                <Row label="Makeready Diff"><Num value={pv("makereadyDiff")} onChange={(v) => setP("makereadyDiff", v)} /></Row>
                <StdRow label="Washup Hrs/Unit" show={showStd}><Num value={pv("washupHrsPerUnit")} onChange={(v) => setP("washupHrsPerUnit", v)} /></StdRow>
                <Row label="Washup Diff"><Num value={pv("washupDiff")} onChange={(v) => setP("washupDiff", v)} /></Row>
                <Row label="Run Speed (SPH, Rated)"><Num value={pv("runSpeedSph")} onChange={(v) => setP("runSpeedSph", v)} step={100} /></Row>
                <Row label="Signature Runs"><Num value={pv("signatureRuns")} onChange={(v) => setP("signatureRuns", v)} step={1} /></Row>
                {/* Explicit multi-run breakdown — E&M prints a separate run
                    block per signature group, and they can differ WITHIN one
                    part (#348472: a 3-sig SHEETWISE run + a 2-sig W&T run;
                    #348228: 27 runs). Leave empty for a single-run part. */}
                {/* Signature planner (Mary 8/24): pages + finished size +
                    sheet size -> the sig breakdown E&M computed itself. */}
                {(() => {
                  const plan = planBooklet(
                    Number(pv("numPages")) || 0,
                    Number(pv("finishedWidthIn")) || 0, Number(pv("finishedHeightIn")) || 0,
                    Number(pv("sheetWidthRun")) || 0, Number(pv("sheetHeightRun")) || 0,
                    Number(pv("runColorsSide1")) || 0, Number(pv("runColorsSide2")) || 0);
                  if (!plan) return null;
                  const qty = Number(form.quantity) || 0;
                  return (
                    <div className="mt-3 rounded border border-emerald-700/50 bg-emerald-950/30 p-2 text-[13px]">
                      <div className="text-emerald-300">Booklet plan (auto): {plan.text}</div>
                      <button type="button"
                        className="mt-1 rounded bg-emerald-700 px-2 py-0.5 text-xs text-white hover:bg-emerald-600"
                        onClick={() => {
                          const runs = plan.sigs.map((sig) => ({
                            ...defaultPressRun(),
                            label: `(${sig.style === "SHEETWISE" ? sig.sheetsPerPiece : 1}) ${sig.pages}pg sig ${sig.style}${sig.outs > 1 ? ` ${sig.outs} out` : ""}`,
                            sheets: Math.ceil(qty * sig.sheetsPerPiece),
                            workAndTurn: sig.style === "WORK & TURN",
                            runColorsSide1: Number(pv("runColorsSide1")) || 0,
                            // W&T still PRINTS both sides (2 passes) -- it only shares plates
                            runColorsSide2: Number(pv("runColorsSide2")) || 0,
                            plates: sig.plates,
                            // Mary's confirmed rule: 100 sheets/color/side + 100/machine
                            makereadySheets: sig.plates * 100 + 100,
                            runWastePct: 3,
                          }));
                          patchP({ runs: runs as any, signatureRuns: 1, sheetsPerPiece: 1 });
                        }}>
                        Apply plan to press runs
                      </button>
                      <span className="ml-2 text-emerald-400/70">fills the runs below -- adjust anything after</span>
                    </div>
                  );
                })()}
                <div className="mt-3 border-t border-amber-800/40 pt-2">
                  <div className="mb-1 text-[12px] uppercase tracking-wide text-amber-400/90">
                    Press Runs (leave empty for one run)
                  </div>
                  {((pv("runs") as any[]) || []).map((r: any, i: number) => {
                    const upd = (patch: any) => {
                      const next = [...((pv("runs") as any[]) || [])];
                      next[i] = { ...next[i], ...patch };
                      setP("runs", next as any);
                    };
                    return (
                      <div key={i} className="mb-2 rounded-sm border border-amber-800/40 p-2">
                        <div className="mb-1 flex items-center gap-2">
                          <input className={inputCls} placeholder="e.g. Run 3: 3 8-page sigs SHEETWISE"
                            value={r.label || ""} onChange={(e) => upd({ label: e.target.value })} />
                          <button type="button" className="px-2 text-[12px] text-amber-400/70 hover:text-amber-200"
                            onClick={() => setP("runs", (((pv("runs") as any[]) || []).filter((_: any, j: number) => j !== i)) as any)}>×</button>
                        </div>
                        <Row label="Net Sheets"><Num value={r.sheets || 0} onChange={(v) => upd({ sheets: v })} step={1} /></Row>
                        <Row label="Plates (0 = Auto)"><Num value={r.plates || 0} onChange={(v) => upd({ plates: v })} step={1} /></Row>
                        <Row label="Makeready Shts"><Num value={r.makereadySheets || 0} onChange={(v) => upd({ makereadySheets: v })} step={1} /></Row>
                        <Row label="Run Waste %"><Num value={r.runWastePct ?? 5} onChange={(v) => upd({ runWastePct: v })} /></Row>
                        <Row label="Bind Waste Shts"><Num value={r.bindWasteSheets || 0} onChange={(v) => upd({ bindWasteSheets: v })} step={1} /></Row>
                        <Row label="Colors Side 1 / 2" wide>
                          <div className="flex gap-2">
                            <Num value={r.runColorsSide1 || 0} onChange={(v) => upd({ runColorsSide1: v })} step={1} />
                            <Num value={r.runColorsSide2 || 0} onChange={(v) => upd({ runColorsSide2: v })} step={1} />
                          </div>
                        </Row>
                        <Row label="Speed (SPH)"><Num value={r.runSpeedSph || 0} onChange={(v) => upd({ runSpeedSph: v })} step={100} /></Row>
                        <Row label="Work & Turn" wide>
                          <label className="flex items-center gap-2 text-[12px] text-amber-200/80">
                            <input type="checkbox" checked={!!r.workAndTurn} onChange={(e) => upd({ workAndTurn: e.target.checked })} />
                            same plates print both sides
                          </label>
                        </Row>
                      </div>
                    );
                  })}
                  <button type="button"
                    className="mt-1 rounded-sm border border-amber-700/60 px-2 py-1 text-[12px] text-amber-300 hover:bg-amber-900/30"
                    onClick={() => setP("runs", ([...(((pv("runs") as any[]) || [])), defaultPressRun()]) as any)}>
                    + Add press run
                  </button>
                </div>
                <Row label="Versions"><Num value={pv("versions")} onChange={(v) => setP("versions", v)} step={1} /></Row>
                <Row label="Run Waste %"><Num value={pv("runWastePct")} onChange={(v) => setP("runWastePct", v)} /></Row>
                <StdRow label="Plate Hrs / Plate" show={showStd}><Num value={pv("plateHrsPerPlate")} onChange={(v) => setP("plateHrsPerPlate", v)} /></StdRow>
                <Row label="Plate Hrs Diff"><Num value={pv("plateHrsDiff")} onChange={(v) => setP("plateHrsDiff", v)} /></Row>
                <StdRow label="Plate Labor $/Hr" show={showStd}><Num value={pv("plateLaborRate")} onChange={(v) => setP("plateLaborRate", v)} /></StdRow>
                {/* Small-run speed curve (Mary 7/21): "not going to hit
                    10,000/hr on smaller runs" — thresholds are PLACEHOLDER
                    (SMALL_RUN_SPEED_CURVE in classic-estimate.ts). */}
                <Row label="Small-Run Speed Curve" wide>
                  <label className="flex items-center gap-2 font-mono text-[13px] text-amber-200">
                    <input
                      type="checkbox"
                      className="accent-amber-400"
                      checked={pv("useSpeedCurve") !== false}
                      onChange={(e) => setP("useSpeedCurve", e.target.checked)}
                    />
                    derate short runs
                  </label>
                </Row>
                <Readout label="Suggested SPH (auto)" value={pcalc.effectiveSph > 0 ? `${Math.round(pcalc.effectiveSph).toLocaleString()} (×${pcalc.speedFactor}${pcalc.speedCapReason ? `, ${pcalc.speedCapReason} cap` : ""})` : "—"} />
                <Row label="Solid-Coverage Cap (SPH)"><Num value={form.solidCoverageSpeed} onChange={(v) => set("solidCoverageSpeed", v)} step={100} /></Row>
                <Row label="Heavy Coverage ≥ %"><Num value={form.heavyCoveragePct} onChange={(v) => set("heavyCoveragePct", v)} /></Row>
                <StdRow label="Board Cap (Inches)" show={showStd}><Num value={form.boardCapInches} onChange={(v) => set("boardCapInches", v)} /></StdRow>
                <StdRow label="Board Cap Speed (SPH)" show={showStd}><Num value={form.boardCapSpeed} onChange={(v) => set("boardCapSpeed", v)} step={100} /></StdRow>
                <Row label="Run Diff"><Num value={pv("runDiff")} onChange={(v) => setP("runDiff", v)} /></Row>
                {/* Mary's waste rule (7/20): 100 shts/color/side + 100 per
                    equipment pass; all editable, manual sheets override. */}
                <Row label="Waste / Color / Side Shts"><Num value={pv("wastePerColorSheets")} onChange={(v) => setP("wastePerColorSheets", v)} step={10} /></Row>
                <Row label="Waste / Equipment Shts"><Num value={pv("wastePerEquipmentSheets")} onChange={(v) => setP("wastePerEquipmentSheets", v)} step={10} /></Row>
                <Row label="Equipment Passes (0 = Auto)"><Num value={pv("equipmentPassesManual")} onChange={(v) => setP("equipmentPassesManual", v)} step={1} /></Row>
                <Readout label="Passes Counted" value={String(pcalc.equipmentPasses)} />
                <Row label="Waste Sheets (0 = Auto)"><Num value={pv("wasteSheetsManual")} onChange={(v) => setP("wasteSheetsManual", v)} step={10} /></Row>
                <Readout label="Waste Sheets Used" value={String(pcalc.mrWasteSheets)} />
              </>
            )}
          </div>
          <div>
            {digital ? (
              <>
                <SectionTitle>{numParts > 1 ? `Digital Click Engine — Part ${partIndex + 1}` : "Digital Click Engine"}</SectionTitle>
                {standards ? (
                  <>
                    <Readout label="Size Tier" value={`Tier ${getDigitalSizeTier(pv("sheetWidthRun"), pv("sheetHeightRun"), standards)}`} />
                    <Readout label="Click Rate" value={`$${pcalc.digitalClickRate.toFixed(4)}/sheet`} />
                    <Readout label="Click Sheets (run + MR)" value={String(pcalc.digitalClickSheets)} />
                    <Readout label="Click Cost" value={money(pcalc.digitalClickCost)} />
                    {pv("digitalVariableData") && (
                      <>
                        <Readout label="VD Adder" value={money(pcalc.digitalVDCost)} />
                        <Readout label="VD Setup" value={money(pcalc.digitalVDSetupCost)} />
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-[12px] text-red-400">Plant standards not loaded — digital click rates unavailable.</p>
                )}
                <Readout label="Die/Score Hrs" value={hrs(pcalc.dieScoreHrs)} />
                <Readout label="Press Cost" value={money(pcalc.pressCost)} />
              </>
            ) : (
              <>
                <SectionTitle>Ink</SectionTitle>
                <Row label="Black % Coverage"><Num value={pv("inkCoverageBlackPct")} onChange={(v) => setP("inkCoverageBlackPct", v)} /></Row>
                <StdRow label="Black Ink $/Lb" show={showStd}><Num value={pv("inkBlackDollarsPerLb")} onChange={(v) => setP("inkBlackDollarsPerLb", v)} /></StdRow>
                <Row label="Process % Coverage"><Num value={pv("inkCoverageColorPct")} onChange={(v) => setP("inkCoverageColorPct", v)} /></Row>
                <StdRow label="Process Ink $/Lb" show={showStd}><Num value={pv("inkDollarsPerLb")} onChange={(v) => setP("inkDollarsPerLb", v)} /></StdRow>
                <Row label="LED Process % Coverage"><Num value={pv("inkCoverageLedPct")} onChange={(v) => setP("inkCoverageLedPct", v)} /></Row>
                <StdRow label="LED Process Ink $/Lb" show={showStd}><Num value={pv("inkLedDollarsPerLb")} onChange={(v) => setP("inkLedDollarsPerLb", v)} /></StdRow>
                <Row label="PMS % Coverage"><Num value={pv("inkCoveragePmsPct")} onChange={(v) => setP("inkCoveragePmsPct", v)} /></Row>
                <StdRow label="PMS Ink $/Lb" show={showStd}><Num value={pv("inkPmsDollarsPerLb")} onChange={(v) => setP("inkPmsDollarsPerLb", v)} /></StdRow>
                <Row label="Varnish % Coverage"><Num value={pv("inkCoverageVarnishPct")} onChange={(v) => setP("inkCoverageVarnishPct", v)} /></Row>
                <StdRow label="Varnish $/Lb" show={showStd}><Num value={pv("varnishDollarsPerLb")} onChange={(v) => setP("varnishDollarsPerLb", v)} /></StdRow>
                <Row label="Ink Factor (M sq-in/lb)"><Num value={pv("inkFactorMsqinPerLb")} onChange={(v) => setP("inkFactorMsqinPerLb", v)} /></Row>
                <SectionTitle>Coatings / Aqueous</SectionTitle>
                <Row label="Coating Type" wide>
                  <select
                    className={inputCls + " w-[220px]"}
                    value={pv("coatingType")}
                    onChange={(e) => onCoatingType(e.target.value)}
                  >
                    {COATING_TYPES.map((t) => <option key={t} value={t}>{t || "— none —"}</option>)}
                  </select>
                </Row>
                {pv("coatingType") && (
                  <>
                    <Row label="Spot Coating" wide>
                      <label className="flex items-center gap-2 text-[12px] text-amber-200/80">
                        <input type="checkbox" checked={!!pv("coatingIsSpot")} onChange={(e) => setP("coatingIsSpot", e.target.checked)} />
                        spot (carries an image — needs its own plate); unchecked = flood
                      </label>
                    </Row>
                    <Row label="Coating % Coverage"><Num value={pv("coatingCoveragePct")} onChange={(v) => setP("coatingCoveragePct", v)} /></Row>
                    <StdRow label="Coating $/Lb" show={showStd}><Num value={pv("coatingDollarsPerLb")} onChange={(v) => setP("coatingDollarsPerLb", v)} /></StdRow>
                    <Readout label="Coating" value={`${pcalc.coatingLbs.toFixed(2)} lbs / ${money(pcalc.coatingCost)}`} />
                  </>
                )}
                <SectionTitle>Extras</SectionTitle>
                <Row label="Press Check Hrs"><Num value={pv("pressCheckHrs")} onChange={(v) => setP("pressCheckHrs", v)} /></Row>
                <SectionTitle>{numParts > 1 ? `Computed — Part ${partIndex + 1}` : "Computed"}</SectionTitle>
                <Readout label="Plates" value={String(pcalc.plates)} />
                <Readout label="Makeready" value={hrs(pcalc.makereadyHrs)} />
                <Readout label="Washup" value={hrs(pcalc.washupHrs)} />
                <Readout label="Run" value={hrs(pcalc.runHrs)} />
                <Readout label="Ink" value={[[pcalc.inkLbsBlack, "blk"], [pcalc.inkLbsProcess, "proc"], [pcalc.inkLbsLed, "LED"], [pcalc.inkLbsPms, "PMS"], [pcalc.inkLbsVarnish, "varn"]].filter(([lb]) => (lb as number) > 0).map(([lb, t]) => `${(lb as number).toFixed(2)}lb ${t}`).join(" + ") + ` / ${money(pcalc.inkCost)}` || "—"} />
                <Readout label="Press Cost" value={money(pcalc.pressCost)} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function screen8() {
    return (
      <div>
        {partTabs()}
        <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
          <div>
            <SectionTitle>Operation</SectionTitle>
            <Row label="Operation Type" wide>
              <select
                className={inputCls + " w-[220px]"}
                value={pv("binderyOperation")}
                onChange={(e) => {
                  // Picking the operation now PREFILLS its line, so it stops
                  // being cosmetic — before, choosing "Saddle" added nothing
                  // (Mary 8/10). Only fills setup when the line is still empty,
                  // so it never clobbers hours Mary has already typed.
                  const op = parseInt(e.target.value);
                  const patch: Partial<ClassicPart> = { binderyOperation: op };
                  const stitchOp = op === 2 || op === 4 || op === 5; // Saddle / Perfect / Multibind
                  if (stitchOp && !pv("stitchSetupHrs") && !pv("stitchRunHrs")) patch.stitchSetupHrs = 0.5;
                  if (op === 3 && !pv("foldSetupHrs") && !pv("foldRunHrs")) patch.foldSetupHrs = 0.4;
                  patchP(patch);
                }}
              >
                {BINDERY_OPERATIONS.map((op, i) => (
                  <option key={op} value={i + 1}>{op}</option>
                ))}
              </select>
            </Row>
            <SectionTitle>Cutting / Trimming / Drilling</SectionTitle>
            <Row label="Cutting Diff"><Num value={pv("cuttingDiff")} onChange={(v) => setP("cuttingDiff", v)} /></Row>
            <Readout label="Load Cutter Hrs (auto)" value={hrs(pcalc.cutterHrs)} />
            {/* Trim auto-computes from cuts × sec/cut × cutting diff, like
                E&M did once Mary entered the difficulty (7/20). */}
            <Row label="Cuts To Final (0 = Auto)"><Num value={pv("cutsToFinalSize")} onChange={(v) => setP("cutsToFinalSize", v)} step={1} /></Row>
            <Readout label="Cuts Used (From Pg 6 Sheet)" value={String(pcalc.cutsUsed)} />
            <StdRow label="Sheets Per Lift" show={showStd}><Num value={pv("sheetsPerLift")} onChange={(v) => setP("sheetsPerLift", v)} step={50} /></StdRow>
            <Row label="Sec Per Cut"><Num value={pv("cutSecPerCut")} onChange={(v) => setP("cutSecPerCut", v)} /></Row>
            <Row label="Trim Hrs (0 = Auto)"><Num value={pv("trimHrs")} onChange={(v) => setP("trimHrs", v)} /></Row>
            <label className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={!!pv("noCutting")} onChange={(e) => setP("noCutting", e.target.checked)} />
              <span>No Cutting — charge $0 (0 in the boxes below means Auto, not none)</span>
            </label>
            <Row label="Cutter Lifts (0 = Auto)"><Num value={pv("cutterLifts")} onChange={(v) => setP("cutterLifts", v)} step={1} /></Row>
            <Row label="Cutter Difficulty"><Num value={pv("cutterDiff")} onChange={(v) => setP("cutterDiff", v)} step={0.1} /></Row>
            <Row label="Load Cutter Hrs (0=Auto)"><Num value={pv("cutterHrsManual")} onChange={(v) => setP("cutterHrsManual", v)} /></Row>
            <div className="col-span-2 pl-[224px] text-[11px] text-amber-400/70">
              {pcalc.liftsUsed} lifts × {pv("cutterHrsPerLift")} hr × {pv("cutterDiff") || 1} difficulty
              = {pcalc.cutterHrs.toFixed(2)} hrs{(pv("cutterHrsManual") || 0) > 0 ? " (overridden)" : " (auto)"}
            </div>
            <StdRow label="Cutter $/Hr" show={showStd}><Num value={pv("cutterRatePerHr")} onChange={(v) => setP("cutterRatePerHr", v)} /></StdRow>
            <StdRow label="Trim $/Hr" show={showStd}><Num value={pv("trimRatePerHr")} onChange={(v) => setP("trimRatePerHr", v)} /></StdRow>
            <Readout label="Trim Hrs Used" value={hrs(pcalc.trimHrsUsed)} />
            <Row label="Drill Holes"><Num value={pv("drillHoles")} onChange={(v) => setP("drillHoles", v)} step={1} /></Row>
            <Row label="Drill Diff"><Num value={pv("drillDiff")} onChange={(v) => setP("drillDiff", v)} /></Row>
            <StdRow label="Drill Hrs/Hole" show={showStd}><Num value={pv("drillHrsPerHole")} onChange={(v) => setP("drillHrsPerHole", v)} /></StdRow>
            {/* Folder PICKER, the way E&M did it: her cost sheets read
                "Folding on the baum-26x40 Configuration Normal". Choosing the
                machine sets its rate, speed and setup time. */}
            {/* FOLD TYPE — Mary's Fold Types table (8/20). Choosing the fold
                pulls the machine, setup, speed and waste, exactly as she drew
                it: "the estimator enters the job information, while the system
                pulls the production rules from the tables". */}
            <Row label="Fold Type" wide>
              <select className={inputCls} value={String(pv("foldTypeName") || "")}
                onChange={(e) => {
                  const nm = e.target.value;
                  const ft = foldTypes.find((x) => x.name === nm);
                  patchP({
                    foldTypeName: nm,
                    ...(ft ? {
                      folderConfig: ft.machineName || pv("folderConfig"),
                      folderSpeedPerHr: ft.speedPerHour,
                      foldSetupHrs: (ft.setupMinutes || 0) / 60,
                      foldWastePct: ft.wasteSheets || 0,
                      scorePerfHrs: ft.scoringRequired === "Yes" ? (pv("scorePerfHrs") || 0.1) : pv("scorePerfHrs"),
                    } : {}),
                  } as any);
                }}>
                <option value="">(choose a fold)</option>
                {foldTypes.map((ft) => (
                  <option key={ft.id} value={ft.name}>
                    {ft.name} — {ft.machineName}, {ft.speedPerHour.toLocaleString()}/hr, {ft.setupMinutes}min setup
                    {ft.scoringRequired !== "No" ? `, score ${String(ft.scoringRequired).toLowerCase()}` : ""}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="Fold Waste %"><Num value={pv("foldWastePct")} onChange={(v) => setP("foldWastePct", v)} /></Row>
            <Row label="Folder" wide>
              <select className={inputCls} value={pv("folderConfig") || ""}
                onChange={(e) => {
                  const name = e.target.value;
                  const m = folders.find((x) => x.name === name);
                  setP("folderConfig", name);
                  if (m) patchP({
                    folderConfig: name,
                    folderRatePerHr: m.rate,
                    folderSpeedPerHr: m.speed,
                    foldSetupHrs: pv("foldSetupHrs") || m.setupHrs,
                  } as any);
                }}>
                <option value="">(no folding)</option>
                {folders.map((m) => (
                  <option key={m.name} value={m.name}>{m.name} — {m.speed.toLocaleString()}/hr, ${m.rate}/hr</option>
                ))}
              </select>
            </Row>
            {/* Folding machine line (E&M #348538: 0.6 setup + 1.4 run @ ~$48) */}
            <Row label="Pieces To Fold (0 = Qty)"><Num value={pv("foldCount")} onChange={(v) => setP("foldCount", v)} step={100} /></Row>
            <Row label="Folder Speed / Hr"><Num value={pv("folderSpeedPerHr")} onChange={(v) => setP("folderSpeedPerHr", v)} step={100} /></Row>
            <Row label="Fold Difficulty"><Num value={pv("foldDiff")} onChange={(v) => setP("foldDiff", v)} step={0.1} /></Row>
            <Row label="Fold Setup Hrs"><Num value={pv("foldSetupHrs")} onChange={(v) => setP("foldSetupHrs", v)} /></Row>
            <Row label="Fold Run Hrs (0 = Auto)"><Num value={pv("foldRunHrs")} onChange={(v) => setP("foldRunHrs", v)} /></Row>
            {/* Show the arithmetic. Mary 8/19: "folding I have no clue how to
                even put this in" -- E&M computed the run hours for her, so
                spell out exactly what we computed and from what. */}
            <div className="col-span-2 pl-[224px] text-[11px] text-amber-400/70">
              {pcalc.foldPieces.toLocaleString()} pieces ÷ {(pv("folderSpeedPerHr") || 0).toLocaleString()}/hr
              {(pv("foldDiff") || 1) !== 1 ? ` × ${pv("foldDiff")} difficulty` : ""} = {pcalc.foldRunUsed.toFixed(2)} run hrs
              {(pv("foldRunHrs") || 0) > 0 ? " (overridden above)" : " (auto)"}
            </div>
            <StdRow label="Folder Rate $/Hr" show={showStd}><Num value={pv("folderRatePerHr")} onChange={(v) => setP("folderRatePerHr", v)} /></StdRow>
            <Readout label="Fold Labor" value={`${pcalc.foldHrs.toFixed(2)} hrs / ${money(pcalc.foldLabor)}`} />
            {/* Saddle stitching (Mueller) — the line Mary asked for (8/10).
                Run auto-computes from the finished count ÷ stitcher speed; a
                typed Run value overrides. Prefills when Operation Type =
                Saddle / Perfect / Multibind. */}
            <SectionTitle>Saddle Stitch</SectionTitle>
            <Row label="Stitcher" wide>
              <select className={inputCls} value={pv("stitcherName") || ""}
                onChange={(e) => {
                  const name = e.target.value;
                  const x = stitchers.find((z) => z.name === name);
                  patchP({ stitcherName: name, ...(x ? { stitchRatePerHr: x.rate, stitchSpeed: x.speed } : {}) } as any);
                }}>
                <option value="">(default)</option>
                {stitchers.map((x) => (
                  <option key={x.name} value={x.name}>{x.name} — {x.speed.toLocaleString()} books/hr, ${x.rate}/hr</option>
                ))}
              </select>
            </Row>
            <Row label="Stitch Setup Hrs"><Num value={pv("stitchSetupHrs")} onChange={(v) => setP("stitchSetupHrs", v)} /></Row>
            <Row label="Stitcher Speed (bk/hr)"><Num value={pv("stitchSpeed")} onChange={(v) => setP("stitchSpeed", v)} step={500} /></Row>
            <Row label="Stitch Run Hrs (0 = Auto)"><Num value={pv("stitchRunHrs")} onChange={(v) => setP("stitchRunHrs", v)} /></Row>
            <Readout label="Stitch Run Used" value={hrs(pcalc.stitchRunUsed)} />
            <Row label="Stitch Help Hrs"><Num value={pv("stitchHelpHrs")} onChange={(v) => setP("stitchHelpHrs", v)} /></Row>
            <Row label="Stitcher Rate $/Hr"><Num value={pv("stitchRatePerHr")} onChange={(v) => setP("stitchRatePerHr", v)} /></Row>
            <StdRow label="Stitch Help Rate $/Hr" show={showStd}><Num value={pv("stitchHelpRatePerHr")} onChange={(v) => setP("stitchHelpRatePerHr", v)} /></StdRow>
            <Readout label="Stitch Labor" value={`${pcalc.stitchHrs.toFixed(2)} hrs / ${money(pcalc.stitchLabor)}`} />
            <StdRow label="Bindery Rate $/Hr" show={showStd}><Num value={pv("binderyHourlyRate")} onChange={(v) => setP("binderyHourlyRate", v)} /></StdRow>
            {dieCuttingSection()}
          </div>
          <div>
            {( [1, 2] as const).map((n) => {
              const key = (n === 1 ? "handOp1" : "handOp2") as "handOp1";
              const op = pv(key);
              const opHrs = n === 1 ? pcalc.handOp1Hrs : pcalc.handOp2Hrs;
              return (
                <div key={n}>
                  <SectionTitle>Hand Op {n}</SectionTitle>
                  <Row label="Description" wide>
                    <Txt value={op.description} onChange={(v) => setP(key, { ...op, description: v })} />
                  </Row>
                  <Row label="Pieces/Hr"><Num value={op.piecesPerHour} onChange={(v) => setP(key, { ...op, piecesPerHour: v })} step={1} /></Row>
                  <Row label="% Of Qty"><Num value={op.pctOfQty} onChange={(v) => setP(key, { ...op, pctOfQty: v })} /></Row>
                  <Readout label="Hours" value={hrs(opHrs)} />
                </div>
              );
            })}
            <SectionTitle>Band / Pad / Wrap</SectionTitle>
            {/* "In" = pieces per bundle → hours auto-compute at the bundle
                rate; typed Hrs overrides (0 = auto). Mary 7/20. */}
            <StdRow label="Bundle Rate (Bundles/Hr)" show={showStd}><Num value={pv("bundleRatePerHr")} onChange={(v) => setP("bundleRatePerHr", v)} step={10} /></StdRow>
            <Row label="Band In (Pcs/Bundle)" wide><Txt value={pv("bandIn")} onChange={(v) => setP("bandIn", v)} placeholder="e.g. 50" /></Row>
            <Row label="Band Hrs (0 = Auto)"><Num value={pv("bandHrs")} onChange={(v) => setP("bandHrs", v)} /></Row>
            <Readout label="Band Hrs Used" value={hrs(pcalc.bandHrsUsed)} />
            <Row label="Pad In (Pcs/Bundle)" wide><Txt value={pv("padIn")} onChange={(v) => setP("padIn", v)} placeholder="e.g. 100" /></Row>
            <Row label="Pad Hrs (0 = Auto)"><Num value={pv("padHrs")} onChange={(v) => setP("padHrs", v)} /></Row>
            <Readout label="Pad Hrs Used" value={hrs(pcalc.padHrsUsed)} />
            <Row label="Wrap In (Pcs/Bundle)" wide><Txt value={pv("wrapIn")} onChange={(v) => setP("wrapIn", v)} placeholder="e.g. 100 kraft" /></Row>
            <Row label="Wrap Hrs (0 = Auto)"><Num value={pv("wrapHrs")} onChange={(v) => setP("wrapHrs", v)} /></Row>
            <Readout label="Wrap Hrs Used" value={hrs(pcalc.wrapHrsUsed)} />
            <SectionTitle>Carton Pack</SectionTitle>
            {/* Mary 7/20: cartons auto-compute from paper weight, max 35 lbs
                per carton; typing a count overrides the auto. */}
            <Readout label="Paper Weight (Lbs)" value={pcalc.paperLbs > 0 ? pcalc.paperLbs.toFixed(1) : "— enter Lbs/M on Pg 6"} />
            <Readout label="Cartons Auto (35 Lb Max)" value={String(pcalc.cartonsAuto)} />
            <label className="flex items-center gap-2 text-sm py-1">
              <input type="checkbox" checked={!!pv("noCartons")} onChange={(e) => setP("noCartons", e.target.checked)} />
              <span>No Cartons — charge $0 (0 below means Auto, not none)</span>
            </label>
            <Row label="Cartons (0 = Auto)"><Num value={pv("cartons")} onChange={(v) => setP("cartons", v)} step={1} /></Row>
            <Readout label="Cartons Used" value={String(pcalc.cartonsUsed)} />
            <Readout label="Carton/Skid $ (Material Line)" value={money(pcalc.cartonSkidCost)} />
            <Row label="  @ $ each"><Num value={pv("cartonCost")} onChange={(v) => setP("cartonCost", v)} /></Row>
            <Row label="Skid Pack (skids)"><Num value={pv("skids")} onChange={(v) => setP("skids", v)} step={1} /></Row>
            <Row label="  @ $ each"><Num value={pv("skidCost")} onChange={(v) => setP("skidCost", v)} /></Row>
            <StdRow label="Cartons / Hr (Auto Pack)" show={showStd}><Num value={pv("cartonsPerHour")} onChange={(v) => setP("cartonsPerHour", v)} step={1} /></StdRow>
            <Row label="Pack Hrs"><Num value={pv("packHrs")} onChange={(v) => setP("packHrs", v)} /></Row>
            <StdRow label="Pack $/Hr" show={showStd}><Num value={pv("packRatePerHr")} onChange={(v) => setP("packRatePerHr", v)} /></StdRow>
            <StdRow label="Wrap $/Hr" show={showStd}><Num value={pv("wrapRatePerHr")} onChange={(v) => setP("wrapRatePerHr", v)} /></StdRow>
            <StdRow label="Hand Bind $/Hr" show={showStd}><Num value={pv("handBindRatePerHr")} onChange={(v) => setP("handBindRatePerHr", v)} /></StdRow>
            <StdRow label="Pad $/Hr" show={showStd}><Num value={pv("padRatePerHr")} onChange={(v) => setP("padRatePerHr", v)} /></StdRow>
            <StdRow label="Pads / Hr" show={showStd}><Num value={pv("padsPerHour")} onChange={(v) => setP("padsPerHour", v)} step={10} /></StdRow>
            <Row label="Delivery Hrs"><Num value={pv("deliveryHrs")} onChange={(v) => setP("deliveryHrs", v)} /></Row>
            <StdRow label="Delivery $/Hr" show={showStd}><Num value={pv("deliveryRatePerHr")} onChange={(v) => setP("deliveryRatePerHr", v)} /></StdRow>
            <Readout label={numParts > 1 ? `Bindery Hrs — Part ${partIndex + 1}` : "Bindery Hrs Total"}
              value={`${hrs(pcalc.binderyHrs)}${(pcalc.cutterHrs + pcalc.trimHrsUsed) > 0 ? ` (incl auto cut ${pcalc.cutterHrs.toFixed(2)} + trim ${pcalc.trimHrsUsed.toFixed(2)} — Cutting Diff 0 removes)` : ""}`} />
            <Readout label={numParts > 1 ? `Bindery Cost — Part ${partIndex + 1}` : "Bindery Cost"} value={money(pcalc.binderyCost)} />
            {numParts > 1 && <Readout label="Bindery Cost — All Parts" value={money(calc.binderyCost)} />}
          </div>
        </div>
      </div>
    );
  }

  function screen9() {
    return (
      <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-[380px_1fr]">
        <div>
          <SectionTitle>Additional</SectionTitle>
          <Row label="Additional Costs $"><Num value={form.additionalCosts} onChange={(v) => set("additionalCosts", v)} /></Row>
          <Row label="Freight $"><Num value={form.freight} onChange={(v) => set("freight", v)} /></Row>
          <Row label="Freight In Outside" wide>
            <label className="flex items-center gap-2 text-[12px] text-amber-200/80">
              <input type="checkbox" checked={form.freightInOutside !== false} onChange={(e) => set("freightInOutside", e.target.checked)} />
              freight sits in the Outside bucket at COST (E&amp;M marks up purchase rows only)
            </label>
          </Row>
          <Row label="Bindery Overs (printed, not billed)"><Num value={form.binderyOvers} onChange={(v) => set("binderyOvers", v)} step={1} /></Row>
          <Row label="Mill Item Stock" wide>
            <label className="flex items-center gap-2 text-[12px] text-amber-200/80">
              <input type="checkbox" checked={!!form.millItemStock} onChange={(e) => set("millItemStock", e.target.checked)} />
              special-order stock — adds a lead-time note to the letter
            </label>
          </Row>
          <Row label="Plate Discount $"><Num value={form.plateDiscount} onChange={(v) => set("plateDiscount", v)} /></Row>
          {/* One-time die / cutting / stripping fees — E&M states these in the
              quote NOTES ("Includes 1 time new die fee of $X") and deliberately
              keeps them OUT of the priced buildup. */}
          <div className="mt-3 border-t border-amber-800/40 pt-2">
            <div className="mb-1 text-[12px] uppercase tracking-wide text-amber-400/90">
              One-Time Charges (print on letter, NOT in price)
            </div>
            {(form.oneTimeCharges || []).map((c, i) => (
              <div key={i} className="mb-1 flex items-center gap-2">
                <input className={inputCls} placeholder="e.g. 1 time new die fee"
                  value={c.description}
                  onChange={(e) => {
                    const next = [...(form.oneTimeCharges || [])];
                    next[i] = { ...next[i], description: e.target.value };
                    set("oneTimeCharges", next);
                  }} />
                <div className="w-[140px]">
                  <Num value={c.amount} onChange={(v) => {
                    const next = [...(form.oneTimeCharges || [])];
                    next[i] = { ...next[i], amount: v };
                    set("oneTimeCharges", next);
                  }} />
                </div>
                <button type="button" className="px-2 text-[12px] text-amber-400/70 hover:text-amber-200"
                  onClick={() => set("oneTimeCharges", (form.oneTimeCharges || []).filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
            <button type="button"
              className="mt-1 rounded-sm border border-amber-700/60 px-2 py-1 text-[12px] text-amber-300 hover:bg-amber-900/30"
              onClick={() => set("oneTimeCharges", [...(form.oneTimeCharges || []), { description: "", amount: 0 }])}>
              + Add one-time charge
            </button>
          </div>
          <Row label="Card Surcharge %"><Num value={form.cardSurchargePct} onChange={(v) => set("cardSurchargePct", v)} /></Row>
          <Row label="Delivery Zone" wide><Txt value={form.deliveryZone} onChange={(v) => set("deliveryZone", v)} /></Row>
          <SectionTitle>Outside Purchases</SectionTitle>
          {/* Mary 7/21: outside services can be $/M (scale to each quoted
              quantity via the tier re-runs) and carry a +3% upcharge. Old
              rows without the keys stay flat / no 3%. */}
          {form.outsidePurchases.map((p, i) => {
            const upd = (patch: Partial<typeof p>) => {
              const next = [...form.outsidePurchases];
              next[i] = { ...next[i], ...patch };
              set("outsidePurchases", next);
            };
            const rowCost = (p.per === "perM" ? (p.amount || 0) * (form.quantity || 0) / 1000 : (p.amount || 0)) * (p.plus3 ? 1.03 : 1);
            return (
              <div key={i} className="mb-1">
                <div className="grid grid-cols-[96px_1fr_80px_84px_78px_52px_28px] gap-1">
                  <select
                    className={inputCls}
                    value={p.source === "todd" ? "todd" : "vendor"}
                    onChange={(e) => {
                      const src = e.target.value as "todd" | "vendor";
                      // Todd = in-house: no handling upcharge by default
                      upd({ source: src, plus3: src === "todd" ? false : p.plus3 });
                    }}
                  >
                    <option value="vendor">Vendor</option>
                    <option value="todd">Todd/Fin</option>
                  </select>
                  <input
                    type="text" className={inputCls} placeholder="Description" value={p.description}
                    onChange={(e) => upd({ description: e.target.value })}
                  />
                  <input
                    type="number" step="any" className={inputCls + " text-right"} value={p.amount || 0}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => upd({ amount: parseFloat(e.target.value) || 0 })}
                  />
                  <select
                    className={inputCls}
                    value={p.per === "perM" ? "perM" : "job"}
                    onChange={(e) => upd({ per: e.target.value as "job" | "perM" })}
                  >
                    <option value="job">$ / Job</option>
                    <option value="perM">$ / M</option>
                  </select>
                  {/* Per-row markup: Mary mixes bought-out DIGITAL at 0% with
                      die/glue/foil services at 32% on the SAME quote. Blank =
                      use the job default. */}
                  <input
                    type="number" step="any" className={inputCls + " text-right"}
                    placeholder="mk%"
                    title="Markup % for this row — blank uses the job default"
                    value={p.markupPct === undefined || p.markupPct === null ? "" : p.markupPct}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => upd({ markupPct: e.target.value === "" ? null : (parseFloat(e.target.value) || 0) })}
                  />
                  <label className="flex items-center justify-center gap-1 font-mono text-[11px] text-amber-300">
                    <input
                      type="checkbox"
                      className="accent-amber-400"
                      checked={!!p.plus3}
                      onChange={(e) => upd({ plus3: e.target.checked })}
                    />
                    +3%
                  </label>
                  <button
                    type="button"
                    className="rounded-sm border border-amber-700/60 text-amber-400 hover:bg-amber-400/10"
                    onClick={() => set("outsidePurchases", form.outsidePurchases.filter((_, j) => j !== i))}
                  >×</button>
                </div>
                {/* Per-tier vendor prices (Mary 7/21) — one price input per
                    additional quantity; blank/0 falls back to the primary. */}
                {(form.additionalQuantities || []).some((q) => (Number(q) || 0) > 0) && (
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 pl-2">
                    {(form.additionalQuantities || []).map((q, ti) => {
                      const qty = Number(q) || 0;
                      if (qty <= 0) return null;
                      return (
                        <label key={ti} className="flex items-center gap-1 font-mono text-[10px] text-amber-400/90">
                          @{qty.toLocaleString()}:
                          <input
                            type="number" step="any"
                            className={inputCls + " w-[76px] text-right"}
                            placeholder="= primary"
                            value={p.amountsByTier?.[ti] || 0}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const arr = [...(p.amountsByTier || [])];
                              arr[ti] = parseFloat(e.target.value) || 0;
                              upd({ amountsByTier: arr });
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                )}
                <div className="pr-8 text-right font-mono text-[10px] text-amber-500/70">
                  = {money(rowCost)} at qty {(form.quantity || 0).toLocaleString()}
                </div>
              </div>
            );
          })}
          <button
            type="button"
            className="mt-1 rounded-sm border border-amber-700/60 px-2 py-1 font-mono text-[12px] text-amber-300 hover:bg-amber-400/10"
            onClick={() => set("outsidePurchases", [...form.outsidePurchases, { description: "", amount: 0, per: "job" as const, plus3: true, source: "vendor" as const }])}
          >+ Add Outside Purchase</button>
          <SectionTitle>Quote Notes (Prints On Letter)</SectionTitle>
          {/* Mary's standard letter phrases (7/21) — click to append, edit inline.
              These print on the customer letter under "Notes". */}
          <div className="mb-1 flex flex-wrap gap-1">
            {[
              "Die cost broken out separately: $____",
              "Mill item stock - allow ____ days for delivery",
              "Freight additional",
              "Price valid 30 days",
            ].map((phrase) => (
              <button
                key={phrase}
                type="button"
                className="rounded-sm border border-amber-700/60 px-2 py-[2px] font-mono text-[11px] text-amber-300 hover:bg-amber-400/10"
                onClick={() => set("quoteNotes", [form.quoteNotes, phrase].filter(Boolean).join("\n"))}
              >
                + {phrase}
              </button>
            ))}
          </div>
          <textarea
            className={inputCls + " h-24 w-full py-2 leading-5"}
            value={form.quoteNotes}
            onChange={(e) => set("quoteNotes", e.target.value)}
          />
        </div>

        {/* ── E&M COST SHEET ── */}
        <div className="overflow-x-auto">
          <SectionTitle>Cost Sheet</SectionTitle>
          <table className="w-full border-collapse font-mono text-[13px] text-amber-200">
            <thead>
              <tr className="border-b border-amber-600/60 text-left text-[11px] uppercase tracking-wider text-amber-500">
                <th className="py-1 pr-2">Section</th>
                <th className="py-1 pr-2">Detail</th>
                <th className="py-1 pr-2 text-right">Hours</th>
                <th className="py-1 pr-2 text-right">Cost</th>
                <th className="py-1 pr-2 text-right">Markup</th>
                <th className="py-1 text-right">Selling</th>
              </tr>
            </thead>
            <tbody>
              <CostRow section="PAPER" detail={`${calc.orderSheets} shts @ ${money(form.pricePerM)}/M`}
                cost={calc.paperCost} markup={`${form.markupPaperPct}%`} selling={calc.paperSelling} />
              {/* MATERIAL bucket (E&M #348538): proofs/scans + plates + ink +
                  coating + cartons — all at Material markup. */}
              <CostRow section="MATERIAL"
                detail={[
                  `prep mat ${money(calc.prepMaterials - calc.cartonSkidCost)}`,
                  calc.plateMaterialsCost > 0 ? `plates ${calc.plates} ${money(calc.plateMaterialsCost)}` : "",
                  calc.inkCost > 0 ? `ink ${calc.inkLbs.toFixed(1)} lb ${money(calc.inkCost)}` : "",
                  calc.coatingCost > 0 ? `coat ${calc.coatingLbs.toFixed(1)} lb ${money(calc.coatingCost)}` : "",
                  calc.cartonSkidCost > 0 ? `ctns ${money(calc.cartonSkidCost)}` : "",
                ].filter(Boolean).join(" · ")}
                cost={calc.materialCost} markup={`${form.markupMaterialPct}%`} selling={calc.materialSelling} />
              <CostRow section="LABOR (PREP)" detail={`design/photoshop @ ${money(form.prepressRate)}/hr`}
                hours={calc.prepHours} cost={calc.prepLabor} markup={`${form.markupLaborPct}%`} selling={calc.prepLaborSelling} />
              {calc.isDigital ? (
                <CostRow section="LABOR (PRESS/DIGITAL)"
                  detail={`die/score/check hrs only — clicks under OUTSIDE${form.dieCost ? ` / die ${money(form.dieCost)}` : ""}`}
                  hours={calc.pressHrs} cost={calc.pressCost} markup={`${form.markupLaborPct}%`} selling={calc.pressSelling} />
              ) : (
                <CostRow section="LABOR (PRESS)"
                  detail={`MR ${calc.makereadyHrs.toFixed(2)} / WU ${calc.washupHrs.toFixed(2)} / Run ${calc.runHrs.toFixed(2)}${form.helpers > 0 ? ` · ${form.helpers} helper(s)` : ""}${form.dieCost ? ` · die ${money(form.dieCost)}` : ""}`}
                  hours={calc.pressHrs} cost={calc.pressCost} markup={`${form.markupLaborPct}%`} selling={calc.pressSelling} />
              )}
              <CostRow section="LABOR (BINDERY)"
                detail={`Cut ${calc.cutterHrs.toFixed(2)} / Trim ${form.trimHrs.toFixed(2)} / Fold ${calc.foldHrs.toFixed(2)} / Stitch ${calc.stitchHrs.toFixed(2)} / Drill ${calc.drillHrs.toFixed(2)} / Hand ${(calc.handOp1Hrs + calc.handOp2Hrs).toFixed(2)} / Pack ${form.packHrs.toFixed(2)}`}
                hours={calc.binderyHrs} cost={calc.binderyCost} markup={`${form.markupLaborPct}%`} selling={calc.binderySelling} />
              <CostRow section="OUTSIDE"
                detail={`${form.outsidePurchases.length} item(s)${calc.isDigital ? ` + ${calc.digitalClickSheets} clicks @ $${calc.digitalClickRate.toFixed(4)}${form.digitalVariableData ? " +VD" : ""} = ${money(calc.digitalClickCost + calc.digitalVDCost + calc.digitalVDSetupCost)}` : ""}`}
                cost={calc.outsideCost} markup={`${form.markupOutsidePct}%`} selling={calc.outsideSelling} />
              <CostRow section="FREIGHT + ADDL" detail="pass-through, $1 min"
                cost={calc.freightAndAdditional} markup={calc.freightAndAdditional > 0 ? "+$1" : "—"} selling={calc.freightSelling} />
              <tr className="border-t border-amber-600/60">
                <td className="py-1 pr-2 text-amber-400" colSpan={3}>SUBTOTAL (SELLING)</td>
                <td className="py-1 pr-2 text-right text-amber-500/70">{money(calc.totalCost)}</td>
                <td className="py-1 pr-2" />
                <td className="py-1 text-right">{money(calc.sellingSubtotal)}</td>
              </tr>
              <tr>
                <td className="py-1 pr-2 text-amber-400" colSpan={4}>COMMISSION</td>
                <td className="py-1 pr-2 text-right">{form.commissionPct}%</td>
                <td className="py-1 text-right">{money(calc.commission)}</td>
              </tr>
              <tr className="border-t-2 border-amber-400 text-[15px] font-bold text-amber-100">
                <td className="py-2 pr-2" colSpan={5}>TOTAL</td>
                <td className="py-2 text-right">{money(calc.total)}</td>
              </tr>
              <tr className="text-amber-400/90">
                <td className="py-1 pr-2" colSpan={5}>PRICE / UNIT</td>
                <td className="py-1 text-right">{money(calc.costPerUnit)}</td>
              </tr>
              <tr className="text-amber-400/90">
                <td className="py-1 pr-2" colSpan={5}>PRICE / M</td>
                <td className="py-1 text-right">{money(calc.costPerM)}</td>
              </tr>
            </tbody>
          </table>

          {/* Per-part subtotals (multi-part jobs) */}
          {numParts > 1 && (
            <>
              <SectionTitle>Part Subtotals (cost)</SectionTitle>
              <table className="w-full border-collapse font-mono text-[13px] text-amber-200">
                <thead>
                  <tr className="border-b border-amber-600/60 text-left text-[11px] uppercase tracking-wider text-amber-500">
                    <th className="py-1 pr-2">Part</th>
                    <th className="py-1 pr-2 text-right">Paper</th>
                    <th className="py-1 pr-2 text-right">Press</th>
                    <th className="py-1 pr-2 text-right">Bindery</th>
                    <th className="py-1 text-right">Clicks (Outside)</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.partCalcs.map((pc, i) => (
                    <tr key={i} className="border-b border-amber-800/40">
                      <td className="py-1 pr-2 text-amber-300">Part {i + 1}</td>
                      <td className="py-1 pr-2 text-right">{money(pc.paperCost)}</td>
                      <td className="py-1 pr-2 text-right">{money(pc.pressCost)}</td>
                      <td className="py-1 pr-2 text-right">{money(pc.binderyCost)}</td>
                      <td className="py-1 text-right">{calc.isDigital ? money(pc.digitalClickCost + pc.digitalVDCost + pc.digitalVDSetupCost) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Quantity tiers (E&M multi-quantity quote) */}
          {quantityBreaks.length > 1 && (
            <>
              <SectionTitle>Quantity Tiers</SectionTitle>
              <table className="w-full border-collapse font-mono text-[13px] text-amber-200">
                <thead>
                  <tr className="border-b border-amber-600/60 text-left text-[11px] uppercase tracking-wider text-amber-500">
                    <th className="py-1 pr-2">Quantity</th>
                    <th className="py-1 pr-2 text-right">Total</th>
                    <th className="py-1 pr-2 text-right">Price / Unit</th>
                    <th className="py-1 text-right">Price / M</th>
                  </tr>
                </thead>
                <tbody>
                  {quantityBreaks.map((b, i) => (
                    <tr key={i} className={`border-b border-amber-800/40 ${i === 0 ? "text-amber-100 font-bold" : ""}`}>
                      <td className="py-1 pr-2">{b.quantity.toLocaleString()}{i === 0 ? " (primary)" : ""}</td>
                      <td className="py-1 pr-2 text-right">{money(b.total)}</td>
                      <td className="py-1 pr-2 text-right">{money(b.costPerUnit)}</td>
                      <td className="py-1 text-right">{money(b.costPer1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={() => saveQuote()} disabled={saving} className="bg-amber-500 text-black hover:bg-amber-400">
              {saving ? "Saving…" : "Save Quote"}
            </Button>
            {saved && (
              <span className="font-mono text-[13px] text-green-400">
                Saved {saved.quoteNumber} — <Link href="/dashboard/quotes" className="underline">view in Quotes</Link>
              </span>
            )}
            {saveError && <span className="font-mono text-[13px] text-red-400">{saveError}</span>}
            {checking && <span className="font-mono text-[13px] text-amber-400/70">Double-checking the quote…</span>}
            {/* Draft autosave status — so Mary can see her work is safe without
                clicking Save (Mary 8/10). */}
            {!saved && (
              autoSaveFailed
                ? <span className="font-mono text-[13px] text-red-400">Autosave failed — click Save Quote</span>
                : autoSaving
                  ? <span className="font-mono text-[13px] text-gray-400">Saving draft…</span>
                  : lastAutoSavedAt
                    ? <span className="font-mono text-[13px] text-gray-400">Draft saved automatically — in Quotes as a draft</span>
                    : null
            )}
          </div>
          {/* Sanity-checker verdict — advisory, the quote is already saved. */}
          {checkFlags !== null && !checking && (
            checkFlags.length > 0 ? (
              <div className="mt-3 rounded-sm border border-amber-500/60 bg-amber-400/10 p-3">
                <div className="mb-1 font-mono text-[12px] uppercase tracking-wide text-amber-300">Double-check — worth a look before this goes out</div>
                {checkFlags.map((f, i) => <div key={i} className="text-[13px] leading-relaxed text-amber-100">• {f}</div>)}
                <div className="mt-1 font-mono text-[11px] text-amber-500/60">The quote saved fine — these are only things an estimator might question. Fix and Save again, or ignore.</div>
              </div>
            ) : (
              <div className="mt-3 rounded-sm border border-emerald-700/50 bg-emerald-400/5 p-2 font-mono text-[12px] text-emerald-300">Double-check passed — nothing looks off.</div>
            )
          )}
        </div>
      </div>
    );
  }

  const bodies = [screen1, screen2, screen3, screen4, screen5, screen6, screen7, screen8, screen9];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Classic Estimator</h1>
          <p className="text-sm text-gray-500">
            E&M-style 9-screen flow — Enter moves to the next field, PgUp/PgDn change screens.
          </p>
        </div>
        <Link href="/dashboard/quotes" className="text-sm text-brand-600 hover:underline">← Back to Quotes</Link>
      </div>

      <div
        ref={bodyRef}
        onKeyDown={handleKeyDown}
        className="rounded-md border border-amber-700/60 bg-[#151006] p-4 shadow-lg"
      >
        {/* Numbered screen header bar */}
                {/* ── ASSISTANT ── plain-English in, filled form out */}
        <div className="mb-3 rounded-sm border border-amber-700/60 bg-black/40">
          <button type="button" onClick={() => setAiOpen((o) => !o)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-mono text-[12px] uppercase tracking-wide text-amber-300">
            <span className="text-amber-400">{aiOpen ? "▾" : "▸"}</span>
            START HERE — type the job in your words and the screens fill themselves (or ask any question)
          </button>
          {aiOpen && (
            <div className="border-t border-amber-800/40 p-3">
              <textarea
                className="h-20 w-full rounded-sm border border-amber-700/60 bg-black/60 p-2 font-mono text-[13px] text-amber-200 placeholder:text-amber-200/30 focus:outline-none focus:ring-1 focus:ring-amber-400"
                placeholder={'Say it like you would to a pressman:  "5,000 12pg self-cover booklets, finished 8.5 x 11, 100# gloss text, sheet 19 x 25, 4/4, saddle stitch"  —  or ask a question: "where do I put the die charge?"'}
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" disabled={!!aiBusy} onClick={() => runAssist("fill")}
                  className="rounded-sm bg-amber-500 px-3 py-1.5 font-mono text-[12px] font-bold text-black hover:bg-amber-400 disabled:opacity-50">
                  {aiBusy === "fill" ? "Filling…" : "Fill the screens from this"}
                </button>
                <button type="button" disabled={!!aiBusy} onClick={() => runAssist("ask")}
                  className="rounded-sm border border-amber-600/70 px-3 py-1.5 font-mono text-[12px] text-amber-300 hover:bg-amber-900/40 disabled:opacity-50">
                  {aiBusy === "ask" ? "Thinking…" : "Answer my question"}
                </button>
                <span className="font-mono text-[11px] text-amber-500/60">it only fills fields — you review, nothing saves by itself</span>
              </div>
              {aiAnswer && (
                <div className="mt-2 whitespace-pre-wrap rounded-sm border border-amber-800/40 bg-amber-400/5 p-2 text-[13px] leading-relaxed text-amber-100">{aiAnswer}</div>
              )}
              {aiNotes.length > 0 && (
                <div className="mt-2 rounded-sm border border-emerald-700/40 bg-emerald-400/5 p-2">
                  <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-emerald-400">Set for you — check these</div>
                  {aiNotes.map((n, i) => <div key={i} className="text-[12px] text-emerald-200/90">• {n}</div>)}
                </div>
              )}
              {aiMissing.length > 0 && (
                <div className="mt-2 rounded-sm border border-amber-600/40 bg-amber-400/5 p-2">
                  <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-amber-400">Still needs you</div>
                  {aiMissing.map((n, i) => <div key={i} className="text-[12px] text-amber-200/90">• {n}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
        {/* ── START FROM A PAST QUOTE ── search all saved quotes + seeds */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-sm border border-amber-700/60 bg-black/40 px-3 py-2">
          <span className="font-mono text-[12px] uppercase tracking-wide text-amber-300">Start from a past quote</span>
          <input
            className="w-64 rounded-sm border border-amber-700/60 bg-black/60 p-1.5 font-mono text-[12px] text-amber-200 placeholder:text-amber-200/30"
            placeholder="search customer, job, or quote #…"
            value={tplQuery}
            onChange={(e) => setTplQuery(e.target.value)}
          />
          <select className="min-w-[300px] flex-1 rounded-sm border border-amber-700/60 bg-black/60 p-1.5 font-mono text-[12px] text-amber-200"
            value=""
            onChange={(e) => {
              const t = templates.find((x) => x.label === e.target.value);
              if (!t) return;
              if (!window.confirm(`Copy "${t.label}" as your starting point? Anything on screen now is replaced.`)) return;
              setForm({ ...defaultClassicForm(), ...(t.form as any), customerName: "", quoteNotes: "" });
              setPartIndex(0); setScreen(1);
            }}>
            <option value="">{templates.length ? `${templates.length} matches — newest first, pick one to copy…` : "no matches — try fewer words"}</option>
            {templates.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
          </select>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-amber-700/50 pb-3">
          {SCREENS.map((name, i) => {
            const n = i + 1;
            const active = screen === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setScreen(n)}
                className={`rounded-sm px-2 py-1 font-mono text-[12px] ${
                  active
                    ? "bg-amber-400 font-bold text-black"
                    : "text-amber-400/70 hover:bg-amber-400/10 hover:text-amber-300"
                }`}
                title={name}
              >
                {n}{active ? ` · ${name}` : ""}
              </button>
            );
          })}
          <div className="ml-auto font-mono text-[12px] text-amber-500/80">
            SCREEN {screen}/9 — {SCREENS[screen - 1].toUpperCase()}
            <label className="ml-4 inline-flex items-center gap-1.5 text-[11px] normal-case tracking-normal text-amber-400/70">
              <input type="checkbox" checked={showStd} onChange={(e) => setShowStd(e.target.checked)} />
              show plant standards (rates, speeds, difficulty)
            </label>
            <Link href="/dashboard/quotes/tables"
              className="ml-3 text-[11px] normal-case tracking-normal text-amber-400/70 underline hover:text-amber-200">
              estimating tables (paper caliper / folds)
            </Link>
          </div>
        </div>

        {/* Live status strip */}
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 border-b border-amber-700/30 pb-2 font-mono text-[12px] text-amber-500/90">
          <span>{form.customerName || "— no customer —"}</span>
          <span>{form.jobTitle || "— no title —"}</span>
          <span>QTY {form.quantity || 0}</span>
          <span>{form.jobType}</span>
          <span className="ml-auto text-amber-300">TOTAL {money(calc.total)}</span>
        </div>

        <div className="min-h-[420px]">{bodies[screen - 1]()}</div>

        {/* Footer nav */}
        <div className="mt-4 flex items-center justify-between border-t border-amber-700/50 pt-3">
          <Button
            variant="outline" size="sm"
            className="border-amber-700/60 bg-transparent font-mono text-amber-300 hover:bg-amber-400/10"
            disabled={screen === 1}
            onClick={() => setScreen((s) => Math.max(1, s - 1))}
          >
            ‹ Back (PgUp)
          </Button>
          <span className="font-mono text-[11px] text-amber-600">ENTER = next field · PGDN = next screen</span>
          <Button
            variant="outline" size="sm"
            className="border-amber-700/60 bg-transparent font-mono text-amber-300 hover:bg-amber-400/10"
            disabled={screen === 9}
            onClick={() => setScreen((s) => Math.min(9, s + 1))}
          >
            Next (PgDn) ›
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Small display helpers ──
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 mt-3 border-b border-amber-700/40 pb-[2px] font-mono text-[11px] font-bold uppercase tracking-widest text-amber-500 first:mt-0">
      {children}
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[220px_160px] items-center gap-2 py-[3px]">
      <div className="text-[12px] uppercase tracking-wide text-amber-400/60">{label}</div>
      <div className="text-right font-mono text-[13px] text-amber-100">{value}</div>
    </div>
  );
}

function CostRow({ section, detail, hours, cost, markup, selling }: {
  section: string; detail: string; hours?: number; cost: number; markup: string; selling: number;
}) {
  return (
    <tr className="border-b border-amber-800/40">
      <td className="py-1 pr-2 text-amber-300">{section}</td>
      <td className="max-w-[280px] py-1 pr-2 text-[11px] text-amber-500/80">{detail}</td>
      <td className="py-1 pr-2 text-right">{hours !== undefined ? hours.toFixed(2) : "—"}</td>
      <td className="py-1 pr-2 text-right">{money(cost)}</td>
      <td className="py-1 pr-2 text-right text-amber-500/80">{markup}</td>
      <td className="py-1 text-right">{money(selling)}</td>
    </tr>
  );
}
