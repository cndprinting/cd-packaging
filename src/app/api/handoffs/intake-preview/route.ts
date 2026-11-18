import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { handleNewJobEmail } from "@/lib/estimate-intake";

// Owner-only dry run of the forwarded-estimate intake: shows exactly what a
// "New job" email to Jessica would put in the CSR queue. Saves nothing, emails
// no one. POST { from, subject, note, estimateText }
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json().catch(() => ({}));
  const note = String(b.note || ""), est = String(b.estimateText || "");
  const m = { id: "preview", internetMessageId: `preview-${Date.now()}`, subject: String(b.subject || "New job"), from: { emailAddress: { address: String(b.from || session.email) } }, hasAttachments: false, bodyPreview: `${note}\n\n---------- Forwarded message ----------\n${est}` };
  // A stand-in mail client that serves this pasted email instead of Graph.
  const client = { api: () => ({ header: () => ({ select: () => ({ get: async () => ({ body: { content: m.bodyPreview }, uniqueBody: { content: note } }) }) }), patch: async () => ({}) }) };
  let out: any = null;
  const handled = await handleNewJobEmail(prisma, client, m, "preview@cndprinting.com", { notify: false, preview: (d) => { out = d; } });
  if (!handled) return NextResponse.json({ handled: false, reason: "Not treated as a job intake (subject must say New job, sender must be an active C&D sales/CSR/owner user), or the AI could not read it." });
  return NextResponse.json({ handled: true, wouldCreate: out });
}
