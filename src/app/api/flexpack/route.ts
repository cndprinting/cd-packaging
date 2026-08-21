import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";

// FlexPack reference data — film materials, structures, machine rates,
// outsourced pouch formats and click settings.
//
// Quotes are NOT stored here: a FlexPack quote saves into the main Quote
// table tagged specs.method = "flexpack", the same way the classic estimator
// tags its own, so it inherits the whole quote -> job flow (Benjy 8/20).
// Access: owners drive it, Mary can use it (Benjy 8/20 — flexible packaging is
// a different discipline from her offset work, so it must not depend on her).
const CAN_USE = new Set([
  "OWNER", "GM", "ADMIN", "ESTIMATOR",
  "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "ACCOUNTING",
]);

export async function GET() {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) return NextResponse.json({ materials: [], structures: [], machines: [], formats: [], settings: null });
  const p = prisma as any;
  try {
    const [materials, structures, machines, formats, settings] = await Promise.all([
      p.flexMaterial.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexStructure.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexMachine.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexPouchFormat.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexSettings.findUnique({ where: { id: "default" } }),
    ]);
    return NextResponse.json({ materials, structures, machines, formats, settings });
  } catch (e) {
    console.error("[flexpack] load failed", e);
    return NextResponse.json({ materials: [], structures: [], machines: [], formats: [], settings: null });
  }
}
