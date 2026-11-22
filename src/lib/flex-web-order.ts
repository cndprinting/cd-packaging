// FLEXIBLE PACKAGING ORDERED ON THE WEBSITE (Benjy 11/22/26: no login, full checkout, paid 100% up front).
//
// The website's Packaging Studio asks /api/public/site/flex-price for a price and sends the
// customer to Stripe through /api/public/site/flex-checkout. Nothing is written to Godzilla until
// Stripe says the customer has paid (or, for a bank transfer, has committed to pay). Then
// completeWebOrder() below:
//   - opens a lead marked "Paid online order" so the owners see it in the pipeline (Jessica stays out),
//   - creates the invoice ALREADY PAID with its Stripe payment, so accounting's books match Stripe
//     and nobody has anything to approve, send or chase,
//   - emails the owners, and emails the customer a receipt.
// An abandoned checkout leaves nothing behind: no draft, no open invoice, no reminder.
//
// Prices always come from the server (src/lib/flex-online-estimator.ts). A price sent by the
// browser is only used to notice that the price changed while the customer was typing.

import {
  FlexQuoteError, PRODUCTS, POUCH_STRUCTURES, LABEL_STRUCTURES, LABEL_FINISHES, RUSH_PREMIUMS, STRUCTURES,
  LEAD_TIME_BUSINESS_DAYS, checkOnline, customerView, quote,
  type CustomerFlexQuote, type Product, type Rush,
} from "@/lib/flex-online-estimator";
import { AR_FROM, BASE_URL, CARD_SURCHARGE, floridaTax, money, newPayToken, recordPayment, round2 } from "@/lib/ar";
import { clean } from "@/lib/site-public";

export interface FlexSpec {
  product: Product;
  args: Record<string, number | string>;   // exactly what the estimator takes
  reorder: boolean;                         // labels: customer says we already have the die for this size
}

const PRODUCT_NAME: Record<Product, [string, string]> = {
  stand_up_pouch: ["stand-up pouch", "stand-up pouches"],
  flat_pouch: ["flat pouch", "flat pouches"],
  rollstock: ["rollstock impression", "rollstock impressions"],
  roll_label: ["roll label", "roll labels"],
};
const ZIPPER_NAME: Record<string, string> = { none: "No zipper", ptc: "Press-to-close zipper", slider: "Slider zipper" };
const FINISH_NAME: Record<string, string> = { none: "No finish", gloss_opv: "Gloss varnish", matte_opv: "Matte varnish", gloss_lam: "Gloss laminate", matte_lam: "Matte laminate" };
const RUSH_NAME: Record<Rush, string> = {
  standard_15_day: `Standard, ${LEAD_TIME_BUSINESS_DAYS} business days from proof approval`,
  rush_12_day: "Rush, 12 business days", rush_10_day: "Rush, 10 business days", rush_7_day: "Rush, 7 business days",
  rush_5_day: "Rush, 5 business days", rush_3_day: "Rush, 3 business days",
};
const bad = (msg: string) => new FlexQuoteError(msg, "bad_input");
const inches = (v: unknown, what: string): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0 || n > 60) throw bad(`Please enter the ${what} in inches.`);
  return Math.round(n * 1000) / 1000;
};
const whole = (v: unknown, what: string, max: number): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > max) throw bad(`Please enter ${what} as a whole number.`);
  return n;
};
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T, what: string): T => {
  if (v == null || v === "") return fallback;
  if (!list.includes(v as T)) throw bad(`Unknown ${what}.`);
  return v as T;
};

