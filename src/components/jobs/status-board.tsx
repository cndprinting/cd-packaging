"use client";

// Status board (Mike Metroka 11/23/26): the plant-wide, one-row-per-job view he knows from
// XMF. Each step is a column with a check / clock / x / dash, and every column sorts like Excel.
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpDown, Check, Clock, X } from "lucide-react";

type Step = "y" | "w" | "n" | "d" | null;
export type BoardJob = {
  id: string; jobNumber: string; companyName: string; name: string; dueDate: string; isLate: boolean; tab: string; isTest?: boolean;
  board: { art: Step; preflight: Step; pdf: Step; hard: Step; paper: Step; die: Step; deposit: Step; press: string | null; shipped: Step; last: string | null } | null;
};
const RANK: Record<string, number> = { n: 0, w: 1, y: 2, d: 3 };
const STEPS: [keyof NonNullable<BoardJob["board"]>, string, string][] = [
  ["art", "Art in", "Print-ready art is in"], ["preflight", "Preflight", "Pre-press checked the files"], ["pdf", "PDF proof", "Clock = sent to the customer, waiting"],
  ["hard", "Hard proof", "Dash = PDF only"], ["paper", "Paper", "Clock = ordered, check = received or on hand"], ["die", "Die", "Check = existing die or received; clock = ordered; dash = no die"],
  ["deposit", "Deposit", "Dash = net 30 / COD"], ["shipped", "Shipped", "Clock = packed, ready to go"],
];
const icon = (s: Step) =>
  s === "y" ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="done" /> :
  s === "w" ? <Clock className="mx-auto h-4 w-4 text-amber-500" aria-label="in progress" /> :
  s === "n" ? <X className="mx-auto h-4 w-4 text-red-500" aria-label="not yet" /> :
  <span className="text-gray-300" aria-label="not needed">–</span>;
const ago = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso), h = (Date.now() - d.getTime()) / 3600e3;
  return h < 24 ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const day = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");

export function StatusBoard({ rows }: { rows: BoardJob[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: "last", dir: -1 });
  const sorted = useMemo(() => {
    const v = (j: BoardJob): string | number => {
      const b = j.board;
      if (sort.k === "job") return j.jobNumber; if (sort.k === "customer") return j.companyName.toLowerCase();
      if (sort.k === "due") return j.dueDate || "9999"; if (sort.k === "status") return j.tab;
      if (sort.k === "press") return b?.press || "zzz"; if (sort.k === "last") return b?.last || "";
      const s = b ? (b as any)[sort.k] : null; return s ? RANK[s] ?? 9 : 9;
    };
    return [...rows].sort((a, b) => { const x = v(a), y = v(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  }, [rows, sort]);
  const by = (k: string) => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : 1 }));
  const Th = ({ k, children, c, title }: { k: string; children: React.ReactNode; c?: boolean; title?: string }) => (
    <th title={title} className={`whitespace-nowrap px-2 py-2 text-xs font-medium uppercase tracking-wide text-gray-500 ${c ? "text-center" : "text-left"}`}>
      <button type="button" onClick={() => by(k)} className={`inline-flex items-center gap-1 hover:text-gray-800 ${sort.k === k ? "text-gray-900" : ""}`}>{children}<ArrowUpDown className="h-3 w-3" /></button>
    </th>
  );
  return (
    <div>
      <table className="w-full text-sm">
        <thead className="border-b border-gray-100 bg-gray-50/60"><tr>
          <Th k="job">Job #</Th><Th k="customer">Customer</Th><Th k="due">Due</Th><Th k="status">Status</Th>
          {STEPS.slice(0, 7).map(([k, l, t]) => <Th key={k} k={k} c title={t}>{l}</Th>)}
          <Th k="press" c>Press</Th><Th k="shipped" c title={STEPS[7][2]}>Shipped</Th><Th k="last">Last activity</Th>
        </tr></thead>
        <tbody>
          {sorted.map((j) => (
            <tr key={j.id} onClick={() => router.push(`/dashboard/jobs/${j.id}`)} className="cursor-pointer border-b border-gray-50 hover:bg-gray-50">
              <td className="whitespace-nowrap px-2 py-2"><Link href={`/dashboard/jobs/${j.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs font-medium text-brand-700 hover:underline">{j.jobNumber}</Link>{j.isTest && <span className="ml-1 rounded bg-yellow-300 px-1 text-[10px] font-bold text-yellow-900">TEST</span>}</td>
              <td className="max-w-[170px] truncate px-2 py-2 text-gray-800">{j.companyName}<div className="truncate text-xs text-gray-500">{j.name}</div></td>
              <td className={`whitespace-nowrap px-2 py-2 ${j.isLate ? "font-semibold text-red-600" : "text-gray-700"}`}>{day(j.dueDate)}</td>
              <td className="whitespace-nowrap px-2 py-2"><span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">{j.tab === "new" ? "New" : j.tab}</span></td>
              {j.board ? <>
                {STEPS.slice(0, 7).map(([k]) => <td key={k} className="px-2 py-2 text-center">{icon((j.board as any)[k])}</td>)}
                <td className="whitespace-nowrap px-2 py-2 text-center text-xs">{j.board.press ? <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{j.board.press}</span> : icon("n")}</td>
                <td className="px-2 py-2 text-center">{icon(j.board.shipped)}</td>
                <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-500">{ago(j.board.last)}</td>
              </> : <td colSpan={10} className="px-2 py-2 text-xs text-gray-400">Old test job (before go-live): no step tracking</td>}
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={14} className="py-12 text-center text-gray-400">No jobs match.</td></tr>}
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs text-gray-500"><Check className="inline h-3.5 w-3.5 text-emerald-600" /> done <Clock className="ml-2 inline h-3.5 w-3.5 text-amber-500" /> in progress <X className="ml-2 inline h-3.5 w-3.5 text-red-500" /> not yet <span className="ml-2 text-gray-400">–</span> not needed · Click a column to sort, a row to open the job.</p>
    </div>
  );
}
