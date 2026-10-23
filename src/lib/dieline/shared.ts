// Shared by the dieline API routes (Next.js route files may only export handlers).
import { STYLES, type CartonSpec, type CartonStyle } from "./carton";

export const parseSpec = (body: Record<string, unknown>): CartonSpec => {
  const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : Number(v); return Number.isFinite(n) && n > 0 ? n : undefined; };
  const style = STYLES.some((s) => s.code === body.style) ? (body.style as CartonStyle) : "STE";
  return {
    style, L: num(body.L) ?? 0, W: num(body.W) ?? 0, D: num(body.D) ?? 0,
    tuck: num(body.tuck), dust: num(body.dust), comp: num(body.comp), glue: num(body.glue),
    tuckPanel: body.tuckPanel === "near" ? "near" : "far",
  };
};

export interface DieMatch {
  id: string; dieNumber: string; customerName: string | null; item: string | null; description: string | null;
  length: number | null; width: number | null; height: number | null; dielineUrl: string | null; dielineName: string | null;
  delta?: number[]; maxDelta?: number;
}

/** Dies of about this box size, any dimension order. Returns exact (1/16") and near (within `near` inches per dimension, sorted closest first). */
export async function findDies(dims: [number, number, number], near = 1): Promise<{ exact: DieMatch[]; near: DieMatch[]; unsized: number }> {
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return { exact: [], near: [], unsized: 0 };
  const rows = await prisma.cuttingDie.findMany({
    where: { isActive: true, length: { not: null }, width: { not: null }, height: { not: null } },
    select: { id: true, dieNumber: true, customerName: true, item: true, description: true, length: true, width: true, height: true, dielineUrl: true, dielineName: true },
    take: 5000,
  });
  const unsized = await prisma.cuttingDie.count({ where: { isActive: true, OR: [{ length: null }, { width: null }, { height: null }] } });
  // best assignment of the die's three numbers to L/W/D (6 permutations), minimizing the largest gap
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const scored = rows.map((r) => {
    const d = [r.length as number, r.width as number, r.height as number];
    let best: number[] | null = null, bestMax = Infinity;
    for (const p of perms) {
      const delta = dims.map((v, i) => d[p[i]] - v);
      const mx = Math.max(...delta.map(Math.abs));
      if (mx < bestMax) { bestMax = mx; best = delta; }
    }
    return { ...r, delta: (best || []).map((v) => Math.round(v * 1000) / 1000), maxDelta: bestMax };
  });
  const exact = scored.filter((r) => r.maxDelta <= 1 / 16).slice(0, 25);
  const nearList = scored.filter((r) => r.maxDelta > 1 / 16 && r.maxDelta <= near).sort((a, b) => a.maxDelta - b.maxDelta).slice(0, 40);
  return { exact, near: nearList, unsized };
}

