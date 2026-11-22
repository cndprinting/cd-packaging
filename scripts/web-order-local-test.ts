// LAPTOP ONLY. Plays a paid website order through the laptop copy of Godzilla exactly as Stripe would:
// builds the real Checkout request, then posts the "payment completed" event to the laptop's webhook,
// signed with the laptop's own webhook secret. No Stripe account is contacted and no email is sent.
//   cd C:\dev\cd-packaging ; npx tsx scripts/web-order-local-test.ts
import fs from "fs";

const env = Object.fromEntries(fs.readFileSync("C:/dev/cd-packaging/.env.development.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z_0-9]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")]; }));
if (!/localhost|127\.0\.0\.1/.test(env.DATABASE_URL || "")) { console.error("REFUSING: the database is not on this laptop."); process.exit(1); }
for (const k of Object.keys(env)) process.env[k] = env[k];
const BASE = "http://localhost:3001";

async function main() {
  const { parseFlexSpec, priceFlex, orderTotals, checkoutParams } = await import("../src/lib/flex-web-order");
  const Stripe = (await import("stripe")).default;
  const prisma = (await import("../src/lib/prisma")).default as any;
  const stamp = Date.now().toString(36).toUpperCase();

  const post = async (type: string, session: any) => {
    const payload = JSON.stringify({ id: "evt_local_" + stamp, type, data: { object: session } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: env.STRIPE_WEBHOOK_SECRET } as any);
    const r = await fetch(BASE + "/api/stripe/webhook", { method: "POST", headers: { "stripe-signature": header, "content-type": "application/json" }, body: payload });
    return `${r.status} ${JSON.stringify(await r.json())}`;
  };
  const show = async (ref: string) => {
    const lead = await prisma.lead.findFirst({ where: { intakeRaw: { contains: `"webOrderRef":"${ref}"` } } });
    const inv = await prisma.invoice.findFirst({ where: { description: { contains: ref } }, include: { payments: true } });
    console.log("   lead:", lead ? `${lead.companyName} | stage "${lead.stage}" | ${lead.pipelineStage} | owner ${lead.ownerName} | agent ${lead.agentStatus}` : "none");
    console.log("   invoice:", inv ? `${inv.invoiceNumber} | ${inv.status} | subtotal ${inv.subtotal} tax ${inv.taxAmount} total ${inv.total} | paid ${inv.paidAmount} | kind ${inv.kind} | ${inv.payments.length} payment(s): ${inv.payments.map((p: any) => `${p.method} ${p.amount}`).join(", ")}` : "none");
    return { lead, inv };
  };
  const order = (ref: string, body: any, state: string, method: "card" | "ach") => {
    const spec = parseFlexSpec(body), cq = priceFlex(spec), totals = orderTotals(cq, state);
    const params = checkoutParams({ ref, spec, cq, totals, method, company: "LAPTOP TEST Snack Co", name: "Pat Tester", email: "pat@example.com", phone: "727-555-0100",
      ship: { line1: "100 Test Ave", line2: "", city: state === "FL" ? "Tampa" : "Atlanta", state, zip: state === "FL" ? "33602" : "30301" }, notes: "Laptop test order", fileUrl: "",
      successUrl: "http://localhost:3220/v5/cart?paid=1&ref=" + ref, cancelUrl: "http://localhost:3220/v5/cart?canceled=1" });
    const longest = Math.max(...Object.values(params.metadata).map((v) => v.length));
    console.log(`   ${params.line_items[0].price_data.product_data.name}`);
    console.log(`   price ${totals.price} + one-time ${totals.oneTime} + tax ${totals.taxAmount} = ${totals.total}; Stripe charges ${(params.line_items[0].price_data.unit_amount / 100).toFixed(2)} by ${method}; longest metadata value ${longest} chars`);
    return { params, session: { id: `cs_test_local_${ref}`, payment_intent: `pi_local_${ref}`, amount_total: params.line_items[0].price_data.unit_amount, payment_method_types: params.payment_method_types, metadata: params.metadata } };
  };

  console.log("1. Card order, Florida delivery (taxed): 5,000 stand-up pouches");
  const ref1 = `W-TEST-${stamp}A`;
  const o1 = order(ref1, { product: "stand_up_pouch", width_in: 4.75, height_in: 8, gusset_in: 3, quantity: 5000 }, "FL", "card");
  console.log("   webhook:", await post("checkout.session.completed", { ...o1.session, payment_status: "paid" }));
  await show(ref1);
  console.log("   Stripe repeats the same event:", await post("checkout.session.completed", { ...o1.session, payment_status: "paid" }));
  const again = await prisma.invoice.count({ where: { description: { contains: ref1 } } });
  console.log("   invoices for this order after the repeat:", again);

  console.log("2. Bank transfer, Georgia delivery (no Florida tax): 2,500 new-size roll labels");
  const ref2 = `W-TEST-${stamp}B`;
  process.env.STRIPE_ACH_ENABLED = "1";
  const o2 = order(ref2, { product: "roll_label", width_in: 3, height_in: 4, quantity: 2500, finish: "gloss_lam" }, "GA", "ach");
  console.log("   webhook (placed, not settled):", await post("checkout.session.completed", { ...o2.session, payment_status: "unpaid" }));
  await show(ref2);
  console.log("   webhook (bank settled):", await post("checkout.session.async_payment_succeeded", { ...o2.session, payment_status: "paid" }));
  await show(ref2);

  console.log("3. An ordinary invoice payment still works the old way (no web order involved)");
  console.log("   webhook:", await post("checkout.session.completed", { id: "cs_test_local_none_" + stamp, payment_status: "paid", amount_total: 100, metadata: {} }));
  await prisma.$disconnect?.();
}
main().catch((e) => { console.error(e); process.exit(1); });
