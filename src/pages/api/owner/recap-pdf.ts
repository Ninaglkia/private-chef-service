import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { isOwnerEmail } from '../../../lib/admin';
import { generateBookingRecapPdf } from '../../../lib/booking-pdf';

export const prerender = false;

// Owner-only: build the branded booking-recap PDF from the /owner form fields,
// store it in the PRIVATE 'recaps' bucket and return a 30-day signed URL. Used
// by the WhatsApp button: wa.me links can only prefill TEXT, so the client gets
// the PDF as a tappable link instead of an attachment.
const BUCKET = 'recaps';
const SIGNED_URL_TTL_S = 30 * 24 * 60 * 60; // 30 days

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as { user?: { email?: string } | null }).user;
  if (!user || !isOwnerEmail(user.email)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const data = await request.json();
    const price_eur = Number(data.price_eur);
    const recap = String(data.recap || '').trim();
    if (!Number.isFinite(price_eur) || price_eur <= 0) return json({ error: 'A valid price is required.' }, 400);
    if (!recap) return json({ error: 'Add the recap first.' }, 400);

    const pdf = await generateBookingRecapPdf({
      customer_name: data.customer_name ?? null,
      price_eur,
      recap,
      num_guests: data.num_guests ?? null,
      city: data.city ?? null,
      event_address: data.event_address ?? null,
      start_date: data.start_date ?? null,
      payment_url: data.payment_url ?? null,
    });

    // Non-guessable object name; bucket is private so this is defense-in-depth.
    const rand = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const path = `bookings/recap_${rand}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, Buffer.from(pdf.content, 'base64'), { contentType: 'application/pdf', upsert: false });
    if (upErr) {
      console.error('Recap PDF upload failed:', upErr);
      return json({ error: 'Could not store the PDF.' }, 500);
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_S, { download: pdf.filename });
    if (signErr || !signed?.signedUrl) {
      console.error('Recap PDF sign failed:', signErr);
      return json({ error: 'Could not create the PDF link.' }, 500);
    }

    return json({ ok: true, url: signed.signedUrl }, 200);
  } catch (error) {
    console.error('recap-pdf error:', error);
    return json({ error: 'Failed to build the recap PDF.' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
