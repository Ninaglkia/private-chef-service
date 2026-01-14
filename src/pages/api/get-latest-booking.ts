
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const GET: APIRoute = async () => {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('id, customer_email, total_price')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
};
