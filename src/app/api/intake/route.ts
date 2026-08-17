import { NextRequest, NextResponse, after } from "next/server";
import { checkBlocked, isTestSubmission } from "@/lib/agent/blocklist";
import { sendEmail } from "@/lib/email/graph-client";

// Last-resort safety net (Benjy 8/11 — a real lead, Louis Hunt / LOUIS DELL LLC,
// silently vanished when the DB was over its Neon transfer cap and the intake
// write failed). If we ever CAN'T save an inbound lead, email the owners the
// raw form payload so it lands somewhere a human sees it and can key it in by
// hand — nothing inbound is ever lost silently again. Uses Graph mail directly,
// no DB, so it works even when the database is the thing that's down.
const DROP_ALERT_TO = ["bwaxman@cndprinting.com", "nlaor@cndprinting.com", "awaxman@cndprinting.com"];
async function alertDroppedLead(flat: Record<string, string>, reason: string) {
  try {
    const rows = Object.entries(flat)
      .map(([k, v]) => `<tr><td style="padding:2px 10px 2px 0;color:#666;">${k}</td><td style="padding:2px 0;">${String(v).replace(/</g, "&lt;")}</td></tr>`)
      .join("");
    await sendEmail({
      from: "bwaxman@cndprinting.com",
      to: DROP_ALERT_TO,
      subject: "⚠ Website lead could NOT be saved — key it in by hand",
      body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;">
        <p>A submission came in through the website form but Godzilla <strong>could not save it</strong> (${reason}). The full form is below so it isn't lost — add it to the pipeline manually, or send it to Claude to add.</p>
        <table style="border-collapse:collapse;font-size:13px;margin-top:8px;">${rows}</table>
        <p style="color:#aaa;font-size:11px;margin-top:16px;">Automated safety net from Godzilla intake.</p>
      </div>`,
    });
  } catch (e) { console.error("[Godzilla INTAKE] drop-alert email failed", e); }
}

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

  // Elementor's current webhook sends a STRUCTURED payload, not flat fields:
  //   fields[<id>][title] = "Company Name"   fields[<id>][value] = "SlashPie"
  //   meta[page_url][title] = "Page URL"     meta[page_url][value] = "https://…"
  // The old parser only knew the flat `form_fields[<id>]` shape, so on the real
  // form it read the field IDs ("name", "email") instead of the values — every
  // lead came in as garbage (company "name", email "email") and got deduped
  // away. That's why real leads silently vanished (Habib/Benjy 8/12). Rebuild
  // clean {label: value} pairs from the title/value halves so the field-finders
  // below match on the human labels.
  const titles: Record<string, string> = {};
  const values: Record<string, string> = {};
  let sawStructured = false;
  for (const [k, v] of Object.entries(flat)) {
    const m = k.match(/^(?:fields|meta)\[([^\]]+)\]\[(title|value|raw_value)\]$/);
    if (!m) continue;
    sawStructured = true;
    const [, id, part] = m;
    if (part === "title") titles[id] = v;
    else if (part === "value" || (part === "raw_value" && !values[id])) values[id] = v;
  }
  if (sawStructured) {
    // Drop the raw structured keys once consumed, otherwise `fields[email][id]`
    // ("email") still matches the field-finders BEFORE the clean "Email" label
    // and hands back the field id instead of the value.
    for (const k of Object.keys(flat)) {
      if (/^(?:fields|meta|form)\[/.test(k)) delete flat[k];
    }
    for (const id of Object.keys(titles)) {
      const label = titles[id];
      const val = values[id];
      if (label && val && val.trim()) flat[label] = val.trim(); // e.g. flat["Company Name"] = "SlashPie"
    }
  }
  return flat;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

// --- CRM cross-reference (Benjy 8/17) ----------------------------------------
// An inbound web lead that's already a CUSTOMER or a QUALIFIED prospect must not
// become a duplicate and must not get cold outreach. Match on email domain or a
// strict company-name comparison, then hand the warm inquiry to the owners.
const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "hotmail.com", "aol.com", "outlook.com", "icloud.com",
  "live.com", "msn.com", "comcast.net", "me.com", "proton.me", "protonmail.com",
  "sbcglobal.net", "att.net", "verizon.net", "ymail.com", "gmx.com",
]);
// Generic words that don't distinguish one company from another — never match on
// these alone (Benjy 8/13, the "labs"/"solutions" cross-filing mess).
const COMPANY_STOP = new Set([
  "inc", "llc", "ltd", "co", "corp", "corporation", "company", "group", "holdings",
  "the", "and", "of", "packaging", "print", "printing", "label", "labels", "labs",
  "lab", "pharma", "nutrition", "nutritional", "supplement", "supplements",
  "solutions", "brands", "brand", "products", "cosmetics", "beauty", "health",
  "wellness", "global", "international", "usa", "manufacturing", "industries",
  "enterprises", "services", "incorporated",
]);
function coTokens(s: string): string[] {
  return (s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()
    .split(/\s+/).filter((t) => t.length >= 3 && !COMPANY_STOP.has(t));
}
// Same company iff every distinctive token of the shorter name is in the other.
function companySame(a: string, b: string): boolean {
  const ta = coTokens(a), tb = coTokens(b);
  if (!ta.length || !tb.length) return false;
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const set = new Set(long);
  return short.every((t) => set.has(t));
}
async function findKnownAccount(prisma: any, company: string | null, email: string | null) {
  const domain = email && email.includes("@") ? email.split("@")[1].toLowerCase() : "";
  const usableDomain = domain && !GENERIC_EMAIL_DOMAINS.has(domain) ? domain : "";
  const probe = company ? coTokens(company).sort((a, b) => b.length - a.length)[0] : "";
  const or: any[] = [];
  if (probe) or.push({ companyName: { contains: probe, mode: "insensitive" } });
  if (usableDomain) or.push(
    { contactEmail: { contains: `@${usableDomain}`, mode: "insensitive" } },
    { contactEmail2: { contains: `@${usableDomain}`, mode: "insensitive" } },
  );
  if (!or.length) return null;
  const cands = await prisma.lead.findMany({
    where: { pipelineStage: { in: ["CUSTOMER", "QUALIFIED"] }, OR: or },
    select: { id: true, companyName: true, contactEmail: true, contactEmail2: true, pipelineStage: true, outreachStatus: true, commentary: true },
    take: 5,
  });
  for (const c of cands) {
    const domainHit = !!usableDomain && [c.contactEmail, c.contactEmail2].some((e: string | null) => (e || "").toLowerCase().endsWith(`@${usableDomain}`));
    const nameHit = !!company && companySame(company, c.companyName);
    if (domainHit || nameHit) return c;
  }
  return null;
}
// -----------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Secret in the URL (?key=) when INTAKE_SECRET is set — keeps randoms from
  // spamming the pipeline. Public endpoint, so this matters once live.
  const secret = process.env.INTAKE_SECRET;
  if (secret && req.nextUrl.searchParams.get("key") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // NOTHING heavy before the reply: no DB import, no parsing beyond the body.
  // The website's webhook gives up in a few seconds, and a cold serverless boot
  // + waking the Neon database was blowing past that — visitors saw "server
  // error" and retried (Laurel McKernan, 7/13). Everything now happens after.
  const flat = await readFlat(req);

  after(async () => {
   let leadSaved = false; // so the catch only alerts when the lead never landed
   try {
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) { console.error("[Godzilla INTAKE] database unavailable — payload:", JSON.stringify(flat)); await alertDroppedLead(flat, "database unavailable"); return; }

  const entries = Object.entries(flat);

  // Tolerant field-finders: match by key substring, fall back to value scan.
  const pick = (...subs: string[]) => {
    const hit = entries.find(([k]) => subs.some((s) => k.toLowerCase().includes(s)));
    return hit?.[1] || "";
  };
  const allText = entries.map(([k, v]) => `${k}: ${v}`).join(String.fromCharCode(10));

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
    return;
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
    return;
  }

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

  // Cross-reference the CRM FIRST (Benjy 8/17). If this inbound web lead is
  // already a CUSTOMER or a QUALIFIED prospect, it must not become a duplicate
  // and must not get cold outreach — it's warm, and the owners own it. Log the
  // inquiry on the existing record, stop any cold sequence, alert the owners,
  // and stop. This runs before Claude/lead-creation so we never spend a call or
  // create a second row for someone already in the pipeline (e.g. MedPak came
  // in via the contact form while already a qualified prospect).
  const known = await findKnownAccount(prisma, company, email);
  if (known) {
    const stageWord = known.pipelineStage === "CUSTOMER" ? "an existing customer" : "an existing qualified prospect";
    const logged = [
      known.commentary || "",
      "",
      `[Inbound ${new Date().toISOString().slice(0, 10)}] Same company came in through the website contact form — matched to this record (${stageWord}), so no duplicate was created and no cold outreach was sent.`,
      contactName || email ? `Contact: ${[contactName, email].filter(Boolean).join(" · ")}` : null,
      inquiry ? `Message: ${inquiry}` : null,
      productField ? `Product: ${productField}` : null,
    ].filter(Boolean).join(String.fromCharCode(10)).slice(0, 8000);
    const stopCold = known.outreachStatus && ["intro_sent", "followup_1", "followup_2"].includes(known.outreachStatus);
    await prisma.lead.update({
      where: { id: known.id },
      data: {
        commentary: logged,
        lastInteraction: new Date(),
        ...(stopCold ? { agentHold: true, outreachStatus: "replied", outreachNextAt: null } : {}),
      },
    });
    try {
      const { OWNERS, agentSend } = await import("@/lib/agent/agent");
      await agentSend({
        to: OWNERS,
        subject: `Known account inquired: ${known.companyName}`,
        body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;"><p><strong>${known.companyName}</strong> just came in through the website form. They're already ${stageWord} in the pipeline, so I did <strong>not</strong> create a duplicate or send any outreach — this is warm, please pick it up.</p><p>${[contactName, email, phone].filter(Boolean).join(" · ") || "(no contact details on the form)"}</p>${inquiry ? `<p><strong>Their message:</strong><br>${inquiry.replace(/</g, "&lt;")}</p>` : ""}</div>`,
      });
    } catch (e) { console.error("[Godzilla INTAKE] known-account alert failed", e); }
    leadSaved = true; // the inquiry is logged on the existing record; nothing else to save
    console.log("[Godzilla INTAKE] known account — deduped into", known.id, known.companyName);
    return NextResponse.json({ ok: true, id: known.id, known: true });
  }

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

  leadSaved = true; // the lead is safely in the DB; any later failure is non-fatal
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
   } catch (e) {
     console.error("[Godzilla INTAKE] background processing failed", e);
     // Only alert if the lead never landed. A failure AFTER the save (e.g. the
     // agent kickoff) means the lead is safe — no need to cry wolf (Benjy 8/11).
     if (!leadSaved) await alertDroppedLead(flat, `processing error: ${e instanceof Error ? e.message : "unknown"}`);
   }
  });

  // Instant 200 so the website form never shows a false "submission failed".
  return NextResponse.json({ ok: true });
}

// A friendly GET so hitting the URL in a browser confirms it's live.
export async function GET() {
  return NextResponse.json({ ok: true, message: "C&D intake endpoint is live. Form submissions POST here." });
}
