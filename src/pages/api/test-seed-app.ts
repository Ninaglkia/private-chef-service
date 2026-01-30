
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const GET: APIRoute = async () => {
  // Usa la chiave Service Role per bypassare le restrizioni RLS
  const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Dati di prova simulati
  const mockData = {
    first_name: "Mario",
    last_name: "Rossi (Test)",
    email: "mario.test@example.com",
    city: "Milano [CHEF - FULL-TIME]", 
    tax_id: "RSSMRA80A01H501U",
    cv_url: "https://example.com/fake-cv.pdf",
    photos_urls: ["https://example.com/fake-details.json"],
    status: "pending"
  };

  const { data, error } = await supabaseAdmin
    .from('chef_recruitment_applications')
    .insert(mockData)
    .select();

  if (error) {
    return new Response(JSON.stringify({ error: error.message, details: error }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
