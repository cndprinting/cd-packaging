// Reads one of Mary's E&M estimates (PDF, image, or pasted text) and pulls out
// the job-ticket fields, so neither the salesperson nor the CSR retypes it
// (Benjy 11/17: "forward that estimate to Godzilla and Godzilla can
// automatically do it with AI"). Returns null when the AI is unavailable;
// callers fall back to the empty form.
import { getClaude } from "@/lib/agent/claude";

export type EstimateRead = {
  customerName: string | null;
  contactName: string | null;
  estimateNumber: string | null;
  estimateDate: string | null;
  salesRep: string | null;
  jobName: string | null;
  productType: "FOLDING_CARTON" | "COMMERCIAL_PRINT" | null;
  quantities: { quantity: number; price: number | null }[];
  specs: string | null;      // finished size, stock, inks, coating, die, finishing, packing, one line each
  dieNumber: string | null;
  notes: string | null;      // terms, freight, anything else printed on the estimate
  // From the salesperson's forwarding email, when there is one (Benjy 11/17):
  customerPO?: string | null;
  deliveryAddress?: string | null;
  paymentTerms?: "deposit50" | "prepaid" | "net30" | "cod" | null;
  artworkStatus?: "ready" | "coming" | "design" | "reprint" | null;
  dueDate?: string | null;
  acceptedQuantity?: number | null;
};

const SYSTEM = `You read printing and packaging estimates from C&D Printing & Packaging (made in their E&M estimating system by Mary, their estimator) and extract the fields a customer service rep needs to open a job ticket.
Rules:
- Use ONLY what is printed on the estimate. Never guess or invent a value; use null when it isn't there.
- quantities: every quantity tier with its total price for that quantity, as numbers (no $ or commas). If a price is per thousand or per unit, convert to the total for that quantity only when the estimate makes the math explicit; otherwise give the total price shown.
- specs: a short plain-text list, one item per line, covering finished/flat size, stock, inks front/back, coating/varnish, die, finishing/bindery, packing. Only items on the estimate.
- productType: FOLDING_CARTON for boxes/cartons/sleeves/packaging, COMMERCIAL_PRINT for brochures, books, mailers, cards, labels and other print. null if unclear.
- jobName: a short name for the job as a CSR would label it (e.g. "Chunks o Fruti 6-pack carton").
- estimateDate as YYYY-MM-DD.
If a salesperson's email is included, also read it for: customerPO, deliveryAddress (full ship-to address), paymentTerms (deposit50 = 50% deposit, prepaid = paid in full up front, net30 = Net 30 terms, cod = cash on delivery; null if not said), artworkStatus (ready = print-ready art attached or on hand, coming = customer is sending art, design = we are designing it, reprint = exact reprint; null if not said), dueDate (YYYY-MM-DD), and acceptedQuantity (the quantity the customer accepted, if the email says). Only use what the salesperson wrote for these, never the estimate's boilerplate. Use null when not said.
Return ONLY a JSON object with exactly these keys: customerName, contactName, estimateNumber, estimateDate, salesRep, jobName, productType, quantities, specs, dieNumber, notes, customerPO, deliveryAddress, paymentTerms, artworkStatus, dueDate, acceptedQuantity. No prose, no code fences.`;

export async function readEstimate(input: { base64?: string; mediaType?: string; text?: string; emailNote?: string }): Promise<EstimateRead | null> {
  const client = getClaude();
  if (!client) return null;
  const content: any[] = [];
  if (input.base64 && input.mediaType === "application/pdf") content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } });
  else if (input.base64 && /^image\/(png|jpeg|gif|webp)$/.test(input.mediaType || "")) content.push({ type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } });
  if (input.text && input.text.trim()) content.push({ type: "text", text: `Estimate text:\n${input.text.slice(0, 30000)}` });
  if (input.emailNote && input.emailNote.trim()) content.push({ type: "text", text: `The salesperson's email (their own words, above any forwarded estimate):\n${input.emailNote.slice(0, 6000)}` });
  if (!content.length) return null;
  content.push({ type: "text", text: "Extract the job-ticket fields from this estimate now." });
  try {
    const msg: any = await client.messages.create({ model: "claude-opus-4-8", max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content }] } as any);
    const raw = (msg.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const o = JSON.parse(json);
    const qs = Array.isArray(o.quantities) ? o.quantities.map((q: any) => ({ quantity: Math.round(Number(String(q.quantity).replace(/[^0-9.]/g, ""))) || 0, price: q.price === null || q.price === undefined || q.price === "" ? null : Number(String(q.price).replace(/[^0-9.]/g, "")) || null })).filter((q: any) => q.quantity > 0) : [];
    const s = (v: unknown) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
    return {
      customerName: s(o.customerName), contactName: s(o.contactName), estimateNumber: s(o.estimateNumber), estimateDate: s(o.estimateDate),
      salesRep: s(o.salesRep), jobName: s(o.jobName), productType: o.productType === "FOLDING_CARTON" || o.productType === "COMMERCIAL_PRINT" ? o.productType : null,
      quantities: qs, specs: s(o.specs), dieNumber: s(o.dieNumber), notes: s(o.notes),
      customerPO: s(o.customerPO), deliveryAddress: s(o.deliveryAddress),
      paymentTerms: ["deposit50", "prepaid", "net30", "cod"].includes(o.paymentTerms) ? o.paymentTerms : null,
      artworkStatus: ["ready", "coming", "design", "reprint"].includes(o.artworkStatus) ? o.artworkStatus : null,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(o.dueDate || "")) ? String(o.dueDate) : null,
      acceptedQuantity: Number(o.acceptedQuantity) > 0 ? Math.round(Number(o.acceptedQuantity)) : null,
    };
  } catch (e) {
    console.error("[estimate-reader] failed", e);
    return null;
  }
}
