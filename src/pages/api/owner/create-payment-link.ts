import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { isOwnerEmail } from '../../../lib/admin';

export const prerender = false;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

// Map the /owner calculator selections onto the canonical Stripe price
// lookup_keys (created once, see project_private_chef_stripe_products). The
// Payment Links API can't take inline price_data, so itemized links must
// reference existing price IDs — these lookups give us clean, reusable lines
// (Chef + per-guest cover) with no throwaway products.
const CHEF_KEY: Record<number, string> = { 400: 'chef_half_day', 600: 'chef_full_day' };
const MEAL_BASE_KEY: Record<string, string> = {
  Breakfast: 'coperto_breakfast',
  Lunch: 'coperto_lunch',
  Dinner: 'coperto_dinner',
  Buffet: 'coperto_buffet',
};

// Owner-only: build a Stripe Payment Link automatically from the /owner
// calculator so the owner no longer creates it by hand in the dashboard. We
// store the link id on the booking so the existing webhook matches the payment
// (session.payment_link -> booking.payment_link_id) and confirms the booking.
export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as { user?: { email?: string } | null }).user;
  if (!user || !isOwnerEmail(user.email)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const data = await request.json();
    const booking_id = data.booking_id ? String(data.booking_id) : null;
    const chef_eur = Number(data.chef_eur) || 0;
    const meal_unit_eur = Number(data.meal_unit_eur) || 0; // per-guest rate (tier already applied)
    const meal_name = String(data.meal_name || '').trim(); // e.g. "Dinner" or "Dinner Premium"
    const guests = Math.max(0, Math.floor(Number(data.guests) || 0));
    const total_eur = Number(data.total_eur);

    if (!booking_id) return json({ error: 'Select a pending request first.' }, 400);
    if (!Number.isFinite(total_eur) || total_eur <= 0) return json({ error: 'A valid price is required.' }, 400);

    const toCents = (eur: number) => Math.round(eur * 100);

    // Decide whether the calculator maps cleanly onto canonical prices. If the
    // owner overrode the total, or used a non-standard chef/meal, we fall back
    // to a single one-off "Private Chef Service" line for the exact total.
    const structuredSum = chef_eur + meal_unit_eur * guests;
    const chefKey = CHEF_KEY[chef_eur];
    const wantsMeal = meal_unit_eur > 0 && guests > 0;
    const mealBaseName = meal_name.replace(/\s*Premium$/i, '').trim();
    const isPremium = /Premium$/i.test(meal_name);
    const mealKey = wantsMeal
      ? (MEAL_BASE_KEY[mealBaseName] ? MEAL_BASE_KEY[mealBaseName] + (isPremium ? '_premium' : '') : undefined)
      : undefined;

    const canItemize =
      !!chefKey &&
      (!wantsMeal || !!mealKey) &&
      Math.abs(structuredSum - total_eur) < 1;

    let lineItems: Stripe.PaymentLinkCreateParams.LineItem[];
    let itemized = false;

    if (canItemize) {
      const wanted = [chefKey!, ...(mealKey ? [mealKey] : [])];
      const prices = await stripe.prices.list({ lookup_keys: wanted, limit: 100, active: true });
      const byKey = new Map(prices.data.map((p) => [p.lookup_key as string, p]));
      const chefPrice = byKey.get(chefKey!);
      const mealPrice = mealKey ? byKey.get(mealKey) : undefined;

      if (chefPrice && (!mealKey || mealPrice)) {
        lineItems = [{ price: chefPrice.id, quantity: 1 }];
        if (mealPrice) lineItems.push({ price: mealPrice.id, quantity: guests });
        itemized = true;
      } else {
        lineItems = [await singleTotalLine(toCents(total_eur))];
      }
    } else {
      lineItems = [await singleTotalLine(toCents(total_eur))];
    }

    const link = await stripe.paymentLinks.create({
      line_items: lineItems,
      metadata: { booking_id },
      payment_intent_data: { metadata: { booking_id } },
      // Let customers enter the welcome code BENVENUTO10 at checkout. The promo
      // code is restricted to first_time_transaction, so Stripe enforces "once
      // per customer, first booking only" automatically — no manual discounting.
      allow_promotion_codes: true,
      // Generate a Stripe invoice (with PDF) for every payment, so the day-after
      // thank-you email can attach it. NOTE: this is a Stripe invoice/receipt,
      // not an Italian SDI electronic invoice.
      invoice_creation: {
        enabled: true,
        invoice_data: {
          footer: "Nino's Private Chef — ninos-privatechefs.com",
          metadata: { booking_id },
        },
      },
    });

    // Persist link + id + total so the webhook matches the payment and the
    // amount sanity check passes. link_sent_at is set later, when the owner
    // actually sends the confirmation email.
    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        total_price: toCents(total_eur),
        payment_link_url: link.url,
        payment_link_id: link.id,
      })
      .eq('id', booking_id);
    if (updateError) {
      console.error('Booking link update failed:', updateError);
      return json({ error: 'Link created but could not be saved to the booking.' }, 500);
    }

    return json({ ok: true, url: link.url, id: link.id, itemized }, 200);
  } catch (error) {
    console.error('create-payment-link error:', error);
    return json({ error: 'Failed to create the payment link.' }, 500);
  }
};

// One-off price for an exact total (used when the owner overrode the price or
// used non-standard inputs). Reuses a single stable product so we don't spawn a
// new product per booking.
async function singleTotalLine(unitAmount: number): Promise<Stripe.PaymentLinkCreateParams.LineItem> {
  const price = await stripe.prices.create({
    currency: 'eur',
    unit_amount: unitAmount,
    product_data: { name: 'Private Chef Service' },
  });
  return { price: price.id, quantity: 1 };
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
