// Overlay test: generate each die from its L x W x D and see how much of the
// generated blank lies on Todd's real dieline (pdf-json/*.json, dumped from
// the Illustrator PDFs with pdfplumber). Mirrors the estimator validation
// approach: real plant output is the ground truth, not a textbook.
//
//   npx tsx validation/dieline/validate.ts            # all dies
//   npx tsx validation/dieline/validate.ts RA-411 fit # one die + fit tuck/dust
//
// Score = share of the generated geometry (sampled every 0.05") that sits
// within 0.02" of a line on the die, at the best of 4 rotations x candidate
// translations. Reverse = share of the die's lines inside the blank that the
// generator reproduces (catches features we don't draw).
import fs from "fs";
import path from "path";
import { generateTuckBox, flatten, type TuckBoxSpec, type Pt } from "../../src/lib/dieline/tuck-box";

interface Die { code: string; file: string; L: number; W: number; D: number; style?: "STE" | "RTE"; note?: string }

export const DIES: Die[] = [
  { code: "Global-roll", file: "Global-roll on oil tuck box", L: 2.125, W: 1.5, D: 3.625, style: "STE", note: "8-up, measured by hand first" },
  { code: "Peak-Gluco", file: "Peak-Glucomannan tuck box 2-28-19 layout", L: 3.5, W: 1.5, D: 5.5, style: "RTE", note: "4-up, measured by hand first" },
  { code: "RA-07", file: "RA-07", L: 1.1563, W: 1.1563, D: 3.35, style: "STE" },
  { code: "RA-125", file: "RA-125", L: 1.5625, W: 1.5625, D: 4.65625, style: "STE" },
  { code: "RA-126", file: "RA-126", L: 1.32, W: 1.32, D: 4.3125, style: "STE" },
  { code: "RA-127", file: "RA-127", L: 1.0625, W: 1.0625, D: 3.75, style: "STE" },
  { code: "RA-336", file: "RA-336", L: 1.3125, W: 1.3125, D: 4.0625, style: "STE" },
  { code: "RA-411", file: "RA-411", L: 2.125, W: 2.125, D: 4.4375, style: "STE" },
  { code: "RA-547", file: "RA-547", L: 1.375, W: 1.375, D: 6.25, style: "STE" },
  { code: "RA-611", file: "RA-611", L: 2, W: 2, D: 5.125, style: "STE" },
  { code: "RA-641", file: "RA-641", L: 2.375, W: 2.375, D: 2.5312, style: "STE" },
  { code: "RA-377", file: "RA-377", L: 1.96, W: 1.97, D: 5.39, style: "STE" },
  { code: "RA-21", file: "RA-21", L: 2.5, W: 1.625, D: 5.0625, style: "RTE", note: "with divider" },
  { code: "RA-252", file: "RA-252", L: 2.4, W: 2.4, D: 2.0938, note: "'tuck box' - style unknown" },
  { code: "RA-374", file: "RA-374", L: 2.937, W: 2.937, D: 2.437, note: "'tuck box' - style unknown" },
  { code: "RA-473", file: "RA-473", L: 3, W: 0.75, D: 3.375, note: "'tuck box' - style unknown" },
];

type Seg = [number, number, number, number];
const TOL = 0.02, STEP = 0.05;

