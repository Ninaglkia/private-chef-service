import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'ninaglia089@gmail.com';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const supabaseAuth = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BOOKING_ACTIONS = ['complete', 'refund', 'cancel'] as const;
const QUOTE_STATUSES = ['pending', 'contacted', 'quoted', 'converted', 'declined'] as const;

type BookingAction = (typeof BOOKING_ACTIONS)[number];
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // --- Authorize: owner email OR profiles.role === 'admin' ---
    // Session resolved + refreshed in middleware → locals.user.
    const user = locals.user;
    if (!user) {
      return json({ error: 'Not authenticated' }, 401);
    }

    const email = user.email?.toLowerCase() || '';
    const isOwner = email === OWNER_EMAIL;

    if (!isOwner) {
      // Verify admin role via service-role read (bypass RLS)
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        return json({ error: 'Forbidden' }, 403);
      }
    }

    // --- Parse body ---
    let data: Record<string, any>;
    try {
      data = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const type = (data.type || 'booking') as 'booking' | 'quote';

    // =========================================================
    // QUOTE REQUEST STATUS UPDATE
    // =========================================================
    if (type === 'quote') {
      const { quote_id, status } = data as { quote_id?: string; status?: QuoteStatus };

      if (!quote_id) {
        return json({ error: 'Missing quote_id' }, 400);
      }
      if (!status || !QUOTE_STATUSES.includes(status)) {
        return json({ error: 'Invalid status' }, 400);
      }

      const { error: updateError } = await supabaseAdmin
        .from('quote_requests')
        .update({ status })
        .eq('id', quote_id);

      if (updateError) {
        console.error('Quote update error:', updateError);
        return json({ error: 'Failed to update quote request' }, 500);
      }

      return json({ success: true, status }, 200);
    }

    // =========================================================
    // BOOKING ACTION
    // =========================================================
    const { booking_id, action } = data as { booking_id?: string; action?: BookingAction };

    if (!booking_id) {
      return json({ error: 'Missing booking_id' }, 400);
    }
    if (!action || !BOOKING_ACTIONS.includes(action)) {
      return json({ error: 'Invalid action' }, 400);
    }

    if (action === 'complete') {
      const { error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', booking_id);

      if (updateError) {
        console.error('Booking complete error:', updateError);
        return json({ error: 'Failed to mark booking as completed' }, 500);
      }

      return json({ success: true, status: 'completed' }, 200);
    }

    // action === 'refund' || action === 'cancel'
    // Look up the payment intent so we can attempt a Stripe refund.
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, stripe_payment_intent, status')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) {
      console.error('Booking lookup error:', fetchError);
      return json({ error: 'Booking not found' }, 404);
    }

    let refunded = false;

    if (action === 'refund' && booking.stripe_payment_intent) {
      try {
        await stripe.refunds.create({
          payment_intent: booking.stripe_payment_intent,
        });
        refunded = true;
      } catch (stripeErr: any) {
        console.error('Stripe refund error:', stripeErr);
        return json(
          { error: stripeErr?.message || 'Stripe refund failed' },
          502
        );
      }
    }

    const newStatus = action === 'refund' ? 'refunded' : 'cancelled';

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Booking status update error:', updateError);
      return json({ error: 'Refund issued but failed to update status' }, 500);
    }

    return json({ success: true, status: newStatus, refunded }, 200);
  } catch (error: any) {
    console.error('Admin update-booking error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};
