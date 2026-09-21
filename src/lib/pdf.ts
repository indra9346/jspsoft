import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { DEFAULT_LOGO_PNG_BASE64 } from "@/lib/default-logo";

/**
 * Real, downloadable PDFs generated on the server (pdf-lib, pure JS — works on Vercel).
 * Text is navy/indigo, never black. The Swan logo is embedded when the school has no logo of its own.
 */
export interface PdfSchool {
  name: string; address: string; phone: string; email: string; website: string; principalName: string;
  primaryColor: string; logoData: string | null; signatureData: string | null;
}

const NAVY = rgb(0.2, 0.2, 0.49);
const SOFT = rgb(0.42, 0.43, 0.65);
const LINE = rgb(0.9, 0.89, 0.97);
const hexToRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };

function bytesFromDataUrl(d: string): { type: string; bytes: Uint8Array } | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(d);
  return m ? { type: m[1], bytes: Uint8Array.from(Buffer.from(m[2], "base64")) } : null;
}

async function embed(doc: PDFDocument, dataUrl: string | null, fallbackDefault: boolean): Promise<PDFImage | null> {
  if (dataUrl) {
    const d = bytesFromDataUrl(dataUrl);
    try {
      if (d?.type === "image/png") return await doc.embedPng(d.bytes);
      if (d?.type === "image/jpeg") return await doc.embedJpg(d.bytes);
    } catch { /* fall through to default */ }
  }
  return fallbackDefault ? doc.embedPng(Uint8Array.from(Buffer.from(DEFAULT_LOGO_PNG_BASE64, "base64"))) : null;
}

const safe = (font: PDFFont, s: unknown) =>
  [...String(s ?? "").replace(/₹/g, "Rs.").replace(/→/g, "->")].map((c) => { try { font.encodeText(c); return c; } catch { return "?"; } }).join("");

function fit(font: PDFFont, text: string, size: number, maxW: number) {
  let t = safe(font, text);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxW) t = t.slice(0, -1);
  return t + "...";
}

async function header(doc: PDFDocument, page: PDFPage, school: PdfSchool, title: string, fonts: { b: PDFFont; r: PDFFont }, y: number) {
  const { width } = page.getSize();
  const brand = hexToRgb(school.primaryColor);
  const logo = await embed(doc, school.logoData, true);
  let x = 40;
  if (logo) {
    const h = 46; const w = (logo.width / logo.height) * h;
    page.drawImage(logo, { x, y: y - h + 8, width: w, height: h }); x += w + 12;
  }
  page.drawText(safe(fonts.b, school.name), { x, y: y - 14, size: 18, font: fonts.b, color: NAVY });
  const sub = [school.address, school.phone, school.email, school.website].filter(Boolean).join("  |  ");
  page.drawText(fit(fonts.r, sub, 8, width - x - 200), { x, y: y - 28, size: 8, font: fonts.r, color: SOFT });
  const t = safe(fonts.b, title);
  const tw = fonts.b.widthOfTextAtSize(t, 11) + 20;
  page.drawRectangle({ x: width - 40 - tw, y: y - 22, width: tw, height: 22, color: brand });
  page.drawText(t, { x: width - 40 - tw + 10, y: y - 15, size: 11, font: fonts.b, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 40, y: y - 46, width: width - 80, height: 2, color: brand });
  return y - 62;
}

export interface ReportCardData {
  school: PdfSchool;
  student: { name: string; admissionNo: string; grade: string; section: string; roll: number; dob: string; guardian: string; classTeacher: string; year: string };
  exam: { name: string; maxInternal: number; maxTheory: number };
  subjects: { name: string; internal: number | null; theory: number | null; total: number | null; percent: number | null; grade: string; result: string }[];
  totals: { total: number; outOf: number; percent: number; grade: string; result: string; rank: string; attendance: string };
}

