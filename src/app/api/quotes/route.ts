import { NextRequest, NextResponse } from "next/server";
import { repScope, repSeesQuote } from "@/lib/rep-scope";
import { AR_STANDALONE } from "@/lib/ar";
import { getSession } from "@/lib/session";

// No more demo quotes — real data only

// Notify a sourcing vendor's logins that a request is waiting (Benjy 6/20).
// Best-effort: emails each VENDOR user whose vendorName matches, from the
// acting C&D user's mailbox. Never throws — a failed email won't block assign.
async function notifyVendor(prisma: any, fromEmail: string | null | undefined, quote: any): Promise<number> {
  try {
    if (!quote?.sourcingVendor || !fromEmail) return 0;
    const users = await prisma.user.findMany({
      where: { role: "VENDOR", vendorName: quote.sourcingVendor, isActive: true },
      select: { email: true, name: true },
    });
    if (!users.length) return 0;
    const { sendEmail } = await import("@/lib/email/graph-client");
    const portalUrl = "https://packaging.cndprinting.com/portal/sourcing";
    let sent = 0;
    for (const u of users) {
      const r = await sendEmail({
        from: fromEmail, to: u.email,
        subject: `New sourcing request from C&D — ${quote.quoteNumber}`,
        body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <div style="padding: 20px;">
              <h2 style="margin: 0 0 12px;">New sourcing request from C&D Printing</h2>
              <p style="color:#444;">Hi ${u.name || ""}, there's a new item to quote in your portal:</p>
              <table style="width:100%; border-collapse:collapse; margin:12px 0;">
                <tr><td style="padding:6px 0; color:#888;">Request #</td><td style="padding:6px 0; font-weight:bold;">${quote.quoteNumber}</td></tr>
                <tr><td style="padding:6px 0; color:#888;">Item</td><td style="padding:6px 0;">${quote.productName || ""}</td></tr>
              </table>
              <a href="${portalUrl}" style="display:inline-block; background:#27AAE1; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Open Sourcing Portal</a>
              <p style="color:#999; font-size:12px; margin-top:20px;">Download the artwork, enter your landed cost (to St. Pete) per SKU, and submit. — C&D Printing</p>
            </div>
          </div>`,
      }).catch(() => ({ success: false }));
      if ((r as any)?.success) sent++;
    }
    return sent;
  } catch { return 0; }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    // 11/22/26 lock-down: this list (every quote, with prices and contacts) used to answer
    // anyone with no login. Staff see all; a vendor only its own sourcing requests; a customer
    // only its own company's quotes.
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    if (prisma) {
      // Single-quote fetch (used by the estimator to resume drafts).
      // Returns the full record incl. specs JSON so the form can rehydrate.
      if (id) {
        const q = await prisma.quote.findUnique({ where: { id } });
        if (!q) return NextResponse.json({ quotes: [] });
        if (session.role === "VENDOR" && q.sourcingVendor !== (session as any).vendorName) return NextResponse.json({ quotes: [] });
        if (session.role === "CUSTOMER" && (!session.companyId || q.companyId !== session.companyId)) return NextResponse.json({ quotes: [] });
        if (!repSeesQuote(await repScope(prisma, session), q)) return NextResponse.json({ quotes: [] });
        return NextResponse.json({ quotes: [{
          id: q.id, quoteNumber: q.quoteNumber, customerName: q.customerName,
          contactName: q.contactName, contactEmail: q.contactEmail,
          productType: q.productType, productName: q.productName, description: q.description,
          quantity: q.quantity, unitPrice: q.unitPrice, totalPrice: q.totalPrice,
          status: q.status.toLowerCase(), validUntil: q.validUntil?.toISOString().split("T")[0] || "",
          createdAt: q.createdAt.toISOString().split("T")[0],
          specs: q.specs,
          notes: q.notes,
          quoteRequestId: q.quoteRequestId,
          revision: q.revision,
          parentQuoteId: q.parentQuoteId,
          sourcingVendor: q.sourcingVendor, sourcingStatus: q.sourcingStatus,
          sourcingArtworkUrl: q.sourcingArtworkUrl, sourcingArtworkName: q.sourcingArtworkName,
          sourcingItems: q.sourcingItems,
          vendorLandedCost: q.vendorLandedCost, vendorQuoteFileUrl: q.vendorQuoteFileUrl,
          vendorQuoteFileName: q.vendorQuoteFileName, vendorQuoteNotes: q.vendorQuoteNotes,
          vendorQuoteUploadedAt: q.vendorQuoteUploadedAt?.toISOString() || null,
        }] });
      }
      // Vendor portal scoping (Benjy 6/16): a VENDOR-role login only sees
      // sourcing requests assigned to their vendorName.
      const where = session.role === "VENDOR"
        ? { sourcingVendor: (session as any).vendorName || " none" }
        : session.role === "CUSTOMER"
          ? { companyId: session.companyId || " none" }
          : await (async () => { const sc = await repScope(prisma, session); return sc ? { OR: [{ createdBy: sc.userId }, { companyId: { in: sc.companyIds } }] } : undefined; })();
      const quotes = await prisma.quote.findMany({ where, orderBy: { createdAt: "desc" } });
      if (quotes.length > 0) {
        return NextResponse.json({ quotes: quotes.map(q => ({
          id: q.id, quoteNumber: q.quoteNumber, customerName: q.customerName,
          contactName: q.contactName, contactEmail: q.contactEmail,
          productType: q.productType, productName: q.productName, description: q.description,
          quantity: q.quantity, unitPrice: q.unitPrice, totalPrice: q.totalPrice,
          status: q.status.toLowerCase(), validUntil: q.validUntil?.toISOString().split("T")[0] || "",
          createdAt: q.createdAt.toISOString().split("T")[0],
          // Light flag (no full specs in the list payload): which estimator
          // built this quote — routes Resume/Edit to Classic vs. the wizard.
          estimateMethod: q.specs && q.specs.includes('"method":"flexpack"') ? "flexpack"
            : q.specs && q.specs.includes('"method":"classic"') ? "classic" : "estimator",
          sourcingVendor: q.sourcingVendor, sourcingStatus: q.sourcingStatus,
          sourcingArtworkUrl: q.sourcingArtworkUrl, sourcingArtworkName: q.sourcingArtworkName,
          sourcingItems: q.sourcingItems,
          vendorLandedCost: q.vendorLandedCost, vendorQuoteFileUrl: q.vendorQuoteFileUrl,
          vendorQuoteFileName: q.vendorQuoteFileName, vendorQuoteNotes: q.vendorQuoteNotes,
        })), source: "database" });
      }
    }
  } catch { /* fallback */ }
  return NextResponse.json({ quotes: [], source: "empty" });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    // ── Change order (Mary 5/18) ────────────────────────────────────────
    // Reopen a converted job for a revision. We copy the job's current
    // quote into a fresh DRAFT (revision + 1) so the estimator can edit it
    // through the normal flow. Converting that draft re-syncs the job.
    if (body.changeOrderForJobId && prisma) {
      const original = await prisma.quote.findFirst({
        where: { convertedJobId: body.changeOrderForJobId },
        orderBy: { revision: "desc" },
      });
      if (!original) return NextResponse.json({ error: "No source quote found for this job" }, { status: 404 });
      const rootId = original.parentQuoteId || original.id;
      const newRev = original.revision + 1;
      const baseNum = original.quoteNumber.replace(/-R\d+$/, "");
      let quoteNumber = `${baseNum}-R${newRev}`;
      if (await prisma.quote.findUnique({ where: { quoteNumber } })) {
        quoteNumber = `${baseNum}-R${newRev}-${Date.now().toString().slice(-4)}`;
      }
      const draft = await prisma.quote.create({
        data: {
          quoteNumber,
          companyId: original.companyId,
          customerName: original.customerName,
          contactName: original.contactName,
          contactEmail: original.contactEmail,
          productType: original.productType,
          productName: original.productName,
          description: original.description,
          quantity: original.quantity,
          unitPrice: original.unitPrice,
          totalPrice: original.totalPrice,
          status: "DRAFT",
          validUntil: original.validUntil,
          notes: original.notes,
          createdBy: session.id,
          quoteRequestId: original.quoteRequestId,
          specs: original.specs,
          parentQuoteId: rootId,
          revision: newRev,
        },
      });
      return NextResponse.json({ quote: { id: draft.id, quoteNumber: draft.quoteNumber, revision: newRev } });
    }

    const { customerName, productType, productName, description, quantity, unitPrice, validUntil, contactName, contactEmail, notes, quoteRequestId, specs, sourcingVendor } = body;
    if (!customerName || !productName || !quantity) return NextResponse.json({ error: "Customer, product name, and quantity required" }, { status: 400 });

    if (!prisma) {
      // Demo fallback
      return NextResponse.json({ quote: { id: `q-${Date.now()}`, quoteNumber: `QT-2026-${Date.now() % 1000}`, ...body, totalPrice: (parseFloat(unitPrice) || 0) * (parseInt(quantity) || 0), status: "draft", createdAt: new Date().toISOString().split("T")[0] } });
    }

    // Resolve the customer to a real Company (Benjy 8/5). Quotes were being
    // created with a free-text customerName and no companyId, so nothing keyed
    // to the account — including the artwork on file — could follow the quote.
    let companyId: string | null = body.companyId || null;
    if (!companyId && customerName) {
      const co = await prisma.company.findFirst({
        where: { name: { equals: String(customerName).trim(), mode: "insensitive" } },
        select: { id: true },
      });
      companyId = co?.id || null;
    }

    const quoteCount = await prisma.quote.count();
    const quoteNumber = `QT-2026-${String(quoteCount + 10).padStart(3, "0")}`;
    const qty = parseInt(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber, customerName, companyId, contactName, contactEmail,
        productType: ["COMMERCIAL_PRINT", "FLEXIBLE_PACKAGING", "FOLDING_CARTON"].includes(productType) ? productType : "FOLDING_CARTON",
        productName, description, quantity: qty,
        unitPrice: price, totalPrice: price * qty,
        status: "DRAFT",
        validUntil: validUntil ? new Date(validUntil) : null,
        notes, createdBy: session.id,
        quoteRequestId: quoteRequestId || null,
        specs: specs || null,
        // Outsourced/wholesale flagged at creation (Benjy 6/20) — sets the
        // vendor so the quote is wholesale from the start.
        sourcingVendor: sourcingVendor || null,
        sourcingStatus: sourcingVendor ? "requested" : null,
      },
    });

    return NextResponse.json({ quote: { ...quote, status: "draft", validUntil: quote.validUntil?.toISOString().split("T")[0] || "", createdAt: quote.createdAt.toISOString().split("T")[0] } });
  } catch (error) {
    console.error("Quote POST error:", error);
    return NextResponse.json({ error: "Failed to create quote" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { id, status, quantity, customerNotes, specs: bodySpecs, customerName, productName, description, unitPrice } = body;
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ ok: true, status });

    // ── Vendor upload (Benjy 6/16) ──: a VENDOR-role login returns a landed
    // cost + quote file for a sourcing request assigned to their vendorName.
    if (body.vendorUpload) {
      const q = await prisma.quote.findUnique({ where: { id } });
      if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
      // Vendors can only touch requests assigned to them.
      if (session.role === "VENDOR" && q.sourcingVendor !== ((session as any).vendorName || null)) {
        return NextResponse.json({ error: "Not your sourcing request" }, { status: 403 });
      }
      // Multi-SKU: body.items = [{ id, landedCost, vendorNotes }] merged by id
      // into the stored line items; vendorLandedCost = sum (for quote math).
      let itemsUpdate: any = undefined;
      let sumLanded: number | undefined = undefined;
      if (Array.isArray(body.items)) {
        let existing: any[] = [];
        try { existing = q.sourcingItems ? JSON.parse(q.sourcingItems) : []; } catch {}
        // UPSERT by id: update matching stored lines with the vendor's full
        // submission; add any the vendor sent that aren't stored; keep any
        // C&D lines the vendor didn't touch. Robust even if stored was empty
        // or ids drifted (Benjy 6/20 — fixes costs not landing on C&D side).
        const existingById = new Map<string, any>(existing.map((it: any) => [it.id, it]));
        const submittedIds = new Set<string>();
        const upserted = body.items.map((s: any) => {
          submittedIds.add(s.id);
          const prev: any = existingById.get(s.id) || {};
          return {
            ...prev, ...s,
            landedCost: parseFloat(s.landedCost) || 0,
            unitCost: s.unitCost != null ? (parseFloat(s.unitCost) || 0) : prev.unitCost,
            moq: s.moq != null ? (parseFloat(s.moq) || 0) : prev.moq,
          };
        });
        const leftovers = existing.filter((it: any) => !submittedIds.has(it.id));
        const finalItems = [...upserted, ...leftovers];
        itemsUpdate = JSON.stringify(finalItems);
        sumLanded = finalItems.reduce((s: number, it: any) => s + (Number(it.landedCost) || 0), 0);
      }
      await prisma.quote.update({
        where: { id },
        data: {
          sourcingItems: itemsUpdate,
          vendorLandedCost: sumLanded != null ? sumLanded
            : (body.vendorLandedCost != null ? (parseFloat(body.vendorLandedCost) || 0) : undefined),
          vendorQuoteFileUrl: body.vendorQuoteFileUrl ?? undefined,
          vendorQuoteFileName: body.vendorQuoteFileName ?? undefined,
          vendorQuoteNotes: body.vendorQuoteNotes ?? undefined,
          vendorQuoteUploadedAt: new Date(),
          sourcingStatus: "quoted",
        },
      });
      return NextResponse.json({ ok: true, id });
    }

    // Vendors can't do anything else (no status changes, no specs edits).
    if (session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    // ── Internal sourcing assignment ──: assign/clear a vendor on a quote.
    if (body.assignVendor !== undefined) {
      const updated = await prisma.quote.update({
        where: { id },
        data: {
          sourcingVendor: body.assignVendor || null,
          sourcingStatus: body.assignVendor ? "requested" : null,
        },
      });
      // Auto-notify the vendor that a request is waiting (best-effort).
      let notified = 0;
      if (body.assignVendor) notified = await notifyVendor(prisma, session.email, updated);
      return NextResponse.json({ ok: true, id, notified });
    }

    // ── Internal: re-notify the assigned vendor (manual "Notify" button) ──
    if (body.notifyVendor) {
      const q2 = await prisma.quote.findUnique({ where: { id } });
      const notified = await notifyVendor(prisma, session.email, q2);
      return NextResponse.json({ ok: true, id, notified });
    }

    // ── Internal: save the light wholesale fulfillment checklist (PO/recv/
    // ship/invoice/payable). Lives on the quote — no Job created. ──
    if (body.sourcingFulfillment !== undefined) {
      await prisma.quote.update({
        where: { id },
        data: { sourcingFulfillment: JSON.stringify(body.sourcingFulfillment || {}) },
      });
      return NextResponse.json({ ok: true, id });
    }

    // ── Internal: Mark Won / Lost / Reopen on a sourcing quote (Benjy 6/20).
    // Drives Martin's Won/Lost tabs without forcing a manufacturing job. On
    // Won we also auto-create the customer invoice so the deal enters the
    // normal Invoices/Stripe billing flow (Benjy 6/23). ──
    if (body.sourcingOutcome) {
      const map: Record<string, string> = { won: "won", lost: "lost", reopen: "priced" };
      const next = map[body.sourcingOutcome] || "priced";
      const q = await prisma.quote.findUnique({ where: { id } });
      let invoiceId = q?.sourcingInvoiceId || null;
      let invoiceNumber: string | null = null;

      // Create the customer invoice once, only when winning a priced quote.
      // Skipped while invoicing runs standalone (Benjy 11/10): quotes are test data.
      if (!AR_STANDALONE && body.sourcingOutcome === "won" && q && !q.sourcingInvoiceId && q.totalPrice > 0) {
        const subtotal = q.totalPrice;
        const taxRate = 7;
        const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
        const total = subtotal + taxAmount;
        const count = await prisma.invoice.count();
        invoiceNumber = `INV-${String(count + 1000).padStart(5, "0")}`;
        const invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            customerName: q.customerName,
            contactEmail: q.contactEmail,
            companyId: q.companyId,
            description: `Wholesale — ${q.productName} (sourced via ${q.sourcingVendor})`,
            subtotal, taxRate, taxAmount, total,
            depositPercent: 50,
            depositAmount: Math.round(total * 0.5 * 100) / 100,
            createdBy: session.id,
          },
        });
        invoiceId = invoice.id;
      }

      await prisma.quote.update({ where: { id }, data: { sourcingStatus: next, ...(invoiceId ? { sourcingInvoiceId: invoiceId } : {}) } });
      return NextResponse.json({ ok: true, id, sourcingStatus: next, invoiceId, invoiceNumber });
    }

    // ── Internal: lock the marked-up vendor cost in as the customer quote
    // price (Benjy 6/16 — step E→F). Saves markup % + sets the real quote
    // price so the normal Send/Print flow goes to the customer. ──
    if (body.setSourcingPrice) {
      const cur = await prisma.quote.findUnique({ where: { id } });
      const qty = cur?.quantity || 1;
      const price = parseFloat(body.customerPrice) || 0;
      await prisma.quote.update({
        where: { id },
        data: {
          sourcingMarkupPct: body.markupPct != null ? (parseFloat(body.markupPct) || 0) : undefined,
          sourcingStatus: "priced",
          totalPrice: price,
          unitPrice: qty ? price / qty : price,
        },
      });
      return NextResponse.json({ ok: true, id });
    }

    // ── Internal: save the SKU line items (add/edit/remove, artwork,
    // C&D-edited landed costs). Benjy 6/16 multi-SKU + cost editing. ──
    if (body.sourcingItems !== undefined) {
      const items = Array.isArray(body.sourcingItems) ? body.sourcingItems : [];
      const sumLanded = items.reduce((s: number, it: any) => s + (Number(it.landedCost) || 0), 0);
      await prisma.quote.update({
        where: { id },
        data: {
          sourcingItems: JSON.stringify(items),
          vendorLandedCost: sumLanded > 0 ? sumLanded : undefined,
        },
      });
      return NextResponse.json({ ok: true, id });
    }

    // ── Internal: attach artwork for the vendor to quote against ──
    if (body.sourcingArtwork !== undefined) {
      await prisma.quote.update({
        where: { id },
        data: {
          sourcingArtworkUrl: body.sourcingArtwork?.url || null,
          sourcingArtworkName: body.sourcingArtwork?.name || null,
        },
      });
      return NextResponse.json({ ok: true, id });
    }

    // Draft-update path: when the estimator saves an in-progress quote with
    // an existing id, we update specs + summary fields without changing the
    // status (keeps it as DRAFT). Allows Mary to step away and resume.
    if (bodySpecs && !status) {
      const updates: any = { specs: bodySpecs };
      if (customerName !== undefined) updates.customerName = customerName;
      if (productName !== undefined) updates.productName = productName;
      if (description !== undefined) updates.description = description;
      // Quote-letter notes (Classic estimator sends these on draft updates
      // so the customer letter stays in sync — Mary 7/21).
      if (body.notes !== undefined) updates.notes = body.notes;
      if (quantity !== undefined) updates.quantity = parseInt(quantity) || 0;
      if (unitPrice !== undefined) {
        const u = parseFloat(unitPrice) || 0;
        updates.unitPrice = u;
        const q = updates.quantity ?? (await prisma.quote.findUnique({ where: { id } }))?.quantity ?? 0;
        if (q) updates.totalPrice = u * q;
      }
      await prisma.quote.update({ where: { id }, data: updates });
      return NextResponse.json({ ok: true, id });
    }

    if (!status) return NextResponse.json({ error: "ID and status required" }, { status: 400 });

    const statusMap: Record<string, string> = { draft: "DRAFT", sent: "SENT", approved: "APPROVED", rejected: "REJECTED", converted: "CONVERTED", archived: "ARCHIVED" };
    const dbStatus = statusMap[status] || status;

    // If quantity is being updated (from volume picker), update quote first
    if (quantity && quantity > 0) {
      const currentQuote = await prisma.quote.findUnique({ where: { id } });
      if (currentQuote) {
        // Recalculate price based on new quantity using per-unit price
        const perUnit = currentQuote.unitPrice || (currentQuote.totalPrice / currentQuote.quantity);
        const newTotal = perUnit * quantity;
        await prisma.quote.update({ where: { id }, data: { quantity, totalPrice: Math.round(newTotal * 100) / 100 } });
      }
    }

    await prisma.quote.update({
      where: { id },
      data: {
        status: dbStatus as "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "CONVERTED" | "ARCHIVED",
        ...(customerNotes !== undefined ? { customerNotes } : {}),
      },
    });

    // If converting to job, create the job
    if (status === "converted") {
      const quote = await prisma.quote.findUnique({ where: { id } });

      // ── Change order re-sync (Mary 5/18) ──: a revised quote (parentQuoteId
      // set) updates the EXISTING job in place rather than spawning a new one.
      if (quote && quote.parentQuoteId) {
        const rootQuote = await prisma.quote.findUnique({ where: { id: quote.parentQuoteId } });
        const targetJobId = rootQuote?.convertedJobId;
        if (targetJobId) {
          let specs: Record<string, string> = {};
          if (quote.specs) { try { specs = JSON.parse(quote.specs); } catch {} }
          const jt: any = (specs as any).jobTicket || {};
          const parseDim = (key: "width" | "height") => {
            if (!specs.dimensions) return null;
            const parts = String(specs.dimensions).split("x");
            const v = parseFloat(key === "width" ? parts[0] : parts[1]);
            return isFinite(v) ? v : null;
          };
          await prisma.job.update({
            where: { id: targetJobId },
            data: {
              name: quote.productName,
              description: quote.description,
              quantity: quote.quantity,
              quotedPrice: quote.totalPrice,
              estimatedCost: quote.totalPrice,
              estimateNumber: quote.quoteNumber,
              flatSizeWidth: jt.flatSizeWidth ?? undefined,
              flatSizeHeight: jt.flatSizeHeight ?? undefined,
              finishedWidth: jt.finishedWidth ?? parseDim("width") ?? undefined,
              finishedHeight: jt.finishedHeight ?? parseDim("height") ?? undefined,
              numberUp: jt.numberUp ?? undefined,
              stockDescription: jt.stockDescription || specs.paperStock || specs.stockDescription || undefined,
              inkFront: jt.inkFront ?? undefined,
              inkBack: jt.inkBack ?? undefined,
              coating: jt.coating ?? specs.finishing ?? undefined,
              binderyFold: jt.binderyFold !== undefined ? !!jt.binderyFold : undefined,
              binderyStitch: jt.binderyStitch !== undefined ? !!jt.binderyStitch : undefined,
              binderyScore: jt.binderyScore !== undefined ? !!jt.binderyScore : undefined,
              binderyDrill: jt.binderyDrill !== undefined ? !!jt.binderyDrill : undefined,
              binderyGlue: jt.binderyGlue !== undefined ? !!jt.binderyGlue : undefined,
              binderyNotes: jt.binderyNotes ?? undefined,
            },
          });
          await prisma.quote.update({ where: { id }, data: { convertedJobId: targetJobId } });
          // Refresh multi-part line items from the revised specs.
          const parts: any[] = Array.isArray((specs as any).parts) ? (specs as any).parts : [];
          if (parts.length > 0) {
            await prisma.jobLineItem.deleteMany({ where: { jobId: targetJobId } }).catch(() => {});
            await prisma.jobLineItem.createMany({
              data: parts.map((p, idx) => ({
                jobId: targetJobId,
                description: `${p.name || `Part ${idx + 1}`}`,
                quantity: Math.ceil(Number(quote.quantity) * (1 + (Number(p.spoilagePct) || 0) / 100)),
                flatSize: (p.flatWidth && p.flatHeight) ? `${p.flatWidth}x${p.flatHeight}` : null,
                sortOrder: idx,
              })),
            }).catch(() => {});
          }
          return NextResponse.json({ ok: true, status, changeOrder: true, jobId: targetJobId });
        }
      }

      if (quote && !quote.parentQuoteId) {
        // Generate unique job and order numbers using timestamp to avoid collisions
        const ts = Date.now().toString().slice(-6);
        const jobCount = await prisma.job.count();
        const jobNumber = `PKG-2026-${String(jobCount + 200).padStart(3, "0")}`;
        const orderCount = await prisma.order.count();
        const orderNumber = `ORD-${String(orderCount + 30000).padStart(5, "0")}`;

        // Verify uniqueness, fall back to timestamp if collision
        const existingJob = await prisma.job.findUnique({ where: { jobNumber } });
        const finalJobNumber = existingJob ? `PKG-2026-${ts}` : jobNumber;
        const existingOrder = await prisma.order.findUnique({ where: { orderNumber } });
        const finalOrderNumber = existingOrder ? `ORD-${ts}` : orderNumber;

        // Find or create company
        let companyId = quote.companyId;
        if (!companyId) {
          const slug = quote.customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") || `customer-${Date.now()}`;
          let company = await prisma.company.findUnique({ where: { slug } });
          if (!company) {
            try {
              company = await prisma.company.create({ data: { name: quote.customerName, slug: `${slug}-${Date.now()}` } });
            } catch {
              company = await prisma.company.create({ data: { name: quote.customerName, slug: `cust-${Date.now()}` } });
            }
          }
          companyId = company.id;
        }

        const order = await prisma.order.create({ data: { orderNumber: finalOrderNumber, companyId, status: "ARTWORK_RECEIVED", priority: "NORMAL", dueDate: quote.validUntil, poNumber: quote.contactEmail ? undefined : undefined } });

        // Parse specs JSON if available
        let specs: Record<string, string> = {};
        if (quote.specs) { try { specs = JSON.parse(quote.specs); } catch {} }

        // jobTicket block (rich) takes precedence over legacy loose specs fields
        const jt: any = (specs as any).jobTicket || {};
        const parseDim = (key: "width" | "height") => {
          if (!specs.dimensions) return null;
          const parts = String(specs.dimensions).split("x");
          const v = parseFloat(key === "width" ? parts[0] : parts[1]);
          return isFinite(v) ? v : null;
        };

        // Lazy-load the originating quote request (if any) so we can hydrate
        // Job's bindery/prepress columns that the estimator doesn't touch.
        const linkedQr = quote.quoteRequestId
          ? await prisma.quoteRequest.findUnique({ where: { id: quote.quoteRequestId } }).catch(() => null)
          : null;

        const qrBinderyFold = !!linkedQr?.foldType;
        const qrBinderyStitch = !!(linkedQr?.saddleStitch || linkedQr?.cornerStitch || linkedQr?.perfectBind);
        const qrBinderyScore = !!linkedQr?.score;
        const qrBinderyPerf = !!linkedQr?.perf;
        const qrBinderyDrill = !!linkedQr?.drill;
        const qrBinderyCount = !!linkedQr?.numbering;

        // Surface cross-departmental QR notes into generalNotes so they print
        // prominently on the job ticket (per Carrie's feedback).
        const qrGeneralBits: string[] = [];
        if (linkedQr?.specialInstructions) qrGeneralBits.push(linkedQr.specialInstructions);
        if (linkedQr?.customColorCoatingNotes) qrGeneralBits.push(`Color/coating: ${linkedQr.customColorCoatingNotes}`);
        const qrGeneralNotes = qrGeneralBits.join("\n\n") || null;

        const job = await prisma.job.create({
          data: {
            jobNumber: finalJobNumber, orderId: order.id,
            quoteRequestId: quote.quoteRequestId || null,
            name: quote.productName,
            description: quote.description,
            status: "ARTWORK_RECEIVED",
            priority: "NORMAL",
            quantity: quote.quantity,
            quotedPrice: quote.totalPrice,
            estimatedCost: quote.totalPrice, // Mary's estimate as initial cost baseline
            productType: quote.productType,
            jobType: "NEW_ORDER",
            estimateNumber: quote.quoteNumber,
            contactName: quote.contactName,
            customerPO: "",
            dueDate: quote.validUntil || null,

            // ── Size specs ──
            flatSizeWidth: jt.flatSizeWidth ?? null,
            flatSizeHeight: jt.flatSizeHeight ?? null,
            finishedWidth: jt.finishedWidth ?? parseDim("width"),
            finishedHeight: jt.finishedHeight ?? parseDim("height"),
            numberUp: jt.numberUp ?? null,
            numPages: jt.numPages ?? null,

            // ── Stock & inks ──
            stockDescription: jt.stockDescription || specs.paperStock || specs.paper || specs.stockDescription || null,
            inkFront: jt.inkFront ?? (specs.colors ? specs.colors.split("/")[0] || null : null),
            inkBack: jt.inkBack ?? (specs.colors ? specs.colors.split("/")[1] || null : null),
            varnish: jt.varnish ?? specs.coating ?? null,
            coating: jt.coating ?? specs.finishing ?? null,
            dieNumber: jt.dieNumber ?? null,
            blanketNumber: jt.blanketNumber ?? null,

            // ── Flags Mary may already know ──
            fscCertified: !!jt.fscCertified,
            pressCheck: !!jt.pressCheck,
            softCover: !!jt.softCover,
            plusCover: !!jt.plusCover,
            hasBleeds: !!jt.hasBleeds,

            // ── Delivery & samples ──
            deliveryTo: jt.deliveryTo ?? null,
            samplesRequired: !!jt.samplesRequired,
            samplesTo: jt.samplesTo ?? null,
            pressNotes: jt.pressNotes ?? null,

            // ── Press ──
            pressAssignment: jt.pressAssignment ?? specs.pressName ?? null,
            pressFormat: jt.pressFormat ?? specs.pressConfig ?? null,
            makeReadyCount: jt.makeReadyCount ?? null,

            // ── Bindery (derived from estimator; CSR/Mary can still toggle on ticket) ──
            binderyFold: !!jt.binderyFold || qrBinderyFold,
            binderyStitch: !!jt.binderyStitch || qrBinderyStitch,
            binderyScore: !!jt.binderyScore || qrBinderyScore,
            binderyPerf: qrBinderyPerf,
            binderyDrill: !!jt.binderyDrill || qrBinderyDrill,
            binderyCount: qrBinderyCount,
            binderyGlue: !!jt.binderyGlue,
            binderyWrap: !!jt.binderyWrap,
            binderyNotes: jt.binderyNotes ?? null,
            generalNotes: qrGeneralNotes,

            // ── Labor baseline from estimator ──
            estimatedHours: jt.estimatedHours ?? null,
            laborCostRate: jt.laborCostRate ?? null,
          },
        });
        await prisma.quote.update({ where: { id }, data: { convertedJobId: job.id } });

        // Phase II — Multi-part jobs: materialize each part as a JobLineItem
        // with rich fields (name, sizes, ink spec, notes). Full per-part spec
        // lives in the Quote's specs JSON for the ticket to render sections.
        const parts: any[] = Array.isArray((specs as any).parts) ? (specs as any).parts : [];
        if (parts.length > 0) {
          await prisma.jobLineItem.createMany({
            data: parts.map((p, idx) => {
              const frontN = String(p.inkColorsFront || 0);
              const backN = String(p.inkColorsBack || 0);
              const inkSuffix = p.inkTypeFront === "pms" ? " PMS"
                : p.inkTypeFront === "led_uv" ? " LED" : "";
              const descBits = [
                p.paperWeight || null,
                p.paperStock || null,
                p.pressName ? `Press: ${p.pressName}` : null,
                p.coatingType ? `Coating: ${p.coatingType}` : null,
                p.foldType && p.foldType !== "none" && Number(p.numFolds) > 0 ? `${p.foldType} fold × ${p.numFolds}` : null,
                Number(p.numDrillHoles) > 0 ? `${p.numDrillHoles} drill holes` : null,
                p.binderyStitch ? "Stitch" : null,
                p.binderyScore ? "Score" : null,
                p.binderyTrim ? "Trim to size" : null,
                p.spoilagePct > 0 ? `+${p.spoilagePct}% spoilage` : null,
                p.notes || null,
              ].filter(Boolean).join(" · ");
              return {
                jobId: job.id,
                description: `${p.name || `Part ${idx + 1}`}${descBits ? ` — ${descBits}` : ""}`,
                quantity: Math.ceil(Number(quote.quantity) * (1 + (Number(p.spoilagePct) || 0) / 100)),
                flatSize: (p.flatWidth && p.flatHeight) ? `${p.flatWidth}x${p.flatHeight}` : null,
                finishedWidth: p.finishedWidth != null ? Number(p.finishedWidth) : null,
                finishedHeight: p.finishedHeight != null ? Number(p.finishedHeight) : null,
                inkSpec: `${frontN}${inkSuffix}/${backN}`,
                sortOrder: idx,
              };
            }),
          }).catch(() => {});
        }

        // Materialize quote-request line items as JobLineItem rows so the job
        // ticket shows the multi-SKU breakdown CSRs submitted.
        const qrLineItems: any[] = Array.isArray((specs as any).lineItems) ? (specs as any).lineItems : [];
        if (qrLineItems.length > 0) {
          // Derive an ink spec string (e.g. "4/1") from job-level inks so the
          // printed ticket shows per-line ink instead of an empty X/X column.
          const frontN = jt.inkFront ? String(jt.inkFront).match(/\d+/)?.[0] || "" : "";
          const backN = jt.inkBack ? String(jt.inkBack).match(/\d+/)?.[0] || "" : "";
          const derivedInk = frontN || backN ? `${frontN || "0"}/${backN || "0"}` : "";
          await prisma.jobLineItem.createMany({
            data: qrLineItems.map((li, idx) => ({
              jobId: job.id,
              description: li.version || `Version ${idx + 1}`,
              quantity: Number(li.quantity) || 0,
              flatSize: (li.flatWidth && li.flatHeight) ? `${li.flatWidth}x${li.flatHeight}` : (jt.flatSizeWidth && jt.flatSizeHeight ? `${jt.flatSizeWidth}x${jt.flatSizeHeight}` : null),
              finishedWidth: li.finishedWidth != null ? Number(li.finishedWidth) : (jt.finishedWidth ?? null),
              finishedHeight: li.finishedHeight != null ? Number(li.finishedHeight) : (jt.finishedHeight ?? null),
              inkSpec: derivedInk || null,
              sortOrder: idx,
            })),
          }).catch(() => {});
        }

        // Auto-create purchase flags based on specs
        const purchaseFlags = [];
        if (specs.paperStock) purchaseFlags.push({ jobId: job.id, category: "paper", description: `${specs.paperStock} - ${quote.quantity} units`, status: "needed" });
        if (specs.colors?.includes("PMS")) purchaseFlags.push({ jobId: job.id, category: "ink", description: `Spot color ink: ${specs.colors}`, status: "needed" });
        if (specs.finishing?.includes("Die")) purchaseFlags.push({ jobId: job.id, category: "cutting_die", description: `Cutting die for ${quote.productName}`, status: "needed" });
        if (specs.finishing?.includes("Foil")) purchaseFlags.push({ jobId: job.id, category: "foil_die", description: `Foil die for ${quote.productName}`, status: "needed" });
        if (purchaseFlags.length > 0) await prisma.purchaseFlag.createMany({ data: purchaseFlags });
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (error: any) {
    console.error("Quote PUT error:", error?.message || error);
    return NextResponse.json({ error: `Failed to update quote: ${error?.message || "Unknown error"}` }, { status: 500 });
  }
}
