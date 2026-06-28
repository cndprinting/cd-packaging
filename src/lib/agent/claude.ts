import Anthropic from "@anthropic-ai/sdk";

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
  missing: string[];       // required fields the customer didn't give
  summary: string;         // clean recap for Mary, exact-where-given vs assumed
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
List required fields the customer did not provide. Write a short summary for Mary the estimator that clearly separates exact-where-given from assumed-where-inferred. Be concise.

Respond with ONLY a JSON object (no prose, no markdown fences) of exactly this shape:
{"lane":"packaging|print|unclear","productCategory":"Folding Carton|Commercial Print|Flexible Packaging|Packaging|Mailers","normalizedProduct":"string","assumptions":["what they said → what we'll assume"],"missing":["field"],"summary":"string"}`;
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
export async function draftClarifyEmail(opts: { contactName?: string | null; productName: string; missing: string[]; assumptions?: string[] }): Promise<string | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You write short emails for C&D Printing & Packaging asking a prospective customer for the details we need to quote their job. House voice: understated, warm, professional — no hype, no exclamation points, no emoji. Open with a thank-you for reaching out. Ask ONLY for the genuinely missing items, phrased in plain language a non-printer understands (turn jargon into a friendly question — e.g. "dieline/style" → "what carton style you're after, like a straight or reverse tuck — or we can recommend one"). Group them as a short bullet list. If helpful, briefly note we can recommend a spec if they're not sure. Close by saying once we have these we'll turn a quote around quickly. Sign off "C&D Printing & Packaging". Output ONLY the inner HTML body (<p>, <ul>, <li>, <strong>, <br>). Do not invent prices or commitments.`;
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
export async function mergeCustomerAnswers(opts: { productName: string; priorBrief: string; reply: string }): Promise<string | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You update a print/packaging job brief for Mary the estimator. You are given the prior brief (with assumptions) and the customer's reply answering our questions. Produce a concise, updated brief: fold the customer's answers in as confirmed specs, drop assumptions they've now overridden, and note anything still missing. Plain text, no markdown fences. Be brief.`;
  const user = `Product: ${opts.productName}

Prior brief:
${opts.priorBrief}

Customer's reply:
${opts.reply}`;
  try {
    const msg = await client.messages.create({ model: MODEL, max_tokens: 1024, system, messages: [{ role: "user", content: user }] });
    return firstText(msg).trim() || null;
  } catch (e) {
    console.error("[agent] mergeCustomerAnswers failed", e);
    return null;
  }
}

// Draft the customer-facing quote email body (HTML) in C&D's understated
// house voice, from Mary's price + terms. Returns null on no key / failure.
export async function draftCustomerQuote(opts: { customerName: string; contactName?: string | null; productName: string; quote: string }): Promise<string | null> {
  const client = getClaude();
  if (!client) return null;
  const system = `You write customer-facing quote emails for C&D Printing & Packaging. House voice: understated, warm, professional, no hype, no exclamation points, no emoji. Short. Open with a thank-you, present the price + terms clearly, offer to adjust quantities or specs, sign off as "C&D Printing & Packaging". Output ONLY the inner HTML body (no <html>/<head>), simple tags (<p>, <strong>, <br>). Do not invent prices or terms beyond what is given.`;
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
