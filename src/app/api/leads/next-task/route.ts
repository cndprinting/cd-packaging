import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { refreshNextTask } from "@/lib/agent/next-task";

// On-demand recompute of a lead's next task from the rep's notes (the ↻ in the
// pipeline row). Notes POST also refreshes automatically.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const u = await prisma.user.findUnique({ where: { id: session.id }, select: { pipelineAccess: true } });
  if (!u?.pipelineAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const t = await refreshNextTask(prisma, id);
  if (!t) return NextResponse.json({ error: "Could not compute a next task right now" }, { status: 502 });
  return NextResponse.json({ nextTask: t.task || null, nextTaskKind: t.kind, nextTaskBasis: t.basis || null, nextTaskAt: new Date().toISOString() });
}