export async function reportCardPdf(d: ReportCardData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const r = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(d.school.primaryColor);
  let y = await header(doc, page, d.school, "REPORT CARD", { b, r }, 800);

  page.drawText(safe(b, `${d.exam.name}  -  Academic year ${d.student.year}`), { x: 40, y, size: 11, font: b, color: NAVY }); y -= 22;
  const info: [string, string][] = [["Student", d.student.name], ["Admission no.", d.student.admissionNo], ["Class", d.student.grade], ["Section", d.student.section], ["Roll no.", String(d.student.roll)], ["Date of birth", d.student.dob], ["Parent / guardian", d.student.guardian], ["Class teacher", d.student.classTeacher]];
  info.forEach(([k, v], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 40 + col * 260, yy = y - row * 18;
    page.drawText(safe(r, k), { x, y: yy, size: 9, font: r, color: SOFT });
    page.drawText(fit(b, v, 10, 150), { x: x + 95, y: yy, size: 10, font: b, color: NAVY });
    page.drawLine({ start: { x, y: yy - 4 }, end: { x: x + 240, y: yy - 4 }, thickness: 0.5, color: LINE });
  });
  y -= 4 * 18 + 18;

  const cols = [["Subject", 170, "left"], [`Internal /${d.exam.maxInternal}`, 80, "c"], [`Theory /${d.exam.maxTheory}`, 80, "c"], [`Total /${d.exam.maxInternal + d.exam.maxTheory}`, 80, "c"], ["%", 40, "c"], ["Grade", 40, "c"], ["Result", 45, "c"]] as const;
  let x = 40;
  page.drawRectangle({ x: 40, y: y - 6, width: 535, height: 22, color: rgb(0.97, 0.94, 0.99) });
  for (const [t, w, al] of cols) { const tx = al === "left" ? x + 6 : x + w / 2 - b.widthOfTextAtSize(safe(b, t), 8) / 2; page.drawText(safe(b, t), { x: tx, y: y, size: 8, font: b, color: SOFT }); x += w; }
  y -= 24;
  for (const s of d.subjects) {
    const cells = [s.name, s.internal ?? "-", s.theory ?? "-", s.total ?? "-", s.percent === null ? "-" : `${s.percent}%`, s.grade, s.result];
    x = 40;
    cols.forEach(([, w, al], i) => {
      const txt = fit(i === 0 || i === 3 ? b : r, String(cells[i]), 10, w - 8); const f = i === 0 || i === 3 ? b : r;
      const tx = al === "left" ? x + 6 : x + w / 2 - f.widthOfTextAtSize(txt, 10) / 2;
      page.drawText(txt, { x: tx, y, size: 10, font: f, color: NAVY }); x += w;
    });
    page.drawLine({ start: { x: 40, y: y - 6 }, end: { x: 575, y: y - 6 }, thickness: 0.5, color: LINE });
    y -= 22;
  }
  page.drawText("TOTAL", { x: 46, y, size: 10, font: b, color: NAVY });
  page.drawText(`${d.totals.total}/${d.totals.outOf}`, { x: 40 + 170 + 80 + 80 + 40 - b.widthOfTextAtSize(`${d.totals.total}/${d.totals.outOf}`, 10) / 2 + 5, y, size: 10, font: b, color: NAVY });
  page.drawText(`${d.totals.percent}%   ${d.totals.grade}   ${d.totals.result}`, { x: 40 + 170 + 240 + 6, y, size: 10, font: b, color: brand });
  y -= 34;

  const boxes = [["Percentage", `${d.totals.percent}%`], ["Grade", d.totals.grade], ["Class rank", d.totals.rank], ["Attendance", d.totals.attendance]];
  boxes.forEach(([k, v], i) => {
    const bx = 40 + i * 135;
    page.drawRectangle({ x: bx, y: y - 34, width: 125, height: 44, color: rgb(0.97, 0.94, 0.99) });
    page.drawText(safe(r, k), { x: bx + 10, y: y - 2, size: 8, font: r, color: SOFT });
    page.drawText(fit(b, v, 13, 105), { x: bx + 10, y: y - 22, size: 13, font: b, color: NAVY });
  });

  const sig = await embed(doc, d.school.signatureData, false);
  const sy = 110;
  page.drawLine({ start: { x: 40, y: sy }, end: { x: 190, y: sy }, thickness: 0.7, color: SOFT });
  page.drawText("Class teacher", { x: 40, y: sy - 12, size: 9, font: r, color: SOFT });
  if (sig) { const h = 36; const w = Math.min(140, (sig.width / sig.height) * h); page.drawImage(sig, { x: 575 - 150 + (150 - w) / 2, y: sy + 4, width: w, height: h }); }
  page.drawLine({ start: { x: 425, y: sy }, end: { x: 575, y: sy }, thickness: 0.7, color: SOFT });
  page.drawText(fit(r, `Principal${d.school.principalName ? " - " + d.school.principalName : ""}`, 9, 150), { x: 425, y: sy - 12, size: 9, font: r, color: SOFT });
  page.drawText("Authorized Signature", { x: 425, y: sy - 23, size: 8, font: r, color: SOFT });
  page.drawText("Generated by SwanSchoolERP - Swan Digital Solutions", { x: 190, y: 40, size: 8, font: r, color: SOFT });
  return doc.save();
}

export async function tablePdf(school: PdfSchool, title: string, columns: string[], rows: (string | number)[][], summary: { label: string; value: string | number }[] = []): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const r = await doc.embedFont(StandardFonts.Helvetica);
  const b = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, left = 40, usable = W - 80;
  const size = columns.length > 10 ? 7 : 8;
  // column widths proportional to the widest content (capped)
  const weight = columns.map((c, i) => Math.min(28, Math.max(c.length, ...rows.slice(0, 60).map((rw) => String(rw[i] ?? "").length), 4)));
  const totalW = weight.reduce((a, c) => a + c, 0);
  const widths = weight.map((w) => (w / totalW) * usable);

  let page = doc.addPage([W, H]);
  let y = await header(doc, page, school, "REPORT", { b, r }, H - 36);
  page.drawText(fit(b, title, 13, usable), { x: left, y, size: 13, font: b, color: NAVY }); y -= 16;
  if (summary.length) { page.drawText(fit(r, summary.map((s) => `${s.label}: ${s.value}`).join("   |   "), 9, usable), { x: left, y, size: 9, font: r, color: SOFT }); y -= 14; }
  y -= 4;
  const head = () => {
    page.drawRectangle({ x: left, y: y - 5, width: usable, height: 18, color: rgb(0.97, 0.94, 0.99) });
    let x = left; columns.forEach((c, i) => { page.drawText(fit(b, c, size, widths[i] - 6), { x: x + 3, y: y, size, font: b, color: SOFT }); x += widths[i]; });
    y -= 18;
  };
  head();
  let n = 1;
  for (const row of rows) {
    if (y < 50) {
      page.drawText(`SwanSchoolERP  -  page ${n}`, { x: left, y: 24, size: 7, font: r, color: SOFT });
      page = doc.addPage([W, H]); n++; y = H - 50; head();
    }
    let x = left; row.forEach((c, i) => { page.drawText(fit(r, String(c ?? ""), size, widths[i] - 6), { x: x + 3, y, size, font: r, color: NAVY }); x += widths[i]; });
    page.drawLine({ start: { x: left, y: y - 4 }, end: { x: left + usable, y: y - 4 }, thickness: 0.4, color: LINE });
    y -= 14;
  }
  page.drawText(`SwanSchoolERP  -  page ${n}  -  ${rows.length} rows`, { x: left, y: 24, size: 7, font: r, color: SOFT });
  return doc.save();
}
