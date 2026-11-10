import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
const prisma = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })) });
async function main() {
  const l: any = await prisma.lead.findFirst({ where: { companyName: { contains: "mpamama", mode: "insensitive" } }, include: { emails: { orderBy: { sentAt: "desc" }, take: 2 } } as any });
  console.log("status", l.agentStatus, "next", l.agentNextAt, "stage", l.stage);
  console.log("log", JSON.parse(l.agentLog).slice(-3).map((x: any) => x.at.slice(0, 16) + " " + x.event).join(" | "));
  for (const e of l.emails) console.log("EMAIL", e.sentAt.toISOString().slice(0, 16), e.direction, "->", e.toAddr, "::", e.bodyText.replace(/\s+/g, " ").slice(0, 300));
}
main().finally(() => prisma.$disconnect());
