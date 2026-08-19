import Anthropic from "@anthropic-ai/sdk";
import { BREVITY, AGENT_NAME } from "@/lib/agent/identity";

// Claude smart layer for the sales agent (Benjy 6/26). Classifies inbound
// leads, asserts house-standard specs for vague answers, and drafts the
// customer quote in C&D's voice. Gated on ANTHROPIC_API_KEY — every caller
// must handle a null return and fall back to the rule-based path.

const MODEL = "claude-opus-4-8";

export function getClaude(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try { return new Anthropic({ apiKey: key }); } catch { return null; }
}

function firstText(msg: any): string {
  const block = (msg.content || []).find((b: any) => b.type === "text");
  return block?.text || "";
}

export type IntakeEnrichment = {
  lane: "packaging" | "print" | "unclear";
  productCategory: string;
  normalizedProduct: string;
  assumptions: string[];   // "field → asserted house default" for vague/missing answers
  missing: string[];       // anything not given (incl. logistics) — for the brief
  canQuoteNow: boolean;    // Mary has enough to quote now (defaults cover the rest)
  quoteBlockers: string[]; // ONLY the specs that genuinely block a quote
  summary: string;         // clean recap for Mary, exact-where-given vs assumed
  vip: boolean;            // potentially a major/high-value client → owners review before quote
  vipReason: string;       // why (recognized brand, large company, high-volume potential)
  scamRisk: "low" | "medium" | "high"; // print/packaging fraud likelihood
  scamReason: string;      // why it looks suspicious
  notAQuote: boolean;      // NOT a genuine print/packaging inquiry (selling us a service, spam, misrouted)
  notAQuoteReason: string;
  existingRelationship: boolean;   // about a job/account C&D ALREADY produces → owners handle, not the agent
  existingRelationshipReason: string;
  corrugated: boolean;     // wants corrugated/fluted board — C&D does NOT do corrugated → propose a folding carton
  corrugatedReason: string;
};

