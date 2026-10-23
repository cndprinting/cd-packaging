// Folding carton style catalog (Nitay 10/22: "we are only showing reverse
// tuck and one other option... include any other folding carton types").
//
// STE / RTE come from tuck-box.ts and are fitted to Todd's dies. The styles
// below use standard folding-carton construction (ECMA-style proportions) with
// the same tuck flaps, dust flaps and glue flap as the fitted ones, so they
// fold correctly but Todd should still review flap depths before a die is cut.
import { generateTuckBox, defaultTuck, defaultDust, round32, type Dieline, type TuckBoxSpec } from "./tuck-box";
import { Builder, CHAMFER, R32, type Span } from "./parts";

export type CartonStyle = "STE" | "RTE" | "TTAB" | "TTSB" | "SE" | "SLV" | "RETF";

export interface StyleInfo {
  code: CartonStyle;
  name: string;
  aka: string;
  use: string;
  dims: string;      // what L / W / D mean for this style
  fitted: boolean;   // geometry measured off C&D dies
}

export const STYLES: StyleInfo[] = [
  { code: "STE", name: "Straight tuck end", aka: "STE", use: "Everyday retail carton; both tucks on the same panel, so the front stays clean. Supplements, cosmetics, small retail.", dims: "L = front panel width, W = box thickness, D = height", fitted: true },
  { code: "RTE", name: "Reverse tuck end", aka: "RTE", use: "Tucks on opposite panels; cheaper to glue and most common for pharma and skincare.", dims: "L = front panel width, W = box thickness, D = height", fitted: true },
  { code: "TTAB", name: "Tuck top auto bottom", aka: "crash lock bottom", use: "Bottom locks itself when the box is squared. Heavier contents (jars, bottles, candles) and fast hand or machine packing.", dims: "L = front panel width, W = box thickness, D = height", fitted: false },
  { code: "TTSB", name: "Tuck top snap lock bottom", aka: "1-2-3 bottom", use: "Bottom flaps snap together by hand; no bottom glue. Medium-weight contents, lower die and glue cost than auto bottom.", dims: "L = front panel width, W = box thickness, D = height", fitted: false },
  { code: "SE", name: "Seal end", aka: "cereal box", use: "Both ends glued shut on a packing line. Food, dry goods, tamper evidence.", dims: "L = front panel width, W = box thickness, D = height", fitted: false },
  { code: "SLV", name: "Sleeve", aka: "open-ended wrap / belly band", use: "Open at both ends; slides over a tray, tub or product. Promotional wraps and secondary packaging.", dims: "L = front panel width, W = box thickness, D = height", fitted: false },
  { code: "RETF", name: "Roll end tuck front tray", aka: "bakery / mailer box", use: "One-piece tray with a hinged lid and rolled front. Donuts, pastries, cookies, kits, e-commerce mailers.", dims: "L = tray length (lid hinge side), W = tray width, D = tray depth", fitted: false },
];

export interface CartonSpec extends Omit<TuckBoxSpec, "style"> { style: CartonStyle }

