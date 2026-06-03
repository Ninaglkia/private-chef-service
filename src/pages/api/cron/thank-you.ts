import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { sendThankYouEmail } from '../../../lib/email';

export const prerender = false;

const CRON_SECRET = import.meta.env.CRON_SECRET;
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
});

// Best-effort: fetch the Stripe invoice PDF for a paid booking so we can attach
// it to the thank-you email. Returns undefined if there's no invoice yet (older
// links created before invoice_creation was enabled) or anything fails — the
// thank-you email still goes out, just without the attachment.
async function fetchInvoicePdf(booking: any): Promise<{ filename: string; content: string } | undefined> {
  try {
    let invoiceId: string | undefined;
    if (booking.stripe_session_id) {
      const session = await stripe.checkout.sessions.retrieve(booking.stripe_session_id);
      invoiceId = typeof session.invoice === 'string' ? session.invoice : session.invoice?.id;
    }
    if (!invoiceId) return undefined;
    const invoice = await stripe.invoices.retrieve(invoiceId);
    if (!invoice.invoice_pdf) return undefined;
    const res = await fetch(invoice.invoice_pdf);
    if (!res.ok) return undefined;
    const content = Buffer.from(await res.arrayBuffer()).toString('base64');
    return { filename: `invoice-${invoice.number || invoice.id}.pdf`, content };
  } catch (e) {
    console.error('invoice pdf fetch failed for booking', booking.id, e);
    return undefined;
  }
}

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
      .select('id, customer_name, customer_email, start_date, end_date, thankyou_sent_at, status, stripe_session_id')
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
        const invoicePdf = await fetchInvoicePdf(b);
        await sendThankYouEmail(b, invoicePdf);
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
