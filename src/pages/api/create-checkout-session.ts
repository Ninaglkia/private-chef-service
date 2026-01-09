import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const data = await request.json();

    const {
      customer_name,
      customer_email,
      customer_phone,
      city,
      start_date,
      num_guests,
      plan,
      add_saturday,
      add_sunday,
      dietary_preferences,
      total_price,
    } = data;

    if (
      !customer_name ||
      !customer_email ||
      !city ||
      !start_date ||
      !num_guests ||
      !plan ||
      total_price === undefined
    ) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const startDateObj = new Date(start_date);
    const daysToAdd = 4 + (add_saturday ? 1 : 0) + (add_sunday ? 1 : 0);
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + daysToAdd);
    const end_date = endDateObj.toISOString().split('T')[0];

    const selected_days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    if (add_saturday) selected_days.push('Saturday');
    if (add_sunday) selected_days.push('Sunday');

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        city,
        start_date,
        end_date,
        num_guests: parseInt(num_guests),
        total_price,
        status: 'pending_payment',
        dietary_preferences: dietary_preferences || null,
        plan_id: 'weekly-chef',
        selected_days
      })
      .select()
      .single();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: 'Failed to create booking' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const origin = url.origin;
    const successUrl = `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/booking`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Weekly Private Chef - ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
              description: `${num_guests} guests • ${city} • Starts ${start_date}`,
            },
            unit_amount: total_price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customer_email,
      metadata: {
        booking_id: booking.id,
      },
    });

    await supabaseAdmin
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
