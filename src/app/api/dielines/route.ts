import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { toSVG } from "@/lib/dieline/tuck-box";
import { generateCarton, STYLES } from "@/lib/dieline/carton";
import { parseSpec, findDies, type DieMatch } from "@/lib/dieline/shared";

// Dieline module (Benjy 9/22; Nitay 10/22 additions): parametric carton from
// L x W x D in seven styles, an exact-size check of the die inventory, and a
// near-match list (within 1") so a customer can be offered a die we already own.
export async function GET() {
  return NextResponse.json({ styles: STYLES });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const spec = parseSpec(body);
  if (!spec.L || !spec.W || !spec.D) return NextResponse.json({ error: "L, W and D are required (inches)" }, { status: 400 });
  let die;
  try { die = generateCarton(spec); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "bad spec" }, { status: 400 }); }

  let dies: { exact: DieMatch[]; near: DieMatch[]; unsized: number } = { exact: [], near: [], unsized: 0 };
  try { dies = await findDies([spec.L, spec.W, spec.D]); } catch (e) { console.error("dieline inventory match failed", e); }

  const info = STYLES.find((s) => s.code === spec.style)!;
  const label = `${spec.style} ${spec.L} x ${spec.W} x ${spec.D}`;
  return NextResponse.json({
    style: info,
    spec: die.spec,
    flat: { width: Math.round(die.flat.width * 1000) / 1000, height: Math.round(die.flat.height * 1000) / 1000 },
    svg: toSVG(die, { title: `C&D Printing dieline ${label}` }),
    matches: dies.exact, near: dies.near, unsized: dies.unsized,
  });
}