// Classify lane + product, detect non-answers, assert house defaults. Returns
// null if no key or the call fails (caller falls back to rule-based parsing).
export async function enrichIntake(fields: Record<string, string>): Promise<IntakeEnrichment | null> {
  const client = getClaude();
  if (!client) return null;
  const dump = Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join("\n");
  const system = `You triage inbound print/packaging leads for C&D Printing & Packaging (St. Petersburg, FL — folding cartons, commercial print, mailers, labels, flexible/rigid packaging).
Classify the lane (packaging vs print) and product. If genuinely unclear, set lane "unclear".
A vague or low-confidence answer ("thick paper", "Regular", qty 1, an answer that describes the goal not a spec, design/artwork text in a spec field) is NOT a real spec — treat it as an assumption. Assert C&D house-standard defaults for vague terms (e.g. "thick" business card → 14pt C2S; "sturdy box" → 18pt SBS C1S board; "glossy" → gloss UV) and list each as "what they said → what we'll assume".
List anything the customer did not provide in "missing" (for the brief). Then decide if Mary can quote RIGHT NOW from what's given, treating sensible house defaults for anything optional. The specs that actually BLOCK a quote depend on product: for printed pieces (flyers, brochures, postcards) you need finished size, quantity, number of printed sides and ink/colors, and paper stock; for folding cartons you need the carton size/style (or enough to assume one), quantity, and board. Things that DO NOT block a quote — coating/finish, proof preference, folded-vs-flat when obvious, delivery address, and due date — assume house defaults and gather later. Put ONLY genuine quote-blockers in quoteBlockers; set canQuoteNow=true when quoteBlockers is empty. Example: a 50,000 qty, 8.5x11, full-color one-side, 100lb gloss flyer is quotable now (canQuoteNow=true, quoteBlockers=[]) even with no shipping address or date. Write a short summary for Mary that separates exact-where-given from assumed. Be concise.
Also judge whether this is potentially a MAJOR / high-value client worth an owner's eyes before any quote goes out. Set vip=true if the company is a recognizable national/global brand, a large company (many employees / multiple locations), part of a bigger parent/holding company, or the inquiry implies high volume or an ongoing program. Examples of vip=true: Lavazza, Integer Holdings, any Fortune-1000 or well-known consumer brand. Set vip=false for clearly small/local/one-off jobs. If unsure, lean false but say why in vipReason. Use what you know about the company from its name.
Also detect an EXISTING-RELATIONSHIP / account situation that the OWNERS must handle personally, not the agent. Set existingRelationship=true when the message indicates C&D ALREADY produces or prints the item in question (directly or through a contract/co-manufacturer), references an existing C&D customer/account by name, or is about taking over, transferring, or continuing a job we already make. Signals: "the boxes you currently do / already make / already print for us", "we are taking over manufacturing of a product you produce", "keep producing / continue the relationship", or naming a company C&D already works with. These are sensitive account matters worth real money — existingRelationship=true means hand to the owners immediately and do NOT run the normal quote flow (no spec questions, no Mary handoff). Set existingRelationship=true ONLY when the message explicitly says C&D already produces/prints something or names a company C&D works with. A third-party referral alone ("referred by FIS"), or someone reporting a server/portal error on some OTHER system, is NOT an existing relationship - if such a message never asks C&D to produce anything, it is notAQuote=true (misrouted), not existingRelationship. If it is a brand-new job with no existing-production reference, set false. Explain in existingRelationshipReason.
Also flag if the customer wants CORRUGATED / fluted board — E-flute, B-flute, C-flute, corrugated boxes, RSC shippers, or corrugated mailers. C&D does NOT make corrugated; we make folding cartons and paperboard. Set corrugated=true when the request is for a corrugated or fluted structure. A folding carton, SBS/paperboard box, or a printed piece is corrugated=false. Explain in corrugatedReason.
Also decide whether this is even a genuine request for US to print or make packaging. Set notAQuote=true when the sender is NOT trying to buy printing/packaging from us — for example they are trying to SELL us a product or service (cleaning, janitorial, marketing/SEO, staffing, software, freight, business-broker leads, insurance, consulting), it is a partnership or vendor pitch, spam, recruiting, or a clearly misrouted message - including someone reporting a technical problem with ANOTHER system (a portal/server error, a bank or credit-card application, an account login) who never asks us to print or produce anything. A real inquiry asks us to PRODUCE something (cartons, boxes, printed pieces, labels, mailers) and/or provides specs, quantities, or artwork. When the message is a solicitation aimed AT C&D rather than a request to buy our work, set notAQuote=true. Otherwise notAQuote=false. Explain in notAQuoteReason. This is separate from fraud — a legitimate cleaning company pitching us is notAQuote=true but scamRisk=low.
Also assess FRAUD risk — but DO NOT over-flag; losing a real customer is worse than passing a scam to owner review. A free/generic email (gmail, outlook, yahoo) is NOT by itself suspicious — many excellent, legitimate customers (founders, small brands, startups) use Gmail; treat it as at most a faint signal, never a reason on its own. Only raise scamRisk to medium/high when MULTIPLE genuine BEHAVIORAL fraud signals appear together: insisting on using THEIR OWN shipping carrier / freight forwarder; offering to overpay or pay by check/card above the invoice; extreme urgency + large order + push to prepay while showing no interest in the actual product; refusal or inability to discuss specs; incoherent or mismatched identity; or clearly templated/scam wording. Treat these as strong LEGITIMACY signals → scamRisk low: specific specs or finishes, questions about paper/dies/samples/proofs/PMS colors, mention of an NDA, a real brand or DBA, a real street address and phone, normal back-and-forth. When in doubt, choose low. Explain in scamReason.

Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{"lane":"packaging|print|unclear","productCategory":"Folding Carton|Commercial Print|Flexible Packaging|Packaging|Mailers","normalizedProduct":"string","assumptions":["what they said → what we'll assume"],"missing":["field"],"canQuoteNow":true|false,"quoteBlockers":["spec that blocks a quote"],"summary":"string","vip":true|false,"vipReason":"string","scamRisk":"low|medium|high","scamReason":"string","notAQuote":true|false,"notAQuoteReason":"string","existingRelationship":true|false,"existingRelationshipReason":"string","corrugated":true|false,"corrugatedReason":"string"}`;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: `Form submission:\n${dump}` }],
    });
    let txt = firstText(msg).trim();
    const m = txt.match(/\{[\s\S]*\}/);          // tolerate stray prose / fences
    if (m) txt = m[0];
    return JSON.parse(txt);
  } catch (e) {
    console.error("[agent] enrichIntake failed", e);
    return null;
  }
}

