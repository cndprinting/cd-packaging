import { createHmac } from "crypto";
import { AR_FROM, BASE_URL, floridaTax, newPayToken } from "@/lib/ar";
import { linkLeadToCompany } from "@/lib/lead-company";
import { nextInvoiceNumber } from "@/lib/press-gate";

/**
 * "Accept this quote" (Benjy 11/22/26, option A).
 *
 * Jessica's quote email to the customer carries a link. When the customer accepts on that page:
 *   1. the acceptance is written on the lead and Jessica stops her follow-ups,
 *   2. the owners are told,
 *   3. a DRAFT deposit invoice lands in accounting's "Drafts to review" (amount prefilled only
 *      when the quote had a typed price; Mary's PDF quotes have none, so accounting enters it),
 *   4. accounting checks it and sends it, and the customer pays on the existing /pay page.
 * Nothing is sent to the customer and nothing can be paid until accounting approves the draft.
 *
 * OFF by default (Benjy 11/22/26: not until the new website launches and accounting has been told).
 * Set QUOTE_ACCEPT=1 to add the link to the quote emails. While off, no email points at the page.
 */
export const ACCEPT_ON = process.env.QUOTE_ACCEPT === "1";

const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A link token for the customer. Deliberately NOT the lead's agentToken, which opens owner actions. */
export function acceptToken(leadId: string): string {
  return createHmac("sha256", process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production").update("accept:" + leadId).digest("hex").slice(0, 32);
}
export const acceptUrl = (leadId: string) => `${BASE_URL}/accept?id=${encodeURIComponent(leadId)}&t=${acceptToken(leadId)}`;

/** The line added under a quote email. Plain link, in the sender's voice. */
export function acceptLine(lead: { id: string }): string {
  if (!ACCEPT_ON) return "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;"><p>Ready to go ahead? <a href="${acceptUrl(lead.id)}">Accept this quote here</a> and we will send your deposit invoice.</p></div>`;
}

/** Largest dollar figure typed in the quote text. 0 when the price only lives in Mary's PDF. */
export function typedAmount(q: string | null | undefined): number {
  const nums = (String(q || "").match(/\$\s?[\d,]+(?:\.\d{1,2})?/g) || []).map((s) => parseFloat(s.replace(/[^0-9.]/g, ""))).filter((n) => !isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

export async function acceptanceOf(prisma: any, leadId: string) {
  return prisma.leadNote.findFirst({ where: { leadId, source: "accept" }, orderBy: { createdAt: "asc" } });
}

export type AcceptInput = { name?: string; option?: string; po?: string; note?: string };

export async function acceptQuote(prisma: any, lead: any, input: AcceptInput): Promise<{ already: boolean; invoiceNumber: string | null }> {
  if (await acceptanceOf(prisma, lead.id)) return { already: true, invoiceNumber: null };

  const by = (input.name || lead.contactName || "the customer").trim().slice(0, 120);
  const option = (input.option || "").trim().slice(0, 300), po = (input.po || "").trim().slice(0, 60), note = (input.note || "").trim().slice(0, 1500);
  const when = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  // The marker first, so a double click cannot draft two invoices.
  const marker = await prisma.leadNote.create({ data: { leadId: lead.id, kind: "system", source: "accept", authorName: "Website", body: `[Website] Quote accepted online by ${by} on ${when}.` } });

  const companyId: string = await linkLeadToCompany(prisma, lead);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true, paymentTerms: true } });
  const terms = company?.paymentTerms || "deposit50";
  const product = lead.productName || lead.productCategory || "order";
  const subtotal = round2(typedAmount(lead.agentQuote));

  // Customers on Net 30 or COD pay no deposit, so there is nothing to draft for them.
  let invoiceNumber: string | null = null;
  if (terms === "deposit50" || terms === "prepaid") {
    const taxAmount = floridaTax(subtotal, false);
    const total = round2(subtotal + taxAmount);
    const depositPercent = terms === "prepaid" ? 100 : 50;
    const inv = await prisma.invoice.create({ data: {
      invoiceNumber: await nextInvoiceNumber(prisma), status: "draft", kind: "prebill",
      customerName: company?.name || lead.companyName, companyId, contactEmail: lead.contactEmail || null,
      description: `Quote accepted online · ${product}${option ? ` · ${option}` : ""}`, poNumber: po || null,
      subtotal, taxRate: 7, taxAmount, shipping: 0, total, depositPercent, depositAmount: round2(total * depositPercent / 100),
      dueDate: new Date(Date.now() + 7 * 86400e3), payToken: newPayToken(), createdBy: "Website acceptance",
      notes: subtotal > 0
        ? `Drafted when ${by} accepted the quote online on ${when}. The amount ${money(subtotal)} was read from the quote text: check it against Mary's estimate, then approve and send.`
        : `Drafted when ${by} accepted the quote online on ${when}. The quote went out as Mary's PDF, so there is no amount here yet: enter it from her estimate, then approve and send.`,
    } as any });
    invoiceNumber = inv.invoiceNumber;
  }

  const detail = [option ? `Accepting: ${option}` : "", po ? `PO: ${po}` : "", note ? `Note: ${note}` : "",
    invoiceNumber ? `Draft deposit invoice ${invoiceNumber} is waiting for accounting.` : `Customer terms are ${terms}, so no deposit invoice was drafted.`].filter(Boolean).map((x) => x.replace(/[.\s]+$/, "")).join(". ") + ".";
  await prisma.leadNote.update({ where: { id: marker.id }, data: { body: `[Website] Quote accepted online by ${by} on ${when}. ${detail}` } });
  await prisma.lead.update({ where: { id: lead.id }, data: {
    agentStatus: "owner_handling", stage: "Quote accepted online", agentNextAt: null,
    agentLog: `${lead.agentLog ? lead.agentLog + "\n" : ""}${new Date().toISOString().slice(0, 16).replace("T", " ")} Quote accepted online by ${by}; follow-ups stopped`,
  } });

  // Tell the owners, and tell accounting a draft is waiting. A failed email never undoes the acceptance.
  const rows = `<p><strong>${esc(lead.companyName)}</strong> accepted the quote online.</p>
    <p>Accepted by: ${esc(by)}${lead.contactEmail ? ` (${esc(lead.contactEmail)})` : ""}<br>For: ${esc(product)}${option ? `<br>Accepting: ${esc(option)}` : ""}${po ? `<br>PO: ${esc(po)}` : ""}${note ? `<br>Note: ${esc(note)}` : ""}</p>`;
  const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">${inner}</div>`;
  try {
    const { agentSend, OWNERS } = await import("@/lib/agent/agent");
    await agentSend({ to: OWNERS, subject: `Quote accepted: ${lead.companyName}`, body: wrap(`${rows}
      <p>${invoiceNumber ? `A draft deposit invoice (${invoiceNumber}) is in accounting's Drafts to review. It goes to the customer once accounting approves and sends it.` : `This customer is on ${esc(terms)} terms, so no deposit invoice was drafted.`}</p>
      <p>Jessica has stopped following up. Replies from the customer now come to the lead's owner.</p>
      <p><a href="${BASE_URL}/dashboard/pipeline">Open the pipeline</a></p>`) });
  } catch (e) { console.error("[Godzilla ACCEPT] owner notice failed:", e); }
  if (invoiceNumber) {
    try {
      const acct = await prisma.user.findMany({ where: { role: "ACCOUNTING", isActive: true }, select: { email: true } });
      const to = acct.map((u: any) => u.email).filter(Boolean);
      if (to.length) {
        const { sendEmail } = await import("@/lib/email/graph-client");
        await sendEmail({ from: AR_FROM, to, subject: `Deposit invoice to review: ${lead.companyName} (quote accepted online)`, body: wrap(`${rows}
          <p>Draft invoice <strong>${invoiceNumber}</strong> is in Drafts to review. ${subtotal > 0 ? `The amount ${money(subtotal)} was read from the quote text. Please check it against Mary's estimate.` : `The quote went out as Mary's PDF, so the draft has no amount yet. Please enter it from her estimate.`} Then approve and send it, and the customer can pay online.</p>
          <p><a href="${BASE_URL}/dashboard/invoices">Open Invoices</a></p>`) });
      }
    } catch (e) { console.error("[Godzilla ACCEPT] accounting notice failed:", e); }
  }
  return { already: false, invoiceNumber };
}
