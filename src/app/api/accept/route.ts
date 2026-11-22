import { NextRequest, NextResponse } from "next/server";
import { acceptQuote, acceptToken, acceptanceOf } from "@/lib/quote-accept";

// Public "accept this quote" endpoint. No login: the link in the customer's quote email carries
// the lead id and a token made for that lead only. See src/lib/quote-accept.ts.
export const maxDuration = 30;

async function find(id: string | null, t: string | null) {
  if (!id || !t || t !== acceptToken(id)) return { error: "This link is not valid. Please reply to our quote email or call 727-572-9999." as const };
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return { error: "We could not load your quote just now. Please try again shortly." as const };
  const lead = await prisma.lead.findUnique({ where: { id } });
  // Only a lead that has actually been quoted can be accepted.
  if (!lead || (!lead.agentQuote && !lead.agentQuoteMsgId)) return { error: "We could not find a quote for this link. Please reply to our email or call 727-572-9999." as const };
  return { prisma, lead };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const r = await find(q.get("id"), q.get("t"));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 404 });
  const { prisma, lead } = r;
  const done = await acceptanceOf(prisma, lead.id);
  return NextResponse.json({ quote: {
    company: lead.companyName, contactName: lead.contactName || "", product: (lead as any).productName || lead.productCategory || "",
    text: lead.agentQuote || "", hasPdf: !!lead.agentQuoteMsgId, accepted: !!done, acceptedAt: done?.createdAt || null,
  } });
}

export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Could not read the request" }, { status: 400 }); }
  const r = await find(b?.id ? String(b.id) : null, b?.t ? String(b.t) : null);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 404 });
  if (!b.authorized) return NextResponse.json({ error: "Please confirm you are authorized to place this order." }, { status: 400 });
  try {
    const out = await acceptQuote(r.prisma, r.lead, { name: b.name, option: b.option, po: b.po, note: b.note });
    return NextResponse.json({ ok: true, already: out.already });
  } catch (e) {
    console.error("[Godzilla ACCEPT] failed:", e);
    return NextResponse.json({ error: "We could not record that just now. Please reply to our quote email or call 727-572-9999." }, { status: 500 });
  }
}
