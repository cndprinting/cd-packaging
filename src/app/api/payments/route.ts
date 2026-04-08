import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Stripe will be initialized when keys are available
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key);
}

// GET: List invoices
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ invoices: [] });

    // Customers only see their own invoices
    const where = session.role === "CUSTOMER" ? { companyId: session.companyId || undefined } : {};

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Payments GET error:", error);
    return NextResponse.json({ invoices: [] });
  }
}

// POST: Create invoice or payment session
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    // Create a new invoice
    if (action === "create_invoice") {
      const adminRoles = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "ACCOUNTING", "CSR"];
      if (!adminRoles.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

      const { customerName, contactEmail, companyId, description, subtotal, jobId, orderId, notes } = body;
      const taxRate = 7;
      const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = subtotal + taxAmount;
      const depositAmount = Math.round(total * 0.5 * 100) / 100;

      const count = await prisma.invoice.count();
      const invoiceNumber = `INV-${String(count + 1000).padStart(5, "0")}`;

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          customerName,
          contactEmail,
          companyId,
          description,
          subtotal,
          taxRate,
          taxAmount,
          total,
          depositPercent: 50,
          depositAmount,
          jobId,
          orderId,
          notes,
          createdBy: session.id,
        },
      });

      return NextResponse.json({ invoice });
    }

    // Create Stripe checkout session for payment
    if (action === "pay") {
      const { invoiceId, paymentType } = body; // paymentType: "deposit" or "balance"
      const stripe = getStripe();

      if (!stripe) {
        return NextResponse.json({ error: "Stripe not configured. Contact C&D Printing at 727-572-9999 to pay by phone." }, { status: 400 });
      }

      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

      const amount = paymentType === "deposit" ? invoice.depositAmount : (invoice.total - invoice.depositAmount);
      const description = `${invoice.invoiceNumber} - ${paymentType === "deposit" ? "50% Deposit" : "Balance Due"} - ${invoice.customerName}`;

      // Add 3% CC surcharge
      const surcharge = Math.round(amount * 0.03 * 100) / 100;
      const totalCharge = amount + surcharge;

      const { origin } = new URL(request.url);
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: { name: description },
              unit_amount: Math.round(totalCharge * 100), // Stripe uses cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/portal/payments?success=true&invoice=${invoice.invoiceNumber}`,
        cancel_url: `${origin}/portal/payments?cancelled=true`,
        metadata: {
          invoiceId: invoice.id,
          paymentType,
        },
      });

      // Update invoice with Stripe session ID
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { stripeSessionId: checkoutSession.id },
      });

      return NextResponse.json({ url: checkoutSession.url });
    }

    // Mark as paid manually (for checks, wire, etc.)
    if (action === "mark_paid") {
      const adminRoles = ["OWNER", "GM", "ADMIN", "ACCOUNTING"];
      if (!adminRoles.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

      const { invoiceId, paymentType } = body;

      const data = paymentType === "deposit"
        ? { depositPaid: true, depositPaidAt: new Date(), status: "deposit_paid" }
        : { balancePaid: true, balancePaidAt: new Date(), status: "paid" };

      const invoice = await prisma.invoice.update({ where: { id: invoiceId }, data });
      return NextResponse.json({ invoice });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Payments POST error:", error);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
