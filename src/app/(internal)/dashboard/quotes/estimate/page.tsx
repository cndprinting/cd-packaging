"use client";

import { useState, useMemo, useEffect } from "react";
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
  // Proofs
  proofSherpa2: number;
  proofSherpa43: number;
  proofDylux: number;
  proofMatchprint: number;
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
  // Outside purchases
  outsidePurchases: { description: string; cost: number }[];
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
  // Volume Forecasting
  monthlyVolume: string;
  contractMonths: string;
  volumeDiscount: string;
  priceLock: string;
  printAndStore: string;
  warehousingCost: string;
  [key: string]: string | number | boolean | number[] | { description: string; cost: number }[]; // allow dynamic field access
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
  outsidePurchases: [] as { description: string; cost: number }[],
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
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
  }, []);

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
      const sheetsNeeded = q * v;
      materialsCost = sheetsNeeded * num("substrateCostPerSheet");
      const impressionCost = sheetsNeeded * num("clickCharge");
      materialsCost += impressionCost;
      const dieCutMinutes = sheetsNeeded * num("digitalDieCuttingTime");
      finishingCost = (dieCutMinutes / 60) * num("digitalCutterRate") + num("digitalCoatingCost");
      if (form.variableData) {
        finishingCost += num("vdpComplexitySurcharge");
      }
    } else if (isCommOffset) {
      const totalColors = num("inkColorsFront") + num("inkColorsBack");
      const sheetsNeeded = Math.ceil((q * v) / 1);
      const paperCost = (sheetsNeeded / 1000) * num("commPaperCostPer1000");
      const coverageMultiplier = num("inkCoveragePercent") / 100;
      const inkCost = num("commInkCost") * totalColors * coverageMultiplier;
      materialsCost = paperCost + inkCost;
      toolingCost = num("plateCostEach") * totalColors;
      finishingCost =
        num("foldingCost") +
        num("saddleStitchCost") +
        num("perfectBindingCost") +
        num("trimCost") +
        num("binderySetupHours") * num("binderyRate");
      makeReadyCost = (500 / 1000) * num("commPaperCostPer1000");
    } else if (isCommDigital) {
      const sheetsNeeded = q * v;
      materialsCost = sheetsNeeded * num("commDigitalClickCharge") + num("digitalPaperCost") * (sheetsNeeded / 1000);
      const rushMultiplier = 1 + num("rushSurchargePercent") / 100;
      materialsCost *= rushMultiplier;
      finishingCost = num("simpleFinishingCost") + num("personalizationSurcharge");
    }

    const laborCost =
      num("pressRunTime") * num("pressOperatorRate") +
      num("prepressTime") * num("prepressRate") +
      num("setupTime") * num("pressOperatorRate");

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
      const usageRates: Record<string, number> = {
        gloss_aq: 0.0000079, satin_aq: 0.0000079, matte_aq: 0.0000079,
        soft_touch: 0.0000075, led_uv: 0.0000075, retic_coating: 0.0000079, retic_varnish: 0.00000094,
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

    // 4-category markup from plant standards
    const paperMarkup = materialsCost * (num("markupPaper") / 100);
    const materialMarkup = toolingCost * (num("markupMaterial") / 100);
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
        productType: form.productType,
        productName: form.jobName,
        description: `${form.productType === "FOLDING_CARTON" ? "Folding Carton" : "Commercial Print"} - ${form.pressType === "OFFSET" ? "Offset" : "Digital"}${selectedPress ? ` (${selectedPress.name})` : ""} | ${form.finishedWidth}" x ${form.finishedHeight}"`,
        quantity: String(form.quantity),
        unitPrice: String(calc.costPerUnit.toFixed(4)),
        estimateData: form,
        estimateTotals: calc,
        specs: JSON.stringify({
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
        }),
      };
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
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
                options={employees.filter(e => e.role === "SALES_REP" || e.role === "ADMIN").map(e => ({ id: e.id, label: e.name, subtitle: e.role.replace(/_/g, " ") }))}
                placeholder="Select sales rep..."
              />
            </Field>
            <Field label="CSR">
              <Combobox
                value={form.csrName as string || ""}
                onChange={(_id, label) => set("csrName" as keyof FormState, label)}
                options={employees.filter(e => e.role === "CSR" || e.role === "ADMIN" || e.role === "PRODUCTION_MANAGER").map(e => ({ id: e.id, label: e.name, subtitle: e.role.replace(/_/g, " ") }))}
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

          {/* Quantity Tiers */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Additional Quantity Tiers</p>
              <button
                type="button"
                onClick={() => setForm(p => ({ ...p, quantityTiers: [...p.quantityTiers, 0] }))}
                className="text-xs font-medium text-brand-600 hover:text-brand-800"
              >
                + Add Tier
              </button>
            </div>
            {form.quantityTiers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {form.quantityTiers.map((tier, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={tier || ""}
                      onChange={(e) => {
                        const newTiers = [...form.quantityTiers];
                        newTiers[i] = Number(e.target.value);
                        setForm(p => ({ ...p, quantityTiers: newTiers }));
                      }}
                      placeholder="Qty"
                      className="w-28 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setForm(p => ({ ...p, quantityTiers: p.quantityTiers.filter((_, j) => j !== i) }))}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {form.quantityTiers.length === 0 && (
              <p className="text-xs text-gray-400">Add tiers to compare pricing at different volumes.</p>
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
                  set("selectedConfigId", "");
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
            {selectedPress && selectedPress.configurations.length > 0 && (
              <Field label="Configuration" hint="Press color/coating setup">
                <Select
                  value={form.selectedConfigId}
                  onChange={(e) => set("selectedConfigId", e.target.value)}
                  options={[
                    { value: "", label: "— Select Config —" },
                    ...selectedPress.configurations.map((c) => ({
                      value: c.id,
                      label: `${c.name} (${c.numColors}C, $${(selectedPress.costPerHour + c.addToHourlyRate).toFixed(0)}/hr)`,
                    })),
                  ]}
                />
              </Field>
            )}
            <Field label="Stock Type" hint="Affects waste rates and ink coverage">
              <Select
                value={form.stockType}
                onChange={(e) => set("stockType", e.target.value as "coated" | "uncoated")}
                options={[
                  { value: "uncoated", label: "Uncoated" },
                  { value: "coated", label: "Coated" },
                ]}
              />
            </Field>
            <Field label="Paper Stock" hint="Search from inventory" className="sm:col-span-2">
              <Combobox
                value={form.stockDescription as string || ""}
                onChange={(_id, label) => set("stockDescription" as keyof FormState, label)}
                options={materialsList.map(m => ({ id: m.id, label: m.name, subtitle: m.sku || undefined }))}
                placeholder="Search paper stock..."
                allowCreate
              />
            </Field>
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
              <Field label="Die-Cutting Plate Cost ($)">
                <Input type="number" step="0.01" value={form.dieCuttingPlateCost || ""} onChange={(e) => set("dieCuttingPlateCost", Number(e.target.value))} />
              </Field>
              <Field label="Make-Ready Sheets" hint="Waste for ink balance + die registration">
                <Input type="number" value={form.makeReadySheets || ""} onChange={(e) => set("makeReadySheets", Number(e.target.value))} />
              </Field>
            </div>
          </Section>

          <Section title="Paper & Ink" icon={Droplets}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
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
                <Field label="Colors (Back)">
                  <Input type="number" value={form.inkColorsBack || ""} onChange={(e) => set("inkColorsBack", Number(e.target.value))} min={0} max={8} />
                </Field>
                <Field label="Ink Cost ($/lb)">
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

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Coating</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Specialty Coating">
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
                <Field label="Coating Cost ($ per 1000)">
                  <Input type="number" step="0.01" value={form.coatingCostPer1000 || ""} onChange={(e) => set("coatingCostPer1000", Number(e.target.value))} />
                </Field>
              </div>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Proofs</p>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field label="Sherpa2">
                  <Input type="number" value={form.proofSherpa2 || ""} onChange={(e) => set("proofSherpa2", Number(e.target.value))} min={0} />
                </Field>
                <Field label="Sherpa43">
                  <Input type="number" value={form.proofSherpa43 || ""} onChange={(e) => set("proofSherpa43", Number(e.target.value))} min={0} />
                </Field>
                <Field label="Dylux">
                  <Input type="number" value={form.proofDylux || ""} onChange={(e) => set("proofDylux", Number(e.target.value))} min={0} />
                </Field>
                <Field label="Matchprint">
                  <Input type="number" value={form.proofMatchprint || ""} onChange={(e) => set("proofMatchprint", Number(e.target.value))} min={0} />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Finishing & Bindery" icon={Scissors}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Gluing Setup ($)">
                <Input type="number" step="0.01" value={form.gluingSetup || ""} onChange={(e) => set("gluingSetup", Number(e.target.value))} />
              </Field>
              <Field label="Window Patching ($)">
                <Input type="number" step="0.01" value={form.windowPatching || ""} onChange={(e) => set("windowPatching", Number(e.target.value))} />
              </Field>
              <Field label="Cutting Difficulty" hint="1.0 = normal">
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

          {/* Outside Purchases */}
          <Section title="Outside Purchases" icon={Truck} defaultOpen={false}>
            <div className="space-y-2">
              {(form.outsidePurchases as { description: string; cost: number }[]).map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={op.description}
                    onChange={(e) => {
                      const newOps = [...(form.outsidePurchases as { description: string; cost: number }[])];
                      newOps[i] = { ...newOps[i], description: e.target.value };
                      set("outsidePurchases" as keyof FormState, newOps as any);
                    }}
                    placeholder="Description (e.g. Softtouch)"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    value={op.cost || ""}
                    onChange={(e) => {
                      const newOps = [...(form.outsidePurchases as { description: string; cost: number }[])];
                      newOps[i] = { ...newOps[i], cost: Number(e.target.value) };
                      set("outsidePurchases" as keyof FormState, newOps as any);
                    }}
                    placeholder="Cost ($)"
                    className="w-32"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newOps = (form.outsidePurchases as { description: string; cost: number }[]).filter((_, j) => j !== i);
                      set("outsidePurchases" as keyof FormState, newOps as any);
                    }}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const newOps = [...(form.outsidePurchases as { description: string; cost: number }[]), { description: "", cost: 0 }];
                  set("outsidePurchases" as keyof FormState, newOps as any);
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Click Charge / Impression ($)">
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

      {/* ── Mailing & Coatings (Outside Services) ───────────────── */}
      <Section title="Mailing & Coatings" icon={Truck} defaultOpen={false}>
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
          {form.coatingType !== "none" && (
            <>
              <Field label="Sheet Width (in)" hint="For coating coverage calc">
                <Input type="number" step="0.5" value={form.coatingSheetWidth || ""} onChange={(e) => set("coatingSheetWidth", Number(e.target.value))} />
              </Field>
              <Field label="Sheet Height (in)">
                <Input type="number" step="0.5" value={form.coatingSheetHeight || ""} onChange={(e) => set("coatingSheetHeight", Number(e.target.value))} />
              </Field>
              <Field label="Impressions" hint="Total sheets to coat">
                <Input type="number" value={form.coatingImpressions || ""} onChange={(e) => set("coatingImpressions", Number(e.target.value))} />
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

        <div className="mt-4 border-t border-gray-100 pt-4">
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
