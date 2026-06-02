
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
    <html lang="it">
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
            <p>Cucina d'autore a domicilio · Lombardia &amp; oltre</p>
            <p><a href="https://ninos-privatechefs.com">ninos-privatechefs.com</a> &nbsp;·&nbsp; <a href="mailto:info@ninos-privatechefs.com">info@ninos-privatechefs.com</a></p>
            <p>&copy; ${new Date().getFullYear()} Nino's Private Chef · Questa è un'email automatica</p>
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

// 3. WELCOME EMAIL (new user signup or first Google login)
export async function sendWelcomeEmail(user: { email: string; full_name?: string | null }) {
  const name = user.full_name?.trim() || user.email.split('@')[0];

  const customerHtml = getHtmlTemplate(
    "Welcome to Nino's Private Chef",
    `
      <img src="https://ninos-privatechefs.com/images/dish1.jpg" alt="Un piatto di Chef Nino" style="width:100%;border-radius:12px;display:block;margin:0 0 26px;" />
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
      <img src="https://ninos-privatechefs.com/images/dish2.jpg" alt="Un piatto di Chef Nino" style="width:100%;border-radius:12px;display:block;margin:0 0 26px;" />
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
