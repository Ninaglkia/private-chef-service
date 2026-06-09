import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

// A4 in PDF points.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;

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
// outside printable Latin-1 so generation never crashes on user text.
function pdfSafe(s: unknown): string {
  return String(s ?? '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    // Keep printable ASCII + Latin-1, plus the euro sign (WinAnsi supports it);
    // drop everything else (emoji, exotic unicode) so the font never throws.
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

/**
 * Build a branded one-(or-more)-page PDF recap of a booking, returned as a
 * base64 attachment ready for Resend ({ filename, content }).
 */
export async function generateBookingRecapPdf(
  data: BookingRecapData
): Promise<{ filename: string; content: string }> {
  const doc = await PDFDocument.create();
  doc.setTitle("Booking recap - Nino's Private Chef");
  doc.setAuthor("Nino's Private Chef");

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const gold = rgb(0.776, 0.631, 0.357); // #c6a15b
  const ink = rgb(0.09, 0.075, 0.051);   // #17130d
  const grey = rgb(0.42, 0.42, 0.42);
  const body = rgb(0.2, 0.2, 0.2);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - 64;
  const ensure = (space: number) => {
    if (y - space < 80) { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - 64; }
  };
  const line = (s: string, x: number, size: number, font: PDFFont, color = ink) =>
    page.drawText(pdfSafe(s), { x, y, size, font, color });

  // Brand header + gold rule
  line("NINO'S PRIVATE CHEF", MARGIN, 16, bold, ink);
  y -= 12;
  page.drawRectangle({ x: MARGIN, y, width: PAGE_W - MARGIN * 2, height: 2, color: gold });
  y -= 42;

  line('Your booking recap', MARGIN, 26, bold, ink);
  y -= 30;

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
  page.drawText('ninos-privatechefs.com', { x: MARGIN, y: 56, size: 9, font: helv, color: grey });
  page.drawText('Groceries are billed separately, at cost, and are not included in the total above.', {
    x: MARGIN, y: 42, size: 8, font: helv, color: grey,
  });

  const bytes = await doc.save();
  const content = Buffer.from(bytes).toString('base64');
  const slug = (name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'client';
  return { filename: `booking-recap-${slug}.pdf`, content };
}
