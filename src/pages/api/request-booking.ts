import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getProductPrice, getProductDays, isValidProduct, MAX_GUESTS, type Product } from '../../lib/pricing';
import { rateLimit, getClientIp } from '../../lib/rate-limit';
import { notifyOrganizer } from '../../lib/sms';
import { sendRequestNotificationEmail, sendRequestConfirmationToGuest } from '../../lib/email';

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

// Guests cap for the open-ended 'custom' / abroad plan (fixed plans use MAX_GUESTS).
const CUSTOM_MAX_GUESTS = 200;

// Pay-later request: a guest submits a booking REQUEST (no account, no payment).
// We insert a 'pending' booking; the owner then sends a Stripe payment link.
// Modelled on create-checkout-session.ts (same insert shape) but with NO Stripe call.
export const POST: APIRoute = async ({ request }) => {
  try {
    // Basic per-IP rate limiting before any DB work.
    const ip = getClientIp(request);
    const limit = rateLimit(`request-booking:${ip}`, { limit: 8, windowMs: 60_000 });
    if (!limit.ok) {
      return new Response(
        JSON.stringify({ error: 'Too many requests, please try again shortly.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(limit.retryAfterSec),
          },
        }
      );
    }

    let data: Record<string, any>;
    const contentType = request.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      data = await request.json();
    } else if (
      contentType?.includes('application/x-www-form-urlencoded') ||
      contentType?.includes('multipart/form-data')
    ) {
      const formData = await request.formData();
      data = Object.fromEntries(formData);
    } else {
      return json({ error: 'Unsupported content type' }, 400);
    }

    const {
      customer_name,
      company,
      customer_email,
      customer_phone,
      city,
      event_address,
      start_date,
      end_date: endDateInput,
      num_guests,
      product,
      service_type,
      event_details,
      dietary_preferences,
      marketing_consent,
      company_website, // HONEYPOT
    } = data;

    // Honeypot: real users never fill this. If present, pretend success and bail.
    if (company_website && String(company_website).trim() !== '') {
      return json({ ok: true }, 200);
    }

    // --- Validation ---
    // The request form has no fixed packages: default to 'custom' (owner prices it later).
    const plan = product && String(product).trim() ? String(product) : 'custom';
    if (!customer_name || !customer_email || !customer_phone || !city || !start_date) {
      return json({ error: 'Name, email, phone, city and date are required' }, 400);
    }
    // Email must look like an email. The public form checks this client-side, but a
    // direct POST bypasses that — a typo'd address creates a booking we can never reach.
    if (!/^\S+@\S+\.\S+$/.test(String(customer_email).trim())) {
      return json({ error: 'A valid email is required' }, 400);
    }
    // Length caps so a direct POST can't store megabytes of junk in the row.
    if (
      String(customer_name).length > 120 ||
      String(customer_email).length > 200 ||
      String(customer_phone).length > 40 ||
      String(city).length > 120 ||
      String(event_address || '').length > 300 ||
      String(event_details || dietary_preferences || '').length > 4000
    ) {
      return json({ error: 'One or more fields are too long' }, 400);
    }
    // Phone must be a real number (6–15 digits, ignoring separators/prefix).
    if (String(customer_phone).replace(/\D/g, '').length < 6) {
      return json({ error: 'A valid phone number is required' }, 400);
    }

    const isCustom = plan === 'custom';
    if (!isCustom && !isValidProduct(plan)) {
      return json({ error: 'Invalid product' }, 400);
    }

    const guestCap = isCustom ? CUSTOM_MAX_GUESTS : MAX_GUESTS;
    const guests = num_guests ? parseInt(String(num_guests), 10) : 1;
    if (Number.isNaN(guests) || guests < 1 || guests > guestCap) {
      return json({ error: `Guests must be between 1 and ${guestCap}` }, 400);
    }

    // Price: server-authoritative for fixed plans, NULL for 'custom' (owner sets it later).
    const totalPrice = isCustom ? null : getProductPrice(plan as Product);
    const days = isCustom ? 1 : getProductDays(plan as Product);

    const startDateObj = new Date(start_date);
    if (Number.isNaN(startDateObj.getTime())) {
      return json({ error: 'Invalid start date' }, 400);
    }
    // Compute end_date using pure UTC math so a non-UTC server can't shift the
    // calendar day. Build the start in UTC, add (days - 1) days, then format
    // YYYY-MM-DD from the UTC parts.
    const endUtc = new Date(
      Date.UTC(
        startDateObj.getUTCFullYear(),
        startDateObj.getUTCMonth(),
        startDateObj.getUTCDate() + (days - 1)
      )
    );
    const yyyy = endUtc.getUTCFullYear();
    const mm = String(endUtc.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(endUtc.getUTCDate()).padStart(2, '0');
    let end_date = `${yyyy}-${mm}-${dd}`;

    // Honor an explicit end_date from the calendar's range picker (valid
    // YYYY-MM-DD, on or after the start date); otherwise keep the computed value.
    if (
      endDateInput &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(endDateInput)) &&
      String(endDateInput) >= String(start_date)
    ) {
      end_date = String(endDateInput);
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        customer_name,
        // Store the email normalized (trim + lowercase) so the customer dashboard
        // lookup and the bookings RLS (which compares lower(customer_email)) always
        // match — otherwise a stray capital letter hides the booking + pay link.
        customer_email: String(customer_email).trim().toLowerCase(),
        customer_phone: customer_phone || null,
        city,
        event_address: event_address || null,
        start_date,
        end_date,
        num_guests: guests,
        total_price: totalPrice,
        status: 'pending',
        dietary_preferences: event_details || dietary_preferences || null,
        plan,
        marketing_consent: !!marketing_consent,
        add_saturday: false,
        add_sunday: false,
      })
      .select('id')
      .single();

    if (bookingError || !booking) {
      console.error('Supabase booking error:', bookingError);
      return json({ error: 'Failed to create booking' }, 500);
    }

    // Notify the owner best-effort (WhatsApp + email) — never let messaging break the request.
    const svc = service_type ? String(service_type) : (isCustom ? 'Bespoke' : plan);
    try {
      const idea = event_details ? ` • Idea: ${String(event_details).slice(0, 220)}` : '';
      await notifyOrganizer(
        `New request: ${customer_name} — ${svc} • ${guests} guests • ${city} • from ${start_date}. Tel: ${customer_phone || 'n/a'} • Email: ${customer_email}${idea}`
      );
    } catch (notifyError) {
      console.error('Owner WhatsApp notification failed:', notifyError);
    }
    // Owner notification + guest auto-confirmation in parallel — best-effort:
    // an email failure must never break the request the guest just submitted.
    const emailResults = await Promise.allSettled([
      sendRequestNotificationEmail({
        customer_name,
        customer_email,
        customer_phone: customer_phone || null,
        service_type: svc,
        num_guests: guests,
        city,
        event_address: event_address || null,
        start_date,
        event_details: event_details || null,
      }),
      sendRequestConfirmationToGuest({
        customer_name,
        customer_email,
        num_guests: guests,
        city,
        event_address: event_address || null,
        start_date,
        event_details: event_details || null,
      }),
    ]);
    emailResults.forEach((r) => {
      if (r.status === 'rejected') console.error('Request email failed:', r.reason);
    });

    return json({ ok: true, booking_id: booking.id }, 200);
  } catch (error: any) {
    console.error('General error creating booking request:', error);
    return json({ error: 'Failed to create booking request' }, 500);
  }
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
