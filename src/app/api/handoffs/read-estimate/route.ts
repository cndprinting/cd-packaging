import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readEstimate } from "@/lib/estimate-reader";

// AI reads Mary's estimate for the handoff / new-job form (Benjy 11/17).
// POST { base64?, mediaType?, text? } -> { read, customerMatches }
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  if (!b.base64 && !b.text) return NextResponse.json({ error: "Attach the estimate (PDF or picture) or paste its text" }, { status: 400 });
  if (b.base64 && String(b.base64).length > 5_500_000) return NextResponse.json({ error: "That file is too big. Try a PDF under 4 MB." }, { status: 400 });
  const read = await readEstimate({ base64: b.base64, mediaType: b.mediaType, text: b.text });
  if (!read) return NextResponse.json({ error: "Couldn't read that estimate. Fill in the fields by hand, or try the PDF from E&M." }, { status: 422 });

  // Suggest the matching customer record so nobody retypes the name.
  let customerMatches: { id: string; name: string; email: string | null; contact: string | null; address: string | null }[] = [];
  const prisma = (await import("@/lib/prisma")).default;
  if (prisma && read.customerName) {
    const words = read.customerName.replace(/\b(inc|llc|corp|co|company|the)\b\.?/gi, " ").split(/[^A-Za-z0-9&']+/).filter((w) => w.length > 2).slice(0, 3);
    if (words.length) {
      const cos = await prisma.company.findMany({
        where: { type: "customer", isActive: true, AND: words.map((w) => ({ name: { contains: w, mode: "insensitive" as const } })) },
        select: { id: true, name: true, address: true, city: true, state: true, zip: true, contacts: { select: { name: true, email: true }, orderBy: { isPrimary: "desc" }, take: 2 } },
        take: 5,
      });
      customerMatches = cos.map((c) => ({ id: c.id, name: c.name, email: c.contacts.find((x) => x.email)?.email || null, contact: c.contacts[0]?.name || null, address: [c.address, [c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join("\n") || null }));
    }
  }
  return NextResponse.json({ read, customerMatches });
}
