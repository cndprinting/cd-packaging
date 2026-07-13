import { NextRequest, NextResponse, after } from "next/server";
import { checkBlocked, isTestSubmission } from "@/lib/agent/blocklist";

// The website's Elementor webhook times out at ~5s. Give the background work
// (Claude analysis + agent emails) room to finish after we've already replied.
export const maxDuration = 60;

// Inbound web-form intake (Benjy 6/26). The website's Elementor form POSTs
// here (Webhook action). We parse tolerantly — collect every field, best-effort
// map the important ones, and stash the raw payload so nothing is ever lost —
// then drop a New inbound Lead into the pipeline. This is what stops leads from
// dying in an inbox.

// Flatten any body shape (JSON or form-encoded, incl. Elementor's
// form_fields[<id>] wrapper) into a flat {key: value} map.
async function readFlat(req: NextRequest): Promise<Record<string, string>> {
  const ct = req.headers.get("content-type") || "";
  const flat: Record<string, string> = {};
  const put = (k: string, v: any) => {
    if (v == null) return;
    const key = String(k).replace(/^form_fields\[(.+)\]$/, "$1").trim();
    const val = Array.isArray(v) ? v.join(", ") : String(v);
    if (val.trim()) flat[key] = val.trim();
  };
  try {
    if (ct.includes("application/json")) {
      const j = await req.json();
      const walk = (obj: any, prefix = "") => {
        if (obj && typeof obj === "object" && !Array.isArray(obj)) {
          for (const [k, v] of Object.entries(obj)) {
            if (v && typeof v === "object" && !Array.isArray(v)) walk(v, k);
            else put(prefix ? `${prefix}.${k}` : k, v);
          }
        }
      };
      walk(j);
    } else {
      const fd = await req.formData();
      for (const [k, v] of fd.entries()) put(k, typeof v === "string" ? v : (v as any).name);
    }
  } catch { /* ignore — return whatever we got */ }
  return flat;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export async function POST(req: NextRequest) {
  // Secret in the URL (?key=) when INTAKE_SECRET is set — keeps randoms from
  // spamming the pipeline. Public endpoint, so this matters once live.
  const secret = process.env.INTAKE_SECRET;
  if (secret && req.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

  const flat = await readFlat(req);
  const entries = Object.entries(flat);

  // Tolerant field-finders: match by key substring, fall back to value scan.
  const pick = (...subs: string[]) => {
    const hit = entries.find(([k]) => subs.some((s) => k.toLowerCase().includes(s)));
    return hit?.[1] || "";
  };
  const allText = entries.map(([k, v]) => `${k}: ${v}`).join("\n");

  const company = pick("company", "business", "organization") || null;
  const first = pick("first");
  const last = pick("last");
  // Prefer an explicit "contact"; else first+last; else any "name" key that
  // isn't the company name (fixes the marketing-materials form).
  const contactExplicit = entries.find(([k]) => /contact/i.test(k) && /name/i.test(k))?.[1] || "";
  const genericName = entries.find(([k]) => /name/i.test(k) && !/company|business|organization|form|user|first|last/i.test(k))?.[1] || "";
  const contactName = contactExplicit || [first, last].filter(Boolean).join(" ") || genericName || null;
  let email = pick("email") || null;
  if (!email) { const m = allText.match(EMAIL_RE); email = m ? m[0] : null; }
  const phone = pick("phone", "tel", "mobile") || null;

  // Habib's QA test submissions — drop silently, never a lead.
  if (isTestSubmission(email, contactName)) {
    console.log("[Godzilla INTAKE] ignored test submission from", email);
    return NextResponse.json({ ok: true, ignored: "test submission" });
  }

  // Empty / junk submission (blank form, bot POST, health-check) — nothing to
  // quote and no way to follow up. Drop it: no lead, never Mary. Benjy 7/7.
  const hasSubstance = !!(
    email || phone || company || contactName
    || pick("what type", "type of product", "product")
    || pick("looking for", "what are you", "message", "comments", "tell us", "details", "project", "describe")
    || pick("quantity", "qty") || pick("size", "dimension")
  );
  if (!hasSubstance) {
    console.log("[Godzilla INTAKE] ignored empty submission");
    return NextResponse.json({ ok: true, ignored: "empty submission" });
  }

  // Everything below runs AFTER the fast reply below (dedup + Claude analysis +
  // lead create + agent emails). Keeps the webhook well under its ~5s timeout so
  // the customer never sees a false "submission failed". Benjy 7/7.
  after(async () => {
   try {
  const productField = pick("what type", "type of product", "product");
  const otherType = entries.filter(([k]) => /if other|describe|specify|please describe/i.test(k)).map(([, v]) => v).filter(Boolean).join(" · ");
  const quantity = pick("quantity", "qty") || null;
  const size = pick("size", "dimension");
  const color = pick("color", "colour");
  const finishing = pick("finishing", "additional print");
  const services = pick("services", "additional services");
  // Free-text inquiry (the marketing-materials form's "What are you looking for?").
  const inquiry = pick("looking for", "what are you", "message", "comments", "tell us", "details", "project", "describe your");
  const sourceUrl = pick("page url", "source");
  let artwork = pick("upload", "file", "artwork", "pdf");
  if (!artwork) { const u = allText.match(/https?:\/\/\S+\.(pdf|ai|eps|png|jpe?g|zip)/i); artwork = u ? u[0] : ""; }

  // Lane / product category from what they picked + any "other" text + the
  // free-text inquiry (so the simpler form can still hint packaging vs print).
  const blob = `${productField} ${otherType} ${inquiry}`.toLowerCase();
  let productCategory = "Commercial Print";
  if (/mailer/.test(blob)) productCategory = "Mailers";
  else if (/folding|carton/.test(blob)) productCategory = "Folding Carton";
  else if (/flexible|pouch|film/.test(blob)) productCategory = "Flexible Packaging";
  else if (/box|rigid|corrugat|packag|label/.test(blob)) productCategory = "Packaging";

  // Dedup / triangulation — flag if this company is already known.
  let dupNote = "";
  if (company) {
    const [dl, dc] = await Promise.all([
      prisma.lead.findMany({ where: { companyName: { contains: company, mode: "insensitive" } }, select: { pipelineStage: true }, take: 3 }),
      prisma.company.findFirst({ where: { name: { contains: company, mode: "insensitive" } }, select: { id: true } }),
    ]);
    if (dc) dupNote = "⚠ Already an existing customer — check before re-quoting.";
    else if (dl.length) dupNote = `⚠ Already in the pipeline (${dl.map((x) => x.pipelineStage.toLowerCase()).join(", ")}) — possible duplicate.`;
  }

  // Smart layer (Claude, gated on ANTHROPIC_API_KEY) — classify + assert house
  // defaults + a Mary-ready recap. Falls back to the rule-based spec map.
  let claude: import("@/lib/agent/claude").IntakeEnrichment | null = null;
  try { const { enrichIntake } = await import("@/lib/agent/claude"); claude = await enrichIntake(flat); } catch { /* fall back */ }
  if (claude?.productCategory) productCategory = claude.productCategory;

  // Rule-based assertion (used when Claude isn't enabled).
  const { assertDefaults } = await import("@/lib/agent/spec-map");
  const isBizCard = /business\s*card/i.test(`${productField} ${otherType}`);
  const assumed = assertDefaults(productCategory, `${productField} ${otherType} ${size} ${color} ${finishing}`, isBizCard);

  // Potential major client (Claude judgment) → flag it loud and bump priority.
  const isVip = !!claude?.vip;
  const vipBanner = isVip ? `⭐ Potential major client - worth a closer look before this goes out. ${claude?.vipReason || ""}`.trim() : null;

  // Fraud guards: a hard blocklist hit, or Claude's scam-sniff at high risk →
  // the agent does NOT engage; the owners get alerted to decide.
  const blockedReason = checkBlocked({ name: contactName, email, phone, company });
  const scamHigh = claude?.scamRisk === "high";
  // Not a real print/packaging request (someone selling us a service, spam,
  // misrouted) → file to Lost, never engage. Benjy 7/2.
  const notAQuote = !!claude?.notAQuote;
  // About a job/account C&D already produces (directly or via a co-manufacturer,
  // e.g. Florida Nutrition) → owners handle it personally; the agent stays out of
  // the relationship. Benjy 7/6.
  const existingRel = !!claude?.existingRelationship && !blockedReason && !scamHigh && !notAQuote;
  const guardBanner = blockedReason
    ? `🚫 BLOCKED — ${blockedReason}. Agent will NOT engage.`
    : (scamHigh ? `⚠ POSSIBLE SCAM (${claude?.scamReason || "fraud signals"}) — agent paused; review before any contact.`
    : (notAQuote ? `🛈 NOT A QUOTE — ${claude?.notAQuoteReason || "a solicitation, not a print/packaging request"}. Filed to Lost; agent will not engage.`
    : (existingRel ? `🤝 EXISTING ACCOUNT — ${claude?.existingRelationshipReason || "about a job C&D already produces"}. Owners to handle directly; agent paused.` : null)));

  const summary = [
    guardBanner,
    vipBanner,
    "Inbound web lead.",
    inquiry ? `Looking for: ${inquiry}` : null,
    productField ? `Product: ${productField}${otherType ? ` · ${otherType}` : ""}` : null,
    quantity ? `Quantity: ${quantity}` : null,
    size ? `Size: ${size}` : null,
    color ? `Color: ${color}` : null,
    finishing ? `Finishing: ${finishing}` : null,
    services ? `Services: ${services}` : null,
    artwork ? `Artwork: ${artwork}` : "Artwork: none uploaded",
    // Prefer Claude's analysis; otherwise the rule-based assumptions.
    claude ? `\nNotes:\n${claude.summary}` : null,
    claude?.assumptions?.length ? `Assumed (confirm): ${claude.assumptions.join("; ")}` : (assumed.length ? `Assumed (confirm): ${assumed.map((a) => `${a.found} → ${a.assume}`).join("; ")}` : null),
    claude?.missing?.length ? `Missing: ${claude.missing.join("; ")}` : null,
    sourceUrl ? `From: ${sourceUrl}` : null,
    dupNote || null,
  ].filter(Boolean).join("\n");

  const lead = await prisma.lead.create({
    data: {
      companyName: company || contactName || "Web inquiry",
      productCategory,
      contactName,
      contactEmail: email,
      contactPhone: phone,
      website: null,
      priority: (isVip || existingRel) ? 1 : 3,     // major client / existing account → priority 1
      ownerName: "Jessica",        // agent-created leads belong to the agent (Jessica) until a human takes over (Benjy 7/13)
      agentStatus: blockedReason ? "blocked" : (scamHigh ? "needs_review" : (notAQuote ? "disqualified" : (existingRel ? "owner_handling" : null))), // guards park the lead so the agent never chases it
      stage: blockedReason ? "Blocked — flagged" : (scamHigh ? "Possible scam — review" : (notAQuote ? "Not a quote" : (existingRel ? "Existing account — owners handling" : "New"))),
      // Blocked/scam/solicitation → Lost. Existing-account inquiries STAY in the
      // funnel (they're valuable) but flagged for the owners; agent stays out. Benjy 7/2, 7/6.
      pipelineStage: (blockedReason || scamHigh || notAQuote) ? "LOST" : "LEAD",
      source: "inbound",
      volume: quantity,
      commentary: summary,
      intakeRaw: JSON.stringify(flat),
      lastInteraction: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log("[Godzilla INTAKE] new lead", lead.id, company, productCategory);

  // Fraud guard: blocked or high scam risk → the agent does NOT contact anyone.
  // Alert the owners so a human can decide if it's actually legit.
  if (blockedReason || scamHigh) {
    try {
      const { OWNERS, agentSend } = await import("@/lib/agent/agent");
      await agentSend({
        to: OWNERS,
        subject: `${blockedReason ? "🚫 Blocked lead" : "⚠ Possible scam"}: ${lead.companyName}`,
        body: `<p><strong>${lead.companyName}</strong>${contactName ? ` · ${contactName}` : ""}${email ? ` · ${email}` : ""}${phone ? ` · ${phone}` : ""}</p><p>${guardBanner}</p><p>The agent did <strong>not</strong> contact them and did not hand off to Mary. If you believe it's legitimate, follow up manually from the pipeline.</p>`,
      });
    } catch (e) { console.error("[Godzilla INTAKE] guard alert failed", e); }
    return NextResponse.json({ ok: true, id: lead.id, claudeOk: !!claude, blocked: !!blockedReason, scam: scamHigh });
  }

  // Not a real inquiry (a solicitation selling us a service, spam, misrouted) →
  // already filed to Lost above. Do NOT ask the customer or hand off to Mary.
  if (notAQuote) {
    console.log("[Godzilla INTAKE] not a quote — filed to Lost", lead.id, claude?.notAQuoteReason || "");
    return NextResponse.json({ ok: true, id: lead.id, claudeOk: !!claude, notAQuote: true });
  }

  // Existing account (we already produce this, directly or via a co-manufacturer)
  // → alert the owners ASAP and STOP. The agent never emails the contact or Mary;
  // owners own this relationship. Benjy 7/6.
  if (existingRel) {
    try {
      const { OWNERS, agentSend } = await import("@/lib/agent/agent");
      await agentSend({
        to: OWNERS,
        subject: `🤝 Existing account — needs you: ${lead.companyName}`,
        body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;"><p>This inquiry is about a job C&amp;D <strong>already produces</strong>, so I did not run the quote flow or contact them. <strong>Please reach out directly.</strong></p><p><strong>${lead.companyName}</strong>${contactName ? ` · ${contactName}` : ""}${email ? ` · ${email}` : ""}${phone ? ` · ${phone}` : ""}</p><p><strong>Why:</strong> ${claude?.existingRelationshipReason || "references an existing production relationship"}</p><p><strong>Their message:</strong><br>${(inquiry || "").replace(/</g, "&lt;") || "(see the lead)"}</p></div>`,
      });
    } catch (e) { console.error("[Godzilla INTAKE] existing-account alert failed", e); }
    console.log("[Godzilla INTAKE] existing account — owners alerted, agent paused", lead.id);
    return NextResponse.json({ ok: true, id: lead.id, claudeOk: !!claude, existingRelationship: true });
  }

  // Hand off to the sales agent — only when AGENT_ENABLED=true. If Claude found
  // genuinely missing specs and we have an email, the agent asks the CUSTOMER
  // for them first (then hands Mary a complete brief); otherwise it goes
  // straight to Mary with house defaults asserted.
  try {
    const { kickoffAgent, askCustomer, requestArtwork, suggestFoldingCarton } = await import("@/lib/agent/agent");
    const named = { ...lead, productName: claude?.normalizedProduct || productCategory };
    const artworkMissing = !artwork;
    const ARTWORK_ASK = "Your print-ready artwork (or a rough proof/mockup) so we can confirm the look and exact details";
    const blockers = claude?.quoteBlockers || [];
    // C&D does NOT do corrugated. If they asked for it, propose a heavier folding
    // carton and ask if that works, instead of quoting something we can't make.
    const wantsCorrugated = !!claude?.corrugated || /corrugat|e-?flute|b-?flute|c-?flute|\bflute\b|rsc box/i.test(`${productField} ${otherType} ${inquiry}`);
    if (wantsCorrugated && email) {
      await suggestFoldingCarton(prisma, named);
    } else if (blockers.length && email) {
      // Only quote-blocking specs make us WAIT on the customer. Artwork is always
      // asked for when missing, but it never blocks the quote.
      await askCustomer(prisma, named, artworkMissing ? [...blockers, ARTWORK_ASK] : blockers);
    } else {
      await kickoffAgent(prisma, named);              // quotable now → Mary
      if (artworkMissing && email) await requestArtwork(prisma, named); // ask artwork in parallel
    }
  } catch (e) { console.error("[Godzilla INTAKE] agent kickoff failed", e); }
   } catch (e) { console.error("[Godzilla INTAKE] background processing failed", e); }
  });

  // Instant 200 so the website form never shows a false "submission failed".
  return NextResponse.json({ ok: true });
}

// A friendly GET so hitting the URL in a browser confirms it's live.
export async function GET() {
  return NextResponse.json({ ok: true, message: "C&D intake endpoint is live. Form submissions POST here." });
}
