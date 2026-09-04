import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClaude } from "@/lib/agent/claude";
import prisma from "@/lib/prisma";
import { HOUSE_RULES } from "@/lib/estimator-house-rules";

// ESTIMATOR ASSIST (Benjy 8/21: "Is there any AI we can layer into estimating
// to help Mary?"). Two modes on the classic estimator screen:
//
//   fill — Mary describes the job in plain English ("25,000 tri-fold
//          brochures, 8.5x11 finished from an 11x17 flat, 80# text, 4/4,
//          letter fold on the MBO") and Claude maps it onto the form fields.
//          She reviews what it set; nothing saves without her.
//   ask  — a question answered in the context of her CURRENT form ("why is
//          makeready 700 sheets?", "where do I put the die charge?").
//
// The model only ever returns a whitelisted field patch — it cannot invent
// fields, touch rates hidden behind the standards toggle, or save anything.

const CAN_USE = new Set([
  "OWNER", "GM", "ADMIN", "ESTIMATOR",
  "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "ACCOUNTING", "DIGITAL_PRESS", "CSR",
]);

// Job-spec fields the AI may set. Deliberately EXCLUDES every rate, speed,
// difficulty and $-figure — those are plant standards or Mary's judgment.
const JOB_FIELDS = new Set([
  // job level
  "customerName", "jobTitle", "quantity", "numParts", "instructions", "jobType",
  "quoteNotes", "cardSurchargePct",
  // part: what the piece IS
  "partName", "productKind", "finishedWidthIn", "finishedHeightIn",
  "flatWidthIn", "flatHeightIn", "boxWidthIn", "boxDepthIn", "boxHeightIn",
  "numPages", "stockDescription", "caliperBasisWeight",
  // paper geometry (not price)
  "sheetWidthRun", "sheetHeightRun", "sheetWidthOrder", "sheetHeightOrder",
  "numberUp", "sheetsPerPiece", "sheetsOutOfParent",
  // color
  "runColorsSide1", "runColorsSide2", "workAndTurn", "coatingType", "coatingIsSpot",
  // operations
  "binderyOperation", "foldTypeName", "folderConfig", "foldCount",
  "stitcherName", "dieNumber", "versions", "signatureRuns",
  "handOp1", "handOp2", "bandIn", "padIn", "wrapIn",
  "deliveryHrs", "dieCutHrs", "scorePerfHrs", "noCutting", "noCartons", "extraPlates", "foilHrs",
]);

function sanitizePatch(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!JOB_FIELDS.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (["handOp1", "handOp2"].includes(k)) {
      if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        out[k] = {
          description: String(o.description || ""),
          piecesPerHour: Number(o.piecesPerHour) || 0,
          pctOfQty: Number(o.pctOfQty) || 0,
          hours: Number(o.hours) || 0,
        };
      }
      continue;
    }
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 300);
  }
  return out;
}