export function generateCarton(input: CartonSpec): Dieline {
  if (input.style === "STE" || input.style === "RTE") return generateTuckBox({ ...input, style: input.style });
  const L = input.L, W = input.W, D = input.D;
  if (!(L > 0 && W > 0 && D > 0)) throw new Error("L, W and D must be positive");
  const comp = input.comp ?? R32;
  const glue = input.glue ?? 0.625;
  const tuck = input.tuck ?? defaultTuck(W);
  const tuckInset = input.tuckInset ?? round32(0.375 * tuck);
  const dust = input.dust ?? defaultDust(W, L);
  const dustAngle = input.dustAngle ?? 15;
  const tuckPanel = input.tuckPanel ?? "far";
  const spec = { style: input.style as TuckBoxSpec["style"], L, W, D, comp, glue, tuck, tuckInset, dust, dustAngle, tuckPanel };
  const b = new Builder();

  if (input.style === "RETF") return rollEndTray(b, spec, L, W, D, comp, tuck, tuckInset);

  // Wrap styles: glue | P1 | S1 | P2 | S2(short)
  const Wc = W - comp;
  const P1: Span = { x0: 0, x1: L }, S1: Span = { x0: L, x1: L + W }, P2: Span = { x0: L + W, x1: 2 * L + W }, S2: Span = { x0: 2 * L + W, x1: 2 * L + W + Wc };
  const panels = [
    { name: "glue", x0: -glue, x1: 0, y0: 0, y1: D },
    { name: "P1", ...P1, y0: 0, y1: D }, { name: "S1", ...S1, y0: 0, y1: D },
    { name: "P2", ...P2, y0: 0, y1: D }, { name: "S2", ...S2, y0: 0, y1: D },
  ];
  b.glueFlap(glue, D);
  for (const x of [L, L + W, 2 * L + W]) b.line("crease", [x, 0], [x, D]);
  b.line("cut", [S2.x1, 0], [S2.x1, D]);

  const topPanel = tuckPanel === "far" ? P2 : P1;
  const tuckTop = () => {
    b.tuckClosure(topPanel, D, 1, Wc, tuck, tuckInset);
    const other = topPanel === P2 ? P1 : P2;
    b.line("cut", [other.x0, D], [other.x1, D]);
    b.dustFlap(S1, D, 1, dust, topPanel === P1 ? "left" : "right", false, dustAngle);
    b.dustFlap(S2, D, 1, dust, topPanel === P2 ? "left" : "right", topPanel === P1 ? false : true, dustAngle);
  };

  if (input.style === "SLV") {
    for (const p of [P1, S1, P2, S2]) { b.line("cut", [p.x0, D], [p.x1, D]); b.line("cut", [p.x0, 0], [p.x1, 0]); }
    return b.finish(spec, panels);
  }

  if (input.style === "SE") {
    // Both ends: major flaps on the main panels overlap 1/8" at the center and
    // glue; minor flaps on the side panels sit under them, tapered for clearance.
    const major = round32(Wc / 2 + 1 / 16), minor = round32(Math.max(0.25, Wc / 2 - 1 / 16));
    for (const [y0, dir] of [[D, 1], [0, -1]] as [number, 1 | -1][]) {
      b.rectFlap(P1, y0, dir, major, CHAMFER, [0, R32]);
      b.rectFlap(P2, y0, dir, major, CHAMFER, [R32, R32]);
      b.rectFlap(S1, y0, dir, minor, CHAMFER, [R32, R32], 15);
      b.rectFlap(S2, y0, dir, minor, CHAMFER, [R32, 0], 15);
    }
    return b.finish(spec, panels);
  }

  tuckTop();

  if (input.style === "TTAB") {
    // Crash lock bottom: full-depth flaps on both main panels, each with a 45 deg
    // glue crease toward the side panel that follows it; half-depth flaps on the
    // side panels glue to those triangles and pull the bottom flat when squared.
    const H = round32(Wc - 1 / 32);
    const hs = round32(Wc / 2 + 3 / 16);
    const main = (p: Span) => {
      b.line("crease", [p.x0, 0], [p.x1, 0]);
      b.poly("cut", [[p.x0, 0], [p.x0, -(H - 0.375)], [p.x0 + 0.375, -H], [p.x1, -H], [p.x1, 0]]);
      b.line("crease", [p.x1, 0], [p.x1 - H, -H]);
    };
    main(P1); main(P2);
    const side = (sp: Span, outerIsEdge: boolean) => {
      const relief = R32;
      const x0 = sp.x0 + relief, x1 = outerIsEdge ? sp.x1 : sp.x1 - relief;
      b.line("crease", [x0, 0], [x1, 0]);
      b.line("cut", [sp.x0, 0], [x0, 0]);
      if (!outerIsEdge) b.line("cut", [x1, 0], [sp.x1, 0]);
      const t = Math.tan((15 * Math.PI) / 180) * (hs - CHAMFER);
      b.poly("cut", [[x0, 0], [x0, -hs], [x1 - t - CHAMFER, -hs], [x1 - t, -(hs - CHAMFER)], [x1, 0]]);
    };
    side(S1, false); side(S2, true);
    // relief slits so the main flap corners clear the side flaps
    b.line("cut", [P1.x1, 0], [P1.x1, -R32]);
    b.line("cut", [P2.x1, 0], [P2.x1, -R32]);
    return b.finish(spec, panels);
  }

  // TTSB: 1-2-3 snap lock bottom. Fold order: P1 flap (1), both side flaps (2),
  // P2 flap (3) whose tongue snaps under flap 1.
  const h1 = round32(Wc - 1 / 16);
  const hSide = round32(Wc * 0.6);
  const h3 = round32(Wc - 1 / 16), tongue = 0.375, tw = round32(L * 0.55);
  b.rectFlap(P1, 0, -1, h1, 0.5, [0, R32]);
  b.dustFlap(S1, 0, -1, hSide, "right", false, 20);
  b.dustFlap(S2, 0, -1, hSide, "left", true, 20);
  const cx = (P2.x0 + P2.x1) / 2;
  b.line("crease", [P2.x0, 0], [P2.x1, 0]);
  b.poly("cut", [
    [P2.x0, 0], [P2.x0, -(h3 - 0.25)], [P2.x0 + 0.25, -h3], [cx - tw / 2 - 0.25, -h3], [cx - tw / 2, -(h3 + tongue)],
    [cx + tw / 2, -(h3 + tongue)], [cx + tw / 2 + 0.25, -h3], [P2.x1 - 0.25, -h3], [P2.x1, -(h3 - 0.25)], [P2.x1, 0],
  ]);
  b.line("crease", [cx - tw / 2, -h3], [cx + tw / 2, -h3]);
  // lock slits in flap 1 that the tongue corners catch
  b.line("cut", [P1.x0 + (L - tw) / 2, -(h1 - 0.5)], [P1.x0 + (L - tw) / 2 + 0.375, -(h1 - 0.5)]);
  b.line("cut", [P1.x1 - (L - tw) / 2 - 0.375, -(h1 - 0.5)], [P1.x1 - (L - tw) / 2, -(h1 - 0.5)]);
  return b.finish(spec, panels);
}