// Draft a short, friendly email to the customer asking for the missing specs
// we need before we can quote. House voice. Returns null on no key / failure.
export async function draftClarifyEmail(opts: { contactName?: string | null; productName: string; missing: string[]; assumptions?: string[]; agentName?: string }): Promise<string | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You write short emails for C&D Printing & Packaging asking a prospective customer for the details we need to quote their job. House voice: understated, warm, professional — no hype, no exclamation points, no emoji. Address the customer by their FIRST name only (never the full name). Open with a thank-you for reaching out. Ask ONLY for the genuinely missing items, phrased in plain language a non-printer understands (turn jargon into a friendly question — e.g. "dieline/style" → "what carton style you're after, like a straight or reverse tuck — or we can recommend one"). Group them as a short bullet list. If helpful, briefly note we can recommend a spec if they're not sure. Close by saying once we have these we'll turn a quote around quickly. Sign off with just the name "${opts.agentName || AGENT_NAME}" (a company signature block is appended automatically, so do not add the company name, address, phone, or website). Refer to the customer's company informally, the way a person would say it out loud - never include entity suffixes like LLC, Inc., Corp., or Co., and never include parenthetical abbreviations. Never use em dashes or en dashes (— –); use commas, periods, or parentheses instead, so it doesn't read as AI-written. Output ONLY the inner HTML body (<p>, <ul>, <li>, <strong>, <br>). Do not invent prices or commitments. If the customer asks about timing, our standard lead time is 2 to 3 weeks after we receive payment and final approval of the quote, and we can prioritize when they have a deadline.` + BREVITY;;
  const user = `Customer contact: ${opts.contactName || "there"}
Product: ${opts.productName}
Details still needed:
${opts.missing.map((m) => `- ${m}`).join("\n")}`;
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 1024, system, messages: [{ role: "user", content: user }] });
    const html = firstText(msg).trim();
    return html || null;
  } catch (e) {
    console.error("[agent] draftClarifyEmail failed", e);
    return null;
  }
}

// Merge a customer's reply (their answers to our questions) into an updated
// brief for Mary. Returns a short plain-text summary, or null on failure.
export async function mergeCustomerAnswers(opts: { productName: string; priorBrief: string; reply: string }): Promise<{ merged: string; quotable: boolean; reason: string } | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You process a customer's reply to our questions about a print/packaging job, for Mary the estimator. Do TWO things:

1) Decide if this reply is a GENUINE print or packaging quote request. Set "quotable": false when the sender is NOT actually seeking a printing/packaging quote - for example: they are trying to sell US a product or service (a vendor pitch, cold sales outreach, SaaS/agency/marketing offer), they say their message was misrouted or sent to the wrong place, they explicitly say they are not looking for a quote, or it is spam or recruiting. Otherwise set "quotable": true.
2) Produce a concise updated brief for Mary: fold the customer's confirmed specs in, drop assumptions they've overridden, and note anything still missing.

Output ONLY compact JSON, no markdown fences: {"quotable": true or false, "reason": "one short sentence", "brief": "the updated brief as plain text"}.`;
  const user = `Product: ${opts.productName}

Prior brief:
${opts.priorBrief}

Customer's reply:
${opts.reply}`;
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 1200, system, messages: [{ role: "user", content: user }] });
    const raw = firstText(msg).trim();
    try {
      const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/gi, "").replace(/^```\s*|\s*```$/g, "").trim());
      return { merged: String(p.brief || "").trim() || raw, quotable: p.quotable !== false, reason: String(p.reason || "").trim() };
    } catch {
      return { merged: raw, quotable: true, reason: "" }; // unparseable → proceed as before (never silently drop a real lead)
    }
  } catch (e) {
    console.error("[agent] mergeCustomerAnswers failed", e);
    return null;
  }
}

