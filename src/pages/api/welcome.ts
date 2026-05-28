import type { APIRoute } from 'astro';
import { sendWelcomeEmail } from '../../lib/email';

export const prerender = false;

const WEBHOOK_SECRET = import.meta.env.WELCOME_WEBHOOK_SECRET;

export const POST: APIRoute = async ({ request }) => {
  if (!WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const auth = request.headers.get('x-webhook-secret');
  if (auth !== WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const payload = await request.json();
    const record = payload?.record ?? payload;
    const email: string | undefined = record?.email;
    const fullName: string | null =
      record?.raw_user_meta_data?.full_name ??
      record?.raw_user_meta_data?.name ??
      null;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Missing email' }), { status: 400 });
    }

    await sendWelcomeEmail({ email, full_name: fullName });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('welcome webhook error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
