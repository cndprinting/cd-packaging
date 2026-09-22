import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generateTuckBox, toSVG, type TuckBoxSpec } from "@/lib/dieline/tuck-box";

// Dieline module v1 (Benjy 9/22 "yes go ahead now"): parametric straight /
// reverse tuck from L x W x D, plus a check of the existing die inventory so
// nobody orders a die C&D already owns. Geometry rules: src/lib/dieline.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const spec: TuckBoxSpec = {
    style: body.style === "RTE" ? "RTE" : "STE",
    L: num(body.L) ?? 0, W: num(body.W) ?? 0, D: num(body.D) ?? 0,
    tuck: num(body.tuck), dust: num(body.dust), comp: num(body.comp), glue: num(body.glue),
    tuckPanel: body.tuckPanel === "near" ? "near" : "far",
  };
  if (!spec.L || !spec.W || !spec.D) return NextResponse.json({ error: "L, W and D are required (inches)" }, { status: 400 });
  let die;
  try { die = generateTuckBox(spec); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "bad spec" }, { status: 400 }); }

  // existing dies of about this size (either dimension order), 1/16" slop
  let matches: unknown[] = [];
  try {
    const prisma = (await import("@/lib/prisma")).default;
    if (prisma) {
      const tol = 1 / 16;
      const dims = [spec.L, spec.W, spec.D];
      const rows = await prisma.cuttingDie.findMany({
        where: { isActive: true, length: { not: null }, width: { not: null }, height: { not: null } },
        select: { id: true, dieNumber: true, customerName: true, item: true, description: true, length: true, width: true, height: true, dielineUrl: true, dielineName: true },
        take: 3000,
      });
      const close = (a: number, b: number) => Math.abs(a - b) <= tol;
      matches = rows.filter((r) => {
        const d = [r.length as number, r.width as number, r.height as number];
        // same three numbers in any order
        const used = [false, false, false];
        return dims.every((v) => { const i = d.findIndex((x, k) => !used[k] && close(x, v)); if (i < 0) return false; used[i] = true; return true; });
      }).slice(0, 25);
    }
  } catch (e) { console.error("dieline inventory match failed", e); }

  const label = `${spec.style} ${spec.L} x ${spec.W} x ${spec.D}`;
  return NextResponse.json({
    spec: die.spec,
    flat: { width: Math.round(die.flat.width * 1000) / 1000, height: Math.round(die.flat.height * 1000) / 1000 },
    svg: toSVG(die, { title: `C&D Printing dieline ${label}` }),
    matches,
  });
}
