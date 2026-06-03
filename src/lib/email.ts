
import { type APIContext } from 'astro';
import { PRODUCTS } from './pricing';
import { ORGANIZER_EMAIL } from './admin';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;

// This app may ONLY send from its own verified domain. The EMAIL_FROM /
// EMAIL_SYSTEM env vars have been copied from other projects before (e.g. a
// "Chef Nino <chef@cleanhomeapp.com>" value leaked in from the CleanHome app and
// every email went out from the wrong brand). enforceSenderDomain() guarantees
// the sender is always @ninos-privatechefs.com regardless of a misconfigured env,
// preserving any display name. Update SENDER_DOMAIN if the sending domain changes.
const SENDER_DOMAIN = 'ninos-privatechefs.com';

function enforceSenderDomain(rawFrom: string | undefined, fallbackLocalPart: string): string {
  const fallback = `${fallbackLocalPart}@${SENDER_DOMAIN}`;
  if (!rawFrom) return fallback;

  // Split an optional "Display Name <addr>" wrapper from the bare address.
  let displayName = '';
  let addr = rawFrom.trim();
  const angle = addr.match(/^(.*)<([^>]+)>\s*$/);
  if (angle) {
    displayName = angle[1].trim().replace(/^"|"$/g, '').trim();
    addr = angle[2].trim();
  }

  const at = addr.match(/^([^@\s<>]+)@([^@\s<>]+)$/);
  if (!at) return fallback;
  const localPart = at[1];
  const domain = at[2].toLowerCase();
  const email = domain === SENDER_DOMAIN ? `${localPart}@${domain}` : fallback;
  return displayName ? `${displayName} <${email}>` : email;
}

const FROM_EMAIL_CUSTOMER = enforceSenderDomain(import.meta.env.EMAIL_FROM, 'info');
const FROM_EMAIL_SYSTEM = enforceSenderDomain(import.meta.env.EMAIL_SYSTEM, 'sistema');

// Reusable Stripe "pay what you want" link for optional gratuity. Customers can
// enter any amount. Shared in the booking confirmation (thank-you) email.
const TIP_PAYMENT_LINK = 'https://buy.stripe.com/4gM6oH72G13X1WQ8DF9fW05';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Escape user-controlled values before interpolating them into HTML email
 * templates. Prevents stored XSS and broken markup.
 */
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Bulletproof email button. Mobile mail clients (notably the Gmail iOS/Android
 * apps) frequently strip the <head><style> block, which would leave a class-only
 * <a class="btn"> as an unstyled — sometimes invisible or hard-to-tap — link.
 * Inlining every style on a table-wrapped anchor guarantees the button renders
 * and is tappable even with zero <head> CSS. Use this for EVERY actionable
 * button in transactional emails.
 */
function emailButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:26px auto 8px;border-collapse:separate;">
      <tr><td align="center" style="border-radius:999px;background-color:#17130d;">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:15px 36px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;line-height:1;letter-spacing:0.4px;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
      </td></tr>
    </table>`;
}

/**
 * Generic function to send email via Resend
 */
export async function sendEmail(data: EmailData): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not defined. Email not sent.');
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Always force the sender onto the verified domain, even for a per-call from.
        from: enforceSenderDomain(data.from || FROM_EMAIL_CUSTOMER, 'info'),
        to: data.to,
        subject: data.subject,
        html: data.html,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('Resend API Error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    return false;
  }
}

/**
 * Base HTML Template
 */
function getHtmlTemplate(title: string, content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light only">
      <title>${title}</title>
      <style>
        body { margin: 0; padding: 0; background-color: #efe9df; -webkit-font-smoothing: antialiased; }
        .wrap { width: 100%; background-color: #efe9df; padding: 32px 12px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e7dfd0; box-shadow: 0 10px 30px rgba(31,26,18,0.08); }

        .header { background: #17130d; padding: 40px 30px 34px; text-align: center; }
        .avatar { width: 78px; height: 78px; border-radius: 50%; object-fit: cover; object-position: center 12%; border: 2px solid #c6a15b; display: block; margin: 0 auto 16px; }
        .eyebrow { color: #c6a15b; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin: 0; }
        .brand { color: #ffffff; font-family: Georgia, 'Times New Roman', serif; font-size: 27px; letter-spacing: 0.5px; margin: 8px 0 0; }
        .rule { width: 44px; height: 1px; background: #c6a15b; margin: 16px auto 0; opacity: 0.8; }

        .content { padding: 40px 36px 8px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #4a443b; }
        .content h2 { font-family: Georgia, 'Times New Roman', serif; font-weight: 600; color: #17130d; font-size: 23px; line-height: 1.3; margin: 0 0 16px; }
        .content p { font-size: 15px; line-height: 1.75; color: #575147; margin: 0 0 16px; }
        .content ul { margin: 10px 0 0 0; padding: 0 0 0 18px; }
        .content li { font-size: 15px; line-height: 1.7; color: #575147; margin-bottom: 6px; }

        .promo-box { background: #fbf7ef; border: 1px solid #e6d4ac; border-radius: 14px; padding: 26px 20px; margin: 26px 0; text-align: center; }
        .promo-label { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #a07b35; text-transform: uppercase; letter-spacing: 2.5px; margin: 0 0 12px; }
        .promo-code { display: inline-block; font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; letter-spacing: 4px; color: #17130d; background: #ffffff; border: 1px dashed #c6a15b; border-radius: 10px; padding: 12px 22px; margin: 0; }
        .promo-note { font-size: 13px; color: #a07b35; margin: 12px 0 0; }

        .btn-wrap { text-align: center; margin: 28px 0 8px; }
        .btn { display: inline-block; background-color: #17130d; color: #ffffff !important; padding: 14px 34px; text-decoration: none; border-radius: 999px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.6px; }

        .details-box { background-color: #faf7f1; border: 1px solid #ece3d3; border-radius: 12px; padding: 22px; margin: 22px 0; }
        .details-row { border-bottom: 1px solid #ece3d3; padding: 8px 0; }
        .details-row:last-child { border-bottom: none; padding-bottom: 0; }
        .label { font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 600; color: #8a8174; font-size: 13px; }
        .value { color: #17130d; font-size: 14px; }
        .fine { font-size: 13px; color: #8a8174; }

        .footer { background: #17130d; padding: 30px; text-align: center; font-family: 'Helvetica Neue', Arial, sans-serif; }
        .footer .fbrand { font-family: Georgia, serif; color: #ffffff; font-size: 16px; margin: 0 0 4px; }
        .footer p { color: #9b938a; font-size: 12px; line-height: 1.6; margin: 4px 0; }
        .footer a { color: #c6a15b; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="container">
          <div class="header">
            <img class="avatar" src="https://ninos-privatechefs.com/images/chef.jpg" width="78" height="78" alt="Chef Nino" />
            <p class="eyebrow">Private Chef at Home</p>
            <p class="brand">Nino's Private Chef</p>
            <div class="rule"></div>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p class="fbrand">Nino's Private Chef</p>
            <p>Signature dining at home · Lombardy &amp; beyond</p>
            <p><a href="https://ninos-privatechefs.com">ninos-privatechefs.com</a> &nbsp;·&nbsp; <a href="mailto:info@ninos-privatechefs.com">info@ninos-privatechefs.com</a></p>
            <p>&copy; ${new Date().getFullYear()} Nino's Private Chef · This is an automated email</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * NOTIFICATION HANDLERS
 */

// 1. QUOTE REQUEST
export async function sendQuoteRequestEmails(data: any) {
  const { customer_name, customer_email, city, start_date, num_guests, notes } = data;

  // A. Customer Email
  const customerHtml = getHtmlTemplate(
    'Quote Request Received',
    `
      <h2>Thank you for your interest, ${escapeHtml(customer_name)}</h2>
      <p>We have received your request for a custom quote. Our team will review your requirements and get back to you within 24 hours.</p>

      <div class="details-box">
        <div class="details-row"><span class="label">Location:</span> <span class="value">${escapeHtml(city)}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${escapeHtml(start_date)}</span></div>
        <div class="details-row"><span class="label">Guests:</span> <span class="value">${escapeHtml(num_guests)}</span></div>
      </div>
      
      <p>If you have any urgent questions, please reply to this email.</p>
    `
  );

  // B. Organizer Email
  const organizerHtml = getHtmlTemplate(
    'New Quote Request',
    `
      <h2>New Quote Request Received</h2>
      <p>A new potential client has requested a custom quote.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="label">Name:</span> <span class="value">${escapeHtml(customer_name)}</span></div>
        <div class="details-row"><span class="label">Email:</span> <span class="value"><a href="mailto:${escapeHtml(customer_email)}">${escapeHtml(customer_email)}</a></span></div>
        <div class="details-row"><span class="label">Phone:</span> <span class="value">${escapeHtml(data.customer_phone || 'N/A')}</span></div>
        <div class="details-row"><span class="label">Location:</span> <span class="value">${escapeHtml(city)}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${escapeHtml(start_date)}</span></div>
        <div class="details-row"><span class="label">Guests:</span> <span class="value">${escapeHtml(num_guests)}</span></div>
        <div class="details-row"><span class="label">Notes:</span> <span class="value">${escapeHtml(notes || 'None')}</span></div>
      </div>
    `
  );

  // Send in parallel
  await Promise.all([
    sendEmail({ to: customer_email, subject: 'We received your Private Chef Quote Request', html: customerHtml, from: FROM_EMAIL_CUSTOMER }),
    sendEmail({ to: ORGANIZER_EMAIL, subject: `[NEW QUOTE] ${customer_name} - ${city}`, html: organizerHtml, from: FROM_EMAIL_SYSTEM })
  ]);
}

// 2. BOOKING CONFIRMATION
export async function sendBookingConfirmationEmails(booking: any) {
  const { customer_name, customer_email, city, start_date, num_guests, total_price, plan, customer_phone } = booking;
  const formattedPrice = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(total_price / 100);
  const planName = PRODUCTS[plan as keyof typeof PRODUCTS]?.name ?? plan;

  // A. Customer Email
  const customerHtml = getHtmlTemplate(
    'Booking Confirmed',
    `
      <h2>Booking Confirmed</h2>
      <p>Dear ${escapeHtml(customer_name)},</p>
      <p>We are delighted to confirm your Private Chef booking. Your payment has been successfully processed.</p>

      <div class="details-box">
        <div class="details-row"><span class="label">Booking Ref:</span> <span class="value">#${escapeHtml(booking.id.slice(0, 8))}</span></div>
        <div class="details-row"><span class="label">Package:</span> <span class="value">${escapeHtml(planName)}</span></div>
        <div class="details-row"><span class="label">Location:</span> <span class="value">${escapeHtml(city)}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${escapeHtml(start_date)}</span></div>
        <div class="details-row"><span class="label">Guests:</span> <span class="value">${escapeHtml(num_guests)}</span></div>
        <div class="details-row"><span class="label">Total Paid:</span> <span class="value">${escapeHtml(formattedPrice)}</span></div>
      </div>

      <p><strong>Please note:</strong> groceries are billed separately, at cost, and are not included in the amount above.</p>
      <p><strong>Next Steps:</strong> Chef Nino will contact you shortly to discuss menu preferences and dietary requirements.</p>
    `
  );

  // B. Organizer Email
  const organizerHtml = getHtmlTemplate(
    'New Booking Confirmed',
    `
      <h2>New Booking Confirmed! 💰</h2>
      <p>A new payment has been received via Stripe.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="label">Customer:</span> <span class="value">${escapeHtml(customer_name)}</span></div>
        <div class="details-row"><span class="label">Email:</span> <span class="value">${escapeHtml(customer_email)}</span></div>
        <div class="details-row"><span class="label">Phone:</span> <span class="value">${escapeHtml(customer_phone || 'N/A')}</span></div>
        <div class="details-row"><span class="label">Package:</span> <span class="value">${escapeHtml(planName)}</span></div>
        <div class="details-row"><span class="label">Amount:</span> <span class="value">${escapeHtml(formattedPrice)}</span></div>
        <div class="details-row"><span class="label">Location:</span> <span class="value">${escapeHtml(city)}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${escapeHtml(start_date)}</span></div>
      </div>
      
      <p>Check Supabase dashboard for full details.</p>
    `
  );

  // Send in parallel
  await Promise.all([
    sendEmail({ to: customer_email, subject: 'Booking Confirmation - Private Chef Service', html: customerHtml, from: FROM_EMAIL_CUSTOMER }),
    sendEmail({ to: ORGANIZER_EMAIL, subject: `[NEW BOOKING] ${customer_name} - ${formattedPrice}`, html: organizerHtml, from: FROM_EMAIL_SYSTEM })
  ]);
}

// 2b. THANK-YOU EMAIL (sent the day AFTER the event by the thank-you cron, once
// the guest has actually experienced the service). Carries the optional tip link.
export async function sendThankYouEmail(booking: any): Promise<void> {
  const { customer_name, customer_email } = booking;
  const firstName = String(customer_name || '').trim().split(/\s+/)[0] || 'there';

  const customerHtml = getHtmlTemplate(
    'Thank you',
    `
      <h2>Thank you for choosing Nino's Private Chef</h2>
      <p>Dear ${escapeHtml(firstName)},</p>
      <p>It was a true pleasure to cook for you. We hope every dish lived up to the occasion and that you and your guests enjoyed the experience as much as Chef Nino enjoyed creating it.</p>
      <p>If you'd like to share your appreciation, you can leave Chef Nino a tip below — any amount you wish. It's entirely optional and always warmly appreciated.</p>
      ${emailButton(TIP_PAYMENT_LINK, 'Leave a tip')}
      <p style="text-align:center;" class="fine">Thank you again for welcoming us to your table. We would be honoured to cook for you again.</p>
    `
  );

  await sendEmail({
    to: customer_email,
    subject: "Thank you for choosing Nino's Private Chef",
    html: customerHtml,
    from: FROM_EMAIL_CUSTOMER,
  });
}

// 3. WELCOME EMAIL (new user signup or first Google login)
export async function sendWelcomeEmail(user: { email: string; full_name?: string | null }) {
  const name = user.full_name?.trim() || user.email.split('@')[0];

  const customerHtml = getHtmlTemplate(
    "Welcome to Nino's Private Chef",
    `
      <img src="https://ninos-privatechefs.com/images/dish1.jpg" alt="A dish by Chef Nino" style="width:100%;border-radius:12px;display:block;margin:0 0 26px;" />
      <h2>Welcome to Nino's Private Chef, ${escapeHtml(name)}!</h2>
      <p>Thank you for signing up to <strong>Nino's Private Chef</strong>.</p>
      <p>From today you can book Chef Nino to cook at your home: breakfast, lunch and dinner prepared fresh in your kitchen, however you prefer.</p>

      <div class="promo-box">
        <p class="promo-label">Your welcome gift</p>
        <span class="promo-code">BENVENUTO10</span>
        <p class="promo-note">10% off your first booking</p>
      </div>

      <div class="details-box">
        <p style="margin:0;"><strong>What you can do now:</strong></p>
        <ul style="margin:10px 0 0 18px;padding:0;">
          <li>Book in just a few clicks with secure payment</li>
          <li>Personalise the menu with your chef</li>
          <li>Groceries are billed separately, at cost</li>
        </ul>
      </div>

      ${emailButton('https://ninos-privatechefs.com/richiesta', 'Book now')}
      <p style="font-size:13px;color:#6b7280;">To use the code, mention it when you submit your booking request: we will apply the 10% to your Payment Link.</p>

      <p>If you have any questions, feel free to reply to this email — our team is here to help.</p>
      <p>Enjoy your meal,<br>Chef Nino &amp; the Team</p>
    `
  );

  const organizerHtml = getHtmlTemplate(
    'New user registered',
    `
      <h2>New user registered</h2>
      <div class="details-box">
        <div class="details-row"><span class="label">Name:</span> <span class="value">${escapeHtml(name)}</span></div>
        <div class="details-row"><span class="label">Email:</span> <span class="value">${escapeHtml(user.email)}</span></div>
      </div>
    `
  );

  await Promise.all([
    sendEmail({ to: user.email, subject: "Welcome to Nino's Private Chef — 10% off your first booking", html: customerHtml, from: FROM_EMAIL_CUSTOMER }),
    sendEmail({ to: ORGANIZER_EMAIL, subject: `[NEW USER] ${user.email}`, html: organizerHtml, from: FROM_EMAIL_SYSTEM }),
  ]);
}

// 3b. BIRTHDAY EMAIL (sent by the daily /api/cron/birthday job to users whose
// date of birth is today). Carries a 10% discount code, honored manually on the
// Payment Link — same mechanism as the welcome code.
export async function sendBirthdayEmail(user: { email: string; full_name?: string | null }) {
  const name = user.full_name?.trim() || user.email.split('@')[0];

  const customerHtml = getHtmlTemplate(
    'Happy birthday!',
    `
      <img src="https://ninos-privatechefs.com/images/dish2.jpg" alt="A dish by Chef Nino" style="width:100%;border-radius:12px;display:block;margin:0 0 26px;" />
      <h2>Happy birthday, ${escapeHtml(name)}! 🎉</h2>
      <p>The whole team at <strong>Nino's Private Chef</strong> wishes you a wonderful day.</p>
      <p>To celebrate, Chef Nino has prepared a gift for you:</p>

      <div class="promo-box">
        <p class="promo-label">Your birthday gift</p>
        <span class="promo-code">COMPLEANNO10</span>
        <p class="promo-note">10% off your next booking</p>
      </div>

      ${emailButton('https://ninos-privatechefs.com/#booking', 'Celebrate with Chef Nino')}
      <p style="font-size:13px;color:#6b7280;">Mention the code when you submit your booking request: we will apply the 10% to your Payment Link.</p>
      <p>Enjoy your meal and best wishes,<br>Chef Nino &amp; the Team</p>
    `
  );

  await sendEmail({
    to: user.email,
    subject: `Happy birthday ${name}! 🎉 A gift from Nino's Private Chef`,
    html: customerHtml,
    from: FROM_EMAIL_CUSTOMER,
  });
}

