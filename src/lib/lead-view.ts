// Lead "clarity" layer (Benjy 8/2) — one source of truth for how a lead is
// PRESENTED in the sales pipeline. Everything here is DERIVED from columns that
// already exist (ownerName / agentStatus / outreachStatus / source / state) —
// deliberately NOT new DB columns, so nothing can fall out of sync.
//
// Pure functions only: this module is imported by the API route, the pipeline
// client component, and scripts/backfill-geography.ts.

export type LeadMode = "ai" | "needs_you" | "human" | "idle";
export type LeadType = "google_ad" | "website" | "mailercity" | "cold" | "referral" | "tradeshow" | "linkedin" | "customer" | "manual";

// The shape we need — kept loose so a Prisma Lead, an API row, or a script row
// all satisfy it.
export type LeadViewInput = {
  ownerName?: string | null;
  agentStatus?: string | null;
  outreachStatus?: string | null;
  pipelineStage?: string | null;
  leadTypeOverride?: string | null; // human-set source; beats auto-detection
  stage?: string | null; // the owner's own free-text Sub-status
  source?: string | null;
  intakeRaw?: string | null;
  commentary?: string | null;
  city?: string | null;
  state?: string | null;
  agentNextAt?: Date | string | null;
  outreachNextAt?: Date | string | null;
  followUpAt?: Date | string | null;
  followUpDoneAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

// ── Mode ────────────────────────────────────────────────────────────────────

// A real person on the sales team. "Jessica" is the AI agent's persona and
// "TBD"/blank are unassigned — neither counts as human-owned.
export const HUMAN_OWNERS = ["benjy", "nitay", "albert", "shimmie", "suzanne", "mary", "kelsey"];

// Agent statuses where a HUMAN has to do something next.
const NEEDS_YOU_AGENT = [
  "quote_received", "replied", "needs_owner", "needs_review",
  "needs_info", "mailercity_handoff", "owner_handling", "blocked",
];
const NEEDS_YOU_OUTREACH = ["needs_name", "bounced", "replied"];

// Agent statuses where the AI is actively working the lead (clock is running).
const AI_AGENT = [
  "awaiting_mary", "awaiting_customer_info", "info_nudge_1", "awaiting_customer_file",
  "mailercity_qualifying", "sent", "followup_1", "followup_2", "followup_3",
];
const AI_OUTREACH = ["intro_sent", "followup_1", "followup_2"];

export function isHumanOwned(lead: LeadViewInput): boolean {
  const o = (lead.ownerName || "").trim().toLowerCase();
  return !!o && HUMAN_OWNERS.includes(o);
}

export function leadMode(lead: LeadViewInput): LeadMode {
  if (isHumanOwned(lead)) return "human";
  const a = lead.agentStatus || "";
  const o = lead.outreachStatus || "";
  if (NEEDS_YOU_AGENT.includes(a) || NEEDS_YOU_OUTREACH.includes(o)) return "needs_you";
  if (AI_AGENT.includes(a) || AI_OUTREACH.includes(o)) return "ai";
  return "idle";
}

/** First name to show on a 👤 chip ("Benjy", "Albert" …). */
export function ownerFirstName(lead: LeadViewInput): string {
  const raw = (lead.ownerName || "").trim();
  if (!raw) return "Unassigned";
  return raw.split(/\s+/)[0];
}

// ── Stage (plain English) ───────────────────────────────────────────────────

export const STAGE_LABELS = [
  "New inquiry", "Getting specs", "With Mary", "Quote needs approval",
  "Quote sent", "Following up", "Replied - needs you", "Won", "Lost", "Not a fit",
] as const;
export type StageLabel = (typeof STAGE_LABELS)[number];

const AGENT_STAGE: Record<string, StageLabel> = {
  awaiting_customer_info: "Getting specs",
  info_nudge_1: "Getting specs",
  awaiting_customer_file: "Getting specs",
  mailercity_qualifying: "Getting specs",
  awaiting_mary: "With Mary",
  quote_received: "Quote needs approval",
  sent: "Quote sent",
  followup_1: "Following up",
  followup_2: "Following up",
  followup_3: "Following up",
  replied: "Replied - needs you",
  needs_owner: "Replied - needs you",
  needs_info: "Replied - needs you",
  needs_review: "Replied - needs you",
  blocked: "Replied - needs you",
  mailercity_handoff: "Replied - needs you",
  owner_handling: "Replied - needs you",
};

const OUTREACH_STAGE: Record<string, StageLabel> = {
  intro_sent: "Following up",
  followup_1: "Following up",
  followup_2: "Following up",
  replied: "Replied - needs you",
  bounced: "Replied - needs you",
  needs_name: "Replied - needs you",
};

export function leadStage(lead: LeadViewInput): string {
  const ps = lead.pipelineStage || "LEAD";
  const a = lead.agentStatus || "";
  if (ps === "CUSTOMER") return "Won";
  if (ps === "LOST") return a === "disqualified" || a === "duplicate" ? "Not a fit" : "Lost";
  if (AGENT_STAGE[a]) return AGENT_STAGE[a];
  const o = lead.outreachStatus || "";
  if (OUTREACH_STAGE[o]) return OUTREACH_STAGE[o];
  // No agent involvement at all. A raw LEAD is a new inquiry; anything already
  // promoted to QUALIFIED is being actively worked by a human.
  // Nothing automated is happening on this lead, so the system genuinely does
  // not know a stage — DON'T invent one (Benjy 8/2: 50 human-run qualified
  // prospects all read "Getting specs", which was simply untrue). Fall back to
  // the owner's own Sub-status, then to a neutral label.
  // A sub-status is only worth showing if it MEANS something. "TBD", "N/A",
  // "-" are placeholders, and echoing them back as a status is noise
  // (Benjy 8/2 - leads were displaying a bare "TBD").
  const sub = (lead.stage || "").trim();
  const JUNK = ["tbd", "tba", "n/a", "na", "none", "-", "--", "—", "?", "unknown", "", "n\a"];
  if (sub && !JUNK.includes(sub.toLowerCase())) return sub;
  if (ps === "QUALIFIED") return "Qualified prospect";
  // A lead we SOURCED for outbound is not an "inquiry" — nobody contacted us
  // (Benjy 8/2). Cold-sourced and inbound must read differently, because one
  // gets cold-called and the other gets answered.
  const src = (lead.source || "").trim().toLowerCase();
  if (src === "prospecting") return "Cold - not contacted";
  if (ps === "LEAD" && !lead.agentStatus && !lead.outreachStatus) return "New inquiry";
  return "New inquiry";
}

// ── Type (where the lead came from) ─────────────────────────────────────────

const GOOGLE_AD_TOKENS = ["gclid", "gbraid", "utm_source=google"];

function looksLikeGoogleAd(intakeRaw?: string | null): boolean {
  if (!intakeRaw) return false;
  let hay = "";
  try {
    const obj = JSON.parse(intakeRaw);
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (typeof v !== "string") continue;
        const key = k.toLowerCase();
        // Only look at things that could be a landing/page/referrer URL.
        if (v.includes("http") || v.includes("?") || /url|page|source|referr|utm|link/.test(key)) hay += ` ${v}`;
      }
    }
  } catch {
    hay = intakeRaw; // malformed JSON — fall back to scanning the raw string
  }
  const h = hay.toLowerCase();
  return GOOGLE_AD_TOKENS.some((t) => h.includes(t));
}

