// Shipping module (rebuilt 11/17/26 for Shayla). Shipments hang off the customer
// record, the job (or a FileMaker job number until jobs live in Godzilla) and
// the invoice. Shayla can email the customer the ship date and tracking
// straight from the queue, from her own mailbox.

export const CARRIERS = ["FedEx", "UPS", "USPS", "C&D Local", "Customer Pickup", "Freight / LTL", "Other"];

export function trackingUrl(carrier?: string | null, tracking?: string | null): string | null {
  const t = (tracking || "").trim();
  if (!t) return null;
  const c = (carrier || "").toLowerCase();
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(t)}`;
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${encodeURIComponent(t)}`;
  if (c.includes("usps")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(t)}`;
  return null;
}

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Date-only fields (target ship, expected delivery) are stored as UTC midnight,
// so print them in UTC or Florida time shows the day before. Real timestamps
// (the moment it shipped) print in Eastern time.
const day = (d?: Date | string | null, tz = "UTC") => (d ? new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: tz }) : null);

export type NotifyKind = "shipdate" | "tracking";

export function shipmentEmail(s: any, kind: NotifyKind, sender: { name: string; email: string }, note?: string) {
  const first = String(s.contactName || "").trim().split(/\s+/)[0];
  const ref = [s.poNumber ? `PO ${s.poNumber}` : null, s.jobNumber ? `job ${s.jobNumber}` : null].filter(Boolean).join(", ");
  const url = trackingUrl(s.carrier, s.trackingNumber);
  const items = (s.items || []).map((i: any) => `<li>${esc(i.quantity)} x ${esc(i.description)}</li>`).join("");
  const rows: string[] = [];
  const row = (k: string, v: string | null) => { if (v) rows.push(`<tr><td style="padding:6px 16px 6px 0;color:#666;">${k}</td><td style="padding:6px 0;">${v}</td></tr>`); };
  if (kind === "shipdate") {
    row("Target ship date", esc(day(s.targetShipDate)));
    row("Ship via", esc(s.carrier));
  } else {
    row("Shipped", esc(day(s.shipDate || new Date(), "America/New_York")));
    row("Carrier", esc(s.carrier));
    row("Tracking", url ? `<a href="${url}">${esc(s.trackingNumber)}</a>` : esc(s.trackingNumber));
    row("Expected delivery", esc(day(s.estimatedDelivery)));
  }
  row("Cartons", s.cartons ? esc(s.cartons) : null);
  row("Pallets", s.pallets ? esc(s.pallets) : null);
  row("Ship to", s.shipTo ? esc(s.shipTo).replace(/\n/g, "<br>") : null);
  row("Invoice", esc(s.invoiceNumber || ""));
  const lead = kind === "shipdate"
    ? `Your order${ref ? ` (${esc(ref)})` : ""} is scheduled to ship on <strong>${esc(day(s.targetShipDate))}</strong>.`
    : `Your order${ref ? ` (${esc(ref)})` : ""} has shipped${s.isPartial ? " (this is a partial shipment, the rest will follow)" : ""}.`;
  const subject = kind === "shipdate"
    ? `Your order ships ${new Date(s.targetShipDate).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}${ref ? ` (${ref})` : ""} | C&D Printing`
    : `Your order has shipped${s.trackingNumber ? `: tracking ${s.trackingNumber}` : ""}${ref ? ` (${ref})` : ""} | C&D Printing`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:600px;">
<p>Hi${first ? ` ${esc(first)}` : ""},</p>
<p>${lead}</p>
${note ? `<p>${esc(note).replace(/\n/g, "<br>")}</p>` : ""}
<table style="border-collapse:collapse;margin:12px 0;">${rows.join("")}</table>
${items ? `<p style="margin-bottom:4px;">In this shipment:</p><ul style="margin-top:0;">${items}</ul>` : ""}
${url && kind === "tracking" ? `<p><a href="${url}" style="display:inline-block;background:#ED1C24;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">Track your shipment</a></p>` : ""}
<p>Any questions, just reply to this email.</p>
<p>Thanks,<br>${esc(sender.name)}<br>C&amp;D Printing &amp; Packaging<br>(727) 572-9999</p>
</div>`;
  return { subject, html };
}