// 3d. NEW REQUEST (owner summary email when a client submits the request form)
export async function sendRequestNotificationEmail(data: {
  customer_name: string;
  customer_email: string;
  customer_phone?: string | null;
  service_type?: string | null;
  num_guests?: number | string | null;
  city?: string | null;
  event_address?: string | null;
  start_date?: string | null;
  event_details?: string | null;
}) {
  const row = (label: string, value: unknown) =>
    value
      ? `<div class="details-row"><span class="label">${escapeHtml(label)}:</span> <span class="value">${escapeHtml(String(value))}</span></div>`
      : '';
  const html = getHtmlTemplate(
    'New request',
    `
      <h2>New booking request</h2>
      <p>A client has submitted a request from the website:</p>
      <div class="details-box">
        ${row('Name', data.customer_name)}
        ${row('Email', data.customer_email)}
        ${row('Phone', data.customer_phone)}
        ${row('Service', data.service_type)}
        ${row('Guests', data.num_guests)}
        ${row('Where', data.city)}
        ${row('Address', data.event_address)}
        ${row('When', data.start_date)}
      </div>
      ${data.event_details ? `<p style="margin-top:16px;"><strong>Their idea:</strong></p><div class="details-box"><p style="margin:0;">${escapeHtml(data.event_details)}</p></div>` : ''}
    `
  );
  await sendEmail({
    to: ORGANIZER_EMAIL,
    subject: `[REQUEST] ${data.customer_name}${data.service_type ? ' — ' + data.service_type : ''}`,
    html,
    from: FROM_EMAIL_SYSTEM,
  });
}

