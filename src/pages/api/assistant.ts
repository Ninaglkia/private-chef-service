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
const SYSTEM_PROMPT = `Sei l'assistente personale di Chef Nino — "Nino's Private Chef", private chef di alto livello. Parli in italiano con tono caldo, elegante e professionale, mai robotico. Frasi brevi.

IL SERVIZIO
- Chef Nino cucina a domicilio: colazione, pranzo, cena, eventi, anche più giorni. Menù su misura.
- Opera in Lombardia e, su richiesta, all'estero (con eventuale alloggio).
- La spesa degli ingredienti è fatturata a parte, al costo.
- NON dai mai un prezzo: il preventivo lo prepara Chef Nino in base all'evento e lo invia dopo con un link di pagamento. Se chiedono il prezzo, spiega gentilmente che Nino prepara un preventivo su misura dopo aver capito l'evento.

IL TUO COMPITO
- Capire l'evento del cliente e raccogliere: tipo di evento/occasione, data (o periodo), numero di ospiti, luogo (città e, se possibile, indirizzo), preferenze di menù/allergie, e i contatti (nome, email, telefono) se non già presenti nel contesto.
- Fai poche domande alla volta, in modo naturale e accogliente. Non interrogare: conversa.
- Usa il CONTESTO già fornito dal form e NON richiedere ciò che è già presente.

QUANDO HAI ABBASTANZA (almeno: tipo evento, data/periodo, numero ospiti, luogo, un'idea di menù/occasione, e i contatti) — conferma brevemente al cliente cosa stai per inviare, poi CHIAMA lo strumento "invia_richiesta" con un riepilogo completo. Dopo l'invio, rassicura: Chef Nino lo ricontatterà a breve con la proposta e il prezzo. Non chiamare lo strumento più di una volta.`;

const TOOLS = [
  {
    name: 'invia_richiesta',
    description: "Invia la richiesta di evento a Chef Nino quando hai raccolto abbastanza dettagli. Usa il contesto del form per i campi già noti.",
    input_schema: {
      type: 'object',
      properties: {
        customer_name: { type: 'string' },
        customer_email: { type: 'string' },
        customer_phone: { type: 'string' },
        service_type: { type: 'string', description: "tipo di evento, es. 'Cena in villa', 'Evento'" },
        num_guests: { type: 'integer' },
        start_date: { type: 'string', description: 'data in formato YYYY-MM-DD se nota' },
        city: { type: 'string', description: 'città e indirizzo se forniti' },
        event_details: { type: 'string', description: "riepilogo completo dell'evento: occasione, menù/preferenze, allergie, periodo, note" },
      },
      required: ['event_details'],
    },
  },
];

function clean(s: unknown, max = 4000): string {
  return String(s ?? '').slice(0, max);
}

async function submitRequest(input: Record<string, any>, ctx: Record<string, any>) {
  const customer_name = clean(input.customer_name || ctx.customer_name || 'Cliente', 200);
  const customer_email = clean(input.customer_email || ctx.customer_email, 200);
  const customer_phone = clean(input.customer_phone || ctx.customer_phone || '', 60) || null;
  const service_type = clean(input.service_type || ctx.service_type || 'Su misura', 120);
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
      `Nuova richiesta (assistente): ${customer_name} — ${service_type} • ${guests} ospiti • ${city} • ${start_date}. Tel: ${customer_phone || 'n/d'} • Email: ${customer_email || 'n/d'} • ${event_details.slice(0, 220)}`
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
    return json({ error: 'Assistant non configurato.' }, 503);
  }

  const ip = getClientIp(request);
  const limit = rateLimit(`assistant:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return json({ error: 'Troppi messaggi, riprova tra poco.' }, 429);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }

  const ctx = body?.context && typeof body.context === 'object' ? body.context : {};
  const incoming: any[] = Array.isArray(body?.messages) ? body.messages : [];
  // Sanitize + cap the conversation.
  const messages = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: clean(m.content, 4000) }));
  if (messages.length === 0) return json({ error: 'Nessun messaggio' }, 400);

  const contextLine = `CONTESTO DAL FORM (usalo, non richiederlo se presente): ${JSON.stringify({
    nome: ctx.customer_name || null,
    email: ctx.customer_email || null,
    telefono: ctx.customer_phone || null,
    esperienza: ctx.service_type || null,
    ospiti: ctx.num_guests || null,
    data: ctx.start_date || null,
    luogo: ctx.city || null,
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
        'Perfetto, ho inviato la tua richiesta a Chef Nino. Ti ricontatterà a brevissimo con la proposta e il prezzo su misura. Grazie!';
      return json({ reply: confirm, submitted: true, booking_id: bookingId });
    }

    return json({ reply: textOut || 'Raccontami pure il tuo evento: occasione, data, quante persone e dove.' });
  } catch (e) {
    return json({ error: 'Assistente non disponibile al momento, riprova.' }, 502);
  }
};
