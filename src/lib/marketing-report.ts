// Monthly marketing leads log for Habib (C&D's marketing agency) — Benjy
// 9/22/2026: "he needs some data from our quotes". Habib keeps a Google Sheet
// "CND - Leads Log" (one row per inbound lead; C&D fills Status, Quote Value,
// Closed Value, Repeat Revenue) that feeds his CAC / LTV dashboard. This
// builds those exact columns from Godzilla so nobody re-keys them.
//
// What Godzilla knows today: every website / inbound-agent lead (date,
// company, contact, where it stands). Quote and revenue figures fill in only
// where a Godzilla quote or paid invoice exists for that company — live
// customer/job data is still in E&M until go-live, so those columns can be
// blank and C&D adds them by hand.
import type { PrismaClient } from "@/generated/prisma";

export interface LeadLogRow {
  dateIn: string; month: string; company: string; contact: string;
  status: "New" | "Quoted" | "Won" | "Lost";
  quoteValue: number | null; closedValue: number | null; repeatRevenue: number | null; totalRevenue: number | null;
  notes: string;
}
export interface MonthSummary { month: string; leads: number; quoted: number; won: number; revenue: number }

const SKIP = /not a quote|duplicate|scam|spam|disqualif|unsubscrib|existing account/i; // Habib's log only carries real new inquiries

function monthLabel(d: Date) { return d.toLocaleString("en-US", { month: "short", timeZone: "America/New_York" }) + " " + String(d.getFullYear()).slice(2); }
function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

export async function buildLeadsLog(prisma: PrismaClient): Promise<{ rows: LeadLogRow[]; months: MonthSummary[] }> {
  const leads = await prisma.lead.findMany({
    // website / inbound-agent leads only, from when Habib's campaigns started (Aug 2026);
    // MailerCity flow-through is not marketing-sourced
    where: { source: "inbound", createdAt: { gte: new Date(process.env.MARKETING_REPORT_SINCE || "2026-08-01T00:00:00Z") } },
    orderBy: { createdAt: "asc" },
    select: { companyName: true, contactName: true, pipelineStage: true, stage: true, agentStatus: true, agentQuote: true, commentary: true, companyId: true, quoteId: true, createdAt: true, intakeRaw: true },
  });
  const quotes = await prisma.quote.findMany({ where: { status: { not: "ARCHIVED" }, totalPrice: { gt: 0 } }, select: { id: true, customerName: true, companyId: true, totalPrice: true, status: true } });
  const invoices = await prisma.invoice.findMany({ where: { status: { not: "VOID" } }, select: { customerName: true, companyId: true, total: true, balancePaid: true, depositPaid: true, createdAt: true }, orderBy: { createdAt: "asc" } });

  const rows: LeadLogRow[] = [];
  for (const l of leads) {
    const stageText = `${l.stage || ""} ${l.agentStatus || ""}`;
    if (l.pipelineStage === "LOST" && SKIP.test(stageText)) continue;
    if (SKIP.test(l.stage || "") && /duplicate|existing account/i.test(l.stage || "")) continue;
    const key = norm(l.companyName);
    const sameCo = (name: string, coId: string | null) => (l.companyId && coId && l.companyId === coId) || (key.length > 3 && norm(name) === key);

    const q = quotes.filter((x) => (l.quoteId && x.id === l.quoteId) || sameCo(x.customerName, x.companyId));
    const quoteValue = q.length ? Math.max(...q.map((x) => x.totalPrice)) : parseMoney(l.agentQuote);
    const paid = invoices.filter((x) => sameCo(x.customerName, x.companyId) && (x.balancePaid || x.depositPaid));
    const closedValue = paid.length ? paid[0].total : null;
    const repeat = paid.length > 1 ? paid.slice(1).reduce((s, x) => s + x.total, 0) : null;

    // "Won" only on money in the door: CUSTOMER stage in Godzilla also marks an
    // existing account that inquired, which is not a marketing win.
    let status: LeadLogRow["status"] = "New";
    if (closedValue) status = "Won";
    else if (l.pipelineStage === "LOST") status = "Lost";
    else if (quoteValue || /quote received|^sent$|quote sent|followup/i.test(stageText) || ["sent", "followup_1", "followup_2", "followup_3", "quote_received"].includes(l.agentStatus || "")) status = "Quoted";

    const note = [l.pipelineStage === "CUSTOMER" ? "existing account" : "", l.stage && !/^sent$/i.test(l.stage) ? l.stage : "", intakeSummary(l.intakeRaw) || firstLine(l.commentary)].filter(Boolean).join(" — ").slice(0, 200);
    rows.push({
      dateIn: l.createdAt.toISOString().slice(0, 10), month: monthLabel(l.createdAt),
      company: l.companyName, contact: l.contactName || "", status,
      quoteValue: quoteValue ? round2(quoteValue) : null, closedValue: closedValue ? round2(closedValue) : null,
      repeatRevenue: repeat ? round2(repeat) : null, totalRevenue: closedValue ? round2(closedValue + (repeat || 0)) : null,
      notes: note,
    });
  }
  const byMonth = new Map<string, MonthSummary>();
  for (const r of rows) {
    const m = byMonth.get(r.month) || { month: r.month, leads: 0, quoted: 0, won: 0, revenue: 0 };
    m.leads++; if (r.status === "Quoted" || r.status === "Won") m.quoted++; if (r.status === "Won") m.won++; m.revenue += r.totalRevenue || 0;
    byMonth.set(r.month, m);
  }
  return { rows, months: [...byMonth.values()] };
}

