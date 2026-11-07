import { NextRequest, NextResponse } from "next/server";
import { recordPayment } from "@/lib/ar";

// Stripe -> Godzilla (Benjy + Denise 11/7/26): a completed Checkout marks the
// invoice paid on its own, so nobody has to check the bank or Stripe. Set
// STRIPE_WEBHOOK_SECRET from the endpoint in the Stripe dashboard
// (https://packaging.cndprinting.com/api/stripe/webhook, event
// checkout.session.completed and checkout.session.async_payment_succeeded).
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const key = process.env.STRIPE_SECRET_KEY, secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !secret) return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(key);
  const sig = request.headers.get("stripe-signature") || "";
  const raw = await request.text();
  let event: any;
  try { event = stripe.webhooks.constructEvent(raw, sig, secret); }
  catch (e) { return NextResponse.json({ error: "Bad signature: " + (e as Error).message.slice(0, 80) }, { status: 400 }); }

  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object;
    // ACH shows up as completed with payment_status "unpaid" first, then async_payment_succeeded when the bank settles.
    if (s.payment_status !== "paid") return NextResponse.json({ ok: true, waiting: s.payment_status });
    const invoiceId = s.metadata?.invoiceId;
    if (!invoiceId) return NextResponse.json({ ok: true, ignored: "no invoiceId" });
    const method = (s.payment_method_types || []).includes("us_bank_account") && !(s.payment_method_types || []).includes("card") ? "ach" : s.metadata?.method || "card";
    const base = Number(s.metadata?.baseAmount || 0) || (s.amount_total || 0) / 100;
    await recordPayment(prisma, { invoiceId, amount: base, method, reference: s.payment_intent || s.id, stripeId: s.id, recordedBy: "stripe", note: method === "card" ? `Card via Stripe, charged ${((s.amount_total || 0) / 100).toFixed(2)} incl. surcharge` : "ACH via Stripe" });
    await prisma.invoice.update({ where: { id: invoiceId }, data: { stripePaymentId: s.payment_intent || null } }).catch(() => {});
    return NextResponse.json({ ok: true, invoiceId });
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const s = event.data.object;
    if (s.metadata?.invoiceId) await prisma.invoice.update({ where: { id: s.metadata.invoiceId }, data: { notes: `ACH payment failed in Stripe on ${new Date().toLocaleDateString("en-US")}` } }).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}
