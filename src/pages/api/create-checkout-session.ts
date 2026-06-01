import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { PRODUCTS, getProductPrice, getProductDays, isValidProduct, MAX_GUESTS } from '../../lib/pricing';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const PRODUCT_IMAGES: Record<string, string> = {
  day: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
  weekend: 'https://images.unsplash.com/photo-1556910103-1c02745a30bf?auto=format&fit=crop&w=800&q=80',
  week: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80',
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    let data: Record<string, any>;
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      data = await request.json();
    } else if (
      contentType?.includes('application/x-www-form-urlencoded') ||
      contentType?.includes('multipart/form-data')
    ) {
      const formData = await request.formData();
      data = Object.fromEntries(formData);
    } else {
      return json({ error: 'Unsupported content type' }, 400);
    }

    const {
      customer_name,
      company,
      customer_email,
      customer_phone,
      city,
      start_date,
      num_guests,
      product,
      dietary_preferences,
    } = data;

    // --- Validation (server is the source of truth; never trust client price) ---
    if (!customer_name || !customer_email || !city || !start_date || !product) {
      return json({ error: 'Missing required fields' }, 400);
    }

    if (!isValidProduct(product)) {
      return json({ error: 'Invalid product' }, 400);
    }

    const guests = num_guests ? parseInt(String(num_guests), 10) : 1;
    if (Number.isNaN(guests) || guests < 1 || guests > MAX_GUESTS) {
      return json({ error: `Guests must be between 1 and ${MAX_GUESTS}` }, 400);
    }

    // Price is computed here, from the product — the client value is ignored.
    const totalPrice = getProductPrice(product);
    const days = getProductDays(product);

    const startDateObj = new Date(start_date);
    if (Number.isNaN(startDateObj.getTime())) {
      return json({ error: 'Invalid start date' }, 400);
    }
    const endDateObj = new Date(startDateObj);
    endDateObj.setDate(startDateObj.getDate() + (days - 1));
    const end_date = endDateObj.toISOString().split('T')[0];

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        city,
        start_date,
        end_date,
        num_guests: guests,
        total_price: totalPrice,
        status: 'pending',
        dietary_preferences: dietary_preferences || null,
        plan: product,
        add_saturday: false,
        add_sunday: false,
      })
      .select('id')
      .single();

    if (bookingError || !booking) {
      console.error('Supabase booking error:', bookingError);
      return json({ error: 'Failed to create booking' }, 500);
    }

    const origin = url.origin;
    const fullName = company ? `${customer_name} (${company})` : customer_name;
    const productName = PRODUCTS[product].name;
    const imageUrl = PRODUCT_IMAGES[product] || PRODUCT_IMAGES.day;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Private Chef — ${productName}`,
              description: `${guests} guest${guests > 1 ? 's' : ''} • ${city} • from ${start_date} • groceries billed separately`,
              images: [imageUrl],
            },
            unit_amount: totalPrice,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      locale: 'auto',
      success_url: `${origin}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/booking`,
      customer_email,
      metadata: {
        booking_id: booking.id,
        product,
        customer_name: fullName,
      },
    });

    await supabaseAdmin
      .from('bookings')
      .update({ stripe_session_id: session.id })
      .eq('id', booking.id);

    return json({ url: session.url }, 200);
  } catch (error: any) {
    console.error('General error creating checkout session:', error);
    return json({ error: 'Failed to create checkout session' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
