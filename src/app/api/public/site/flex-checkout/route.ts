import { NextRequest } from "next/server";
import { FlexQuoteError } from "@/lib/flex-online-estimator";
import { cardSurcharge, checkoutParams, describe, friendly, orderTotals, parseFlexSpec, priceFlex } from "@/lib/flex-web-order";
import { clean, clientIp, fromOurSite, newRef, ourUpload, preflight, reply, throttle, validEmail } from "@/lib/site-public";

/**
 * Public website endpoint: pay for a flexible packaging or roll label order (11/22/26).
 * Benjy's rule: orders checked out on the website are paid 100% up front, no deposit split.
 *
 * The browser sends the job and the customer's details. This prices the job again on the server
 * (a price from the browser is never charged), adds Florida sales tax for Florida deliveries, and
 * opens a Stripe Checkout page on C&D's own Stripe account: card with the usual 3% surcharge, or
 * bank transfer with no fee. The reply is the address of that Stripe page.
 *
 * NOTHING is saved in Godzilla here. The order exists only once Stripe reports the payment to
 * /api/stripe/webhook (see completeWebOrder in src/lib/flex-web-order.ts). A customer who walks
 * away from the Stripe page leaves no invoice, no draft and nothing for accounting to clean up.
 *
 * OFF BY DEFAULT: real payments need SITE_CHECKOUT=1 in the environment. test:true (the review
 * site) checks and prices the order and returns the totals without opening Stripe, on or off.
 */
const tooMany = throttle(10);
const STATES = "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" ");

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  if (!fromOurSite(req)) return reply(req, { error: "Not allowed from this address" }, 403);
  let b: any;
  try { b = await req.json(); } catch { return reply(req, { error: "Could not read the request" }, 400); }
  if (!b || typeof b !== "object") return reply(req, { error: "Could not read the request" }, 400);

  const ref = newRef();
  if (clean(b.hp, 50)) return reply(req, { ok: true, ref });   // a filled hidden field means a bot

  // Who is ordering and where it ships.
  const company = clean(b.company, 160), name = clean(b.name, 120), email = clean(b.email, 200).toLowerCase(), phone = clean(b.phone, 40);
  const sh = b.ship && typeof b.ship === "object" ? b.ship : {};
  const ship = { line1: clean(sh.line1, 120), line2: clean(sh.line2, 80), city: clean(sh.city, 80), state: clean(sh.state, 2).toUpperCase(), zip: clean(sh.zip, 10) };
  if (!name) return reply(req, { error: "Please add your name" }, 400);
  if (!validEmail(email)) return reply(req, { error: "Please add a valid email address" }, 400);
  if (phone.replace(/\D/g, "").length < 10) return reply(req, { error: "Please add a phone number we can reach you at" }, 400);
  if (!ship.line1 || !ship.city) return reply(req, { error: "Please add the delivery address" }, 400);
  if (!STATES.includes(ship.state)) return reply(req, { error: "Online orders ship within the United States. Please pick a state, or call 727-572-9999." }, 400);
  if (!/^\d{5}(-\d{4})?$/.test(ship.zip)) return reply(req, { error: "Please add a 5-digit ZIP code" }, 400);
  const method = b.method === "ach" ? "ach" : "card";
  if (method === "ach" && !process.env.STRIPE_ACH_ENABLED) return reply(req, { error: "Bank transfer is not available yet. Please pay by card or call 727-572-9999." }, 400);

  // The job, priced here.
  let spec, cq;
  try { spec = parseFlexSpec(b); cq = priceFlex(spec); }
  catch (e) {
    if (e instanceof FlexQuoteError) return reply(req, { ok: false, route: e.route, message: friendly(e) }, 400);
    console.error("[Godzilla FLEX CHECKOUT] pricing failed:", e);
    return reply(req, { error: "We could not price that just now. Please call 727-572-9999." }, 500);
  }
  const totals = orderTotals(cq, ship.state);
  const surcharge = method === "card" ? cardSurcharge(totals.total) : 0;
  const summary = { ref, what: describe(spec), quote: cq, totals, method, surcharge, charge: Math.round((totals.total + surcharge) * 100) / 100 };
  // The customer must be paying the price they were shown.
  const shown = Number(b.priceShown);
  if (Number.isFinite(shown) && shown > 0 && Math.abs(shown - cq.price_total) > 0.01) {
    return reply(req, { ok: false, route: "price_changed", message: "The price for this order has been updated. Please review it and continue.", ...summary }, 409);
  }

  if (b.test === true) return reply(req, { ok: true, test: true, ...summary, ref: "TEST-" + ref.slice(2) });
  if (tooMany(clientIp(req))) return reply(req, { error: "Too many requests. Please call 727-572-9999." }, 429);

  // OFF until Benjy switches it on (SITE_CHECKOUT=1). Until then nothing here can reach Stripe.
  if (process.env.SITE_CHECKOUT !== "1") return reply(req, { error: "Online checkout is not open yet. Send this as a quote request, or call 727-572-9999." }, 503);
  const key = process.env.STRIPE_SECRET_KEY || "";
  if (!/^(sk|rk)_(live|test)_/.test(key)) return reply(req, { error: "Online payment is not available right now. Call 727-572-9999 to place this order." }, 503);

  // Back to the page the customer came from, on our own site.
  const origin = req.headers.get("origin") || "";
  const path = /^\/[A-Za-z0-9\-_/.]{0,120}$/.test(String(b.returnPath || "")) && !String(b.returnPath).includes("//") ? String(b.returnPath) : "/";
  try {
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create(checkoutParams({
      ref, spec, cq, totals, method, company, name, email, phone, ship,
      notes: clean(b.notes, 480), fileUrl: ourUpload(b.fileUrl),
      successUrl: `${origin}${path}?paid=1&ref=${ref}`, cancelUrl: `${origin}${path}?canceled=1`,
    }));
    return reply(req, { ok: true, ...summary, url: session.url });
  } catch (e) {
    const msg = (e as Error).message || "";
    if (method === "ach" && /us_bank_account|payment method type/i.test(msg)) return reply(req, { error: "Bank transfer is not available yet. Please pay by card or call 727-572-9999." }, 400);
    console.error("[Godzilla FLEX CHECKOUT]", msg);
    return reply(req, { error: "We could not start the payment. Please call 727-572-9999." }, 502);
  }
}
