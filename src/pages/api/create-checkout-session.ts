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

    // Handle potential numeric plan input (0, 1, 2) from frontend
    let planInput = plan;
    if (typeof plan === 'number' || !isNaN(Number(plan))) {
      const planIndex = Number(plan);
      const planMap = ['standard', 'plus', 'premium'];
      if (planIndex >= 0 && planIndex < planMap.length) {
        planInput = planMap[planIndex];
      }
    }

    // Map input plan to valid DB values
    const validPlans = ['standard', 'plus', 'premium'];
    const dbPlan = validPlans.includes(planInput) ? planInput : 'standard';

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        city,
        start_date,
        num_guests: parseInt(num_guests),
        total_price,
        status: 'pending',
        dietary_preferences: dietary_preferences || null,
        plan: dbPlan,
        add_saturday: add_saturday || false,
        add_sunday: add_sunday || false,
      })
      .select('id, customer_email, customer_name, city, start_date, num_guests, total_price')
      .single();

    if (bookingError || !booking) {
      console.error('Supabase booking error:', bookingError);
      return new Response(
        JSON.stringify({ error: 'Failed to create booking: ' + (bookingError?.message || 'Unknown error') }),
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
              name: `Weekly Private Chef - ${dbPlan.charAt(0).toUpperCase() + dbPlan.slice(1)} Plan`,
              description: `${num_guests} guests • ${city} • Starts ${start_date}`,
              images: ['https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=1600&q=80'], // High quality chef image
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
  } catch (error: any) {
    console.error('General error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create checkout session: ' + (error?.message || 'Unknown error') }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
