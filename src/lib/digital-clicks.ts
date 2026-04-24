// Digital click charge lookup — Mary's spec (4/24/26).
// Three tiers based on longest sheet dimension; five ink configs;
// variable-data add-on per side.
//
// Mary's worked example:
//   1,000 pcs 8.5×11, 2-up on 12.5×19, 4/4 process, 25 MR sheets
//   = (500 + 25) × $0.378 = $198.45  ← matches our calc

export type InkConfig = "1/0" | "1/1" | "4/0" | "4/1" | "4/4";

export interface DigitalClickStandards {
  digitalClickT1_1_0: number;
  digitalClickT1_1_1: number;
  digitalClickT1_4_0: number;
  digitalClickT1_4_1: number;
  digitalClickT1_4_4: number;
  digitalClickT1_VD: number;
  digitalClickT2_1_0: number;
  digitalClickT2_1_1: number;
  digitalClickT2_4_0: number;
  digitalClickT2_4_1: number;
  digitalClickT2_4_4: number;
  digitalClickT2_VD: number;
  digitalClickT3_1_0: number;
  digitalClickT3_1_1: number;
  digitalClickT3_4_0: number;
  digitalClickT3_4_1: number;
  digitalClickT3_4_4: number;
  digitalClickT3_VD: number;
  digitalVDSetupRate: number;
  digitalTier1MaxLength: number;
  digitalTier2MaxLength: number;
  digitalTier3MaxLength: number;
}

/** Pick the size tier (1, 2, or 3) from the longest sheet dimension. */
export function getDigitalSizeTier(
  sheetW: number,
  sheetH: number,
  std: Pick<DigitalClickStandards, "digitalTier1MaxLength" | "digitalTier2MaxLength" | "digitalTier3MaxLength">
): 1 | 2 | 3 {
  const longest = Math.max(sheetW || 0, sheetH || 0);
  if (longest <= std.digitalTier1MaxLength) return 1;
  if (longest <= std.digitalTier2MaxLength) return 2;
  return 3;
}

/** Map (front colors, back colors, ink type) to one of the 5 configs Mary uses. */
export function inferInkConfig(colorsFront: number, colorsBack: number): InkConfig {
  const front = Number(colorsFront) || 0;
  const back = Number(colorsBack) || 0;
  if (front >= 4 && back >= 4) return "4/4";
  if (front >= 4 && back >= 1) return "4/1";
  if (front >= 4) return "4/0";
  if (front >= 1 && back >= 1) return "1/1";
  return "1/0";
}

/** Look up the per-sheet click rate for a (tier, config). */
export function getDigitalClickRate(
  tier: 1 | 2 | 3,
  config: InkConfig,
  std: DigitalClickStandards
): number {
  const key = `digitalClickT${tier}_${config.replace("/", "_")}` as keyof DigitalClickStandards;
  return Number(std[key]) || 0;
}

/** Look up the per-sheet variable-data adder for a tier. */
export function getDigitalVDRate(
  tier: 1 | 2 | 3,
  std: DigitalClickStandards
): number {
  const key = `digitalClickT${tier}_VD` as keyof DigitalClickStandards;
  return Number(std[key]) || 0;
}
