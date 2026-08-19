// BATCH VALIDATOR — map every catalogued E&M part into the Godzilla engine
// and diff the printed numbers. Answers "how close are all 36?" in one run.
// Run: npx tsx validation/batch-validate.ts [--verbose]
import fs from "fs";
import path from "path";
import {
  defaultClassicForm, defaultClassicPart, computeClassic,
  type ClassicForm, type ClassicPart,
} from "../src/lib/classic-estimate";

type Any = Record<string, any>;
const cat: Any[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "mary-quotes", "catalog.json"), "utf-8")
);

const num = (v: any): number => {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
};
const dims = (s: any): [number, number] => {
  const m = String(s || "").match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : [0, 0];
};
// "5/5", "4/0", "3 Color(s)", "2/0 K & PMS"
const colors = (s: any): [number, number] => {
  const t = String(s || "");
  const slash = t.match(/(\d+)\s*\/\s*(\d+)/);
  if (slash) return [parseInt(slash[1]), parseInt(slash[2])];
  const one = t.match(/(\d+)\s*Color/i);
  if (one) return [parseInt(one[1]), 0];
  return [0, 0];
};
const pressRate = (cfg: any): number => {
  const c = String(cfg || "").toUpperCase();
  if (c.includes("LED")) return 215;      // seed: KOMII 215 + 0
  if (c.includes("KOM")) return 185;      // seed: KOMII 215 - 30
  if (c.includes("SMALL")) return 33.35;
  return 0;                                // MILLER / Phantom carriers
};
const isPhantom = (cfg: any) => /phantom|miller/i.test(String(cfg || ""));