export function leadType(lead: LeadViewInput): LeadType {
  // A person's explicit choice always wins over sniffing the data.
  const ov = (lead.leadTypeOverride || "").trim() as LeadType;
  if (ov && (TYPE_LABELS as Record<string, string>)[ov]) return ov;
  const src = (lead.source || "").toLowerCase();
  if (src === "mailercity") return "mailercity";
  if (src === "inbound") return looksLikeGoogleAd(lead.intakeRaw) ? "google_ad" : "website";
  // Referral beats cold — a referred prospect may still have been loaded via
  // the prospecting list.
  const notes = (lead.commentary || "").toLowerCase();
  if (notes.includes("referral") || notes.includes("referred by")) return "referral";
  if (src === "prospecting") return "cold";
  return "manual";
}

export const TYPE_LABELS: Record<LeadType, string> = {
  google_ad: "Google Ad",
  website: "Website",
  mailercity: "MailerCity",
  cold: "Cold outreach",
  referral: "Referral",
  tradeshow: "Trade show",
  linkedin: "LinkedIn",
  customer: "Existing customer",
  manual: "Manual",
};

// ── Stalled ─────────────────────────────────────────────────────────────────

const asDate = (d: Date | string | null | undefined): Date | null => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return isNaN(x.getTime()) ? null : x;
};