class Index {
  cells = new Map<string, Seg[]>();
  constructor(public segs: Seg[], public cell = 0.25) {
    for (const s of segs) {
      const x0 = Math.min(s[0], s[2]), x1 = Math.max(s[0], s[2]), y0 = Math.min(s[1], s[3]), y1 = Math.max(s[1], s[3]);
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++)
        for (let j = Math.floor(y0 / cell); j <= Math.floor(y1 / cell); j++) {
          const k = `${i},${j}`; const a = this.cells.get(k); if (a) a.push(s); else this.cells.set(k, [s]);
        }
    }
  }
  near(x: number, y: number): boolean {
    const i = Math.floor(x / this.cell), j = Math.floor(y / this.cell);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const a = this.cells.get(`${i + di},${j + dj}`); if (!a) continue;
      for (const s of a) if (distToSeg(x, y, s) <= TOL) return true;
    }
    return false;
  }
}
function distToSeg(px: number, py: number, s: Seg) {
  const vx = s[2] - s[0], vy = s[3] - s[1], wx = px - s[0], wy = py - s[1];
  const l2 = vx * vx + vy * vy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / l2));
  return Math.hypot(px - (s[0] + t * vx), py - (s[1] + t * vy));
}
function samples(s: Seg): Pt[] {
  const n = Math.max(1, Math.ceil(Math.hypot(s[2] - s[0], s[3] - s[1]) / STEP));
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) out.push([s[0] + ((s[2] - s[0]) * i) / n, s[1] + ((s[3] - s[1]) * i) / n]);
  return out;
}
function rot(s: Seg, k: number): Seg {
  const r = (x: number, y: number): Pt => k === 0 ? [x, y] : k === 1 ? [-y, x] : k === 2 ? [-x, -y] : [y, -x];
  const a = r(s[0], s[1]), b = r(s[2], s[3]);
  return [a[0], a[1], b[0], b[1]];
}
function shift(s: Seg, dx: number, dy: number): Seg { return [s[0] + dx, s[1] + dy, s[2] + dx, s[3] + dy]; }
function len(s: Seg) { return Math.hypot(s[2] - s[0], s[3] - s[1]); }
function orient(s: Seg): "v" | "h" | "o" { return Math.abs(s[0] - s[2]) < 1e-4 ? "v" : Math.abs(s[1] - s[3]) < 1e-4 ? "h" : "o"; }
function lo(s: Seg): Pt { return [Math.min(s[0], s[2]), Math.min(s[1], s[3])]; }

export interface Fit { score: number; reverse: number; k: number; dx: number; dy: number; misses: string[] }

export function scoreSpec(spec: TuckBoxSpec, pdf: Seg[], lock?: { k: number; dx: number; dy: number }): Fit {
  const d = generateTuckBox(spec);
  const gen: Seg[] = flatten(d).map((f) => [f.a[0], f.a[1], f.b[0], f.b[1]]);
  const idx = new Index(pdf);
  const tryAt = (k: number, dx: number, dy: number) => {
    let hit = 0, tot = 0; const miss: string[] = [];
    for (const g of gen) {
      const s = shift(rot(g, k), dx, dy); let h = 0; const pts = samples(s);
      for (const p of pts) { tot++; if (idx.near(p[0], p[1])) { hit++; h++; } }
      if (h < pts.length * 0.6 && len(g) > 0.1) miss.push(`${orient(g)} ${len(g).toFixed(3)} @(${g[0].toFixed(2)},${g[1].toFixed(2)})`);
    }
    return { score: hit / tot, miss };
  };
  let best: Fit = { score: -1, reverse: 0, k: 0, dx: 0, dy: 0, misses: [] };
  if (lock) { const r = tryAt(lock.k, lock.dx, lock.dy); best = { ...lock, score: r.score, reverse: 0, misses: r.miss }; }
  else {
    // anchors: long generated lines against die lines of the same length and orientation
    const anchors = gen.filter((g) => len(g) >= 1.0 && orient(g) !== "o");
    for (let k = 0; k < 4; k++) {
      const seen = new Set<string>();
      for (const a of anchors) {
        const ra = rot(a, k); const oa = orient(ra); const la = len(ra);
        for (const p of pdf) {
          if (orient(p) !== oa || Math.abs(len(p) - la) > 0.01) continue;
          const [ax, ay] = lo(ra), [px, py] = lo(p);
          const dx = Math.round((px - ax) * 200) / 200, dy = Math.round((py - ay) * 200) / 200;
          const key = `${dx},${dy}`; if (seen.has(key)) continue; seen.add(key);
          const r = tryAt(k, dx, dy);
          if (r.score > best.score) best = { score: r.score, reverse: 0, k, dx, dy, misses: r.miss };
        }
      }
    }
  }
  // reverse coverage: die lines inside the placed blank's bbox vs generated geometry
  const placed = gen.map((g) => shift(rot(g, best.k), best.dx, best.dy));
  const gi = new Index(placed);
  let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
  for (const s of placed) { bx0 = Math.min(bx0, s[0], s[2]); bx1 = Math.max(bx1, s[0], s[2]); by0 = Math.min(by0, s[1], s[3]); by1 = Math.max(by1, s[1], s[3]); }
  let rh = 0, rt = 0;
  for (const p of pdf) {
    if (Math.min(p[0], p[2]) < bx0 - TOL || Math.max(p[0], p[2]) > bx1 + TOL || Math.min(p[1], p[3]) < by0 - TOL || Math.max(p[1], p[3]) > by1 + TOL) continue;
    for (const q of samples(p)) { rt++; if (gi.near(q[0], q[1])) rh++; }
  }
  best.reverse = rt ? rh / rt : 0;
  return best;
}