/** Reads a price or order request from the website into exactly what the estimator takes. Throws FlexQuoteError. */
export function parseFlexSpec(b: any): FlexSpec {
  const product = String(b?.product || "");
  if (!Object.prototype.hasOwnProperty.call(PRODUCTS, product)) throw new FlexQuoteError("This product is quoted by a C&D specialist.");
  const p = product as Product;
  const args: Record<string, number | string> = {
    quantity: whole(b.quantity, "the quantity", 10_000_000),
    skus: b.skus == null || b.skus === "" ? 1 : whole(b.skus, "the number of designs", 50),
    rush: oneOf(b.rush, Object.keys(RUSH_PREMIUMS) as Rush[], "standard_15_day", "turnaround"),
  };
  if (p === "rollstock") {
    args.slit_width_in = inches(b.slit_width_in, "roll width");
    args.cutoff_in = inches(b.cutoff_in, "repeat length");
  } else {
    args.width_in = inches(b.width_in, "width");
    args.height_in = inches(b.height_in, "height");
  }
  if (p === "stand_up_pouch") args.gusset_in = inches(b.gusset_in, "gusset");
  if (p === "roll_label") {
    args.structure = oneOf(b.structure, LABEL_STRUCTURES, "label_white_bopp", "label material");
    args.finish = oneOf(b.finish, LABEL_FINISHES, "none", "label finish");
    args.colors = oneOf(b.colors, ["cmyk", "cmyk_w"] as const, "cmyk", "print option");
  } else {
    args.structure = oneOf(b.structure, POUCH_STRUCTURES, "matte_barrier", "film structure");
    args.colors = oneOf(b.colors, ["cmyk", "cmyk_w"] as const, "cmyk_w", "print option");
    // Nitay's README: a window only works on the clear structure.
    if (b.window && args.structure !== "clear_pe") throw bad("A clear window needs the clear film structure.");
  }
  if (p === "stand_up_pouch") args.zipper = oneOf(b.zipper, ["none", "ptc", "slider"] as const, "ptc", "zipper");
  if (p === "flat_pouch") args.zipper = oneOf(b.zipper, ["none", "ptc"] as const, "none", "zipper");
  return { product: p, args, reorder: p === "roll_label" && b.reorder === true };
}

/** The customer's price for a spec. Throws FlexQuoteError when the job belongs with a person. */
export function priceFlex(spec: FlexSpec, quantity?: number): CustomerFlexQuote {
  const args = quantity ? { ...spec.args, quantity } : spec.args;
  checkOnline(spec.product, args);
  const q = quote(spec.product, args);
  return customerView(q, Number(args.quantity), Number(args.skus) || 1, { newLabelSize: spec.product === "roll_label" && !spec.reorder });
}

/** What to tell a customer when the estimator refuses a job. Press details stay inside. */
export function friendly(e: FlexQuoteError): string {
  if (e.route === "bad_input") return e.message;
  if (/press|does not fit/i.test(e.message)) return "This size is larger than what we price online. A C&D specialist will quote it.";
  return e.message;
}

export interface OrderTotals { price: number; oneTime: number; subtotal: number; taxAmount: number; taxed: boolean; total: number }
/** Florida deliveries are taxed (7% to $5,000, 6% above, Denise's rule). Out of state is not. Shipping is billed separately. */
export function orderTotals(cq: CustomerFlexQuote, shipState: string): OrderTotals {
  const oneTime = round2(cq.one_time.reduce((s, x) => s + x.amount, 0));
  const subtotal = round2(cq.price_total + oneTime);
  const taxed = shipState.toUpperCase() === "FL";
  const taxAmount = taxed ? floridaTax(subtotal) : 0;
  return { price: cq.price_total, oneTime, subtotal, taxAmount, taxed, total: round2(subtotal + taxAmount) };
}
export const cardSurcharge = (total: number) => round2(total * CARD_SURCHARGE);

const n = (v: number | string) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 });
/** One line: "5,000 stand-up pouches, 4.75 x 8 x 3 in". */
export function describe(spec: FlexSpec): string {
  const a = spec.args, qty = Number(a.quantity), name = PRODUCT_NAME[spec.product][qty === 1 ? 0 : 1];
  const size = spec.product === "rollstock" ? `${n(a.slit_width_in)} in wide x ${n(a.cutoff_in)} in repeat`
    : spec.product === "stand_up_pouch" ? `${n(a.width_in)} x ${n(a.height_in)} x ${n(a.gusset_in)} in` : `${n(a.width_in)} x ${n(a.height_in)} in`;
  return `${n(qty)} ${name}, ${size}`;
}
/** The full specification, for the lead, the invoice notes and the emails. */
export function specLines(spec: FlexSpec): [string, string][] {
  const a = spec.args, rows: [string, string][] = [["Order", describe(spec)]];
  rows.push([spec.product === "roll_label" ? "Material" : "Film", STRUCTURES[String(a.structure)]?.label || String(a.structure)]);
  if (a.zipper) rows.push(["Zipper", ZIPPER_NAME[String(a.zipper)] || String(a.zipper)]);
  if (a.finish) rows.push(["Finish", FINISH_NAME[String(a.finish)] || String(a.finish)]);
  rows.push(["Print", a.colors === "cmyk_w" ? "CMYK + white" : "CMYK"]);
  rows.push(["Designs", n(a.skus)]);
  rows.push(["Turnaround", RUSH_NAME[a.rush as Rush] || String(a.rush)]);
  if (spec.product === "roll_label") rows.push(["Label die", spec.reorder ? "Customer says this size was ordered before: CHECK the die is on file" : "New size: die charged on this order"]);
  return rows;
}

