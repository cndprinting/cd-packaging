// Parametric tuck-end carton generator (straight tuck / reverse tuck).
//
// Every rule here was measured off C&D's own Illustrator dielines (Todd's
// files via Mike M, 9/22/2026 -- Global-roll STE, Peak-Glucomannan RTE,
// RA-07/125/126/127/336/411/547/611/641 STE) rather than taken from a
// textbook, so the output folds the way the plant already makes boxes:
//   - glue flap 5/8" with 15 deg chamfers
//   - outermost side panel and the closure panels are 1/32" short (board comp)
//   - tuck flap: slit lock 1/32" above the fold, 1/16" nick at the shoulder,
//     shoulder = Todd's two-cubic curve scaled to (inset x length)
//   - dust flaps: straight edge toward the closure panel, 15 deg taper away,
//     1/8" 45 deg chamfer, 1/4" straight run at the outer edge, 1/32" relief
//     where the flap meets a crease
// Tuck length and dust-flap height are Todd's per-job judgment calls (they
// vary die to die), so they are parameters with data-fitted defaults.
//
// Frame: x runs along the wrap (glue flap at negative x), y is the panel
// height (D). Units are inches. See validation/dieline for the overlay test
// against the real PDFs.

export type TuckStyle = "STE" | "RTE";

export interface TuckBoxSpec {
  style: TuckStyle;
  /** main panel width (the face you print on) */
  L: number;
  /** side panel width = box thickness = closure panel depth */
  W: number;
  /** panel height */
  D: number;
  /** board compensation taken off the outer side panel + closure panels (default 1/32) */
  comp?: number;
  /** glue flap width (default 0.625) */
  glue?: number;
  /** tuck flap length beyond the fold (default from W) */
  tuck?: number;
  /** tuck shoulder inset per side (default 0.375 x tuck) */
  tuckInset?: number;
  /** dust flap height (default from W) */
  dust?: number;
  /** dust flap taper from vertical, degrees (default 15) */
  dustAngle?: number;
  /** STE only: which main panel carries both tucks ("far" = away from glue, C&D default) */
  tuckPanel?: "near" | "far";
}

export type Pt = [number, number];
export type Kind = "cut" | "crease";
export type PathEl =
  | { kind: Kind; type: "line"; a: Pt; b: Pt }
  | { kind: Kind; type: "cubic"; a: Pt; c1: Pt; c2: Pt; b: Pt }
  | { kind: Kind; type: "arc"; a: Pt; b: Pt; r: number; sweep: 0 | 1 };

export interface Dieline {
  spec: Required<Omit<TuckBoxSpec, "tuckPanel">> & { tuckPanel: "near" | "far" };
  elements: PathEl[];
  /** flat blank size (bounding box of all cuts) */
  flat: { width: number; height: number; minX: number; minY: number };
  panels: { name: string; x0: number; x1: number; y0: number; y1: number }[];
}

const R32 = 1 / 32;
const NICK = 1 / 16;
const CHAMFER = 0.125;
const DUST_RUN = 0.25;
const GLUE_ANGLE = (15 * Math.PI) / 180;

// Todd's tuck shoulder, normalized: (length along the tuck, inward from the
// panel edge) from the base corner (0,0) to the tip corner (1,1). Two cubics.
// Measured identically on Peak-Glucomannan (0.33 x 0.88) and Global-roll
// (0.27 x 0.69), so it is one shape scaled, not an ellipse.
const SHOULDER: [number, number][] = [
  [0.182, 0.0], [0.364, 0.0865], [0.535, 0.259],
  [0.706, 0.427], [0.863, 0.680], [1.0, 1.0],
];

export function defaultTuck(W: number): number {
  // fitted: W 1.06 -> 0.66, 1.32 -> 0.66, 1.56 -> 0.72, 2.0 -> 0.78, 2.125 -> 0.78
  return round32(Math.min(1.0, Math.max(0.625, 0.625 + (W - 1) * 0.15)));
}
export function defaultDust(W: number, Lopen: number): number {
  // Fitted on 14 of Todd's dies (validation/dieline): 0.60-0.79 x W, median 0.70.
  // W 1.06 -> 0.84, 1.5 -> 1.09..1.19, 2.125 -> 1.44, 2.4 -> 1.56. Never past half
  // the opening (two flaps meet in the middle).
  return round32(Math.max(0.5, Math.min(0.7 * W, Lopen / 2 + R32)));
}
export function round32(v: number): number { return Math.round(v * 32) / 32; }