function load(file: string): Seg[] {
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, "pdf-json", file + ".json"), "utf8"));
  return j.segs as Seg[];
}

export function runDie(die: Die, fit = false) {
  const pdf = load(die.file);
  const styles: ("STE" | "RTE")[] = die.style ? [die.style] : ["STE", "RTE"];
  let bestStyle: "STE" | "RTE" = styles[0], best: Fit | null = null;
  for (const style of styles) {
    const r = scoreSpec({ style, L: die.L, W: die.W, D: die.D }, pdf);
    if (!best || r.score > best.score) { best = r; bestStyle = style; }
  }
  const b = best!;
  const d = generateTuckBox({ style: bestStyle, L: die.L, W: die.W, D: die.D });
  let line = `${die.code.padEnd(12)} ${bestStyle} ${die.L}x${die.W}x${die.D}  match ${(b.score * 100).toFixed(1)}%  reverse ${(b.reverse * 100).toFixed(1)}%  rot ${b.k * 90}  flat ${d.flat.width.toFixed(3)}x${d.flat.height.toFixed(3)}  tuck ${d.spec.tuck} dust ${d.spec.dust}`;
  let fitted: { tuck: number; dust: number; score: number } | null = null;
  if (fit) {
    const lock = { k: b.k, dx: b.dx, dy: b.dy };
    let fb = { tuck: d.spec.tuck, dust: d.spec.dust, score: b.score };
    for (let t = 0.5; t <= 1.25 + 1e-9; t += 1 / 32) for (let h = 0.5; h <= die.W + 1e-9; h += 1 / 32) {
      try {
        const r = scoreSpec({ style: bestStyle, L: die.L, W: die.W, D: die.D, tuck: t, dust: h }, pdf, lock);
        if (r.score > fb.score + 1e-9) fb = { tuck: t, dust: h, score: r.score };
      } catch { /* dust too tall for panel */ }
    }
    fitted = fb;
    line += `\n${"".padEnd(12)} fitted: tuck ${fb.tuck.toFixed(4)} dust ${fb.dust.toFixed(4)} -> match ${(fb.score * 100).toFixed(1)}%`;
  }
  return { line, best: b, style: bestStyle, fitted };
}

if (require.main === module) {
  const arg = process.argv[2]; const fit = process.argv.includes("fit");
  const list = arg && arg !== "fit" ? DIES.filter((d) => d.code === arg) : DIES;
  for (const die of list) {
    const r = runDie(die, fit);
    console.log(r.line);
    if (arg && arg !== "fit") { console.log("  unmatched generated pieces:"); for (const m of r.best.misses.slice(0, 40)) console.log("   ", m); }
  }
}
