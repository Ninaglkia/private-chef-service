import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendPaymentLinkEmail } from '../../../lib/email';

const OWNER_EMAIL = 'ninaglia089@gmail.com';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

    const { booking_id } = data as { booking_id?: string };

    // Payment model: chef fee + estimated groceries, charged together upfront so
    // Nino never fronts cash. Groceries are reconciled later against receipts.
    // Backward-compatible: a legacy single `amount_cents` is treated as the chef
    // fee with no grocery estimate.
    const chefFeeCents = Number.parseInt(String(data.chef_fee_cents ?? data.amount_cents ?? 'NaN'), 10);
    const groceryEstimateCents = Number.parseInt(String(data.grocery_estimate_cents ?? '0'), 10);

    if (!booking_id) {
      return json({ error: 'Missing booking_id' }, 400);
    }
    if (!Number.isInteger(chefFeeCents) || chefFeeCents < 0) {
      return json({ error: 'Invalid chef_fee_cents' }, 400);
    }
    if (!Number.isInteger(groceryEstimateCents) || groceryEstimateCents < 0) {
      return json({ error: 'Invalid grocery_estimate_cents' }, 400);
    }
    const amountCents = chefFeeCents + groceryEstimateCents;
    if (amountCents <= 0) {
      return json({ error: 'Total amount must be greater than zero' }, 400);
    }

    // --- Look up the booking (service-role read) ---
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (fetchError || !booking) {
      console.error('Booking lookup error:', fetchError);
      return json({ error: 'Booking not found' }, 404);
    }

    // --- Create Stripe Product + one-off Price, then a Payment Link ---
    let link: Stripe.PaymentLink;
    try {
      const product = await stripe.products.create({
        name: 'Private Chef Service',
      });

      const price = await stripe.prices.create({
        currency: 'eur',
        unit_amount: amountCents,
        product: product.id,
      });

      const origin = new URL(request.url).origin;

      link = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { booking_id },
        payment_intent_data: { metadata: { booking_id } },
        restrictions: { completed_sessions: { limit: 1 } },
        after_completion: {
          type: 'redirect',
          redirect: {
            url: `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
          },
        },
      });
    } catch (stripeErr: any) {
      console.error('Stripe payment link error:', stripeErr);
      return json(
        { error: stripeErr?.message || 'Failed to create payment link' },
        502
      );
    }

    // --- Persist link details on the booking (service-role write) ---
    const linkSentAt = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        total_price: amountCents,
        chef_payout: chefFeeCents,
        grocery_budget: groceryEstimateCents,
        payment_link_url: link.url,
        payment_link_id: link.id,
        link_sent_at: linkSentAt,
      })
      .eq('id', booking_id);

    if (updateError) {
      console.error('Booking update error:', updateError);
      return json({ error: 'Payment link created but failed to save' }, 500);
    }

    // --- Email the customer (best-effort) ---
    let emailed = false;
    try {
      await sendPaymentLinkEmail(
        {
          ...booking,
          total_price: amountCents,
          chef_payout: chefFeeCents,
          grocery_budget: groceryEstimateCents,
          link_sent_at: linkSentAt,
        },
        link.url
      );
      emailed = true;
    } catch (emailErr) {
      console.error('Payment link email error:', emailErr);
    }

    return json({ ok: true, url: link.url, emailed }, 200);
  } catch (error: any) {
    console.error('Admin send-payment-link error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};
