// Invoice line items + flat-dollar deposit (Denise 11/24/26): a separate quantity,
// as many description lines as she needs, and a deposit as a % or a flat $ amount.
// Shared by the server (create / edit / emails / pay page) and the invoice forms.

export type InvLine = { qty: number | null; description: string; amount: number };

const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => { const n = Number(String(v ?? "").replace(/[$,\s]/g, "")); return Number.isFinite(n) ? n : NaN; };

/** Keeps the lines that say something; quantity optional, amount may be 0 (a pure description line). */
export function cleanLines(raw: unknown): InvLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 60).map((l: any) => {
    const qty = num(l?.qty);
    const amount = num(l?.amount);
    return { qty: qty > 0 ? qty : null, description: String(l?.description ?? "").trim().slice(0, 500), amount: Number.isFinite(amount) ? r2(amount) : 0 };
  }).filter((l) => l.description || l.amount || l.qty);
}

export const linesSubtotal = (lines: InvLine[]) => r2(lines.reduce((t, l) => t + (l.amount || 0), 0));

/** One-line summary kept in Invoice.description (lists, Sage export, older screens). */
export const linesText = (lines: InvLine[]) =>
  lines.map((l) => `${l.qty ? `${l.qty.toLocaleString("en-US")} x ` : ""}${l.description}`.trim()).filter(Boolean).join("; ").slice(0, 2000);

/** Lines stored on an invoice (older invoices have none: show the description). */
export const invoiceLines = (inv: { lines?: unknown }) => cleanLines(inv?.lines);

type Dep = { kind?: string | null; depositFlat?: boolean | null; depositPercent?: number | null; depositAmount?: number | null };

/** "50% deposit" or, for a flat amount, just "Deposit". */
export const depositLabel = (inv: Dep) => (inv.depositFlat ? "Deposit" : `${inv.depositPercent ?? 0}% deposit`);

/** The deposit after the total changes: a flat amount stays put (capped at the total), a % follows the total. */
export function depositFor(inv: Dep, total: number) {
  if (inv.kind === "deposit") return r2(total);
  if (inv.depositFlat) return r2(Math.min(Math.max(0, Number(inv.depositAmount) || 0), total));
  return r2(total * (Number(inv.depositPercent) || 0) / 100);
}

/** Deposit from the form: a flat $ (when given) wins over a %. */
export function depositFromForm(body: { kind?: string; depositFlat?: unknown; depositPercent?: unknown }, total: number) {
  if (body.kind === "deposit") return { depositFlat: false, depositPercent: 100, depositAmount: r2(total) };
  const flat = num(body.depositFlat);
  if (body.depositFlat !== undefined && body.depositFlat !== null && body.depositFlat !== "" && flat >= 0) {
    const amt = r2(Math.min(flat, total));
    return { depositFlat: true, depositPercent: total > 0 ? r2((amt / total) * 100) : 0, depositAmount: amt };
  }
  const pct = Number.isFinite(num(body.depositPercent)) ? num(body.depositPercent) : 50;
  return { depositFlat: false, depositPercent: pct, depositAmount: r2(total * pct / 100) };
}
