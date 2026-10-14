// Read the FACTS out of a customer's artwork file for the estimators (Benjy
// 10/14: "would it be able to infer information from the artwork?"). Exact
// things only -- page boxes, page count, named inks, dieline layers. Nothing
// is guessed; what a file can't say (quantity, stock, finish choice) stays a
// human question. Works on PDF (incl. PDF-compatible .ai); images give size only.
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFRef, PDFPage } from "pdf-lib";

export interface ArtworkFacts {
  kind: "pdf" | "image" | "unknown";
  fileName: string;
  pages: number;
  /** trim size in inches (TrimBox, else CropBox, else MediaBox), page 1 */
  trimWidthIn: number | null; trimHeightIn: number | null;
  /** full page (MediaBox) in inches */
  mediaWidthIn: number | null; mediaHeightIn: number | null;
  /** bleed beyond trim, inches per side (0 when none) */
  bleedIn: number | null;
  pagesSameSize: boolean;
  /** named separation / spot inks found across pages (deduped) */
  spotInks: string[];
  /** spot names that are finishing instructions, not ink */
  finishes: string[];
  usesProcess: boolean;      // DeviceCMYK / ICC seen
  usesRgb: boolean;          // DeviceRGB seen (a prepress flag)
  isDieline: boolean;        // dieline/cut/crease separations and no raster images
  imageCount: number;
  notes: string[];           // human-readable flags
}

const FINISH_RX = /foil|emboss|deboss|varnish|spot\s*uv|uv|coat|white|dieline|die\s*line|cut|crease|score|perf|glue|bleed|non[-\s]?print|registration|thru|through|kiss/i;
const DIELINE_RX = /dieline|die\s*line|cut|crease|score|die\b/i;
const pt = (v: number) => Math.round((v / 72) * 1000) / 1000;

function boxOf(page: PDFPage, name: "MediaBox" | "TrimBox" | "BleedBox" | "CropBox"): [number, number, number, number] | null {
  const dict = page.node;
  let node: any = dict.get(PDFName.of(name));
  // inherited boxes
  let parent: any = dict.get(PDFName.of("Parent"));
  const ctx = page.doc.context;
  while (!node && parent) { const p = ctx.lookup(parent) as PDFDict | undefined; if (!p) break; node = p.get(PDFName.of(name)); parent = p.get(PDFName.of("Parent")); }
  if (!node) return null;
  const arr = ctx.lookup(node) as PDFArray | undefined;
  if (!arr || arr.size() !== 4) return null;
  const n = arr.asArray().map((x: any) => Number((ctx.lookup(x) as any)?.asNumber?.() ?? (x as any).asNumber?.() ?? NaN));
  if (n.some((x) => isNaN(x))) return null;
  return [Math.min(n[0], n[2]), Math.min(n[1], n[3]), Math.max(n[0], n[2]), Math.max(n[1], n[3])];
}

