// Hand-key runner — one quote at a time, keyed the way MARY would key it,
// diffed line-by-line against E&M's printed numbers. (Benjy 8/21: "hand key
// every single quote so you can identify which things are missing".)
import { computeClassic, type ClassicForm } from "../../src/lib/classic-estimate";

export interface Expected {
  // per-quote expected values, straight off the E&M printout
  letterPrice: number;          // the customer letter price
  internalTotal?: number;       // sum of part totals when it differs
  paperCost?: number;           // summed across parts
  outsideCost?: number;
  perBucket?: { paper?: number; material?: number; labor?: number };
}

export interface HandKeyResult {
  est: string; desc: string; pct: number; pass: boolean; lines: string[];
}

// Template capture (Benjy 8/24 "Start from a past quote"): running a tranche
// with CAPTURE_TEMPLATES=1 collects every keyed form for export.
export const captured: { est: string; desc: string; form: ClassicForm; letterPrice: number }[] = [];

export function runQuote(est: string, desc: string, form: ClassicForm, exp: Expected): HandKeyResult {
  if (process.env.CAPTURE_TEMPLATES) captured.push({ est, desc, form: JSON.parse(JSON.stringify(form)), letterPrice: exp.letterPrice });
  const c: any = computeClassic(form, null);
  const lines: string[] = [];
  const row = (k: string, em: number | undefined, gz: number, tolPct = 1.5) => {
    if (em === undefined) return true;
    const d = em !== 0 ? ((gz - em) / em) * 100 : (gz === 0 ? 0 : 100);
    // E&M displays hours rounded to 0.1 but bills unrounded dollars, so tiny
    // quotes carry a few dollars of display-rounding noise. $3 or 1.5%.
    const ok = Math.abs(d) <= tolPct || Math.abs(gz - em) <= 3;
    lines.push(`   ${ok ? "ok " : "MISS"} ${k.padEnd(14)} E&M ${em.toFixed(2).padStart(10)}  GZ ${gz.toFixed(2).padStart(10)}  ${d >= 0 ? "+" : ""}${d.toFixed(1)}%`);
    return ok;
  };
  row("paper", exp.paperCost, c.paperCost);
  row("outside", exp.outsideCost, c.outsideCost);
  row("labor", exp.perBucket?.labor, (c.prepLabor || 0) + (c.pressCost || 0) + (c.binderyCost || 0));
  row("material", exp.perBucket?.material, c.materialCost);
  const target = exp.internalTotal ?? exp.letterPrice;
  const pct = target ? ((c.total - target) / target) * 100 : 0;
  const pass = Math.abs(pct) <= 1.5 || Math.abs(c.total - target) <= 3;
  lines.push(`   ${pass ? "PASS" : "FAIL"} TOTAL          E&M ${target.toFixed(2).padStart(10)}  GZ ${c.total.toFixed(2).padStart(10)}  ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`);
  return { est, desc, pct, pass, lines };
}

export function report(results: HandKeyResult[]) {
  for (const r of results) {
    console.log(`\n#${r.est} — ${r.desc}`);
    for (const l of r.lines) console.log(l);
  }
  const p = results.filter((r) => r.pass).length;
  console.log(`\n=== ${p}/${results.length} within 1.5% ===`);
}