export function generateTuckBox(input: TuckBoxSpec): Dieline {
  const L = input.L, W = input.W, D = input.D;
  if (!(L > 0 && W > 0 && D > 0)) throw new Error("L, W and D must be positive");
  const comp = input.comp ?? R32;
  const glue = input.glue ?? 0.625;
  const tuck = input.tuck ?? defaultTuck(W);
  const tuckInset = input.tuckInset ?? round32(0.375 * tuck);
  const dust = input.dust ?? defaultDust(W, L);
  const dustAngle = input.dustAngle ?? 15;
  const tuckPanel = input.tuckPanel ?? "far";
  const spec = { style: input.style, L, W, D, comp, glue, tuck, tuckInset, dust, dustAngle, tuckPanel };

  const el: PathEl[] = [];
  const line = (kind: Kind, a: Pt, b: Pt) => { if (dist(a, b) > 1e-6) el.push({ kind, type: "line", a, b }); };

  // panel columns: glue | P1 | S1 | P2 | S2(short)
  const Wc = W - comp;
  const P1 = { x0: 0, x1: L }, S1 = { x0: L, x1: L + W }, P2 = { x0: L + W, x1: 2 * L + W }, S2 = { x0: 2 * L + W, x1: 2 * L + W + Wc };
  const panels = [
    { name: "glue", x0: -glue, x1: 0, y0: 0, y1: D },
    { name: "P1", ...P1, y0: 0, y1: D }, { name: "S1", ...S1, y0: 0, y1: D },
    { name: "P2", ...P2, y0: 0, y1: D }, { name: "S2", ...S2, y0: 0, y1: D },
  ];

  // which main panel closes which end. STE: both on one panel. RTE: top on P1, bottom on P2.
  const topPanel = spec.style === "RTE" ? P1 : (tuckPanel === "far" ? P2 : P1);
  const botPanel = spec.style === "RTE" ? P2 : topPanel;

  // vertical creases between panels, glue crease, outer edge of S2
  for (const x of [0, L, L + W, 2 * L + W]) line("crease", [x, 0], [x, D]);
  line("cut", [S2.x1, 0], [S2.x1, D]);

  // glue flap: 15 deg chamfers top and bottom
  const gi = glue * Math.tan(GLUE_ANGLE);
  line("cut", [0, 0], [-glue, gi]);
  line("cut", [-glue, gi], [-glue, D - gi]);
  line("cut", [-glue, D - gi], [0, D]);

  // top and bottom edges of the main panels: crease where a closure hangs, cut otherwise
  for (const end of ["top", "bottom"] as const) {
    const closing = end === "top" ? topPanel : botPanel;
    const y = end === "top" ? D : 0;
    for (const p of [P1, P2]) line(p === closing ? "crease" : "cut", [p.x0, y], [p.x1, y]);
  }

  // closure panel + tuck flap on a main panel, at one end. `dir` = +1 for top, -1 for bottom.
  const closure = (p: { x0: number; x1: number }, dir: 1 | -1) => {
    const y0 = dir === 1 ? D : 0;
    const Y = (d: number) => y0 + dir * d; // distance beyond the panel edge
    const s = tuckInset, t = tuck;
    // closure panel sides
    line("cut", [p.x0, Y(0)], [p.x0, Y(Wc)]);
    line("cut", [p.x1, Y(0)], [p.x1, Y(Wc)]);
    // fold between closure and tuck, nick to nick
    line("crease", [p.x0 + s, Y(Wc)], [p.x1 - s, Y(Wc)]);
    // nicks (into the closure panel) at the shoulder corners
    line("cut", [p.x0 + s, Y(Wc - NICK)], [p.x0 + s, Y(Wc)]);
    line("cut", [p.x1 - s, Y(Wc - NICK)], [p.x1 - s, Y(Wc)]);
    // slit lock 1/32 above the fold, corner arcs r=1/32 at each end
    const ys = Y(Wc + R32);
    const sweepL: 0 | 1 = dir === 1 ? 1 : 0;
    el.push({ kind: "cut", type: "arc", a: [p.x0, Y(Wc)], b: [p.x0 + R32, ys], r: R32, sweep: sweepL });
    line("cut", [p.x0 + R32, ys], [p.x0 + s - R32, ys]);
    el.push({ kind: "cut", type: "arc", a: [p.x0 + s - R32, ys], b: [p.x0 + s, Y(Wc)], r: R32, sweep: sweepL });
    el.push({ kind: "cut", type: "arc", a: [p.x1 - s, Y(Wc)], b: [p.x1 - s + R32, ys], r: R32, sweep: sweepL });
    line("cut", [p.x1 - s + R32, ys], [p.x1 - R32, ys]);
    el.push({ kind: "cut", type: "arc", a: [p.x1 - R32, ys], b: [p.x1, Y(Wc)], r: R32, sweep: sweepL });
    // tuck tip
    line("cut", [p.x0 + s, Y(Wc + t)], [p.x1 - s, Y(Wc + t)]);
    // shoulders: from the corner-arc midpoint to the tip corner
    const bx = R32 * (1 - Math.SQRT1_2), by = R32 * Math.SQRT1_2;
    const shoulder = (edgeX: number, inward: 1 | -1) => {
      const base: Pt = [edgeX + inward * bx, Y(Wc + by)];
      const u = s - inward * inward * bx; // inward extent
      const v = t - by;                    // along-tuck extent
      const P = (n: [number, number]): Pt => [base[0] + inward * n[1] * u, base[1] + dir * n[0] * v];
      el.push({ kind: "cut", type: "cubic", a: base, c1: P(SHOULDER[0]), c2: P(SHOULDER[1]), b: P(SHOULDER[2]) });
      el.push({ kind: "cut", type: "cubic", a: P(SHOULDER[2]), c1: P(SHOULDER[3]), c2: P(SHOULDER[4]), b: P(SHOULDER[5]) });
    };
    shoulder(p.x0, 1);
    shoulder(p.x1, -1);
  };
  closure(topPanel, 1);
  closure(botPanel, -1);

  // dust flap on a side panel at one end. straightSide = which side faces the closure panel.
  const dustFlap = (sp: { x0: number; x1: number }, dir: 1 | -1, straightSide: "left" | "right", outerIsEdge: boolean) => {
    const y0 = dir === 1 ? D : 0;
    const Y = (d: number) => y0 + dir * d;
    const h = dust;
    const tanA = Math.tan((dustAngle * Math.PI) / 180);
    // outer (angled) side stops 1/32 short of a crease, flush with a blank edge
    const relief = outerIsEdge ? 0 : R32;
    const width = sp.x1 - sp.x0 - relief;
    const taperH = Math.max(0, h - DUST_RUN - CHAMFER);
    const top = width - CHAMFER - tanA * taperH; // straight top edge
    if (top <= 0) throw new Error("dust flap height too tall for this panel width");
    const sx = straightSide === "left" ? sp.x0 : sp.x1;   // straight side x
    const ox = straightSide === "left" ? sp.x1 - relief : sp.x0 + relief; // outer side x
    const m = straightSide === "left" ? 1 : -1;         // direction from straight side toward outer
    line("cut", [sx, Y(0)], [sx, Y(h)]);
    line("cut", [sx, Y(h)], [sx + m * top, Y(h)]);
    line("cut", [sx + m * top, Y(h)], [sx + m * (top + tanA * taperH), Y(DUST_RUN + CHAMFER)]);
    line("cut", [sx + m * (top + tanA * taperH), Y(DUST_RUN + CHAMFER)], [ox, Y(DUST_RUN)]);
    line("cut", [ox, Y(DUST_RUN)], [ox, Y(0)]);
    line("crease", [sx, Y(0)], [ox, Y(0)]);
    if (relief > 0) line("cut", [ox, Y(0)], [ox + m * relief, Y(0)]);
  };
  for (const end of [1, -1] as const) {
    const closing = end === 1 ? topPanel : botPanel;
    // S1 sits between P1 and P2: straight side toward whichever closes
    dustFlap(S1, end, closing === P1 ? "left" : "right", false);
    // S2: adjacent to P2 on its left; P1 is reached around the glue wrap (its right/blank edge)
    dustFlap(S2, end, closing === P2 ? "left" : "right", closing === P1 ? false : true);
  }

  const cuts = el.filter((e) => e.kind === "cut");
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of cuts) for (const [x, y] of endpoints(e)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  return { spec, elements: mergeCollinear(el), flat: { width: maxX - minX, height: maxY - minY, minX, minY }, panels };
}

