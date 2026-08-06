// Move the old single "commentary" blob onto the note timeline (Shimmie 8/6).
//
// The blob is a mix of hand-typed notes and machine lines the agent appended
// ("[Agent] ...", "[Follow-up] ...", "[Customer replied] ..."). Split on those
// markers so the history reads as separate entries instead of one wall of
// text, and label the machine ones as system notes.
//
// commentary itself is left untouched — it stays as the safety copy.
//   npx tsx scripts/migrate-lead-notes.ts --apply
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// Lines the machine wrote. Anything else is a person's note.
const MARKER = /^\[(Agent|Follow-up|Customer replied|Mary|Digest|Research[^\]]*|Outbound|No customer response[^\]]*)\]?/i;

function split(blob: string): { body: string; system: boolean }[] {
  const lines = blob.split(/\r?\n/);
  const out: { body: string; system: boolean }[] = [];
  let buf: string[] = [];
  let sys = false;
  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) out.push({ body, system: sys });
    buf = [];
  };
  for (const line of lines) {
    if (/^\s*\[/.test(line)) {           // a new bracketed entry starts here
      flush();
      sys = MARKER.test(line.trim());
    }
    buf.push(line);
  }
  flush();
  return out;
}

(async () => {
  const leads = await prisma.lead.findMany({
    where: { commentary: { not: null } },
    select: { id: true, companyName: true, commentary: true, createdAt: true, updatedAt: true },
  });

  let leadsDone = 0, notesMade = 0, skipped = 0;
  for (const l of leads) {
    const blob = (l.commentary || "").trim();
    if (!blob) continue;
    // Idempotent: never double-import a lead that already has imported notes.
    const already = await prisma.leadNote.count({ where: { leadId: l.id, source: "import" } });
    if (already) { skipped++; continue; }

    const parts = split(blob);
    if (!parts.length) continue;
    leadsDone++;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      notesMade++;
      if (!APPLY) continue;
      await prisma.leadNote.create({
        data: {
          leadId: l.id,
          body: p.body.slice(0, 8000),
          kind: p.system ? "system" : "human",
          source: "import",
          authorId: null,
          authorName: p.system ? "Jessica (AI)" : "Imported note",
          // Ordered within the lead, all dated to when the lead last moved —
          // the original per-line timestamps were never recorded.
          createdAt: new Date(l.updatedAt.getTime() - (parts.length - i) * 1000),
        },
      });
    }
  }

  console.log(`\n${leads.length} leads with notes`);
  console.log(`  migrated:        ${leadsDone}`);
  console.log(`  notes created:   ${notesMade}`);
  console.log(`  already done:    ${skipped}`);
  console.log(APPLY ? "\nApplied.\n" : "\nDRY RUN — re-run with --apply.\n");
  await prisma.$disconnect();
  await pool.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