function buildPart(p: Any, isFirst: boolean, qtyForPart: number, jobText = ""): ClassicPart {
  const part = defaultClassicPart() as Any;
  const pa = p.paper || {}, pr = p.press || {}, rp = p.runPlan || {}, pe = p.prep || {};
  const [pw, ph] = dims(pa.parentSize);
  const [c1, c2] = colors(pr.colors);
  const style = String(rp.workStyle || "");

  part.pricePerM = num(pa.pricePerM);
  part.weightPerMSheets = num(String(pa.weightPerM || "").replace(/M/i, ""));
  part.sheetWidthRun = pw; part.sheetHeightRun = ph;
  part.caliperBasisWeight = String(pa.lb || "");
  // E&M buys PARENT sheets but counts makeready/waste in PRESS sheets, so the
  // two are different units. It prints both facts we need: "minimum count" is
  // the net press-sheet count, and pressSheetsOutOfParent is the split.
  part.sheetsOutOfParent = Math.max(1, num(rp.pressSheetsOutOfParent) || 1);
  const netSheets = num(rp.minimumCount) > 0
    ? num(rp.minimumCount)
    : Math.max(0, (num(pa.sheets) * part.sheetsOutOfParent) - num(rp.makeready) - num(rp.pressWaste) - num(rp.bindWaste));
  if (netSheets > 0 && qtyForPart > 0) {
    if (netSheets >= qtyForPart) {
      part.sheetsPerPiece = Math.max(1, Math.round(netSheets / qtyForPart));
      part.numberUp = 1;
    } else {
      part.numberUp = Math.max(1, Math.round(qtyForPart / netSheets));
      part.sheetsPerPiece = 1;
    }
  }
  part.bindWasteSheets = num(rp.bindWaste);
  part.runColorsSide1 = c1; part.runColorsSide2 = c2;
  part.workAndTurn = /work\s*&?\s*(turn|tumble)/i.test(style);
  // Derive signature runs from E&M's PRINTED plate count rather than the
  // "Run N" text: sheetsPerPiece above already folds in the signatures, so
  // trusting the text would double-count the run hours.
  const printedPlates = num(pe.plates);
  const sidesUsed = (c1 > 0 ? 1 : 0) + (c2 > 0 && !part.workAndTurn ? 1 : 0);
  const platesPerRun = Math.max(1, (part.workAndTurn ? Math.max(c1, c2) : c1 + c2));
  part.signatureRuns = printedPlates > 0 && platesPerRun > 0
    ? Math.max(1, Math.round(printedPlates / platesPerRun))
    : 1;
  void sidesUsed;
  part.runSpeedSph = num(pr.sph);
  part.useSpeedCurve = false;
  part.pressHourlyRate = pressRate(pr.config);
  part.plateCostEach = num(pe.plates) > 0 ? num(pe.plateCost) / num(pe.plates) : 19;
  // E&M's printed makeready is authoritative (no formula fits it - 8/18)
  part.wasteSheetsManual = num(rp.makeready);
  part.runWastePct = num(rp.pressWaste) > 0 && num(pa.sheets) > 0
    ? (num(rp.pressWaste) / num(pa.sheets)) * 100 : 0;
  part.paperBuyRounding = 10;
  part.cartonCost = 0.93;   // E&M carton material, derived from #348352 (396.18/426)
  // coating: E&M names it in the colors text ("+ 1 varnish", "AQ", "matte")
  const ctxt = [pr.colors, p.name, rp.workStyle, pr.config, jobText].map((x) => String(x || "")).join(" ");
  if (/varnish/i.test(ctxt)) part.coatingType = "Varnish";
  else if (/matte\s*aq/i.test(ctxt)) part.coatingType = "Matte AQ";
  else if (/aq|aqueous/i.test(ctxt)) part.coatingType = "Gloss AQ";
  if (/spot/i.test(ctxt)) part.coatingIsSpot = true;
  part.makereadyDiff = 0.3;
  part.washupHrsPerUnit = 0;
  part.inkDollarsPerLb = 10.84; part.inkBlackDollarsPerLb = 10.84;
  part.inkPmsDollarsPerLb = 39.5;
  if (isPhantom(pr.config)) {
    // Carrier press: the printing is bought outside. No press labor, and no
    // plates -- charging plate material/labor here was inflating every
    // digital job.
    part.pressSetupHrs = 0; part.pressHourlyRate = 0;
    part.plateCostEach = 0; part.plateHrsPerPlate = 0;
    part.baseMakereadyHrsPerPlate = 0;
  }
  if (num(pe.plates) === 0) { part.plateCostEach = 0; part.plateHrsPerPlate = 0; }
  // bindery lines -> hours at their own rates
  for (const b of (p.bindery || [])) {
    const op = String(b.op || "").toLowerCase();
    const h = num(b.hrs);
    if (op.includes("load cutter")) {
      // E&M prints the lift count; feed it to the lifts model
      const lm = String(b.op || "").match(/(\d+)\s*lift/i) || String(b.note || "").match(/(\d+)\s*lift/i);
      if (lm) part.cutterLifts = parseInt(lm[1]);
      else part.cutterHrsManual = h;
      const cost = num(b.cost);
      if (lm && cost > 0) {
        const lifts = parseInt(lm[1]);
        part.cutterDiff = Math.round((cost / (lifts * 0.0146 * 45)) * 10) / 10 || 1.2;
      }
    }
    else if (op.includes("trim")) part.trimHrs = h;
    else if (op.includes("hand bind")) {
      // E&M's flat hand-bindery tokens carry the real op name
      if (!part.handOp1?.description) part.handOp1 = { description: b.op, piecesPerHour: 0, pctOfQty: 0, hours: h };
      else part.handOp2 = { description: b.op, piecesPerHour: 0, pctOfQty: 0, hours: h };
    }
    else if (op.includes("deliver")) part.deliveryHrs = h;
    else if (op.includes("fold setup")) part.foldSetupHrs = h;
    else if (op.includes("folding")) part.foldRunHrs = h;
    else if (op.includes("saddle") && op.includes("setup")) part.stitchSetupHrs = h;
    else if (op.includes("mueller") || (op.includes("saddle") && !op.includes("setup"))) part.stitchRunHrs = h;
    else if (op.includes("ctn pack")) { part.packHrs = h; }
    else if (op.includes("pad")) part.padHrs = h;
    else if (op.includes("wrap")) part.wrapHrs = h;
  }
  void isFirst;
  return part as ClassicPart;
}

let exact = 0, within1 = 0, within5 = 0, scored = 0, unscored = 0;
const rows: string[] = [];

