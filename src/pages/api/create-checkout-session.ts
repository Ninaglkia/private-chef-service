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
    let data;
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      data = await request.json();
    } else if (contentType?.includes('application/x-www-form-urlencoded') || contentType?.includes('multipart/form-data')) {
      const formData = await request.formData();
      data = Object.fromEntries(formData);
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported content type' }), { status: 400 });
    }

    const {
      customer_name,
      company,
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
    
    // Check for luxury experience plan
    if (plan === 'luxury_experience') {
      planInput = 'luxury_experience';
    } else if (typeof plan === 'number' || !isNaN(Number(plan))) {
      const planIndex = Number(plan);
      const planMap = ['standard', 'plus', 'premium'];
      if (planIndex >= 0 && planIndex < planMap.length) {
        planInput = planMap[planIndex];
      }
    }

    // Map input plan to valid DB values
    const validPlans = ['standard', 'plus', 'premium', 'luxury_experience'];
    const dbPlan = validPlans.includes(planInput) ? planInput : 'standard';

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        city,
        start_date,
        num_guests: num_guests ? parseInt(num_guests) : 1, // Default to 1 for luxury plan if not specified
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
    const cancelUrl = dbPlan === 'luxury_experience' ? `${origin}/luxury-experience` : `${origin}/booking`;

    // Combine company with name if provided
    const fullName = company ? `${customer_name} (${company})` : customer_name;

    // Images for different plans
    const planImages: Record<string, string> = {
      standard: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80', // High quality food
      plus: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=800&q=80', // Chef cooking
      premium: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80', // Luxury service
      luxury_experience: 'https://images.unsplash.com/photo-1551632436-cbf8dd354ca8?auto=format&fit=crop&w=800&q=80', // Ultra Luxury
    };

    const imageUrl = planImages[dbPlan] || planImages.standard;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: dbPlan === 'luxury_experience' ? 'The Royal Indulgence Experience' : `Weekly Private Chef - ${dbPlan.charAt(0).toUpperCase() + dbPlan.slice(1)} Plan`,
              description: dbPlan === 'luxury_experience' ? 'All-Inclusive Weekly Luxury Package' : `${num_guests} guests • ${city} • Starts ${start_date}`,
              images: [imageUrl],
            },
            unit_amount: total_price,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      locale: 'it',
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
