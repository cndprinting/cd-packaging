import { NextRequest, NextResponse } from "next/server";

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

  const first = pick("first");
  const last = pick("last");
  const nameField = pick("name");
  const contactName = [first, last].filter(Boolean).join(" ") || (nameField && !/company/i.test(nameField) ? nameField : "") || null;
  const company = pick("company", "business", "organization") || null;
  let email = pick("email") || null;
  if (!email) { const m = allText.match(EMAIL_RE); email = m ? m[0] : null; }
  const phone = pick("phone", "tel", "mobile") || null;

  const productField = pick("what type", "type of product", "product");
  const otherType = entries.filter(([k]) => /if other|describe|specify|please describe/i.test(k)).map(([, v]) => v).filter(Boolean).join(" · ");
  const quantity = pick("quantity", "qty") || null;
  const size = pick("size", "dimension");
  const color = pick("color", "colour");
  const finishing = pick("finishing", "additional print");
  const services = pick("services", "additional services");
  let artwork = pick("upload", "file", "artwork", "pdf");
  if (!artwork) { const u = allText.match(/https?:\/\/\S+\.(pdf|ai|eps|png|jpe?g|zip)/i); artwork = u ? u[0] : ""; }

  // Lane / product category from what they picked + any "other" text.
  const blob = `${productField} ${otherType}`.toLowerCase();
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

  const summary = [
    "Inbound web lead.",
    productField ? `Product: ${productField}${otherType ? ` · ${otherType}` : ""}` : null,
    quantity ? `Quantity: ${quantity}` : null,
    size ? `Size: ${size}` : null,
    color ? `Color: ${color}` : null,
    finishing ? `Finishing: ${finishing}` : null,
    services ? `Services: ${services}` : null,
    artwork ? `Artwork: ${artwork}` : "Artwork: none uploaded",
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
      priority: 3,                 // spec: posts as a priority-3 record
      stage: "New",                // agent status spine starts here
      pipelineStage: "LEAD",
      source: "inbound",
      volume: quantity,
      commentary: summary,
      intakeRaw: JSON.stringify(flat),
      lastInteraction: new Date(),
    },
  });

  // eslint-disable-next-line no-console
  console.log("[Godzilla INTAKE] new lead", lead.id, company, productCategory);
  return NextResponse.json({ ok: true, id: lead.id });
}

// A friendly GET so hitting the URL in a browser confirms it's live.
export async function GET() {
  return NextResponse.json({ ok: true, message: "C&D intake endpoint is live. Form submissions POST here." });
}
