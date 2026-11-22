// Proves src/lib/flex-online-estimator.ts gives the same answers as Nitay's cd_flex_estimator.py.
//
//   npx tsx scripts/flex-online-parity.ts                 (the cases kept in scripts/fixtures)
//   npx tsx scripts/flex-online-parity.ts <cases.json>    (any file made by the Python case generator)
//
// Every number in every case must match exactly: price, cost, each cost line, feet, minutes, layout.
// Touches no database and sends nothing anywhere. Run it after ANY change to the estimator's numbers,
// with a fresh cases file generated from the matching Python file.
import fs from "fs";
import path from "path";
import { quote, _validate_against_workbook, FlexQuoteError, type Product } from "../src/lib/flex-online-estimator";

const file = process.argv[2] || path.join(__dirname, "fixtures", "flex-online-cases.json");
const data = JSON.parse(fs.readFileSync(file, "utf8")) as { workbook: number; cases: { product: Product; args: Record<string, unknown>; out?: Record<string, unknown>; error?: string }[] };

let bad = 0;
const fail = (i: number, msg: string, c: unknown) => { bad++; if (bad <= 12) console.log(`  case ${i}: ${msg}\n     ${JSON.stringify(c).slice(0, 260)}`); };

const wb = _validate_against_workbook();
console.log(`HP workbook default scenario: $${wb.toFixed(2)} (Python $${data.workbook.toFixed(2)}, HP workbook $442.97)`);
if (wb !== data.workbook || Math.abs(wb - 442.97) > 0.005) { bad++; console.log("  MISMATCH on the workbook scenario"); }

const same = (a: unknown, b: unknown): boolean => {
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object), kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return a === b;
};

let priced = 0, refused = 0;
data.cases.forEach((c, i) => {
  try {
    const got = quote(c.product, c.args) as unknown as Record<string, unknown>;
    if (c.error) return fail(i, `Python refused this job ("${c.error.slice(0, 60)}") but the port priced it at $${got.price_total}`, c.args);
    priced++;
    const want = c.out!;
    const keys = new Set([...Object.keys(want), ...Object.keys(got).filter((k) => got[k] !== undefined)]);
    for (const k of keys) if (!same(want[k], got[k])) return fail(i, `${k}: Python ${JSON.stringify(want[k])}  port ${JSON.stringify(got[k])}`, { product: c.product, ...c.args });
  } catch (e) {
    if (!(e instanceof FlexQuoteError)) throw e;
    if (!c.error) return fail(i, `the port refused a job Python priced: ${e.message}`, { product: c.product, ...c.args });
    refused++;   // both refuse; the wording of the reason is not compared (Python prints 3.0 where this prints 3)
  }
});
console.log(`${data.cases.length} cases: ${priced} priced, ${refused} refused by both, ${bad} DIFFERENT`);
process.exit(bad ? 1 : 0);
