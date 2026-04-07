import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendEmail } from "@/lib/email/graph-client";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const { to, cc, subject, body: emailBody, quoteId } = body;

    if (!to || !subject || !emailBody) {
      return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
    }

    // Send from the logged-in user's email
    const senderEmail = session.email;
    if (!senderEmail) {
      return NextResponse.json({ error: "Your account does not have an email configured" }, { status: 400 });
    }

    const result = await sendEmail({
      from: senderEmail,
      to,
      cc,
      subject,
      body: emailBody,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
    }

    // Log the email activity if we have a quote context
    if (quoteId) {
      try {
        const prismaModule = await import("@/lib/prisma");
        const prisma = prismaModule.default;
        if (prisma) {
          const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
          if (quote) {
            // Find the order linked to this quote's company
            const order = await prisma.order.findFirst({ where: { companyId: quote.companyId || undefined } });
            if (order) {
              await prisma.activityLog.create({
                data: {
                  orderId: order.id,
                  userId: session.id,
                  action: "EMAIL_SENT",
                  details: `Sent quote ${quote.quoteNumber} to ${to}`,
                },
              });
            }
          }
        }
      } catch { /* ignore logging errors */ }
    }

    return NextResponse.json({ success: true, message: `Email sent to ${to}` });
  } catch (error) {
    console.error("Email API error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