// Roll end tuck front tray (bakery / mailer). Frame: base at the origin, lid
// hinged on the back (+y), front rolls over (-y), end panels left and right.
function rollEndTray(b: Builder, spec: Dieline["spec"], L: number, W: number, D: number, comp: number, tuck: number, tuckInset: number): Dieline {
  const Dc = D - comp;
  const base: Span = { x0: 0, x1: L };
  const panels = [
    { name: "base", x0: 0, x1: L, y0: 0, y1: W },
    { name: "back", x0: 0, x1: L, y0: W, y1: W + D },
    { name: "lid", x0: 0, x1: L, y0: W + D, y1: 2 * W + D },
    { name: "front", x0: 0, x1: L, y0: -D, y1: 0 },
    { name: "endL", x0: -D, x1: 0, y0: 0, y1: W }, { name: "endR", x0: L, x1: L + D, y0: 0, y1: W },
  ];
  // base
  b.line("crease", [0, 0], [L, 0]); b.line("crease", [0, W], [L, W]);
  b.line("crease", [0, 0], [0, W]); b.line("crease", [L, 0], [L, W]);
  // back panel + lid + lid tuck (closure Dc deep then tuck flap)
  b.line("crease", [0, W + D], [L, W + D]);
  b.line("cut", [0, W], [0, W + D]); b.line("cut", [L, W], [L, W + D]);
  const lidY = W + D;
  b.line("cut", [0, lidY], [0, lidY + W]); b.line("cut", [L, lidY], [L, lidY + W]);
  b.tuckClosure(base, lidY + W, 1, Dc, tuck, tuckInset);
  // lid dust flaps (tuck inside the end panels): width Dc, tapered
  const dustH = round32(Math.min(Dc, W * 0.7));
  const lidSpanL: Span = { x0: -dustH, x1: 0 }, lidSpanR: Span = { x0: L, x1: L + dustH };
  const lidFlap = (sp: Span, side: "left" | "right") => {
    const t = Math.tan((15 * Math.PI) / 180) * (W - 0.25 - CHAMFER);
    const inner = side === "left" ? sp.x1 : sp.x0, outer = side === "left" ? sp.x0 : sp.x1, m = side === "left" ? -1 : 1;
    b.line("crease", [inner, lidY + R32], [inner, lidY + W]);
    b.poly("cut", [[inner, lidY + R32], [inner + m * (dustH - 0.25), lidY + R32], [outer, lidY + 0.25 + R32], [outer, lidY + W - t - CHAMFER], [outer - m * CHAMFER, lidY + W - t], [inner, lidY + W]]);
    b.line("cut", [inner, lidY], [inner, lidY + R32]);
  };
  lidFlap(lidSpanL, "left"); lidFlap(lidSpanR, "right");
  // front panel + roll-over inner panel with lock tabs that drop into base slots
  b.line("crease", [0, -D], [L, -D]);
  b.line("cut", [0, 0], [0, -D]); b.line("cut", [L, 0], [L, -D]);
  const inner = round32(Dc - 1 / 16), tab = 0.375, tabW = round32(Math.min(1, L * 0.15));
  b.poly("cut", [
    [0, -D], [0, -D - inner + 0.25], [0.25, -D - inner], [0.75, -D - inner], [0.75, -D - inner - tab], [0.75 + tabW, -D - inner - tab], [0.75 + tabW, -D - inner],
    [L - 0.75 - tabW, -D - inner], [L - 0.75 - tabW, -D - inner - tab], [L - 0.75, -D - inner - tab], [L - 0.75, -D - inner], [L - 0.25, -D - inner], [L, -D - inner + 0.25], [L, -D],
  ]);
  b.line("cut", [0.75, -R32], [0.75 + tabW, -R32]); // lock slots on the base/front crease
  b.line("cut", [L - 0.75 - tabW, -R32], [L - 0.75, -R32]);
  // end panels with front and back ears
  const ends = (sp: Span, side: "left" | "right") => {
    const m = side === "left" ? -1 : 1;
    const inner = side === "left" ? sp.x1 : sp.x0, outer = side === "left" ? sp.x0 : sp.x1;
    b.line("cut", [inner, 0], [outer, 0]); b.line("cut", [inner, W], [outer, W]);
    b.line("cut", [outer, 0], [outer, W]);
    // front ear (wrapped by the rolled front) and back ear (held by the lid flap)
    const earW = Dc - R32, earH = round32(Dc);
    const t = Math.tan((15 * Math.PI) / 180) * (earH - CHAMFER);
    const ear = (y0: number, dir: 1 | -1) => {
      const Y = (d: number) => y0 + dir * d;
      b.line("crease", [inner + m * R32, y0], [inner + m * earW, y0]);
      b.poly("cut", [[inner + m * R32, Y(0)], [inner + m * R32, Y(earH)], [inner + m * (earW - t - CHAMFER), Y(earH)], [inner + m * (earW - t), Y(earH - CHAMFER)], [inner + m * earW, Y(0)]]);
      b.line("cut", [inner, y0], [inner + m * R32, y0]);
    };
    ear(0, -1); ear(W, 1);
  };
  ends({ x0: -D, x1: 0 }, "left"); ends({ x0: L, x1: L + D }, "right");
  // overwrite the end-panel outer edges to stop at the ears' creases (already cut above)
  return b.finish(spec, panels);
}