// ── Stripe ────────────────────────────────────────────────────────────────────

export interface WebOrderInput {
  ref: string;
  spec: FlexSpec;
  cq: CustomerFlexQuote;
  totals: OrderTotals;
  method: "card" | "ach";
  company: string; name: string; email: string; phone: string;
  ship: { line1: string; line2: string; city: string; state: string; zip: string };
  notes: string;
  fileUrl: string;
  successUrl: string; cancelUrl: string;
}
/** The Stripe Checkout request for a website order. Everything the order needs travels in metadata,
 *  because nothing is saved in Godzilla until the payment comes back. (Stripe: 500 characters per value.) */
export function checkoutParams(o: WebOrderInput) {
  const surcharge = o.method === "card" ? cardSurcharge(o.totals.total) : 0;
  const shipTo = [o.ship.line1, o.ship.line2, `${o.ship.city}, ${o.ship.state} ${o.ship.zip}`].filter(Boolean).join(", ");
  const metadata: Record<string, string> = {
    webOrder: "flex", ref: o.ref, method: o.method,
    baseAmount: String(o.totals.total), subtotal: String(o.totals.subtotal), taxAmount: String(o.totals.taxAmount), oneTime: String(o.totals.oneTime), price: String(o.totals.price),
    company: o.company.slice(0, 160), name: o.name.slice(0, 120), email: o.email.slice(0, 200), phone: o.phone.slice(0, 40),
    shipTo: shipTo.slice(0, 480), shipState: o.ship.state,
    spec: JSON.stringify(o.spec).slice(0, 499),
    notes: o.notes.slice(0, 480), fileUrl: o.fileUrl.slice(0, 480),
  };
  for (const k of Object.keys(metadata)) if (!metadata[k]) delete metadata[k];
  const what = describe(o.spec);
  return {
    payment_method_types: (o.method === "ach" ? ["us_bank_account"] : ["card"]) as ("card" | "us_bank_account")[],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `C&D Printing order ${o.ref}: ${what}`.slice(0, 250), description: o.method === "card" ? `${o.totals.total.toFixed(2)} + 3% card surcharge` : "Bank transfer, no fee" },
        unit_amount: Math.round((o.totals.total + surcharge) * 100),
      },
      quantity: 1,
    }],
    mode: "payment" as const,
    customer_email: o.email,
    success_url: o.successUrl,
    cancel_url: o.cancelUrl,
    metadata,
    payment_intent_data: { description: `C&D Printing online order ${o.ref}`, metadata: { webOrder: "flex", ref: o.ref } },
  };
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">${inner}</div>`;
const table = (rows: [string, string][]) => `<table style="border-collapse:collapse;font-size:14px;">${rows.map(([k, v]) => `<tr><td style="padding:2px 14px 2px 0;color:#666;vertical-align:top;">${esc(k)}</td><td style="padding:2px 0;">${esc(v)}</td></tr>`).join("")}</table>`;

async function nextNumber(prisma: any): Promise<string> {
  const { nextInvoiceNumber } = await import("@/lib/press-gate");
  return nextInvoiceNumber(prisma);
}

/**
 * Called by the Stripe webhook for a website order's Checkout session (metadata.webOrder = "flex").
 * Safe to call more than once for the same session: Stripe repeats events.
 *   payment_status "paid"            -> lead + paid invoice + notices
 *   anything else (a bank transfer that has not settled yet) -> lead only, marked as settling
 */