function endpoints(e: PathEl): Pt[] {
  return e.type === "line" ? [e.a, e.b] : e.type === "arc" ? [e.a, e.b] : [e.a, e.c1, e.c2, e.b];
}
function dist(a: Pt, b: Pt) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

// Overlapping collinear cuts (a dust flap edge on top of a closure side) become one line;
// a cut wins over a crease on the same span.
function mergeCollinear(el: PathElNoMerge[]): PathEl[] {
  const lines = el.filter((e): e is Extract<PathEl, { type: "line" }> => e.type === "line");
  const others = el.filter((e) => e.type !== "line");
  const out: PathEl[] = [...others];
  const used = new Array(lines.length).fill(false);
  for (let i = 0; i < lines.length; i++) {
    if (used[i]) continue;
    let cur = lines[i];
    let merged = true;
    while (merged) {
      merged = false;
      for (let j = 0; j < lines.length; j++) {
        if (used[j] || j === i) continue;
        const o = lines[j];
        if (o.kind !== cur.kind) continue;
        const joined = joinIfOverlapping(cur, o);
        if (joined) { cur = joined; used[j] = true; merged = true; }
      }
    }
    used[i] = true;
    out.push(cur);
  }
  // drop crease spans fully covered by a cut on the same line (the closure sides over panel creases)
  return out.filter((e) => {
    if (e.type !== "line" || e.kind !== "crease") return true;
    return !out.some((c) => c.type === "line" && c.kind === "cut" && covers(c, e));
  });
}
type PathElNoMerge = PathEl;
function joinIfOverlapping(a: Extract<PathEl, { type: "line" }>, b: Extract<PathEl, { type: "line" }>) {
  const av = a.a[0] === a.b[0], ah = a.a[1] === a.b[1], bv = b.a[0] === b.b[0], bh = b.a[1] === b.b[1];
  if (av && bv && Math.abs(a.a[0] - b.a[0]) < 1e-6) {
    const [a0, a1] = [Math.min(a.a[1], a.b[1]), Math.max(a.a[1], a.b[1])], [b0, b1] = [Math.min(b.a[1], b.b[1]), Math.max(b.a[1], b.b[1])];
    if (b0 <= a1 + 1e-6 && a0 <= b1 + 1e-6) return { ...a, a: [a.a[0], Math.min(a0, b0)] as Pt, b: [a.a[0], Math.max(a1, b1)] as Pt };
  }
  if (ah && bh && Math.abs(a.a[1] - b.a[1]) < 1e-6) {
    const [a0, a1] = [Math.min(a.a[0], a.b[0]), Math.max(a.a[0], a.b[0])], [b0, b1] = [Math.min(b.a[0], b.b[0]), Math.max(b.a[0], b.b[0])];
    if (b0 <= a1 + 1e-6 && a0 <= b1 + 1e-6) return { ...a, a: [Math.min(a0, b0), a.a[1]] as Pt, b: [Math.max(a1, b1), a.a[1]] as Pt };
  }
  return null;
}
function covers(c: Extract<PathEl, { type: "line" }>, e: Extract<PathEl, { type: "line" }>) {
  const cv = c.a[0] === c.b[0], ev = e.a[0] === e.b[0];
  if (cv && ev && Math.abs(c.a[0] - e.a[0]) < 1e-6) {
    return Math.min(c.a[1], c.b[1]) <= Math.min(e.a[1], e.b[1]) + 1e-6 && Math.max(c.a[1], c.b[1]) >= Math.max(e.a[1], e.b[1]) - 1e-6;
  }
  const ch = c.a[1] === c.b[1], eh = e.a[1] === e.b[1];
  if (ch && eh && Math.abs(c.a[1] - e.a[1]) < 1e-6) {
    return Math.min(c.a[0], c.b[0]) <= Math.min(e.a[0], e.b[0]) + 1e-6 && Math.max(c.a[0], c.b[0]) >= Math.max(e.a[0], e.b[0]) - 1e-6;
  }
  return false;
}

