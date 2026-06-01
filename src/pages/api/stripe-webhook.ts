import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendBookingConfirmationEmails } from '../../lib/email';
import { notifyOrganizer, notifyCustomer } from '../../lib/sms';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    return new Response('Webhook signature missing', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only act on actually-paid sessions.
    if (session.payment_status && session.payment_status !== 'paid') {
      return received();
    }

    const bookingId = session.metadata?.booking_id;
    if (!bookingId) {
      return received();
    }

    // Idempotent transition: only the pending -> confirmed move does the work.
    // A replayed/duplicate event matches 0 rows and becomes a no-op.
    const { data: updatedRows, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'confirmed',
        stripe_payment_intent: session.payment_intent as string,
      })
      .eq('id', bookingId)
      .eq('status', 'pending')
      .select('*');

    if (updateError) {
      console.error('Booking confirm update failed:', updateError);
      // 500 -> Stripe retries the webhook later.
      return new Response('Failed to update booking', { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      // Already processed (or not found) — nothing more to do.
      return received();
    }

    const booking = updatedRows[0];

    // Sanity check the amount actually paid vs the price we stored.
    if (
      session.amount_total != null &&
      booking.total_price != null &&
      session.amount_total !== booking.total_price
    ) {
      console.error(
        `Amount mismatch for booking ${bookingId}: paid ${session.amount_total}, expected ${booking.total_price}`
      );
    }

    // Notifications are best-effort: a failure here must not 500 the webhook.
    sendBookingConfirmationEmails(booking).catch((err) =>
      console.error('Email sending failed:', err)
    );

    const formattedPrice = new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format((booking.total_price || 0) / 100);
    const organizerMsg = `[NEW BOOKING] Paid - ${booking.customer_name}. ${formattedPrice}. ${booking.plan} • ${booking.city} • from ${booking.start_date}.`;
    notifyOrganizer(organizerMsg).catch((err) =>
      console.error('Organizer SMS failed:', err)
    );

    if (booking.customer_phone) {
      const customerMsg = `Dear ${booking.customer_name}, your private chef booking for ${booking.city} is confirmed. We'll be in touch shortly to plan your menu.`;
      notifyCustomer(booking.customer_phone, customerMsg, true).catch((err) =>
        console.error('Customer WhatsApp failed:', err)
      );
    }
  }

  return received();
};

function received(): Response {
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
