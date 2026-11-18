// Server-only shipping helpers (partials, freight). Kept apart from lib/shipping, which the page imports.
// ─── Partials + freight (Shayla 11/18/26) ───────────────────────────────────
const r2 = (n: number) => Math.round(n * 100) / 100;
const qtyOf = (s: { items?: { quantity: number }[] }) => (s.items || []).reduce((t, i) => t + (Number(i.quantity) || 0), 0);

/** Ordered vs delivered vs balance for each job, from every shipment's line quantities. */
export async function jobTallies(prisma: any, jobIds: string[]) {
  const ids = [...new Set(jobIds.filter(Boolean))];
  const m = new Map<string, { ordered: number; shipped: number; remaining: number; shipments: number }>();
  if (!ids.length) return m;
  const [jobs, ships] = await Promise.all([
    prisma.job.findMany({ where: { id: { in: ids } }, select: { id: true, quantity: true } }),
    prisma.shipment.findMany({ where: { jobId: { in: ids } }, select: { jobId: true, items: { select: { quantity: true } } } }),
  ]);
  for (const j of jobs) {
    const mine = ships.filter((s: any) => s.jobId === j.id);
    const shipped = mine.reduce((t: number, s: any) => t + qtyOf(s), 0);
    m.set(j.id, { ordered: j.quantity || 0, shipped, remaining: Math.max(0, (j.quantity || 0) - shipped), shipments: mine.length });
  }
  return m;
}

/** What the packing slip says about this delivery: partial (with what's left) or the balance. */
export async function deliveryLabel(prisma: any, s: { id: string; jobId: string | null; createdAt: Date | string; items?: { quantity: number }[] }) {
  if (!s.jobId) return null;
  const job = await prisma.job.findUnique({ where: { id: s.jobId }, select: { quantity: true } });
  if (!job?.quantity) return null;
  const earlier = await prisma.shipment.findMany({ where: { jobId: s.jobId, createdAt: { lt: new Date(s.createdAt) }, id: { not: s.id } }, select: { items: { select: { quantity: true } } } });
  const before = earlier.reduce((t: number, x: any) => t + qtyOf(x), 0);
  const after = before + qtyOf(s);
  if (after < job.quantity) return { kind: "partial", text: `PARTIAL DELIVERY: ${after.toLocaleString()} of ${job.quantity.toLocaleString()} delivered${before ? " to date" : ""}, ${(job.quantity - after).toLocaleString()} to follow` };
  if (before > 0) return { kind: "balance", text: `BALANCE: completes the order of ${job.quantity.toLocaleString()}` };
  return null;
}

/** Put the shipment's freight cost on its invoice's freight line while the invoice hasn't gone to
 *  the customer. Moves it if the shipment was relinked, adjusts it if the cost changed. */
export async function syncFreight(prisma: any, shipmentId: string, byName: string) {
  const s = await prisma.shipment.findUnique({ where: { id: shipmentId } });
  if (!s) return null;
  const cost = r2(Math.max(0, Number(s.freightCost) || 0));
  const editable = (inv: any) => inv && !["paid", "cancelled"].includes(inv.status) && (!inv.sentAt || inv.status === "draft");
  const setFreight = async (invId: string, delta: number) => {
    const inv = await prisma.invoice.findUnique({ where: { id: invId } });
    if (!editable(inv)) return false;
    const shipping = r2(Math.max(0, (inv.shipping || 0) + delta));
    const total = r2(inv.subtotal + inv.taxAmount + shipping);
    await prisma.invoice.update({ where: { id: invId }, data: { shipping, total, depositAmount: r2(total * (inv.depositPercent || 0) / 100), notes: `${inv.notes ? inv.notes + "\n" : ""}Freight ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} from shipment ${s.shipmentNumber} (${byName})`.slice(-4000) } });
    try { const { applyPayments } = await import("@/lib/ar"); await applyPayments(prisma, invId); } catch { /* totals saved either way */ }
    return true;
  };
  // Relinked to another invoice: take it back off the old one.
  if (s.freightInvoiceId && s.freightInvoiceId !== s.invoiceId && (s.freightBilled || 0) > 0) {
    await setFreight(s.freightInvoiceId, -(s.freightBilled || 0));
    await prisma.shipment.update({ where: { id: s.id }, data: { freightBilled: 0, freightInvoiceId: null } });
    s.freightBilled = 0; s.freightInvoiceId = null;
  }
  if (!s.invoiceId) {
    const note = cost > 0 ? "Freight recorded. Link the invoice and it goes on the freight line." : null;
    await prisma.shipment.update({ where: { id: s.id }, data: { freightNote: note } });
    return note;
  }
  const delta = r2(cost - (s.freightInvoiceId === s.invoiceId ? (s.freightBilled || 0) : 0));
  if (delta === 0) return s.freightNote;
  if (await setFreight(s.invoiceId, delta)) {
    const note = cost > 0 ? `Freight $${cost.toFixed(2)} is on invoice ${s.invoiceNumber || ""}` : null;
    await prisma.shipment.update({ where: { id: s.id }, data: { freightBilled: cost, freightInvoiceId: s.invoiceId, freightNote: note } });
    return note;
  }
  const note = `Invoice ${s.invoiceNumber || ""} already went to the customer, so the $${cost.toFixed(2)} freight was not added. Accounting was emailed.`;
  await prisma.shipment.update({ where: { id: s.id }, data: { freightNote: note } });
  try {
    const acct = await prisma.user.findMany({ where: { role: "ACCOUNTING", isActive: true }, select: { email: true } });
    const to = acct.map((u: any) => u.email).filter(Boolean);
    if (to.length) {
      const { sendEmail } = await import("@/lib/email/graph-client");
      const { AR_FROM } = await import("@/lib/ar");
      await sendEmail({ from: AR_FROM, to, subject: `Freight to bill: ${s.customerName || ""} ${s.jobNumber ? `job ${s.jobNumber}` : s.shipmentNumber}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${byName} recorded <b>$${cost.toFixed(2)}</b> freight on shipment ${s.shipmentNumber} for ${s.customerName || ""}${s.jobNumber ? `, job ${s.jobNumber}` : ""}.</p><p>Invoice ${s.invoiceNumber || ""} was already sent, so it wasn't added there. Please add it to the balance invoice.</p><p><a href="https://packaging.cndprinting.com/dashboard/invoices">Open Invoices</a></p></div>` });
    }
  } catch (e) { console.error("freight email failed", e); }
  return note;
}