/** Nothing is scheduled to happen next, and nobody has touched it in 3+ days. */
export function isStalled(lead: LeadViewInput, now: Date = new Date()): boolean {
  const clocks = [lead.agentNextAt, lead.outreachNextAt, lead.followUpDoneAt ? null : lead.followUpAt];
  if (clocks.some((c) => { const d = asDate(c); return d !== null && d.getTime() > now.getTime(); })) return false;
  const u = asDate(lead.updatedAt);
  if (!u) return false;
  return now.getTime() - u.getTime() > 3 * 24 * 60 * 60 * 1000;
}

// ── Geography ───────────────────────────────────────────────────────────────

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
] as const;

export type Region = "Tampa Bay" | "Central FL" | "South FL" | "North FL" | "Other FL" | "Out of state" | "Unknown";
export const REGIONS: Region[] = ["Tampa Bay", "Central FL", "South FL", "North FL", "Other FL", "Out of state"];

// city matchers per FL region; "*" = prefix match
const REGION_CITIES: Array<[Exclude<Region, "Other FL" | "Out of state" | "Unknown">, string[]]> = [
  ["Tampa Bay", ["tampa", "st. petersburg", "st petersburg", "saint petersburg", "clearwater", "largo", "brandon", "sarasota", "bradenton", "palmetto", "pinellas park", "oldsmar", "lakeland"]],
  ["Central FL", ["orlando", "lake mary", "winter*", "sanford", "longwood", "daytona*", "ocala"]],
  ["South FL", ["miami*", "ft lauderdale", "ft. lauderdale", "fort lauderdale", "boca*", "hialeah", "doral", "sunrise", "naples", "ft myers", "ft. myers", "fort myers", "bonita*", "stuart", "west palm*"]],
  ["North FL", ["jacksonville", "tallahassee", "gainesville", "pensacola", "panama city"]],
];

const cityMatches = (city: string, pat: string) => pat.endsWith("*") ? city.startsWith(pat.slice(0, -1)) : city === pat;

export function leadRegion(lead: { city?: string | null; state?: string | null }): Region {
  const st = (lead.state || "").trim().toUpperCase();
  if (!st) return "Unknown";
  if (st !== "FL" && st !== "FLORIDA") return "Out of state";
  const city = (lead.city || "").trim().toLowerCase();
  if (!city) return "Other FL";
  for (const [region, pats] of REGION_CITIES) {
    if (pats.some((p) => cityMatches(city, p))) return region;
  }
  return "Other FL";
}

// ── Area-code → geography (used by scripts/backfill-geography.ts) ───────────

/** Florida area codes → the FL region they sit in. All imply state = "FL". */
export const FL_AREA_CODES: Record<string, Region> = {
  "813": "Tampa Bay", "727": "Tampa Bay", "941": "Tampa Bay", "863": "Tampa Bay",
  "305": "South FL", "786": "South FL", "954": "South FL", "754": "South FL", "561": "South FL", "239": "South FL",
  "407": "Central FL", "321": "Central FL", "386": "Central FL", "352": "Central FL",
  "904": "North FL", "850": "North FL",
};

