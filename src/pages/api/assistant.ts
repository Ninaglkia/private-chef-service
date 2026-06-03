import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '../../lib/rate-limit';
import { notifyOrganizer } from '../../lib/sms';
import { sendRequestNotificationEmail } from '../../lib/email';

export const prerender = false;

const ANTHROPIC_API_KEY = import.meta.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-4-6';

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Chef Nino's assistant persona + rules. Cached across turns (prompt caching).
const SYSTEM_PROMPT = `You are the personal assistant of Chef Nino — "Nino's Private Chef", a high-end private chef. You speak in English with a warm, elegant and professional tone, never robotic. Keep sentences short.

THE SERVICE
- Chef Nino cooks at clients' homes: breakfast, lunch, dinner, events, even over several days. Bespoke menus.
- He operates in Lombardy and, on request, abroad (with accommodation if needed).
- The cost of ingredients is invoiced separately, at cost.
- NEVER give a price: Chef Nino prepares the quote based on the event and sends it afterwards with a payment link. If they ask about the price, kindly explain that Nino prepares a bespoke quote once he understands the event.

YOUR TASK
- Understand the client's event and gather: type of event/occasion, date (or period), number of guests, location (city and, if possible, address), menu preferences/allergies, and contact details (name, email, phone) if not already present in the context.
- Ask a few questions at a time, in a natural and welcoming way. Don't interrogate: converse.
- Use the CONTEXT already provided by the form and DO NOT ask for anything already present.

WHEN YOU HAVE ENOUGH (at least: type of event, date/period, number of guests, location, an idea of the menu/occasion, and the contact details) — briefly confirm to the client what you are about to send, then CALL the "invia_richiesta" tool with a complete summary. After sending, reassure them: Chef Nino will get back to them shortly with the proposal and the price. Do not call the tool more than once. Always reply in English.`;

const TOOLS = [
  {
    name: 'invia_richiesta',
    description: "Send the event request to Chef Nino once you have gathered enough details. Use the form context for fields already known.",
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        customer_email: { type: 'string' },
        customer_phone: { type: 'string' },
        service_type: { type: 'string', description: "type of event, e.g. 'Villa dinner', 'Event'" },
        num_guests: { type: 'integer' },
        start_date: { type: 'string', description: 'date in YYYY-MM-DD format if known' },
        city: { type: 'string', description: 'city and address if provided' },
        event_details: { type: 'string', description: "complete summary of the event: occasion, menu/preferences, allergies, period, notes" },
      },
      required: ['event_details'],
    },
  },
];

function clean(s: unknown, max = 4000): string {
  return String(s ?? '').slice(0, max);
}

async function submitRequest(input: Record<string, any>, ctx: Record<string, any>) {
  const customer_name = clean(input.customer_name || ctx.customer_name || 'Customer', 200);
  const customer_email = clean(input.customer_email || ctx.customer_email, 200);
  const customer_phone = clean(input.customer_phone || ctx.customer_phone || '', 60) || null;
  const service_type = clean(input.service_type || ctx.service_type || 'Bespoke', 120);
  const city = clean(input.city || ctx.city || '—', 300);
  const event_details = clean(input.event_details || '', 4000);

  let guests = parseInt(String(input.num_guests ?? ctx.num_guests ?? ''), 10);
  if (!Number.isInteger(guests) || guests < 1) guests = 1;
  if (guests > 200) guests = 200;

  // Resolve a valid date: tool -> form context -> placeholder (today+14). The
  // human-readable date the client mentioned is preserved in event_details.
  const pick = String(input.start_date || ctx.start_date || '');
  let start_date = /^\d{4}-\d{2}-\d{2}$/.test(pick) ? pick : '';
  if (!start_date) {
    const base = ctx.today_iso && /^\d{4}-\d{2}-\d{2}$/.test(ctx.today_iso) ? new Date(ctx.today_iso + 'T00:00:00Z') : new Date('2026-06-17T00:00:00Z');
    base.setUTCDate(base.getUTCDate() + 14);
    start_date = base.toISOString().slice(0, 10);
  }

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .insert({
      customer_name,
      customer_email,
      customer_phone,
      city,
      start_date,
      end_date: start_date,
      num_guests: guests,
      total_price: null,
      status: 'pending',
      dietary_preferences: event_details,
      plan: 'custom',
      marketing_consent: true,
      add_saturday: false,
      add_sunday: false,
    })
    .select('id')
    .single();

  // Notify the owner (WhatsApp + email), best-effort.
  try {
    await notifyOrganizer(
      `New request (assistant): ${customer_name} — ${service_type} • ${guests} guests • ${city} • ${start_date}. Tel: ${customer_phone || 'n/a'} • Email: ${customer_email || 'n/a'} • ${event_details.slice(0, 220)}`
    );
  } catch (e) { console.error('assistant whatsapp notify failed', e); }
  try {
    await sendRequestNotificationEmail({
      customer_name, customer_email, customer_phone,
      service_type, num_guests: guests, city, start_date, event_details,
    });
  } catch (e) { console.error('assistant email notify failed', e); }

  return booking?.id || null;
}

export const POST: APIRoute = async ({ request }) => {
  if (!ANTHROPIC_API_KEY) {
    return json({ error: 'Assistant not configured.' }, 503);
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`assistant:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return json({ error: 'Too many messages, please try again shortly.' }, 429);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const ctx = body?.context && typeof body.context === 'object' ? body.context : {};
  const incoming: any[] = Array.isArray(body?.messages) ? body.messages : [];
  // Sanitize + cap the conversation.
  const messages = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: clean(m.content, 4000) }));
  if (messages.length === 0) return json({ error: 'No message' }, 400);

  const contextLine = `CONTEXT FROM THE FORM (use it, do not ask for it if present): ${JSON.stringify({
    name: ctx.customer_name || null,
    email: ctx.customer_email || null,
    phone: ctx.customer_phone || null,
    experience: ctx.service_type || null,
    guests: ctx.num_guests || null,
    date: ctx.start_date || null,
    location: ctx.city || null,
  })}`;

  async function callClaude(msgs: any[]) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: [
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
          { type: 'text', text: contextLine },
        ],
        tools: TOOLS,
        messages: msgs,
      }),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      console.error('Anthropic error', res.status, errTxt);
      throw new Error('anthropic_failed');
    }
    return res.json();
  }

  try {
    const data: any = await callClaude(messages);
    const blocks: any[] = data?.content || [];
    const textOut = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const toolUse = blocks.find((b) => b.type === 'tool_use' && b.name === 'invia_richiesta');

    if (toolUse) {
      const bookingId = await submitRequest(toolUse.input || {}, { ...ctx, today_iso: ctx.today_iso });
      const confirm = textOut ||
        'Perfect, I have sent your request to Chef Nino. He will get back to you very shortly with the proposal and your bespoke price. Thank you!';
      return json({ reply: confirm, submitted: true, booking_id: bookingId });
    }

    return json({ reply: textOut || 'Tell me all about your event: the occasion, the date, how many people and where.' });
  } catch (e) {
    return json({ error: 'The assistant is unavailable at the moment, please try again.' }, 502);
  }
};