function parseMoney(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/\$\s?([\d,]+(?:\.\d{2})?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
}
// The website form posts JSON; pull the product / quantity / message fields, not the whole blob.
function intakeSummary(raw: string | null | undefined): string {
  if (!raw) return "";
  let j: Record<string, unknown>;
  try { j = JSON.parse(raw); } catch { return firstLine(raw); }
  const pick = (...keys: string[]) => keys.map((k) => j[k]).find((v) => typeof v === "string" && v.trim()) as string | undefined;
  const product = pick("What type of product do you need?", "What are you looking for?", "If Other, please describe type of product");
  const qty = pick("Quantity");
  const msg = pick("Message to C&D Printing", "Please describe");
  return [product, qty ? `qty ${qty}` : "", msg].filter(Boolean).join(", ").replace(/\s+/g, " ").slice(0, 160);
}
function firstLine(s: string | null | undefined) {
  if (!s) return "";
  const t = s.replace(/^\[[^\]]*\]\s*/gm, "").split(/\n/).map((x) => x.trim()).filter((x) => x && !/^(name|email|phone|company):/i.test(x));
  return (t[0] || "").slice(0, 120);
}
function round2(n: number) { return Math.round(n * 100) / 100; }

export function leadsLogCsv(rows: LeadLogRow[]): string {
  const esc = (v: string | number | null) => v === null || v === undefined ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const head = ["Date In", "Month", "Company", "Contact", "Status", "Quote Value", "Closed Value", "Repeat Revenue", "Total Cust. Revenue", "Notes"];
  return [head.join(","), ...rows.map((r) => [r.dateIn, r.month, r.company, r.contact, r.status, r.quoteValue, r.closedValue, r.repeatRevenue, r.totalRevenue, r.notes].map(esc).join(","))].join("\r\n");
}

export function leadsLogHtml(rows: LeadLogRow[], months: MonthSummary[], reportMonth: string): string {
  const money = (n: number | null) => n === null ? "" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const mrows = months.map((m) => `<tr><td>${m.month}</td><td align="right">${m.leads}</td><td align="right">${m.quoted}</td><td align="right">${m.won}</td><td align="right">${money(m.revenue)}</td></tr>`).join("");
  const recent = rows.filter((r) => r.month === reportMonth);
  const lrows = recent.map((r) => `<tr><td>${r.dateIn}</td><td>${escapeHtml(r.company)}</td><td>${escapeHtml(r.contact)}</td><td>${r.status}</td><td align="right">${money(r.quoteValue)}</td><td align="right">${money(r.closedValue)}</td><td style="color:#666;">${escapeHtml(r.notes)}</td></tr>`).join("");
  const td = "border-bottom:1px solid #eee;padding:4px 8px;font-size:13px;";
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.5;">
<p>Monthly leads log from Godzilla for the CND Leads Log / CAC dashboard. The attached CSV has every inbound lead in the sheet's column order; paste or reconcile as needed.</p>
<h3 style="margin:16px 0 6px;">By month</h3>
<table cellspacing="0" style="border-collapse:collapse;"><tr style="background:#f4f4f4;"><th style="${td}" align="left">Month</th><th style="${td}">Leads</th><th style="${td}">Quoted</th><th style="${td}">Won</th><th style="${td}">Revenue</th></tr>${mrows.replace(/<td/g, `<td style="${td}"`)}</table>
<h3 style="margin:16px 0 6px;">${reportMonth} leads (${recent.length})</h3>
<table cellspacing="0" style="border-collapse:collapse;"><tr style="background:#f4f4f4;"><th style="${td}" align="left">Date</th><th style="${td}" align="left">Company</th><th style="${td}" align="left">Contact</th><th style="${td}" align="left">Status</th><th style="${td}">Quote</th><th style="${td}">Closed</th><th style="${td}" align="left">Notes</th></tr>${lrows.replace(/<td/g, `<td style="${td}"`)}</table>
<p style="color:#666;font-size:12px;margin-top:14px;">Quote and revenue figures appear where Godzilla holds the quote or a paid invoice for that company; until Godzilla is live for all jobs, C&D fills the rest by hand. Spam, duplicates and "not a quote" inquiries are left out.</p>
<p style="color:#aaa;font-size:11px;margin-top:20px;">Automated from Godzilla on the 1st of each month.</p></div>`;
}
function escapeHtml(s: string) { return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string)); }
