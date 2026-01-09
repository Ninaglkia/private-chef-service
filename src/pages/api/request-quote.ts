import type { APIRoute } from 'astro';
import { supabase } from '../../lib/supabase';

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
