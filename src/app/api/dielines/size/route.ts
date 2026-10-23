import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClaude } from "@/lib/agent/claude";
import { STYLES } from "@/lib/dieline/carton";

// "Size it for me" (Nitay 10/22): the customer says "a box that fits 4 donuts"
// and we come back with inside dimensions, a carton style and the reasoning.
// The rep still confirms the real product before a die is cut.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ask = String(body.text || "").trim().slice(0, 1500);
  if (!ask) return NextResponse.json({ error: "Describe what goes in the box" }, { status: 400 });
  const claude = getClaude();
  if (!claude) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  const system = `You are the packaging engineer at C&D Printing & Packaging (folding cartons, St. Petersburg FL). A rep describes what a customer needs to pack; you size the carton.
Styles available (code: name, when to use, what L/W/D mean):
${STYLES.map((s) => `- ${s.code}: ${s.name} (${s.aka}). ${s.use} ${s.dims}.`).join("\n")}
Rules:
- Use typical real-world product dimensions when the customer gives none (a standard yeast donut is about 3.5 to 4 in across and 1.5 to 2 in tall; a 2 oz dropper bottle about 1.3 in dia x 3.9 in; a 60-count capsule bottle about 1.9 x 3.6 in; a 1 oz airless pump about 1.4 x 4.5 in; a 4 oz jar about 2.4 x 2.3 in; a cookie 2.5 to 3 in; a bar of soap 3.5 x 2.25 x 1 in). State every assumption.
- Choose the arrangement (e.g. 2 x 2 flat for donuts, upright single bottle) and add clearance: 1/8 in per side for rigid items, 1/4 in for soft or baked goods, plus 1/16 in for board thickness per wall.
- Round each inside dimension UP to the nearest 1/8 in.
- L is the printed front panel width (or tray length), W the box thickness (or tray width), D the height (or tray depth). For trays (RETF) D is the depth.
- Pick the style that fits the product and how it is packed. Prefer STE or RTE for upright retail items, RETF for food trays and kits, TTAB for heavy jars, SE for line-packed dry goods, SLV for wraps.
Return STRICT JSON only:
{"style":"STE|RTE|TTAB|TTSB|SE|SLV|RETF","L":number,"W":number,"D":number,"arrangement":"...","productSize":"...","assumptions":["..."],"reasoning":"2-3 sentences","alternatives":[{"style":"...","why":"..."}],"confidence":"high|medium|low","askCustomer":["questions to confirm before the die is cut"]}`;

  try {
    const r = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 1200, system, messages: [{ role: "user", content: ask }] });
    const text = r.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ error: "No sizing came back, try again" }, { status: 502 });
    const j = JSON.parse(m[0]);
    const style = STYLES.some((s) => s.code === j.style) ? j.style : "STE";
    const up8 = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.ceil(n * 8) / 8 : null; };
    const L = up8(j.L), W = up8(j.W), D = up8(j.D);
    if (!L || !W || !D) return NextResponse.json({ error: "Sizing came back incomplete, try again" }, { status: 502 });
    return NextResponse.json({ style, L, W, D, arrangement: j.arrangement || "", productSize: j.productSize || "", assumptions: j.assumptions || [], reasoning: j.reasoning || "", alternatives: j.alternatives || [], confidence: j.confidence || "medium", askCustomer: j.askCustomer || [] });
  } catch (e) {
    console.error("[dieline size]", (e as Error).message);
    return NextResponse.json({ error: "Sizing failed: " + (e as Error).message.slice(0, 160) }, { status: 502 });
  }
}
