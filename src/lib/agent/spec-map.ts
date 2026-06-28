// Default spec map (Benjy 6/26) — vague customer terms → C&D house-standard
// specs, per product. This encodes Mary's defaults so the agent can ASSERT a
// real spec ("thick" → "14pt C2S") instead of asking, then let the customer
// confirm-or-correct. Seeded with sensible defaults — MARY SHOULD RED-PEN THIS.
// It's also the seed of the Phase-3 estimating engine.
//
// Each rule: a product bucket, a trigger keyword/phrase, and the spec to assert.

type SpecRule = { triggers: string[]; assume: string };

const SPEC_MAP: Record<string, SpecRule[]> = {
  "Commercial Print": [
    { triggers: ["thick", "heavy", "sturdy", "premium", "cardstock"], assume: "100# gloss cover" },
    { triggers: ["cover weight", "cover stock"], assume: "100# gloss cover" },
    { triggers: ["thin", "standard", "regular"], assume: "100# gloss text" },
    { triggers: ["glossy", "gloss", "shiny"], assume: "gloss aqueous coating" },
    { triggers: ["matte", "mate", "flat", "uncoated"], assume: "matte/uncoated finish" },
    { triggers: ["full color", "color", "colour", "4 color"], assume: "4/4 full process color" },
    { triggers: ["double sided", "two sided", "front and back"], assume: "printed 2 sides (4/4)" },
    { triggers: ["single sided", "one sided"], assume: "printed 1 side (4/0)" },
  ],
  "Folding Carton": [
    { triggers: ["thick", "sturdy", "heavy", "rigid box", "strong"], assume: "24pt SBS C1S board" },
    { triggers: ["standard", "regular", "normal"], assume: "18pt SBS C1S board" },
    { triggers: ["recycled", "kraft", "brown", "natural"], assume: "18pt CRB (kraft) board" },
    { triggers: ["glossy", "gloss", "shiny"], assume: "gloss UV coating" },
    { triggers: ["matte", "soft touch"], assume: "matte aqueous coating" },
    { triggers: ["full color", "color", "4 color"], assume: "4-color process" },
  ],
  "Mailers": [
    { triggers: ["postcard", "thick", "sturdy"], assume: "14pt C2S" },
    { triggers: ["standard", "letter", "thin"], assume: "70# text" },
    { triggers: ["glossy", "gloss"], assume: "gloss aqueous, address side uncoated" },
  ],
  "Packaging": [
    { triggers: ["corrugated", "shipping box", "mailer box"], assume: "32 ECT B-flute corrugated" },
    { triggers: ["sturdy", "thick", "rigid"], assume: "rigid setup box (greyboard + wrap)" },
  ],
  "Flexible Packaging": [
    { triggers: ["pouch", "bag", "stand up"], assume: "stand-up pouch, foil laminate" },
    { triggers: ["clear", "see through", "window"], assume: "clear PET/PE laminate" },
  ],
};

// Business-card defaults live under Commercial Print but warrant tighter calls.
const BUSINESS_CARD: SpecRule[] = [
  { triggers: ["thick", "premium", "heavy", "sturdy"], assume: "16pt C2S" },
  { triggers: ["standard", "regular", "normal"], assume: "14pt C2S" },
  { triggers: ["matte", "mate"], assume: "matte finish" },
  { triggers: ["gloss", "glossy", "uv"], assume: "gloss UV finish" },
];

// Given the lead's product category + the free text the customer typed, return
// the house-standard specs we'd assert. Each = { found, assume } so Mary sees
// what was vague and what we assumed.
export function assertDefaults(productCategory: string, freeText: string, isBusinessCard = false): { found: string; assume: string }[] {
  const text = (freeText || "").toLowerCase();
  const rules = [...(SPEC_MAP[productCategory] || []), ...(isBusinessCard ? BUSINESS_CARD : [])];
  const out: { found: string; assume: string }[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    const hit = rule.triggers.find((t) => text.includes(t));
    if (hit && !seen.has(rule.assume)) { seen.add(rule.assume); out.push({ found: hit, assume: rule.assume }); }
  }
  return out;
}
