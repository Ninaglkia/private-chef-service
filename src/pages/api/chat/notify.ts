import type { APIRoute } from 'astro';
import { sendChatNotificationEmail } from '../../../lib/email';

export const prerender = false;

// Reuses the internal DB->app webhook secret (same one /api/welcome uses).
const WEBHOOK_SECRET = import.meta.env.WELCOME_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  if (!WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }
  if (request.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const payload = await request.json();
    const record = payload?.record ?? payload;
    const body: string | undefined = record?.body;
    const clientName: string | null = record?.client_name ?? null;
    if (!body) {
      return new Response(JSON.stringify({ error: 'Missing body' }), { status: 400 });
    }
    await sendChatNotificationEmail({ clientName, body });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('chat notify error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
