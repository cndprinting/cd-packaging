import { NextRequest, NextResponse } from "next/server";
import { CARD_SURCHARGE, remaining, round2 } from "@/lib/ar";

// Public pay page API, keyed by the invoice's unguessable payToken (no login,
// the thing PrintReach links did badly). GET = invoice summary, POST = Stripe
// Checkout for card (3% surcharge) or ACH bank transfer (no fee).
const pick = (inv: any) => ({ invoiceNumber: inv.invoiceNumber, customerName: inv.customerName, description: inv.description, subtotal: inv.subtotal, taxRate: inv.taxRate, taxAmount: inv.taxAmount, total: inv.total, depositAmount: inv.depositAmount, depositPercent: inv.depositPercent, depositPaid: inv.depositPaid, paidAmount: inv.paidAmount, remaining: remaining(inv), status: inv.status, dueDate: inv.dueDate, kind: inv.kind });

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const inv = await prisma.invoice.findUnique({ where: { payToken: token } });
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  return NextResponse.json({ invoice: pick(inv), ach: !!process.env.STRIPE_ACH_ENABLED });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || "");
  const method = body.method === "ach" ? "ach" : "card";
  const part = body.part === "deposit" ? "deposit" : "balance";
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "Online payment is not available right now. Call 727-572-9999 to pay by phone." }, { status: 400 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const inv = await prisma.invoice.findUnique({ where: { payToken: token } });
  if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  const rem = remaining(inv);
  if (rem <= 0) return NextResponse.json({ error: "This invoice is already paid" }, { status: 400 });
  const base = part === "deposit" && !inv.depositPaid && inv.depositAmount > 0 ? Math.min(inv.depositAmount, rem) : rem;
  const surcharge = method === "card" ? round2(base * CARD_SURCHARGE) : 0;
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key);
  const { origin } = new URL(request.url);
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: method === "ach" ? ["us_bank_account"] : ["card"],
      line_items: [{ price_data: { currency: "usd", product_data: { name: `${inv.invoiceNumber} · ${part === "deposit" ? `${inv.depositPercent}% deposit` : "Balance"} · ${inv.customerName}`, description: method === "card" ? `${base.toFixed(2)} + 3% card surcharge` : "Bank transfer, no fee" }, unit_amount: Math.round((base + surcharge) * 100) }, quantity: 1 }],
      mode: "payment",
      customer_email: inv.contactEmail || undefined,
      success_url: `${origin}/pay/${token}?paid=1`,
      cancel_url: `${origin}/pay/${token}`,
      metadata: { invoiceId: inv.id, paymentType: part, method, baseAmount: String(base) },
    });
    await prisma.invoice.update({ where: { id: inv.id }, data: { stripeSessionId: session.id } });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = (e as Error).message || "";
    if (method === "ach" && /us_bank_account|payment method type/i.test(msg)) return NextResponse.json({ error: "Bank transfer is not enabled yet. Please pay by card or call 727-572-9999." }, { status: 400 });
    console.error("[pay]", msg);
    return NextResponse.json({ error: "Could not start the payment: " + msg.slice(0, 120) }, { status: 500 });
  }
}