export async function completeWebOrder(prisma: any, s: any): Promise<{ ref: string; state: string; invoiceNumber?: string; leadId?: string }> {
  const m = s.metadata || {};
  const ref = clean(m.ref, 30);
  if (!ref) return { ref: "", state: "ignored: no reference" };
  const paid = s.payment_status === "paid";
  let spec: FlexSpec | null = null;
  try { spec = JSON.parse(m.spec || "null"); } catch { /* the notes still carry the reference */ }
  const what = spec ? describe(spec) : "Flexible packaging order";
  const lines: [string, string][] = spec ? specLines(spec) : [["Order", what]];
  const company = clean(m.company, 160), name = clean(m.name, 120), email = clean(m.email, 200).toLowerCase(), phone = clean(m.phone, 40);
  const customer = company || name || "Website customer";
  const total = Number(m.baseAmount) || 0, subtotal = Number(m.subtotal) || total, taxAmount = Number(m.taxAmount) || 0, oneTime = Number(m.oneTime) || 0;
  const method = m.method === "ach" ? "ach" : "card";
  const charged = (s.amount_total || 0) / 100;
  const when = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // 1. The lead, once per order.
  const marker = `"webOrderRef":"${ref}"`;
  let lead = await prisma.lead.findFirst({ where: { intakeRaw: { contains: marker } } });
  const summary = [
    `[Website order ${ref}] ${paid ? `PAID IN FULL online on ${when} (${method === "ach" ? "bank transfer" : "card"}).` : `Placed online on ${when}; the bank transfer has not settled yet. Do not start until it does.`}`,
    lines.map(([k, v]) => `${k}: ${v}`).join("\n"),
    `Order total ${money(total)}${oneTime ? ` (includes ${money(oneTime)} one-time charges)` : ""}${taxAmount ? `, of which ${money(taxAmount)} Florida sales tax` : ""}. Shipping is NOT included: bill it when the order ships.`,
    m.shipTo ? `Ship to: ${m.shipTo}` : "",
    m.notes ? `Customer note: ${m.notes}` : "",
    m.fileUrl ? `Artwork: ${m.fileUrl}` : "No artwork came with the order: ask the customer for print-ready files.",
    "The price is already agreed and paid. Next step is the proof, not a quote.",
  ].filter(Boolean).join("\n\n");
  const leadData = {
    stage: paid ? "Paid online order" : "Online order, bank transfer settling",
    pipelineStage: paid ? "CUSTOMER" : "QUALIFIED",
    commentary: summary, lastInteraction: new Date(),
  };
  if (!lead) {
    lead = await prisma.lead.create({ data: {
      companyName: customer, productCategory: "Flexible packaging", contactName: name || null, contactEmail: email || null, contactPhone: phone || null,
      state: clean(m.shipState, 2) || null, priority: 1, ownerName: "TBD", agentStatus: "owner_handling", agentNextAt: null,
      source: "inbound", volume: spec ? String(spec.args.quantity) : null,
      intakeRaw: JSON.stringify({ webOrderRef: ref, stripeSession: s.id, metadata: m }),
      ...leadData,
    } });
  } else if (paid && lead.stage !== "Paid online order") {
    lead = await prisma.lead.update({ where: { id: lead.id }, data: leadData });
  }
  if (!paid) return { ref, state: "waiting for the bank transfer", leadId: lead.id };

  // 2. The invoice, born paid. Once per Stripe session.
  const already = await prisma.payment.findUnique({ where: { stripeId: s.id }, include: { invoice: { select: { invoiceNumber: true } } } });
  if (already) return { ref, state: "already recorded", invoiceNumber: already.invoice?.invoiceNumber, leadId: lead.id };
  const data = {
    status: "pending", kind: "prebill",
    customerName: customer, contactEmail: email || null,
    description: `Online order ${ref} · ${what}`,
    subtotal, taxRate: taxAmount > 0 ? 7 : 0, taxAmount, shipping: 0, total,
    depositPercent: 100, depositAmount: total,
    dueDate: new Date(), sentAt: new Date(), payToken: newPayToken(), createdBy: "Website checkout",
    notes: `Paid in full at checkout on the website (${ref}), ${when}. ${lines.map(([k, v]) => `${k}: ${v}`).join("; ")}.${m.shipTo ? ` Ship to: ${m.shipTo}.` : ""} Shipping not included: bill it when the order ships.`,
  };
  let inv: any = null;
  for (let attempt = 0; attempt < 3 && !inv; attempt++) {
    try { inv = await prisma.invoice.create({ data: { ...data, invoiceNumber: await nextNumber(prisma) } as any }); }
    catch (e) { if (attempt === 2 || !/unique/i.test(String((e as Error).message))) throw e; }   // two invoices numbered at the same moment: take the next number
  }
  await recordPayment(prisma, {
    invoiceId: inv.id, amount: total, method, reference: s.payment_intent || s.id, stripeId: s.id, recordedBy: "stripe",
    note: method === "card" ? `Website checkout, card via Stripe, charged ${charged.toFixed(2)} incl. surcharge` : "Website checkout, ACH via Stripe",
  });
  await prisma.invoice.update({ where: { id: inv.id }, data: { stripeSessionId: s.id, stripePaymentId: s.payment_intent || null } }).catch(() => {});

  // 3. Notices. A failed email never undoes a paid order.
  const money2 = [["Order total", money(total)], ...(taxAmount ? [["Florida sales tax (included)", money(taxAmount)] as [string, string]] : []),
    [method === "card" ? "Charged to card (with 3% surcharge)" : "Paid by bank transfer", money(charged || total)]] as [string, string][];
  try {
    const { agentSend, OWNERS } = await import("@/lib/agent/agent");
    await agentSend({ to: OWNERS, subject: `Paid online order: ${customer} · ${money(total)}`, body: wrap(
      `<p><strong>${esc(customer)}</strong> ordered and paid in full on the website. Reference ${esc(ref)}, invoice ${esc(inv.invoiceNumber)} (already paid).</p>
       ${table(lines)}<br>${table(money2)}
       <p>${esc(name)}${email ? ` · ${esc(email)}` : ""}${phone ? ` · ${esc(phone)}` : ""}${m.shipTo ? `<br>Ship to: ${esc(m.shipTo)}` : ""}${m.notes ? `<br>Customer note: ${esc(m.notes)}` : ""}</p>
       <p>${m.fileUrl ? `<a href="${esc(m.fileUrl)}">Artwork the customer uploaded</a>` : "No artwork came with the order. Someone needs to ask the customer for print-ready files."}</p>
       <p>The price is agreed and paid, so this skips quoting: the next step is the proof. Shipping was not charged and is billed when the order ships. Jessica is not working this lead.</p>
       <p><a href="${BASE_URL}/dashboard/pipeline">Open the pipeline</a></p>`) });
  } catch (e) { console.error("[Godzilla WEB ORDER] owner notice failed:", e); }
  if (email) {
    try {
      const { sendEmail } = await import("@/lib/email/graph-client");
      await sendEmail({ from: AR_FROM, to: email, subject: `Your C&D Printing order ${ref}: payment received`, body: wrap(
        `<p>${name ? `Hi ${esc(name.split(" ")[0])},` : "Hello,"}</p>
         <p>Thank you for your order. We received your payment of ${esc(money(charged || total))}.</p>
         ${table([["Order reference", ref], ["Invoice", `${inv.invoiceNumber} (paid)`], ...lines.filter(([k]) => k !== "Label die")])}
         <p><strong>What happens next:</strong> ${m.fileUrl ? "we check your artwork and send a proof for your approval." : "reply to this email with your print-ready artwork, and we will send a proof for your approval."} Production starts when you approve the proof. Shipping is not included in this payment and is billed at cost when your order ships.</p>
         <p>Questions? Reply to this email or call 727-572-9999 and mention ${esc(ref)}.</p>
         <p>C&amp;D Printing &amp; Packaging<br>12150 28th Street North, St. Petersburg, FL 33716</p>`) });
    } catch (e) { console.error("[Godzilla WEB ORDER] customer receipt failed:", e); }
  }
  return { ref, state: "recorded", invoiceNumber: inv.invoiceNumber, leadId: lead.id };
}

/** A bank transfer that failed after the order was placed. */
export async function failWebOrder(prisma: any, s: any) {
  const ref = clean(s.metadata?.ref, 30);
  if (!ref) return;
  const lead = await prisma.lead.findFirst({ where: { intakeRaw: { contains: `"webOrderRef":"${ref}"` } } });
  if (lead) await prisma.lead.update({ where: { id: lead.id }, data: { stage: "Online order, bank transfer FAILED", commentary: `[Website order ${ref}] The bank transfer FAILED in Stripe on ${new Date().toLocaleDateString("en-US")}. Nothing was paid. Contact the customer before doing any work.\n\n${lead.commentary || ""}` } });
}
