import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendRepEmail, TEMPLATES } from "@/lib/rep-email";

async function gate() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  const u = await prisma.user.findUnique({ where: { id: session.id }, select: { pipelineAccess: true } });
  if (!u?.pipelineAccess) return { error: "Forbidden", status: 403 as const };
  return { session, prisma };
}

// GET ?leadId= -> the lead's email thread (every rep's, newest last) + templates
export async function GET(request: NextRequest) {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const leadId = request.nextUrl.searchParams.get("leadId") || "";
  const emails = await g.prisma.leadEmail.findMany({ where: { leadId }, orderBy: { sentAt: "asc" }, select: { id: true, direction: true, fromAddr: true, toAddr: true, cc: true, subject: true, bodyText: true, userName: true, sentAt: true } });
  const attachments = await g.prisma.attachment.findMany({ where: { leadId }, select: { id: true, name: true, fileSize: true }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ emails, attachments, templates: TEMPLATES, me: { name: g.session.name, email: g.session.email, canSend: /@cndprinting\.com$/i.test(g.session.email) } });
}

// POST { leadId, to[], cc[], subject, bodyText, attachmentIds[] } -> sends as the signed-in rep
export async function POST(request: NextRequest) {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json().catch(() => ({}));
  const r = await sendRepEmail(g.prisma, { id: g.session.id, email: g.session.email, name: g.session.name || g.session.email }, {
    leadId: String(body.leadId || ""), to: Array.isArray(body.to) ? body.to.map(String) : String(body.to || "").split(/[,;]/), cc: Array.isArray(body.cc) ? body.cc.map(String) : String(body.cc || "").split(/[,;]/).filter(Boolean),
    subject: String(body.subject || ""), bodyText: String(body.bodyText || ""), attachmentIds: Array.isArray(body.attachmentIds) ? body.attachmentIds.map(String) : [],
  });
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ email: r.email });
}