// Understand what Mary (the estimator) is actually SAYING in a reply — not just
// pattern-match for a price. "Too big for our equipment" or "this is corrugated"
// must stop the chase, not trigger another nudge (Benjy 7/14, No.1 Flowers).
export async function classifyMaryReply(opts: { company: string; reply: string }): Promise<{ kind: "quote" | "working" | "cannot_do" | "needs_from_customer"; reason: string; corrugated: boolean; otherBlocker: boolean } | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You read a reply from Mary, C&D Printing's estimator, about a quote request, and classify what she is saying. C&D makes folding cartons and commercial print; it does NOT make corrugated, and its presses have size limits. Categories:
- "quote": she gives pricing (dollar amounts / price and terms).
- "working": she is still working on it or waiting on someone (e.g. waiting on Todd for pricing) and has NOT ruled the job out.
- "cannot_do": she says C&D cannot produce the job as specified - too large for the equipment/presses, it is corrugated, wrong process, or any other hard capability blocker. Waiting-on-a-person is NOT cannot_do.
- "needs_from_customer": she needs something from the CUSTOMER to proceed (art file, dieline, physical sample, a spec confirmed).
Also: corrugated=true if part of the blocker is that the job is corrugated; otherBlocker=true if there is any hard blocker BESIDES corrugated (e.g. size too large). Output ONLY compact JSON, no fences: {"kind":"quote|working|cannot_do|needs_from_customer","reason":"one short plain-language sentence","corrugated":true|false,"otherBlocker":true|false}`;
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 250, system, messages: [{ role: "user", content: `Company: ${opts.company}

Mary's reply:
${(opts.reply || "").slice(0, 1500)}` }] });
    const raw = firstText(msg).trim().replace(/^```json\s*|\s*```$/gi, "");
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    const kind = ["quote", "working", "cannot_do", "needs_from_customer"].includes(p.kind) ? p.kind : "working";
    return { kind, reason: String(p.reason || "").trim(), corrugated: p.corrugated === true, otherBlocker: p.otherBlocker === true };
  } catch (e) { console.error("[agent] classifyMaryReply failed", e); return null; }
}

// After a quote goes out, decide if the customer's reply needs an owner or is
// just a benign acknowledgment the agent can answer itself (Benjy 7/19, Gino).
export async function classifyCustomerReply(opts: { company: string; reply: string }): Promise<{ kind: "benign" | "needs_owner"; reason: string } | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You classify a customer's reply to a quote we sent them. Output exactly one of:
- "benign": a positive or neutral acknowledgment that asks NOTHING and changes NOTHING - e.g. thanks, sounds good, price works, still deciding, waiting on a partner/agency, will get back to you. The agent can answer this with a warm acknowledgment.
- "needs_owner": ANYTHING else - a question, a price/quantity/spec change or negotiation, a go-ahead to place the order, a complaint, a deadline, or anything requiring human judgment. When unsure, choose needs_owner.
Output ONLY compact JSON, no fences: {"kind":"benign|needs_owner","reason":"one short sentence"}`;
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 150, system, messages: [{ role: "user", content: `Company: ${opts.company}

Reply:
${(opts.reply || "").slice(0, 1200)}` }] });
    const raw = firstText(msg).trim().replace(/^```json\s*|\s*```$/gi, "");
    const p = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);
    return { kind: p.kind === "benign" ? "benign" : "needs_owner", reason: String(p.reason || "").trim() };
  } catch (e) { console.error("[agent] classifyCustomerReply failed", e); return null; }
}

