import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";

// Paper Caliper Master + Fold Types (Mary 8/20). Two reference tables the
// estimator reads from and Mary maintains. Her rule: the table holds the
// DEFAULT caliper; a stock's actual mill caliper always wins.

export async function GET() {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) return NextResponse.json({ calipers: [], folds: [] });
  try {
    const [calipers, folds] = await Promise.all([
      (prisma as any).paperCaliper.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      (prisma as any).foldType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    ]);
    return NextResponse.json({ calipers, folds });
  } catch {
    return NextResponse.json({ calipers: [], folds: [] });
  }
}

// Mary maintains both tables herself — she wrote the spec, she owns the values.
const CAN_EDIT = new Set(["OWNER", "GM", "ADMIN", "ESTIMATOR", "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER"]);

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_EDIT.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  try {
    const body = await req.json();
    const { table, id, data } = body as { table: "caliper" | "fold"; id: string; data: Record<string, unknown> };
    if (!id || !table) return NextResponse.json({ error: "table and id are required" }, { status: 400 });

    // Only these columns are writable from the screen.
    const CAL_FIELDS = ["caliperMil", "scoreRequired", "foldable", "specialHandling", "paperCategory", "coating"];
    const FOLD_FIELDS = ["numFolds", "configuration", "machineName", "pockets", "setupMinutes",
      "speedPerHour", "scoringRequired", "minCaliperMil", "maxCaliperMil", "wasteSheets", "specialNotes"];
    const allowed = table === "caliper" ? CAL_FIELDS : FOLD_FIELDS;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in data) patch[k] = data[k];
    if (!Object.keys(patch).length) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

    const row = table === "caliper"
      ? await (prisma as any).paperCaliper.update({ where: { id }, data: patch })
      : await (prisma as any).foldType.update({ where: { id }, data: patch });
    return NextResponse.json({ row });
  } catch (e) {
    console.error("[paper-fold-tables] update failed", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