// 3a. REQUEST CONFIRMATION TO THE GUEST (auto-reply after a website request).
// The owner gets the [REQUEST] alert; this reassures the guest that their
// request actually arrived and sets the "Chef Nino will reply shortly"
// expectation. Sent from the customer-facing address, branded like the rest.
export async function sendRequestConfirmationToGuest(data: {
  customer_name: string;
  customer_email: string;
  num_guests?: number | string | null;
  city?: string | null;
  event_address?: string | null;
  start_date?: string | null;
  event_details?: string | null;
}) {
  const name = (data.customer_name || '').trim() || 'there';
  const row = (label: string, value: unknown) =>
    value
      ? `<div class="details-row"><span class="label">${escapeHtml(label)}:</span> <span class="value">${escapeHtml(String(value))}</span></div>`
      : '';
  const html = getHtmlTemplate(
    'Request received',
    `
      <h2>Thank you, ${escapeHtml(name)} — we've received your request</h2>
      <p>Chef Nino will personally look over the evening you have in mind and get back to you <strong>very shortly</strong> with a bespoke proposal and a price. There is <strong>no payment now</strong>.</p>

      <div class="details-box">
        ${row('Guests', data.num_guests)}
        ${row('Where', data.city)}
        ${row('Address', data.event_address)}
        ${row('When', data.start_date)}
      </div>
      ${data.event_details ? `<p style="margin-top:4px;"><strong>What you told us:</strong></p><div class="details-box"><p style="margin:0;">${escapeHtml(data.event_details)}</p></div>` : ''}

      <p>Prefer to talk it through? You can reach Chef Nino directly on WhatsApp.</p>
      ${emailButton('https://wa.me/393285515590', 'Message Chef Nino')}

      <p class="fine">Groceries are billed separately, at cost. If anything changes, just reply to this email.</p>
      <p>À bientôt,<br>Chef Nino</p>
    `
  );
  await sendEmail({
    to: data.customer_email,
    subject: "We've received your request — Nino's Private Chef",
    html,
    from: FROM_EMAIL_CUSTOMER,
  });
}

