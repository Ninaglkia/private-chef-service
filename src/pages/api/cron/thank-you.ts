import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { sendThankYouEmail } from '../../../lib/email';

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET;
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Daily thank-you job. Wired via vercel.json crons. Sends a thank-you email
// (with the optional tip link) the day AFTER the event ends — i.e. once the
// guest has actually experienced the service. Vercel sends
// "Authorization: Bearer <CRON_SECRET>" automatically.
export const GET: APIRoute = async ({ request }) => {
  if (!CRON_SECRET || !SERVICE_ROLE || !SUPABASE_URL) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Yesterday's date in the business timezone (Europe/Rome) as YYYY-MM-DD, so the
  // thank-you lands the day after the event regardless of the server's UTC clock.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(yesterday); // en-CA => "YYYY-MM-DD"

  try {
    // Paid bookings that haven't been thanked yet. Volume is small, so we match
    // the event date in JS (event ends at end_date, or start_date if single day).
    const { data: bookings, error } = await admin
      .from('bookings')
      .select('id, customer_name, customer_email, start_date, end_date, thankyou_sent_at, status')
      .in('status', ['confirmed', 'completed'])
      .is('thankyou_sent_at', null);

    if (error) throw error;

    const dueYesterday = (bookings ?? []).filter((b: any) => {
      const eventDate = String(b.end_date || b.start_date || '').slice(0, 10);
      return eventDate === ymd && !!b.customer_email;
    });

    let sent = 0;
    for (const b of dueYesterday) {
      try {
        await sendThankYouEmail(b);
        await admin
          .from('bookings')
          .update({ thankyou_sent_at: new Date().toISOString() })
          .eq('id', b.id)
          .is('thankyou_sent_at', null); // idempotent guard against double-send
        sent += 1;
      } catch (e) {
        console.error('thank-you send failed for booking', b.id, e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, date: ymd, candidates: dueYesterday.length, sent }),
      { status: 200 }
    );
  } catch (err) {
    console.error('thank-you cron error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
