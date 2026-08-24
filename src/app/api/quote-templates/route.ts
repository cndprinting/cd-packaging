import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import templates from "@/data/quote-templates.json";

// The 45 hand-keyed, validated E&M quotes as clonable starting points
// (Benjy 8/24: "Start from a past quote" -- estimators think "this job is
// like that job"). Static JSON, exported by scripts/export-templates.ts.
const CAN_USE = new Set([
  "OWNER", "GM", "ADMIN", "ESTIMATOR",
  "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "ACCOUNTING", "DIGITAL_PRESS", "CSR",
]);

export async function GET() {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ templates });
}