// 4a. BOOKING CONFIRMATION + PAYMENT LINK (owner-driven, after the WhatsApp chat).
// The owner pastes the Stripe link + the agreed recap and price; this sends the
// branded "confirm your booking" email to the guest, from the customer address.
export async function sendBookingConfirmationLinkEmail(data: {
  customer_name: string;
  customer_email: string;
  payment_url: string;
  price_eur: number;
  recap: string;
  num_guests?: number | string | null;
  city?: string | null;
  event_address?: string | null;
  start_date?: string | null;
}) {
  const name = (data.customer_name || '').trim() || 'there';
  const priceFmt = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(
    Number.isFinite(data.price_eur) ? data.price_eur : 0
  );
  const recapHtml = escapeHtml(data.recap).replace(/\n/g, '<br>');
  const row = (label: string, value: unknown) =>
    value
      ? `<div class="details-row"><span class="label">${escapeHtml(label)}:</span> <span class="value">${escapeHtml(String(value))}</span></div>`
      : '';
  const html = getHtmlTemplate(
    'Confirm your booking',
    `
      <h2>Confirm your booking with Chef Nino</h2>
      <p>Dear ${escapeHtml(name)},</p>
      <p>As agreed, here is the confirmation of your bespoke dining experience with Chef Nino. To secure your date, simply complete the payment with the secure link below.</p>

      <div class="details-box">
        ${row('Guests', data.num_guests)}
        ${row('Where', data.city)}
        ${row('Address', data.event_address)}
        ${row('When', data.start_date)}
        <div class="details-row"><span class="label">Total:</span> <span class="value">${escapeHtml(priceFmt)}</span></div>
      </div>
      ${data.recap ? `<p style="margin-top:4px;"><strong>What we agreed:</strong></p><div class="details-box"><p style="margin:0;">${recapHtml}</p></div>` : ''}

      ${emailButton(data.payment_url, 'Confirm & pay')}

      <p class="fine">Groceries are billed separately, at cost, and are not included in the amount above. If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(data.payment_url)}">${escapeHtml(data.payment_url)}</a></p>
      <p>À bientôt,<br>Chef Nino</p>
    `
  );
  await sendEmail({
    to: data.customer_email,
    subject: "Confirm your booking — Nino's Private Chef",
    html,
    from: FROM_EMAIL_CUSTOMER,
  });
}

