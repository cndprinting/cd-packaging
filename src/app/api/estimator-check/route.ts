import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClaude } from "@/lib/agent/claude";
import { HOUSE_RULES } from "@/lib/estimator-house-rules";
import { computeClassic, effectiveParts, type ClassicForm } from "@/lib/classic-estimate";

// SANITY CHECKER (Benjy 8/24, #3 of the Mary AI plan): before a quote
// saves, Claude reviews the keyed form against the house rules and flags
// what looks mis-keyed -- pointing at the FIELD, so "it doesn't work"
// becomes "fix makeready on Screen 7". Advisory only: the UI always lets
// the save through, and any API failure returns zero flags.

const CAN_USE = new Set([
  "OWNER", "GM", "ADMIN", "ESTIMATOR",
  "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "ACCOUNTING", "DIGITAL_PRESS", "CSR",
]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const claude = getClaude();
  if (!claude) return NextResponse.json({ flags: [] });
  try {
    const { form } = (await req.json()) as { form: ClassicForm };
    if (!form) return NextResponse.json({ flags: [] });
    const c: any = computeClassic(form, null);
    const parts = effectiveParts(form);

    // Compact, factual snapshot -- the model judges, the engine computed.
    const snapshot = {
      quantity: form.quantity, numParts: parts.length,
      jobTitle: form.jobTitle, jobType: form.jobType,
      commissionMode: form.commissionMode, commissionPct: form.commissionPct,
      prep: { designHours: form.designHours || 0, photoshopHours: form.photoshopHours || 0, typeOutputHrs: form.typeOutputHrs || 0 },
      sheetsOutOfParent: form.sheetsOutOfParent || 1, weightPerMSheets: form.weightPerMSheets || 0,
      outsideRows: (form.outsidePurchases || []).length, freight: form.freight || 0,
      markups: { paper: form.markupPaperPct, material: form.markupMaterialPct, outside: form.markupOutsidePct, labor: form.markupLaborPct },
      parts: parts.map((p, i) => ({
        name: p.partName || `part ${i + 1}`,
        colors: `${p.runColorsSide1 || 0}/${p.runColorsSide2 || 0}`,
        workAndTurn: !!p.workAndTurn, signatureRuns: p.signatureRuns || 1,
        pressRuns: (p.runs || []).length,
        makereadySheets: c.partCalcs?.[i]?.mrWasteSheets ?? 0,   // COMPUTED (0 in the manual field means auto -- QT-2026-086 false flag)
        washupHrs: Math.round(((c.partCalcs?.[i]?.washupHrs) || 0) * 100) / 100,
        runSpeedSph: p.runSpeedSph || 0,
        pricePerM: p.pricePerM || 0, numberUp: p.numberUp || 1, sheetsPerPiece: p.sheetsPerPiece || 1,
        noCutting: !!p.noCutting, noCartons: !!p.noCartons,
        cartons: c.partCalcs?.[i]?.cartonsUsed ?? 0, paperWeightPerM: p.weightPerMSheets || 0, binderyOperation: p.binderyOperation || 0,
      })),
      computed: {
        paperCost: Math.round(c.paperCost), paperLbs: Math.round(((c.orderSheets || 0) / 1000) * (form.weightPerMSheets || 0)),
        materialCost: Math.round(c.materialCost), laborCost: Math.round((c.prepLabor || 0) + (c.pressCost || 0) + (c.binderyCost || 0)),
        outsideCost: Math.round(c.outsideCost), plates: c.partCalcs?.reduce((t: number, x: any) => t + (x.plates || 0), 0),
        pressHrs: Math.round((c.partCalcs?.reduce((t: number, x: any) => t + (x.pressHrs || 0), 0) || 0) * 10) / 10,
        total: Math.round(c.total), perPiece: form.quantity ? Math.round((c.total / form.quantity) * 1000) / 1000 : 0,
      },
    };

    const msg = await claude.messages.create({
      model: "claude-opus-4-8", max_tokens: 500,
      system: `You are the pre-save checker for C&D Printing's estimator. Mary (30-year estimator) keyed a quote; flag anything that looks MIS-KEYED so she fixes the field instead of distrusting the system. Judge like an estimator, not a linter.
${HOUSE_RULES}

Return STRICT JSON: {"flags": ["...", ...]} with AT MOST 4 flags, each one short sentence naming the screen/field and why it looks off (e.g. "Makeready 100 sheets looks low for 4/4 -- the house rule says ~900 (Screen 7)"). Only flag things a print estimator would question: prep/design hours wildly out of scale for the quantity (QT-2026-084: 25 design hours on a 100-piece reprint priced $2,000 of phantom labor -- E&M had 0.3; anything over ~2 hrs on a reprint or over ~8 on new work deserves a flag), a press-sheet size smaller than a typical parent with sheetsOutOfParent still 1 (paper bills at full parent price), zero outside rows + zero freight on work that names dies/varnish/outside finishing, paper weight per M left at 0 on an offset job (cartons then count as zero and paper handling is wrong), washup hours far above ~0.1-0.3 for the unit count. makereadySheets in the snapshot is the COMPUTED figure -- never call it zero unless it is, zero/absurd speeds on offset work, makeready far off the 100/color/side+100/machine rule, missing cartons on heavy paper without No Cartons checked, commission 0 without intent, $0 paper on a printed job, per-piece price wildly off for the product. If it all looks reasonable return {"flags": []}. NEVER invent numbers -- use only the snapshot.`,
      messages: [{ role: "user", content: JSON.stringify(snapshot) }],
    });
    const textBlock = msg.content.find((b) => b.type === "text");
    const text = (textBlock && "text" in textBlock ? textBlock.text : "") || "{}";
    const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const flags = Array.isArray(parsed.flags) ? parsed.flags.slice(0, 4).map((f: unknown) => String(f).slice(0, 300)) : [];
    return NextResponse.json({ flags });
  } catch {
    return NextResponse.json({ flags: [] }); // advisory -- never block a save
  }
}
