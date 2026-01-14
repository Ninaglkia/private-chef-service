import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';
import { sendQuoteRequestEmails } from '../../lib/email';
import { notifyOrganizer, notifyCustomer } from '../../lib/sms';

export const POST: APIRoute = async ({ request }) => {
  try {
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
      !num_guests ||
      num_guests < 10
    ) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields or invalid guest count' }),
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
        // Template: "Hello {{1}}, thank you for your request regarding {{2}}. We will get back to you within 48 hours."
        const customerMsg = `[CONFERMA CLIENTE] Hello ${customer_name}, thank you for your request regarding ${num_guests} guests. We will get back to you within 48 hours.`;
        
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