for (const e of cat) {
  let parts: Any[] = e.parts || [];
  if (!parts.length) { unscored++; continue; }
  const qtys: Any[] = e.quantities || [];
  const qty = num(qtys[0]?.qty);
  const emTotal = num(qtys[0]?.price);
  // Multi-quantity estimates repeat the SAME parts once per price break
  // ("Qty 50 - Part 1 of 1", "Qty 100 - Part 1 of 1"). Those are tiers, not
  // parts -- keep only the ones belonging to the quantity we are scoring.
  const tagged = parts.filter((p) => /^\s*Qty\s/i.test(String(p.name || "")));
  if (tagged.length) {
    const want = qty.toLocaleString("en-US");
    const wantPlain = String(qty);
    const mine = parts.filter((p) => {
      const n = String(p.name || "");
      return n.includes(want) || n.includes(wantPlain);
    });
    if (mine.length) parts = mine;
    else {
      const firstQty = String(parts[0].name || "").match(/Qty\s+([\d,]+)/i)?.[1];
      parts = firstQty ? parts.filter((p) => String(p.name || "").includes(firstQty)) : parts;
    }
  }
  if (!qty || !emTotal) { unscored++; continue; }

  const form = defaultClassicForm() as Any;
  form.quantity = qty;
  form.numParts = parts.length;
  form.prepressRate = 60;
  // Prep is PER PART in E&M but job-level in the engine -> sum across parts.
  let designHrs = 0, proofHrs = 0, proofMaterial = 0;
  for (const p of parts) {
    const pe = p.prep || {};
    designHrs += num(pe.designHrs) + num(pe.typeOutputHrs);
    proofHrs += num(pe.proofHrs);
    proofMaterial += num(pe.proofMaterial);
  }
  form.designHours = designHrs + proofHrs;
  if (proofMaterial > 0) { form.colorProofs = 1; form.colorProofCharge = proofMaterial; }
  form.commissionPct = num(parts[0]?.markups?.commissionPct) || 10;
  form.markupPaperPct = num(parts[0]?.markups?.paper?.pct) || 33;
  form.markupMaterialPct = num(parts[0]?.markups?.material?.pct) || 18;
  form.markupOutsidePct = num(parts[0]?.markups?.outside?.pct) || 32;
  form.markupLaborPct = num(parts[0]?.markups?.labor?.pct) || 40;

  // part 1 lives flat on the form
  const jobText = [e.description, e.binding, e.anythingUnusual].map((x: any) => String(x || "")).join(" ");
  Object.assign(form, buildPart(parts[0], true, qty, jobText));
  form.parts = parts.slice(1).map((p) => buildPart(p, false, qty, jobText));

  // outside purchases: sum the printed outside cost per part
  let outside = 0;
  for (const p of parts) {
    const o = p.markups?.outside?.cost;
    if (o != null) outside += num(o);
    else if (typeof p.outsidePurchases === "string") outside += num(p.outsidePurchases);
  }
  if (outside > 0) form.outsidePurchases = [{ description: "E&M outside", amount: outside }];

  let gz = 0;
  try { gz = (computeClassic(form as ClassicForm, null) as Any).total || 0; }
  catch { unscored++; continue; }

  if (process.argv.includes("--debug") && String(e.estimateNo) === process.argv[process.argv.indexOf("--debug")+1]) {
    const k: Any = computeClassic(form as ClassicForm, null);
    console.log("DEBUG", e.estimateNo);
    console.log("  paper   ", k.paperCost?.toFixed(2), " material", k.materialCost?.toFixed(2));
    console.log("  prep lab", k.prepLabor?.toFixed(2), " press", k.pressCost?.toFixed(2), " bind", k.binderyCost?.toFixed(2));
    console.log("  outside ", k.outsideCost?.toFixed(2), " (mapped", outside.toFixed(2), ")");
    console.log("  totalCost", k.totalCost?.toFixed(2), " commission", k.commission?.toFixed(2), " TOTAL", k.total?.toFixed(2));
    console.log("  E&M part costs:", parts.map((x:Any)=>x.partTotal).join(" + "), "= expected", emTotal);
  }
  const pct = emTotal ? ((gz - emTotal) / emTotal) * 100 : 0;
  scored++;
  if (Math.abs(pct) <= 0.5) exact++;
  if (Math.abs(pct) <= 1) within1++;
  if (Math.abs(pct) <= 5) within5++;
  const flag = Math.abs(pct) <= 1 ? "✅" : Math.abs(pct) <= 5 ? "🟡" : Math.abs(pct) <= 15 ? "🟠" : "🔴";
  rows.push(
    `${flag} ${String(e.estimateNo).padEnd(8)}${String(e.productType || "").slice(0, 15).padEnd(16)}` +
    `${String(parts.length)}p  qty ${String(qty).padStart(7)}  ` +
    `E&M ${emTotal.toFixed(0).padStart(8)}  GZ ${gz.toFixed(0).padStart(8)}  ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`
  );
}

rows.sort();
console.log("BATCH VALIDATION — all catalogued E&M estimates vs Godzilla\n");
console.log(rows.join("\n"));
console.log(`\nscored ${scored}   (skipped ${unscored} — no qty/price/parts)`);
console.log(`within 0.5%: ${exact}    within 1%: ${within1}    within 5%: ${within5}`);
