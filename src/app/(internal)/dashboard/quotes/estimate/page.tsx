"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Layers,
  DollarSign,
  X,
  Plus,
  FileText,
  Printer,
  ChevronDown,
  ChevronRight,
  Check,
  Hash,
  Ruler,
  Droplets,
  Scissors,
  Truck,
  Clock,
  Users,
  Percent,
  BarChart3,
  TrendingUp,
  Target,
  Settings,
  RotateCcw,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { recommendPress } from "@/lib/smart-features";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { lookupCaliper, guessCaliperFromText, PAPER_CALIPERS } from "@/lib/paper-calipers";
import { getDigitalSizeTier, inferInkConfig, getDigitalClickRate, getDigitalVDRate } from "@/lib/digital-clicks";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductType = "FOLDING_CARTON" | "COMMERCIAL_PRINT";
type PressType = "OFFSET" | "DIGITAL";

interface WasteCurveEntry {
  min: number;
  max: number;
  pctFirst: number;
  pctAddl: number;
}

interface PressConfigData {
  id: string;
  configNumber: number;
  name: string;
  setupMinutes: number;
  speedUncoated: number;
  speedCoated: number;
  numColors: number;
  coatingType: string | null;
  coatingCostPerLb: number;
  addToHourlyRate: number;
  plateCost: number;
  setupWasteUncoated: number;
  setupWasteCoated: number;
  plateChangeWasteUncoated: number;
  plateChangeWasteCoated: number;
  wasteCurveUncoated: string;
  wasteCurveCoated: string;
  maxImpressions: number;
  strippingMaterialCost: number;
}

interface PressData {
  id: string;
  pressNumber: number;
  name: string;
  costPerHour: number;
  maxSheetWidth: number;
  maxSheetHeight: number;
  minSheetWidth: number;
  minSheetHeight: number;
  plateChangeMinutes: number;
  inkChangeMinutes: number;
  configurations: PressConfigData[];
}

interface PlantStandardsData {
  markupLayoutRate: number;
  artworkRate: number;
  typesettingRate: number;
  proofingRate: number;
  scanningRate: number;
  inkBlackPerLb: number;
  inkColorPerLb: number;
  inkPmsPerLb: number;
  inkMetallicPerLb: number;
  inkAqueousPerLb: number;
  coverageBlackUncoated: number;
  coverageBlackCoated: number;
  coverageColorUncoated: number;
  coverageColorCoated: number;
  markupPaper: number;
  markupMaterial: number;
  markupLabor: number;
  markupOutside: number;
  trimmingRate: number;
  drillingRate: number;
  handBinderyRate: number;
  folder1Rate: number;
  folder2Rate: number;
  folder3Rate: number;
  saddleStitch1Rate: number;
  saddleStitch2Rate: number;
  deliveryRate: number;
  deliveryAvgMinutes: number;
  scorePerfRate: number;
  // Phase 1 additions
  hiResProofCost: number;
  lowResProofCost: number;
  imposeTimePerFormMin: number;
  cutTimePerCutSec: number;
  foldTimePerFoldSec: number;
  drillTimePerHoleSec: number;
  paperCuttingRate: number;
  plateMakingRate: number;
  // Phase II Part 2 (Darrin's press/cut/finishing refinements)
  solidCoveragePressSpeed: number;
  heavyCoverageThresholdPct: number;
  cutLiftHeightInches: number;
  boardThicknessCapInches: number;
  boardThicknessMaxSpeed: number;
  perfRulePremiumMultiplier: number;
  scorePerfPerHour: number;
  paddingSheetsPerHour: number;
  wrapFilmCostPerFoot: number;
  wrapLaborMinutesPerBundle: number;
  // Digital click charges (Mary 4/24/26)
  digitalClickT1_1_0: number; digitalClickT1_1_1: number; digitalClickT1_4_0: number; digitalClickT1_4_1: number; digitalClickT1_4_4: number; digitalClickT1_VD: number;
  digitalClickT2_1_0: number; digitalClickT2_1_1: number; digitalClickT2_4_0: number; digitalClickT2_4_1: number; digitalClickT2_4_4: number; digitalClickT2_VD: number;
  digitalClickT3_1_0: number; digitalClickT3_1_1: number; digitalClickT3_4_0: number; digitalClickT3_4_1: number; digitalClickT3_4_4: number; digitalClickT3_VD: number;
  digitalVDSetupRate: number;
  digitalTier1MaxLength: number; digitalTier2MaxLength: number; digitalTier3MaxLength: number;
  [key: string]: number | string;
}

interface FormState {
  // Step 1
  productType: ProductType;
  pressType: PressType;
  // Step 2 — Job Details
  customerName: string;
  jobName: string;
  quantity: number;
  versions: number;
  finishedWidth: number;
  finishedHeight: number;
  numPages: number;
  // Folding Carton + Offset
  sheetWidth: number;
  sheetHeight: number;
  numberUp: number;
  gutterWidth: number;
  dieCuttingPlateCost: number;
  strippingToolCost: number;
  makeReadySheets: number;
  paperCostPer1000: number;
  paperPricingMode: string; // "per1000" or "cwt"
  paperBasisWeight: number;
  paperPricePerCwt: number;
  paperTotalSheets: number;
  inkColorsFront: number;
  inkColorsBack: number;
  inkCostPerLb: number;
  inkBlackPct: number;
  inkColorPct: number;
  inkVarnishPct: number;
  specialtyCoating: string;
  coatingCostPer1000: number;
  gluingSetup: number;
  windowPatching: number;
  // Proofs (legacy Sherpa/Dylux/Matchprint count fields — kept for back-compat but not wired to cost)
  proofSherpa2: number;
  proofSherpa43: number;
  proofDylux: number;
  proofMatchprint: number;
  // Phase 1 — Mary's feedback: quantitative proof pricing
  hiResProofCount: number;  // high-res 1-sided proofs
  lowResProofCount: number; // low-res 2-sided proofs
  // Phase 1 — extra plates beyond auto-calc (e.g. spot PMS on one form)
  extraPlates: { description: string; cost: number }[];
  plateLaborMinutesEach: number; // labor minutes per plate (drives plate labor cost)
  // Phase 1 — ink type per side (Process / PMS / LED UV) drives rate lookup
  inkTypeFront: string; // "process" | "pms" | "led_uv"
  inkTypeBack: string;
  // Phase 1 — paper taxonomy + carton math
  paperCategory: string; // legacy: "coated"/"uncoated"/"c1s"/"cover"/"text"/"label"
  sheetsPerCarton: number;
  roundUpCartons: boolean;
  // Commit B (Mary 4/24/26) — full paper taxonomy + sheet sizing + mill flag
  paperType: string;        // Cover/Text/Board C1S/Board C2S/Bond/Index/Envelope/Label/Magnetic/NCR/Vellum/Synthetic
  paperBrand: string;       // e.g. Mohawk, Cougar, Reich
  paperColor: string;       // e.g. Solar White, Natural
  paperTexture: string;     // Smooth, Vellum, Eggshell, Stipple, Laid, Techweave, Metallic
  paperFinish: string;      // Coated Silk/Dull/Gloss, Uncoated, etc.
  parentSheetWidth: number; // ordering size, e.g. 23
  parentSheetHeight: number;// e.g. 35
  runSheetWidth: number;    // actual press sheet, e.g. 17.5 (2-out of parent)
  runSheetHeight: number;   // e.g. 23
  isMillItem: boolean;      // checkbox — flows to quote letter
  millItemLeadTime: string; // free text e.g. "2-3 weeks", "minimum 5 ctns"
  // Phase 1 — quantitative finishing (replaces difficulty dials)
  numCuts: number;
  foldType: string; // "none" | "half" | "tri" | "z" | "gate" | "roll" | "accordion" | "double_parallel" | "french" | "right_angle" | "custom"
  numFolds: number;
  numDrillHoles: number;
  // Saddle stitch — Mary 4/30: prefer auto-calc from qty × rate ÷ speed.
  // saddleStitchAuto = true means the $ value below was computed from
  // saddleStitchQty (and should update if rate/speed/qty changes).
  saddleStitchQty: number;
  saddleStitchAuto: boolean;
  // Phase II Part 2 — Darrin's press/cut/finishing refinements
  coverageSolidsPct: number;       // 0-100; when > threshold, press speed caps at solidCoveragePressSpeed
  paperCaliperInches: number;      // per-sheet thickness; 0 = auto-lookup from paper desc
  numScores: number;               // # score rules per sheet
  numPerfs: number;                // # perf rules per sheet
  numPads: number;                 // # of pads
  sheetsPerPad: number;            // sheets per pad
  numBundles: number;              // # of wrapped bundles
  wrapLengthPerBundleInches: number; // length of film needed per bundle (perimeter × N wraps)
  // Bindery detail
  cuttingDiff: number;
  handBind1Name: string;
  handBind1SpeedPerHour: number;
  handBind1PctOfQty: number;
  handBind2Name: string;
  handBind2SpeedPerHour: number;
  cartonType: number;
  skidPack: boolean;
  // Press extras
  pressHelpers: number;
  wasteFactor: number;
  // Outside purchases (Phase II — richer form: vendor + pricing mode + ref#)
  outsidePurchases: {
    description: string;
    cost: number;
    vendor?: string;
    operation?: string;  // "lamination" | "perfect_bind" | "book_bind" | "coating" | "other"
    pricingMode?: "lump" | "per_unit";
    unitAmount?: number; // price per unit when per_unit
    unitCount?: number;  // count of units (e.g. books, sq-in) when per_unit
    quoteRef?: string;   // vendor quote ref#
  }[];
  // Phase II — Multi-part jobs (books with cover + text, boxes with multiple pieces)
  // When parts.length > 0, the estimator runs in multi-part mode. Each part has
  // its own sizes/paper/press/ink/bindery. The quote's global quantity applies to
  // all parts; spoilagePct adds a per-part buffer (e.g. 10% extra covers).
  parts: {
    id: string;
    name: string;               // "Cover", "Fly sheet", "94pgs text", etc.
    spoilagePct: number;        // 0-100 — added to this part's effective quantity
    flatWidth: number;
    flatHeight: number;
    finishedWidth: number;
    finishedHeight: number;
    numPages: number;           // for text forms
    paperStock: string;         // free-text or inventory match
    paperCategory: string;      // coated/uncoated/c1s/cover/text/label
    paperWeight: string;        // e.g. "100lb Text", "120lb Cover"
    paperCostPer1000: number;
    pressName: string;          // "KOMII", "228", etc.
    inkColorsFront: number;
    inkColorsBack: number;
    inkTypeFront: string;       // process/pms/led_uv
    inkTypeBack: string;
    coatingType: string;        // matches coatingRates keys
    binderyFold: boolean;
    foldType: string;
    numFolds: number;
    binderyStitch: boolean;
    binderyScore: boolean;
    binderyDrill: boolean;
    numDrillHoles: number;
    binderyTrim: boolean;
    notes: string;
  }[];
  // Folding Carton + Digital
  clickCharge: number;
  digitalDieCuttingTime: number;
  digitalCutterRate: number;
  substrateCostPerSheet: number;
  variableData: boolean;
  vdpComplexitySurcharge: number;
  digitalCoatingCost: number;
  // Commercial Print + Offset
  plateCostEach: number;
  paperWeight: number;
  commPaperCostPer1000: number;
  inkCoveragePercent: number;
  commInkCost: number;
  foldingCost: number;
  saddleStitchCost: number;
  perfectBindingCost: number;
  trimCost: number;
  binderySetupHours: number;
  binderyRate: number;
  // Commercial Print + Digital
  commDigitalClickCharge: number;
  rushSurchargePercent: number;
  digitalPaperCost: number;
  personalizationSurcharge: number;
  simpleFinishingCost: number;
  // Universal
  pressOperatorRate: number;
  prepressRate: number;
  pressRunTime: number;
  prepressTime: number;
  setupTime: number;
  shippingCost: number;
  markupPaper: number;
  markupMaterial: number;
  markupLabor: number;
  markupOutside: number;
  commissionPercent: number;
  quantityTiers: number[];
  // Job type
  jobType: string;
  // Press selection (offset)
  selectedPressId: string;
  selectedConfigId: string;
  stockType: "uncoated" | "coated";
  // Difficulty factors
  makereadyDiff: number;
  washupDiff: number;
  runDiff: number;
  // Mailing services
  inserterPockets: number;
  inserterMailType: string;
  // Coatings (outside)
  coatingType: string;
  coatingSheetWidth: number;
  coatingSheetHeight: number;
  coatingImpressions: number;
  coatingBlankets: number;
  coatingCyrelPlates: number;
  // Wafer seal / Inkjet
  secapTabs: number;
  secapInkjet: boolean;
  // Finishing (Todd's calculator)
  finishingPressCode: string;
  finishingQuantityM: number;
  finishingRuns: number;
  foilColor: string;
  foilSizeSquareInches: number;
  dieCostLinearInches: number;
  diePlywoodSize: string;
  // Job Ticket extras (carry to job on conversion)
  fscCertified: boolean;
  pressCheck: boolean;
  softCover: boolean;
  plusCover: boolean;
  hasBleeds: boolean;
  blanketNumber: string;
  deliveryTo: string;
  samplesRequired: boolean;
  samplesTo: string;
  specialInstructions: string;
  // Volume Forecasting
  monthlyVolume: string;
  contractMonths: string;
  volumeDiscount: string;
  priceLock: string;
  printAndStore: string;
  warehousingCost: string;
  [key: string]: string | number | boolean | number[] | { description: string; cost: number }[] | any[]; // allow dynamic field access
}

const defaultForm: FormState = {
  productType: "FOLDING_CARTON",
  pressType: "OFFSET",
  customerName: "",
  jobName: "",
  quantity: 0,
  versions: 1,
  finishedWidth: 0,
  finishedHeight: 0,
  numPages: 4,
  sheetWidth: 28,
  sheetHeight: 40,
  numberUp: 1,
  gutterWidth: 0.125,
  dieCuttingPlateCost: 0,
  strippingToolCost: 0,
  makeReadySheets: 500,
  paperCostPer1000: 0,
  paperPricingMode: "per1000",
  paperBasisWeight: 0,
  paperPricePerCwt: 0,
  paperTotalSheets: 0,
  inkColorsFront: 4,
  inkColorsBack: 0,
  inkCostPerLb: 0,
  inkBlackPct: 6,
  inkColorPct: 12,
  inkVarnishPct: 12,
  specialtyCoating: "none",
  coatingCostPer1000: 0,
  gluingSetup: 0,
  windowPatching: 0,
  proofSherpa2: 0,
  proofSherpa43: 0,
  proofDylux: 0,
  proofMatchprint: 0,
  // Phase 1 defaults
  hiResProofCount: 0,
  lowResProofCount: 0,
  extraPlates: [] as { description: string; cost: number }[],
  plateLaborMinutesEach: 5,
  inkTypeFront: "process",
  inkTypeBack: "process",
  paperCategory: "",
  sheetsPerCarton: 0,
  roundUpCartons: false,
  // Commit B
  paperType: "",
  paperBrand: "",
  paperColor: "",
  paperTexture: "",
  paperFinish: "",
  parentSheetWidth: 0,
  parentSheetHeight: 0,
  runSheetWidth: 0,
  runSheetHeight: 0,
  isMillItem: false,
  millItemLeadTime: "",
  numCuts: 0,
  foldType: "none",
  numFolds: 0,
  numDrillHoles: 0,
  saddleStitchQty: 0,
  saddleStitchAuto: false,
  coverageSolidsPct: 0,
  paperCaliperInches: 0,
  numScores: 0,
  numPerfs: 0,
  numPads: 0,
  sheetsPerPad: 0,
  numBundles: 0,
  wrapLengthPerBundleInches: 0,
  cuttingDiff: 1.0,
  handBind1Name: "",
  handBind1SpeedPerHour: 0,
  handBind1PctOfQty: 100,
  handBind2Name: "",
  handBind2SpeedPerHour: 0,
  cartonType: 1,
  skidPack: false,
  pressHelpers: 0,
  wasteFactor: 0,
  outsidePurchases: [] as any[],
  parts: [] as any[],
  clickCharge: 0,
  digitalDieCuttingTime: 0,
  digitalCutterRate: 0,
  substrateCostPerSheet: 0,
  variableData: false,
  vdpComplexitySurcharge: 0,
  digitalCoatingCost: 0,
  plateCostEach: 0,
  paperWeight: 100,
  commPaperCostPer1000: 0,
  inkCoveragePercent: 40,
  commInkCost: 0,
  foldingCost: 0,
  saddleStitchCost: 0,
  perfectBindingCost: 0,
  trimCost: 0,
  binderySetupHours: 0,
  binderyRate: 0,
  commDigitalClickCharge: 0,
  rushSurchargePercent: 0,
  digitalPaperCost: 0,
  personalizationSurcharge: 0,
  simpleFinishingCost: 0,
  pressOperatorRate: 65,
  prepressRate: 55,
  pressRunTime: 0,
  prepressTime: 0,
  setupTime: 0,
  shippingCost: 0,
  markupPaper: 22,
  markupMaterial: 22,
  markupLabor: 63,
  markupOutside: 30,
  commissionPercent: 10,
  quantityTiers: [] as number[],
  jobType: "new_with_prepress",
  selectedPressId: "",
  selectedConfigId: "",
  stockType: "uncoated" as const,
  makereadyDiff: 1.0,
  washupDiff: 1.0,
  runDiff: 1.0,
  inserterPockets: 0,
  inserterMailType: "regular",
  coatingType: "none",
  coatingSheetWidth: 0,
  coatingSheetHeight: 0,
  coatingImpressions: 0,
  coatingBlankets: 0,
  coatingCyrelPlates: 0,
  secapTabs: 0,
  secapInkjet: false,
  finishingPressCode: "",
  finishingQuantityM: 0,
  finishingRuns: 1,
  foilColor: "",
  foilSizeSquareInches: 0,
  dieCostLinearInches: 0,
  diePlywoodSize: "",
  fscCertified: false,
  pressCheck: false,
  softCover: false,
  plusCover: false,
  hasBleeds: false,
  blanketNumber: "",
  deliveryTo: "",
  samplesRequired: false,
  samplesTo: "",
  specialInstructions: "",
  monthlyVolume: "",
  contractMonths: "12",
  volumeDiscount: "0",
  priceLock: "12",
  printAndStore: "monthly",
  warehousingCost: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ─── Collapsible Section ─────────────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        className="flex w-full items-center gap-3 p-5 text-left hover:bg-gray-50 transition-colors rounded-xl"
        onClick={() => setOpen(!open)}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </div>
        <span className="flex-1 text-base font-semibold text-gray-900">{title}</span>
        {open ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5 pt-0">{children}</div>}
    </Card>
  );
}

// ─── Field Wrapper ───────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EstimatePage() {
  return <Suspense><EstimateContent /></Suspense>;
}

