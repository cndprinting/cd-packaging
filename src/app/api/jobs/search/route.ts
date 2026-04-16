import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Full-field job search — lets CSRs find old jobs by any field Carrie listed:
// customer, contact, description, size, ink, paper, PO#, die#, bindery,
// delivery info, vendor, outside services, address, etc.
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) return NextResponse.json({ jobs: [] });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ jobs: [] });

    // Build OR conditions across every searchable field
    const contains = { contains: q, mode: "insensitive" as const };
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { jobNumber: contains },
          { name: contains },
          { description: contains },
          { contactName: contains },
          { customerPO: contains },
          { estimateNumber: contains },
          { repName: contains },
          { stockDescription: contains },
          { dieNumber: contains },
          { blanketNumber: contains },
          { inkFront: contains },
          { inkBack: contains },
          { varnish: contains },
          { coating: contains },
          { pressAssignment: contains },
          { pressFormat: contains },
          { imposition: contains },
          { runningSize: contains },
          { binderyOther: contains },
          { binderyNotes: contains },
          { deliveryPackaging: contains },
          { deliveryTo: contains },
          { vendorInfo: contains },
          { pressNotes: contains },
          { prepressNotes: contains },
          { lastJobNumber: contains },
          // Company name (customer)
          { order: { company: { name: contains } } },
          // Company address
          { order: { company: { address: contains } } },
          { order: { company: { city: contains } } },
        ],
      },
      include: { order: { include: { company: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        name: j.name,
        description: j.description,
        companyName: j.order.company.name,
        status: j.status,
        quantity: j.quantity,
        dueDate: j.dueDate?.toISOString().split("T")[0] || "",
        productType: j.productType,
        lastJobNumber: j.lastJobNumber,
        stockDescription: j.stockDescription,
        dieNumber: j.dieNumber,
        inkFront: j.inkFront,
        inkBack: j.inkBack,
        contactName: j.contactName,
      })),
    });
  } catch (error) {
    console.error("Job search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
