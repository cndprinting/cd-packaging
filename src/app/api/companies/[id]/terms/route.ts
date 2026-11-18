import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { TERMS, TERMS_SET_ROLES, setCustomerTerms } from "@/lib/press-gate";

// A customer's payment terms (Benjy 11/18). Everyone on staff can see them;
// accounting and Customer Service set them.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const co = await prisma.company.findUnique({ where: { id }, select: { paymentTerms: true, paymentTermsBy: true, paymentTermsAt: true } as any }) as any;
  if (!co) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ terms: co.paymentTerms || null, by: co.paymentTermsBy || null, at: co.paymentTermsAt || null, options: TERMS, canEdit: TERMS_SET_ROLES.includes(session.role) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !TERMS_SET_ROLES.includes(session.role)) return NextResponse.json({ error: "Payment terms are set by accounting or Customer Service" }, { status: 403 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  if (!TERMS[b.terms]) return NextResponse.json({ error: "Unknown payment terms" }, { status: 400 });
  try {
    const co: any = await setCustomerTerms(prisma, id, b.terms, { name: session.name, role: session.role, email: session.email });
    return NextResponse.json({ terms: co.paymentTerms, by: co.paymentTermsBy, at: co.paymentTermsAt, options: TERMS, canEdit: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not save" }, { status: 400 });
  }
}
