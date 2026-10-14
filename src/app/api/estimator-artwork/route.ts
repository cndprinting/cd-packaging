import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readArtwork, artworkSummary } from "@/lib/artwork-read";

export const maxDuration = 60;

// Artwork facts for the estimators (Benjy 10/14). The browser uploads the
// file straight to Blob (src/lib/upload-client), then posts the URL here.
// Returns exact facts from the file plus the fields they can fill.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const url = String(body.url || "");
  const name = String(body.name || url.split("/").pop() || "artwork");
  if (!/^https:\/\/[a-z0-9.-]+\.public\.blob\.vercel-storage\.com\//i.test(url) && !/^https:\/\/packaging\.cndprinting\.com\//.test(url)) {
    return NextResponse.json({ error: "Upload the file first" }, { status: 400 });
  }
  try {
    const r = await fetch(url);
    if (!r.ok) return NextResponse.json({ error: `Could not read the file (${r.status})` }, { status: 400 });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 80 * 1024 * 1024) return NextResponse.json({ error: "File over 80 MB, too big to read here" }, { status: 400 });
    const facts = await readArtwork(buf, name);
    // What the classic estimator can take straight from the file
    const classic: Record<string, number> = {};
    if (facts.kind === "pdf" && facts.trimWidthIn && facts.trimHeightIn) {
      if (facts.isDieline) { classic.flatWidthIn = facts.trimWidthIn; classic.flatHeightIn = facts.trimHeightIn; }
      else { classic.finishedWidthIn = facts.trimWidthIn; classic.finishedHeightIn = facts.trimHeightIn; if (facts.pages <= 2) { classic.flatWidthIn = facts.trimWidthIn; classic.flatHeightIn = facts.trimHeightIn; } }
      if (facts.pages > 1 && facts.pagesSameSize) classic.numPages = facts.pages;
    }
    const flex: Record<string, number> = {};
    if (facts.kind === "pdf") {
      flex.colorsCmyovg = facts.usesProcess ? 4 : 0;
      flex.colorsWhite = facts.finishes.some((x) => /white/i.test(x)) ? 1 : 0;
      flex.colorsSpot = facts.spotInks.length;
    }
    return NextResponse.json({ facts, summary: artworkSummary(facts), classic, flex });
  } catch (e) {
    console.error("[estimator-artwork]", (e as Error).message);
    return NextResponse.json({ error: "Could not read that file. If it is a PDF, try re-saving it from Illustrator or Acrobat." }, { status: 400 });
  }
}
