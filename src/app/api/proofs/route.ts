import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ proofs: [], source: "demo" });

    const where = jobId ? { jobId } : {};
    const proofs = await prisma.proof.findMany({
      where,
      include: {
        job: {
          include: {
            order: { include: { company: true } },
            csr: { select: { id: true, name: true, email: true } },
            salesRep: { select: { id: true, name: true, email: true } },
          },
        },
        approvals: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    // Also surface the current session so the UI can role-gate actions
    // (CSR-of-record acts; sales reps see and can nudge).
    const session = await getSession();
    return NextResponse.json({
      proofs,
      currentUser: session ? { id: session.id, name: session.name, role: session.role } : null,
      source: "database",
    });
  } catch (error) {
    console.error("Proofs GET error:", error);
    return NextResponse.json({ error: "Failed to fetch proofs" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { jobId, action, proofId, comments } = body;

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    // Nudge the assigned CSR — sales reps see proofs in their queue but the
    // CSR is the action owner. This sends a quick email to the CSR so they
    // know to act. Non-fatal on email failure.
    if (action === "nudge_csr") {
      if (!proofId) return NextResponse.json({ error: "Proof ID required" }, { status: 400 });
      const proof = await prisma.proof.findUnique({
        where: { id: proofId },
        include: {
          job: {
            include: {
              order: { include: { company: true } },
              csr: { select: { email: true, name: true } },
            },
          },
        },
      });
      if (!proof?.job?.csr?.email) {
        return NextResponse.json({ error: "No CSR assigned to this job" }, { status: 400 });
      }
      try {
        const { sendEmail } = await import("@/lib/email/graph-client");
        const job = proof.job;
        const customer = job.order?.company?.name || "customer";
        const status = proof.sentToCustomerAt ? "awaiting customer response" : "ready to send to customer";
        await sendEmail({
          from: session.email || process.env.DEFAULT_EMAIL_FROM || "no-reply@cndprinting.com",
          to: proof.job.csr.email,
          subject: `Heads up: proof on ${job.jobNumber} (${customer}) — ${status}`,
          body: `
            <p>Hi ${proof.job.csr.name || ""},</p>
            <p>${session.name || "A teammate"} flagged this proof for your attention:</p>
            <ul>
              <li><strong>Job:</strong> ${job.jobNumber} — ${job.name || ""}</li>
              <li><strong>Customer:</strong> ${customer}</li>
              <li><strong>Proof:</strong> v${proof.version}${proof.fileName ? ` — ${proof.fileName}` : ""}</li>
              <li><strong>Status:</strong> ${status}</li>
            </ul>
            <p><a href="${process.env.NEXTAUTH_URL || "https://packaging.cndprinting.com"}/dashboard/jobs/${job.id}">Open job ticket →</a></p>
          `.trim(),
        });
      } catch (e) {
        console.error("Nudge CSR email failed:", e);
        return NextResponse.json({ error: "Email failed — try again" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // CSR marks a proof as sent to the customer (email or physical delivery).
    // Timestamp + delivery method let us surface "sent — awaiting approval" on
    // the proofing queue and audit trail on the job ticket.
    if (action === "mark_sent") {
      if (!proofId) return NextResponse.json({ error: "Proof ID required" }, { status: 400 });
      const { deliveryMethod } = body;
      if (!deliveryMethod || !["email", "physical"].includes(deliveryMethod)) {
        return NextResponse.json({ error: "deliveryMethod must be 'email' or 'physical'" }, { status: 400 });
      }
      // sentToCustomerById is just a String (no FK), so it stores the session
      // id regardless of whether it resolves to a real user — that's fine for
      // audit trail and lets demo/legacy sessions still work.
      await prisma.proof.update({
        where: { id: proofId },
        data: {
          deliveryMethod,
          sentToCustomerAt: new Date(),
          sentToCustomerById: session.id,
        },
      });
      return NextResponse.json({ ok: true });
    }

    // Approve or reject a proof
    if (action === "approve" || action === "reject") {
      if (!proofId) return NextResponse.json({ error: "Proof ID required" }, { status: 400 });

      const status = action === "approve" ? "APPROVED" : "REJECTED";
      // Record the approval. Skip silently if the session user isn't a real
      // DB user (e.g. demo login) — the proof status update below is what
      // actually matters for downstream gating + alerts.
      await prisma.proofApproval.create({
        data: { proofId, userId: session.id, status, comments },
      }).catch(() => { /* demo user or FK miss — non-fatal */ });
      await prisma.proof.update({
        where: { id: proofId },
        data: {
          status,
          ...(action === "approve" ? { customerApprovedAt: new Date() } : { customerRejectedAt: new Date() }),
        },
      });

      // If approved: advance job, email production team so Darrin can schedule.
      if (action === "approve") {
        const proof = await prisma.proof.findUnique({
          where: { id: proofId },
          include: { job: { include: { order: { include: { company: true } } } } },
        });
        if (proof) {
          await prisma.job.update({ where: { id: proof.jobId }, data: { status: "CUSTOMER_APPROVAL" } });

          // Notify production team via M365 Graph so Darrin can get it scheduled.
          // Idempotent: only fires once per proof (productionAlertSentAt guard).
          if (!proof.productionAlertSentAt) {
            try {
              const { sendEmail } = await import("@/lib/email/graph-client");
              // Find production recipients (roles that schedule jobs).
              const recipients = await prisma.user.findMany({
                where: {
                  role: { in: ["PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "PREPRESS_MANAGER", "OWNER", "GM"] },
                  email: { not: "" as any },
                },
                select: { email: true, name: true },
              });
              const to = recipients.map(r => r.email).filter(Boolean);
              if (to.length > 0) {
                const job = proof.job;
                const customer = job.order?.company?.name || "customer";
                await sendEmail({
                  from: session.email || process.env.DEFAULT_EMAIL_FROM || "no-reply@cndprinting.com",
                  to,
                  subject: `Proof approved: ${job.jobNumber} (${customer}) — ready to schedule`,
                  body: `
                    <p><strong>Proof approved.</strong> Job is ready to move into production scheduling.</p>
                    <ul>
                      <li><strong>Job:</strong> ${job.jobNumber} — ${job.name || ""}</li>
                      <li><strong>Customer:</strong> ${customer}</li>
                      <li><strong>Quantity:</strong> ${job.quantity?.toLocaleString() || "—"}</li>
                      <li><strong>Due date:</strong> ${job.dueDate ? new Date(job.dueDate).toLocaleDateString() : "—"}</li>
                      <li><strong>Approved by:</strong> ${session.name || session.email}</li>
                      <li><strong>Delivery method:</strong> ${proof.deliveryMethod || "—"}</li>
                    </ul>
                    <p><a href="${process.env.NEXTAUTH_URL || "https://packaging.cndprinting.com"}/dashboard/jobs/${job.id}">Open job ticket →</a></p>
                  `.trim(),
                });
                await prisma.proof.update({
                  where: { id: proofId },
                  data: { productionAlertSentAt: new Date() },
                });
              }
            } catch (e) {
              console.error("Production alert email failed:", e);
              // Non-fatal — approval still recorded.
            }
          }
        }
      }

      return NextResponse.json({ ok: true, status });
    }

    // Create new proof
    if (!jobId) return NextResponse.json({ error: "Job ID required" }, { status: 400 });

    const existingProofs = await prisma.proof.count({ where: { jobId } });
    const proof = await prisma.proof.create({
      data: {
        jobId,
        version: existingProofs + 1,
        status: "PENDING",
        fileName: body.fileName || `proof-v${existingProofs + 1}.pdf`,
        fileUrl: body.fileUrl || null,
        sentDate: new Date(),
        notes: body.notes,
      },
    });

    // Update job status to PROOFING
    await prisma.job.update({ where: { id: jobId }, data: { status: "PROOFING" } });

    return NextResponse.json({ proof });
  } catch (error) {
    console.error("Proofs POST error:", error);
    return NextResponse.json({ error: "Failed to process proof" }, { status: 500 });
  }
}
