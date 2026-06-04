import type { APIRoute } from 'astro';
import { isOwnerEmail } from '../../../lib/admin';
import { sendClientMessage } from '../../../lib/email';

export const prerender = false;

// Owner-only: send a free-form BRANDED message to a client via Resend (chef
// template, from info@). Lets Nino reply to clients with on-brand emails
// instead of plain Gmail replies.
export const POST: APIRoute = async ({ request, locals }) => {
  const user = (locals as { user?: { email?: string } | null }).user;
  if (!user || !isOwnerEmail(user.email)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const data = await request.json();
    const to = String(data.to || '').trim();
    const subject = String(data.subject || '').trim();
    const message = String(data.message || '').trim();
    const customer_name = data.customer_name ? String(data.customer_name).trim() : null;

    if (!/^\S+@\S+\.\S+$/.test(to)) return json({ error: 'A valid recipient email is required.' }, 400);
    if (!subject) return json({ error: 'A subject is required.' }, 400);
    if (!message) return json({ error: 'Write a message.' }, 400);

    await sendClientMessage({ to, subject, message, customer_name });
    return json({ ok: true }, 200);
  } catch (error) {
    console.error('send-message error:', error);
    return json({ error: 'Failed to send the message.' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
