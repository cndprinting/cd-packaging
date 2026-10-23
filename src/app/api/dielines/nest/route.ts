import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generateCarton } from "@/lib/dieline/carton";
import { planSheets, layoutSVG, layoutPDF, PRESS_MAX } from "@/lib/dieline/nest";
import { parseSpec } from "@/lib/dieline/shared";

// Sheet optimizer (Nitay 10/22): which press sheet, how many up, waste, and a
// pressman drawing. POST {style,L,W,D,...,qty, sheet?: "WxH", format?: "pdf"}.
export const maxDuration = 60;

async function boardSizesUsed(): Promise<{ w: number; h: number; from: string }[]> {
  // Sheets the plant actually buys (paper usage log), so the recommendation
  // favors stock that is already on the floor.
  try {
    const prisma = (await import("@/lib/prisma")).default;
    if (!prisma) return [];
    const rows = await prisma.paperUsage.groupBy({ by: ["size"], where: { stockType: { contains: "BOARD", mode: "insensitive" }, size: { not: null } }, _count: true });
    const out: { w: number; h: number; from: string }[] = [];
    for (const r of rows) {
      const m = String(r.size).match(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/);
      if (!m) continue;
      const w = Math.min(+m[1], +m[2]), h = Math.max(+m[1], +m[2]);
      if (w <= PRESS_MAX.w && h <= PRESS_MAX.h) out.push({ w, h, from: `board stock used ${r._count}x` });
      else if (w / 2 <= PRESS_MAX.w || h / 2 <= PRESS_MAX.h) {
        // parent sheet: cut in half along the long side
        const hw = Math.min(w, h / 2), hh = Math.max(w, h / 2);
        if (hw <= PRESS_MAX.w && hh <= PRESS_MAX.h) out.push({ w: hw, h: hh, from: `${w} x ${h} parent cut in half` });
      }
    }
    return out;
  } catch { return []; }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const spec = parseSpec(body);
  if (!spec.L || !spec.W || !spec.D) return NextResponse.json({ error: "L, W and D are required (inches)" }, { status: 400 });
  let die;
  try { die = generateCarton(spec); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "bad spec" }, { status: 400 }); }
  const qty = Math.max(0, Math.floor(Number(body.qty) || 0));
  const extra = await boardSizesUsed();
  const plans = planSheets(die.flat.width, die.flat.height, qty, extra);
  if (!plans.length) return NextResponse.json({ error: `The flat blank (${die.flat.width.toFixed(2)} x ${die.flat.height.toFixed(2)}) does not fit any sheet up to ${PRESS_MAX.w} x ${PRESS_MAX.h}` }, { status: 400 });
  const pick = body.sheet ? plans.find((p) => p.label === body.sheet) || plans[0] : plans[0];
  const flat = `${die.flat.width.toFixed(3)} x ${die.flat.height.toFixed(3)}`;
  const box = `${spec.L} x ${spec.W} x ${spec.D}`;

  if (body.format === "pdf") {
    const bytes = await layoutPDF(die, pick, { title: body.title || `Press layout ${spec.style} ${box}`, qty, style: spec.style, box, flat });
    return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="layout-${spec.style}-${box.replace(/\s/g, "")}-${pick.label.replace(/\s/g, "")}.pdf"` } });
  }
  return NextResponse.json({
    flat: { width: die.flat.width, height: die.flat.height },
    plans: plans.slice(0, 12).map(({ placed, ...p }) => ({ ...p, up: placed.length })),
    pick: { ...pick, placed: undefined },
    svg: layoutSVG(die, pick),
  });
}
