// Paper caliper lookup table, seeded from Darrin's "Paper Calipers.xlsx" (4/21/26).
// Caliper (thickness in inches per sheet) drives the cut-lift math:
//   lifts = ceil(totalSheets × caliper / cutLiftHeightInches)
// The cutter processes one lift at a time, so more lifts = more cut operations.
//
// Heavier stocks have fewer sheets per 6" lift. Examples:
//   80lb Silk Text  (0.0037" caliper) → 1,621 sheets/lift
//   14pt C/1/S      (0.014" caliper)  →   428 sheets/lift
//   120lb Gloss Cvr (0.0123" caliper) →   487 sheets/lift

export interface PaperCaliperEntry {
  weight: string;           // "100lb", "14pt.", etc.
  kind: string;             // "Dull" | "Gloss" | "Uncoated" | "BOARD"
  coverOrText: "Cover" | "Text";
  caliperInches: number;
}

export const PAPER_CALIPERS: PaperCaliperEntry[] = [
  { weight: "100lb", kind: "Dull",     coverOrText: "Cover", caliperInches: 0.0105 },
  { weight: "100lb", kind: "Gloss",    coverOrText: "Cover", caliperInches: 0.0095 },
  { weight: "100lb", kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.0135 },
  { weight: "100lb", kind: "Dull",     coverOrText: "Text",  caliperInches: 0.0054 },
  { weight: "100lb", kind: "Gloss",    coverOrText: "Text",  caliperInches: 0.0048 },
  { weight: "100lb", kind: "Uncoated", coverOrText: "Text",  caliperInches: 0.007 },
  { weight: "105lb", kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.017 },
  { weight: "110lb", kind: "Gloss",    coverOrText: "Cover", caliperInches: 0.011 },
  { weight: "110lb", kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.0145 },
  { weight: "120lb", kind: "Dull",     coverOrText: "Cover", caliperInches: 0.0132 },
  { weight: "120lb", kind: "Gloss",    coverOrText: "Cover", caliperInches: 0.0123 },
  { weight: "120lb", kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.016 },
  { weight: "130lb", kind: "Dull",     coverOrText: "Cover", caliperInches: 0.0145 },
  { weight: "130lb", kind: "Gloss",    coverOrText: "Cover", caliperInches: 0.0135 },
  { weight: "130lb", kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.016 },
  { weight: "160lb", kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.021 },
  { weight: "7pt.",  kind: "Dull",     coverOrText: "Cover", caliperInches: 0.007 },
  { weight: "9pt.",  kind: "Dull",     coverOrText: "Cover", caliperInches: 0.009 },
  { weight: "10pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.01 },
  { weight: "12pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.012 },
  { weight: "14pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.014 },
  { weight: "15pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.015 },
  { weight: "16pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.016 },
  { weight: "18pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.018 },
  { weight: "19pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.019 },
  { weight: "20pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.02 },
  { weight: "22pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.022 },
  { weight: "24pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.024 },
  { weight: "28pt.", kind: "BOARD",    coverOrText: "Cover", caliperInches: 0.028 },
  { weight: "24lb",  kind: "Uncoated", coverOrText: "Text",  caliperInches: 0.0045 },
  { weight: "28lb",  kind: "Uncoated", coverOrText: "Text",  caliperInches: 0.0052 },
  { weight: "50lb",  kind: "Uncoated", coverOrText: "Text",  caliperInches: 0.004 },
  { weight: "60lb",  kind: "Dull",     coverOrText: "Text",  caliperInches: 0.0033 },
  { weight: "60lb",  kind: "Gloss",    coverOrText: "Text",  caliperInches: 0.0031 },
  { weight: "60lb",  kind: "Uncoated", coverOrText: "Text",  caliperInches: 0.0045 },
  { weight: "65lb",  kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.009 },
  { weight: "70lb",  kind: "Dull",     coverOrText: "Text",  caliperInches: 0.0038 },
  { weight: "70lb",  kind: "Gloss",    coverOrText: "Text",  caliperInches: 0.0035 },
  { weight: "70lb",  kind: "Uncoated", coverOrText: "Text",  caliperInches: 0.005 },
  { weight: "80lb",  kind: "Dull",     coverOrText: "Cover", caliperInches: 0.0081 },
  { weight: "80lb",  kind: "Gloss",    coverOrText: "Cover", caliperInches: 0.0074 },
  { weight: "80lb",  kind: "Uncoated", coverOrText: "Cover", caliperInches: 0.0115 },
  { weight: "80lb",  kind: "Dull",     coverOrText: "Text",  caliperInches: 0.0043 },
  { weight: "80lb",  kind: "Gloss",    coverOrText: "Text",  caliperInches: 0.0037 },
  { weight: "80lb",  kind: "Uncoated", coverOrText: "Text",  caliperInches: 0.006 },
];

/** Look up caliper by weight + kind + cover/text. Falls back to weight-only best match. */
export function lookupCaliper(
  weight?: string,
  kind?: string,
  coverOrText?: "Cover" | "Text"
): number | null {
  if (!weight) return null;
  const w = weight.trim().toLowerCase();
  // Exact match first
  const exact = PAPER_CALIPERS.find(e =>
    e.weight.toLowerCase() === w &&
    (!kind || e.kind.toLowerCase() === kind.toLowerCase()) &&
    (!coverOrText || e.coverOrText === coverOrText)
  );
  if (exact) return exact.caliperInches;
  // Weight-only match — return first
  const byWeight = PAPER_CALIPERS.find(e => e.weight.toLowerCase() === w);
  return byWeight ? byWeight.caliperInches : null;
}

/** Estimate caliper from a free-text paper description (last resort). */
export function guessCaliperFromText(text?: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  // Try weight patterns: "14pt", "100lb", etc.
  const ptMatch = t.match(/(\d+)\s*pt/);
  const lbMatch = t.match(/(\d+)\s*lb/);
  const kind = t.includes("gloss") ? "Gloss" : t.includes("dull") || t.includes("silk") || t.includes("matte") ? "Dull" : t.includes("uncoated") || t.includes("offset") ? "Uncoated" : undefined;
  const coverOrText = t.includes("cover") ? "Cover" as const : t.includes("text") ? "Text" as const : undefined;
  if (ptMatch) return lookupCaliper(`${ptMatch[1]}pt.`, kind, coverOrText);
  if (lbMatch) return lookupCaliper(`${lbMatch[1]}lb`, kind, coverOrText);
  return null;
}