/** Flatten every element to short straight pieces (for matching / DXF). */
export function flatten(d: Dieline, step = 0.02): { kind: Kind; a: Pt; b: Pt }[] {
  const out: { kind: Kind; a: Pt; b: Pt }[] = [];
  for (const e of d.elements) {
    if (e.type === "line") { out.push({ kind: e.kind, a: e.a, b: e.b }); continue; }
    const pts: Pt[] = [];
    if (e.type === "cubic") {
      const n = Math.max(4, Math.ceil(dist(e.a, e.b) / step));
      for (let i = 0; i <= n; i++) {
        const t = i / n, mt = 1 - t;
        pts.push([
          mt * mt * mt * e.a[0] + 3 * mt * mt * t * e.c1[0] + 3 * mt * t * t * e.c2[0] + t * t * t * e.b[0],
          mt * mt * mt * e.a[1] + 3 * mt * mt * t * e.c1[1] + 3 * mt * t * t * e.c2[1] + t * t * t * e.b[1],
        ]);
      }
    } else {
      // quarter arc between a and b (axis-aligned corner), centre is the corner
      const c: Pt = Math.abs(e.a[0] - e.b[0]) < 1e-9 || Math.abs(e.a[1] - e.b[1]) < 1e-9
        ? e.a
        : (Math.abs(e.a[0] - e.b[0]) > Math.abs(e.a[1] - e.b[1]) ? [e.b[0], e.a[1]] : [e.a[0], e.b[1]]);
      // the centre is the corner of the bounding square that is NOT on the arc: pick the one
      // that makes both radii equal r
      const cand: Pt[] = [[e.a[0], e.b[1]], [e.b[0], e.a[1]]];
      const centre = cand.find((p) => Math.abs(dist(p, e.a) - e.r) < 1e-6 && Math.abs(dist(p, e.b) - e.r) < 1e-6) ?? c;
      const a0 = Math.atan2(e.a[1] - centre[1], e.a[0] - centre[0]);
      let a1 = Math.atan2(e.b[1] - centre[1], e.b[0] - centre[0]);
      let da = a1 - a0;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      const n = 4;
      for (let i = 0; i <= n; i++) { const ang = a0 + (da * i) / n; pts.push([centre[0] + e.r * Math.cos(ang), centre[1] + e.r * Math.sin(ang)]); }
      void a1;
    }
    for (let i = 1; i < pts.length; i++) out.push({ kind: e.kind, a: pts[i - 1], b: pts[i] });
  }
  return out;
}

