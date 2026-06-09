import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { isOwnerEmail } from '../../../lib/admin';
import { sendBookingConfirmationLinkEmail } from '../../../lib/email';
import { generateBookingRecapPdf } from '../../../lib/booking-pdf';

export const prerender = false;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// Owner-only: send the branded "confirm your booking" email with the Stripe
// payment link the owner created manually. The middleware resolves the signed-in
// user into locals.user from the access cookie; we additionally gate on the owner
// email allowlist (lib/admin.ts) so this can never be called by a normal user.
export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as { user?: { email?: string } | null }).user;
  if (!user || !isOwnerEmail(user.email)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const data = await request.json();
    const customer_name = String(data.customer_name || '').trim();
    const customer_email = String(data.customer_email || '').trim();
    const payment_url = String(data.payment_url || '').trim();
    const recap = String(data.recap || '').trim();
    const price_eur = Number(data.price_eur);
    const booking_id = data.booking_id ? String(data.booking_id) : null;

    if (!/^\S+@\S+\.\S+$/.test(customer_email)) return json({ error: 'A valid customer email is required.' }, 400);
    if (!/^https:\/\/\S+$/i.test(payment_url)) return json({ error: 'A valid https payment link is required.' }, 400);
    if (!Number.isFinite(price_eur) || price_eur <= 0) return json({ error: 'A valid price is required.' }, 400);
    if (!recap) return json({ error: 'Please add the recap of what you agreed.' }, 400);

    // Branded PDF recap of what the client booked, attached to the email.
    // Best-effort: a PDF failure must never block sending the confirmation.
    let attachments;
    try {
      const pdf = await generateBookingRecapPdf({
        customer_name,
        price_eur,
        recap,
        num_guests: data.num_guests ?? null,
        city: data.city ?? null,
        event_address: data.event_address ?? null,
        start_date: data.start_date ?? null,
        payment_url,
      });
      attachments = [pdf];
    } catch (pdfErr) {
      console.error('Booking recap PDF generation failed (sending email without it):', pdfErr);
    }

    await sendBookingConfirmationLinkEmail({
      customer_name,
      customer_email,
      payment_url,
      price_eur,
      recap,
      num_guests: data.num_guests ?? null,
      city: data.city ?? null,
      event_address: data.event_address ?? null,
      start_date: data.start_date ?? null,
      attachments,
    });

    // Best-effort: record the link + price on the booking so it shows as "link sent".
    if (booking_id) {
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          total_price: Math.round(price_eur * 100),
          payment_link_url: payment_url,
          link_sent_at: new Date().toISOString(),
        })
        .eq('id', booking_id);
      if (updateError) console.error('Booking update failed:', updateError);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('send-confirmation error:', error);
    return json({ error: 'Failed to send the confirmation.' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
