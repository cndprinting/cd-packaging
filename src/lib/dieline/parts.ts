// Shared dieline building blocks for the carton styles in carton.ts.
// The tuck flap and dust flap shapes are the same ones fitted to Todd's dies in
// tuck-box.ts (shoulder curve, slit lock, nicks, 15 deg taper); they are copied
// here so tuck-box.ts (validated against the real PDFs) stays untouched.
import type { Dieline, Kind, PathEl, Pt } from "./tuck-box";
import { round32 } from "./tuck-box";

export const R32 = 1 / 32;
export const NICK = 1 / 16;
export const CHAMFER = 0.125;
export const DUST_RUN = 0.25;
export const GLUE_ANGLE = (15 * Math.PI) / 180;
const SHOULDER: [number, number][] = [
  [0.182, 0.0], [0.364, 0.0865], [0.535, 0.259],
  [0.706, 0.427], [0.863, 0.680], [1.0, 1.0],
];

export type Span = { x0: number; x1: number };

export class Builder {
  el: PathEl[] = [];
  line(kind: Kind, a: Pt, b: Pt) { if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 1e-6) this.el.push({ kind, type: "line", a, b }); }
  poly(kind: Kind, pts: Pt[], close = false) { for (let i = 1; i < pts.length; i++) this.line(kind, pts[i - 1], pts[i]); if (close) this.line(kind, pts[pts.length - 1], pts[0]); }
  arc(a: Pt, b: Pt, r: number, sweep: 0 | 1) { this.el.push({ kind: "cut", type: "arc", a, b, r, sweep }); }
  cubic(a: Pt, c1: Pt, c2: Pt, b: Pt) { this.el.push({ kind: "cut", type: "cubic", a, c1, c2, b }); }

  /** glue flap on the left of x=0 over y 0..D with 15 deg chamfers */
  glueFlap(glue: number, D: number) {
    const gi = glue * Math.tan(GLUE_ANGLE);
    this.line("crease", [0, 0], [0, D]);
    this.line("cut", [0, 0], [-glue, gi]);
    this.line("cut", [-glue, gi], [-glue, D - gi]);
    this.line("cut", [-glue, D - gi], [0, D]);
  }

  /** Todd-style tuck closure (closure panel Wc deep + tuck flap) on span p, beyond y0 in direction dir */
  tuckClosure(p: Span, y0: number, dir: 1 | -1, Wc: number, tuck: number, tuckInset: number) {
    const Y = (d: number) => y0 + dir * d;
    const s = tuckInset, t = tuck;
    this.line("crease", [p.x0, y0], [p.x1, y0]);
    this.line("cut", [p.x0, Y(0)], [p.x0, Y(Wc)]);
    this.line("cut", [p.x1, Y(0)], [p.x1, Y(Wc)]);
    this.line("crease", [p.x0 + s, Y(Wc)], [p.x1 - s, Y(Wc)]);
    this.line("cut", [p.x0 + s, Y(Wc - NICK)], [p.x0 + s, Y(Wc)]);
    this.line("cut", [p.x1 - s, Y(Wc - NICK)], [p.x1 - s, Y(Wc)]);
    const ys = Y(Wc + R32);
    const sw: 0 | 1 = dir === 1 ? 1 : 0;
    this.arc([p.x0, Y(Wc)], [p.x0 + R32, ys], R32, sw);
    this.line("cut", [p.x0 + R32, ys], [p.x0 + s - R32, ys]);
    this.arc([p.x0 + s - R32, ys], [p.x0 + s, Y(Wc)], R32, sw);
    this.arc([p.x1 - s, Y(Wc)], [p.x1 - s + R32, ys], R32, sw);
    this.line("cut", [p.x1 - s + R32, ys], [p.x1 - R32, ys]);
    this.arc([p.x1 - R32, ys], [p.x1, Y(Wc)], R32, sw);
    this.line("cut", [p.x0 + s, Y(Wc + t)], [p.x1 - s, Y(Wc + t)]);
    const bx = R32 * (1 - Math.SQRT1_2), by = R32 * Math.SQRT1_2;
    const shoulder = (edgeX: number, inward: 1 | -1) => {
      const base: Pt = [edgeX + inward * bx, Y(Wc + by)];
      const u = s - bx, v = t - by;
      const P = (n: [number, number]): Pt => [base[0] + inward * n[1] * u, base[1] + dir * n[0] * v];
      this.cubic(base, P(SHOULDER[0]), P(SHOULDER[1]), P(SHOULDER[2]));
      this.cubic(P(SHOULDER[2]), P(SHOULDER[3]), P(SHOULDER[4]), P(SHOULDER[5]));
    };
    shoulder(p.x0, 1);
    shoulder(p.x1, -1);
  }

  /** Todd-style dust flap on span sp beyond y0. straightSide faces the closure panel. */
  dustFlap(sp: Span, y0: number, dir: 1 | -1, h: number, straightSide: "left" | "right", outerIsEdge: boolean, angleDeg = 15) {
    const Y = (d: number) => y0 + dir * d;
    const tanA = Math.tan((angleDeg * Math.PI) / 180);
    const relief = outerIsEdge ? 0 : R32;
    const width = sp.x1 - sp.x0 - relief;
    const taperH = Math.max(0, h - DUST_RUN - CHAMFER);
    const top = width - CHAMFER - tanA * taperH;
    if (top <= 0) throw new Error("dust flap height too tall for this panel width");
    const sx = straightSide === "left" ? sp.x0 : sp.x1;
    const ox = straightSide === "left" ? sp.x1 - relief : sp.x0 + relief;
    const m = straightSide === "left" ? 1 : -1;
    this.line("cut", [sx, Y(0)], [sx, Y(h)]);
    this.line("cut", [sx, Y(h)], [sx + m * top, Y(h)]);
    this.line("cut", [sx + m * top, Y(h)], [sx + m * (top + tanA * taperH), Y(DUST_RUN + CHAMFER)]);
    this.line("cut", [sx + m * (top + tanA * taperH), Y(DUST_RUN + CHAMFER)], [ox, Y(DUST_RUN)]);
    this.line("cut", [ox, Y(DUST_RUN)], [ox, Y(0)]);
    this.line("crease", [sx, Y(0)], [ox, Y(0)]);
    if (relief > 0) this.line("cut", [ox, Y(0)], [ox + m * relief, Y(0)]);
  }

  /** Plain rectangular flap with both outer corners chamfered (seal-end / sleeve ends). */
  rectFlap(sp: Span, y0: number, dir: 1 | -1, h: number, chamfer = CHAMFER, relief: [number, number] = [0, 0], taperDeg = 0) {
    const Y = (d: number) => y0 + dir * d;
    const x0 = sp.x0 + relief[0], x1 = sp.x1 - relief[1];
    const t = Math.tan((taperDeg * Math.PI) / 180) * h;
    this.line("crease", [x0, y0], [x1, y0]);
    this.poly("cut", [[x0, Y(0)], [x0 + t, Y(h - chamfer)], [x0 + t + chamfer, Y(h)], [x1 - t - chamfer, Y(h)], [x1 - t, Y(h - chamfer)], [x1, Y(0)]]);
    if (relief[0] > 0) this.line("cut", [sp.x0, y0], [x0, y0]);
    if (relief[1] > 0) this.line("cut", [x1, y0], [sp.x1, y0]);
  }

  finish(spec: Dieline["spec"], panels: Dieline["panels"]): Dieline {
    const cuts = this.el.filter((e) => e.kind === "cut");
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const e of cuts) for (const [x, y] of endpoints(e)) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    return { spec, elements: dedupe(this.el), flat: { width: maxX - minX, height: maxY - minY, minX, minY }, panels };
  }
}

