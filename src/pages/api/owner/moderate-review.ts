import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { isOwnerEmail } from '../../../lib/admin';

export const prerender = false;

// Owner-only: approve or reject (hide) a guest review. Approved reviews appear
// on the homepage #reviews grid; rejected ones stay stored but hidden. Guarded
// exactly like the other /api/owner/* endpoints: middleware-resolved user +
// the owner email allowlist, verified server-side.

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as { user?: { email?: string } | null }).user;
  if (!user || !isOwnerEmail(user.email)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const data = await request.json();
    const id = String(data.id || '').trim();
    const action = String(data.action || '').trim();
    if (!UUID_RE.test(id)) return json({ error: 'Invalid review id' }, 400);
    if (action !== 'approve' && action !== 'reject') {
      return json({ error: 'Invalid action' }, 400);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('reviews')
      .update({ status: action === 'approve' ? 'approved' : 'rejected' })
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) {
      console.error('moderate-review update error:', error);
      return json({ error: 'Failed to update the review' }, 500);
    }
    if (!updated) return json({ error: 'Review not found' }, 404);

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('moderate-review error:', error);
    return json({ error: 'Failed to update the review' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
