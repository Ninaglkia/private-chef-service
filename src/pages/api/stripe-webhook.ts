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

const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
const emailApiKey = import.meta.env.RESEND_API_KEY;
const emailFrom = import.meta.env.EMAIL_FROM || 'onboarding@resend.dev';

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

    const bookingId = session.metadata?.booking_id;

    if (bookingId) {
      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'confirmed',
          stripe_payment_intent: session.payment_intent as string,
        })
        .eq('id', bookingId);

      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      // Calculate end date manually if not in DB
      let endDate = booking?.end_date;
      if (!endDate && booking?.start_date) {
        const startDateObj = new Date(booking.start_date);
        const daysToAdd = 4 + (booking.add_saturday ? 1 : 0) + (booking.add_sunday ? 1 : 0);
        const endDateObj = new Date(startDateObj);
        endDateObj.setDate(startDateObj.getDate() + daysToAdd);
        endDate = endDateObj.toISOString().split('T')[0];
      }

      const toEmail = booking?.customer_email || session.customer_details?.email || session.customer_email || null;

      if (emailApiKey && toEmail) {
        const html = `
          <div style="font-family: Arial, sans-serif; color: #111;">
            <h2>Booking Confirmed</h2>
            <p>Thank you for your booking. Your payment has been received and your weekly private chef service is confirmed.</p>
            ${booking ? `
              <p><strong>Name:</strong> ${booking.customer_name}</p>
              <p><strong>City:</strong> ${booking.city}</p>
              <p><strong>Service Dates:</strong> ${booking.start_date} to ${endDate}</p>
              <p><strong>Guests:</strong> ${booking.num_guests}</p>
              <p><strong>Total:</strong> €${(booking.total_price / 100).toFixed(0)}</p>
            ` : ''}
            <p>Our team will contact you within 24–48 hours to finalize details and menu planning.</p>
          </div>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${emailApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: emailFrom,
            to: toEmail,
            subject: 'Your Weekly Private Chef – Booking Confirmed',
            html,
          }),
        });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const GET: APIRoute = async ({ url }) => {
  const name = url.searchParams.get('name') || 'John Smith';
  const city = url.searchParams.get('city') || 'Barcelona';
  const start = url.searchParams.get('start') || '2026-01-12';
  const end = url.searchParams.get('end') || '2026-01-16';
  const guests = parseInt(url.searchParams.get('guests') || '4');
  const total = parseInt(url.searchParams.get('total') || '250000');
  const send = url.searchParams.get('send') === '1';
  const to = url.searchParams.get('to') || '';

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111; max-width: 640px; margin: 0 auto;">
      <div style="text-align:center; padding: 24px 0;">
        <div style="font-size: 20px; font-weight: 600;">Weekly Private Chef</div>
      </div>
      <div style="background:#000; color:#fff; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <div style="font-size:18px; font-weight:600;">Booking Confirmed</div>
      </div>
      <div style="border:1px solid #eee; border-top:none; padding: 20px 24px; border-radius: 0 0 8px 8px;">
        <p>Thank you for your booking. Your payment has been received and your weekly private chef service is confirmed.</p>
        <div style="margin-top:12px;">
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>City:</strong> ${city}</p>
          <p><strong>Service Dates:</strong> ${start} to ${end}</p>
          <p><strong>Guests:</strong> ${guests}</p>
          <p><strong>Total:</strong> €${(total / 100).toFixed(0)}</p>
        </div>
        <p style="margin-top:12px;">Our team will contact you within 24–48 hours to finalize details and menu planning.</p>
      </div>
      <div style="text-align:center; color:#666; font-size:12px; margin-top:16px;">Secure payment powered by Stripe</div>
    </div>
  `;

  if (send && emailApiKey && to && import.meta.env.DEV) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${emailApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject: 'Your Weekly Private Chef – Booking Confirmed',
        html,
      }),
    });
    const json = await res.json();
    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
};
