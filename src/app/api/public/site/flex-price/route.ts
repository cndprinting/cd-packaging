import { NextRequest } from "next/server";
import { FlexQuoteError, ONLINE_LIMITS } from "@/lib/flex-online-estimator";
import { friendly, parseFlexSpec, priceFlex } from "@/lib/flex-web-order";
import { clientIp, fromOurSite, preflight, reply, throttle } from "@/lib/site-public";

/**
 * Public website endpoint: the price of a flexible packaging or roll label job (11/22/26).
 * The Packaging Studio calls this as the customer changes the size, film or quantity.
 * No login (Benjy 11/22). It reads and writes nothing in the database.
 *
 * Only the customer's price leaves this server: total, price each, turnaround and one-time
 * charges. Cost, margin and press data stay in src/lib/flex-online-estimator.ts.
 *
 * Answers:
 *   { ok: true, quote, breaks: [{ quantity, price_total, price_per_unit } | { quantity, message }] }
 *   { ok: false, route: "quote_request" | "bad_input", message }   (a job for a person, or a missing field)
 */
const tooMany = throttle(240);   // a customer dragging a size slider asks often

export async function OPTIONS(req: NextRequest) {
  return preflight(req);
}

export async function POST(req: NextRequest) {
  if (!fromOurSite(req)) return reply(req, { error: "Not allowed from this address" }, 403);
  if (tooMany(clientIp(req))) return reply(req, { error: "Too many requests. Please call 727-572-9999." }, 429);
  let b: any;
  try { b = await req.json(); } catch { return reply(req, { error: "Could not read the request" }, 400); }
  if (!b || typeof b !== "object") return reply(req, { error: "Could not read the request" }, 400);

  try {
    const spec = parseFlexSpec(b);
    const quote = priceFlex(spec);
    // The same job at other quantities, for the price table.
    const asked: number[] = Array.isArray(b.breaks) ? b.breaks.slice(0, 8).map(Number).filter((q: number) => Number.isInteger(q) && q > 0 && q <= 10_000_000) : [];
    const breaks = asked.map((quantity) => {
      try { const q = priceFlex(spec, quantity); return { quantity, price_total: q.price_total, price_per_unit: q.price_per_unit }; }
      catch (e) { if (e instanceof FlexQuoteError) return { quantity, message: friendly(e), route: e.route }; throw e; }
    });
    return reply(req, { ok: true, quote, breaks, limits: ONLINE_LIMITS });
  } catch (e) {
    if (e instanceof FlexQuoteError) return reply(req, { ok: false, route: e.route, message: friendly(e), limits: ONLINE_LIMITS });
    console.error("[Godzilla FLEX PRICE]", e);
    return reply(req, { error: "We could not price that just now. Please call 727-572-9999." }, 500);
  }
}
