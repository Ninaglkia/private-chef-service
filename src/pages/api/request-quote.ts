import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { sendQuoteRequestEmails } from '../../lib/email';

// Server-only: service-role client (bypasses RLS) so the insert + RETURNING works
// without exposing quote_requests to anon/authenticated via a SELECT policy.
const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);
import { notifyOrganizer, notifyCustomer } from '../../lib/sms';
import { rateLimit, getClientIp } from '../../lib/rate-limit';

export const POST: APIRoute = async ({ request }) => {
  try {
    // Basic per-IP rate limiting before any DB/email/SMS work.
    const ip = getClientIp(request);
    const limit = rateLimit(`request-quote:${ip}`, { limit: 5, windowMs: 60_000 });
    if (!limit.ok) {
      return new Response(
        JSON.stringify({ error: 'Too many requests, please try again shortly.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(limit.retryAfterSec),
          },
        }
      );
    }

    const data = await request.json();

    const {
      customer_name,
      customer_email,
      customer_phone,
      city,
      start_date,
      num_guests,
      add_saturday,
      add_sunday,
      notes,
    } = data;

    if (
      !customer_name ||
      !customer_email ||
      !city ||
      !start_date ||
      !num_guests
    ) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: quoteRequest, error: quoteError } = await supabase
      .from('quote_requests')
      .insert({
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        city,
        start_date,
        num_guests,
        add_saturday: add_saturday || false,
        add_sunday: add_sunday || false,
        notes: notes || '',
        status: 'pending',
      })
      .select()
      .single();

    if (quoteError || !quoteRequest) {
      console.error('Database error:', quoteError);
      return new Response(
        JSON.stringify({ error: 'Failed to create quote request' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Send emails (non-blocking)
    sendQuoteRequestEmails(quoteRequest).catch(err => console.error('Email sending failed:', err));

    // 1. Notify Organizer (Internal)
    const organizerMsg = `[NOTIFICA CHEF] New Quote Request - ${customer_name} - ${city}. Guests: ${num_guests}. Date: ${start_date}.`;
    notifyOrganizer(organizerMsg).catch(err => console.error('Organizer SMS failed:', err));

    // 2. Notify Customer (WhatsApp)
    if (customer_phone) {
        const customerMsg = `Hello ${customer_name}, thank you for your request. We'll get back to you within 48 hours with a tailored quote.`;
        
        // Use WhatsApp
        notifyCustomer(customer_phone, customerMsg, true).catch(err => console.error('Customer WhatsApp failed:', err));
    }

    return new Response(
      JSON.stringify({
        success: true,
        id: quoteRequest.id,
        message: 'Quote request received successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Quote request error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process quote request' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
