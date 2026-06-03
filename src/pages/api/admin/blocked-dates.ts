import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const OWNER_EMAIL = 'ninaglia089@gmail.com';

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Authorize: owner email OR profiles.role === 'admin'. Session resolved in middleware.
async function authorize(locals: App.Locals): Promise<boolean> {
  const user = locals.user;
  if (!user) return false;
  if ((user.email?.toLowerCase() || '') === OWNER_EMAIL) return true;
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return profile?.role === 'admin';
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Add a blocked (unavailable) date.
export const POST: APIRoute = async ({ request, locals }) => {
  if (!(await authorize(locals))) return json({ error: 'Forbidden' }, 403);

  let data: Record<string, any>;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const date = String(data.date || '').trim();
  if (!ISO_DATE.test(date)) return json({ error: 'Invalid date (expected YYYY-MM-DD)' }, 400);
  const reason = data.reason ? String(data.reason).slice(0, 200) : null;

  const { error } = await supabaseAdmin
    .from('blocked_dates')
    .upsert({ date, reason }, { onConflict: 'date' });

  if (error) {
    console.error('blocked_dates insert error:', error);
    return json({ error: 'Failed to block date' }, 500);
  }
  return json({ ok: true, date }, 200);
};

// Remove a blocked date (make it available again).
export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!(await authorize(locals))) return json({ error: 'Forbidden' }, 403);

  let data: Record<string, any>;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const date = String(data.date || '').trim();
  if (!ISO_DATE.test(date)) return json({ error: 'Invalid date' }, 400);

  const { error } = await supabaseAdmin.from('blocked_dates').delete().eq('date', date);
  if (error) {
    console.error('blocked_dates delete error:', error);
    return json({ error: 'Failed to unblock date' }, 500);
  }
  return json({ ok: true, date }, 200);
};
