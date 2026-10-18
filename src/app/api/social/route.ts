import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClaude } from "@/lib/agent/claude";

// Social media idea generator (Benjy 10/18). Owners-only. Three generators:
//   accounts - content concepts from recently won accounts in Godzilla
//   plan     - a 3-month posting plan for the four lines (cartons, pouches, print, mail)
//   trends   - a web scan for what packaging accounts are posting that works now
// Ideas are saved so the team can mark them planned / posted / dropped.
export const maxDuration = 300; // trend scan: web searches took >120s on 10/18

const ALLOWED = ["bwaxman@cndprinting.com", "nlaor@cndprinting.com", "awaxman@cndprinting.com", "sjacoby@cndprinting.com"];
const BRAND = `C&D Printing & Packaging, St. Petersburg FL, since 1973. Folding cartons (two Komori presses, LED UV), the new C&D Flex line (HP Indigo 200K: pouches, sachets, stick packs, roll labels), commercial print, direct mail. Customers: supplement, skincare, coffee, food and pet brands, mostly Florida. Voice: understated, real plant footage, no hype, no emoji in copy. Never invent customer names, numbers or claims. Never use em dashes.`;

async function gate() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  if (!ALLOWED.includes(session.email.toLowerCase()) && session.role !== "OWNER") return { error: "Forbidden", status: 403 as const };
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  return { session, prisma };
}

export async function GET() {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const ideas = await g.prisma.socialIdea.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ ideas });
}

export async function PUT(request: NextRequest) {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json().catch(() => ({}));
  const status = ["new", "planned", "posted", "dropped"].includes(body.status) ? body.status : null;
  if (!body.id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
  const idea = await g.prisma.socialIdea.update({ where: { id: String(body.id) }, data: { status } });
  return NextResponse.json({ idea });
}

export async function POST(request: NextRequest) {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json().catch(() => ({}));
  const kind = ["accounts", "plan", "trends"].includes(body.kind) ? body.kind : "accounts";
  const claude = getClaude();
  if (!claude) return NextResponse.json({ error: "AI not configured" }, { status: 503 });

  let user = "";
  let system = `You are the social media idea engine for ${BRAND}\nReturn STRICT JSON only: {"ideas":[{"title":"...","body":"...","source":"..."}]}. 6 to 10 ideas. title under 70 chars. body = 2 to 4 sentences: the concept, the shot or format, the hook line, who is in it. source = the account, trend or URL it comes from.`;
  const tools: any[] = [];

  if (kind === "accounts") {
    const since = new Date(Date.now() - 120 * 86400e3);
    const won = await g.prisma.lead.findMany({ where: { pipelineStage: "CUSTOMER", updatedAt: { gte: since } }, orderBy: { updatedAt: "desc" }, take: 25, select: { companyName: true, endMarket: true, productCategory: true, city: true, state: true, summary: true, notes: { where: { kind: "human" }, orderBy: { createdAt: "desc" }, take: 2, select: { body: true } } } });
    if (!won.length) return NextResponse.json({ error: "No accounts moved to Existing customers in the last 120 days" }, { status: 400 });
    user = `Recently won or active accounts (do not post about any of them without the customer's OK; concepts should be pitchable to the customer or anonymized):\n` + won.map((w) => `- ${w.companyName} (${[w.endMarket, w.productCategory, [w.city, w.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")})${w.summary ? ` — ${w.summary.slice(0, 240)}` : ""}${w.notes[0] ? ` — note: ${w.notes[0].body.slice(0, 160)}` : ""}`).join("\n") + `\n\nGive content concepts built around these accounts: in-plant shoots with the customer, unboxing their cartons or pouches, before/after packaging, founder interviews, "how it's made" of their product's box. Mark which need customer sign-off.`;
  } else if (kind === "plan") {
    const start = body.start || new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
    system = `You plan social media for ${BRAND}\nReturn STRICT JSON only: {"ideas":[{"title":"Week N: ...","body":"...","source":"plan"}]}. Produce a 3-month plan starting ${start}: 12 weekly entries (title "Week 1: ..." through "Week 12: ..."), each body = 3 to 4 posts for that week (platform, format, hook, who films it) across Instagram, LinkedIn and TikTok, rotating the four lines with pouches/stick packs/sachets featured at least every other week as the new line. Keep it filmable by a 4-person sales team with a phone.`;
    user = body.notes ? `Owner notes to work in: ${String(body.notes).slice(0, 1500)}` : "No extra notes.";
  } else {
    // trends: web search over public pages (Instagram/TikTok block scraping; this reads what is public)
    tools.push({ type: "web_search_20260209", name: "web_search", max_uses: 5 });
    system = `You research what packaging and print companies are posting that performs well right now, then turn it into ideas for ${BRAND}\nUse web search (packaging Instagram/TikTok accounts, "packaging unboxing" trends, print shop behind-the-scenes formats, satisfying die-cutting/gluer clips, pouch filling videos). Cite the page you saw each idea on. Return STRICT JSON only after researching: {"ideas":[{"title":"...","body":"...","source":"https://..."}]}. 6 to 10 ideas, each adapted to C&D's floor (Komori, die cutter, Kluge folder-gluer, HP Indigo, pouch machine).`;
    user = `Today is ${new Date().toISOString().slice(0, 10)}. Find current, specific examples, not generic advice.${body.notes ? ` Focus: ${String(body.notes).slice(0, 400)}` : ""}`;
  }

  try {
    let text = "";
    if (tools.length) {
      // Two steps (10/18): web research can end on pause_turn or with prose + citations,
      // so research first, then a plain call turns the findings into JSON.
      const msgs: any[] = [{ role: "user", content: user }];
      let research = "";
      for (let i = 0; i < 4; i++) {
        const r: any = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 4000, system, tools, messages: msgs });
        research += r.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n") + "\n";
        if (r.stop_reason === "pause_turn") { msgs.push({ role: "assistant", content: r.content }); continue; }
        break;
      }
      console.log("[social] trends research chars", research.length);
      const f: any = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 3000, system: `Convert research notes into STRICT JSON only: {"ideas":[{"title":"...","body":"...","source":"https://..."}]}. 6 to 10 ideas for ${BRAND} Keep every URL from the notes as the source of the idea it supports. No prose outside the JSON.`, messages: [{ role: "user", content: research.slice(0, 20000) || "No research came back; write 6 ideas from what packaging accounts typically post, source = 'general'." }] });
      text = f.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    } else {
      const r = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 3000, system, messages: [{ role: "user", content: user }] });
      text = r.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n");
    }
    const m = text.match(/\{[\s\S]*"ideas"[\s\S]*\}/);
    if (!m) { console.error("[social] no JSON", kind, text.slice(0, 400)); return NextResponse.json({ error: "No ideas came back, try again" }, { status: 502 }); }
    const parsed = JSON.parse(m[0]);
    const ideas = (parsed.ideas || []).slice(0, 12).map((i: any) => ({ kind, title: String(i.title || "").slice(0, 120), body: String(i.body || "").slice(0, 2000), source: i.source ? String(i.source).slice(0, 300) : null, createdBy: g.session.name || g.session.email }));
    if (!ideas.length) return NextResponse.json({ error: "No ideas came back, try again" }, { status: 502 });
    await g.prisma.socialIdea.createMany({ data: ideas });
    const all = await g.prisma.socialIdea.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    return NextResponse.json({ ideas: all, added: ideas.length });
  } catch (e) {
    console.error("[social]", (e as Error).message);
    return NextResponse.json({ error: "Generation failed: " + (e as Error).message.slice(0, 160) }, { status: 502 });
  }
}
