import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      const { demoCompanies } = await import("@/lib/demo-data");
      return NextResponse.json({ companies: [], source: "empty" });
    }
    const companies = await prisma.company.findMany({ where: { type: "customer" }, orderBy: { name: "asc" } });
    return NextResponse.json({ companies, source: "database" });
  } catch (error) {
    console.error("Companies GET error:", error);
    return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await request.json();
    const { name, industry, phone, address, city, state, zip, website } = body;
    if (!name) return NextResponse.json({ error: "Company name is required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    const existing = await prisma.company.findUnique({ where: { slug } });
    if (existing) return NextResponse.json({ error: "A company with this name already exists" }, { status: 409 });

    const company = await prisma.company.create({
      data: { name, slug, type: "customer", industry, phone, address, city, state, zip, website },
    });
    return NextResponse.json({ company });
  } catch (error) {
    console.error("Company POST error:", error);
    return NextResponse.json({ error: "Failed to create company" }, { status: 500 });
  }
}