/** Compact NANP map: area code → 2-letter state (top ~90 US codes). */
export const AREA_CODE_STATE: Record<string, string> = {
  // FL
  "305": "FL", "786": "FL", "954": "FL", "754": "FL", "561": "FL", "239": "FL",
  "813": "FL", "727": "FL", "941": "FL", "863": "FL", "407": "FL", "321": "FL",
  "386": "FL", "352": "FL", "904": "FL", "850": "FL",
  // NY / NJ / CT / PA / MA
  "212": "NY", "646": "NY", "917": "NY", "718": "NY", "347": "NY", "929": "NY", "516": "NY", "631": "NY", "914": "NY", "845": "NY", "585": "NY", "716": "NY", "315": "NY", "518": "NY",
  "201": "NJ", "551": "NJ", "732": "NJ", "848": "NJ", "973": "NJ", "862": "NJ", "609": "NJ", "856": "NJ", "908": "NJ",
  "203": "CT", "475": "CT", "860": "CT", "959": "CT",
  "215": "PA", "267": "PA", "412": "PA", "484": "PA", "610": "PA", "717": "PA", "570": "PA", "814": "PA",
  "617": "MA", "857": "MA", "781": "MA", "508": "MA", "774": "MA", "413": "MA", "978": "MA",
  "401": "RI", "603": "NH", "802": "VT", "207": "ME",
  // Mid-Atlantic / Southeast
  "202": "DC", "301": "MD", "240": "MD", "410": "MD", "443": "MD",
  "703": "VA", "571": "VA", "804": "VA", "757": "VA", "540": "VA",
  "302": "DE", "304": "WV",
  "404": "GA", "470": "GA", "678": "GA", "770": "GA", "912": "GA", "706": "GA", "478": "GA", "229": "GA",
  "704": "NC", "980": "NC", "919": "NC", "984": "NC", "336": "NC", "252": "NC", "828": "NC", "910": "NC",
  "803": "SC", "843": "SC", "864": "SC",
  "615": "TN", "629": "TN", "901": "TN", "423": "TN", "865": "TN", "731": "TN",
  "502": "KY", "859": "KY", "270": "KY",
  "205": "AL", "251": "AL", "256": "AL", "334": "AL",
  "601": "MS", "662": "MS", "228": "MS",
  "504": "LA", "225": "LA", "337": "LA", "318": "LA",
  "501": "AR", "479": "AR", "870": "AR",
  // Midwest
  "312": "IL", "773": "IL", "872": "IL", "630": "IL", "847": "IL", "708": "IL", "217": "IL", "309": "IL",
  "313": "MI", "248": "MI", "586": "MI", "734": "MI", "616": "MI", "517": "MI", "231": "MI", "906": "MI",
  "614": "OH", "216": "OH", "440": "OH", "330": "OH", "513": "OH", "937": "OH", "419": "OH", "740": "OH",
  "317": "IN", "463": "IN", "219": "IN", "260": "IN", "574": "IN", "812": "IN",
  "414": "WI", "262": "WI", "608": "WI", "920": "WI", "715": "WI",
  "612": "MN", "651": "MN", "763": "MN", "952": "MN", "218": "MN", "507": "MN",
  "515": "IA", "319": "IA", "563": "IA", "712": "IA",
  "314": "MO", "636": "MO", "816": "MO", "417": "MO", "573": "MO",
  "913": "KS", "316": "KS", "785": "KS", "402": "NE", "308": "NE",
  "605": "SD", "701": "ND",
  // South Central / Mountain / West
  "214": "TX", "469": "TX", "972": "TX", "817": "TX", "682": "TX", "713": "TX", "281": "TX", "832": "TX", "346": "TX", "512": "TX", "737": "TX", "210": "TX", "726": "TX", "915": "TX", "806": "TX", "409": "TX", "936": "TX", "979": "TX", "956": "TX", "361": "TX", "254": "TX", "903": "TX", "430": "TX", "325": "TX",
  "405": "OK", "918": "OK", "580": "OK",
  "303": "CO", "720": "CO", "970": "CO", "719": "CO",
  "801": "UT", "385": "UT", "435": "UT",
  "602": "AZ", "480": "AZ", "623": "AZ", "520": "AZ", "928": "AZ",
  "505": "NM", "575": "NM", "702": "NV", "725": "NV", "775": "NV",
  "208": "ID", "406": "MT", "307": "WY",
  "213": "CA", "323": "CA", "310": "CA", "424": "CA", "818": "CA", "747": "CA", "626": "CA", "562": "CA", "714": "CA", "657": "CA", "949": "CA", "909": "CA", "951": "CA", "760": "CA", "442": "CA", "619": "CA", "858": "CA", "415": "CA", "628": "CA", "650": "CA", "408": "CA", "669": "CA", "510": "CA", "341": "CA", "925": "CA", "707": "CA", "916": "CA", "279": "CA", "530": "CA", "209": "CA", "559": "CA", "661": "CA", "805": "CA", "831": "CA",
  "503": "OR", "971": "OR", "541": "OR",
  "206": "WA", "425": "WA", "253": "WA", "360": "WA", "509": "WA", "564": "WA",
  "907": "AK", "808": "HI",
};

/** Pull a 3-digit NANP area code out of a free-form US phone number. */
export function areaCodeOf(phone?: string | null): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length < 10) return null;
  const ac = d.slice(0, 3);
  return /^[2-9]\d\d$/.test(ac) ? ac : null;
}
