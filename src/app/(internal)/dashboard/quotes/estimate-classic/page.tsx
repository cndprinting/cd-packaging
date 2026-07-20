"use client";

// ─────────────────────────────────────────────────────────────────────────
// CLASSIC ESTIMATOR — E&M Parsec-style 9-screen flow (built for Mary).
// One screen visible at a time, Enter advances field-to-field, PgUp/PgDn
// (or the numbered bar / Next / Back) move between screens. Every rate and
// difficulty factor is an editable number prefilled with a default, exactly
// like the DOS system. Nothing persists until "Save Quote".
// ─────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BINDERY_OPERATIONS,
  ClassicForm,
  JOB_TYPES,
  JobType,
  computeClassic,
  defaultClassicForm,
} from "@/lib/classic-estimate";
import { DigitalClickStandards, InkConfig, getDigitalSizeTier } from "@/lib/digital-clicks";

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

function Txt({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text"
      className={inputCls}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const money = (v: number) => `$${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
const hrs = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(2)} hrs`;

export default function ClassicEstimatorPage() {
  const [screen, setScreen] = useState(1); // 1..9
  const [form, setForm] = useState<ClassicForm>(defaultClassicForm);
  const [presses, setPresses] = useState<PressData[]>([]);
  const [standards, setStandards] = useState<(DigitalClickStandards & Record<string, unknown>) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ quoteNumber: string; id: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
          }));
        }
      })
      .catch(() => {});
  }, []);

  const calc = useMemo(() => computeClassic(form, standards), [form, standards]);

  const selectedPress = useMemo(
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
  async function saveQuote() {
    setSaveError(null);
    if (!form.customerName || !form.jobTitle || !form.quantity) {
      setSaveError("Customer name, job title and quantity are required (Screen 1).");
      setScreen(1);
      return;
    }
    setSaving(true);
    try {
      const qty = form.quantity || 1;
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName,
          productName: form.jobTitle,
          productType: "COMMERCIAL_PRINT",
          description: [
            form.stockDescription,
            form.sheetWidthRun && form.sheetHeightRun ? `${form.sheetWidthRun}x${form.sheetHeightRun} sheet` : "",
            form.jobType,
          ].filter(Boolean).join(" — "),
          quantity: qty,
          unitPrice: calc.total / qty,
          notes: [
            "Method: classic (E&M-style estimator)",
            form.quoteNotes,
            form.instructions ? `Instructions: ${form.instructions}` : "",
          ].filter(Boolean).join("\n"),
          specs: JSON.stringify({
            method: "classic",
            classicForm: form,
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
          }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.quote) throw new Error(data.error || "Save failed");
      setSaved({ quoteNumber: data.quote.quoteNumber, id: data.quote.id });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── Screen bodies ──────────────────────────────────────────────────────

  function screen1() {
    return (
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <SectionTitle>Customer</SectionTitle>
          <Row label="Customer Name" wide><Txt value={form.customerName} onChange={(v) => set("customerName", v)} /></Row>
          <Row label="Customer #" wide><Txt value={form.customerNumber} onChange={(v) => set("customerNumber", v)} placeholder="optional" /></Row>
          <Row label="Address" wide><Txt value={form.address} onChange={(v) => set("address", v)} /></Row>
          <SectionTitle>Job</SectionTitle>
          <Row label="Job Title" wide><Txt value={form.jobTitle} onChange={(v) => set("jobTitle", v)} /></Row>
          <Row label="Quantity"><Num value={form.quantity} onChange={(v) => set("quantity", v)} step={1} /></Row>
          <Row label="No. of Parts"><Num value={form.numParts} onChange={(v) => set("numParts", v)} step={1} /></Row>
        </div>
        <div>
          <SectionTitle>Markup Overrides (this job)</SectionTitle>
          <Row label="Paper %"><Num value={form.markupPaperPct} onChange={(v) => set("markupPaperPct", v)} /></Row>
          <Row label="Material %"><Num value={form.markupMaterialPct} onChange={(v) => set("markupMaterialPct", v)} /></Row>
          <Row label="Outside %"><Num value={form.markupOutsidePct} onChange={(v) => set("markupOutsidePct", v)} /></Row>
          <Row label="Labor %"><Num value={form.markupLaborPct} onChange={(v) => set("markupLaborPct", v)} /></Row>
          <Row label="Commission %"><Num value={form.commissionPct} onChange={(v) => set("commissionPct", v)} /></Row>
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
          <Row label="Prepress Rate $/Hr"><Num value={form.prepressRate} onChange={(v) => set("prepressRate", v)} /></Row>
          <SectionTitle>Scans</SectionTitle>
          <Row label="Scans 8.5x11"><Num value={form.scans85x11} onChange={(v) => set("scans85x11", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.scanCharge85x11} onChange={(v) => set("scanCharge85x11", v)} /></Row>
          <Row label="Scans 11x17"><Num value={form.scans11x17} onChange={(v) => set("scans11x17", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.scanCharge11x17} onChange={(v) => set("scanCharge11x17", v)} /></Row>
          <Row label="Scans 20x25"><Num value={form.scans20x25} onChange={(v) => set("scans20x25", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.scanCharge20x25} onChange={(v) => set("scanCharge20x25", v)} /></Row>
        </div>
        <div>
          <SectionTitle>Disks & Proofs</SectionTitle>
          <Row label="Furnished Disks"><Num value={form.furnishedDisks} onChange={(v) => set("furnishedDisks", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.furnishedDiskCharge} onChange={(v) => set("furnishedDiskCharge", v)} /></Row>
          <Row label="Laser Proofs"><Num value={form.laserProofs} onChange={(v) => set("laserProofs", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.laserProofCharge} onChange={(v) => set("laserProofCharge", v)} /></Row>
          <Row label="Color Proofs"><Num value={form.colorProofs} onChange={(v) => set("colorProofs", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.colorProofCharge} onChange={(v) => set("colorProofCharge", v)} /></Row>
          <Readout label="Prepress Labor" value={money(calc.prepLabor)} />
          <Readout label="Prepress Materials" value={money(calc.prepMaterials)} />
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

  function screen6() {
    return (
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <SectionTitle>Sheet</SectionTitle>
          <Row label="Size To Run — Width"><Num value={form.sheetWidthRun} onChange={(v) => set("sheetWidthRun", v)} /></Row>
          <Row label="Size To Run — Height"><Num value={form.sheetHeightRun} onChange={(v) => set("sheetHeightRun", v)} /></Row>
          <Row label="Size To Order — Width"><Num value={form.sheetWidthOrder} onChange={(v) => set("sheetWidthOrder", v)} /></Row>
          <Row label="Size To Order — Height"><Num value={form.sheetHeightOrder} onChange={(v) => set("sheetHeightOrder", v)} /></Row>
          <Row label="Number Of Pages"><Num value={form.numPages} onChange={(v) => set("numPages", v)} step={1} /></Row>
          <Row label="Number Up"><Num value={form.numberUp} onChange={(v) => set("numberUp", v)} step={1} /></Row>
          <Row label="Bleed Allowance" wide><Txt value={form.bleedAllowance} onChange={(v) => set("bleedAllowance", v)} /></Row>
        </div>
        <div>
          <SectionTitle>Stock</SectionTitle>
          <Row label="Stock Description" wide><Txt value={form.stockDescription} onChange={(v) => set("stockDescription", v)} /></Row>
          <Row label="Caliper / Basis Weight" wide><Txt value={form.caliperBasisWeight} onChange={(v) => set("caliperBasisWeight", v)} /></Row>
          <Row label="Brand/Color/Finish" wide><Txt value={form.brandColorFinish} onChange={(v) => set("brandColorFinish", v)} /></Row>
          <Row label="Price Per M Sheets $"><Num value={form.pricePerM} onChange={(v) => set("pricePerM", v)} /></Row>
          <SectionTitle>Computed</SectionTitle>
          <Readout label="Press Sheets" value={String(calc.pressSheets)} />
          <Readout label="+ Makeready Waste" value={String(calc.mrWasteSheets)} />
          <Readout label="Sheets To Order" value={String(calc.orderSheets)} />
          <Readout label="Paper Cost" value={money(calc.paperCost)} />
        </div>
      </div>
    );
  }

  function screen7() {
    const digital = form.jobType === "Digital Direct";
    return (
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <SectionTitle>{digital ? "Digital Press" : "Press Selection"}</SectionTitle>
          <Row label="Press" wide>
            <select
              className={inputCls}
              value={form.pressId}
              onChange={(e) => {
                const press = presses.find((p) => p.id === e.target.value);
                const cfg = press?.configurations[0];
                setForm((f) => ({
                  ...f,
                  pressId: e.target.value,
                  pressConfigId: cfg?.id || "",
                  pressHourlyRate: press ? press.costPerHour + (cfg?.addToHourlyRate || 0) : f.pressHourlyRate,
                  helperHourlyRate: press?.helperCostPerHour ?? f.helperHourlyRate,
                  runSpeedSph: cfg?.speedUncoated ?? f.runSpeedSph,
                  baseMakereadyHrsPerPlate: cfg ? Math.round((cfg.setupMinutes / 60) * 100) / 100 : f.baseMakereadyHrsPerPlate,
                  helpers: cfg?.numHelpers ?? f.helpers,
                }));
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
                value={form.pressConfigId}
                onChange={(e) => {
                  const cfg = selectedPress.configurations.find((c) => c.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    pressConfigId: e.target.value,
                    pressHourlyRate: selectedPress.costPerHour + (cfg?.addToHourlyRate || 0),
                    runSpeedSph: cfg?.speedUncoated ?? f.runSpeedSph,
                    baseMakereadyHrsPerPlate: cfg ? Math.round((cfg.setupMinutes / 60) * 100) / 100 : f.baseMakereadyHrsPerPlate,
                    helpers: cfg?.numHelpers ?? f.helpers,
                  }));
                }}
              >
                {selectedPress.configurations.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.numColors}c, {c.speedUncoated} sph</option>
                ))}
              </select>
            </Row>
          )}
          <Row label="Press Rate $/Hr"><Num value={form.pressHourlyRate} onChange={(v) => set("pressHourlyRate", v)} /></Row>

          {digital ? (
            <>
              <Row label="Ink Config" wide>
                <select
                  className={inputCls + " w-[160px]"}
                  value={form.digitalInkConfig}
                  onChange={(e) => set("digitalInkConfig", e.target.value as InkConfig)}
                >
                  {(["1/0", "1/1", "4/0", "4/1", "4/4"] as InkConfig[]).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Row>
              <Row label="Makeready Sheets"><Num value={form.digitalMakereadySheets} onChange={(v) => set("digitalMakereadySheets", v)} step={1} /></Row>
              <Row label="Variable Data" wide>
                <label className="flex items-center gap-2 font-mono text-[13px] text-amber-200">
                  <input
                    type="checkbox"
                    className="accent-amber-400"
                    checked={form.digitalVariableData}
                    onChange={(e) => set("digitalVariableData", e.target.checked)}
                  />
                  VD per-side adder + setup
                </label>
              </Row>
              {form.digitalVariableData && (
                <Row label="VD Setup Hrs"><Num value={form.digitalVDSetupHrs} onChange={(v) => set("digitalVDSetupHrs", v)} /></Row>
              )}
              <Row label="Die Cut Time (Hrs)"><Num value={form.dieCutHrs} onChange={(v) => set("dieCutHrs", v)} /></Row>
              <Row label="Score/Perf Time (Hrs)"><Num value={form.scorePerfHrs} onChange={(v) => set("scorePerfHrs", v)} /></Row>
              <Row label="Die Cost $"><Num value={form.dieCost} onChange={(v) => set("dieCost", v)} /></Row>
            </>
          ) : (
            <>
              <Row label="Run Side 1 Colors"><Num value={form.runColorsSide1} onChange={(v) => set("runColorsSide1", v)} step={1} /></Row>
              <Row label="Run Side 2 Colors"><Num value={form.runColorsSide2} onChange={(v) => set("runColorsSide2", v)} step={1} /></Row>
              <Row label="Base Makeready Hrs/Plate"><Num value={form.baseMakereadyHrsPerPlate} onChange={(v) => set("baseMakereadyHrsPerPlate", v)} /></Row>
              <Row label="Makeready Diff"><Num value={form.makereadyDiff} onChange={(v) => set("makereadyDiff", v)} /></Row>
              <Row label="Washup Hrs/Unit"><Num value={form.washupHrsPerUnit} onChange={(v) => set("washupHrsPerUnit", v)} /></Row>
              <Row label="Washup Diff"><Num value={form.washupDiff} onChange={(v) => set("washupDiff", v)} /></Row>
              <Row label="Run Speed (SPH)"><Num value={form.runSpeedSph} onChange={(v) => set("runSpeedSph", v)} step={100} /></Row>
              <Row label="Run Diff"><Num value={form.runDiff} onChange={(v) => set("runDiff", v)} /></Row>
              <Row label="Waste Factor %"><Num value={form.wasteFactorPct} onChange={(v) => set("wasteFactorPct", v)} /></Row>
              <Row label="Helpers"><Num value={form.helpers} onChange={(v) => set("helpers", v)} step={1} /></Row>
              <Row label="Helper Rate $/Hr"><Num value={form.helperHourlyRate} onChange={(v) => set("helperHourlyRate", v)} /></Row>
            </>
          )}
        </div>
        <div>
          {digital ? (
            <>
              <SectionTitle>Digital Click Engine</SectionTitle>
              {standards ? (
                <>
                  <Readout label="Size Tier" value={`Tier ${getDigitalSizeTier(form.sheetWidthRun, form.sheetHeightRun, standards)}`} />
                  <Readout label="Click Rate" value={`$${calc.digitalClickRate.toFixed(4)}/sheet`} />
                  <Readout label="Click Sheets (run + MR)" value={String(calc.digitalClickSheets)} />
                  <Readout label="Click Cost" value={money(calc.digitalClickCost)} />
                  {form.digitalVariableData && (
                    <>
                      <Readout label="VD Adder" value={money(calc.digitalVDCost)} />
                      <Readout label="VD Setup" value={money(calc.digitalVDSetupCost)} />
                    </>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-red-400">Plant standards not loaded — digital click rates unavailable.</p>
              )}
              <Readout label="Die/Score Hrs" value={hrs(calc.dieScoreHrs)} />
              <Readout label="Press Cost" value={money(calc.pressCost)} />
            </>
          ) : (
            <>
              <SectionTitle>Ink</SectionTitle>
              <Row label="Black % Coverage"><Num value={form.inkCoverageBlackPct} onChange={(v) => set("inkCoverageBlackPct", v)} /></Row>
              <Row label="Color % Coverage"><Num value={form.inkCoverageColorPct} onChange={(v) => set("inkCoverageColorPct", v)} /></Row>
              <Row label="Varnish % Coverage"><Num value={form.inkCoverageVarnishPct} onChange={(v) => set("inkCoverageVarnishPct", v)} /></Row>
              <Row label="Ink Factor (M sq-in/lb)"><Num value={form.inkFactorMsqinPerLb} onChange={(v) => set("inkFactorMsqinPerLb", v)} /></Row>
              <Row label="Ink $/Lb"><Num value={form.inkDollarsPerLb} onChange={(v) => set("inkDollarsPerLb", v)} /></Row>
              <SectionTitle>Die / Extras</SectionTitle>
              <Row label="Die Cut Time (Hrs)"><Num value={form.dieCutHrs} onChange={(v) => set("dieCutHrs", v)} /></Row>
              <Row label="Score/Perf Time (Hrs)"><Num value={form.scorePerfHrs} onChange={(v) => set("scorePerfHrs", v)} /></Row>
              <Row label="Die Cost $"><Num value={form.dieCost} onChange={(v) => set("dieCost", v)} /></Row>
              <Row label="Press Check Hrs"><Num value={form.pressCheckHrs} onChange={(v) => set("pressCheckHrs", v)} /></Row>
              <SectionTitle>Computed</SectionTitle>
              <Readout label="Plates" value={String(calc.plates)} />
              <Readout label="Makeready" value={hrs(calc.makereadyHrs)} />
              <Readout label="Washup" value={hrs(calc.washupHrs)} />
              <Readout label="Run" value={hrs(calc.runHrs)} />
              <Readout label="Makeready Waste Sheets" value={String(calc.mrWasteSheets)} />
              <Readout label="Ink" value={`${calc.inkLbs.toFixed(2)} lbs / ${money(calc.inkCost)}`} />
              <Readout label="Press Cost" value={money(calc.pressCost)} />
            </>
          )}
        </div>
      </div>
    );
  }

  function screen8() {
    return (
      <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
        <div>
          <SectionTitle>Operation</SectionTitle>
          <Row label="Operation Type" wide>
            <select
              className={inputCls + " w-[220px]"}
              value={form.binderyOperation}
              onChange={(e) => set("binderyOperation", parseInt(e.target.value))}
            >
              {BINDERY_OPERATIONS.map((op, i) => (
                <option key={op} value={i + 1}>{op}</option>
              ))}
            </select>
          </Row>
          <SectionTitle>Cutting / Trimming / Drilling</SectionTitle>
          <Row label="Cutting Diff"><Num value={form.cuttingDiff} onChange={(v) => set("cuttingDiff", v)} /></Row>
          <Row label="Cutter Sheets/Hr"><Num value={form.cutterSheetsPerHr} onChange={(v) => set("cutterSheetsPerHr", v)} step={100} /></Row>
          <Readout label="Load Cutter Hrs (auto)" value={hrs(calc.cutterHrs)} />
          <Row label="Trim Hrs"><Num value={form.trimHrs} onChange={(v) => set("trimHrs", v)} /></Row>
          <Row label="Drill Holes"><Num value={form.drillHoles} onChange={(v) => set("drillHoles", v)} step={1} /></Row>
          <Row label="Drill Diff"><Num value={form.drillDiff} onChange={(v) => set("drillDiff", v)} /></Row>
          <Row label="Drill Hrs/Hole"><Num value={form.drillHrsPerHole} onChange={(v) => set("drillHrsPerHole", v)} /></Row>
          <Row label="Folder Config" wide><Txt value={form.folderConfig} onChange={(v) => set("folderConfig", v)} placeholder="e.g. Baum 26x40, 2 parallel" /></Row>
          <Row label="Bindery Rate $/Hr"><Num value={form.binderyHourlyRate} onChange={(v) => set("binderyHourlyRate", v)} /></Row>
        </div>
        <div>
          {( [1, 2] as const).map((n) => {
            const key = n === 1 ? "handOp1" : "handOp2";
            const op = form[key as "handOp1"];
            const opHrs = n === 1 ? calc.handOp1Hrs : calc.handOp2Hrs;
            return (
              <div key={n}>
                <SectionTitle>Hand Op {n}</SectionTitle>
                <Row label="Description" wide>
                  <Txt value={op.description} onChange={(v) => set(key as "handOp1", { ...op, description: v })} />
                </Row>
                <Row label="Pieces/Hr"><Num value={op.piecesPerHour} onChange={(v) => set(key as "handOp1", { ...op, piecesPerHour: v })} step={1} /></Row>
                <Row label="% Of Qty"><Num value={op.pctOfQty} onChange={(v) => set(key as "handOp1", { ...op, pctOfQty: v })} /></Row>
                <Readout label="Hours" value={hrs(opHrs)} />
              </div>
            );
          })}
          <SectionTitle>Carton Pack</SectionTitle>
          <Row label="Cartons"><Num value={form.cartons} onChange={(v) => set("cartons", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.cartonCost} onChange={(v) => set("cartonCost", v)} /></Row>
          <Row label="Skid Pack (skids)"><Num value={form.skids} onChange={(v) => set("skids", v)} step={1} /></Row>
          <Row label="  @ $ each"><Num value={form.skidCost} onChange={(v) => set("skidCost", v)} /></Row>
          <Row label="Pack Hrs"><Num value={form.packHrs} onChange={(v) => set("packHrs", v)} /></Row>
          <Readout label="Bindery Hrs Total" value={hrs(calc.binderyHrs)} />
          <Readout label="Bindery Cost" value={money(calc.binderyCost)} />
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
          <Row label="Delivery Zone" wide><Txt value={form.deliveryZone} onChange={(v) => set("deliveryZone", v)} /></Row>
          <SectionTitle>Outside Purchases</SectionTitle>
          {form.outsidePurchases.map((p, i) => (
            <div key={i} className="mb-1 grid grid-cols-[1fr_100px_28px] gap-1">
              <input
                type="text" className={inputCls} placeholder="Description" value={p.description}
                onChange={(e) => {
                  const next = [...form.outsidePurchases];
                  next[i] = { ...next[i], description: e.target.value };
                  set("outsidePurchases", next);
                }}
              />
              <input
                type="number" step="any" className={inputCls + " text-right"} value={p.amount || 0}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const next = [...form.outsidePurchases];
                  next[i] = { ...next[i], amount: parseFloat(e.target.value) || 0 };
                  set("outsidePurchases", next);
                }}
              />
              <button
                type="button"
                className="rounded-sm border border-amber-700/60 text-amber-400 hover:bg-amber-400/10"
                onClick={() => set("outsidePurchases", form.outsidePurchases.filter((_, j) => j !== i))}
              >×</button>
            </div>
          ))}
          <button
            type="button"
            className="mt-1 rounded-sm border border-amber-700/60 px-2 py-1 font-mono text-[12px] text-amber-300 hover:bg-amber-400/10"
            onClick={() => set("outsidePurchases", [...form.outsidePurchases, { description: "", amount: 0 }])}
          >+ Add Outside Purchase</button>
          <SectionTitle>Quote Notes</SectionTitle>
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
              <CostRow section="PREP" detail={`materials ${money(calc.prepMaterials)}`}
                hours={calc.prepHours} cost={calc.prepCost} markup={`${form.markupMaterialPct}%`} selling={calc.prepSelling} />
              {calc.isDigital ? (
                <CostRow section="PRESS (DIGITAL)"
                  detail={`${calc.digitalClickSheets} clicks @ $${calc.digitalClickRate.toFixed(4)}${form.digitalVariableData ? " +VD" : ""}${form.dieCost ? ` / die ${money(form.dieCost)}` : ""}`}
                  hours={calc.pressHrs} cost={calc.pressCost} markup={`${form.markupLaborPct}%`} selling={calc.pressSelling} />
              ) : (
                <CostRow section="PRESS"
                  detail={`MR ${calc.makereadyHrs.toFixed(2)} / WU ${calc.washupHrs.toFixed(2)} / Run ${calc.runHrs.toFixed(2)} · ink ${calc.inkLbs.toFixed(1)} lb ${money(calc.inkCost)}${form.dieCost ? ` · die ${money(form.dieCost)}` : ""}`}
                  hours={calc.pressHrs} cost={calc.pressCost} markup={`${form.markupLaborPct}%`} selling={calc.pressSelling} />
              )}
              <CostRow section="BINDERY"
                detail={`Cut ${calc.cutterHrs.toFixed(2)} / Trim ${form.trimHrs.toFixed(2)} / Drill ${calc.drillHrs.toFixed(2)} / Hand ${(calc.handOp1Hrs + calc.handOp2Hrs).toFixed(2)} / Pack ${form.packHrs.toFixed(2)}${calc.cartonSkidCost ? ` · ctns ${money(calc.cartonSkidCost)}` : ""}`}
                hours={calc.binderyHrs} cost={calc.binderyCost} markup={`${form.markupLaborPct}%`} selling={calc.binderySelling} />
              <CostRow section="OUTSIDE" detail={`${form.outsidePurchases.length} item(s)`}
                cost={calc.outsideCost} markup={`${form.markupOutsidePct}%`} selling={calc.outsideSelling} />
              <CostRow section="FREIGHT + ADDL" detail="pass-through"
                cost={calc.freightAndAdditional} markup="—" selling={calc.freightAndAdditional} />
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

          <div className="mt-4 flex items-center gap-3">
            <Button onClick={saveQuote} disabled={saving} className="bg-amber-500 text-black hover:bg-amber-400">
              {saving ? "Saving…" : "Save Quote"}
            </Button>
            {saved && (
              <span className="font-mono text-[13px] text-green-400">
                Saved {saved.quoteNumber} — <Link href="/dashboard/quotes" className="underline">view in Quotes</Link>
              </span>
            )}
            {saveError && <span className="font-mono text-[13px] text-red-400">{saveError}</span>}
          </div>
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
