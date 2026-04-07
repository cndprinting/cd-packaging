import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Pattern-based industry tagging
const PATTERNS: [RegExp, string][] = [
  // Food & Beverage
  [/restaurant|grill|cafe|coffee|bakery|pizza|diner|bistro|catering|food|nutrition|kitchen|taco|sushi|bbq|burger|ice cream|deli|bagel|donut|brewing|brew pub|distiller|winery|wine|spirits|beer|bar & grill/i, "Food & Beverage"],
  // Real Estate
  [/realt|real estate|property|properties|mortgage|title insurance|title company|closing|escrow/i, "Real Estate"],
  // Healthcare
  [/hospital|medical|health|clinic|dental|dentist|orthodont|dermatolog|cardio|pediatr|physician|doctor|surgery|surgical|pharma|urgent care|chiropr|optom|ophthal|veterinar|vet clinic|animal hospital|allergy|asthma|therapy|therapist|rehab|nursing|hospice/i, "Healthcare"],
  // Legal
  [/law firm|law office|attorney|lawyer|legal|paralegal/i, "Legal Services"],
  // Education
  [/school|academy|university|college|education|learning|montessori|preschool|daycare|child care|children|tutoring/i, "Education"],
  // Religious
  [/church|temple|synagogue|mosque|ministry|ministries|baptist|methodist|catholic|lutheran|episcopal|presbyter|congregation|worship|faith|christian|bible/i, "Religious Organization"],
  // Construction
  [/construct|building|builder|roofing|plumbing|plumber|electric|electrical|hvac|air condition|landscap|paving|concrete|masonry|demolit|excavat|flooring|paint|contractor/i, "Construction"],
  // Automotive
  [/auto |automobile|automotive|car wash|car dealer|collision|body shop|tire|mechanic|motor|vehicle/i, "Automotive"],
  // Financial
  [/bank|banking|financial|finance|investment|insurance|accounting|accountant|cpa |tax service|wealth|credit union|mortgage/i, "Financial Services"],
  // Technology
  [/tech|software|computer|it service|digital|web design|internet|cyber|data|cloud|app dev|telecom/i, "Technology"],
  // Manufacturing
  [/manufactur|machine shop|fabricat|welding|metal|steel|plastic|mold|tool & die|industrial/i, "Manufacturing"],
  // Retail
  [/retail|store|shop|boutique|mall|outlet|gift shop|jewel|clothing|apparel|fashion/i, "Retail"],
  // Hospitality
  [/hotel|motel|resort|inn |lodge|hospitality|travel|tourism|cruise/i, "Hospitality & Travel"],
  // Beauty
  [/salon|spa |beauty|cosmetic|hair |nail |barber|skin care|aesthet/i, "Beauty & Personal Care"],
  // Nonprofit
  [/foundation|nonprofit|non-profit|charity|association|society|guild|rotary|kiwanis|lions club|united way|goodwill|habitat|humane|rescue/i, "Nonprofit"],
  // Government
  [/city of|county of|state of|department of|government|municipal|public works|fire dept|police|sheriff/i, "Government"],
  // Marine
  [/marine|boat|yacht|sailing|maritime|fishing|dock|harbor/i, "Marine"],
  // Printing & Media
  [/print|printing|graphics|graphic design|sign |signs|banner|label|packaging|publish|media|advertis|marketing|promo|display/i, "Printing & Media"],
  // Sports & Recreation
  [/golf|tennis|fitness|gym |sport|athletic|recreation|swim|pool|country club|yacht club/i, "Sports & Recreation"],
  // Pet Services
  [/pet |pets|grooming|kennel|animal|veterinar/i, "Pet Services"],
  // Cleaning
  [/clean|janitorial|maid|pressure wash|restoration/i, "Cleaning Services"],
  // Storage & Moving
  [/storage|moving|movers|relocation|freight|shipping|logistics|transport/i, "Logistics & Moving"],
];

async function tagIndustries() {
  console.log("Tagging industries by pattern matching...");

  const companies = await prisma.company.findMany({
    where: { industry: null, type: "customer" },
    select: { id: true, name: true },
  });

  console.log(`  ${companies.length} companies without industry`);

  let tagged = 0;
  const updates: { id: string; industry: string }[] = [];

  for (const company of companies) {
    for (const [pattern, industry] of PATTERNS) {
      if (pattern.test(company.name)) {
        updates.push({ id: company.id, industry });
        tagged++;
        break;
      }
    }
  }

  // Batch update
  for (const update of updates) {
    await prisma.company.update({
      where: { id: update.id },
      data: { industry: update.industry },
    });
  }

  console.log(`  Tagged ${tagged} companies with industries`);
  console.log(`  ${companies.length - tagged} remaining without industry`);

  // Print summary by industry
  const summary: Record<string, number> = {};
  for (const u of updates) {
    summary[u.industry] = (summary[u.industry] || 0) + 1;
  }
  console.log("\n  Breakdown:");
  Object.entries(summary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ind, count]) => console.log(`    ${ind}: ${count}`));

  process.exit(0);
}

tagIndustries().catch((e) => { console.error(e); process.exit(1); });
