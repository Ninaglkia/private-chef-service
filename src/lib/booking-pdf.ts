import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  appendBezierCurve,
  clip,
  endPath,
} from 'pdf-lib';

// A4 in PDF points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
// Same chef photo used in the branded emails (header avatar).
const CHEF_PHOTO_URL = 'https://ninos-privatechefs.com/images/chef.jpg';

export interface BookingRecapData {
  customer_name?: string | null;
  price_eur: number;
  recap: string;
  num_guests?: number | string | null;
  city?: string | null;
  event_address?: string | null;
  start_date?: string | null;
  payment_url?: string | null;
}

// pdf-lib's StandardFonts use WinAnsi encoding and THROW on characters they
// can't encode (emoji, exotic unicode — common when a recap is pasted from
// WhatsApp). Map the usual "smart" punctuation to ASCII and drop anything
// outside printable Latin-1 (keeping the euro sign) so generation never crashes.
function pdfSafe(s: unknown): string {
  return String(s ?? '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF€]/g, '');
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(test, size) > maxWidth) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// Best-effort fetch + embed of the chef photo. Returns null on any failure so
// the PDF still renders (with a text-only header) if the image is unreachable.
async function loadChefPhoto(doc: PDFDocument): Promise<PDFImage | null> {
  try {
    const resp = await fetch(CHEF_PHOTO_URL, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const u8 = new Uint8Array(await resp.arrayBuffer());
    if (u8[0] === 0xff && u8[1] === 0xd8) return await doc.embedJpg(u8); // JPEG
    if (u8[0] === 0x89 && u8[1] === 0x50) return await doc.embedPng(u8); // PNG
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a branded one-(or-more)-page PDF recap of a booking, returned as a
 * base64 attachment ready for Resend ({ filename, content }). The header mirrors
 * the transactional emails: dark band, round chef photo with a gold ring, and
 * the "Nino's Private Chef" wordmark.
 */
export async function generateBookingRecapPdf(
  data: BookingRecapData
): Promise<{ filename: string; content: string }> {
  const doc = await PDFDocument.create();
  doc.setTitle("Booking recap - Nino's Private Chef");
  doc.setAuthor("Nino's Private Chef");

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);

  const gold = rgb(0.776, 0.631, 0.357); // #c6a15b
  const ink = rgb(0.09, 0.075, 0.051);   // #17130d
  const white = rgb(1, 1, 1);
  const grey = rgb(0.42, 0.42, 0.42);
  const body = rgb(0.2, 0.2, 0.2);

  const chef = await loadChefPhoto(doc);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  const cx = PAGE_W / 2;
  const center = (s: string, y: number, size: number, font: PDFFont, color = ink) => {
    const t = pdfSafe(s);
    page.drawText(t, { x: cx - font.widthOfTextAtSize(t, size) / 2, y, size, font, color });
  };

  // ---------- Branded dark header (mirrors the email) ----------
  const HEADER_H = chef ? 184 : 132;
  page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: ink });

  let hy = PAGE_H - 56;
  if (chef) {
    const r = 30;
    const pcy = PAGE_H - 30 - r; // photo centre
    const k = 0.5523 * r;        // bezier circle constant
    page.pushOperators(
      pushGraphicsState(),
      moveTo(cx - r, pcy),
      appendBezierCurve(cx - r, pcy + k, cx - k, pcy + r, cx, pcy + r),
      appendBezierCurve(cx + k, pcy + r, cx + r, pcy + k, cx + r, pcy),
      appendBezierCurve(cx + r, pcy - k, cx + k, pcy - r, cx, pcy - r),
      appendBezierCurve(cx - k, pcy - r, cx - r, pcy - k, cx - r, pcy),
      clip(),
      endPath()
    );
    // object-fit: cover — scale so the smaller side fills the circle, centred.
    const scale = (2 * r) / Math.min(chef.width, chef.height);
    const dW = chef.width * scale;
    const dH = chef.height * scale;
    page.drawImage(chef, { x: cx - dW / 2, y: pcy - dH / 2, width: dW, height: dH });
    page.pushOperators(popGraphicsState());
    page.drawCircle({ x: cx, y: pcy, size: r, borderColor: gold, borderWidth: 2 });
    hy = pcy - r - 22;
  }

  center('PRIVATE CHEF AT HOME', hy, 9, helv, gold);
  hy -= 25;
  center("Nino's Private Chef", hy, 22, serif, white);
  hy -= 14;
  page.drawRectangle({ x: cx - 22, y: hy, width: 44, height: 1, color: gold });

  // ---------- Body ----------
  let y = PAGE_H - HEADER_H - 46;
  const ensure = (space: number) => {
    if (y - space < 80) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 64; }
  };
  const line = (s: string, x: number, size: number, font: PDFFont, color = ink) =>
    page.drawText(pdfSafe(s), { x, y, size, font, color });

  line('Your booking recap', MARGIN, 24, serif, ink);
  y -= 28;

  const name = pdfSafe(data.customer_name).trim();
  if (name) { line(`Prepared for ${name}`, MARGIN, 12, helv, grey); y -= 30; }

  // Detail rows (label in gold, value in ink; long values wrap).
  const priceFmt = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    Number.isFinite(data.price_eur) ? data.price_eur : 0
  );
  const rows: [string, string][] = [];
  if (data.start_date) rows.push(['When', String(data.start_date)]);
  if (data.num_guests) rows.push(['Guests', String(data.num_guests)]);
  if (data.city) rows.push(['Where', String(data.city)]);
  if (data.event_address) rows.push(['Address', String(data.event_address)]);
  rows.push(['Total', priceFmt]);

  for (const [label, value] of rows) {
    ensure(24);
    page.drawText(pdfSafe(label).toUpperCase(), { x: MARGIN, y, size: 9, font: bold, color: gold });
    const valLines = wrapText(pdfSafe(value), helv, 12, PAGE_W - MARGIN * 2 - 120);
    valLines.forEach((ln, i) => page.drawText(ln, { x: MARGIN + 120, y: y - i * 16, size: 12, font: helv, color: ink }));
    y -= Math.max(24, valLines.length * 16 + 8);
  }
  y -= 8;

  // What we agreed
  ensure(40);
  line('What we agreed', MARGIN, 13, bold, ink);
  y -= 22;
  for (const ln of wrapText(pdfSafe(data.recap).trim(), helv, 11, PAGE_W - MARGIN * 2)) {
    ensure(16);
    page.drawText(ln, { x: MARGIN, y, size: 11, font: helv, color: body });
    y -= 16;
  }

  // Confirm & pay (self-contained: the Stripe link printed in the PDF too)
  const payUrl = pdfSafe(data.payment_url).trim();
  if (payUrl) {
    y -= 18;
    ensure(60);
    line('Confirm & pay securely', MARGIN, 13, bold, ink);
    y -= 18;
    line('Complete your booking with the secure Stripe link below:', MARGIN, 10, helv, grey);
    y -= 18;
    for (const ln of wrapText(payUrl, helv, 11, PAGE_W - MARGIN * 2)) {
      ensure(16);
      page.drawText(ln, { x: MARGIN, y, size: 11, font: helv, color: rgb(0.13, 0.32, 0.66) });
      y -= 16;
    }
  }

  // Footer (drawn on whichever page is current/last)
  page.drawText("Nino's Private Chef  -  ninos-privatechefs.com", { x: MARGIN, y: 56, size: 9, font: helv, color: grey });
  page.drawText('Signature dining at home, Lombardy & beyond. All inclusive, as agreed in your proposal.', {
    x: MARGIN, y: 42, size: 8, font: helv, color: grey,
  });

  const bytes = await doc.save();
  const content = Buffer.from(bytes).toString('base64');
  const slug = (name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'client';
  return { filename: `booking-recap-${slug}.pdf`, content };
}
