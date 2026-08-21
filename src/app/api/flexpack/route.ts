import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import prisma from "@/lib/prisma";

// FlexPack — flexible packaging estimating. Reference data + saved quotes.
// Access: owners drive it, Mary can use it (Benjy 8/20 — flexible packaging is
// a different discipline from her offset work, so it must not depend on her).
const CAN_USE = new Set([
  "OWNER", "GM", "ADMIN", "ESTIMATOR",
  "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "ACCOUNTING",
]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) return NextResponse.json({ materials: [], structures: [], machines: [], formats: [], settings: null, quotes: [] });
  const p = prisma as any;
  const id = req.nextUrl.searchParams.get("id");
  try {
    if (id) {
      const quote = await p.flexQuote.findUnique({ where: { id } });
      return NextResponse.json({ quote });
    }
    const [materials, structures, machines, formats, settings, quotes] = await Promise.all([
      p.flexMaterial.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexStructure.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexMachine.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexPouchFormat.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      p.flexSettings.findUnique({ where: { id: "default" } }),
      p.flexQuote.findMany({ orderBy: { updatedAt: "desc" }, take: 40 }),
    ]);
    return NextResponse.json({ materials, structures, machines, formats, settings, quotes });
  } catch (e) {
    console.error("[flexpack] load failed", e);
    return NextResponse.json({ materials: [], structures: [], machines: [], formats: [], settings: null, quotes: [] });
  }
}

/** Save a FlexPack quote (new or update). */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const p = prisma as any;
  try {
    const b = await req.json();
    const { id, customerName, jobTitle, quantity, skus, specs, totalCost, sellingPrice, pricePerM, marginPct, notes, contactName, contactEmail } = b;
    if (!customerName || !jobTitle) {
      return NextResponse.json({ error: "Customer and job title are required" }, { status: 400 });
    }
    const data = {
      customerName: String(customerName), jobTitle: String(jobTitle),
      contactName: contactName || null, contactEmail: contactEmail || null,
      quantity: Math.round(Number(quantity) || 0), skus: Math.round(Number(skus) || 1),
      specs: specs ? JSON.stringify(specs) : null,
      totalCost: Number(totalCost) || 0, sellingPrice: Number(sellingPrice) || 0,
      pricePerM: Number(pricePerM) || 0, marginPct: Number(marginPct) || 0,
      notes: notes || null,
    };
    if (id) {
      const quote = await p.flexQuote.update({ where: { id }, data });
      return NextResponse.json({ quote });
    }
    // FP-0001 style, sequential
    const count = await p.flexQuote.count();
    const quoteNumber = `FP-${String(count + 1).padStart(4, "0")}`;
    const quote = await p.flexQuote.create({
      data: { ...data, quoteNumber, createdBy: session.name || session.email, status: "DRAFT" },
    });
    return NextResponse.json({ quote }, { status: 201 });
  } catch (e) {
    console.error("[flexpack] save failed", e);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}

/** Status changes, and converting an accepted quote into a job ticket. */
export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || !CAN_USE.has(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!prisma) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const p = prisma as any;
  try {
    const { id, status, convertToJob } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const fq = await p.flexQuote.findUnique({ where: { id } });
    if (!fq) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (convertToJob) {
      // Mirrors the sheetfed quote -> job path exactly (company, then order,
      // then job) so a pouch job lands in the same production queue as a
      // carton job rather than in a parallel world of its own.
      if (fq.jobId) {
        return NextResponse.json({ error: "This quote already has a job ticket." }, { status: 400 });
      }
      const ts = Date.now();
      const slug = fq.customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") || `customer-${ts}`;
      let company = await p.company.findUnique({ where: { slug } });
      if (!company) {
        company = await p.company.create({ data: { name: fq.customerName, slug: `${slug}-${ts}` } })
          .catch(() => p.company.create({ data: { name: fq.customerName, slug: `cust-${ts}` } }));
      }

      const orderCount = await p.order.count();
      let orderNumber = `ORD-${String(orderCount + 30000).padStart(5, "0")}`;
      if (await p.order.findUnique({ where: { orderNumber } })) orderNumber = `ORD-${ts}`;
      const order = await p.order.create({
        data: { orderNumber, companyId: company.id, status: "ARTWORK_RECEIVED", priority: "NORMAL" },
      });

      const jobCount = await p.job.count();
      let jobNumber = `FP-2026-${String(jobCount + 200).padStart(3, "0")}`;
      if (await p.job.findUnique({ where: { jobNumber } })) jobNumber = `FP-2026-${ts}`;
      const job = await p.job.create({
        data: {
          jobNumber, orderId: order.id,
          name: fq.jobTitle,
          description: `Flexible packaging — ${fq.quantity.toLocaleString()} pcs, ${fq.skus} SKU(s)`,
          status: "ARTWORK_RECEIVED", priority: "NORMAL",
          quantity: fq.quantity,
          quotedPrice: fq.sellingPrice,
          estimatedCost: fq.totalCost,
          productType: "Flexible Packaging",
          jobType: "NEW_ORDER",
          estimateNumber: fq.quoteNumber,
          contactName: fq.contactName,
          generalNotes: `Converted from FlexPack quote ${fq.quoteNumber}.`,
        },
      });
      const quote = await p.flexQuote.update({
        where: { id }, data: { status: "ACCEPTED", jobId: job.id },
      });
      return NextResponse.json({ quote, job });
    }

    const quote = await p.flexQuote.update({ where: { id }, data: { status: String(status || fq.status) } });
    return NextResponse.json({ quote });
  } catch (e) {
    console.error("[flexpack] update failed", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
