import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Expanded pattern matching with more industry keywords
const PATTERNS: [RegExp, string][] = [
  [/restaurant|grill|cafe|coffee|bakery|pizza|diner|bistro|catering|food|nutrition|kitchen|taco|sushi|bbq|burger|ice cream|deli|bagel|donut|brewing|brew pub|distiller|winery|wine|spirits|beer|bar & grill|steakhouse|seafood|creamery|smokehouse|juice|smoothie|frozen|meat|produce|grocer|supermarket/i, "Food & Beverage"],
  [/realt|real estate|property|properties|mortgage|title insurance|title company|closing|escrow|home builder|homes|housing/i, "Real Estate"],
  [/hospital|medical|health|clinic|dental|dentist|orthodont|dermatolog|cardio|pediatr|physician|doctor|surgery|surgical|pharma|urgent care|chiropr|optom|ophthal|veterinar|vet clinic|animal hospital|allergy|asthma|therapy|therapist|rehab|nursing|hospice|biotech|laboratory|lab |labs/i, "Healthcare"],
  [/law firm|law office|attorney|lawyer|legal|paralegal|litigation/i, "Legal Services"],
  [/school|academy|university|college|education|learning|montessori|preschool|daycare|child care|children|tutoring|institute|training center/i, "Education"],
  [/church|temple|synagogue|mosque|ministry|ministries|baptist|methodist|catholic|lutheran|episcopal|presbyter|congregation|worship|faith|christian|bible/i, "Religious Organization"],
  [/construct|building|builder|roofing|plumbing|plumber|electric|electrical|hvac|air condition|landscap|paving|concrete|masonry|demolit|excavat|flooring|paint|contractor|cabinet|tile|window|door|fence|deck|pool/i, "Construction"],
  [/auto |automobile|automotive|car wash|car dealer|collision|body shop|tire|mechanic|motor|vehicle|transmission|muffler|brake/i, "Automotive"],
  [/bank|banking|financial|finance|investment|insurance|accounting|accountant|cpa |tax service|wealth|credit union|mortgage|capital|advisory|brokerage/i, "Financial Services"],
  [/tech|software|computer|it service|digital|web design|internet|cyber|data|cloud|app dev|telecom|wireless|satellite|network/i, "Technology"],
  [/manufactur|machine shop|fabricat|welding|metal|steel|plastic|mold|tool & die|industrial|assembly|precision/i, "Manufacturing"],
  [/retail|store|shop|boutique|mall|outlet|gift shop|jewel|clothing|apparel|fashion|shoe|watch|accessories/i, "Retail"],
  [/hotel|motel|resort|inn |lodge|hospitality|travel|tourism|cruise|vacation/i, "Hospitality & Travel"],
  [/salon|spa |beauty|cosmetic|hair |nail |barber|skin care|aesthet|lash|brow|wax/i, "Beauty & Personal Care"],
  [/foundation|nonprofit|non-profit|charity|association|society|guild|rotary|kiwanis|lions club|united way|goodwill|habitat|humane|rescue|volunteer/i, "Nonprofit"],
  [/city of|county of|state of|department of|government|municipal|public works|fire dept|police|sheriff|parks & rec|library/i, "Government"],
  [/marine|boat|yacht|sailing|maritime|fishing|dock|harbor|watercraft|pontoon/i, "Marine"],
  [/print|printing|graphics|graphic design|sign |signs |signage|banner|label|packaging|publish|media|advertis|marketing|promo|display|creative|agency|branding|studio|production|video|film|photo/i, "Printing & Media"],
  [/golf|tennis|fitness|gym |sport|athletic|recreation|swim|pool|country club|yacht club|karate|martial|dance|yoga|crossfit/i, "Sports & Recreation"],
  [/pet |pets|grooming|kennel|animal|doggy|puppy|cat /i, "Pet Services"],
  [/clean|janitorial|maid|pressure wash|restoration|remediation/i, "Cleaning Services"],
  [/storage|moving|movers|relocation|freight|shipping|logistics|transport|courier|delivery|trucking|warehouse/i, "Logistics & Moving"],
  [/landscap|lawn|garden|tree|nursery|irrigation|sod/i, "Landscaping"],
  [/security|alarm|surveillance|guard|patrol|investigation|detective/i, "Security"],
  [/photography|photo|video|film|cinema|entertainment|event|party|wedding|dj /i, "Entertainment & Events"],
  [/architect|engineer|survey|civil|structural|environmental|consulting|consult/i, "Professional Services"],
  [/staffing|recruiting|employment|temp agency|personnel|hiring|talent/i, "Staffing"],
  [/rental|rent |leasing|equipment rental/i, "Rental Services"],
  [/pest|exterminator|termite/i, "Pest Control"],
  [/plaz|center |centre|mall/i, "Commercial Real Estate"],
  [/air |aviation|flight|pilot|airplane|aerospace|jet/i, "Aviation & Aerospace"],
  [/oil |gas |petroleum|fuel|energy|solar|power|utility/i, "Energy"],
  [/farm|ranch|agriculture|crop|harvest|nursery|floral|flower/i, "Agriculture & Floral"],
  [/pack|box|container|carton|corrugat|folding|wrapper|wrap/i, "Packaging"],
  [/embroid|screen print|t-shirt|uniform|promotional/i, "Promotional Products"],
  [/dock|pier|marina|seawall/i, "Marine"],
  [/roast|blend|import|export|distribut/i, "Distribution"],
  [/therapy|counsel|psych|social work|behavioral/i, "Healthcare"],
  [/design|interior|decor|furnish|furniture|cabinet|kitchen|bath/i, "Interior Design"],
  [/stafford|group|partners|holdings|ventures|capital|enterprise|corp|inc\.|llc|co\./i, "General Business"],
];

async function tagMore() {
  console.log("Running expanded pattern matching...");

  const companies = await prisma.company.findMany({
    where: { industry: null, type: "customer" },
    select: { id: true, name: true },
  });

  console.log(`${companies.length} companies without industry`);

  let tagged = 0;

  for (const company of companies) {
    for (const [pattern, industry] of PATTERNS) {
      if (pattern.test(company.name)) {
        await prisma.company.update({
          where: { id: company.id },
          data: { industry },
        });
        tagged++;
        break;
      }
    }
  }

  const remaining = await prisma.company.count({ where: { industry: null, type: "customer" } });
  console.log(`Tagged ${tagged} more companies`);
  console.log(`Remaining without industry: ${remaining}`);

  // For truly unclassifiable names, tag as "General Business"
  if (remaining > 0) {
    const untagged = await prisma.company.updateMany({
      where: { industry: null, type: "customer" },
      data: { industry: "General Business" },
    });
    console.log(`Tagged ${untagged.count} remaining as "General Business"`);
  }

  process.exit(0);
}

tagMore().catch(e => { console.error(e); process.exit(1); });
