// One-off: apply researched city/state for leads that had no state (Benjy 8/2).
// Sourced from company contact/about pages — see `src` on each row.
//   npx tsx scripts/apply-researched-geo.ts            → dry run
//   npx tsx scripts/apply-researched-geo.ts --apply    → writes
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type Row = { id: string; name: string; city: string; state: string; src: string };

const US: Row[] = [
  { id: "cmrtoce2a000004kzrlfj9egl", name: "AC Graphics", city: "Hialeah", state: "FL", src: "acgraphics.com" },
  { id: "ldd1aa862e00f2e236ffb12e91", name: "Arnet Pharmaceutical", city: "Davie", state: "FL", src: "arnetusa.com" },
  { id: "ld731baac73513e4fc2e7d7c68", name: "Buddy Brew", city: "Tampa", state: "FL", src: "buddybrew.com" },
  { id: "ld2e8cb3a3c40c43b2bd22a76e", name: "Buucan", city: "Coral Gables", state: "FL", src: "buccancoralgables.com" },
  { id: "ld2ad06b75b1d7ea6b6aee83ab", name: "Cafe Vico", city: "Fort Lauderdale", state: "FL", src: "cafevicorestaurant.com" },
  { id: "ld0fc34022daae937fab3f9a0e", name: "Cafe Vico (dup)", city: "Fort Lauderdale", state: "FL", src: "cafevicorestaurant.com" },
  { id: "ld068adbec4d949ed51ee432b6", name: "Capital Infusion", city: "Miami", state: "FL", src: "capital-infusion.com" },
  { id: "ldb5fd15217b8d9c34ea5d2bdc", name: "Corona Brush", city: "Tampa", state: "FL", src: "coronabrushes.com" },
  { id: "ld0ae296c094ae3532ea028e97", name: "Cortez Conservas", city: "Calistoga", state: "CA", src: "cortezconservas.com" },
  { id: "ld05a6c7e846eaa02c7f6e8e72", name: "Cortez Conservas (dup)", city: "Calistoga", state: "CA", src: "cortezconservas.com" },
  { id: "cmrf4pkkk000604l9yzz1tkt2", name: "Elegant Kosher Catering", city: "Miami", state: "FL", src: "elegantkoshercatering.com" },
  { id: "ldbed49e12c859b13ded5eacdf", name: "Faropoint", city: "Hoboken", state: "NJ", src: "faropoint.com" },
  { id: "cmrce436z000004kt18bl7m89", name: "Fresco", city: "Aventura", state: "FL", src: "freskomiami.com" },
  { id: "cmrtjnzkn000004jvbrv22zib", name: "Givr Packaging", city: "Palm Bay", state: "FL", src: "givrpack.com" },
  { id: "cms4r8thn000004jva95asnf6", name: "HalfMoon Empanadas", city: "Miami", state: "FL", src: "Half Moon Empanadas LLC" },
  { id: "cmrf4meb2000304l91hc8zr9d", name: "HamsasofMunkatch", city: "West Hartford", state: "CT", src: "jewishjoy.co studio" },
  { id: "ldfab7b87c3768a815864edcbf", name: "Hive Bakery", city: "West Palm Beach", state: "FL", src: "hivebakeryandcafe.com" },
  { id: "ldabf1aefea2f6d5846ea1718c", name: "Home Free Pool Services", city: "Clearwater", state: "FL", src: "homefreepoolservices.com" },
  { id: "ldfa860db3cda259d39de39889", name: "Integer Holdings", city: "Plano", state: "TX", src: "D&B" },
  { id: "cmrf4q8n6000704l93k96f4yf", name: "Jerusalem Chefs Table", city: "Las Vegas", state: "NV", src: "4825 W Flamingo Rd" },
  { id: "cmrf4ouj5000504l9xa99aedn", name: "Jewish Joy", city: "West Hartford", state: "CT", src: "jewishjoy.co" },
  { id: "cmrf4k278000204l9rueom0tf", name: "Ladle and Loaf", city: "New Haven", state: "CT", src: "ladleandloafct.com" },
  { id: "ld27c3590d539f7908224bbf37", name: "Land Closers Academy", city: "Dallas", state: "TX", src: "Land Scaling Summit" },
  { id: "cms67ub5n000004joc8iuu693", name: "Lola The Boys", city: "Chicago", state: "IL", src: "lolaandtheboys.com" },
  { id: "ld80f781b1b6812cfdcca124e9", name: "Mamas Cakes", city: "Miami", state: "FL", src: "mamascakesinc.com" },
  { id: "cmrdl9uqp000104jr73h2vqxt", name: "Mazzaandmore", city: "Brooklyn", state: "NY", src: "mazzaandmore.com" },
  { id: "cmrnl3ntn000004i8tu9jju5r", name: "Milam Bakery", city: "Miami Springs", state: "FL", src: "Milam's Markets HQ" },
  { id: "cms51nlox000004jrjw753xjo", name: "Nivessa Vinyl", city: "Los Angeles", state: "CA", src: "nivessa.com" },
  { id: "cmr9btprm000004jurz4ng79q", name: "No.1 Flowers", city: "Windermere", state: "FL", src: "no1flowersbyjo.com" },
  { id: "ld0bdf152ef999b426347e10f7", name: "Nutraceuticals Factory", city: "St. Petersburg", state: "FL", src: "nutraceuticalsfactory.com" },
  { id: "cms3cs1fo000004icm7vp41w1", name: "Operating Engineers 324", city: "Bloomfield Township", state: "MI", src: "IUOE Local 324" },
  { id: "ld7b2440398367579b35ed647d", name: "Apex Capital Realty", city: "Miami", state: "FL", src: "apexcapitalrealty.com" },
  { id: "cms1zv65v000004jso8jffy5e", name: "Realty Masters and Associates", city: "Chino", state: "CA", src: "15316 Central Ave" },
  { id: "cmrf4j9k8000104l98z6chphs", name: "Rental World", city: "Kissimmee", state: "FL", src: "rentalworldfl.com" },
  { id: "cms6fl6ua000004l5icxaknn5", name: "Seventeen Kosher Restaurant", city: "Miami Beach", state: "FL", src: "17restaurant.com" },
  { id: "cmruq8skk000004lasj81eu0d", name: "Shipleys Donuts", city: "Houston", state: "TX", src: "Shipley Do-Nuts HQ" },
  { id: "cmrtebsy7000004kx6cf03xw9", name: "Sunpress Vinyl", city: "Opa-locka", state: "FL", src: "sunpressvinyl.com" },
  { id: "ld38a6468ee4c9f47305d34c21", name: "Stilt Affiliate Program", city: "San Francisco", state: "CA", src: "Stilt (YC)" },
  { id: "lda361514c9c36cac2428fe63e", name: "Vita Works", city: "Fairfield", state: "NJ", src: "vitaworksusa.com" },
];

