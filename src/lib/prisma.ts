import { PrismaClient } from "@/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | null };

// Machine-written note markers. The agent appends lines like
// "[Agent] Customer asked for corrugated…" to lead.commentary in 22 different
// places; anything starting with one of these is activity, not a rep's note.
const SYSTEM_MARKER = /^\s*\[(Agent|Follow-up|Customer replied|Mary|Digest|Outbound|Research)/i;

// Mirror commentary appends onto the note timeline (Benjy 8/6, decision 1:
// "the agent writes into the timeline too").
//
// Done here rather than at each of the 22 call sites: one place to be correct,
// and any future agent code that appends to commentary lands in the timeline
// automatically instead of quietly creating a second history. commentary stays
// as written — it remains the safety copy.
function withNoteMirror(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      lead: {
        async update({ args, query }) {
          const next = (args.data as any)?.commentary;
          // Only plain-string appends. Prisma atomic ops ({ set: … }) and
          // clears are left alone.
          if (typeof next !== "string" || !next.trim()) return query(args);
          let previous = "";
          try {
            const before = await client.lead.findUnique({ where: args.where as any, select: { commentary: true } });
            previous = before?.commentary || "";
          } catch { /* fall through — a missing read must not block the update */ }

          const result = await query(args);

          // The delta is what this write actually added. If commentary was
          // rewritten wholesale rather than appended, skip: we can't tell what
          // is new, and a duplicate note is worse than a missing one.
          if (!next.startsWith(previous)) return result;
          const added = next.slice(previous.length).trim();
          if (!added) return result;

          try {
            const leadId = (result as any)?.id;
            if (!leadId) return result;
            await client.leadNote.create({
              data: {
                leadId,
                body: added.slice(0, 8000),
                kind: SYSTEM_MARKER.test(added) ? "system" : "human",
                source: "agent",
                authorName: SYSTEM_MARKER.test(added) ? "Jessica (AI)" : "Godzilla",
              },
            });
          } catch (e) {
            // Never let note-keeping break the agent's actual work.
            console.error("[prisma] note mirror failed", e);
          }
          return result;
        },
      },
    },
  }) as unknown as PrismaClient;
}

function createPrismaClient(): PrismaClient | null {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("user:password")) return null;
  try {
    const pool = new pg.Pool({ connectionString: url });
    const adapter = new PrismaPg(pool);
    return withNoteMirror(new PrismaClient({ adapter }));
  } catch (e) {
    console.warn("Could not initialize PrismaClient:", e);
    return null;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production" && prisma) globalForPrisma.prisma = prisma;
export default prisma;
