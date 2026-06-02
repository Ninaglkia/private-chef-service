
import { type APIContext } from 'astro';
import { PRODUCTS } from './pricing';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const ORGANIZER_EMAIL = 'ninaglia089@gmail.com';

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
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f9f9f9; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { background-color: #111827; color: #ffffff; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 300; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 40px 30px; }
        .footer { background-color: #f3f4f6; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
        .details-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-top: 20px; }
        .details-row { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
        .details-row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .label { font-weight: 600; color: #4b5563; }
        .value { color: #111827; text-align: right; }
        .btn { display: inline-block; background-color: #d97706; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 20px; }
        .promo-box { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px dashed #d97706; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center; }
        .promo-label { font-size: 13px; color: #92400e; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; }
        .promo-code { display: inline-block; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #111827; background: #ffffff; border: 1px solid #f59e0b; border-radius: 6px; padding: 8px 16px; margin: 4px 0; }
        .promo-note { font-size: 12px; color: #92400e; margin: 8px 0 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Private Chef</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Private Chef Service. All rights reserved.</p>
          <p>This is an automated message.</p>
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

// 3. WELCOME EMAIL (new user signup or first Google login)
export async function sendWelcomeEmail(user: { email: string; full_name?: string | null }) {
  const name = user.full_name?.trim() || user.email.split('@')[0];

  const customerHtml = getHtmlTemplate(
    "Welcome to Nino's Private Chef",
    `
      <h2>Benvenuto su Nino's Private Chef, ${escapeHtml(name)}!</h2>
      <p>Grazie per esserti registrato a <strong>Nino's Private Chef</strong>.</p>
      <p>Da oggi puoi prenotare Chef Nino a domicilio: colazione, pranzo e cena preparati freschi a casa tua, o come preferisci.</p>

      <div class="promo-box">
        <p class="promo-label">Il tuo regalo di benvenuto</p>
        <span class="promo-code">BENVENUTO10</span>
        <p class="promo-note">10% di sconto sulla tua prima prenotazione</p>
      </div>

      <div class="details-box">
        <p style="margin:0;"><strong>Cosa puoi fare ora:</strong></p>
        <ul style="margin:10px 0 0 18px;padding:0;">
          <li>Prenota in pochi click con pagamento sicuro</li>
          <li>Personalizza il menù con il tuo chef</li>
          <li>La spesa è fatturata a parte, al costo</li>
        </ul>
      </div>

      <p style="text-align:center;">
        <a class="btn" href="https://ninos-privatechefs.com/#booking">Prenota ora</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">Per usare il codice, indicalo quando richiedi la prenotazione: applicheremo il 10% sul tuo Payment Link.</p>

      <p>Se hai domande, rispondi pure a questa email — il nostro team è a tua disposizione.</p>
      <p>Buon appetito,<br>Chef Nino &amp; il Team</p>
    `
  );

  const organizerHtml = getHtmlTemplate(
    'New user registered',
    `
      <h2>Nuovo utente registrato</h2>
      <div class="details-box">
        <div class="details-row"><span class="label">Nome:</span> <span class="value">${escapeHtml(name)}</span></div>
        <div class="details-row"><span class="label">Email:</span> <span class="value">${escapeHtml(user.email)}</span></div>
      </div>
    `
  );

  await Promise.all([
    sendEmail({ to: user.email, subject: "Benvenuto su Nino's Private Chef — 10% sulla prima prenotazione", html: customerHtml, from: FROM_EMAIL_CUSTOMER }),
    sendEmail({ to: ORGANIZER_EMAIL, subject: `[NEW USER] ${user.email}`, html: organizerHtml, from: FROM_EMAIL_SYSTEM }),
  ]);
}

// 3b. BIRTHDAY EMAIL (sent by the daily /api/cron/birthday job to users whose
// date of birth is today). Carries a 10% discount code, honored manually on the
// Payment Link — same mechanism as the welcome code.
export async function sendBirthdayEmail(user: { email: string; full_name?: string | null }) {
  const name = user.full_name?.trim() || user.email.split('@')[0];

  const customerHtml = getHtmlTemplate(
    'Buon compleanno!',
    `
      <h2>Buon compleanno, ${escapeHtml(name)}! 🎉</h2>
      <p>Tutto il team di <strong>Nino's Private Chef</strong> ti augura una giornata speciale.</p>
      <p>Per festeggiare, Chef Nino ha pensato a un regalo per te:</p>

      <div class="promo-box">
        <p class="promo-label">Il tuo regalo di compleanno</p>
        <span class="promo-code">COMPLEANNO10</span>
        <p class="promo-note">10% di sconto sulla tua prossima prenotazione</p>
      </div>

      <p style="text-align:center;">
        <a class="btn" href="https://ninos-privatechefs.com/#booking">Festeggia con Chef Nino</a>
      </p>
      <p style="font-size:13px;color:#6b7280;">Indica il codice quando richiedi la prenotazione: applicheremo il 10% sul tuo Payment Link.</p>
      <p>Buon appetito e tanti auguri,<br>Chef Nino &amp; il Team</p>
    `
  );

  await sendEmail({
    to: user.email,
    subject: `Buon compleanno ${name}! 🎉 Un regalo da Nino's Private Chef`,
    html: customerHtml,
    from: FROM_EMAIL_CUSTOMER,
  });
}

// 4. PAYMENT LINK (pay-later flow: owner sends a Stripe payment link to the customer)
export async function sendPaymentLinkEmail(booking: any, paymentUrl: string): Promise<void> {
  const { customer_name, customer_email, total_price, plan } = booking;
  const formattedPrice =
    total_price === null || total_price === undefined
      ? 'To be confirmed'
      : new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(total_price / 100);
  const planName = PRODUCTS[plan as keyof typeof PRODUCTS]?.name ?? plan;

  const customerHtml = getHtmlTemplate(
    'Your Private Chef payment link',
    `
      <h2>Your payment link is ready</h2>
      <p>Dear ${escapeHtml(customer_name)},</p>
      <p>Thank you for planning your menu with Chef Nino. Your Private Chef service is ready to be confirmed — please complete your payment using the secure link below.</p>

      <div class="details-box">
        <div class="details-row"><span class="label">Package:</span> <span class="value">${escapeHtml(planName)}</span></div>
        <div class="details-row"><span class="label">Amount Due:</span> <span class="value">${escapeHtml(formattedPrice)}</span></div>
      </div>

      <p style="text-align:center;">
        <a class="btn" href="${escapeHtml(paymentUrl)}">Pay now</a>
      </p>

      <p><strong>Please note:</strong> groceries are billed separately, at cost, and are not included in the amount above.</p>
      <p>If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtml(paymentUrl)}">${escapeHtml(paymentUrl)}</a></p>
    `
  );

  await sendEmail({
    to: customer_email,
    subject: 'Your Private Chef payment link',
    html: customerHtml,
    from: FROM_EMAIL_CUSTOMER,
  });
}