// 3c. CHAT NOTIFICATION (owner alert when a client sends a chat message)
export async function sendChatNotificationEmail(data: { clientName?: string | null; body: string }) {
  const name = data.clientName?.trim() || 'A client';
  const html = getHtmlTemplate(
    'New message',
    `
      <h2>New chat message</h2>
      <p><strong>${escapeHtml(name)}</strong> has written to you:</p>
      <div class="details-box"><p style="margin:0;">${escapeHtml(data.body)}</p></div>
    `
  );
  await sendEmail({
    to: ORGANIZER_EMAIL,
    subject: `[CHAT] New message from ${name}`,
    html,
    from: FROM_EMAIL_SYSTEM,
  });
}

// 4. PAYMENT LINK (pay-later flow: owner sends a Stripe payment link to the customer)
export async function sendPaymentLinkEmail(booking: any, paymentUrl: string): Promise<void> {
  const { customer_name, customer_email, total_price, chef_payout, grocery_budget, plan } = booking;
  const fmt = (c: number | null | undefined) =>
    c === null || c === undefined
      ? 'To be confirmed'
      : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(c / 100);
  const planName = PRODUCTS[plan as keyof typeof PRODUCTS]?.name ?? plan;
  const hasBreakdown = typeof chef_payout === 'number' && typeof grocery_budget === 'number' && grocery_budget > 0;

  const breakdownRows = hasBreakdown
    ? `
        <div class="details-row"><span class="label">Chef fee:</span> <span class="value">${escapeHtml(fmt(chef_payout))}</span></div>
        <div class="details-row"><span class="label">Groceries (estimate):</span> <span class="value">${escapeHtml(fmt(grocery_budget))}</span></div>`
    : '';

  const customerHtml = getHtmlTemplate(
    'Your payment link',
    `
      <h2>Your payment link is ready</h2>
      <p>Dear ${escapeHtml(customer_name)},</p>
      <p>Thank you for planning the menu with Chef Nino. Your service is ready to be confirmed: complete the payment using the secure link below.</p>

      <div class="details-box">
        <div class="details-row"><span class="label">Package:</span> <span class="value">${escapeHtml(planName)}</span></div>${breakdownRows}
        <div class="details-row"><span class="label">Total to pay:</span> <span class="value">${escapeHtml(fmt(total_price))}</span></div>
      </div>

      ${emailButton(paymentUrl, 'Pay now')}

      ${hasBreakdown
        ? `<p class="fine"><strong>Note on groceries:</strong> the amount includes an <strong>estimate of the groceries</strong>. After the service we settle against the actual receipts: if the real grocery cost is lower, we refund you the difference.</p>`
        : `<p class="fine"><strong>Note:</strong> groceries are billed separately, at cost, and are not included in the amount above.</p>`}
      <p class="fine">If the button doesn't work, copy this link into your browser:<br><a href="${escapeHtml(paymentUrl)}">${escapeHtml(paymentUrl)}</a></p>
    `
  );

  await sendEmail({
    to: customer_email,
    subject: "Your payment link — Nino's Private Chef",
    html: customerHtml,
    from: FROM_EMAIL_CUSTOMER,
  });
}

