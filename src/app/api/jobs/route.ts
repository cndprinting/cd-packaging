import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { DEFAULT_TERMS, JOBS_LIVE_SINCE, TERMS, TERMS_SET_ROLES, draftDepositInvoice, setCustomerTerms, tellAccounting } from "@/lib/press-gate";
import { hardStep, proofsDone, stageFor } from "@/lib/proofs";
import { ROUTE_PRESSES, ROUTE_ROLES, ROUTE_STATUSES, STATUS_ROLES } from "@/lib/routing";
import { isLiveUser, isTestJob, isTester, tSubj } from "@/lib/test-mode";

// Jobs page tabs use Darrin's FileMaker WIP statuses (11/20): New until he
// routes it, then the status he sets. Packed counts as COMP, shipped as DEL.
const DONE = ["SHIPPED", "DELIVERED", "INVOICED"];
const PRESS_ON = ["SCHEDULED", "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA"];
const STEP_LABEL: Record<string, string> = { SCHEDULED: "Scheduled for press", PRINTING: "Printing", COATING_FINISHING: "Coating / finishing", DIE_CUTTING: "Die cutting", GLUING_FOLDING: "Gluing / folding", QA: "QA" };
function tabFor(j: any) {
  if (DONE.includes(j.status)) return "DEL";
  if (j.status === "PACKED") return "COMP";
  if (!j.routeStatus) return "new";
  return j.routeStatus;
}
/** One plain line: what this job is waiting on right now. */
function waitingFor(j: any, press: { cleared: boolean; waitingOn: string[] } | null, pdf: any, hard: any) {
  if (DONE.includes(j.status)) return j.status === "INVOICED" ? "Invoiced" : j.status === "DELIVERED" ? "Delivered" : "Shipped";
  if (j.status === "PACKED") return "Shipping";
  if (PRESS_ON.includes(j.status)) return STEP_LABEL[j.status];
  if (j.createdAt < JOBS_LIVE_SINCE) return "";
  // Pre-press steps per Mike (11/19): preflight, PDF proof, hard proof.
  const st = stageFor(j, pdf, hard), onHard = pdf?.status === "APPROVED";
  if (st === "art") return "Artwork from customer";
  if (st === "preflight") return "Preflight (pre-press)";
  if (st === "make") return pdf ? "Proof changes (pre-press)" : "Proof from pre-press";
  if (st === "send") return onHard ? "CSR to send hard proof" : "CSR to send proof";
  if (st === "customer") return onHard ? "Customer hard proof approval" : "Customer proof approval";
  if (st === "hard") { const h = hardStep(j, pdf, hard); return h === "decide" ? "Proof type on ticket (CSR)" : h === "review" ? "Hard proof check (CSR + sales)" : h === "reprint" ? "Hard proof changes (pre-press)" : "Hard proof (pre-press)"; }
  if (press && !press.cleared) return press.waitingOn.filter((w) => w !== "proof").map((w) => w[0].toUpperCase() + w.slice(1)).join(" + ") || "Press";
  if (!j.routedAt) return "Darrin to route";
  return "Ready for press";
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const prisma = (await import("@/lib/prisma")).default;
    if (!prisma) return NextResponse.json({ jobs: [], source: "empty" });

    // The live team (accounting, shipping) never sees TEST jobs.
    const jobs = await prisma.job.findMany({
      where: isLiveUser(session) ? { isTest: false } : undefined,
      include: { order: { include: { company: true } }, csr: true, salesRep: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    // Press gate at a glance for live jobs (Benjy 11/17): proof approved + deposit in.
    const liveIds = jobs.filter((j) => j.createdAt >= JOBS_LIVE_SINCE).map((j) => j.id);
    const [invs, proofs] = liveIds.length ? await Promise.all([
      prisma.invoice.findMany({ where: { jobId: { in: liveIds }, status: { notIn: ["cancelled"] } }, select: { jobId: true, status: true, depositPaid: true, total: true, paidAmount: true } }),
      prisma.proof.findMany({ where: { jobId: { in: liveIds }, status: "APPROVED" }, select: { jobId: true, kind: true } }),
    ]) : [[], []];
    // Proofing is done with the final proof: the hard proof, or the PDF on PDF-only jobs (Mike 11/19).
    const approved = new Set(jobs.filter((j: any) => proofsDone(j, (proofs as any[]).filter((p) => p.jobId === j.id))).map((j: any) => j.id));
    // Latest proof per live job, for the "Waiting on" column (Benjy 11/18).
    const latestProofs = liveIds.length ? await prisma.proof.findMany({ where: { jobId: { in: liveIds } }, orderBy: { version: "desc" }, select: { jobId: true, status: true, sentToCustomerAt: true, kind: true } }) : [];
    const proofOf = (id: string, kind: string) => (latestProofs as any[]).find((p) => p.jobId === id && (p.kind || "pdf") === kind) || null;

    const formatted = jobs.map((j: any) => {
      let press: { cleared: boolean; waitingOn: string[] } | null = null;
      let pay: { label: string; tone: string } | null = null;
      if (j.createdAt >= JOBS_LIVE_SINCE) {
        const terms = j.paymentTerms || DEFAULT_TERMS;
        const mine = (invs as any[]).filter((i) => i.jobId === j.id && i.status !== "draft");
        const needs = terms === "deposit50" || terms === "prepaid";
        const paid = !needs ? true : terms === "prepaid" ? mine.length > 0 && mine.every((i) => i.status === "paid" || i.total - (i.paidAmount || 0) <= 0.01) : mine.some((i) => i.depositPaid || i.status === "paid" || i.status === "deposit_paid");
        const waitingOn = [...(approved.has(j.id) ? [] : ["proof"]), ...(paid ? [] : [terms === "prepaid" ? "payment" : "deposit"])];
        press = { cleared: !!j.pressOverride || waitingOn.length === 0, waitingOn };
        // What the CSR and Shayla need to see before it ships (Kelsey 11/20).
        const bal = mine.reduce((t: number, i: any) => t + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0);
        const allPaid = mine.length > 0 && bal <= 0.01;
        pay = allPaid ? { label: "Paid", tone: "ok" }
          : terms === "cod" ? { label: "COD", tone: "warn" }
          : terms === "prepaid" ? { label: "Prepay due", tone: "warn" }
          : terms === "deposit50" ? (paid ? { label: mine.length && bal > 0.01 ? "Deposit paid, balance due" : "Deposit paid", tone: "ok" } : { label: "Deposit due", tone: "warn" })
          : { label: mine.length ? `Net 30, $${Math.round(bal).toLocaleString()} open` : "Net 30", tone: "neutral" };
      }
      return {
        id: j.id, jobNumber: j.jobNumber, orderId: j.orderId, orderNumber: j.order.orderNumber, name: j.name, description: j.description,
        companyId: j.order.companyId, companyName: j.order.company.name, status: j.status, priority: j.priority, quantity: j.quantity,
        dueDate: j.dueDate?.toISOString().split("T")[0] || "", csrName: j.csr?.name ?? "", salesRepName: j.salesRep?.name || j.repName || "",
        productionOwnerName: "", updatedAt: j.updatedAt?.toISOString() ?? "",
        isLate: j.dueDate ? j.dueDate < new Date() && !["SHIPPED", "DELIVERED", "INVOICED"].includes(j.status) : false,
        isBlocked: false, paymentTerms: j.paymentTerms || null, press,
        productType: j.productType, pay, isTest: isTestJob(j), routeStatus: j.routeStatus || null, pressAssignment: j.pressAssignment || null, routed: !!j.routedAt,
        test: j.createdAt < JOBS_LIVE_SINCE || /^QA-/i.test(j.jobNumber || ""), tab: tabFor(j), waitingOn: waitingFor(j, press, proofOf(j.id, "pdf"), proofOf(j.id, "hard")),
      };
    });
    // Darrin edits Status + Press right on the list, like his FileMaker WIP screen (11/20).
    const wip = STATUS_ROLES.includes(session.role) ? { statuses: ROUTE_STATUSES, presses: ROUTE_PRESSES, canPress: ROUTE_ROLES.includes(session.role) } : null;
    return NextResponse.json({ jobs: formatted, wip, testMode: isTester(session), source: "database" });
  } catch (error) {
    console.error("Jobs GET error:", error);
    return NextResponse.json({ jobs: [], source: "empty" });
  }
}

async function nextJobNumber(prisma: any) {
  const prefix = `PKG-${new Date().getFullYear()}-`;
  const rows = await prisma.job.findMany({ where: { jobNumber: { startsWith: prefix } }, select: { jobNumber: true } });
  const max = rows.reduce((m: number, r: any) => { const n = Number(String(r.jobNumber).slice(prefix.length)); return Number.isInteger(n) && n > m && n < 100000 ? n : m; }, 99);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// Create a job (Benjy 11/17). The customer comes from the Customers list (no
// retyped names), or a new customer is set up from the billing info. The CSR may
// keep the FileMaker job # while both systems run side by side. Entering the job
// drafts its deposit invoice for accounting automatically.
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Customers cannot create jobs" }, { status: 403 });
    const prisma = (await import("@/lib/prisma")).default;
    if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    const b = await request.json();
    const t = (v: unknown, max = 500) => (v === null || v === undefined ? "" : String(v).trim().slice(0, max));

    const name = t(b.name, 200), quantity = parseInt(b.quantity);
    if (!name || !(quantity > 0)) return NextResponse.json({ error: "Job name and quantity are required" }, { status: 400 });
    let terms: string = TERMS[b.paymentTerms] ? b.paymentTerms : "";

    // December test mode: a tester's jobs (and any customer they set up) are TEST ones.
    const testing = isTester(session);
    // Customer: picked from the list, or a new one set up now.
    let companyId: string | null = b.companyId ? String(b.companyId) : null;
    if (companyId) {
      if (!(await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }))) return NextResponse.json({ error: "Customer record not found" }, { status: 400 });
    } else if (b.newCustomer?.name) {
      const nc = b.newCustomer;
      const cname = t(nc.name, 200);
      const slug = cname.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const { findCompanyByName, archivedMessage } = await import("@/lib/lead-company");
      const same: any = await findCompanyByName(prisma, cname);
      if (same && same.isActive === false) return NextResponse.json({ error: archivedMessage(same), archived: true, existingId: same.id }, { status: 409 });
      const dupe = same || await prisma.company.findFirst({ where: { OR: [{ slug }, { name: { equals: cname, mode: "insensitive" } }] }, select: { id: true, name: true } });
      if (dupe) return NextResponse.json({ error: `"${dupe.name}" is already in Customers. Pick it from the list instead.`, existingId: dupe.id }, { status: 409 });
      const lines = t(nc.address, 500).split(/\n/).map((s) => s.trim()).filter(Boolean);
      const last = lines.length > 1 ? lines[lines.length - 1] : "";
      const m = last.match(/^(.*?),\s*([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
      const co = await prisma.company.create({ data: {
        name: cname, slug, type: "customer", phone: t(nc.phone, 40) || null, isTest: testing,
        address: m ? lines.slice(0, -1).join(", ") : lines.join(", ") || null, city: m ? m[1] : null, state: m ? m[2].toUpperCase() : null, zip: m ? m[3] : null,
        contacts: nc.contact ? { create: [{ name: t(nc.contact, 120), email: t(nc.email, 200).toLowerCase() || null, phone: t(nc.phone, 40) || null, title: "Billing", isPrimary: true }] } : undefined,
      } });
      companyId = co.id;
    } else return NextResponse.json({ error: "Pick the customer from the Customers list" }, { status: 400 });

    // Terms (Benjy 11/18): the customer's terms on file unless the CSR set them
    // for this job. Nothing on file and nothing picked: 50% down.
    const onFile = (await prisma.company.findUnique({ where: { id: companyId }, select: { paymentTerms: true, name: true } }) as any);
    const canSetTerms = TERMS_SET_ROLES.includes(session.role);
    if (!canSetTerms) terms = "";
    if (!terms) terms = onFile?.paymentTerms || DEFAULT_TERMS;

    // Job number: the FileMaker number if the CSR typed one (side-by-side test), else the next one.
    let jobNumber = t(b.jobNumber, 40).toUpperCase();
    if (jobNumber) {
      if (await prisma.job.findUnique({ where: { jobNumber }, select: { id: true } })) return NextResponse.json({ error: `Job ${jobNumber} already exists` }, { status: 409 });
    } else jobNumber = await nextJobNumber(prisma);

    const orderCount = await prisma.order.count();
    const order = await prisma.order.create({ data: {
      orderNumber: `ORD-${String(orderCount + 20000).padStart(5, "0")}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
      companyId, status: "ARTWORK_RECEIVED", priority: b.priority || "NORMAL", poNumber: t(b.customerPO, 60) || null,
      dueDate: b.dueDate ? new Date(b.dueDate) : undefined,
    } });
    const salesRep = b.salesRepId ? await prisma.user.findUnique({ where: { id: String(b.salesRepId) }, select: { id: true, name: true } }) : null;
    const job = await prisma.job.create({
      data: {
        jobNumber, orderId: order.id, name, description: t(b.description, 2000) || null,
        status: "ARTWORK_RECEIVED", priority: b.priority || "NORMAL", quantity,
        dueDate: b.dueDate ? new Date(b.dueDate) : null,
        productType: b.productType === "COMMERCIAL_PRINT" ? "COMMERCIAL_PRINT" : "FOLDING_CARTON",
        estimatedHours: b.estimatedHours ? parseFloat(b.estimatedHours) || null : null,
        estimateNumber: t(b.estimateNumber, 60) || null, customerPO: t(b.customerPO, 60) || null,
        quotedPrice: Number(b.quotedPrice) > 0 ? Math.round(Number(b.quotedPrice) * 100) / 100 : null,
        salesRepId: salesRep?.id || null, repName: salesRep?.name || null, csrId: session.role === "CSR" ? session.id : null,
        contactName: t(b.contactName, 120) || null, deliveryTo: t(b.deliveryTo, 500) || null,
        generalNotes: t(b.generalNotes, 4000) || null, enteredDate: new Date(),
        paymentTerms: terms, artworkStatus: ["ready", "coming", "design", "reprint"].includes(b.artworkStatus) ? b.artworkStatus : null,
        jobType: b.artworkStatus === "reprint" ? "EXACT_REPRINT" : "NEW_ORDER", handoffId: b.handoffId || null,
        hardProof: ["customer", "internal", "none"].includes(b.hardProof) ? b.hardProof : null,
        isTest: testing,
      } as any,
      include: { order: { include: { company: true } } },
    });

    await prisma.activityLog.create({ data: { orderId: order.id, userId: session.id, action: "JOB_CREATED", details: `Created job ${jobNumber}: ${name}` } }).catch(() => {});
    const autoFlags: any[] = [
      { jobId: job.id, category: "paper", description: `Substrate for ${name} - ${quantity} units`, status: "needed" },
      { jobId: job.id, category: "ink", description: `Process inks for ${name}`, status: "needed" },
    ];
    if (b.productType !== "COMMERCIAL_PRINT") autoFlags.push({ jobId: job.id, category: "cutting_die", description: `Cutting die for ${name}`, status: "needed" });
    await prisma.purchaseFlag.createMany({ data: autoFlags }).catch(() => {});

    // Save the terms to the customer when asked (or when none were on file).
    // TEST jobs never change a customer's terms or email accounting (Denise is live).
    if (testing) { /* terms stay on this TEST job only */ }
    else if (canSetTerms && TERMS[b.paymentTerms] && (b.saveTerms || !onFile?.paymentTerms)) {
      try { await setCustomerTerms(prisma, companyId, terms, { name: session.name, role: session.role, email: session.email }, `while entering job ${jobNumber}`); } catch (e) { console.error("save terms failed", e); }
    } else if (onFile?.paymentTerms && terms !== onFile.paymentTerms && (terms === "net30" || terms === "cod") && !["OWNER", "GM", "ADMIN", "ACCOUNTING"].includes(session.role)) {
      await tellAccounting(prisma, `Job ${jobNumber} entered on ${TERMS[terms]}`, `<p>${session.name} entered job ${jobNumber} for <b>${onFile.name}</b> on <b>${TERMS[terms]}</b>, just for this job. The customer's terms on file are ${TERMS[onFile.paymentTerms]}.</p>`, session.email);
    }

    // Proof type: becomes the customer's default when asked, or when none is on file (Benjy 11/19).
    if (!testing && ["customer", "internal", "none"].includes(b.hardProof) && b.saveProof) await prisma.company.update({ where: { id: companyId }, data: { hardProofDefault: b.hardProof } as any }).catch(() => {});

    // The approved prototype this job came from: link it and carry the die (Benjy 11/18).
    if (b.prototypeId) {
      try {
        const proto = await (prisma as any).prototype.findUnique({ where: { id: String(b.prototypeId) } });
        if (proto) {
          await (prisma as any).prototype.update({ where: { id: proto.id }, data: { jobId: job.id, companyId: proto.companyId || companyId } });
          if (proto.dieNumber && !job.dieNumber) await prisma.job.update({ where: { id: job.id }, data: { dieNumber: proto.dieNumber } as any });
        }
      } catch (e) { console.error("prototype link failed", e); }
    }

    // Close the sales handoff it came from.
    if (b.handoffId) await (prisma as any).jobHandoff.update({ where: { id: String(b.handoffId) }, data: { status: "entered", jobId: job.id, handledByName: session.name, companyId } }).catch(() => {});

    // Carrie's step 5 without anyone forwarding anything: draft the deposit invoice for accounting.
    let depositInvoice: string | null = null;
    // Shipments Shayla keyed with this job # before the ticket existed get tied to it (Benjy 11/19).
    if (!testing) try { const { linkShipmentsToJob } = await import("@/lib/shipping-server"); await linkShipmentsToJob(prisma, job.id); } catch (e) { console.error("shipment link failed", e); }
    // Darrin gets every new ticket to route (11/18/26).
    try { const { notifyPlantNewJob } = await import("@/lib/routing"); await notifyPlantNewJob(prisma, job.id, { name: session.name, email: session.email }); } catch (e) { console.error("plant notice failed", e); }
    try { const inv = await draftDepositInvoice(prisma, job.id, { byName: session.name, byEmail: session.email, taxExempt: !!b.taxExempt, contactEmail: t(b.billingEmail, 200).toLowerCase() || null }); depositInvoice = inv?.invoiceNumber || null; } catch (e) { console.error("deposit draft failed", e); }

    return NextResponse.json({
      job: {
        id: job.id, jobNumber: job.jobNumber, orderId: job.orderId, orderNumber: order.orderNumber, name: job.name, description: job.description,
        companyId, companyName: job.order.company.name, status: job.status, priority: job.priority, quantity: job.quantity,
        dueDate: job.dueDate?.toISOString().split("T")[0] || "", isLate: false, isBlocked: false, paymentTerms: terms,
        press: { cleared: false, waitingOn: ["proof", ...(terms === "deposit50" || terms === "prepaid" ? [terms === "prepaid" ? "payment" : "deposit"] : [])] },
      },
      depositInvoice,
    });
  } catch (error) {
    console.error("Jobs POST error:", error);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
