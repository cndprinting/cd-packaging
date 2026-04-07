import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Simple industry classifier from search snippet
function classifyFromText(text: string): string | null {
  const t = text.toLowerCase();
  if (/restaurant|food|beverage|catering|bakery|pizza|coffee|bar |grill|dining/i.test(t)) return "Food & Beverage";
  if (/real estate|realty|property|broker|homes for sale|mortgage/i.test(t)) return "Real Estate";
  if (/medical|health|hospital|dental|doctor|clinic|pharma|therapy|nursing/i.test(t)) return "Healthcare";
  if (/law|attorney|lawyer|legal/i.test(t)) return "Legal Services";
  if (/school|education|university|college|learning|academy/i.test(t)) return "Education";
  if (/church|religious|worship|ministry|faith/i.test(t)) return "Religious Organization";
  if (/construct|roofing|plumbing|electric|contractor|building/i.test(t)) return "Construction";
  if (/auto|car |vehicle|motor|tire|collision/i.test(t)) return "Automotive";
  if (/bank|finance|financial|insurance|accounting|investment/i.test(t)) return "Financial Services";
  if (/tech|software|computer|digital|web|internet|it /i.test(t)) return "Technology";
  if (/manufactur|industrial|fabricat|machine/i.test(t)) return "Manufacturing";
  if (/retail|store|shop|boutique|clothing/i.test(t)) return "Retail";
  if (/hotel|resort|travel|tourism|hospitality/i.test(t)) return "Hospitality & Travel";
  if (/salon|spa|beauty|cosmetic|hair/i.test(t)) return "Beauty & Personal Care";
  if (/nonprofit|foundation|charity|association/i.test(t)) return "Nonprofit";
  if (/government|city of|county|municipal/i.test(t)) return "Government";
  if (/marine|boat|yacht|sailing/i.test(t)) return "Marine";
  if (/print|graphic|design|sign|media|advertis|marketing/i.test(t)) return "Printing & Media";
  if (/golf|sport|fitness|gym|recreation/i.test(t)) return "Sports & Recreation";
  if (/pet|veterinar|animal|grooming/i.test(t)) return "Pet Services";
  if (/clean|janitorial|restoration/i.test(t)) return "Cleaning Services";
  if (/storage|moving|freight|shipping|logistics/i.test(t)) return "Logistics & Moving";
  if (/landscap|lawn|garden|tree/i.test(t)) return "Landscaping";
  if (/security|alarm|surveillance/i.test(t)) return "Security";
  if (/photography|photo|video|film/i.test(t)) return "Photography & Video";
  if (/architecture|architect|engineer|survey/i.test(t)) return "Architecture & Engineering";
  if (/consult/i.test(t)) return "Consulting";
  if (/staffing|recruiting|employment|temp agency/i.test(t)) return "Staffing";
  return null;
}

async function searchAndTag() {
  const companies = await prisma.company.findMany({
    where: { industry: null, type: "customer" },
    select: { id: true, name: true, city: true, state: true },
    take: 200, // Do 200 at a time
  });

  console.log(`Searching ${companies.length} companies...`);
  let tagged = 0;
  let failed = 0;

  for (let i = 0; i < companies.length; i++) {
    const c = companies[i];
    const query = `${c.name}${c.city ? ` ${c.city}` : ""}${c.state ? ` ${c.state}` : ""} industry`;

    try {
      const res = await fetch(`https://www.google.com/search?q=${encodeURIComponent(query)}&num=3`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      const html = await res.text();
      const industry = classifyFromText(html);

      if (industry) {
        await prisma.company.update({ where: { id: c.id }, data: { industry } });
        tagged++;
        console.log(`  [${i+1}/${companies.length}] ${c.name} → ${industry}`);
      } else {
        console.log(`  [${i+1}/${companies.length}] ${c.name} → (no match)`);
        failed++;
      }

      // Rate limit - don't hammer Google
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.log(`  [${i+1}/${companies.length}] ${c.name} → (error)`);
      failed++;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\nDone: Tagged ${tagged}, No match ${failed}`);
  const remaining = await prisma.company.count({ where: { industry: null, type: "customer" } });
  console.log(`Remaining without industry: ${remaining}`);
  process.exit(0);
}

searchAndTag().catch(e => { console.error(e); process.exit(1); });