function endpoints(e: PathEl): Pt[] { return e.type === "line" ? [e.a, e.b] : e.type === "arc" ? [e.a, e.b] : [e.a, e.c1, e.c2, e.b]; }

/** Drop exact duplicate lines and creases that a cut fully covers on the same axis line. */
function dedupe(el: PathEl[]): PathEl[] {
  const out: PathEl[] = [];
  const seen = new Set<string>();
  for (const e of el) {
    const k = e.type === "line" ? `${e.kind}|${[e.a, e.b].map((p) => p.map((v) => v.toFixed(4)).join(",")).sort().join("|")}` : JSON.stringify(e);
    if (seen.has(k)) continue; seen.add(k); out.push(e);
  }
  const lines = out.filter((e): e is Extract<PathEl, { type: "line" }> => e.type === "line");
  return out.filter((e) => {
    if (e.type !== "line" || e.kind !== "crease") return true;
    return !lines.some((c) => c.kind === "cut" && covers(c, e));
  });
}
function covers(c: Extract<PathEl, { type: "line" }>, e: Extract<PathEl, { type: "line" }>) {
  const cv = Math.abs(c.a[0] - c.b[0]) < 1e-9, ev = Math.abs(e.a[0] - e.b[0]) < 1e-9;
  if (cv && ev && Math.abs(c.a[0] - e.a[0]) < 1e-6) return Math.min(c.a[1], c.b[1]) <= Math.min(e.a[1], e.b[1]) + 1e-6 && Math.max(c.a[1], c.b[1]) >= Math.max(e.a[1], e.b[1]) - 1e-6;
  const ch = Math.abs(c.a[1] - c.b[1]) < 1e-9, eh = Math.abs(e.a[1] - e.b[1]) < 1e-9;
  if (ch && eh && Math.abs(c.a[1] - e.a[1]) < 1e-6) return Math.min(c.a[0], c.b[0]) <= Math.min(e.a[0], e.b[0]) + 1e-6 && Math.max(c.a[0], c.b[0]) >= Math.max(e.a[0], e.b[0]) - 1e-6;
  return false;
}

export { round32 };