// Compare two incoming quote requests for the same company and decide whether
// they are the SAME job (a duplicate submission) or two genuinely different jobs.
// Errs toward "not a duplicate" when unsure so a real job is never dropped. (Benjy 7/2)
export async function isDuplicateQuote(opts: { a: string; b: string }): Promise<{ duplicate: boolean; reason: string } | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You compare two incoming quote requests to a print/packaging company from the same company/contact, and decide if they are the SAME job (a duplicate submission) or two DIFFERENT jobs. Compare product, specs, sizes, quantities, and intent. Treat them as the same job (duplicate) if they describe the same work, even when worded differently or one has less detail. Treat them as different when they are clearly separate projects (different product, different specs, a separate order). If you are genuinely unsure, answer NOT a duplicate, so a real job is never dropped. Output ONLY compact JSON, no markdown fences: {"duplicate": true or false, "reason": "one short sentence"}.`;
  const user = `Request A (already being quoted):\n${opts.a || "(no details)"}\n\nRequest B (new):\n${opts.b || "(no details)"}`;
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 300, system, messages: [{ role: "user", content: user }] });
    const raw = firstText(msg).trim();
    const p = JSON.parse(raw.replace(/^```json\s*|\s*```$/gi, "").replace(/^```\s*|\s*```$/g, "").trim());
    return { duplicate: p.duplicate === true, reason: String(p.reason || "").trim() };
  } catch (e) {
    console.error("[agent] isDuplicateQuote failed", e);
    return null; // caller treats null as "not sure" → proceed (don't drop a real job)
  }
}

// Read Mary's quote PDF and lay it out as a customer-facing pricing breakdown in
// C&D's house style (the Vivant format): warm intro, a per-item table of
// Quantity / Total Price / Price per Unit, the one-time die set-up line, a short
// close. Returns inner HTML, or null on failure. Benjy 6/29.
export async function draftQuoteBreakdown(opts: { pdfBase64: string; customerName: string; contactName?: string | null; productName?: string; agentName?: string }): Promise<string | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You write customer-facing quote emails for C&D Printing & Packaging in the owners' house style. You are given our estimator's quote as a PDF. Produce ONLY the inner HTML email body that presents the pricing as a clean breakdown, in this exact format:
- Open with the customer's FIRST name, then one warm line thanking them for the opportunity to quote and inviting feedback (we are happy to talk through any changes).
- For EACH item / SKU / option in the quote, put the item name in <b><u>bold underline</u></b>, then an HTML <table> with three column headers: Quantity, Total Price, Price per Unit, and one row per quantity tier. Right after each table, if there is a one-time die / tooling / plate / set-up charge, add an italic line like <i>One-time die set-up: $X (first order only)</i>.
- Add a short notes section: say shipping/freight is not included and, when it applies, that freight is being finalized and will follow separately; if the estimate lists payment terms such as a credit card surcharge, include that note; and add that standard lead time is 2 to 3 weeks after payment and final approval, and we can prioritize on a deadline. Then close with a brief friendly line inviting feedback.
- Sign off with just the name "${opts.agentName || AGENT_NAME}" (a company signature block is appended automatically).
HARD RULES: Use ONLY the figures in the PDF for Total Price, Quantity, and any charges, and never invent or alter them. The one exception: you MAY compute Price per Unit as Total Price divided by Quantity, rounded to the nearest cent, when the PDF does not list a per-unit price. If any other value is not in the PDF, leave it out. If there is a single quantity, show a single-row table. Give tables a light 1px border. Output ONLY inner HTML (<p>, <b>, <u>, <i>, <table>, <tr>, <th>, <td>, <br>) with no <html>/<head>. No markdown, no code fences. Refer to the customer's company informally, the way a person would say it out loud - never include entity suffixes like LLC, Inc., Corp., or Co., and never include parenthetical abbreviations. Never use em dashes or en dashes; use commas or periods.`;
  const user = `Customer: ${opts.customerName}${opts.contactName ? ` (contact: ${opts.contactName})` : ""}. Item/project: ${opts.productName || "their job"}. Our estimator's quote PDF is attached. Produce the customer-facing pricing breakdown email body now.`;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: opts.pdfBase64 } },
        { type: "text", text: user },
      ] as any }],
    });
    const html = firstText(msg).trim();
    return html || null;
  } catch (e) {
    console.error("[agent] draftQuoteBreakdown failed", e);
    return null;
  }
}

// Draft the customer-facing quote email body (HTML) in C&D's understated
// house voice, from Mary's price + terms. Returns null on no key / failure.
export async function draftCustomerQuote(opts: { customerName: string; contactName?: string | null; productName: string; quote: string; agentName?: string }): Promise<string | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You write customer-facing quote emails for C&D Printing & Packaging. House voice: understated, warm, professional, no hype, no exclamation points, no emoji. Short. Address the customer by their FIRST name only (never the full name). Open with a thank-you, present the price + terms clearly, offer to adjust quantities or specs, sign off with just the name "${opts.agentName || AGENT_NAME}" (a company signature block is appended automatically, so do not add the company name, address, phone, or website). Refer to the customer's company informally, the way a person would say it out loud - never include entity suffixes like LLC, Inc., Corp., or Co., and never include parenthetical abbreviations. Never use em dashes or en dashes (— –); use commas, periods, or parentheses instead, so it doesn't read as AI-written. Output ONLY the inner HTML body (no <html>/<head>), simple tags (<p>, <strong>, <br>). Do not invent prices or terms beyond what is given. If timing comes up, our standard lead time is 2 to 3 weeks after we receive payment and final approval of the quote, and we can prioritize when a customer has a deadline.` + BREVITY;;
  const user = `Customer: ${opts.customerName}${opts.contactName ? ` (contact: ${opts.contactName})` : ""}
Item: ${opts.productName}
Quote from our estimator (price + terms):
${opts.quote}`;
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    });
    const html = firstText(msg).trim();
    return html || null;
  } catch (e) {
    console.error("[agent] draftCustomerQuote failed", e);
    return null;
  }
}