/** SVG with separate cut / crease groups (cut = magenta solid, crease = cyan dashed). 1 in = 72 units. */
export function toSVG(d: Dieline, opts: { scale?: number; margin?: number; title?: string } = {}): string {
  const s = opts.scale ?? 72, m = opts.margin ?? 0.5;
  const W = (d.flat.width + 2 * m) * s, H = (d.flat.height + 2 * m) * s;
  const X = (x: number) => ((x - d.flat.minX + m) * s).toFixed(2);
  const Y = (y: number) => ((d.flat.minY + d.flat.height - y + m) * s).toFixed(2); // flip y
  const path = (e: PathEl) => {
    if (e.type === "line") return `M${X(e.a[0])} ${Y(e.a[1])}L${X(e.b[0])} ${Y(e.b[1])}`;
    if (e.type === "cubic") return `M${X(e.a[0])} ${Y(e.a[1])}C${X(e.c1[0])} ${Y(e.c1[1])} ${X(e.c2[0])} ${Y(e.c2[1])} ${X(e.b[0])} ${Y(e.b[1])}`;
    return `M${X(e.a[0])} ${Y(e.a[1])}A${(e.r * s).toFixed(2)} ${(e.r * s).toFixed(2)} 0 0 ${e.sweep ? 0 : 1} ${X(e.b[0])} ${Y(e.b[1])}`;
  };
  const cuts = d.elements.filter((e) => e.kind === "cut").map(path).join("");
  const creases = d.elements.filter((e) => e.kind === "crease").map(path).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${(W / s).toFixed(3)}in" height="${(H / s).toFixed(3)}in" viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}">` +
    (opts.title ? `<title>${escapeXml(opts.title)}</title>` : "") +
    `<g id="cut" fill="none" stroke="#e6007e" stroke-width="0.96"><path d="${cuts}"/></g>` +
    `<g id="crease" fill="none" stroke="#0090d0" stroke-width="0.96" stroke-dasharray="6 3"><path d="${creases}"/></g>` +
    `</svg>`;
}
function escapeXml(s: string) { return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string)); }
