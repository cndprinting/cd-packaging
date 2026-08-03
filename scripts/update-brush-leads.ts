// Apply researched detail to the brush/coatings batch (Benjy 8/3).
// Everything here was found on a company page or public profile — see `src`.
//   npx tsx scripts/update-brush-leads.ts --apply
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

type Row = {
  match: string; website: string; phone: string; city?: string;
  contactName?: string; contactTitle?: string;
  priority: number; fit: string; note: string;
};

const ROWS: Row[] = [
  {
    match: "Linzer", website: "https://linzerproducts.com/", phone: "(912) 685-3555",
    contactName: "Clint Mosley", contactTitle: "Plant Manager, Metter GA",
    priority: 1, fit: "STRONG",
    note: "STRONG FIT. 222,000 sq ft - Linzer's largest US operation, ~200 jobs. Retail paint brushes/rollers into big-box: needs printed hang cards, sleeves, cartons. CAVEAT: packaging is likely bought by corporate in West Babylon NY (631-253-3333, CEO Brent Swenson), not at the Metter plant. Clint Mosley is the local door in.",
  },
  {
    match: "Stinger Brush", website: "https://stingerbrush.com/", phone: "888-497-8464",
    priority: 1, fit: "STRONG",
    note: "STRONG FIT. Small/startup brand (est. ~2019), DTC plus Amazon, Walmart, Etsy and independent paint stores - exactly the retail packaging profile. No named contact published; site blocks automated fetch. Worth a call to 888-497-8464 to get the owner's name.",
  },
  {
    match: "Gordon Brush", website: "https://www.gordonbrush.com/", phone: "(800) 950-7950", city: "Hattiesburg",
    contactName: "Ken Rakusin", contactTitle: "President & CEO",
    priority: 2, fit: "MODERATE",
    note: "MODERATE FIT. ~$24M revenue. The Hattiesburg MS plant (66,000 sq ft) makes RV/vehicle/marine wash brushes - that CONSUMER line is the packaging opening; the rest of the company is industrial. HQ is City of Industry CA (323-724-7777). Marketing Manager: Melodie Wendleton.",
  },
  {
    match: "Industrial Brush", website: "https://industrialbrush.com/", phone: "(863) 647-5643",
    contactName: "John C. Cottam", contactTitle: "Co-President",
    priority: 3, fit: "WEAK",
    note: "WEAK FIT. Founded 1947, family-owned, plants in Lakeland FL + St George UT. OEM/industrial food-processing brushes shipped in bulk - no retail shelf presence, so little folding-carton need. Co-President with James Cottam; John L. Cottam is Chairman.",
  },
  {
    match: "Carolina Brush", website: "https://carolinabrush.com/", phone: "(800) 822-1160",
    contactName: "Fred Spach", contactTitle: "President / CEO",
    priority: 3, fit: "WEAK",
    note: "WEAK FIT. Founded 1919, family firm. OEM industrial/specialty brushes (textile, conveyor, food, aerospace) shipped bulk, not shelf-packaged.",
  },
  {
    match: "Brush Design", website: "https://brushdesignmfg.com/", phone: "(770) 461-3137",
    priority: 3, fit: "WEAK",
    note: "WEAK FIT. Small custom shop founded 1991, ISO 9001:2015. Industrial/ag/food/medical/aerospace brushes, no consumer SKUs. Sister company KTE does CNC machining. No named contact published.",
  },
  {
    match: "Associated Paint", website: "https://www.associatedpaint.com/", phone: "(305) 885-1964",
    contactName: "Lee Hackmeyer", contactTitle: "Owner",
    priority: 3, fit: "WEAK",
    note: "WEAK FIT for cartons. Family owned since 1953, very small (~3-10 people). Paint and roof coatings sold in metal cans and pails - their packaging spend is LABELS, not folding cartons. Mark Hackmeyer also an officer per FL records.",
  },
];

(async () => {
  for (const r of ROWS) {
    const lead = await prisma.lead.findFirst({
      where: { companyName: { contains: r.match, mode: "insensitive" }, commentary: { contains: "Brush / coatings prospect added 8/3" } },
      select: { id: true, companyName: true, commentary: true, numbers: true },
    });
    if (!lead) { console.log(`  MISSING: ${r.match}`); continue; }
    console.log(`  ${lead.companyName.padEnd(34).slice(0, 34)} ${r.fit.padEnd(8)} ${r.contactName || "(no named contact)"}`);
    if (APPLY) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          website: r.website,
          numbers: [lead.numbers, r.phone].filter(Boolean).join(" | "),
          ...(r.city ? { city: r.city } : {}),
          ...(r.contactName ? { contactName: r.contactName } : {}),
          ...(r.contactTitle ? { contactTitle: r.contactTitle } : {}),
          priority: r.priority,
          commentary: `${lead.commentary || ""}\n\n[Research 8/3] ${r.note}`.trim().slice(0, 8000),
        },
      });
    }
  }
  console.log(APPLY ? "\nApplied.\n" : "\nDRY RUN — re-run with --apply.\n");
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