function EstimateContent() {
  const searchParams = useSearchParams();
  const fromRequestId = searchParams.get("from");
  const draftIdFromUrl = searchParams.get("draftId");
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Draft auto-save state — Mary's feedback: don't lose work when she
  // steps away. After the first save (auto or manual), draftQuoteId
  // holds the quote's id so subsequent auto-saves PUT to update.
  const [draftQuoteId, setDraftQuoteId] = useState<string | null>(draftIdFromUrl);
  const [autoSavedAt, setAutoSavedAt] = useState<Date | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);
  const [draftLoading, setDraftLoading] = useState(!!draftIdFromUrl);
  interface QuoteProduct {
    productName: string;
    productType: string;
    pressType: string;
    quantity: number;
    unitPrice: number;
    total: number;
    tiers: { quantity: number; total: number; costPerUnit: number; costPer1000: number }[];
    specs: Record<string, unknown>;
  }
  const [quoteProducts, setQuoteProducts] = useState<QuoteProduct[]>([]);
  const [plantStandards, setPlantStandards] = useState<PlantStandardsData | null>(null);
  const [presses, setPresses] = useState<PressData[]>([]);
  const [standardsLoaded, setStandardsLoaded] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string; industry?: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; role: string }[]>([]);
  const [materialsList, setMaterialsList] = useState<{ id: string; name: string; sku: string | null }[]>([]);

  // Load plant standards on mount
  useEffect(() => {
    fetch("/api/plant-standards")
      .then((r) => r.json())
      .then((data) => {
        if (data.standards) {
          setPlantStandards(data.standards);
          // Override defaults with loaded standards
          setForm((prev) => ({
            ...prev,
            prepressRate: data.standards.artworkRate || prev.prepressRate,
            inkCostPerLb: data.standards.inkColorPerLb || prev.inkCostPerLb,
            markupPaper: data.standards.markupPaper ?? prev.markupPaper,
            markupMaterial: data.standards.markupMaterial ?? prev.markupMaterial,
            markupLabor: data.standards.markupLabor ?? prev.markupLabor,
            markupOutside: data.standards.markupOutside ?? prev.markupOutside,
            binderyRate: data.standards.handBinderyRate || prev.binderyRate,
          }));
        }
        if (data.presses) {
          setPresses(data.presses);
        }
        setStandardsLoaded(true);
      })
      .catch(() => setStandardsLoaded(true));
    fetch("/api/companies").then(r => r.json()).then(d => setCompanies(d.companies || [])).catch(() => {});
    fetch("/api/users").then(r => r.json()).then(d => { if (d.users) setEmployees(d.users.filter((u: { role: string }) => u.role !== "CUSTOMER")); }).catch(() => {});
    fetch("/api/materials").then(r => r.json()).then(d => { if (d.materials) setMaterialsList(d.materials); }).catch(() => {});

    // Pre-fill from Quote Request if ?from=requestId
    if (fromRequestId) {
      fetch("/api/quote-requests").then(r => r.json()).then(d => {
        const req = (d.requests || []).find((r: any) => r.id === fromRequestId);
        if (!req) return;

        // Prefer new lineItems → first line's quantity is primary, rest become tiers.
        // Fall back to legacy quantity1..5 fields for old requests.
        const qrLineItems: any[] = Array.isArray(req.lineItems) ? req.lineItems : [];
        const primaryQty = qrLineItems.length > 0
          ? Number(qrLineItems[0].quantity) || 0
          : Number(req.quantity1 || req.quantity2 || req.quantity3 || 0);
        const tiers = qrLineItems.length > 1
          ? qrLineItems.slice(1).map((li: any) => Number(li.quantity)).filter((n: number) => n && !isNaN(n))
          : [req.quantity2, req.quantity3, req.quantity4, req.quantity5].map((q: any) => Number(q)).filter((q: number) => q && !isNaN(q));

        // First line's size overrides win if provided (CSRs may size per-version).
        const firstLine = qrLineItems[0] || {};
        const effectiveFlatW = Number(firstLine.flatWidth) || Number(req.flatWidth) || 0;
        const effectiveFlatH = Number(firstLine.flatHeight) || Number(req.flatHeight) || 0;
        const effectiveFinW = Number(firstLine.finishedWidth) || Number(req.finishedWidth) || 0;
        const effectiveFinH = Number(firstLine.finishedHeight) || Number(req.finishedHeight) || 0;
        const effectiveFinD = Number(firstLine.finishedDepth) || Number(req.finishedDepth) || 0;

        // Stash raw request on window for the save handler to pull line items
        // into specs (avoids threading another state var through 500 lines of form).
        (window as any).__quoteRequestPrefill = { id: req.id, lineItems: qrLineItems, raw: req };

        setForm(prev => ({
          ...prev,
          customerName: req.customerName || prev.customerName,
          jobName: req.jobTitle || req.descriptionType || prev.jobName,
          quantity: primaryQty || prev.quantity,
          quantityTiers: tiers,
          versions: qrLineItems.length > 1 ? qrLineItems.length : prev.versions,
          finishedWidth: effectiveFinW || prev.finishedWidth,
          finishedHeight: effectiveFinH || prev.finishedHeight,
          finishedDepth: effectiveFinD || prev.finishedDepth,
          sheetWidth: effectiveFlatW || prev.sheetWidth,
          sheetHeight: effectiveFlatH || prev.sheetHeight,
          numPages: req.pages || prev.numPages,
          inkColorsFront: req.colorsSide1 === "4_process" ? 4 : req.colorsSide1 === "process_1pms" ? 5 : req.colorsSide1 === "process_2pms" ? 6 : req.colorsSide1 === "black" ? 1 : req.colorsSide1 === "pms" ? 1 : prev.inkColorsFront,
          inkColorsBack: req.colorsSide2 === "4_process" ? 4 : req.colorsSide2 === "process_1pms" ? 5 : req.colorsSide2 === "process_2pms" ? 6 : req.colorsSide2 === "black" ? 1 : req.colorsSide2 === "pms" ? 1 : req.colorsSide2 === "none" ? 0 : prev.inkColorsBack,
          specialtyCoating: req.coatingSide1 === "gloss_aq" ? "aqueous" : req.coatingSide1 === "soft_touch_aq" ? "soft-touch" : req.coatingSide1 === "matte_aq" ? "matte" : (req.floodUv || req.spotUv || req.floodLedUv || req.spotLedUv) ? "uv" : prev.specialtyCoating,
          productType: req.descriptionType === "folding_carton" ? "FOLDING_CARTON" : "COMMERCIAL_PRINT",
          stockDescription: req.paperDescription || prev.stockDescription,
          paperBasisWeight: req.paperWeight ? parseFloat(req.paperWeight) || 0 : prev.paperBasisWeight,
          // ── Mary field passthrough ──
          hasBleeds: !!req.hasBleeds || prev.hasBleeds,
          plusCover: req.coverType === "plus_cover" || prev.plusCover,
          softCover: req.coverType === "self_cover" || prev.softCover,
          specialInstructions: [req.specialInstructions, req.customColorCoatingNotes, req.artworkNotes].filter(Boolean).join(" | ") || prev.specialInstructions,
          deliveryTo: req.deliveryInstructions || prev.deliveryTo,
        } as any));
        // Auto-advance to step 2 since product type is set
        setStep(2);
      }).catch(() => {});
    }
  }, [fromRequestId]);

  // Auto-save every ~30 seconds when form has been touched and we're past
  // step 1 (we don't auto-save before product type is picked). Only fires
  // for drafts (status not yet sent/approved/converted). Mary's feedback:
  // don't lose work when she steps away.
  useEffect(() => {
    if (step < 2) return;
    if (!form.customerName && !form.jobName) return; // empty form, nothing to save
    if (draftLoading) return; // wait for draft hydration
    const timer = setTimeout(async () => {
      if (saving || autoSaving) return;
      setAutoSaving(true);
      try {
        // Auto-save persists BOTH form + computed totals so the detailed
        // summary, tier comparison, and quote letter all have what they
        // need when Mary re-opens or navigates to those views.
        const specsPayload = JSON.stringify({
          estimateData: form,
          estimateTotals: calc,
          autoSavedAt: new Date().toISOString(),
        });
        if (draftQuoteId) {
          await fetch("/api/quotes", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: draftQuoteId,
              specs: specsPayload,
              customerName: form.customerName,
              productName: form.jobName,
              quantity: String(form.quantity || 0),
            }),
          });
        } else if (form.customerName) {
          // First auto-save creates the draft so it shows up in Mary's queue.
          const res = await fetch("/api/quotes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              customerName: form.customerName,
              productType: form.productType,
              productName: form.jobName || "Untitled draft",
              description: "Auto-saved draft (in progress)",
              quantity: String(form.quantity || 0),
              unitPrice: "0",
              specs: specsPayload,
              quoteRequestId: fromRequestId || undefined,
            }),
          });
          const d = await res.clone().json().catch(() => null);
          if (res.ok && d?.quote?.id) setDraftQuoteId(d.quote.id);
        }
        setAutoSavedAt(new Date());
      } catch { /* swallow — next tick will retry */ }
      setAutoSaving(false);
    }, 8000); // Mary 5/1: was 30s, dropped to 8s so drafts show in the
              // Quotes list almost immediately after she stops typing.
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, step, draftQuoteId, draftLoading]);

  // Resume from draft — if ?draftId=xxx is in the URL, load that quote's
  // saved estimateData into the form so Mary can pick up where she left off.
  useEffect(() => {
    if (!draftIdFromUrl) return;
    setDraftLoading(true);
    fetch(`/api/quotes?id=${draftIdFromUrl}`)
      .then(r => r.json())
      .then(d => {
        // /api/quotes GET returns a list; filter to our id
        const q = (d.quotes || []).find((x: any) => x.id === draftIdFromUrl);
        if (!q) return;
        let savedSpecs: any = {};
        try { savedSpecs = q.specs ? JSON.parse(q.specs) : {}; } catch {}
        // Restore the form state we saved on handleSave.
        if (savedSpecs.estimateData) {
          setForm(prev => ({ ...prev, ...savedSpecs.estimateData }));
        }
        // If the draft already advanced past step 1, jump there.
        if (savedSpecs.estimateData?.productType && savedSpecs.estimateData?.pressType) {
          setStep(2);
        }
        setDraftQuoteId(q.id);
      })
      .catch(() => {})
      .finally(() => setDraftLoading(false));
  }, [draftIdFromUrl]);

  // Auto-fill caliper when paper weight or category changes — Mary 5/1
  // wants this to populate, not just suggest in placeholder. Only fills if
  // user hasn't manually entered a value.
  useEffect(() => {
    if (form.paperCaliperInches > 0) return; // user has set it manually
    const auto = lookupCaliper(
      String(form.paperWeight || form.paperBasisWeight || ""),
      undefined,
      form.paperCategory === "cover" || form.paperType === "cover" || form.paperType === "board_c1s" || form.paperType === "board_c2s" ? "Cover" :
      form.paperCategory === "text" || form.paperType === "text" ? "Text" : undefined
    ) ?? guessCaliperFromText(form.stockDescription as string);
    if (auto && auto > 0) {
      setForm(prev => ({ ...prev, paperCaliperInches: auto }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.paperWeight, form.paperBasisWeight, form.paperCategory, form.paperType, form.stockDescription]);

  // Auto-fill from press/config selection
  const selectedPress = useMemo(() => presses.find((p) => p.id === form.selectedPressId), [presses, form.selectedPressId]);
  const selectedConfig = useMemo(
    () => selectedPress?.configurations.find((c) => c.id === form.selectedConfigId),
    [selectedPress, form.selectedConfigId]
  );

  // When press config changes, auto-fill related fields
  useEffect(() => {
    if (!selectedPress || !selectedConfig) return;
    const effectiveRate = selectedPress.costPerHour + selectedConfig.addToHourlyRate;
    const isCoated = form.stockType === "coated";
    const setupWaste = isCoated ? selectedConfig.setupWasteCoated : selectedConfig.setupWasteUncoated;

    setForm((prev) => ({
      ...prev,
      pressOperatorRate: effectiveRate,
      plateCostEach: selectedConfig.plateCost,
      makeReadySheets: setupWaste,
      sheetWidth: selectedPress.maxSheetWidth,
      sheetHeight: selectedPress.maxSheetHeight,
      setupTime: selectedConfig.setupMinutes / 60,
      inkColorsFront: Math.min(prev.inkColorsFront || 4, selectedConfig.numColors),
    }));
  }, [form.selectedPressId, form.selectedConfigId, form.stockType]);

  // Auto-calculate press run time when quantity and press config are set
  useEffect(() => {
    if (!selectedConfig || !form.quantity) return;
    const nUp = form.numberUp || 1;
    const sheetsNeeded = Math.ceil((form.quantity * (form.versions || 1)) / nUp);
    const speed = form.stockType === "coated" ? selectedConfig.speedCoated : selectedConfig.speedUncoated;
    if (speed > 0) {
      const runHours = sheetsNeeded / speed;
      setForm((prev) => ({ ...prev, pressRunTime: Math.round(runHours * 100) / 100 }));
    }
  }, [form.quantity, form.versions, form.numberUp, form.stockType, selectedConfig]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const num = (key: keyof FormState) => Number(form[key]) || 0;

  const combo = `${form.productType}_${form.pressType}` as const;
  const isCartonOffset = combo === "FOLDING_CARTON_OFFSET";
  const isCartonDigital = combo === "FOLDING_CARTON_DIGITAL";
  const isCommOffset = combo === "COMMERCIAL_PRINT_OFFSET";
  const isCommDigital = combo === "COMMERCIAL_PRINT_DIGITAL";
  const isCarton = form.productType === "FOLDING_CARTON";
  const isOffset = form.pressType === "OFFSET";

  // ─── Calculations ──────────────────────────────────────────────────────────

  const calc = useMemo(() => {
    const q = num("quantity") || 1;
    const v = num("versions") || 1;
    let materialsCost = 0;
    let toolingCost = 0;
    let finishingCost = 0;
    let makeReadyCost = 0;

    // Carton round-up helper: if CSR entered sheets-per-carton and toggled
    // "round up to full cartons", bump the sheet count to the next carton.
    const roundUpToCartons = (sheets: number): number => {
      const per = num("sheetsPerCarton");
      if (!form.roundUpCartons || per <= 0) return sheets;
      return Math.ceil(sheets / per) * per;
    };

    // ─── Phase II: Multi-part jobs (Mary's feedback) ────────────────────
    // Iterate each part, accumulate paper + ink + coating + finishing cost.
    // Uses plant standards rates where available; falls back to form-level
    // values for anything the part doesn't override.
    const parts = (form.parts as any[]) || [];
    let partsCost = 0;
    const partsBreakdown: Array<{ name: string; cost: number }> = [];
    if (parts.length > 0) {
      const ps2 = plantStandards;
      for (const p of parts) {
        const partQty = q * (1 + (Number(p.spoilagePct) || 0) / 100);
        const colors = (Number(p.inkColorsFront) || 0) + (Number(p.inkColorsBack) || 0);
        // Sheets: assume 1-up per part unless specified; use flat vs finished as a coarse imp estimate
        const partSheets = Math.ceil(partQty * Math.max(1, Number(p.numPages) || 1) / 2);
        const paperCost = (partSheets / 1000) * (Number(p.paperCostPer1000) || 0);
        // Ink: process $10.81/lb, pms $19.50/lb, led $25/lb (our rule-of-thumb)
        const inkRate = p.inkTypeFront === "pms" ? (ps2?.inkPmsPerLb ?? 19.5)
          : p.inkTypeFront === "led_uv" ? (ps2?.inkPmsPerLb ?? 19.5) * 1.3
          : (ps2?.inkColorPerLb ?? 10.81);
        const inkCost = colors * inkRate * (partSheets / 5000);
        // Fold/drill cost per part (quantitative)
        const partFoldCost = (Number(p.numFolds) || 0) * partQty *
          ((ps2?.foldTimePerFoldSec ?? 2) / 3600) * (ps2?.folder1Rate ?? 48);
        const partDrillCost = (Number(p.numDrillHoles) || 0) * partQty *
          ((ps2?.drillTimePerHoleSec ?? 4) / 3600) * (ps2?.drillingRate ?? 35);
        const partCost = paperCost + inkCost + partFoldCost + partDrillCost;
        partsCost += partCost;
        partsBreakdown.push({ name: p.name || "Part", cost: partCost });
      }
      materialsCost += partsCost;
    }

    if (isCartonOffset) {
      const rawSheets = Math.ceil((q * v) / (num("numberUp") || 1));
      const sheetsNeeded = roundUpToCartons(rawSheets);
      const paperCost = (sheetsNeeded / 1000) * num("paperCostPer1000");
      const totalColors = num("inkColorsFront") + num("inkColorsBack");
      const inkCost = totalColors * num("inkCostPerLb") * (sheetsNeeded / 5000);
      const coatingCost = (sheetsNeeded / 1000) * num("coatingCostPer1000");
      materialsCost = paperCost + inkCost + coatingCost;
      toolingCost = num("dieCuttingPlateCost") + num("strippingToolCost");
      finishingCost = num("gluingSetup") + num("windowPatching");
      makeReadyCost = (num("makeReadySheets") / 1000) * num("paperCostPer1000");
    } else if (isCartonDigital) {
      // Tiered click-charge lookup (Mary 4/24/26): qty / numberUp + MR
      // sheets, multiplied by per-sheet click rate for the right tier
      // and ink config. VD per side is additive when variableData is on.
      const numberUp = num("numberUp") || 1;
      const baseSheets = Math.ceil((q * v) / numberUp);
      const mrSheets = num("makeReadySheets") || 0;
      const sheetsThroughPress = baseSheets + mrSheets;
      const tier = plantStandards
        ? getDigitalSizeTier(num("sheetWidth"), num("sheetHeight"), plantStandards)
        : 1;
      const inkCfg = inferInkConfig(num("inkColorsFront"), num("inkColorsBack"));
      const baseRate = plantStandards ? getDigitalClickRate(tier, inkCfg, plantStandards) : num("clickCharge");
      const vdRate = (form.variableData && plantStandards) ? getDigitalVDRate(tier, plantStandards) : 0;
      const ratePerSheet = baseRate + vdRate;
      const impressionCost = sheetsThroughPress * ratePerSheet;
      const paperCost = sheetsThroughPress * num("substrateCostPerSheet");
      materialsCost = paperCost + impressionCost;
      const dieCutMinutes = sheetsThroughPress * num("digitalDieCuttingTime");
      finishingCost = (dieCutMinutes / 60) * num("digitalCutterRate") + num("digitalCoatingCost");
      if (form.variableData) {
        // VD setup + list maintenance — flat hourly to materialsCost
        materialsCost += num("vdpComplexitySurcharge");
      }
    } else if (isCommOffset) {
      const totalColors = num("inkColorsFront") + num("inkColorsBack");
      // Calculate forms (signatures) for multi-page books
      const pages = num("numPages") || 1;
      const pagesPerForm = (num("numberUp") || 1) * 2; // 2 sides per sheet, times number-up
      const numForms = Math.max(1, Math.ceil(pages / Math.max(pagesPerForm, 1)));
      const sheetsPerForm = q + num("makeReadySheets");
      const totalSheets = roundUpToCartons(numForms * sheetsPerForm);
      const paperCost = (totalSheets / 1000) * num("commPaperCostPer1000");
      const coverageMultiplier = num("inkCoveragePercent") / 100;
      const inkCost = num("commInkCost") * totalColors * coverageMultiplier * numForms;
      materialsCost = paperCost + inkCost;
      toolingCost = num("plateCostEach") * totalColors * numForms; // plates per form
      finishingCost =
        num("foldingCost") +
        num("saddleStitchCost") +
        num("perfectBindingCost") +
        num("trimCost") +
        num("binderySetupHours") * num("binderyRate");
      makeReadyCost = 0; // already included in sheetsPerForm above
    } else if (isCommDigital) {
      // Tiered click-charge lookup (same as carton digital) — Mary 4/24/26
      const numberUp = num("numberUp") || 1;
      const baseSheets = Math.ceil((q * v) / numberUp);
      const mrSheets = num("makeReadySheets") || 0;
      const sheetsThroughPress = baseSheets + mrSheets;
      const tier = plantStandards
        ? getDigitalSizeTier(num("sheetWidth"), num("sheetHeight"), plantStandards)
        : 1;
      const inkCfg = inferInkConfig(num("inkColorsFront"), num("inkColorsBack"));
      const baseRate = plantStandards ? getDigitalClickRate(tier, inkCfg, plantStandards) : num("commDigitalClickCharge");
      const vdRate = (form.variableData && plantStandards) ? getDigitalVDRate(tier, plantStandards) : 0;
      const clickCost = sheetsThroughPress * (baseRate + vdRate);
      const paperCost = num("digitalPaperCost") * (sheetsThroughPress / 1000);
      materialsCost = clickCost + paperCost;
      const rushMultiplier = 1 + num("rushSurchargePercent") / 100;
      materialsCost *= rushMultiplier;
      finishingCost = num("simpleFinishingCost") + num("personalizationSurcharge");
    }

    // ─── Phase 1 additions (Mary's feedback) ─────────────────────────────
    // Quantitative finishing inputs + proof pricing + plate extras.
    // Rates come from Plant Standards; all additive on top of existing calc.
    const ps = plantStandards;
    // Proof cost
    const proofCost =
      num("hiResProofCount") * (ps?.hiResProofCost ?? 30) +
      num("lowResProofCount") * (ps?.lowResProofCost ?? 12);
    // Extra plates (manual add-on rows)
    const extraPlatesCost = (form.extraPlates as { description: string; cost: number }[]).reduce(
      (sum, p) => sum + (Number(p.cost) || 0), 0
    );
    // Plate labor (derived from plate count × minutes/plate × rate)
    const totalPlateCount = (() => {
      if (isCartonOffset || isCommOffset) {
        const colors = num("inkColorsFront") + num("inkColorsBack");
        const pages = num("numPages") || 1;
        const pagesPerForm = (num("numberUp") || 1) * 2;
        const forms = Math.max(1, Math.ceil(pages / Math.max(pagesPerForm, 1)));
        return colors * forms;
      }
      return 0;
    })();
    const plateLaborMinutes = totalPlateCount * num("plateLaborMinutesEach");
    const plateLaborCost = (plateLaborMinutes / 60) * (ps?.plateMakingRate ?? 22);
    // Quantitative finishing — cuts, folds, drills (Phase 1)
    // ─ Cut cost refined for Phase II Part 2 with Darrin's lift model ─
    // Cutter processes one lift (stack) at a time; heavier caliper = fewer
    // sheets per lift → more lifts → more cut operations. lifts =
    // ceil(sheets × caliperInches / liftHeightInches). We estimate total
    // sheets from quantity (multi-part already folded into materialsCost).
    const caliper = num("paperCaliperInches") || 0.005; // sensible default
    const liftHeight = ps?.cutLiftHeightInches ?? 6;
    // Use quantity as a conservative sheet proxy (actual sheet count varies
    // by path; tracking separately here is good enough for MVP).
    const cutLifts = Math.max(1, Math.ceil((q * caliper) / liftHeight));
    const cutCost = num("numCuts") * cutLifts * ((ps?.cutTimePerCutSec ?? 8) / 3600) * (ps?.paperCuttingRate ?? 32);
    // Fold cost scales with quantity × folds per sheet
    const foldCost = num("numFolds") * q * ((ps?.foldTimePerFoldSec ?? 2) / 3600) * (ps?.folder1Rate ?? 48);
    // Drill cost scales with quantity × holes per sheet
    const drillCost = num("numDrillHoles") * q * ((ps?.drillTimePerHoleSec ?? 4) / 3600) * (ps?.drillingRate ?? 35);

    // ─── Phase II Part 2 — Darrin's finishing refinements ────────────────
    // Score / perf (letterpress): scorePerfRate ($37.50/hr) × ops / scorePerfPerHour (4500)
    // Perf rule is premium (perfRulePremiumMultiplier, default 1.5×)
    const perfPremium = ps?.perfRulePremiumMultiplier ?? 1.5;
    const scorePerfOps = num("numScores") + num("numPerfs") * perfPremium;
    const scorePerfCost = scorePerfOps * q / (ps?.scorePerfPerHour ?? 4500) * (ps?.scorePerfRate ?? 37.5);
    // Padding at hand bindery rate: (pads × sheets/pad) / sheetsPerHour × rate
    const padCost = num("numPads") * num("sheetsPerPad") / (ps?.paddingSheetsPerHour ?? 1000) * (ps?.handBinderyRate ?? 22.5);
    // Banding/wrapping: film cost + labor
    const wrapFilmCost = num("numBundles") * (num("wrapLengthPerBundleInches") / 12) * (ps?.wrapFilmCostPerFoot ?? 0.057);
    const wrapLaborCost = num("numBundles") * ((ps?.wrapLaborMinutesPerBundle ?? 1) / 60) * (ps?.handBinderyRate ?? 22.5);
    const bundleCost = wrapFilmCost + wrapLaborCost;

    // ─── Coverage-driven press speed reduction (Darrin) ──────────────────
    // When heavy coverage (solids) exceeds threshold, effective SPH caps at
    // solidCoveragePressSpeed. Adjusts pressRunTime accordingly if the user
    // has set coverageSolidsPct and a base run time.
    //
    // Heavy-board cap (Mary 4/24/26) — 28pt+ stocks max at 4,100 SPH
    // regardless of config. The smaller of the two caps (coverage vs board)
    // wins.
    const coverageSolids = num("coverageSolidsPct");
    const heavyThresh = ps?.heavyCoverageThresholdPct ?? 60;
    const solidSPH = ps?.solidCoveragePressSpeed ?? 8500;
    const boardCapInches = ps?.boardThicknessCapInches ?? 0.028;
    const boardCapSPH = ps?.boardThicknessMaxSpeed ?? 4100;
    let coverageSpeedMultiplier = 1;
    if (selectedConfig) {
      const baseSPH = form.stockType === "uncoated" ? selectedConfig.speedUncoated : selectedConfig.speedCoated;
      let effectiveCap = baseSPH;
      if (coverageSolids >= heavyThresh) effectiveCap = Math.min(effectiveCap, solidSPH);
      // Heavy-board cap kicks in at the threshold caliper.
      if (caliper >= boardCapInches) effectiveCap = Math.min(effectiveCap, boardCapSPH);
      if (baseSPH > effectiveCap) coverageSpeedMultiplier = effectiveCap / baseSPH;
    }
    // Apply to the effective pressRunTime at labor sum time (below)

    // Apply carton round-up to totalSheets already computed above? Too intertwined;
    // instead, report additional sheets as an adjustment to paper cost below.
    // Add to appropriate buckets
    toolingCost += extraPlatesCost;
    finishingCost += cutCost + foldCost + drillCost + scorePerfCost + padCost + bundleCost;
    // Proof cost is a prepress item → add to materialsCost bucket (simplest)
    materialsCost += proofCost;

    // Press run time scales inversely with coverage multiplier (heavy coverage
    // slows the press — Darrin). If user already entered pressRunTime manually,
    // we divide by the multiplier to reflect the real duration.
    const adjustedPressRunTime = num("pressRunTime") / Math.max(coverageSpeedMultiplier, 0.01);
    const laborCost =
      adjustedPressRunTime * num("pressOperatorRate") +
      num("prepressTime") * num("prepressRate") +
      num("setupTime") * num("pressOperatorRate") +
      plateLaborCost;

    const shippingCost = num("shippingCost");

    // Print finishing (Todd's calculator)
    let finishingOpCost = 0;
    const pressCode = form.finishingPressCode as string;
    if (pressCode) {
      // Per-M pricing lookup (simplified from Todd's Run+MR sheet)
      const perMRates: Record<string, { mr: number; rates: number[] }> = {
        VC: { mr: 20, rates: [40, 20, 20, 20, 19, 19, 19, 19, 18, 18, 17.5, 17.5, 17.5, 17.5, 17.5, 17] },
        SC: { mr: 25, rates: [45, 24, 23, 22.5, 22, 22, 22, 21, 21, 20, 20, 19, 19, 18, 18, 18] },
        SF: { mr: 35, rates: [56, 30, 29.5, 29, 28, 27, 26, 25, 25, 24, 23.5, 23.6, 23, 22.7, 22.5, 22.1] },
        MC: { mr: 45, rates: [58, 29, 28.5, 28, 27, 26, 26, 26, 26, 26, 26, 26, 26, 25.8, 25.5, 25.5] },
        MF: { mr: 50, rates: [94, 47, 47, 46.5, 46, 46, 46, 46, 46, 45.6, 45.2, 44.7, 44.7, 44.3, 44, 44] },
        LC: { mr: 55, rates: [64, 32, 32, 31, 29.5, 29, 28, 28, 27.5, 26, 25.5, 24.5, 24.5, 23.5, 23, 22.8] },
        LS: { mr: 165, rates: [80, 40, 40, 38, 35.5, 33, 32.5, 32.5, 32, 30, 29, 28.5, 28.5, 27, 26, 26] },
        LE: { mr: 55, rates: [90, 45, 45, 44.5, 44, 44, 42, 42, 42, 41.5, 41, 40, 40, 39, 38, 38] },
        GA: { mr: 40, rates: [80, 40, 38, 36, 34, 35, 32, 32, 30, 27, 24, 22.8, 22.5, 22.2, 22, 21.8] },
        GB: { mr: 70, rates: [120, 60, 58, 56, 54, 54, 52, 52, 50, 47, 44, 43.8, 42.5, 42.2, 42, 41.8] },
        GC: { mr: 90, rates: [70, 35, 35, 33, 31, 29.5, 28, 28, 28, 26.5, 25, 23.5, 22, 21, 20.5, 19.5] },
        GD: { mr: 90, rates: [160, 80, 80, 18, 15, 14, 13, 13, 13, 12, 11, 10, 9.5, 9, 8.8, 8.3] },
        PF: { mr: 40, rates: [120, 60, 60, 57.5, 53.5, 51, 44, 43.8, 41.8, 38.5, 35.3, 33.8, 33.3, 32.7, 32.3, 31.7] },
      };
      const qtyTiers = [0.5, 1, 2.5, 5, 10, 15, 20, 25, 30, 50, 75, 100, 125, 150, 175, 225];
      const rateData = perMRates[pressCode];
      if (rateData) {
        const qtyM = num("finishingQuantityM") || (q / 1000);
        const runs = num("finishingRuns") || 1;
        // Find the right tier
        let tierIdx = 0;
        for (let i = 0; i < qtyTiers.length; i++) {
          if (qtyM >= qtyTiers[i]) tierIdx = i;
        }
        const perM = rateData.rates[tierIdx] || rateData.rates[rateData.rates.length - 1];
        finishingOpCost = (rateData.mr + perM * qtyM) * runs;
      }
    }

    // Foil cost
    let foilCost = 0;
    const foilColor = form.foilColor as string;
    if (foilColor) {
      const foilRates: Record<string, number> = { gold: 1.20, chart: 1.60, scratch: 3.00, custom: 1.95, pattern: 2.60 };
      const siPerPiece = num("foilSizeSquareInches") || 4;
      const totalSi = siPerPiece * q;
      foilCost = Math.max(totalSi * (foilRates[foilColor] || 1.20) / 1000, 4); // min $4
    }

    // Die cost
    let dieCost = 0;
    const linearInches = num("dieCostLinearInches");
    if (linearInches > 0) {
      dieCost = linearInches * 1.45; // cutting/scoring rule
      const plywoodPrices: Record<string, number> = { V: 25, S: 25, M: 45, L: 54 };
      const plywood = form.diePlywoodSize as string;
      if (plywood && plywoodPrices[plywood]) dieCost += plywoodPrices[plywood];
    }

    finishingCost += finishingOpCost + foilCost + dieCost;

    // Outside services: Coating
    let coatingCost = 0;
    const coatingType = form.coatingType as string;
    if (coatingType && coatingType !== "none") {
      const coatingRates: Record<string, number> = {
        gloss_aq: 1.09, satin_aq: 1.09, matte_aq: 1.09,
        soft_touch: 6.25, led_uv: 6.30, retic_coating: 11.25, retic_varnish: 25.30,
      };
      // Per-sq-in usage rates from Darrin's AQ calculator (Estimating Calculators.xlsx):
      // row 6 (regular coating): 7.9e-6  → gloss/satin/matte AQ, LED UV, retic coating
      // row 8 (soft touch):      7.5e-6
      // row 7 (retic varn):      9.4e-7
      const usageRates: Record<string, number> = {
        gloss_aq: 0.0000079, satin_aq: 0.0000079, matte_aq: 0.0000079,
        soft_touch: 0.0000075, led_uv: 0.0000079, retic_coating: 0.0000079, retic_varnish: 0.00000094,
      };
      const sheetArea = num("coatingSheetWidth") * num("coatingSheetHeight");
      const imps = num("coatingImpressions") || q;
      const lbs = sheetArea * imps * (usageRates[coatingType] || 0.0000079);
      coatingCost = lbs * (coatingRates[coatingType] || 1.09);
      coatingCost += num("coatingBlankets") * 175;
      coatingCost += num("coatingCyrelPlates") * 350; // $300 plate + $50 shipping
    }

    // Outside services: Inserter
    let inserterCost = 0;
    const pockets = num("inserterPockets");
    if (pockets > 0) {
      const setupCosts = [0, 70, 105, 140, 175, 185, 200];
      const setup = setupCosts[Math.min(pockets, 6)] || 200;
      const isMatch = (form.inserterMailType as string) === "match";
      const speed = isMatch ? 1000 : 1600;
      const rate = isMatch ? 50 : 35;
      inserterCost = setup + (q / speed) * rate;
    }

    // Outside services: Secap (wafer seal + inkjet)
    let secapCost = 0;
    const tabs = num("secapTabs");
    if (tabs > 0) {
      const secapSetup = 70;
      const tabCost = q * tabs * 0.002;
      const runCost = (q / 1600) * 35;
      secapCost = secapSetup + tabCost + runCost;
      if (form.secapInkjet) {
        secapCost += q * 0.005;
      }
    }

    // Outside purchase line items
    const outsidePurchaseTotal = (form.outsidePurchases as { description: string; cost: number }[]).reduce((sum, op) => sum + (op.cost || 0), 0);

    const outsideCost = coatingCost + inserterCost + secapCost + outsidePurchaseTotal;

    // Auto-calculate waste from press config waste curve
    let wasteSheets = 0;
    if (selectedConfig && q > 0) {
      const isCoated = form.stockType === "coated";
      const curveStr = isCoated ? selectedConfig.wasteCurveCoated : selectedConfig.wasteCurveUncoated;
      try {
        const curve: WasteCurveEntry[] = JSON.parse(curveStr);
        const entry = curve.find((w) => q >= w.min && q <= w.max);
        if (entry) {
          const totalColors = num("inkColorsFront") + num("inkColorsBack");
          const runningWastePct = entry.pctFirst + Math.max(0, totalColors - 1) * entry.pctAddl;
          wasteSheets = Math.ceil(q * (runningWastePct / 100));
        }
      } catch { /* ignore parse errors */ }
    }

    const subtotal = materialsCost + toolingCost + laborCost + finishingCost + makeReadyCost + shippingCost + outsideCost;

    // 4-category markup decomposition — Mary's 4/30/26 feedback. The bug:
    // paperMarkup was using the lumped materialsCost (paper + ink + coating)
    // and materialMarkup was using only toolingCost (plates), so material
    // markup came out to $0 on most quotes. Now we split materialsCost into:
    //   paperCost     = paper-only       (Paper bucket gets markupPaper)
    //   materialCost  = ink + coating + tooling (Material bucket gets
    //                   markupMaterial — these are consumables, separate
    //                   from paper)
    // outsideCost stays as outside services (Outside bucket).
    const inkSoftCost = num("commInkCost") + num("inkCostPerLb") * 0.1; // best-effort
    // Decompose materialsCost: anything that ISN'T paper goes to material.
    // paperCost is the part of materialsCost we can identify as paper-only.
    let paperOnlyCost = 0;
    let materialOnlyCost = 0;
    if (isCartonOffset || isCommOffset) {
      // For offset paths, reconstruct paper portion. carton: paper = (sheets/1000) × paperCostPer1000.
      // We approximate by attributing the paper portion via paperCostPer1000 × quantity / 1000.
      const sheetEstimate = Math.max(1, Math.ceil((q * v) / Math.max(num("numberUp"), 1))) + num("makeReadySheets");
      paperOnlyCost = (sheetEstimate / 1000) * (num("paperCostPer1000") || num("commPaperCostPer1000"));
      paperOnlyCost = Math.min(paperOnlyCost, materialsCost); // safety
      materialOnlyCost = Math.max(0, materialsCost - paperOnlyCost) + toolingCost;
    } else if (isCartonDigital || isCommDigital) {
      // For digital, paper = substrate cost (carton) or digitalPaperCost (comm).
      const sheetEstimate = Math.max(1, Math.ceil((q * v) / Math.max(num("numberUp"), 1))) + num("makeReadySheets");
      if (isCartonDigital) {
        paperOnlyCost = sheetEstimate * num("substrateCostPerSheet");
      } else {
        paperOnlyCost = num("digitalPaperCost") * (sheetEstimate / 1000);
      }
      paperOnlyCost = Math.min(paperOnlyCost, materialsCost);
      materialOnlyCost = Math.max(0, materialsCost - paperOnlyCost) + toolingCost;
    } else {
      paperOnlyCost = materialsCost;
      materialOnlyCost = toolingCost;
    }
    void inkSoftCost; // referenced for future ink-cost detail; suppress unused

    const paperMarkup = paperOnlyCost * (num("markupPaper") / 100);
    const materialMarkup = materialOnlyCost * (num("markupMaterial") / 100);
    const laborMarkup = laborCost * (num("markupLabor") / 100);
    const outsideMarkup = (shippingCost + outsideCost) * (num("markupOutside") / 100);
    const markupAmount = paperMarkup + materialMarkup + laborMarkup + outsideMarkup;

    const commissionAmount = subtotal * (num("commissionPercent") / 100);

    const preTaxTotal = subtotal + markupAmount + commissionAmount;
    const salesTax = preTaxTotal * 0.07; // 7% FL sales tax (Pinellas County)
    const total = preTaxTotal + salesTax;
    const costPerUnit = q > 0 ? total / q : 0;
    const costPer1000 = q > 0 ? (total / q) * 1000 : 0;

    return {
      materialsCost,
      paperCost: paperOnlyCost,
      materialCost: materialOnlyCost,
      toolingCost,
      laborCost,
      finishingCost,
      makeReadyCost,
      shippingCost,
      subtotal,
      markupAmount,
      paperMarkup,
      materialMarkup,
      laborMarkup,
      outsideMarkup,
      commissionAmount,
      salesTax,
      outsideCost,
      coatingCost,
      inserterCost,
      secapCost,
      wasteSheets,
      total,
      costPerUnit,
      costPer1000,
    };
  }, [form, selectedConfig]);

  // ─── Quantity Tier Calculations ─────────────────────────────────────────────

  const tierCalcs = useMemo(() => {
    if (form.quantityTiers.length === 0) return [];
    return form.quantityTiers.map((tierQty) => {
      if (tierQty <= 0) return null;
      const q = tierQty;
      const v = num("versions") || 1;
      let materialsCost = 0;
      let toolingCost = 0;
      let finishingCost = 0;
      let makeReadyCost = 0;

      if (isCartonOffset) {
        const sheetsNeeded = Math.ceil((q * v) / (num("numberUp") || 1));
        const paperCost = (sheetsNeeded / 1000) * num("paperCostPer1000");
        const totalColors = num("inkColorsFront") + num("inkColorsBack");
        const inkCost = totalColors * num("inkCostPerLb") * (sheetsNeeded / 5000);
        const coatingCost = (sheetsNeeded / 1000) * num("coatingCostPer1000");
        materialsCost = paperCost + inkCost + coatingCost;
        toolingCost = num("dieCuttingPlateCost") + num("strippingToolCost");
        finishingCost = num("gluingSetup") + num("windowPatching");
        makeReadyCost = (num("makeReadySheets") / 1000) * num("paperCostPer1000");
      } else if (isCartonDigital) {
        materialsCost = q * v * num("substrateCostPerSheet") + q * v * num("clickCharge");
        finishingCost = ((q * v * num("digitalDieCuttingTime")) / 60) * num("digitalCutterRate") + num("digitalCoatingCost");
        if (form.variableData) finishingCost += num("vdpComplexitySurcharge");
      } else if (isCommOffset) {
        const totalColors = num("inkColorsFront") + num("inkColorsBack");
        const sheetsNeeded = Math.ceil((q * v) / 1);
        materialsCost = (sheetsNeeded / 1000) * num("commPaperCostPer1000") + num("commInkCost") * totalColors * (num("inkCoveragePercent") / 100);
        toolingCost = num("plateCostEach") * totalColors;
        finishingCost = num("foldingCost") + num("saddleStitchCost") + num("perfectBindingCost") + num("trimCost") + num("binderySetupHours") * num("binderyRate");
        makeReadyCost = (500 / 1000) * num("commPaperCostPer1000");
      } else if (isCommDigital) {
        materialsCost = q * v * num("commDigitalClickCharge") + num("digitalPaperCost") * ((q * v) / 1000);
        materialsCost *= 1 + num("rushSurchargePercent") / 100;
        finishingCost = num("simpleFinishingCost") + num("personalizationSurcharge");
      }

      // Recalc press run time for this tier quantity
      let tierPressRunTime = num("pressRunTime");
      if (selectedConfig && q > 0) {
        const nUp = num("numberUp") || 1;
        const sheetsNeeded = Math.ceil((q * v) / nUp);
        const speed = form.stockType === "coated" ? selectedConfig.speedCoated : selectedConfig.speedUncoated;
        if (speed > 0) tierPressRunTime = sheetsNeeded / speed;
      }

      const laborCost = tierPressRunTime * num("pressOperatorRate") + num("prepressTime") * num("prepressRate") + num("setupTime") * num("pressOperatorRate");
      const shippingCost = num("shippingCost");
      const subtotal = materialsCost + toolingCost + laborCost + finishingCost + makeReadyCost + shippingCost;
      const markupAmount = materialsCost * (num("markupPaper") / 100) + toolingCost * (num("markupMaterial") / 100) + laborCost * (num("markupLabor") / 100) + shippingCost * (num("markupOutside") / 100);
      const commissionAmount = subtotal * (num("commissionPercent") / 100);
      const total = subtotal + markupAmount + commissionAmount;
      return { quantity: q, total, costPerUnit: total / q, costPer1000: (total / q) * 1000 };
    }).filter(Boolean) as { quantity: number; total: number; costPerUnit: number; costPer1000: number }[];
  }, [form, selectedConfig]);

  // ─── Crossover Analysis ────────────────────────────────────────────────────

  const crossover = useMemo(() => {
    // Simplified crossover: offset has high fixed costs (tooling) + low variable
    // Digital has low fixed + high variable (click charges)
    // Crossover = offsetFixed / (digitalVariable - offsetVariable)
    let offsetFixed = 0;
    let offsetVariable = 0;
    let digitalFixed = 0;
    let digitalVariable = 0;

    if (isCarton) {
      offsetFixed = num("dieCuttingPlateCost") + num("strippingToolCost") + num("gluingSetup");
      const nUp = num("numberUp") || 1;
      offsetVariable = num("paperCostPer1000") / (1000 * nUp) + num("coatingCostPer1000") / (1000 * nUp);
      digitalFixed = num("digitalCoatingCost");
      digitalVariable = num("clickCharge") + num("substrateCostPerSheet");
    } else {
      const totalColors = num("inkColorsFront") + num("inkColorsBack");
      offsetFixed = num("plateCostEach") * totalColors + num("binderySetupHours") * num("binderyRate");
      offsetVariable = num("commPaperCostPer1000") / 1000;
      digitalFixed = num("simpleFinishingCost");
      digitalVariable = num("commDigitalClickCharge") + num("digitalPaperCost") / 1000;
    }

    const netFixedDiff = offsetFixed - digitalFixed;
    const netVariableDiff = digitalVariable - offsetVariable;

    if (netVariableDiff <= 0) return null;
    const crossoverQty = Math.ceil(netFixedDiff / netVariableDiff);
    if (crossoverQty <= 0 || !isFinite(crossoverQty)) return null;
    return crossoverQty;
  }, [form]);

  // ─── Save as Quote ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        customerName: form.customerName,
        quoteRequestId: fromRequestId || undefined,
        productType: form.productType,
        productName: form.jobName,
        description: `${form.productType === "FOLDING_CARTON" ? "Folding Carton" : "Commercial Print"} - ${form.pressType === "OFFSET" ? "Offset" : "Digital"}${selectedPress ? ` (${selectedPress.name})` : ""} | ${form.finishedWidth}" x ${form.finishedHeight}"`,
        quantity: String(form.quantity),
        unitPrice: String(calc.costPerUnit.toFixed(4)),
        specs: JSON.stringify({
          // Full form snapshot — lets the estimator rehydrate when Mary
          // re-opens the draft. Includes everything in defaultForm shape.
          estimateData: form,
          estimateTotals: calc,
          dimensions: `${form.finishedWidth}x${form.finishedHeight}`,
          sheetSize: `${form.sheetWidth}x${form.sheetHeight}`,
          colors: `${form.inkColorsFront}F/${form.inkColorsBack}B`,
          pressName: selectedPress?.name || "",
          pressConfig: selectedConfig?.name || "",
          stockType: form.stockType,
          salesRep: form.salesRepName || "",
          csr: form.csrName || "",
          markups: { paper: form.markupPaper, material: form.markupMaterial, labor: form.markupLabor, outside: form.markupOutside },
          commission: { percent: form.commissionPercent, amount: calc.commissionAmount },
          quantityTiers: tierCalcs.length > 0 ? [
            { quantity: form.quantity, total: calc.total, costPerUnit: calc.costPerUnit, costPer1000: calc.costPer1000 },
            ...tierCalcs,
          ] : undefined,
          costBreakdown: { materials: calc.materialsCost, tooling: calc.toolingCost, labor: calc.laborCost, finishing: calc.finishingCost, waste: calc.makeReadyCost, shipping: calc.shippingCost, markup: calc.markupAmount, commission: calc.commissionAmount },
          additionalProducts: quoteProducts.length > 0 ? quoteProducts : undefined,
          // Quote request line items — flow through to JobLineItem rows on conversion.
          lineItems: (() => {
            const pf = (typeof window !== "undefined" ? (window as any).__quoteRequestPrefill : null);
            return pf && Array.isArray(pf.lineItems) && pf.lineItems.length > 0 ? pf.lineItems : undefined;
          })(),
          // Phase II — Multi-part jobs. Full part detail flows into specs and
          // materializes as JobLineItem rows on conversion. Per-part paper/press/
          // ink/bindery is preserved so the job ticket can render separate sections.
          parts: (form.parts as any[]).length > 0 ? (form.parts as any[]) : undefined,
          // ─── Job Ticket payload — auto-fills the job when quote converts ─────
          jobTicket: {
            flatSizeWidth: Number(form.sheetWidth) || null,
            flatSizeHeight: Number(form.sheetHeight) || null,
            finishedWidth: Number(form.finishedWidth) || null,
            finishedHeight: Number(form.finishedHeight) || null,
            numberUp: Number(form.numberUp) || null,
            numPages: Number(form.numPages) || null,
            varnish: form.specialtyCoating && form.specialtyCoating !== "none" ? form.specialtyCoating : null,
            coating: form.coatingType && form.coatingType !== "none" ? form.coatingType : null,
            pressAssignment: selectedPress?.name || null,
            pressFormat: selectedConfig?.name || null,
            makeReadyCount: Number(form.makeReadySheets) || null,
            // Stock description prefers the new structured fields (Mary's
            // 4/24/26 paper spec) when present; falls back to legacy fields.
            stockDescription: (() => {
              const bits = [
                form.paperBasisWeight ? `${form.paperBasisWeight}lb` : "",
                form.paperType ? form.paperType.replace(/_/g, " ") : "",
                form.paperFinish ? form.paperFinish.replace(/_/g, " ") : "",
                form.paperBrand,
                form.paperColor,
                form.paperTexture && form.paperTexture !== "smooth" ? form.paperTexture : "",
              ].filter(Boolean);
              if (bits.length > 0) return bits.join(" / ");
              return [form.stockType, form.paperWeight ? `${form.paperWeight}#` : "", form.paperBasisWeight ? `${form.paperBasisWeight}lb basis` : ""].filter(Boolean).join(" ") || null;
            })(),
            // Sheet sizes — flatSizeWidth/Height already capture parent;
            // expose run sheet too via specs.runSheet (rendered on ticket).
            runSheetWidth: Number(form.runSheetWidth) || null,
            runSheetHeight: Number(form.runSheetHeight) || null,
            // Mill item flag — surfaces on quote letter + job ticket
            isMillItem: !!form.isMillItem,
            millItemLeadTime: form.millItemLeadTime || null,
            // Bindery flags derived from cost entries + Phase 1 quantitative fields
            binderyFold: Number(form.foldingCost) > 0 || (form.foldType && form.foldType !== "none") || Number(form.numFolds) > 0,
            binderyStitch: Number(form.saddleStitchCost) > 0 || Number(form.perfectBindingCost) > 0,
            binderyScore: Number(form.strippingToolCost) > 0,
            binderyDrill: Number(form.numDrillHoles) > 0,
            binderyGlue: Number(form.gluingSetup) > 0,
            binderyWrap: !!form.skidPack,
            binderyNotes: [
              form.handBind1Name ? `Hand: ${form.handBind1Name}` : "",
              form.handBind2Name ? `Hand: ${form.handBind2Name}` : "",
              form.windowPatching > 0 ? "Window patching" : "",
              form.foldType && form.foldType !== "none" && Number(form.numFolds) > 0 ? `${form.foldType} fold × ${form.numFolds}` : "",
              Number(form.numCuts) > 0 ? `${form.numCuts} cuts` : "",
              Number(form.numDrillHoles) > 0 ? `${form.numDrillHoles} drill holes` : "",
            ].filter(Boolean).join("; ") || null,
            // Phase 1 — ink types surfaced on job ticket
            inkFront: form.inkColorsFront > 0 ? `${form.inkColorsFront}${form.inkTypeFront === "pms" ? " PMS" : form.inkTypeFront === "led_uv" ? " LED UV" : ""}/0` : null,
            inkBack: form.inkColorsBack > 0 ? `${form.inkColorsBack}${form.inkTypeBack === "pms" ? " PMS" : form.inkTypeBack === "led_uv" ? " LED UV" : ""}/0` : null,
            dieNumber: form.diePlywoodSize || null,
            // Job ticket extras (Mary can fill these on the estimator)
            fscCertified: !!form.fscCertified,
            pressCheck: !!form.pressCheck,
            softCover: !!form.softCover,
            plusCover: !!form.plusCover,
            hasBleeds: !!form.hasBleeds,
            blanketNumber: form.blanketNumber || null,
            deliveryTo: form.deliveryTo || null,
            samplesRequired: !!form.samplesRequired,
            samplesTo: form.samplesTo || null,
            pressNotes: form.specialInstructions || null,
            // Labor
            estimatedHours: (Number(form.pressRunTime) || 0) + (Number(form.prepressTime) || 0) + (Number(form.setupTime) || 0),
            laborCostRate: Number(form.pressOperatorRate) || null,
          },
        }),
      };
      // Resume-from-draft path: if we already have a draftQuoteId (either
      // loaded from URL or set after first save), PUT to update instead
      // of creating a new quote each time. Mary can come and go.
      let res: Response;
      let newQuoteId: string | undefined;
      if (draftQuoteId) {
        res = await fetch("/api/quotes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: draftQuoteId,
            specs: body.specs,
            customerName: body.customerName,
            productName: body.productName,
            description: body.description,
            quantity: body.quantity,
            unitPrice: body.unitPrice,
          }),
        });
        newQuoteId = draftQuoteId;
      } else {
        res = await fetch("/api/quotes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.clone().json().catch(() => null);
          newQuoteId = data?.quote?.id;
          if (newQuoteId) setDraftQuoteId(newQuoteId);
        }
      }
      if (res.ok) {
        setSaved(true);
        setAutoSavedAt(new Date());
        setTimeout(() => setSaved(false), 3000);
        // If this estimate was started from a quote request, mark it completed
        // so it exits the Quote Requests queue and lives on the Quotes tab.
        if (fromRequestId && newQuoteId) {
          try {
            await fetch("/api/quote-requests", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: fromRequestId, status: "completed", convertedQuoteId: newQuoteId }),
            });
          } catch { /* non-fatal */ }
        }
      }
    } catch {
      /* ignore */
    }
    setSaving(false);
  };

  const resetForm = () => {
    setForm({ ...defaultForm });
    setStep(1);
    setSaved(false);
  };

  // ─── Step 1: Product + Press Selection ─────────────────────────────────────

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Product Type</h2>
        <div className="grid grid-cols-2 gap-4">
          {([
            { value: "FOLDING_CARTON" as const, label: "Folding Carton", desc: "Boxes, cartons, packaging", icon: Package },
            { value: "COMMERCIAL_PRINT" as const, label: "Commercial Print", desc: "Brochures, booklets, flyers", icon: FileText },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("productType", opt.value)}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                form.productType === opt.value
                  ? "border-brand-500 bg-brand-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-xl ${
                  form.productType === opt.value ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-500"
                }`}
              >
                <opt.icon className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">{opt.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{opt.desc}</p>
              </div>
              {form.productType === opt.value && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Press Type</h2>
        <div className="grid grid-cols-2 gap-4">
          {([
            { value: "OFFSET" as const, label: "Offset (High Volume)", desc: "Traditional plates, high quality, large runs", icon: Layers },
            { value: "DIGITAL" as const, label: "Digital (Short Run)", desc: "No plates, fast turnaround, variable data", icon: Settings },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("pressType", opt.value)}
              className={`flex flex-col items-center gap-3 rounded-xl border-2 p-6 transition-all ${
                form.pressType === opt.value
                  ? "border-brand-500 bg-brand-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-xl ${
                  form.pressType === opt.value ? "bg-brand-100 text-brand-600" : "bg-gray-100 text-gray-500"
                }`}
              >
                <opt.icon className="h-7 w-7" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-gray-900">{opt.label}</p>
                <p className="mt-0.5 text-xs text-gray-500">{opt.desc}</p>
              </div>
              {form.pressType === opt.value && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-white">
                  <Check className="h-4 w-4" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Job Type</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {([
            { value: "new_with_prepress", label: "New w/ Pre-Press" },
            { value: "new_no_prepress", label: "New w/o Pre-Press" },
            { value: "exact_reprint", label: "Exact Reprint" },
            { value: "reprint_changes", label: "Reprint w/ Changes" },
            { value: "prepress_only", label: "Pre-Press Only" },
            { value: "bindery_only", label: "Bindery Only" },
            { value: "press_only", label: "Press Only" },
            { value: "all_outside", label: "All Outside" },
            { value: "digital_direct", label: "Digital Direct" },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("jobType", opt.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                form.jobType === opt.value
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-brand-100 text-brand-700 border-brand-200">
            {form.productType === "FOLDING_CARTON" ? "Folding Carton" : "Commercial Print"} +{" "}
            {form.pressType === "OFFSET" ? "Offset" : "Digital"}
          </Badge>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {isCartonOffset && "Full production packaging with plates, dies, and high-volume offset printing."}
          {isCartonDigital && "Short-run packaging with digital printing and digital die-cutting."}
          {isCommOffset && "Traditional commercial printing with plates, bindery, and finishing."}
          {isCommDigital && "Fast-turnaround digital prints with simple finishing options."}
        </p>
      </div>
    </div>
  );

  // ─── Step 2: Job Details ───────────────────────────────────────────────────

  const renderStep2 = () => (
    <div className="space-y-5">
      <Section title="Job Details" icon={FileText}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer">
            <Combobox
              value={form.customerName}
              onChange={(_id, label) => set("customerName", label)}
              options={companies.map(c => ({ id: c.id, label: c.name, subtitle: c.industry }))}
              placeholder="Select customer..."
              allowCreate
              duplicateCheck={(name) => {
                const match = companies.find(c => c.name.toLowerCase().includes(name.toLowerCase()) && c.name.toLowerCase() !== name.toLowerCase());
                return match ? { id: match.id, label: match.name, subtitle: match.industry } : null;
              }}
            />
          </Field>
          <Field label="Job Name / Description">
            <Input
              value={form.jobName}
              onChange={(e) => set("jobName", e.target.value)}
              placeholder="e.g. Cereal Box - 12oz"
            />
          </Field>
        </div>

        {employees.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Sales Rep">
              <Combobox
                value={form.salesRepName as string || ""}
                onChange={(_id, label) => set("salesRepName" as keyof FormState, label)}
                options={employees.map(e => ({ id: e.id, label: e.name, subtitle: e.role.replace(/_/g, " ") }))}
                placeholder="Select sales rep..."
              />
            </Field>
            <Field label="CSR">
              <Combobox
                value={form.csrName as string || ""}
                onChange={(_id, label) => set("csrName" as keyof FormState, label)}
                options={employees.map(e => ({ id: e.id, label: e.name, subtitle: e.role.replace(/_/g, " ") }))}
                placeholder="Select CSR..."
              />
            </Field>
          </div>
        )}

        <div className="mt-4">
          <Field label="Quantity">
            <Input
              type="number"
              value={form.quantity || ""}
              onChange={(e) => set("quantity", Number(e.target.value))}
              placeholder="Total units needed"
              className="!h-14 !text-2xl font-bold !border-brand-300 !ring-brand-200 bg-brand-50/30"
            />
            <p className="mt-1 text-xs text-brand-600 font-medium">The most important number -- everything calculates from this.</p>
          </Field>

          {/* Quantity Tiers — Mary's 4/30: she added a tier of 1000 but couldn't
              tell it took effect because the comparison was way at the bottom.
              Show tiers in a callout box with prices computed inline. */}
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-semibold text-blue-900">Additional Quantity Tiers</p>
                <p className="text-[11px] text-gray-600">Quote multiple volumes side-by-side (e.g. 1,000 / 2,500 / 5,000) — each tier&apos;s price calculates instantly.</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm(p => ({ ...p, quantityTiers: [...p.quantityTiers, 0] }))}
                className="gap-1.5 shrink-0"
              >
                <Plus className="h-3.5 w-3.5" /> Add Tier
              </Button>
            </div>
            {form.quantityTiers.length > 0 ? (
              <div className="space-y-1.5 mt-3">
                {form.quantityTiers.map((tier, i) => {
                  // Match by index too — handles dup quantities + accepts nearby values
                  const tierResult = tierCalcs.find(t => t.quantity === tier) || tierCalcs[i];
                  const showCalc = tier > 0 && tierResult && tierResult.total > 0;
                  return (
                    <div key={i} className="flex items-center gap-2 bg-white rounded-md border border-gray-200 px-2 py-1.5">
                      <Input
                        type="number"
                        value={tier || ""}
                        onChange={(e) => {
                          const newTiers = [...form.quantityTiers];
                          newTiers[i] = Number(e.target.value);
                          setForm(p => ({ ...p, quantityTiers: newTiers }));
                        }}
                        placeholder="e.g. 1000"
                        className="w-28 h-8 text-sm"
                      />
                      {showCalc ? (
                        <div className="flex-1 flex items-center justify-between text-xs">
                          <span className="text-gray-600">→ Total <strong className="text-gray-900">{fmtMoney(tierResult.total)}</strong></span>
                          <span className="text-gray-500">@ {fmtMoney(tierResult.costPerUnit)}/unit · {fmtMoney(tierResult.costPer1000)}/M</span>
                        </div>
                      ) : tier > 0 ? (
                        <span className="text-xs text-amber-600 flex-1">Calculating… (fill out the form to see this tier&apos;s price)</span>
                      ) : (
                        <span className="text-xs text-gray-400 flex-1">Enter a quantity</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setForm(p => ({ ...p, quantityTiers: p.quantityTiers.filter((_, j) => j !== i) }))}
                        className="text-gray-400 hover:text-red-500 p-1 shrink-0"
                        title="Remove tier"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
                <p className="text-[11px] text-gray-500 mt-2 italic">
                  Full Volume Pricing Comparison table appears below with per-unit and per-1,000 rates for each tier.
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-2">No additional tiers yet — click <strong>+ Add Tier</strong> above to add one.</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Versions" hint="Color / design variants">
            <Input
              type="number"
              value={form.versions || ""}
              onChange={(e) => set("versions", Number(e.target.value))}
              min={1}
            />
          </Field>
          <Field label="Finished Width (in)">
            <Input
              type="number"
              step="0.0625"
              value={form.finishedWidth || ""}
              onChange={(e) => set("finishedWidth", Number(e.target.value))}
            />
          </Field>
          <Field label="Finished Height (in)">
            <Input
              type="number"
              step="0.0625"
              value={form.finishedHeight || ""}
              onChange={(e) => set("finishedHeight", Number(e.target.value))}
            />
          </Field>
          {isCarton && (
            <Field label="Finished Depth (in)">
              <Input
                type="number"
                step="0.0625"
                value={(form as any).finishedDepth || ""}
                onChange={(e) => set("finishedDepth" as keyof FormState, Number(e.target.value))}
              />
            </Field>
          )}
          {!isCarton && (
            <Field label="Number of Pages">
              <Input
                type="number"
                value={form.numPages || ""}
                onChange={(e) => set("numPages", Number(e.target.value))}
                min={1}
              />
            </Field>
          )}
        </div>
      </Section>

      {/* Press Selection (offset only) */}
      {isOffset && presses.length > 0 && (
        <Section title="Press Selection" icon={Printer} defaultOpen={true}>
          {/* Smart Press Recommendation */}
          {form.quantity > 0 && form.sheetWidth > 0 && form.inkColorsFront > 0 && !form.selectedPressId && (() => {
            const recs = recommendPress(presses, {
              sheetWidth: form.sheetWidth,
              sheetHeight: form.sheetHeight,
              colorsNeeded: form.inkColorsFront + form.inkColorsBack,
              quantity: form.quantity,
              needsAqueous: form.specialtyCoating === "aqueous",
              stockType: form.stockType,
            });
            if (recs.length === 0) return null;
            return (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-xs font-semibold text-emerald-800 mb-2">Recommended Press</p>
                <div className="flex flex-wrap gap-2">
                  {recs.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { set("selectedPressId", r.pressId); set("selectedConfigId", r.configId); }}
                      className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs hover:border-emerald-400 transition-colors"
                    >
                      <span className="font-semibold text-gray-900">{r.pressName}</span>
                      <span className="text-gray-500">{r.configName}</span>
                      <span className="text-emerald-700 font-medium">${r.effectiveRate}/hr</span>
                      {i === 0 && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Best</Badge>}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-emerald-600 mt-1">Based on sheet size, colors, and quantity. Click to select.</p>
              </div>
            );
          })()}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Press" hint="Select from C&D's presses">
              <Select
                value={form.selectedPressId}
                onChange={(e) => {
                  set("selectedPressId", e.target.value);
                  // Auto-select first config
                  const press = presses.find(p => p.id === e.target.value);
                  if (press && press.configurations.length > 0) {
                    set("selectedConfigId", press.configurations[0].id);
                  } else {
                    set("selectedConfigId", "");
                  }
                }}
                options={[
                  { value: "", label: "— Select Press —" },
                  ...presses
                    .filter((p) => p.configurations.length > 0)
                    .map((p) => ({
                      value: p.id,
                      label: `${p.name} (${p.maxSheetWidth}x${p.maxSheetHeight}, $${p.costPerHour}/hr)`,
                    })),
                ]}
              />
            </Field>
            {/* Config auto-selected — hidden from user per Nitay's request */}
            <Field label="Stock Type" hint="Affects waste rates and ink coverage">
              <Select
                value={form.stockType}
                onChange={(e) => set("stockType", e.target.value as "coated" | "uncoated")}
                options={[
                  { value: "uncoated", label: "Uncoated" },
                  { value: "coated", label: "Coated" },
                  { value: "c1s", label: "C1S (Coated 1 Side)" },
                  { value: "c2s", label: "C2S (Coated 2 Sides)" },
                ]}
              />
            </Field>
            {/* Paper stock moved to Paper & Ink section */}
          </div>
          {selectedConfig && (
            <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
              <p className="text-sm font-medium text-brand-800 mb-2">Auto-filled from plant standards:</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><span className="text-gray-500">Press Rate:</span> <span className="font-semibold">${(selectedPress!.costPerHour + selectedConfig.addToHourlyRate).toFixed(0)}/hr</span></div>
                <div><span className="text-gray-500">Speed:</span> <span className="font-semibold">{(form.stockType === "coated" ? selectedConfig.speedCoated : selectedConfig.speedUncoated).toLocaleString()} sph</span></div>
                <div><span className="text-gray-500">Plate Cost:</span> <span className="font-semibold">${selectedConfig.plateCost.toFixed(2)}</span></div>
                <div><span className="text-gray-500">Setup Waste:</span> <span className="font-semibold">{form.stockType === "coated" ? selectedConfig.setupWasteCoated : selectedConfig.setupWasteUncoated} sheets</span></div>
                <div><span className="text-gray-500">Max Sheet:</span> <span className="font-semibold">{selectedPress!.maxSheetWidth}&quot;x{selectedPress!.maxSheetHeight}&quot;</span></div>
                <div><span className="text-gray-500">Colors:</span> <span className="font-semibold">{selectedConfig.numColors}C {selectedConfig.coatingType ? `+ ${selectedConfig.coatingType}` : ""}</span></div>
                <div><span className="text-gray-500">Setup Time:</span> <span className="font-semibold">{selectedConfig.setupMinutes} min</span></div>
                {selectedConfig.maxImpressions > 0 && (
                  <div><span className="text-gray-500">Max Impressions:</span> <span className="font-semibold">{selectedConfig.maxImpressions.toLocaleString()}</span></div>
                )}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Job Ticket Details — pre-fills Darrin's job ticket on conversion ── */}
      <Section title="Job Ticket Details (Optional)" icon={FileText} defaultOpen={false}>
        <p className="text-xs text-gray-500 mb-3">
          Mary: fill any you know now — they auto-populate the job ticket so Darrin doesn&apos;t have to re-enter. CSRs can still edit them later.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Blanket #">
            <Input value={form.blanketNumber} onChange={(e) => set("blanketNumber", e.target.value)} placeholder="Blanket number..." />
          </Field>
          <Field label="Deliver To">
            <Input value={form.deliveryTo} onChange={(e) => set("deliveryTo", e.target.value)} placeholder="Ship-to address / location" />
          </Field>
          <Field label="Samples To">
            <Input value={form.samplesTo} onChange={(e) => set("samplesTo", e.target.value)} placeholder="Who gets samples" />
          </Field>
          <Field label="Special Instructions" className="sm:col-span-2 lg:col-span-3">
            <Input value={form.specialInstructions} onChange={(e) => set("specialInstructions", e.target.value)} placeholder="Notes for the press / bindery / shipping" />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-5 pt-3 border-t border-gray-100">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.fscCertified} onChange={(e) => set("fscCertified", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            FSC Certified
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.pressCheck} onChange={(e) => set("pressCheck", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Press Check Required
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.hasBleeds} onChange={(e) => set("hasBleeds", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Has Bleeds
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.softCover} onChange={(e) => set("softCover", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Self Cover
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.plusCover} onChange={(e) => set("plusCover", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Plus Cover
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={form.samplesRequired} onChange={(e) => set("samplesRequired", e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Samples Required
          </label>
        </div>
      </Section>
    </div>
  );

  // ─── Step 3: Cost Inputs ───────────────────────────────────────────────────

  const renderStep3 = () => (
    <div className="space-y-5">
      {/* ── Folding Carton + Offset ─────────────────────────────────── */}
      {isCartonOffset && (
        <>
          <Section title="Sheet Layout & Die" icon={Ruler}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Sheet Width (in)">
                <Input type="number" step="0.125" value={form.sheetWidth || ""} onChange={(e) => set("sheetWidth", Number(e.target.value))} />
              </Field>
              <Field label="Sheet Height (in)">
                <Input type="number" step="0.125" value={form.sheetHeight || ""} onChange={(e) => set("sheetHeight", Number(e.target.value))} />
              </Field>
              <Field label="Number Up" hint="Cartons per sheet">
                <Input type="number" value={form.numberUp || ""} onChange={(e) => set("numberUp", Number(e.target.value))} min={1} />
              </Field>
              <Field label="Gutter Width (in)">
                <Input type="number" step="0.0625" value={form.gutterWidth || ""} onChange={(e) => set("gutterWidth", Number(e.target.value))} />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Make-Ready Sheets" hint="Waste for ink balance + die registration">
                <Input type="number" value={form.makeReadySheets || ""} onChange={(e) => set("makeReadySheets", Number(e.target.value))} />
              </Field>
            </div>
          </Section>

          {/* Phase II — Multi-part jobs (books with cover+text, multi-piece boxes) */}
          <Section title={`Parts ${(form.parts as any[]).length > 0 ? `(${(form.parts as any[]).length})` : ""}`} icon={Layers} defaultOpen={(form.parts as any[]).length > 0}>
            <p className="text-xs text-gray-500 mb-3">
              For books with a cover + text form, or boxes with multiple pieces. Each part gets its own paper, press, ink, and bindery — they all share the quote&apos;s quantity, with optional spoilage % per part (e.g. +10% covers for spoilage).
            </p>
            <div className="space-y-3">
              {(form.parts as any[]).map((p, i) => (
                <div key={p.id || i} className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-500">Part {i + 1}</span>
                      <Input
                        className="font-medium w-64"
                        value={p.name}
                        placeholder="e.g. Cover, Fly sheet, 94pgs text"
                        onChange={(e) => {
                          const next = [...(form.parts as any[])];
                          next[i] = { ...next[i], name: e.target.value };
                          set("parts" as keyof FormState, next as any);
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (form.parts as any[]).filter((_, j) => j !== i);
                        set("parts" as keyof FormState, next as any);
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >Remove part</button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <Field label="Spoilage %" hint="Extra above base qty">
                      <Input type="number" value={p.spoilagePct || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], spoilagePct: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} min={0} max={50} />
                    </Field>
                    <Field label="# Pages" hint="For text forms">
                      <Input type="number" value={p.numPages || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], numPages: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} min={0} />
                    </Field>
                    <Field label="Finished W">
                      <Input type="number" step="0.125" value={p.finishedWidth || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], finishedWidth: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} />
                    </Field>
                    <Field label="Finished H">
                      <Input type="number" step="0.125" value={p.finishedHeight || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], finishedHeight: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <Field label="Paper stock" className="sm:col-span-2">
                      <Input value={p.paperStock || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], paperStock: e.target.value };
                        set("parts" as keyof FormState, next as any);
                      }} placeholder="e.g. Eames Cover Solar White Canvas" />
                    </Field>
                    <Field label="Weight">
                      <Input value={p.paperWeight || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], paperWeight: e.target.value };
                        set("parts" as keyof FormState, next as any);
                      }} placeholder="e.g. 120LB Cover" />
                    </Field>
                    <Field label="$ per 1000 sheets">
                      <Input type="number" step="0.01" value={p.paperCostPer1000 || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], paperCostPer1000: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
                    <Field label="Press">
                      <select value={p.pressName || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], pressName: e.target.value };
                        set("parts" as keyof FormState, next as any);
                      }} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        <option value="">— select —</option>
                        {presses.map(pr => <option key={pr.id} value={pr.name}>{pr.name}</option>)}
                      </select>
                    </Field>
                    <Field label="Colors F">
                      <Input type="number" min={0} max={8} value={p.inkColorsFront || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], inkColorsFront: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} />
                    </Field>
                    <Field label="Colors B">
                      <Input type="number" min={0} max={8} value={p.inkColorsBack || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], inkColorsBack: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} />
                    </Field>
                    <Field label="Ink type F">
                      <select value={p.inkTypeFront || "process"} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], inkTypeFront: e.target.value };
                        set("parts" as keyof FormState, next as any);
                      }} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        <option value="process">Process</option>
                        <option value="pms">PMS</option>
                        <option value="led_uv">LED UV</option>
                      </select>
                    </Field>
                    <Field label="Coating">
                      <select value={p.coatingType || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], coatingType: e.target.value };
                        set("parts" as keyof FormState, next as any);
                      }} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        <option value="">— none —</option>
                        <option value="gloss_aq">Gloss AQ</option>
                        <option value="satin_aq">Satin AQ</option>
                        <option value="matte_aq">Matte AQ</option>
                        <option value="soft_touch">Soft Touch</option>
                        <option value="led_uv">LED UV</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <Field label="Fold type">
                      <select value={p.foldType || "none"} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], foldType: e.target.value, binderyFold: e.target.value !== "none" };
                        set("parts" as keyof FormState, next as any);
                      }} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                        <option value="none">None</option>
                        <option value="half">Half</option>
                        <option value="tri">Tri</option>
                        <option value="z">Z</option>
                        <option value="gate">Gate</option>
                        <option value="roll">Roll</option>
                        <option value="accordion">Accordion</option>
                        <option value="right_angle">Right-angle</option>
                      </select>
                    </Field>
                    <Field label="# folds">
                      <Input type="number" value={p.numFolds || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], numFolds: Number(e.target.value) };
                        set("parts" as keyof FormState, next as any);
                      }} min={0} max={10} />
                    </Field>
                    <Field label="# drill holes">
                      <Input type="number" value={p.numDrillHoles || ""} onChange={(e) => {
                        const next = [...(form.parts as any[])];
                        next[i] = { ...next[i], numDrillHoles: Number(e.target.value), binderyDrill: Number(e.target.value) > 0 };
                        set("parts" as keyof FormState, next as any);
                      }} min={0} max={10} />
                    </Field>
                    <Field label="Bindery">
                      <div className="flex gap-3 pt-1.5">
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={!!p.binderyStitch} onChange={(e) => {
                            const next = [...(form.parts as any[])];
                            next[i] = { ...next[i], binderyStitch: e.target.checked };
                            set("parts" as keyof FormState, next as any);
                          }} /> Stitch
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={!!p.binderyScore} onChange={(e) => {
                            const next = [...(form.parts as any[])];
                            next[i] = { ...next[i], binderyScore: e.target.checked };
                            set("parts" as keyof FormState, next as any);
                          }} /> Score
                        </label>
                        <label className="flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={!!p.binderyTrim} onChange={(e) => {
                            const next = [...(form.parts as any[])];
                            next[i] = { ...next[i], binderyTrim: e.target.checked };
                            set("parts" as keyof FormState, next as any);
                          }} /> Trim
                        </label>
                      </div>
                    </Field>
                  </div>
                  <Field label="Notes" className="mt-2">
                    <Input value={p.notes || ""} onChange={(e) => {
                      const next = [...(form.parts as any[])];
                      next[i] = { ...next[i], notes: e.target.value };
                      set("parts" as keyof FormState, next as any);
                    }} placeholder="Optional notes for this part" />
                  </Field>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = [...(form.parts as any[]), {
                    id: `part-${Date.now()}`,
                    name: "",
                    spoilagePct: 0,
                    flatWidth: 0, flatHeight: 0,
                    finishedWidth: 0, finishedHeight: 0,
                    numPages: 0,
                    paperStock: "", paperCategory: "", paperWeight: "", paperCostPer1000: 0,
                    pressName: "",
                    inkColorsFront: 0, inkColorsBack: 0, inkTypeFront: "process", inkTypeBack: "process",
                    coatingType: "",
                    binderyFold: false, foldType: "none", numFolds: 0,
                    binderyStitch: false, binderyScore: false, binderyDrill: false, numDrillHoles: 0,
                    binderyTrim: false,
                    notes: "",
                  }];
                  set("parts" as keyof FormState, next as any);
                }}
                className="text-sm font-medium text-brand-600 hover:text-brand-800"
              >
                + Add Part
              </button>
            </div>
          </Section>

          <Section title="Paper & Ink" icon={Droplets}>
            {/* ── Paper Specification (Mary 4/24/26) ────────────────────────
                Type / brand / color / texture / finish / parent vs run sheet
                / mill item flag — all flow through to the printed quote.    */}
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 mb-4 space-y-3">
              <p className="text-sm font-semibold text-gray-800">Paper Specification</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Paper Type" hint="High-level category">
                  <select
                    value={form.paperType}
                    onChange={(e) => set("paperType", e.target.value as any)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">— select —</option>
                    <option value="cover">Cover</option>
                    <option value="text">Text</option>
                    <option value="board_c1s">Board C1S</option>
                    <option value="board_c2s">Board C2S</option>
                    <option value="bond">Bond / Writing</option>
                    <option value="index">Index / Bristol</option>
                    <option value="envelope">Envelope</option>
                    <option value="label">Label / Pressure Sensitive</option>
                    <option value="magnetic">Magnetic</option>
                    <option value="ncr">Carbonless / NCR</option>
                    <option value="vellum">Vellum (type)</option>
                    <option value="synthetic">Synthetic</option>
                  </select>
                </Field>
                <Field label="Finish">
                  <select
                    value={form.paperFinish}
                    onChange={(e) => set("paperFinish", e.target.value as any)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">— select —</option>
                    <option value="coated_silk">Coated Silk / Dull</option>
                    <option value="coated_gloss">Coated Gloss</option>
                    <option value="uncoated">Uncoated</option>
                  </select>
                </Field>
                <Field label="Texture" hint="If uncoated">
                  <select
                    value={form.paperTexture}
                    onChange={(e) => set("paperTexture", e.target.value as any)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">— none / smooth —</option>
                    <option value="smooth">Smooth</option>
                    <option value="vellum">Vellum</option>
                    <option value="eggshell">Eggshell</option>
                    <option value="stipple">Stipple</option>
                    <option value="laid">Laid</option>
                    <option value="techweave">Techweave</option>
                    <option value="metallic">Metallic</option>
                  </select>
                </Field>
                <Field label="Brand">
                  <Input value={form.paperBrand} onChange={(e) => set("paperBrand", e.target.value)} placeholder="e.g. Mohawk, Cougar, Reich" />
                </Field>
                <Field label="Color">
                  <Input value={form.paperColor} onChange={(e) => set("paperColor", e.target.value)} placeholder="e.g. Solar White" />
                </Field>
                <Field label="Basis weight" hint="e.g. 100lb, 14pt">
                  <Input value={form.paperBasisWeight || ""} onChange={(e) => set("paperBasisWeight", Number(e.target.value))} placeholder="e.g. 100" />
                </Field>
              </div>
              {/* H × W order — Mary 5/1: grain direction convention. Putting
                  height first matches how paper is ordered + how the job ticket
                  reads sheets, so there's no confusion at the floor. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Parent sheet H" hint="Ordering size (grain ‖ H)">
                  <Input type="number" step="0.125" value={form.parentSheetHeight || ""} onChange={(e) => set("parentSheetHeight", Number(e.target.value))} placeholder="e.g. 35" />
                </Field>
                <Field label="Parent sheet W">
                  <Input type="number" step="0.125" value={form.parentSheetWidth || ""} onChange={(e) => set("parentSheetWidth", Number(e.target.value))} placeholder="e.g. 23" />
                </Field>
                <Field label="Run sheet H" hint="Press sheet">
                  <Input type="number" step="0.125" value={form.runSheetHeight || ""} onChange={(e) => set("runSheetHeight", Number(e.target.value))} placeholder="e.g. 23" />
                </Field>
                <Field label="Run sheet W">
                  <Input type="number" step="0.125" value={form.runSheetWidth || ""} onChange={(e) => set("runSheetWidth", Number(e.target.value))} placeholder="e.g. 17.5" />
                </Field>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isMillItem}
                    onChange={(e) => set("isMillItem", e.target.checked as any)}
                    className="h-4 w-4 rounded border-amber-400 mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-amber-900">Mill item — extended lead time</span>
                    {form.isMillItem && (
                      <Input
                        className="mt-2 bg-white"
                        value={form.millItemLeadTime}
                        onChange={(e) => set("millItemLeadTime", e.target.value)}
                        placeholder="e.g. allow 2-3 weeks; min 5 ctns; mill ships from PA"
                      />
                    )}
                    {form.isMillItem && (
                      <p className="text-[11px] text-amber-700 mt-1">This note will print on the quote letter to the customer.</p>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Paper Category" hint="(Legacy filter — for inventory search only)">
                <select
                  value={form.paperCategory}
                  onChange={(e) => set("paperCategory", e.target.value as any)}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="">— any —</option>
                  <option value="coated">Coated</option>
                  <option value="uncoated">Uncoated</option>
                  <option value="c1s">C1S (Coated 1 Side)</option>
                  <option value="cover">Cover</option>
                  <option value="text">Text</option>
                  <option value="label">Label Stock</option>
                </select>
              </Field>
              <Field label="Paper Stock" hint="Search from inventory" className="sm:col-span-2">
                <Combobox
                  value={form.stockDescription as string || ""}
                  onChange={(_id, label) => set("stockDescription" as keyof FormState, label)}
                  options={materialsList
                    .filter(m => {
                      const cat = form.paperCategory as string;
                      if (!cat) return true;
                      const hay = `${m.name} ${m.sku ?? ""}`.toLowerCase();
                      if (cat === "coated") return hay.includes("coated") || hay.includes("gloss") || hay.includes("matte") || hay.includes("silk");
                      if (cat === "uncoated") return hay.includes("uncoated") || hay.includes("offset") || hay.includes("opaque");
                      if (cat === "c1s") return hay.includes("c1s") || hay.includes("c/1/s") || hay.includes("1/s");
                      if (cat === "cover") return hay.includes("cover") || hay.includes("c/c") || hay.includes("c2s");
                      if (cat === "text") return hay.includes("text");
                      if (cat === "label") return hay.includes("label");
                      return true;
                    })
                    .map(m => ({ id: m.id, label: m.name, subtitle: m.sku || undefined }))}
                  placeholder={`Search ${form.paperCategory || "paper"} stock...`}
                  allowCreate
                />
              </Field>
              <Field label="Paper Weight" hint="e.g. 18pt, 100lb">
                <Input value={form.paperBasisWeight || ""} onChange={(e) => set("paperBasisWeight", Number(e.target.value))} placeholder="e.g. 18pt" />
              </Field>
              <Field label="Sheets per carton" hint="From supplier spec">
                <Input type="number" value={form.sheetsPerCarton || ""} onChange={(e) => set("sheetsPerCarton", Number(e.target.value))} min={0} />
              </Field>
              <Field label="Caliper (inches)" hint={(() => {
                const auto = lookupCaliper(String(form.paperWeight || form.paperBasisWeight || ""), undefined, form.paperCategory === "cover" ? "Cover" : form.paperCategory === "text" ? "Text" : undefined)
                  ?? guessCaliperFromText(form.stockDescription as string);
                return auto ? `Auto-suggests ${auto}" from paper spec` : "Enter manually; drives cut lift count";
              })()}>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={form.paperCaliperInches || ""}
                  placeholder={(() => {
                    const auto = lookupCaliper(String(form.paperWeight || form.paperBasisWeight || ""), undefined, form.paperCategory === "cover" ? "Cover" : form.paperCategory === "text" ? "Text" : undefined)
                      ?? guessCaliperFromText(form.stockDescription as string);
                    return auto ? `${auto}` : "e.g. 0.014";
                  })()}
                  onChange={(e) => {
                    // type="text" lets Mary paste/type ".0054" or "0.0054" without
                    // browser step-validation rejecting it. We parse here.
                    const v = parseFloat(e.target.value);
                    set("paperCaliperInches", isNaN(v) ? 0 : v);
                  }}
                />
              </Field>
              <Field label="Round up to full cartons" hint="Cover/text stocks usually required">
                <label className="flex items-center gap-2 h-9 text-sm">
                  <input
                    type="checkbox"
                    checked={form.roundUpCartons}
                    onChange={(e) => set("roundUpCartons", e.target.checked as any)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Buy full cartons
                </label>
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Paper Pricing">
                <Select
                  value={form.paperPricingMode as string}
                  onChange={(e) => set("paperPricingMode", e.target.value)}
                  options={[
                    { value: "per1000", label: "$ per 1,000 Sheets" },
                    { value: "cwt", label: "$ per CWT (100 lbs)" },
                  ]}
                />
              </Field>
              {form.paperPricingMode === "cwt" ? (
                <>
                  <Field label="Basis Weight (lbs)" hint="e.g. 180">
                    <Input type="number" value={form.paperBasisWeight || ""} onChange={(e) => set("paperBasisWeight", Number(e.target.value))} />
                  </Field>
                  <Field label="Price per CWT ($)" hint="Per 100 lbs">
                    <Input type="number" step="0.01" value={form.paperPricePerCwt || ""} onChange={(e) => set("paperPricePerCwt", Number(e.target.value))} />
                  </Field>
                </>
              ) : (
                <Field label="Paper Cost ($ per 1000 sheets)">
                  <Input type="number" step="0.01" value={form.paperCostPer1000 || ""} onChange={(e) => set("paperCostPer1000", Number(e.target.value))} />
                </Field>
              )}
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Ink</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Colors (Front)">
                  <Input type="number" value={form.inkColorsFront || ""} onChange={(e) => set("inkColorsFront", Number(e.target.value))} min={0} max={8} />
                </Field>
                <Field label="Front ink type">
                  <select
                    value={form.inkTypeFront}
                    onChange={(e) => {
                      set("inkTypeFront", e.target.value as any);
                      // Auto-update ink cost rate from Plant Standards
                      if (plantStandards) {
                        const r = e.target.value === "pms" ? plantStandards.inkPmsPerLb
                          : e.target.value === "led_uv" ? (plantStandards.inkPmsPerLb * 1.3) // LED UV ~30% premium
                          : plantStandards.inkColorPerLb;
                        set("inkCostPerLb", r);
                      }
                    }}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="process">Process (4/C)</option>
                    <option value="pms">PMS (spot)</option>
                    <option value="led_uv">LED UV</option>
                  </select>
                </Field>
                <Field label="Colors (Back)">
                  <Input type="number" value={form.inkColorsBack || ""} onChange={(e) => set("inkColorsBack", Number(e.target.value))} min={0} max={8} />
                </Field>
                <Field label="Back ink type">
                  <select
                    value={form.inkTypeBack}
                    onChange={(e) => set("inkTypeBack", e.target.value as any)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="process">Process (4/C)</option>
                    <option value="pms">PMS (spot)</option>
                    <option value="led_uv">LED UV</option>
                  </select>
                </Field>
                <Field label="Ink Cost ($/lb)" hint={`Auto from ink type; override if needed`}>
                  <Input type="number" step="0.01" value={form.inkCostPerLb || ""} onChange={(e) => set("inkCostPerLb", Number(e.target.value))} />
                </Field>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-4">
                <Field label="Black Coverage %" hint="Typical 6%">
                  <Input type="number" step="1" value={form.inkBlackPct || ""} onChange={(e) => set("inkBlackPct", Number(e.target.value))} min={0} max={100} />
                </Field>
                <Field label="Color Coverage %" hint="Typical 12%">
                  <Input type="number" step="1" value={form.inkColorPct || ""} onChange={(e) => set("inkColorPct", Number(e.target.value))} min={0} max={100} />
                </Field>
                <Field label="Varnish Coverage %" hint="Typical 12%">
                  <Input type="number" step="1" value={form.inkVarnishPct || ""} onChange={(e) => set("inkVarnishPct", Number(e.target.value))} min={0} max={100} />
                </Field>
              </div>
            </div>

            {/* Coating — moved here from Mailing & Coatings per Mary 5/1.
                Per-impression calculator using Darrin's AQ rate table from
                Plant Standards (gloss/satin/matte AQ $1.09, soft touch $6.25,
                LED UV $6.30, retic coating $11.25, retic varnish $25.30 per
                lb; per-sq-in usage rates from his calculator). */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Coating <span className="text-xs font-normal text-gray-500">— per-impression calc using Darrin&apos;s AQ rate table</span></p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Coating Type">
                  <Select
                    value={form.coatingType as string}
                    onChange={(e) => set("coatingType", e.target.value)}
                    options={[
                      { value: "none", label: "None" },
                      { value: "gloss_aq", label: "Gloss Aqueous ($1.09/lb)" },
                      { value: "satin_aq", label: "Satin Aqueous ($1.09/lb)" },
                      { value: "matte_aq", label: "Matte Aqueous ($1.09/lb)" },
                      { value: "soft_touch", label: "Soft Touch Aqueous ($6.25/lb)" },
                      { value: "led_uv", label: "Gloss LED UV ($6.30/lb)" },
                      { value: "retic_coating", label: "Reticulated Coating ($11.25/lb)" },
                      { value: "retic_varnish", label: "Reticulated Varnish ($25.30/lb)" },
                    ]}
                  />
                </Field>
                {form.coatingType !== "none" && form.coatingType !== "" && (
                  <>
                    <Field label="Impressions" hint="# sheets to coat (defaults to qty)">
                      <Input type="number" value={form.coatingImpressions || ""} placeholder={String(form.quantity || "0")} onChange={(e) => set("coatingImpressions", Number(e.target.value))} />
                    </Field>
                    <Field label="Sheet Width (in)" hint="For coverage calc">
                      <Input type="number" step="0.5" value={form.coatingSheetWidth || ""} onChange={(e) => set("coatingSheetWidth", Number(e.target.value))} />
                    </Field>
                    <Field label="Sheet Height (in)">
                      <Input type="number" step="0.5" value={form.coatingSheetHeight || ""} onChange={(e) => set("coatingSheetHeight", Number(e.target.value))} />
                    </Field>
                    <Field label="Spot Coating Blankets" hint="$175 each">
                      <Input type="number" value={form.coatingBlankets || ""} onChange={(e) => set("coatingBlankets", Number(e.target.value))} min={0} />
                    </Field>
                    <Field label="Cyrel Plates" hint="$300 each + $50 shipping">
                      <Input type="number" value={form.coatingCyrelPlates || ""} onChange={(e) => set("coatingCyrelPlates", Number(e.target.value))} min={0} />
                    </Field>
                  </>
                )}
              </div>
              {/* Legacy specialty coating + flat per-1000 cost retained for back-compat */}
              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Specialty Coating (legacy)" hint="Use Coating Type above instead">
                  <Select
                    value={form.specialtyCoating}
                    onChange={(e) => set("specialtyCoating", e.target.value)}
                    options={[
                      { value: "none", label: "None" },
                      { value: "uv", label: "UV Coating" },
                      { value: "aqueous", label: "Aqueous" },
                      { value: "soft-touch", label: "Soft-Touch Laminate" },
                      { value: "matte", label: "Matte Laminate" },
                    ]}
                  />
                </Field>
                <Field label="Flat Coating Cost ($ per 1000)" hint="Optional manual override">
                  <Input type="number" step="0.01" value={form.coatingCostPer1000 || ""} onChange={(e) => set("coatingCostPer1000", Number(e.target.value))} />
                </Field>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Proofs <span className="text-xs font-normal text-gray-500">— per Mary&apos;s feedback: quantitative + priced from Plant Standards</span></p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                <Field label={`High-res 1-sided  (${plantStandards ? `$${plantStandards.hiResProofCost.toFixed(2)}/ea` : "$30/ea"})`}>
                  <Input type="number" value={form.hiResProofCount || ""} onChange={(e) => set("hiResProofCount", Number(e.target.value))} min={0} />
                </Field>
                <Field label={`Low-res 2-sided  (${plantStandards ? `$${plantStandards.lowResProofCost.toFixed(2)}/ea` : "$12/ea"})`}>
                  <Input type="number" value={form.lowResProofCount || ""} onChange={(e) => set("lowResProofCount", Number(e.target.value))} min={0} />
                </Field>
              </div>
            </div>

            {/* ── Plates & Plate Labor (Mary's feedback) ── */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Plates <span className="text-xs font-normal text-gray-500">— labor auto-calculated from plate count × minutes/plate</span></p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
                <Field label="Labor minutes per plate" hint={plantStandards ? `Plate maker rate: $${plantStandards.plateMakingRate}/hr` : ""}>
                  <Input type="number" step="1" value={form.plateLaborMinutesEach || ""} onChange={(e) => set("plateLaborMinutesEach", Number(e.target.value))} min={0} />
                </Field>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-600">Additional plates (e.g. spot PMS on one form)</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const next = [...(form.extraPlates as { description: string; cost: number }[]), { description: "", cost: 0 }];
                      set("extraPlates", next as any);
                    }}
                  >+ Add plate</Button>
                </div>
                {(form.extraPlates as { description: string; cost: number }[]).length > 0 && (
                  <div className="space-y-2">
                    {(form.extraPlates as { description: string; cost: number }[]).map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="Plate description (e.g. 'Spot PMS 8005 — form 1')"
                          value={p.description}
                          onChange={(e) => {
                            const next = [...(form.extraPlates as { description: string; cost: number }[])];
                            next[i] = { ...next[i], description: e.target.value };
                            set("extraPlates", next as any);
                          }}
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Cost $"
                          className="w-32"
                          value={p.cost || ""}
                          onChange={(e) => {
                            const next = [...(form.extraPlates as { description: string; cost: number }[])];
                            next[i] = { ...next[i], cost: Number(e.target.value) };
                            set("extraPlates", next as any);
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => {
                            const next = (form.extraPlates as { description: string; cost: number }[]).filter((_, idx) => idx !== i);
                            set("extraPlates", next as any);
                          }}
                        >×</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Finishing & Bindery" icon={Scissors}>
            {/* ── Phase 1 + II: Quantitative finishing (Mary + Darrin) ── */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 mb-4">
              <p className="text-xs font-medium text-blue-900 mb-2">
                Quantitative finishing — enter counts, system calculates time &amp; cost using Plant Standards rates.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="# of cuts" hint={(() => {
                  const cal = Number(form.paperCaliperInches) || 0.005;
                  const lh = plantStandards?.cutLiftHeightInches ?? 6;
                  const lifts = Math.max(1, Math.ceil((form.quantity * cal) / lh));
                  return plantStandards
                    ? `${plantStandards.cutTimePerCutSec}s × ${lifts} lift${lifts!==1?"s":""} per cut`
                    : "Auto";
                })()}>
                  <Input type="number" value={form.numCuts || ""} onChange={(e) => set("numCuts", Number(e.target.value))} min={0} />
                </Field>
                <Field label="Fold type">
                  <select
                    value={form.foldType}
                    onChange={(e) => set("foldType", e.target.value as any)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="none">None</option>
                    <option value="half">Half fold</option>
                    <option value="tri">Tri (letter) fold</option>
                    <option value="z">Z fold</option>
                    <option value="gate">Gate fold</option>
                    <option value="roll">Roll fold</option>
                    <option value="accordion">Accordion</option>
                    <option value="double_parallel">Double parallel</option>
                    <option value="french">French / cross fold</option>
                    <option value="right_angle">Right-angle fold</option>
                    <option value="custom">Custom</option>
                  </select>
                </Field>
                <Field label="# of folds per sheet" hint={plantStandards ? `${plantStandards.foldTimePerFoldSec}s/fold` : "Auto"}>
                  <Input type="number" value={form.numFolds || ""} onChange={(e) => set("numFolds", Number(e.target.value))} min={0} max={10} />
                </Field>
                <Field label="# of drill holes" hint={plantStandards ? `${plantStandards.drillTimePerHoleSec}s/hole @ $${plantStandards.drillingRate}/hr` : "Auto"}>
                  <Input type="number" value={form.numDrillHoles || ""} onChange={(e) => set("numDrillHoles", Number(e.target.value))} min={0} max={10} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-3 pt-3 border-t border-blue-200">
                <Field label="# scores" hint={plantStandards ? `Letterpress — ${plantStandards.scorePerfPerHour}/hr @ $${plantStandards.scorePerfRate}` : "Auto"}>
                  <Input type="number" value={form.numScores || ""} onChange={(e) => set("numScores", Number(e.target.value))} min={0} max={20} />
                </Field>
                <Field label="# perfs" hint={plantStandards ? `${plantStandards.perfRulePremiumMultiplier}× score rule cost` : "Perf premium"}>
                  <Input type="number" value={form.numPerfs || ""} onChange={(e) => set("numPerfs", Number(e.target.value))} min={0} max={20} />
                </Field>
                <Field label="# pads">
                  <Input type="number" value={form.numPads || ""} onChange={(e) => set("numPads", Number(e.target.value))} min={0} />
                </Field>
                <Field label="Sheets / pad" hint={plantStandards ? `Hand bindery @ $${plantStandards.handBinderyRate}/hr, ${plantStandards.paddingSheetsPerHour}/hr` : "Auto"}>
                  <Input type="number" value={form.sheetsPerPad || ""} onChange={(e) => set("sheetsPerPad", Number(e.target.value))} min={0} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mt-3 pt-3 border-t border-blue-200">
                <Field label="# bundles" hint="For banding/wrapping">
                  <Input type="number" value={form.numBundles || ""} onChange={(e) => set("numBundles", Number(e.target.value))} min={0} />
                </Field>
                <Field label="Wrap length / bundle (in)" hint={plantStandards ? `$${plantStandards.wrapFilmCostPerFoot}/ft film + labor` : "Inches of film per bundle"}>
                  <Input type="number" value={form.wrapLengthPerBundleInches || ""} onChange={(e) => set("wrapLengthPerBundleInches", Number(e.target.value))} min={0} />
                </Field>
                <Field label="% solids coverage" hint={plantStandards ? `>${plantStandards.heavyCoverageThresholdPct}% caps press @ ${plantStandards.solidCoveragePressSpeed} SPH` : "Heavy coverage slows press"}>
                  <Input type="number" value={form.coverageSolidsPct || ""} onChange={(e) => set("coverageSolidsPct", Number(e.target.value))} min={0} max={100} />
                </Field>
              </div>
              {/* Saddle stitch + perfect bind — Mary 4/30: auto-calculate
                  from the rate × qty formula instead of forcing a manual $ */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mt-3 pt-3 border-t border-blue-200">
                <Field
                  label="Saddle stitch (qty)"
                  hint={plantStandards
                    ? `Mueller @ $${plantStandards.saddleStitch1Rate || 95}/hr, ${plantStandards.saddleStitch1Speed || 8000}/hr → ${(() => {
                        const rate = Number(plantStandards.saddleStitch1Rate) || 95;
                        const speed = Number(plantStandards.saddleStitch1Speed) || 8000;
                        const cost = (Number(form.saddleStitchCost) > 0 && !form.saddleStitchAuto)
                          ? Number(form.saddleStitchCost)
                          : ((Number(form.saddleStitchQty) || 0) * rate / Math.max(speed, 1));
                        return `auto-calc = $${cost.toFixed(2)}`;
                      })()}`
                    : "Pieces saddle-stitched"}
                >
                  <Input
                    type="number"
                    value={form.saddleStitchQty || ""}
                    placeholder={String(form.quantity || "0")}
                    onChange={(e) => {
                      const qty = Number(e.target.value) || 0;
                      const rate = Number(plantStandards?.saddleStitch1Rate) || 95;
                      const speed = Number(plantStandards?.saddleStitch1Speed) || 8000;
                      const cost = qty * rate / Math.max(speed, 1);
                      setForm(p => ({ ...p, saddleStitchQty: qty, saddleStitchCost: cost, saddleStitchAuto: true } as any));
                    }}
                    min={0}
                  />
                </Field>
                <Field label="Or override ($)" hint="Manual saddle stitch $ (overrides qty calc)">
                  <Input
                    type="number"
                    step="0.01"
                    value={form.saddleStitchAuto ? "" : (form.saddleStitchCost || "")}
                    placeholder={form.saddleStitchAuto ? `Auto: $${(Number(form.saddleStitchCost) || 0).toFixed(2)}` : "0.00"}
                    onChange={(e) => setForm(p => ({ ...p, saddleStitchCost: Number(e.target.value), saddleStitchAuto: false } as any))}
                    min={0}
                  />
                </Field>
                <Field label="Perfect bind ($)" hint="Total cost (lump sum)">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.perfectBindingCost || ""}
                    placeholder="0.00"
                    onChange={(e) => { const v = parseFloat(e.target.value); set("perfectBindingCost", isNaN(v) ? 0 : v); }}
                  />
                </Field>
                <Field label="Final trim to size ($)" hint="Lump-sum cost for final trimming">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={form.trimCost || ""}
                    placeholder="0.00"
                    onChange={(e) => { const v = parseFloat(e.target.value); set("trimCost", isNaN(v) ? 0 : v); }}
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Gluing Setup ($)">
                <Input type="number" step="0.01" value={form.gluingSetup || ""} onChange={(e) => set("gluingSetup", Number(e.target.value))} />
              </Field>
              <Field label="Window Patching ($)">
                <Input type="number" step="0.01" value={form.windowPatching || ""} onChange={(e) => set("windowPatching", Number(e.target.value))} />
              </Field>
              <Field label="Cutting Difficulty" hint="Legacy — prefer # of cuts above">
                <Input type="number" step="0.1" value={form.cuttingDiff || ""} onChange={(e) => set("cuttingDiff", Number(e.target.value))} min={0} max={5} />
              </Field>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Hand Bindery Operations</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Hand Bind 1 Name" hint="e.g. Softtouch">
                  <Input value={form.handBind1Name as string} onChange={(e) => set("handBind1Name", e.target.value)} placeholder="Operation name" />
                </Field>
                <Field label="Speed (per hour)">
                  <Input type="number" value={form.handBind1SpeedPerHour || ""} onChange={(e) => set("handBind1SpeedPerHour", Number(e.target.value))} />
                </Field>
                <Field label="% of Quantity" hint="100 = all pieces">
                  <Input type="number" value={form.handBind1PctOfQty || ""} onChange={(e) => set("handBind1PctOfQty", Number(e.target.value))} min={0} max={100} />
                </Field>
                <Field label="Hand Bind 2 Name" hint="e.g. DC/GL/Fold">
                  <Input value={form.handBind2Name as string} onChange={(e) => set("handBind2Name", e.target.value)} placeholder="Operation name" />
                </Field>
                <Field label="Speed (per hour)">
                  <Input type="number" value={form.handBind2SpeedPerHour || ""} onChange={(e) => set("handBind2SpeedPerHour", Number(e.target.value))} />
                </Field>
              </div>
            </div>
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Packing</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Carton Type">
                  <Select
                    value={String(form.cartonType)}
                    onChange={(e) => set("cartonType", Number(e.target.value))}
                    options={[
                      { value: "1", label: "11.25x8.75x10 ($0.93)" },
                      { value: "2", label: "11x9x10 ($0.75)" },
                      { value: "3", label: "LTHD BOX ($0.52)" },
                    ]}
                  />
                </Field>
                <Field label="Skid Pack">
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input type="checkbox" checked={form.skidPack as boolean} onChange={(e) => set("skidPack", e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                    <span className="text-sm text-gray-700">Include skid ($5.00)</span>
                  </label>
                </Field>
              </div>
            </div>
          </Section>

          {/* Outside Purchases — Phase II: richer form per Mary's feedback
              (vendor, operation type, lump vs per-unit, quote ref#)        */}
          <Section title="Outside Purchases" icon={Truck} defaultOpen={false}>
            <p className="text-xs text-gray-500 mb-3">
              Vendors give us lump-sum or per-unit pricing per quote. Capture their quote here — it rolls into outside-services total with the Outside markup applied.
            </p>
            <div className="space-y-3">
              {(form.outsidePurchases as any[]).map((op, i) => (
                <div key={i} className="rounded-lg border border-gray-200 p-3 bg-white">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <Field label="Vendor">
                      <Input
                        value={op.vendor || ""}
                        onChange={(e) => {
                          const next = [...(form.outsidePurchases as any[])];
                          next[i] = { ...next[i], vendor: e.target.value };
                          set("outsidePurchases" as keyof FormState, next as any);
                        }}
                        placeholder="e.g. Bindtech"
                      />
                    </Field>
                    <Field label="Operation">
                      <select
                        value={op.operation || ""}
                        onChange={(e) => {
                          const next = [...(form.outsidePurchases as any[])];
                          next[i] = { ...next[i], operation: e.target.value };
                          set("outsidePurchases" as keyof FormState, next as any);
                        }}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="">— select —</option>
                        <option value="lamination">Lamination</option>
                        <option value="perfect_bind">Perfect bind</option>
                        <option value="book_bind">Book bind / case bind</option>
                        <option value="coating">Coating / UV</option>
                        <option value="foil">Foil stamp</option>
                        <option value="diecut">Die cut</option>
                        <option value="emboss">Emboss / deboss</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                    <Field label="Pricing">
                      <select
                        value={op.pricingMode || "lump"}
                        onChange={(e) => {
                          const next = [...(form.outsidePurchases as any[])];
                          next[i] = { ...next[i], pricingMode: e.target.value };
                          set("outsidePurchases" as keyof FormState, next as any);
                        }}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="lump">Lump sum</option>
                        <option value="per_unit">Per unit</option>
                      </select>
                    </Field>
                    <Field label="Quote ref #">
                      <Input
                        value={op.quoteRef || ""}
                        onChange={(e) => {
                          const next = [...(form.outsidePurchases as any[])];
                          next[i] = { ...next[i], quoteRef: e.target.value };
                          set("outsidePurchases" as keyof FormState, next as any);
                        }}
                        placeholder="Vendor quote #"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Field label="Description">
                      <Input
                        value={op.description || ""}
                        onChange={(e) => {
                          const next = [...(form.outsidePurchases as any[])];
                          next[i] = { ...next[i], description: e.target.value };
                          set("outsidePurchases" as keyof FormState, next as any);
                        }}
                        placeholder="What are we buying?"
                      />
                    </Field>
                    {(op.pricingMode === "per_unit") ? (
                      <>
                        <Field label="Unit $">
                          <Input type="number" step="0.0001" value={op.unitAmount || ""}
                            onChange={(e) => {
                              const next = [...(form.outsidePurchases as any[])];
                              const unitAmount = Number(e.target.value);
                              const unitCount = Number(next[i].unitCount) || 0;
                              next[i] = { ...next[i], unitAmount, cost: unitAmount * unitCount };
                              set("outsidePurchases" as keyof FormState, next as any);
                            }}
                          />
                        </Field>
                        <Field label="# units">
                          <Input type="number" value={op.unitCount || ""}
                            onChange={(e) => {
                              const next = [...(form.outsidePurchases as any[])];
                              const unitCount = Number(e.target.value);
                              const unitAmount = Number(next[i].unitAmount) || 0;
                              next[i] = { ...next[i], unitCount, cost: unitAmount * unitCount };
                              set("outsidePurchases" as keyof FormState, next as any);
                            }}
                          />
                        </Field>
                      </>
                    ) : (
                      <Field label="Lump sum $" className="sm:col-span-2">
                        <Input type="number" step="0.01" value={op.cost || ""}
                          onChange={(e) => {
                            const next = [...(form.outsidePurchases as any[])];
                            next[i] = { ...next[i], cost: Number(e.target.value) };
                            set("outsidePurchases" as keyof FormState, next as any);
                          }}
                        />
                      </Field>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-500">
                      {op.pricingMode === "per_unit"
                        ? `= $${((Number(op.unitAmount)||0) * (Number(op.unitCount)||0)).toFixed(2)}`
                        : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const next = (form.outsidePurchases as any[]).filter((_, j) => j !== i);
                        set("outsidePurchases" as keyof FormState, next as any);
                      }}
                      className="text-xs text-red-600 hover:text-red-800"
                    >Remove</button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = [...(form.outsidePurchases as any[]), { description: "", cost: 0, pricingMode: "lump" }];
                  set("outsidePurchases" as keyof FormState, next as any);
                }}
                className="text-sm font-medium text-brand-600 hover:text-brand-800"
              >
                + Add Outside Purchase
              </button>
            </div>
          </Section>
        </>
      )}

      {/* ── Folding Carton + Digital ────────────────────────────────── */}
      {isCartonDigital && (
        <>
          <Section title="Digital Press Costs" icon={Layers}>
            {/* Auto-detected click rate for transparency — Mary 4/24/26 */}
            {plantStandards && (() => {
              const tier = getDigitalSizeTier(form.sheetWidth || 0, form.sheetHeight || 0, plantStandards);
              const inkCfg = inferInkConfig(form.inkColorsFront, form.inkColorsBack);
              const baseRate = getDigitalClickRate(tier, inkCfg, plantStandards);
              const vdRate = form.variableData ? getDigitalVDRate(tier, plantStandards) : 0;
              const totalRate = baseRate + vdRate;
              return (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 mb-4 text-sm">
                  <p className="font-medium text-blue-900 mb-1">Auto-detected click rate (Mary&apos;s pricing matrix)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-gray-600">Sheet:</span> {form.sheetWidth || "?"}×{form.sheetHeight || "?"}</div>
                    <div><span className="text-gray-600">Tier:</span> <strong>{tier}</strong> ({tier === 1 ? "8.5×11 to 13×19" : tier === 2 ? "13×19.3 to 13×30" : "13×30.1 to 13×35.4"})</div>
                    <div><span className="text-gray-600">Ink config:</span> <strong>{inkCfg}</strong></div>
                    <div><span className="text-gray-600">Per-sheet:</span> <strong>${totalRate.toFixed(5)}</strong>{form.variableData && ` (incl. VD)`}</div>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Manual Click Override ($)" hint="Leave 0 to use auto-detected rate above">
                <Input type="number" step="0.001" value={form.clickCharge || ""} onChange={(e) => set("clickCharge", Number(e.target.value))} />
              </Field>
              <Field label="Substrate Cost ($ per sheet)">
                <Input type="number" step="0.01" value={form.substrateCostPerSheet || ""} onChange={(e) => set("substrateCostPerSheet", Number(e.target.value))} />
              </Field>
              <Field label="Digital Die-Cut Time (min/sheet)">
                <Input type="number" step="0.1" value={form.digitalDieCuttingTime || ""} onChange={(e) => set("digitalDieCuttingTime", Number(e.target.value))} />
              </Field>
              <Field label="Digital Cutter Rate ($/hr)">
                <Input type="number" step="0.01" value={form.digitalCutterRate || ""} onChange={(e) => set("digitalCutterRate", Number(e.target.value))} />
              </Field>
              <Field label="Coating / Lamination Cost ($)">
                <Input type="number" step="0.01" value={form.digitalCoatingCost || ""} onChange={(e) => set("digitalCoatingCost", Number(e.target.value))} />
              </Field>
            </div>
          </Section>

          <Section title="Variable Data" icon={Hash} defaultOpen={false}>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.variableData}
                  onChange={(e) => set("variableData", e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm font-medium text-gray-700">Variable Data Printing (VDP)</span>
              </label>
              {form.variableData && (
                <Field label="VDP Complexity Surcharge ($)">
                  <Input type="number" step="0.01" value={form.vdpComplexitySurcharge || ""} onChange={(e) => set("vdpComplexitySurcharge", Number(e.target.value))} />
                </Field>
              )}
            </div>
          </Section>
        </>
      )}

      {/* ── Commercial Print + Offset ───────────────────────────────── */}
      {isCommOffset && (
        <>
          <Section title="Plates & Ink" icon={Droplets}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Plate Cost ($ each)">
                <Input type="number" step="0.01" value={form.plateCostEach || ""} onChange={(e) => set("plateCostEach", Number(e.target.value))} />
              </Field>
              <Field label="Ink Colors (Front)">
                <Input type="number" value={form.inkColorsFront || ""} onChange={(e) => set("inkColorsFront", Number(e.target.value))} min={0} max={8} />
              </Field>
              <Field label="Ink Colors (Back)">
                <Input type="number" value={form.inkColorsBack || ""} onChange={(e) => set("inkColorsBack", Number(e.target.value))} min={0} max={8} />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Paper Weight (GSM)">
                <Input type="number" value={form.paperWeight || ""} onChange={(e) => set("paperWeight", Number(e.target.value))} />
              </Field>
              <Field label="Paper Cost ($ per 1000 sheets)">
                <Input type="number" step="0.01" value={form.commPaperCostPer1000 || ""} onChange={(e) => set("commPaperCostPer1000", Number(e.target.value))} />
              </Field>
              <Field label="Ink Cost ($)" hint="Per-job ink cost">
                <Input type="number" step="0.01" value={form.commInkCost || ""} onChange={(e) => set("commInkCost", Number(e.target.value))} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label={`Ink Coverage: ${form.inkCoveragePercent}%`}>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={form.inkCoveragePercent}
                  onChange={(e) => set("inkCoveragePercent", Number(e.target.value))}
                  className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-brand-600"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>20%</span>
                  <span>60%</span>
                  <span>100%</span>
                </div>
              </Field>
            </div>
          </Section>

          <Section title="Bindery & Finishing" icon={Scissors}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Folding ($)">
                <Input type="number" step="0.01" value={form.foldingCost || ""} onChange={(e) => set("foldingCost", Number(e.target.value))} />
              </Field>
              <Field label="Saddle-Stitch ($)">
                <Input type="number" step="0.01" value={form.saddleStitchCost || ""} onChange={(e) => set("saddleStitchCost", Number(e.target.value))} />
              </Field>
              <Field label="Perfect Binding ($)">
                <Input type="number" step="0.01" value={form.perfectBindingCost || ""} onChange={(e) => set("perfectBindingCost", Number(e.target.value))} />
              </Field>
              <Field label="Trim ($)">
                <Input type="number" step="0.01" value={form.trimCost || ""} onChange={(e) => set("trimCost", Number(e.target.value))} />
              </Field>
              <Field label="Bindery Setup (hours)">
                <Input type="number" step="0.25" value={form.binderySetupHours || ""} onChange={(e) => set("binderySetupHours", Number(e.target.value))} />
              </Field>
              <Field label="Bindery Rate ($/hr)">
                <Input type="number" step="0.01" value={form.binderyRate || ""} onChange={(e) => set("binderyRate", Number(e.target.value))} />
              </Field>
            </div>
          </Section>
        </>
      )}

      {/* ── Commercial Print + Digital ──────────────────────────────── */}
      {isCommDigital && (
        <>
          <Section title="Digital Costs" icon={Layers}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Click Charge / Impression ($)">
                <Input type="number" step="0.001" value={form.commDigitalClickCharge || ""} onChange={(e) => set("commDigitalClickCharge", Number(e.target.value))} />
              </Field>
              <Field label="Digital-Certified Paper ($)" hint="Cost per 1000 sheets">
                <Input type="number" step="0.01" value={form.digitalPaperCost || ""} onChange={(e) => set("digitalPaperCost", Number(e.target.value))} />
              </Field>
              <Field label="Rush Surcharge (%)">
                <Input type="number" step="1" value={form.rushSurchargePercent || ""} onChange={(e) => set("rushSurchargePercent", Number(e.target.value))} min={0} max={100} />
              </Field>
              <Field label="Personalization / VDP ($)">
                <Input type="number" step="0.01" value={form.personalizationSurcharge || ""} onChange={(e) => set("personalizationSurcharge", Number(e.target.value))} />
              </Field>
              <Field label="Simple Finishing ($)" hint="Trim, fold, etc.">
                <Input type="number" step="0.01" value={form.simpleFinishingCost || ""} onChange={(e) => set("simpleFinishingCost", Number(e.target.value))} />
              </Field>
            </div>
          </Section>
        </>
      )}

      {/* ── Universal: Labor & Overhead ─────────────────────────────── */}
      <Section title="Labor & Time" icon={Clock}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Press Operator Rate ($/hr)">
            <Input type="number" step="0.01" value={form.pressOperatorRate || ""} onChange={(e) => set("pressOperatorRate", Number(e.target.value))} />
          </Field>
          <Field label="Prepress Rate ($/hr)">
            <Input type="number" step="0.01" value={form.prepressRate || ""} onChange={(e) => set("prepressRate", Number(e.target.value))} />
          </Field>
          <Field label="Press Run Time (hours)">
            <Input type="number" step="0.25" value={form.pressRunTime || ""} onChange={(e) => set("pressRunTime", Number(e.target.value))} />
          </Field>
          <Field label="Prepress Time (hours)">
            <Input type="number" step="0.25" value={form.prepressTime || ""} onChange={(e) => set("prepressTime", Number(e.target.value))} />
          </Field>
          <Field label="Setup / Make-Ready (hours)">
            <Input type="number" step="0.25" value={form.setupTime || ""} onChange={(e) => set("setupTime", Number(e.target.value))} />
          </Field>
        </div>
        {isOffset && (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Press Helpers" hint="Additional crew">
              <Input type="number" value={form.pressHelpers || ""} onChange={(e) => set("pressHelpers", Number(e.target.value))} min={0} max={5} />
            </Field>
            <Field label="Waste Factor Override" hint="0 = auto from press config">
              <Input type="number" step="0.1" value={form.wasteFactor || ""} onChange={(e) => set("wasteFactor", Number(e.target.value))} min={0} />
            </Field>
          </div>
        )}
        {isOffset && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Difficulty Factors</p>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Makeready Diff" hint="1.0 = normal">
                <Input type="number" step="0.1" value={form.makereadyDiff || ""} onChange={(e) => set("makereadyDiff", Number(e.target.value))} min={0} max={5} />
              </Field>
              <Field label="Washup Diff" hint="1.0 = normal">
                <Input type="number" step="0.1" value={form.washupDiff || ""} onChange={(e) => set("washupDiff", Number(e.target.value))} min={0} max={5} />
              </Field>
              <Field label="Run Diff" hint="1.0 = normal">
                <Input type="number" step="0.1" value={form.runDiff || ""} onChange={(e) => set("runDiff", Number(e.target.value))} min={0} max={5} />
              </Field>
            </div>
          </div>
        )}
      </Section>

      {/* ── Print Finishing (Todd's Calculator) ──────────────────── */}
      <Section title="Print Finishing" icon={Scissors} defaultOpen={false}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Finishing Operation">
            <Select
              value={form.finishingPressCode as string}
              onChange={(e) => set("finishingPressCode", e.target.value)}
              options={[
                { value: "", label: "None" },
                { value: "VC", label: "Very Small Die Cut (10x15)" },
                { value: "SC", label: "Small Die Cut (12x18)" },
                { value: "MC", label: "Medium Die Cut (23x29)" },
                { value: "LC", label: "Large Die Cut (28x40)" },
                { value: "LS", label: "Large DC w/Waste Strip (28x40)" },
                { value: "SF", label: "Small Foil/Emboss (12x18)" },
                { value: "MF", label: "Medium Foil/Emboss (23x29)" },
                { value: "LE", label: "Large Emboss (28x40)" },
                { value: "GA", label: "Fold & Glue Economizer" },
                { value: "GB", label: "Fold & Glue Unifold" },
                { value: "GC", label: "Fold & Glue In Line" },
                { value: "GD", label: "Fold & Glue Small" },
                { value: "PF", label: "Pocket Folder Special" },
              ]}
            />
          </Field>
          {form.finishingPressCode && (
            <>
              <Field label="Quantity (thousands)" hint="e.g. 5 = 5,000">
                <Input type="number" step="0.5" value={form.finishingQuantityM || ""} onChange={(e) => set("finishingQuantityM", Number(e.target.value))} />
              </Field>
              <Field label="Number of Runs" hint="Multiple passes">
                <Input type="number" value={form.finishingRuns || ""} onChange={(e) => set("finishingRuns", Number(e.target.value))} min={1} />
              </Field>
            </>
          )}
        </div>

        {(form.finishingPressCode === "SF" || form.finishingPressCode === "MF" || form.finishingPressCode === "LE") && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Foil Stamping</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Foil Color">
                <Select
                  value={form.foilColor as string}
                  onChange={(e) => set("foilColor", e.target.value)}
                  options={[
                    { value: "", label: "None" },
                    { value: "gold", label: "Gold/Silver ($1.20/si)" },
                    { value: "chart", label: "Chart Colors ($1.60/si)" },
                    { value: "scratch", label: "Scratch Off ($3.00/si)" },
                    { value: "custom", label: "Custom Colors ($1.95/si)" },
                    { value: "pattern", label: "Special Pattern ($2.60/si)" },
                  ]}
                />
              </Field>
              <Field label="Foil Area (sq inches)" hint="Per piece">
                <Input type="number" step="0.5" value={form.foilSizeSquareInches || ""} onChange={(e) => set("foilSizeSquareInches", Number(e.target.value))} />
              </Field>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Cutting Die Cost</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Die-Cutting Plate Cost ($)">
              <Input type="number" step="0.01" value={form.dieCuttingPlateCost || ""} onChange={(e) => set("dieCuttingPlateCost", Number(e.target.value))} />
            </Field>
            <Field label="Rule (linear inches)" hint="Cutting/scoring @ $1.45/in">
              <Input type="number" step="1" value={form.dieCostLinearInches || ""} onChange={(e) => set("dieCostLinearInches", Number(e.target.value))} />
            </Field>
            <Field label="Plywood Base Size">
              <Select
                value={form.diePlywoodSize as string}
                onChange={(e) => set("diePlywoodSize", e.target.value)}
                options={[
                  { value: "", label: "None" },
                  { value: "V", label: "Very Small ($25)" },
                  { value: "S", label: "Small ($25)" },
                  { value: "M", label: "Medium ($45)" },
                  { value: "L", label: "Large/Bobst ($54)" },
                ]}
              />
            </Field>
          </div>
        </div>
      </Section>

      {/* ── Mailing & Wafer Sealing (Outside Services) ─── Mary 5/1: coating
           moved to the Paper & Ink section. This section is mailing-only now. */}
      <Section title="Mailing" icon={Truck} defaultOpen={false}>
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Mail Inserting</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Inserter Pockets" hint="0 = no inserting">
              <Input type="number" value={form.inserterPockets || ""} onChange={(e) => set("inserterPockets", Number(e.target.value))} min={0} max={6} />
            </Field>
            {(form.inserterPockets as number) > 0 && (
              <Field label="Mail Type">
                <Select
                  value={form.inserterMailType as string}
                  onChange={(e) => set("inserterMailType", e.target.value)}
                  options={[
                    { value: "regular", label: "Regular ($35/hr)" },
                    { value: "match", label: "Match Mail ($50/hr)" },
                  ]}
                />
              </Field>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-gray-100 pt-4">
          <p className="text-sm font-medium text-gray-700 mb-3">Wafer Sealing & Inkjet</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Wafer Seal Tabs" hint="0 = no sealing">
              <Input type="number" value={form.secapTabs || ""} onChange={(e) => set("secapTabs", Number(e.target.value))} min={0} />
            </Field>
            {(form.secapTabs as number) > 0 && (
              <Field label="Inkjet Addressing">
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.secapInkjet as boolean}
                    onChange={(e) => set("secapInkjet", e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <span className="text-sm text-gray-700">Add inkjet ($0.005/piece)</span>
                </label>
              </Field>
            )}
          </div>
        </div>
      </Section>

      <Section title="Shipping & Markup" icon={Truck}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Shipping / Delivery ($)">
            <Input type="number" step="0.01" value={form.shippingCost || ""} onChange={(e) => set("shippingCost", Number(e.target.value))} />
          </Field>
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-gray-700">Markup by Category (%)</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Paper" hint="Applied to paper/substrate">
              <Input type="number" step="0.5" value={form.markupPaper || ""} onChange={(e) => set("markupPaper", Number(e.target.value))} min={0} max={200} />
            </Field>
            <Field label="Material" hint="Ink, plates, tooling">
              <Input type="number" step="0.5" value={form.markupMaterial || ""} onChange={(e) => set("markupMaterial", Number(e.target.value))} min={0} max={200} />
            </Field>
            <Field label="Labor" hint="Press, prepress, setup">
              <Input type="number" step="0.5" value={form.markupLabor || ""} onChange={(e) => set("markupLabor", Number(e.target.value))} min={0} max={200} />
            </Field>
            <Field label="Outside" hint="Shipping, services">
              <Input type="number" step="0.5" value={form.markupOutside || ""} onChange={(e) => set("markupOutside", Number(e.target.value))} min={0} max={200} />
            </Field>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Sales Commission (%)" hint="Applied to subtotal (default 10%)">
            <Input type="number" step="0.5" value={form.commissionPercent || ""} onChange={(e) => set("commissionPercent", Number(e.target.value))} min={0} max={50} />
          </Field>
        </div>
      </Section>
    </div>
  );

  // ─── Step 4: Summary ───────────────────────────────────────────────────────

  const renderStep4 = () => (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50 to-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-brand-600">Estimate for</p>
              <CardTitle className="text-xl">{form.customerName || "—"}</CardTitle>
              <p className="mt-1 text-sm text-gray-500">{form.jobName || "Untitled Job"}</p>
            </div>
            <div className="text-right">
              <Badge className="bg-brand-100 text-brand-700 border-brand-200">
                {isCarton ? "Folding Carton" : "Commercial Print"} &middot; {isOffset ? "Offset" : "Digital"}
              </Badge>
              <p className="mt-2 text-sm text-gray-500">
                {formatNumber(form.quantity)} units &times; {form.versions} version{form.versions !== 1 ? "s" : ""}
                {selectedPress && selectedConfig && (
                  <span className="block mt-1 text-xs text-brand-600">
                    Press: {selectedPress.name} / {selectedConfig.name}
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-brand-600" /> Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <CostRow label="Materials" sublabel="Substrate + ink + coating" amount={calc.materialsCost} icon={Droplets} />
            <CostRow label="Tooling" sublabel="Dies, plates, tooling" amount={calc.toolingCost} icon={Settings} />
            <CostRow label="Labor" sublabel="Press + prepress + setup time" amount={calc.laborCost} icon={Users} />
            <CostRow label="Finishing" sublabel="Bindery, gluing, patching" amount={calc.finishingCost} icon={Scissors} />
            <CostRow label="Make-Ready / Waste" sublabel="Waste sheets at paper cost" amount={calc.makeReadyCost} icon={RotateCcw} />
            <CostRow label="Shipping" sublabel="Delivery cost" amount={calc.shippingCost} icon={Truck} />
            {calc.outsideCost > 0 && (
              <CostRow label="Outside Services" sublabel="Coatings, mailing, sealing" amount={calc.outsideCost} icon={Package} />
            )}

            <div className="my-3 border-t border-gray-200" />

            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Subtotal</span>
              <span className="font-semibold text-gray-900">{fmtMoney(calc.subtotal)}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 ml-11">Paper ({form.markupPaper}%)</span>
                <span className="font-medium text-brand-600">+ {fmtMoney(calc.paperMarkup)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 ml-11">Material ({form.markupMaterial}%)</span>
                <span className="font-medium text-brand-600">+ {fmtMoney(calc.materialMarkup)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 ml-11">Labor ({form.markupLabor}%)</span>
                <span className="font-medium text-brand-600">+ {fmtMoney(calc.laborMarkup)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 ml-11">Outside ({form.markupOutside}%)</span>
                <span className="font-medium text-brand-600">+ {fmtMoney(calc.outsideMarkup)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Total Markup</span>
                <span className="font-semibold text-brand-600">+ {fmtMoney(calc.markupAmount)}</span>
              </div>
            </div>
            {calc.commissionAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Sales Commission ({form.commissionPercent}%)</span>
                <span className="font-semibold text-amber-600">+ {fmtMoney(calc.commissionAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">Sales Tax (7%)</span>
              <span className="font-semibold text-gray-600">+ {fmtMoney(calc.salesTax)}</span>
            </div>

            <div className="my-3 border-t-2 border-gray-900" />

            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-gray-900">Total Estimate</span>
              <span className="text-2xl font-bold text-brand-600">{fmtMoney(calc.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Unit Metrics */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Target className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Cost Per Unit</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{fmtMoney(calc.costPerUnit)}</p>
        </Card>
        <Card className="p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <TrendingUp className="h-4 w-4" />
            <p className="text-xs font-medium uppercase tracking-wide">Cost Per 1,000</p>
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{fmtMoney(calc.costPer1000)}</p>
        </Card>
      </div>

      {/* Quantity Tier Comparison */}
      {tierCalcs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-brand-600" /> Volume Pricing Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 pr-4 font-medium text-gray-500">Quantity</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500">Total</th>
                    <th className="text-right py-2 px-4 font-medium text-gray-500">Per Unit</th>
                    <th className="text-right py-2 pl-4 font-medium text-gray-500">Per 1,000</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Primary quantity */}
                  <tr className="border-b border-gray-100 bg-brand-50/50">
                    <td className="py-2.5 pr-4 font-semibold text-brand-700">{form.quantity.toLocaleString()} <span className="text-xs font-normal text-brand-500">(primary)</span></td>
                    <td className="text-right py-2.5 px-4 font-semibold">{fmtMoney(calc.total)}</td>
                    <td className="text-right py-2.5 px-4 font-semibold">{fmtMoney(calc.costPerUnit)}</td>
                    <td className="text-right py-2.5 pl-4 font-semibold">{fmtMoney(calc.costPer1000)}</td>
                  </tr>
                  {tierCalcs.map((t, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-gray-900">{t.quantity.toLocaleString()}</td>
                      <td className="text-right py-2.5 px-4">{fmtMoney(t.total)}</td>
                      <td className="text-right py-2.5 px-4">{fmtMoney(t.costPerUnit)}</td>
                      <td className="text-right py-2.5 pl-4">{fmtMoney(t.costPer1000)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Crossover Analysis */}
      {crossover !== null && crossover > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <TrendingUp className="h-5 w-5" /> Crossover Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-900">
              Based on the cost inputs provided, <strong>offset printing becomes cheaper than digital</strong> at
              approximately <strong>{crossover.toLocaleString()} units</strong>.
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Offset has higher fixed costs (plates, dies, setup) but lower per-unit cost. Digital has low fixed costs
              but higher per-unit click charges. Below {crossover.toLocaleString()} units, digital is more economical.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Multi-Product Accumulator */}
      {quoteProducts.length > 0 && (
        <Card className="border-brand-200">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5 text-brand-600" /> Products in This Quote ({quoteProducts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {quoteProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{p.productName || `Product ${i + 1}`}</p>
                    <p className="text-xs text-gray-500">{p.quantity.toLocaleString()} units - {p.productType === "FOLDING_CARTON" ? "Carton" : "Print"} / {p.pressType}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{fmtMoney(p.total)}</span>
                    <button type="button" onClick={() => setQuoteProducts(prev => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="text-sm font-medium text-gray-700">Combined Total</span>
                <span className="text-lg font-bold text-brand-600">{fmtMoney(quoteProducts.reduce((s, p) => s + p.total, 0) + calc.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button
          variant="outline"
          className="gap-2 border-brand-200 text-brand-700 hover:bg-brand-50"
          onClick={() => {
            if (!form.jobName && !form.quantity) return;
            const tierData = tierCalcs.length > 0
              ? [{ quantity: form.quantity, total: calc.total, costPerUnit: calc.costPerUnit, costPer1000: calc.costPer1000 }, ...tierCalcs]
              : [{ quantity: form.quantity, total: calc.total, costPerUnit: calc.costPerUnit, costPer1000: calc.costPer1000 }];
            setQuoteProducts(prev => [...prev, {
              productName: form.jobName,
              productType: form.productType,
              pressType: form.pressType,
              quantity: form.quantity,
              unitPrice: calc.costPerUnit,
              total: calc.total,
              tiers: tierData,
              specs: { dimensions: `${form.finishedWidth}x${form.finishedHeight}`, pressName: selectedPress?.name, pressConfig: selectedConfig?.name, colors: `${form.inkColorsFront}F/${form.inkColorsBack}B`, stockType: form.stockType },
            }]);
            // Reset product-specific fields but keep customer and settings
            setForm(prev => ({ ...prev, jobName: "", quantity: 0, finishedWidth: 0, finishedHeight: 0, quantityTiers: [], pressRunTime: 0, dieCuttingPlateCost: 0, strippingToolCost: 0, gluingSetup: 0, windowPatching: 0 }));
            setStep(2);
          }}
        >
          <Plus className="h-4 w-4" /> Add Product &amp; Continue
        </Button>
        {/* Auto-save indicator — Mary's feedback: confidence she won't lose work */}
        {(autoSavedAt || autoSaving || draftQuoteId) && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {autoSaving ? (
              <span className="text-blue-600">Auto-saving…</span>
            ) : autoSavedAt ? (
              <span className="text-emerald-600">
                ✓ Auto-saved at {autoSavedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : draftQuoteId ? (
              <span>Resumed draft</span>
            ) : null}
          </div>
        )}
        {/* Quick links to printable views — Mary's feedback (4/30): she
            couldn't find the detailed summary because the buttons were
            only on the quotes list. Surface them here once a draft exists. */}
        {draftQuoteId && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/dashboard/quotes/${draftQuoteId}/detailed`, "_blank")}
              className="gap-1.5"
              title="Internal itemized estimate breakdown (E&M-style)"
            >
              📊 Detailed Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/dashboard/quotes/${draftQuoteId}/print`, "_blank")}
              className="gap-1.5"
              title="Customer quote letter"
            >
              <Printer className="h-3.5 w-3.5" /> Quote Letter
            </Button>
          </div>
        )}
        <Button onClick={handleSave} disabled={saving || saved} className="gap-2">
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved as Quote
            </>
          ) : saving ? (
            "Saving..."
          ) : (
            <>
              <DollarSign className="h-4 w-4" /> Save as Quote
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print Estimate
        </Button>
        <Button variant="ghost" onClick={resetForm} className="gap-2 text-gray-500">
          <RotateCcw className="h-4 w-4" /> Start Over
        </Button>
      </div>
    </div>
  );

  // ─── Cost Row Sub-Component ────────────────────────────────────────────────

  function CostRow({
    label,
    sublabel,
    amount,
    icon: Icon,
  }: {
    label: string;
    sublabel: string;
    amount: number;
    icon: React.ElementType;
  }) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">{sublabel}</p>
        </div>
        <span className="text-sm font-semibold text-gray-900">{fmtMoney(amount)}</span>
      </div>
    );
  }

  // ─── Live Sidebar Totals ───────────────────────────────────────────────────

  const showLiveTotals = step >= 3 && form.quantity > 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/quotes" className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="h-4 w-4 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Estimator</h1>
            <p className="text-sm text-gray-500">Build a detailed cost estimate</p>
          </div>
        </div>
        <Badge className="bg-brand-100 text-brand-700 border-brand-200">
          {isCarton ? "Carton" : "Print"} &middot; {isOffset ? "Offset" : "Digital"}
        </Badge>
      </div>

      {/* Steps Nav */}
      <div className="flex items-center gap-1 print:hidden">
        {[
          { n: 1, label: "Product & Press" },
          { n: 2, label: "Job Details" },
          { n: 3, label: "Cost Inputs" },
          { n: 4, label: "Summary" },
        ].map((s, i) => (
          <button
            key={s.n}
            type="button"
            onClick={() => setStep(s.n)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              step === s.n
                ? "bg-brand-600 text-white shadow-sm"
                : step > s.n
                ? "bg-brand-50 text-brand-700 hover:bg-brand-100"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                step === s.n
                  ? "bg-white/20 text-white"
                  : step > s.n
                  ? "bg-brand-200 text-brand-700"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {step > s.n ? <Check className="h-3.5 w-3.5" /> : s.n}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className={`${showLiveTotals && step !== 4 ? "grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]" : ""}`}>
        {/* Content */}
        <div>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}

          {/* Navigation */}
          {step < 4 && (
            <div className="mt-6 flex items-center justify-between print:hidden">
              <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(Math.min(4, step + 1))} className="gap-2">
                {step === 3 ? "View Summary" : "Continue"} <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Live Totals Sidebar */}
        {showLiveTotals && step !== 4 && (
          <div className="print:hidden">
            <Card className="sticky top-6 border-brand-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-brand-600" /> Live Estimate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Materials</span>
                    <span className="font-medium">{fmtMoney(calc.materialsCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tooling</span>
                    <span className="font-medium">{fmtMoney(calc.toolingCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Labor</span>
                    <span className="font-medium">{fmtMoney(calc.laborCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Finishing</span>
                    <span className="font-medium">{fmtMoney(calc.finishingCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Waste</span>
                    <span className="font-medium">{fmtMoney(calc.makeReadyCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Shipping</span>
                    <span className="font-medium">{fmtMoney(calc.shippingCost)}</span>
                  </div>
                  <div className="my-2 border-t border-gray-200" />
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-semibold">{fmtMoney(calc.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Markup</span>
                    <span className="font-medium text-brand-600">+{fmtMoney(calc.markupAmount)}</span>
                  </div>
                  {calc.commissionAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Commission ({form.commissionPercent}%)</span>
                      <span className="font-medium text-amber-600">+{fmtMoney(calc.commissionAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sales Tax (7%)</span>
                    <span className="font-medium">+{fmtMoney(calc.salesTax)}</span>
                  </div>
                  <div className="my-2 border-t-2 border-gray-900" />
                  <div className="flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-lg font-bold text-brand-600">{fmtMoney(calc.total)}</span>
                  </div>
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Per Unit</span>
                      <span className="font-semibold">{fmtMoney(calc.costPerUnit)}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span className="text-gray-500">Per 1,000</span>
                      <span className="font-semibold">{fmtMoney(calc.costPer1000)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* VOLUME FORECASTING (for retail/recurring customers)   */}
        {/* ══════════════════════════════════════════════════════ */}
        {step >= 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-brand-600" />
                Volume Forecasting (Retail / Recurring Customers)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-500">For customers like retail packaging clients who order monthly — calculate annual pricing with volume discounts.</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Monthly Volume</label>
                  <Input type="number" placeholder="e.g. 25,000" value={form.monthlyVolume || ""} onChange={(e) => set("monthlyVolume", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Contract Length</label>
                  <Select value={form.contractMonths || "12"} onChange={(e) => set("contractMonths", e.target.value)} options={[
                    { value: "6", label: "6 Months" },
                    { value: "12", label: "12 Months (Annual)" },
                    { value: "24", label: "24 Months" },
                  ]} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Volume Discount %</label>
                  <Input type="number" placeholder="e.g. 8" value={form.volumeDiscount || ""} onChange={(e) => set("volumeDiscount", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Price Lock Period</label>
                  <Select value={form.priceLock || "12"} onChange={(e) => set("priceLock", e.target.value)} options={[
                    { value: "3", label: "3 Months" },
                    { value: "6", label: "6 Months" },
                    { value: "12", label: "12 Months" },
                  ]} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Print & Store Option</label>
                  <Select value={form.printAndStore || "monthly"} onChange={(e) => set("printAndStore", e.target.value)} options={[
                    { value: "monthly", label: "Print Monthly (standard)" },
                    { value: "quarterly", label: "Print Quarterly (lower per-unit)" },
                    { value: "annual", label: "Print Full Annual Run (lowest per-unit)" },
                  ]} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Warehousing Cost ($/month)</label>
                  <Input type="number" placeholder="e.g. 150" value={form.warehousingCost || ""} onChange={(e) => set("warehousingCost", e.target.value)} />
                </div>
              </div>

              {/* Forecasting Summary */}
              {form.monthlyVolume && parseInt(form.monthlyVolume) > 0 && calc.total > 0 && (
                <div className="mt-4 bg-brand-50 border border-brand-200 rounded-xl p-5">
                  <h4 className="font-bold text-brand-800 mb-3">Annual Forecast</h4>
                  {(() => {
                    const monthly = parseInt(form.monthlyVolume) || 0;
                    const months = parseInt(form.contractMonths || "12");
                    const annualQty = monthly * months;
                    const discountPct = parseFloat(form.volumeDiscount || "0") / 100;
                    const costPerUnit = calc.total / (form.quantity || 1);
                    const discountedPerUnit = costPerUnit * (1 - discountPct);
                    const monthlyRevenue = monthly * discountedPerUnit;
                    const annualRevenue = annualQty * discountedPerUnit;
                    const warehousing = parseFloat(form.warehousingCost || "0") * months;
                    const printStrategy = form.printAndStore || "monthly";
                    const runsPerYear = printStrategy === "monthly" ? months : printStrategy === "quarterly" ? Math.ceil(months / 3) : 1;
                    const setupSavings = (months - runsPerYear) * ((Number(form.makeReadySheets) || 500) * ((Number(form.paperCostPer1000) || 50) / 1000));

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Annual Quantity</p><p className="text-xl font-bold text-gray-900">{annualQty.toLocaleString()}</p></div>
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Discounted Per-Unit</p><p className="text-xl font-bold text-brand-700">{formatCurrency(discountedPerUnit)}</p><p className="text-xs text-gray-400">was {formatCurrency(costPerUnit)}</p></div>
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Monthly Revenue</p><p className="text-xl font-bold text-gray-900">{formatCurrency(monthlyRevenue)}</p></div>
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Annual Revenue</p><p className="text-xl font-bold text-emerald-700">{formatCurrency(annualRevenue)}</p></div>
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Print Runs/Year</p><p className="text-xl font-bold text-gray-900">{runsPerYear}</p><p className="text-xs text-gray-400">{printStrategy} schedule</p></div>
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Setup Savings</p><p className="text-xl font-bold text-emerald-700">{formatCurrency(setupSavings)}</p><p className="text-xs text-gray-400">fewer make-readies</p></div>
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Warehousing Cost</p><p className="text-xl font-bold text-amber-700">{formatCurrency(warehousing)}</p><p className="text-xs text-gray-400">{months} months</p></div>
                        <div className="bg-white rounded-lg p-3 border"><p className="text-xs text-gray-500">Net Annual Value</p><p className="text-xl font-bold text-brand-800">{formatCurrency(annualRevenue - warehousing)}</p></div>

                        {/* Volume Discount Tiers */}
                        <div className="col-span-full bg-white rounded-lg p-3 border">
                          <p className="text-xs text-gray-500 font-medium mb-2">Volume Discount Tiers (suggested)</p>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div className="bg-gray-50 rounded p-2 text-center"><p className="font-bold">100K+/yr</p><p className="text-brand-600">5% off</p><p>{formatCurrency(costPerUnit * 0.95)}/unit</p></div>
                            <div className="bg-gray-50 rounded p-2 text-center"><p className="font-bold">250K+/yr</p><p className="text-brand-600">8% off</p><p>{formatCurrency(costPerUnit * 0.92)}/unit</p></div>
                            <div className="bg-gray-50 rounded p-2 text-center"><p className="font-bold">500K+/yr</p><p className="text-brand-600">12% off</p><p>{formatCurrency(costPerUnit * 0.88)}/unit</p></div>
                            <div className="bg-emerald-50 rounded p-2 text-center"><p className="font-bold">1M+/yr</p><p className="text-emerald-600">15% off</p><p>{formatCurrency(costPerUnit * 0.85)}/unit</p></div>
                          </div>
                        </div>

                        <div className="col-span-full bg-blue-50 rounded-lg p-3 border border-blue-200">
                          <p className="text-xs font-medium text-blue-800">Price Lock: Pricing locked for {form.priceLock || "12"} months from contract start. Paper cost fluctuations absorbed by C&D during lock period.</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