function walkResources(ctx: any, res: PDFDict | undefined, out: { seps: Set<string>; cmyk: boolean; rgb: boolean; images: number }, seen: Set<string>, depth = 0) {
  if (!res || depth > 4) return;
  const cs = ctx.lookup(res.get(PDFName.of("ColorSpace"))) as PDFDict | undefined;
  if (cs) {
    for (const [, v] of cs.entries()) {
      const arr = ctx.lookup(v);
      const scan = (a: any) => {
        if (!a) return;
        if (a instanceof PDFArray) {
          const fam = a.get(0); const famName = (fam as any)?.decodeText?.() ?? String(fam);
          if (/Separation/.test(famName)) { const nm = ctx.lookup(a.get(1)); out.seps.add(String((nm as any)?.decodeText?.() ?? nm).replace(/^\//, "")); }
          else if (/DeviceN/.test(famName)) { const names = ctx.lookup(a.get(1)) as PDFArray; if (names?.asArray) for (const x of names.asArray()) out.seps.add(String((ctx.lookup(x) as any)?.decodeText?.() ?? x).replace(/^\//, "")); }
          else if (/DeviceCMYK|ICCBased/.test(famName)) out.cmyk = true;
          else if (/DeviceRGB|CalRGB/.test(famName)) out.rgb = true;
          // alternate spaces sit inside Separation/Indexed arrays
          if (a.size() > 2) { const alt = ctx.lookup(a.get(2)); if (alt instanceof PDFName) { const s = alt.decodeText(); if (/CMYK/.test(s)) out.cmyk = true; if (/RGB/.test(s)) out.rgb = true; } }
        } else if (a instanceof PDFName) { const s = a.decodeText(); if (/CMYK/.test(s)) out.cmyk = true; if (/RGB/.test(s)) out.rgb = true; }
      };
      scan(arr);
    }
  }
  const xo = ctx.lookup(res.get(PDFName.of("XObject"))) as PDFDict | undefined;
  if (xo) {
    for (const [, v] of xo.entries()) {
      const key = v instanceof PDFRef ? v.toString() : "";
      if (key && seen.has(key)) continue; if (key) seen.add(key);
      const x = ctx.lookup(v) as any;
      if (!x?.dict) continue;
      const sub = x.dict.get(PDFName.of("Subtype"));
      const subName = (sub as any)?.decodeText?.() ?? "";
      if (/Image/.test(subName)) {
        out.images++;
        const ics = ctx.lookup(x.dict.get(PDFName.of("ColorSpace")));
        const s = ics instanceof PDFName ? ics.decodeText() : (ics instanceof PDFArray ? String((ics.get(0) as any)?.decodeText?.()) : "");
        if (/CMYK|ICC/.test(s)) out.cmyk = true; if (/RGB/.test(s)) out.rgb = true;
      } else if (/Form/.test(subName)) {
        walkResources(ctx, ctx.lookup(x.dict.get(PDFName.of("Resources"))) as PDFDict | undefined, out, seen, depth + 1);
      }
    }
  }
}

export async function readArtwork(buf: Buffer, fileName: string): Promise<ArtworkFacts> {
  const base: ArtworkFacts = { kind: "unknown", fileName, pages: 0, trimWidthIn: null, trimHeightIn: null, mediaWidthIn: null, mediaHeightIn: null, bleedIn: null, pagesSameSize: true, spotInks: [], finishes: [], usesProcess: false, usesRgb: false, isDieline: false, imageCount: 0, notes: [] };
  const head = buf.subarray(0, 8).toString("latin1");
  if (/^\x89PNG/.test(head) || /^\xFF\xD8/.test(head) || /^GIF8/.test(head)) {
    const dims = imageDims(buf);
    return { ...base, kind: "image", pages: 1, notes: [dims ? `Raster image ${dims.w} x ${dims.h} px, no page size or inks to read. At 300 dpi that is ${(dims.w / 300).toFixed(2)} x ${(dims.h / 300).toFixed(2)} in.` : "Raster image, no page size or inks to read."] };
  }
  if (!/^%PDF/.test(head)) return { ...base, notes: ["Not a PDF or image, nothing to read. Ask for a print-ready PDF."] };
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;
  const pages = doc.getPages();
  const f: ArtworkFacts = { ...base, kind: "pdf", pages: pages.length };
  const acc = { seps: new Set<string>(), cmyk: false, rgb: false, images: 0 }; const seen = new Set<string>();
  let firstTrim: [number, number] | null = null;
  pages.forEach((p, i) => {
    const media = boxOf(p, "MediaBox"), trim = boxOf(p, "TrimBox") || boxOf(p, "CropBox") || media, bleed = boxOf(p, "BleedBox");
    if (i === 0 && media) { f.mediaWidthIn = pt(media[2] - media[0]); f.mediaHeightIn = pt(media[3] - media[1]); }
    if (trim) {
      const tw = pt(trim[2] - trim[0]), th = pt(trim[3] - trim[1]);
      if (i === 0) { f.trimWidthIn = tw; f.trimHeightIn = th; firstTrim = [tw, th]; }
      else if (firstTrim && (Math.abs(tw - firstTrim[0]) > 0.01 || Math.abs(th - firstTrim[1]) > 0.01)) f.pagesSameSize = false;
      if (i === 0) {
        const outer = bleed || media;
        if (outer) { const b = Math.min(trim[0] - outer[0], outer[2] - trim[2], trim[1] - outer[1], outer[3] - trim[3]); f.bleedIn = Math.max(0, pt(b)); }
      }
    }
    walkResources(ctx, ctx.lookup(p.node.get(PDFName.of("Resources"))) as PDFDict | undefined, acc, seen);
  });
  f.usesProcess = acc.cmyk; f.usesRgb = acc.rgb; f.imageCount = acc.images;
  const seps = [...acc.seps].filter((s) => s && !/^(All|None)$/i.test(s));
  f.finishes = seps.filter((s) => FINISH_RX.test(s));
  f.spotInks = seps.filter((s) => !FINISH_RX.test(s));
  f.isDieline = seps.some((s) => DIELINE_RX.test(s)) && acc.images === 0;
  // flags a human cares about
  if (!f.isDieline && f.trimWidthIn && f.mediaWidthIn && !f.bleedIn && Math.abs(f.mediaWidthIn - f.trimWidthIn) < 0.01) f.notes.push("No bleed in the file (trim equals page). Needs 1/8 in bleed if the design runs to the edge.");
  if (f.bleedIn && f.bleedIn > 0 && f.bleedIn < 0.12) f.notes.push(`Bleed is only ${f.bleedIn.toFixed(3)} in, we want 0.125 in.`);
  if (f.usesRgb) f.notes.push("RGB color found in the file. Prepress will convert; expect a color shift on bright colors.");
  if (!f.pagesSameSize) f.notes.push("Pages are not all the same size.");
  if (f.isDieline) f.notes.push(`This is a dieline (${seps.filter((s) => DIELINE_RX.test(s)).join(", ")}). The page size is the flat blank.`);
  if (f.spotInks.length) f.notes.push(`Spot inks: ${f.spotInks.join(", ")}. Each one is a plate on offset.`);
  if (f.finishes.filter((x) => !DIELINE_RX.test(x)).length) f.notes.push(`Finishing layers: ${f.finishes.filter((x) => !DIELINE_RX.test(x)).join(", ")}.`);
  if (!f.usesProcess && !f.spotInks.length && !f.isDieline) f.notes.push("No color space found, probably vector line art or text only.");
  return f;
}

function imageDims(buf: Buffer): { w: number; h: number } | null {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) { if (buf[i] !== 0xff) { i++; continue; } const m = buf[i + 1]; const len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }; i += 2 + len; }
  }
  return null;
}

/** One-paragraph text the estimator assistant can read like a human wrote it. */
export function artworkSummary(f: ArtworkFacts): string {
  if (f.kind !== "pdf") return `Artwork file "${f.fileName}": ${f.notes.join(" ")}`;
  const parts: string[] = [`Artwork file "${f.fileName}": ${f.pages} page${f.pages === 1 ? "" : "s"}`];
  if (f.trimWidthIn && f.trimHeightIn) parts.push(`${f.isDieline ? "flat blank" : "trim size"} ${f.trimWidthIn} x ${f.trimHeightIn} in`);
  if (f.bleedIn !== null) parts.push(f.bleedIn > 0 ? `${f.bleedIn.toFixed(3)} in bleed` : "no bleed");
  const inks: string[] = []; if (f.usesProcess) inks.push("4-color process"); if (f.spotInks.length) inks.push(`spot: ${f.spotInks.join(", ")}`);
  if (inks.length) parts.push(inks.join(" + "));
  if (f.finishes.length) parts.push(`finishing layers: ${f.finishes.join(", ")}`);
  if (f.imageCount) parts.push(`${f.imageCount} placed image${f.imageCount === 1 ? "" : "s"}`);
  return parts.join("; ") + "." + (f.notes.length ? " " + f.notes.join(" ") : "");
}
