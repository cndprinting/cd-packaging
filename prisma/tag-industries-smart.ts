import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Classify based on name + location context clues
function classifyCompany(name: string, city: string, state: string): string {
  const n = name.toUpperCase();

  // Specific company types by name patterns
  if (/RECYCL|WASTE|DISPOSAL|SANIT/i.test(n)) return "Waste Management";
  if (/IMAGING|RADIOL|X-RAY|MRI|DIAGNOS/i.test(n)) return "Healthcare";
  if (/NATUR|ORGANIC|HERBAL|SUPPLEMENT|VITAMIN/i.test(n)) return "Health & Wellness";
  if (/PUBLISH|MAGAZINE|NEWSPAPER|NEWS|MEDIA|BROADCAST/i.test(n)) return "Publishing & Media";
  if (/PLAST|RUBBER|POLYMER|RESIN/i.test(n)) return "Plastics & Rubber";
  if (/ELECTRIC|ELECTRON|CIRCUIT|WIRE|CABLE|BATTERY/i.test(n)) return "Electronics";
  if (/PHARMA|DRUG|BIOMED|BIOTECH|LABORATOR|SCIENCE|RESEARCH/i.test(n)) return "Pharmaceutical & Biotech";
  if (/SPONGE|CHAMOIS|SUPPLY|SUPPLIES|WHOLESALE/i.test(n)) return "Wholesale & Distribution";
  if (/AVIATION|AERO|FLIGHT|AIR /i.test(n)) return "Aviation & Aerospace";
  if (/RECYCLE|SCRAP|SALVAGE/i.test(n)) return "Recycling";
  if (/COACH|MENTOR|TRAIN|SEMINAR|WORKSHOP/i.test(n)) return "Training & Coaching";
  if (/MARKET|BRAND|PROMOT|ADVERT|CAMPAIGN|CREATIVE|AGENCY/i.test(n)) return "Marketing & Advertising";
  if (/CONSULT|ADVISOR|ADVISORY|STRATEG/i.test(n)) return "Consulting";
  if (/ENGINEER|CIVIL|STRUCT|MECH ENG/i.test(n)) return "Engineering";
  if (/ARCHITECT|DESIGN|INTERIOR|DÉCOR|DECOR/i.test(n)) return "Architecture & Design";
  if (/ACCOUNT|CPA|TAX|AUDIT|BOOKKEEP/i.test(n)) return "Accounting";
  if (/INSUR|UNDERWR|CLAIM|ACTUAR/i.test(n)) return "Insurance";
  if (/INVEST|CAPITAL|VENTURE|EQUITY|FUND|ASSET|WEALTH/i.test(n)) return "Investment & Finance";
  if (/STAFF|RECRUIT|TALENT|PERSON|EMPLOY|TEMP |HR /i.test(n)) return "Staffing & HR";
  if (/SHIP|FREIGHT|CARGO|LOGIST|TRANSPORT|TRUCK|COURIER|DELIVER|PACK/i.test(n)) return "Logistics & Shipping";
  if (/TELECOM|WIRELESS|CELL|MOBILE|SATELLITE|COMM /i.test(n)) return "Telecommunications";
  if (/SOFTWARE|TECH|SYSTEM|DIGITAL|CYBER|DATA|CLOUD|WEB|APP|IT /i.test(n)) return "Technology";
  if (/CHURCH|TEMPLE|FAITH|WORSHIP|MINIST|GOSPEL|BIBLE|CHRISTIAN/i.test(n)) return "Religious Organization";
  if (/MUSEUM|GALLERY|ART |ARTS|CULTUR|THEATER|THEATRE/i.test(n)) return "Arts & Culture";
  if (/CLUB |ASSOC|SOCIETY|LEAGUE|UNION|COUNCIL|CHAMBER|BOARD/i.test(n)) return "Association & Membership";
  if (/CARE |SENIOR|ELDER|ASSIST|HOME HEALTH/i.test(n)) return "Senior Care";
  if (/CHILD|KID|YOUTH|TEEN|BOY|GIRL/i.test(n)) return "Youth Services";
  if (/TUTOR|LEARN|ACAD|SCHOOL|EDUCAT|COLLEGE|UNIVER|INST OF/i.test(n)) return "Education";
  if (/DENTAL|ORTHO|ORAL/i.test(n)) return "Dental";
  if (/OPTICAL|VISION|EYE|OPTIC/i.test(n)) return "Eye Care";
  if (/THERAPY|THERAP|REHAB|RECOVER|WELLNESS/i.test(n)) return "Therapy & Wellness";
  if (/ENVIRON|GREEN|ECO|SUSTAIN|SOLAR|ENERGY|POWER|WIND/i.test(n)) return "Environmental & Energy";
  if (/COFFEE|TEA|JUICE|SMOOTH|WATER|BEVER/i.test(n)) return "Food & Beverage";
  if (/FLOWER|FLORAL|FLORIST|PLANT|GARDEN|NURSER/i.test(n)) return "Floral & Garden";
  if (/IMPORT|EXPORT|TRADE|TRAD /i.test(n)) return "Import & Export";
  if (/RENTAL|RENT |LEASE|LEASING/i.test(n)) return "Rental & Leasing";
  if (/PEST|TERMITE|EXTERMINA/i.test(n)) return "Pest Control";
  if (/JEWEL|WATCH|GEM|DIAMOND/i.test(n)) return "Jewelry";
  if (/APPAREL|CLOTH|FASHION|WEAR|SHIRT|DRESS/i.test(n)) return "Apparel & Fashion";
  if (/COSMETIC|BEAUTY|LASH|BROW|MAKEUP/i.test(n)) return "Beauty & Cosmetics";
  if (/OIL|GAS|PETRO|FUEL/i.test(n)) return "Oil & Gas";
  if (/BOAT|MARINE|YACHT|SAIL|FISH|DOCK|MARINA/i.test(n)) return "Marine";
  if (/POOL|SPA|HOT TUB/i.test(n)) return "Pool & Spa";
  if (/ROOF|GUTTER|WINDOW|DOOR|GLASS|MIRROR/i.test(n)) return "Home Improvement";
  if (/LOCK|KEY|SAFE|SECUR|ALARM|CAMERA|SURVEIL/i.test(n)) return "Security";
  if (/TAXI|LIMO|CAR SERVICE|UBER|LYFT|RIDE/i.test(n)) return "Transportation";
  if (/LAUNDRY|DRY CLEAN|PRESS|TAILOR|ALTER/i.test(n)) return "Laundry & Dry Cleaning";
  if (/STOR |STORAGE|WAREHOUSE|VAULT/i.test(n)) return "Storage";
  if (/MOVE|MOVING|RELOC/i.test(n)) return "Moving Services";

  // Person names (first + last, no company indicators)
  if (/^[A-Z]+ [A-Z]+$/i.test(n.trim()) && n.trim().split(" ").length === 2) return "Individual / Sole Proprietor";
  if (/^[A-Z]+\s[A-Z]\.\s[A-Z]+$/i.test(n.trim())) return "Individual / Sole Proprietor";

  // Abbreviation-heavy names — likely B2B services
  if (/^[A-Z]{2,5}$/.test(n.trim())) return "Business Services";
  if (/^[A-Z]{2,4}[\s-]/.test(n.trim()) && n.length < 15) return "Business Services";

  // Names ending with common suffixes
  if (/,?\s*(INC|LLC|CORP|CO|LTD|LP|GROUP|PARTNERS|ENTERPRISES|HOLDINGS|VENTURES)\.?$/i.test(n)) return "Business Services";

  // Location-based guesses
  if (city && /CLEARWATER|ST\.?\s*PET|TAMPA|LARGO|PINELLAS|SEMINOLE/i.test(city)) {
    // Tampa Bay area business — general services
    return "Local Business";
  }

  return "Other";
}

async function tagSmart() {
  const companies = await prisma.company.findMany({
    where: { industry: "General Business", type: "customer" },
    select: { id: true, name: true, city: true, state: true },
  });

  console.log(`Classifying ${companies.length} companies...`);

  const summary: Record<string, number> = {};
  let updated = 0;

  for (const c of companies) {
    const industry = classifyCompany(c.name, c.city || "", c.state || "");
    await prisma.company.update({ where: { id: c.id }, data: { industry } });
    summary[industry] = (summary[industry] || 0) + 1;
    updated++;
  }

  console.log(`Updated ${updated} companies\n`);
  console.log("Breakdown:");
  Object.entries(summary)
    .sort((a, b) => b[1] - a[1])
    .forEach(([ind, count]) => console.log(`  ${ind}: ${count}`));

  process.exit(0);
}

tagSmart().catch(e => { console.error(e); process.exit(1); });
