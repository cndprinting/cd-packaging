// Forward Mary's estimate to Jessica -> it lands in the CSR queue (Benjy 11/17:
// "isn't that the fastest approach of all?"). A salesperson or CSR forwards the
// estimate email to Jessica's mailbox with "New job" in the subject and adds
// whatever they know (PO, ship-to, terms, artwork). AI reads the estimate and
// their note, and a filled-in handoff appears in the CSR queue. Jessica never
// replies to a customer from this path; the only email is an internal receipt
// to the person who forwarded it.
import { readEstimate } from "@/lib/estimate-reader";
import { TERMS } from "@/lib/press-gate";

const SENDER_ROLES = ["SALES_REP", "SALES_MANAGER", "OWNER", "ADMIN", "GM", "CSR"];
export const isNewJobSubject = (subject?: string | null) => /\bnew\s*job\b/i.test(subject || "");

export async function matchCustomers(prisma: any, name?: string | null) {
  if (!name) return [];
  const words = name.replace(/\b(inc|llc|corp|co|company|the)\b\.?/gi, " ").split(/[^A-Za-z0-9&']+/).filter((w) => w.length > 2).slice(0, 3);
  if (!words.length) return [];
  const cos = await prisma.company.findMany({
    where: { type: "customer", isActive: true, AND: words.map((w: string) => ({ name: { contains: w, mode: "insensitive" } })) },
    select: { id: true, name: true, address: true, city: true, state: true, zip: true, contacts: { select: { name: true, email: true }, orderBy: { isPrimary: "desc" }, take: 2 } },
    take: 5,
  });
  return cos.map((c: any) => ({ id: c.id, name: c.name, email: c.contacts.find((x: any) => x.email)?.email || null, contact: c.contacts[0]?.name || null, address: [c.address, [c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join("\n") || null }));
}

/** Returns true when the message was a job intake (handled or already handled), so the agent skips it. */
export async function handleNewJobEmail(prisma: any, client: any, m: any, mailbox: string, opts: { notify?: boolean; preview?: (data: any) => void } = {}): Promise<boolean> {
  const notify = opts.notify !== false; // tests pass false so no one gets emailed
  if (!isNewJobSubject(m.subject)) return false;
  const from = String(m.from?.emailAddress?.address || "").toLowerCase();
  if (!from.endsWith("@cndprinting.com")) return false;
  const sender = await prisma.user.findFirst({ where: { email: { equals: from, mode: "insensitive" }, isActive: true }, select: { id: true, name: true, email: true, role: true } });
  if (!sender || !SENDER_ROLES.includes(sender.role)) return false;

  const msgKey = m.internetMessageId || m.id;
  if (!opts.preview && await prisma.jobHandoff.findUnique({ where: { sourceMsgId: msgKey } })) return true; // already in the queue

  // Their note (above the forward) plus the whole forwarded email, and the estimate file.
  let note = "", body = m.bodyPreview || "";
  try {
    const full: any = await client.api(`/users/${mailbox}/messages/${m.id}`).header("Prefer", 'outlook.body-content-type="text"').select("body,uniqueBody").get();
    body = full?.body?.content || body;
    note = full?.uniqueBody?.content || "";
  } catch { /* fall back to the preview */ }
  let file: { name: string; contentType: string; base64Content: string } | null = null;
  if (m.hasAttachments) {
    try {
      const { fetchAttachments } = await import("@/lib/email/graph-client");
      const atts = await fetchAttachments(mailbox, m.id);
      file = atts.find((a) => /pdf/i.test(a.contentType) || /\.pdf$/i.test(a.name)) || atts.find((a) => /^image\/(png|jpe?g|gif|webp)$/i.test(a.contentType)) || null;
      if (file && file.base64Content.length > 5_500_000) file = null;
    } catch { /* read the text only */ }
  }
  const read = await readEstimate({
    base64: file?.base64Content, mediaType: file ? (/pdf/i.test(file.contentType) || /\.pdf$/i.test(file.name) ? "application/pdf" : file.contentType.toLowerCase()) : undefined,
    text: body, emailNote: note,
  });
  if (!read) return false; // AI unavailable: leave the email alone so it can be retried

  const matches = await matchCustomers(prisma, read.customerName);
  const co = matches.length === 1 ? matches[0] : null;
  const tier = read.acceptedQuantity ? read.quantities.find((q) => q.quantity === read.acceptedQuantity) || { quantity: read.acceptedQuantity, price: null } : read.quantities.length === 1 ? read.quantities[0] : null;
  const missing: string[] = [];
  if (!co) missing.push(matches.length > 1 ? `which customer (${matches.map((x: any) => x.name).join(" or ")})` : `the customer record${read.customerName ? ` for "${read.customerName}"` : ""}`);
  if (!tier) missing.push(read.quantities.length > 1 ? `which quantity was accepted (${read.quantities.map((q) => q.quantity.toLocaleString()).join(" / ")})` : "quantity");
  if (!tier?.price) missing.push("accepted price");
  if (!read.artworkStatus) missing.push("artwork status");
  if (!read.paymentTerms) missing.push("payment terms");
  const deliver = read.deliveryAddress || co?.address || "";
  if (!deliver) missing.push("delivery address");

  const data = {
    status: "submitted", source: "email", sourceMsgId: msgKey,
    companyId: co?.id || null, customerName: co?.name || read.customerName || "Unknown customer",
    submittedById: sender.id, submittedByName: sender.name,
    salesRepId: ["SALES_REP", "SALES_MANAGER", "OWNER", "ADMIN"].includes(sender.role) ? sender.id : null,
    estimateNumber: read.estimateNumber, jobName: read.jobName || (m.subject || "New job").replace(/^((re|fw|fwd):\s*)+/i, "").slice(0, 200),
    specs: [read.specs, read.dieNumber ? `Die ${read.dieNumber}` : null, read.notes ? `Estimate notes: ${read.notes}` : null].filter(Boolean).join("\n") || null,
    quantity: tier?.quantity || null, quotedPrice: tier?.price || null,
    productType: read.productType || "FOLDING_CARTON", customerPO: read.customerPO || null,
    dueDate: read.dueDate ? new Date(read.dueDate) : null,
    artworkStatus: read.artworkStatus || "", paymentTerms: read.paymentTerms || "", deliveryAddress: deliver,
    specialNotes: note.trim() ? note.trim().slice(0, 2000) : null,
    estimateFileName: file?.name || (read.estimateNumber ? `estimate ${read.estimateNumber}` : "forwarded email"),
    estimateRead: JSON.stringify(read).slice(0, 8000),
    intakeNote: missing.length ? `Still needed: ${missing.join(", ")}.` : null,
  };
  if (opts.preview) { opts.preview({ ...data, customerMatches: matches.map((x: any) => x.name), read }); return true; }
  const h = await prisma.jobHandoff.create({ data });

  try { await client.api(`/users/${mailbox}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
  if (notify) try {
    const { sendEmail } = await import("@/lib/email/graph-client");
    const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
    const what = `${h.customerName}: ${h.jobName}${h.quantity ? `, ${h.quantity.toLocaleString()}` : ""}${h.quotedPrice ? ` at ${money(h.quotedPrice)}` : ""}${h.paymentTerms ? `, ${TERMS[h.paymentTerms]}` : ""}`;
    // Receipt to whoever forwarded it (internal only).
    await sendEmail({ from: mailbox, to: sender.email, subject: `In the CSR queue: ${h.customerName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Got it. This is in the CSR queue:</p><p>${what}</p>${missing.length ? `<p><b>The CSR will still need:</b> ${missing.join(", ")}. Reply with it, or add it on the Jobs page.</p>` : "<p>Everything the CSR needs is there.</p>"}<p><a href="https://packaging.cndprinting.com/dashboard/jobs">Open the Jobs page</a></p></div>` });
    const csrs = await prisma.user.findMany({ where: { role: "CSR", isActive: true }, select: { email: true } });
    const to = csrs.map((u: any) => u.email).filter((e: string) => e && e.toLowerCase() !== sender.email.toLowerCase());
    if (to.length) await sendEmail({ from: mailbox, to, subject: `New job to enter: ${h.customerName}, ${h.jobName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${sender.name} forwarded Mary's estimate.</p><p>${what}</p>${missing.length ? `<p>Still needed: ${missing.join(", ")}.</p>` : ""}<p><a href="https://packaging.cndprinting.com/dashboard/jobs">Open it on the Jobs page</a> to review and enter it.</p></div>` });
  } catch { /* the queue item exists either way */ }
  console.log("[estimate intake] handoff", h.id, "from", sender.email, missing.length ? `missing: ${missing.join("; ")}` : "complete");
  return true;
}