export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const claude = getClaude();
  if (!claude) return NextResponse.json({ error: "AI is not configured on this environment." }, { status: 503 });

  try {
    const { mode, text, form, partIndex } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Nothing to work with — type the job or the question first." }, { status: 400 });
    }

    // Reference lists so the model picks REAL machines/folds/stocks by name.
    let folds: string[] = [], stocks: string[] = [], presses: string[] = [];
    try {
      if (prisma) {
        const p = prisma as any;
        const [f, c, m] = await Promise.all([
          p.foldType.findMany({ where: { isActive: true }, select: { name: true, machineName: true } }),
          p.paperCaliper.findMany({ where: { isActive: true }, select: { stockName: true } }),
          p.press.findMany({ where: { isActive: true }, select: { name: true, configs: { select: { name: true } } } }),
        ]);
        folds = f.map((x: any) => `${x.name} (${x.machineName})`);
        stocks = c.map((x: any) => x.stockName);
        presses = m.flatMap((x: any) => x.configs.map((cf: any) => `${x.name} / ${cf.name}`));
      }
    } catch { /* lists are a nice-to-have */ }

    const formBrief = JSON.stringify(form || {}, (k, v) => (typeof v === "number" && v === 0 ? undefined : v)).slice(0, 6000);

    if (mode === "ask") {
      const system = `You help Mary, C&D Printing's estimator, use the Godzilla classic estimator (a rebuild of her old E&M DOS system). Answer her question plainly in 2-4 short sentences, naming the exact screen and field when relevant. She is not technical; never mention JSON, APIs, or code. If the answer depends on her judgment (a rate, a difficulty), say so rather than inventing a number.
${HOUSE_RULES}`;
      const msg = await claude.messages.create({
        model: "claude-opus-4-8", max_tokens: 400, system,
        messages: [{ role: "user", content: `Her current form (nonzero fields): ${formBrief}\n\nActive part index: ${partIndex ?? 0}\n\nMary's question: ${text.slice(0, 2000)}` }],
      });
      const t: any = (msg.content || []).find((b: any) => b.type === "text");
      return NextResponse.json({ answer: (t?.text || "").trim() });
    }

    // mode === "fill"
    const system = `You translate a plain-English print job description into field values for C&D Printing's classic estimator, so Mary does not have to hunt for fields. Output ONLY compact JSON, no markdown fences:
{"job": {job-level fields}, "parts": [{fields for part 1}, {fields for part 2}, ...], "notes": ["short plain-English line per thing you set or assumed"], "missing": ["things she still must decide, one short line each"]}

Field names you may use (anything else is ignored):
job level: customerName, jobTitle, quantity, numParts, jobType, quoteNotes
per part: partName, productKind ("flat"|"box"), finishedWidthIn, finishedHeightIn, flatWidthIn, flatHeightIn, boxWidthIn, boxDepthIn, boxHeightIn, numPages, stockDescription, caliperBasisWeight, sheetWidthRun, sheetHeightRun, numberUp, sheetsPerPiece, sheetsOutOfParent, runColorsSide1, runColorsSide2, workAndTurn (bool), coatingType (""|"Gloss AQ"|"Matte AQ"|"Satin AQ"|"UV"|"Varnish"), coatingIsSpot (bool), binderyOperation (1 Flat, 2 Saddle, 3 Folded, 4 Perfect, 5 Multibind, 6 Plastic, 7 Case Bound), foldTypeName, folderConfig, stitcherName, dieNumber, versions, signatureRuns, handOp1/handOp2 ({description, hours}), dieCutHrs, scorePerfHrs

Rules:
- "4/4" means runColorsSide1: 4, runColorsSide2: 4. "4/0" means 4 and 0.
- A booklet/book: numPages from the description; saddle books use binderyOperation 2, perfect bound 4. A folded brochure uses 3 and a foldTypeName.
- Sizes are decimal inches. "8.5x11 finished from 11x17 flat" -> finishedWidthIn 8.5, finishedHeightIn 11, flatWidthIn 11, flatHeightIn 17.
- Pick fold types, presses and stocks ONLY from the lists provided; if nothing matches, leave it unset and add it to "missing".
- NEVER set rates, speeds, difficulties, waste counts, markups, or dollar amounts. If the description mentions a price or a die charge, put a reminder in "notes" instead.
- When the description is ambiguous, choose the common C&D reading, set it, and say so in "notes". Genuinely unknowable things go in "missing".
${HOUSE_RULES}

Available fold types: ${folds.join("; ") || "(none loaded)"}
Available stocks: ${stocks.slice(0, 60).join("; ") || "(none loaded)"}
Available press configs: ${presses.join("; ") || "(none loaded)"}`;

    const msg = await claude.messages.create({
      model: "claude-opus-4-8", max_tokens: 1500, system,
      messages: [{ role: "user", content: `Current form (nonzero fields, for context — only change what the description covers): ${formBrief}\n\nJob description: ${text.slice(0, 3000)}` }],
    });
    const t: any = (msg.content || []).find((b: any) => b.type === "text");
    let parsed: any = {};
    try {
      parsed = JSON.parse(String(t?.text || "{}").replace(/^```(json)?/m, "").replace(/```$/m, "").trim());
    } catch {
      return NextResponse.json({ error: "The AI answer didn't come back cleanly — try rephrasing the job." }, { status: 502 });
    }

    const job = sanitizePatch(parsed.job);
    const parts = Array.isArray(parsed.parts) ? parsed.parts.slice(0, 6).map(sanitizePatch) : [];
    const notes = Array.isArray(parsed.notes) ? parsed.notes.slice(0, 12).map((n: unknown) => String(n).slice(0, 200)) : [];
    const missing = Array.isArray(parsed.missing) ? parsed.missing.slice(0, 12).map((n: unknown) => String(n).slice(0, 200)) : [];
    return NextResponse.json({ job, parts, notes, missing });
  } catch (e) {
    console.error("[estimator-assist] failed", e);
    return NextResponse.json({ error: "The assistant hit a snag — try again." }, { status: 500 });
  }
}
