import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Fast-track a quote request into a placeholder job, bypassing the estimator.
// Purpose: let CSRs test the downstream job ticket / production flow without
// waiting for Mary to finish estimating. The resulting job is a stub (no real
// cost data) and is flagged in its description so it's obvious.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    const qr = await prisma.quoteRequest.findUnique({
      where: { id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    });
    if (!qr) return NextResponse.json({ error: "Quote request not found" }, { status: 404 });

    // Resolve company
    let companyId = qr.companyId;
    if (!companyId && qr.customerName) {
      const slug = qr.customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
      let company = await prisma.company.findUnique({ where: { slug } });
      if (!company) company = await prisma.company.create({ data: { name: qr.customerName, slug } });
      companyId = company.id;
    }
    if (!companyId) {
      const defaultCompany = await prisma.company.findFirst({ where: { type: "customer" } });
      companyId = defaultCompany?.id || null;
    }
    if (!companyId) return NextResponse.json({ error: "No customer company available" }, { status: 400 });

    // Generate order + job numbers with collision fallback.
    // Count-based numbering collides if records were deleted, so we check
    // the candidate against the DB and fall back to a timestamp suffix.
    const ts = Date.now().toString().slice(-6);
    const orderCount = await prisma.order.count();
    const candidateOrder = `ORD-${String(orderCount + 20000).padStart(5, "0")}`;
    const existingOrder = await prisma.order.findUnique({ where: { orderNumber: candidateOrder } });
    const orderNumber = existingOrder ? `ORD-${ts}` : candidateOrder;

    const jobCount = await prisma.job.count();
    const candidateJob = `PKG-2026-${String(jobCount + 100).padStart(3, "0")}`;
    const existingJob = await prisma.job.findUnique({ where: { jobNumber: candidateJob } });
    const jobNumber = existingJob ? `PKG-2026-${ts}` : candidateJob;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        companyId,
        status: "QUOTE",
        priority: "NORMAL",
        dueDate: qr.dateNeeded || undefined,
      },
    });

    const totalQty = qr.lineItems.reduce((s, li) => s + (li.quantity || 0), 0) || (qr.quantity1 || 0) || 1;
    const jobName = qr.jobTitle || qr.descriptionType || `Fast-track from ${qr.requestNumber}`;

    // Best-effort hydration of Job's structured columns from the QR. Anything
    // without a matching Job column still rides through via the quoteRequestId
    // link (rendered as a "From Quote Request" card on the ticket).
    const colorCount = (s: string | null | undefined): number | null => {
      if (!s) return null;
      if (s === "4_process") return 4;
      if (s === "process_1pms") return 5;
      if (s === "process_2pms") return 6;
      if (s === "black" || s === "pms") return 1;
      if (s === "none") return 0;
      return null;
    };
    const front = colorCount(qr.colorsSide1);
    const back = colorCount(qr.colorsSide2);
    const inkFrontStr = front != null ? `${front}/0` : null;
    const inkBackStr = back != null ? `${back}/0` : null;

    // Coating/varnish — collapse the QR's multiple coating flags into one string
    const coatingParts: string[] = [];
    if (qr.coatingSide1) coatingParts.push(`S1: ${qr.coatingSide1}`);
    if (qr.coatingSide2) coatingParts.push(`S2: ${qr.coatingSide2}`);
    if (qr.floodUv) coatingParts.push(`Flood UV${qr.uvSides ? ` (${qr.uvSides})` : ""}`);
    if (qr.spotUv) coatingParts.push(`Spot UV${qr.uvSides ? ` (${qr.uvSides})` : ""}`);
    if (qr.floodLedUv) coatingParts.push(`Flood LED UV${qr.ledUvSides ? ` (${qr.ledUvSides})` : ""}`);
    if (qr.spotLedUv) coatingParts.push(`Spot LED UV${qr.ledUvSides ? ` (${qr.ledUvSides})` : ""}`);
    if (qr.aqueous) coatingParts.push("Aqueous");
    if (qr.drytrap) coatingParts.push("Dry trap");
    const coatingStr = coatingParts.join("; ") || null;

    // Stock description: combine paper weight + description
    const stockDesc = [qr.paperWeight, qr.paperDescription, qr.paperType].filter(Boolean).join(" / ") || null;

    // Bindery flags derived from QR menu
    const binderyFold = !!qr.foldType;
    const binderyStitch = !!(qr.saddleStitch || qr.cornerStitch || qr.perfectBind);
    const binderyScore = !!qr.score;
    const binderyPerf = !!qr.perf;
    const binderyDrill = !!qr.drill;
    const binderyCount = !!qr.numbering;
    const binderyPockets = !!(qr.numPockets && qr.numPockets > 0);

    // Bindery notes — collect everything that doesn't map to a flag
    const binderyBits: string[] = [];
    if (qr.foldType) binderyBits.push(`Fold: ${qr.foldType}`);
    if (qr.perfectBind) binderyBits.push("Perfect bind");
    if (qr.cornerStitch) binderyBits.push("Corner stitch");
    if (qr.saddleStitch) binderyBits.push("Saddle stitch");
    if (qr.plasticCoil) binderyBits.push(`Plastic coil: ${qr.plasticCoil}`);
    if (qr.wireO) binderyBits.push(`Wire-O: ${qr.wireO}`);
    if (qr.gbc) binderyBits.push(`GBC: ${qr.gbc}`);
    if (qr.caseBind) binderyBits.push(`Case bind: ${qr.caseBind}`);
    if (qr.lamination) binderyBits.push(`Lamination: ${qr.lamination}`);
    if (qr.bandIn) binderyBits.push(`Band: ${qr.bandIn}`);
    if (qr.wrapIn) binderyBits.push(`Wrap: ${qr.wrapIn}`);
    if (qr.padIn) binderyBits.push(`Pad: ${qr.padIn}`);
    if (qr.ncrPad) binderyBits.push("NCR pad");
    if (qr.punch) binderyBits.push("Punch");
    if (qr.roundCorner) binderyBits.push("Round corner");
    if (qr.numbering) binderyBits.push(`Numbering: ${qr.numbering}`);
    if (qr.foil) binderyBits.push(`Foil: ${qr.foil}${qr.foilIsNew ? " (NEW)" : ""}`);
    if (qr.emboss) binderyBits.push(`Emboss: ${qr.emboss}${qr.embossIsNew ? " (NEW)" : ""}`);
    if (qr.dieCut) binderyBits.push(`Die cut${qr.existingDieNumber ? ` #${qr.existingDieNumber}` : ""}${qr.dieVHSize ? ` (${qr.dieVHSize})` : ""}`);
    if (qr.mailingServices) binderyBits.push(`Mailing: ${qr.mailingServices}`);
    if (qr.waferSeal) binderyBits.push(`Wafer seal${qr.waferSealTabs ? ` x${qr.waferSealTabs}` : ""}${qr.waferSealLocation ? ` @ ${qr.waferSealLocation}` : ""}`);
    const binderyNotesStr = binderyBits.join("; ") || null;

    // Prepress notes — art + proof info + color/coating nuance
    const prepressBits: string[] = [];
    if (qr.artworkIsNew) prepressBits.push("NEW artwork");
    else prepressBits.push("Art supplied");
    if (qr.artworkFileName) prepressBits.push(`File: ${qr.artworkFileName}`);
    if (qr.artworkUrl) prepressBits.push(`URL: ${qr.artworkUrl}`);
    if (qr.artworkNotes) prepressBits.push(qr.artworkNotes);
    if (qr.lowResProofs) prepressBits.push(`Low-res proofs: ${qr.lowResProofs}`);
    if (qr.hiResProofs) prepressBits.push(`Hi-res proofs: ${qr.hiResProofs}`);
    if (qr.customColorCoatingNotes) prepressBits.push(qr.customColorCoatingNotes);
    if (qr.orientation) prepressBits.push(`Orientation: ${qr.orientation}`);
    const prepressNotesStr = prepressBits.join("\n") || null;

    // General Notes — the QR's specialInstructions + customColorCoatingNotes
    // are exactly the cross-departmental "read before starting" info that
    // Carrie's General Notes section was built for. Surface them there so
    // they print prominently at the top of every ticket.
    const generalNotesBits: string[] = [];
    if (qr.specialInstructions) generalNotesBits.push(qr.specialInstructions);
    if (qr.customColorCoatingNotes) generalNotesBits.push(`Color/coating: ${qr.customColorCoatingNotes}`);
    const generalNotesStr = generalNotesBits.join("\n\n") || null;

    const job = await prisma.job.create({
      data: {
        jobNumber,
        orderId: order.id,
        quoteRequestId: qr.id,
        name: jobName,
        description: qr.jobType && qr.jobType !== "new"
          ? `[${qr.jobType === "exact_reprint" ? "EXACT REPRINT" : "REPRINT W/ CHANGES"}${qr.pickupJobNumber ? ` of ${qr.pickupJobNumber}` : ""}]`.trim()
          : null,
        status: "QUOTE",
        priority: "NORMAL",
        quantity: totalQty,
        dueDate: qr.dateNeeded || null,
        productType: qr.descriptionType === "folding_carton" ? "FOLDING_CARTON" : "COMMERCIAL_PRINT",
        // Size
        flatSizeWidth: qr.flatWidth ?? null,
        flatSizeHeight: qr.flatHeight ?? null,
        finishedWidth: qr.finishedWidth ?? null,
        finishedHeight: qr.finishedHeight ?? null,
        numPages: qr.pages ?? null,
        // Ink / coating / stock
        inkFront: inkFrontStr,
        inkBack: inkBackStr,
        coating: coatingStr,
        stockDescription: stockDesc,
        // Flags
        hasBleeds: !!qr.hasBleeds,
        softCover: qr.coverType === "self_cover",
        plusCover: qr.coverType === "plus_cover",
        // Die
        dieNumber: qr.existingDieNumber || null,
        // Bindery
        binderyFold, binderyStitch, binderyScore, binderyPerf,
        binderyDrill, binderyCount, binderyPockets,
        binderyNotes: binderyNotesStr,
        // Notes
        prepressNotes: prepressNotesStr,
        generalNotes: generalNotesStr,
        deliveryTo: qr.deliveryInstructions || null,
        // Vendor
        vendorInfo: qr.vendorName || null,
      },
    });

    // Copy line items to job line items, carrying sizes + deriving an ink
    // spec from the QR's global colors fields so CSRs don't land on an
    // empty job ticket missing the info they just entered.
    const derivedInk = (() => {
      const colorMap: Record<string, string> = {
        "4_process": "4", "process_1pms": "5", "process_2pms": "6", "black": "1", "pms": "1", "none": "0",
      };
      const f = colorMap[qr.colorsSide1 || ""] ?? "";
      const b = colorMap[qr.colorsSide2 || ""] ?? "";
      return f || b ? `${f || "0"}/${b || "0"}` : "";
    })();
    if (qr.lineItems.length > 0) {
      await prisma.jobLineItem.createMany({
        data: qr.lineItems.map((li, idx) => ({
          jobId: job.id,
          description: li.version,
          quantity: li.quantity,
          flatSize: (li.flatWidth && li.flatHeight) ? `${li.flatWidth}x${li.flatHeight}` : (qr.flatWidth && qr.flatHeight ? `${qr.flatWidth}x${qr.flatHeight}` : null),
          finishedWidth: li.finishedWidth ?? qr.finishedWidth ?? null,
          finishedHeight: li.finishedHeight ?? qr.finishedHeight ?? null,
          inkSpec: derivedInk || null,
          sortOrder: idx,
        })),
      }).catch(() => {});
    }

    // Mark quote request as completed so it moves out of the active queue
    await prisma.quoteRequest.update({
      where: { id },
      data: { status: "completed" },
    });

    await prisma.activityLog.create({
      data: {
        orderId: order.id,
        userId: session.id,
        action: "JOB_CREATED",
        details: `Fast-tracked job ${jobNumber} from quote request ${qr.requestNumber}`,
      },
    }).catch(() => {});

    return NextResponse.json({ job: { id: job.id, jobNumber: job.jobNumber } });
  } catch (error) {
    console.error("Fast-track error:", error);
    return NextResponse.json({ error: "Failed to fast-track" }, { status: 500 });
  }
}
