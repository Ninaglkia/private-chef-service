import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { sendBirthdayEmail } from '../../../lib/email';

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET;
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

// Daily birthday job. Wired via vercel.json crons (runs once a day). Vercel sends
// "Authorization: Bearer <CRON_SECRET>" automatically when CRON_SECRET is set in
// the project env, so we reject anything that doesn't match.
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

  // Today's month/day in the business timezone (Europe/Rome), so the greeting
  // lands on the correct calendar day regardless of the server's UTC clock.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const mm = parts.find((p) => p.type === 'month')?.value;
  const dd = parts.find((p) => p.type === 'day')?.value;
  const todayMmDd = `${mm}-${dd}`;

  // Current year in the business timezone — the idempotency key, so a re-run on
  // the same day (or a Vercel cron retry) never double-greets the same person.
  const currentYear = Number(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric' }).format(new Date())
  );

  try {
    // Pull everyone with a birthday set, then match month+day in JS (PostgREST
    // can't filter on a to_char expression). The user base is small.
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id, full_name, birthday, birthday_email_sent_year')
      .not('birthday', 'is', null);

    if (error) throw error;

    const birthdayToday = (profiles ?? []).filter((p: any) => {
      if (!p.birthday) return false;
      // Already greeted this year? skip (idempotency).
      if (p.birthday_email_sent_year === currentYear) return false;
      // birthday is a 'YYYY-MM-DD' date string; compare MM-DD.
      const mmdd = String(p.birthday).slice(5, 10);
      return mmdd === todayMmDd;
    });

    let sent = 0;
    let failed = 0;
    for (const p of birthdayToday) {
      // Per-recipient isolation: one failed send must not abort the whole batch.
      try {
        // Email lives on auth.users, not profiles.
        const { data: userRes } = await admin.auth.admin.getUserById(p.id);
        const email = userRes?.user?.email;
        if (!email) continue;
        await sendBirthdayEmail({ email, full_name: p.full_name });
        // Mark as greeted this year only AFTER a successful send.
        await admin.from('profiles').update({ birthday_email_sent_year: currentYear }).eq('id', p.id);
        sent += 1;
      } catch (e) {
        failed += 1;
        console.error('birthday send failed for', p.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, date: todayMmDd, candidates: birthdayToday.length, sent, failed }), {
      status: 200,
    });
  } catch (err) {
    console.error('birthday cron error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
};
