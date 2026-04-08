import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const jobId = formData.get("jobId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read the file as array buffer
    const buffer = await file.arrayBuffer();
    const xlsx = require("xlsx");
    const workbook = xlsx.read(buffer, { type: "buffer" });

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = xlsx.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data found in spreadsheet" }, { status: 400 });
    }

    // Auto-detect column mapping
    const headers = Object.keys(rows[0]).map(h => h.toLowerCase().trim());
    const findCol = (patterns: string[]) => {
      const key = Object.keys(rows[0]).find(k =>
        patterns.some(p => k.toLowerCase().trim().includes(p))
      );
      return key || null;
    };

    const productCol = findCol(["product", "item", "sku", "code", "part"]);
    const descCol = findCol(["description", "desc", "name"]);
    const qtyCol = findCol(["qty", "quantity", "count", "amount"]);
    const batchCol = findCol(["batch", "lot"]);
    const poCol = findCol(["po", "purchase order", "po#"]);

    // Parse line items
    const lineItems = rows
      .filter(row => {
        // Skip rows without a quantity or description
        const qty = qtyCol ? Number(row[qtyCol]) : 0;
        const desc = descCol ? String(row[descCol]) : "";
        const product = productCol ? String(row[productCol]) : "";
        return qty > 0 || desc.length > 2 || product.length > 2;
      })
      .map((row, idx) => ({
        productCode: productCol ? String(row[productCol]).trim() : "",
        batchNumber: batchCol ? String(row[batchCol]).trim() : "",
        quantity: qtyCol ? Math.round(Number(row[qtyCol]) || 0) : 0,
        description: descCol ? String(row[descCol]).trim() : (productCol ? String(row[productCol]).trim() : `Item ${idx + 1}`),
        poNumber: poCol ? String(row[poCol]).trim() : "",
        sortOrder: idx,
      }));

    // If jobId provided, save directly to the job
    if (jobId) {
      const prismaModule = await import("@/lib/prisma");
      const prisma = prismaModule.default;
      if (prisma) {
        // Clear existing line items for this job
        await prisma.jobLineItem.deleteMany({ where: { jobId } });

        // Create new line items
        await prisma.jobLineItem.createMany({
          data: lineItems.map(item => ({
            jobId,
            productCode: item.productCode || null,
            batchNumber: item.batchNumber || null,
            quantity: item.quantity,
            description: item.description,
            poNumber: item.poNumber || null,
            sortOrder: item.sortOrder,
          })),
        });

        // Update job total quantity
        const totalQty = lineItems.reduce((sum, item) => sum + item.quantity, 0);
        await prisma.job.update({
          where: { id: jobId },
          data: { quantity: totalQty },
        });

        return NextResponse.json({
          success: true,
          imported: lineItems.length,
          totalQuantity: totalQty,
          message: `Imported ${lineItems.length} line items (${totalQty.toLocaleString()} total units)`,
        });
      }
    }

    // Return parsed data for preview (no jobId)
    return NextResponse.json({
      success: true,
      lineItems,
      totalQuantity: lineItems.reduce((sum, item) => sum + item.quantity, 0),
      columnsDetected: {
        product: productCol,
        description: descCol,
        quantity: qtyCol,
        batch: batchCol,
        po: poCol,
      },
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}