// 5. RECRUITMENT APPLICATION ("Work with us"): confirmation to the candidate +
// alert to the owner. Every dynamic value is escaped — these come from a public,
// untrusted form, so the old unescaped notify-recruitment endpoint was an XSS
// vector in the owner's inbox. Sender is forced onto the verified domain.
export async function sendRecruitmentEmails(data: {
  first_name: string;
  last_name?: string | null;
  email: string;
  phone?: string | null;
  role?: string | null;
  availability?: string | null;
  city?: string | null;
  bio?: string | null;
}): Promise<void> {
  const fullName = `${data.first_name}${data.last_name ? ' ' + data.last_name : ''}`.trim();
  const roleLabel =
    data.role === 'chef' ? 'Private Chef'
    : data.role === 'waiter' ? 'Waiter / Front-of-House'
    : (data.role || '—');

  const candidateHtml = getHtmlTemplate(
    'Application received',
    `
      <h2>Thank you for your application, ${escapeHtml(data.first_name)}!</h2>
      <p>We have received your application for the <strong>${escapeHtml(roleLabel)}</strong> position${data.city ? ' in ' + escapeHtml(data.city) : ''}.</p>
      <p>Our team will review your profile and get in touch if there is an opportunity matching your skills.</p>
      <p>Kind regards,<br>Nino's Private Chef Team</p>
    `
  );

  const row = (label: string, value: unknown) =>
    value
      ? `<div class="details-row"><span class="label">${escapeHtml(label)}:</span> <span class="value">${escapeHtml(String(value))}</span></div>`
      : '';

  const ownerHtml = getHtmlTemplate(
    'New application',
    `
      <h2>New job application</h2>
      <p>A new candidate applied via the website:</p>
      <div class="details-box">
        ${row('Name', fullName)}
        ${row('Role', roleLabel)}
        ${row('Availability', data.availability)}
        ${row('City', data.city)}
        ${row('Email', data.email)}
        ${row('Phone', data.phone)}
      </div>
      ${data.bio ? `<p style="margin-top:16px;"><strong>Introduction:</strong></p><div class="details-box"><p style="margin:0;">${escapeHtml(data.bio)}</p></div>` : ''}
    `
  );

  await Promise.all([
    sendEmail({ to: data.email, subject: "We received your application — Nino's Private Chef", html: candidateHtml, from: FROM_EMAIL_CUSTOMER }),
    sendEmail({ to: ORGANIZER_EMAIL, subject: `[APPLICATION] ${fullName} — ${roleLabel}`, html: ownerHtml, from: FROM_EMAIL_SYSTEM }),
  ]);
}