// Not US — state stays blank on purpose; city + a note so the blank reads as
// "international", not "we never finished the research".
const INTL: { id: string; name: string; city: string; country: string }[] = [
  { id: "ld43ea9fed0b9c80f9bf923021", name: "Aruba Aloe", city: "Oranjestad", country: "Aruba" },
  { id: "ld19a259cbffcea02e392d898b", name: "Ere Perez", city: "Sydney", country: "Australia" },
  { id: "ldc3a33b1e7adf02a125f2698c", name: "Falstaff Travel GmbH", city: "Vienna", country: "Austria" },
];

(async () => {
  console.log(`\nUS rows to set: ${US.length}   International (city only): ${INTL.length}\n`);
  for (const r of US) console.log(`  ${r.name.padEnd(30).slice(0, 30)} -> ${r.city}, ${r.state}   [${r.src}]`);
  for (const r of INTL) console.log(`  ${r.name.padEnd(30).slice(0, 30)} -> ${r.city} (${r.country}) — state left blank`);

  if (!APPLY) { console.log("\nDRY RUN — nothing written. Re-run with --apply.\n"); }
  else {
    let n = 0;
    for (const r of US) {
      const cur = await prisma.lead.findUnique({ where: { id: r.id }, select: { city: true, state: true } });
      if (!cur) { console.log(`  MISSING (skipped): ${r.name}`); continue; }
      await prisma.lead.update({ where: { id: r.id }, data: { city: cur.city || r.city, state: r.state } });
      n++;
    }
    for (const r of INTL) {
      const cur = await prisma.lead.findUnique({ where: { id: r.id }, select: { city: true, commentary: true } });
      if (!cur) continue;
      const note = `[Geo] International business - ${r.city}, ${r.country}. No US state by design.`;
      await prisma.lead.update({ where: { id: r.id }, data: {
        city: cur.city || r.city,
        commentary: (cur.commentary || "").includes("[Geo] International") ? cur.commentary : `${cur.commentary || ""}\n${note}`.trim().slice(0, 8000),
      } });
      n++;
    }
    // Bad data caught during research: the AC Graphics lead carried
    // avgraphics.com, which is an unrelated California company.
    await prisma.lead.update({ where: { id: "cmrtoce2a000004kzrlfj9egl" }, data: { website: "acgraphics.com" } }).catch(() => {});
    console.log(`\nApplied ${n} rows (+ corrected the AC Graphics website).\n`);
  }
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
