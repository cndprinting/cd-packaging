import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// No more demo quotes — real data only

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (prisma) {
      // Single-quote fetch (used by the estimator to resume drafts).
      // Returns the full record incl. specs JSON so the form can rehydrate.
      if (id) {
        const q = await prisma.quote.findUnique({ where: { id } });
        if (!q) return NextResponse.json({ quotes: [] });
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
        }] });
      }
      const quotes = await prisma.quote.findMany({ orderBy: { createdAt: "desc" } });
      if (quotes.length > 0) {
        return NextResponse.json({ quotes: quotes.map(q => ({
          id: q.id, quoteNumber: q.quoteNumber, customerName: q.customerName,
          contactName: q.contactName, contactEmail: q.contactEmail,
          productType: q.productType, productName: q.productName, description: q.description,
          quantity: q.quantity, unitPrice: q.unitPrice, totalPrice: q.totalPrice,
          status: q.status.toLowerCase(), validUntil: q.validUntil?.toISOString().split("T")[0] || "",
          createdAt: q.createdAt.toISOString().split("T")[0],
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
    const { customerName, productType, productName, description, quantity, unitPrice, validUntil, contactName, contactEmail, notes, quoteRequestId, specs } = body;
    if (!customerName || !productName || !quantity) return NextResponse.json({ error: "Customer, product name, and quantity required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      // Demo fallback
      return NextResponse.json({ quote: { id: `q-${Date.now()}`, quoteNumber: `QT-2026-${Date.now() % 1000}`, ...body, totalPrice: (parseFloat(unitPrice) || 0) * (parseInt(quantity) || 0), status: "draft", createdAt: new Date().toISOString().split("T")[0] } });
    }

    const quoteCount = await prisma.quote.count();
    const quoteNumber = `QT-2026-${String(quoteCount + 10).padStart(3, "0")}`;
    const qty = parseInt(quantity) || 0;
    const price = parseFloat(unitPrice) || 0;

    const quote = await prisma.quote.create({
      data: {
        quoteNumber, customerName, contactName, contactEmail,
        productType: productType === "COMMERCIAL_PRINT" ? "COMMERCIAL_PRINT" : "FOLDING_CARTON",
        productName, description, quantity: qty,
        unitPrice: price, totalPrice: price * qty,
        status: "DRAFT",
        validUntil: validUntil ? new Date(validUntil) : null,
        notes, createdBy: session.id,
        quoteRequestId: quoteRequestId || null,
        specs: specs || null,
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

    // Draft-update path: when the estimator saves an in-progress quote with
    // an existing id, we update specs + summary fields without changing the
    // status (keeps it as DRAFT). Allows Mary to step away and resume.
    if (bodySpecs && !status) {
      const updates: any = { specs: bodySpecs };
      if (customerName !== undefined) updates.customerName = customerName;
      if (productName !== undefined) updates.productName = productName;
      if (description !== undefined) updates.description = description;
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
      if (quote) {
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

        const order = await prisma.order.create({ data: { orderNumber: finalOrderNumber, companyId, status: "QUOTE", priority: "NORMAL", dueDate: quote.validUntil, poNumber: quote.contactEmail ? undefined : undefined } });

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
            status: "QUOTE",
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
