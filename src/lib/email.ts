
import { type APIContext } from 'astro';

const RESEND_API_KEY = import.meta.env.RESEND_API_KEY;
const ORGANIZER_EMAIL = 'ninaglia089@gmail.com';
const FROM_EMAIL_CUSTOMER = import.meta.env.EMAIL_FROM || 'info@weeklyprivatechef.com';
const FROM_EMAIL_SYSTEM = import.meta.env.EMAIL_SYSTEM || 'sistema@weeklyprivatechef.com';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Generic function to send email via Resend
 */
async function sendEmail(data: EmailData): Promise<boolean> {
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
        from: data.from || FROM_EMAIL_CUSTOMER,
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
      <h2>Thank you for your interest, ${customer_name}</h2>
      <p>We have received your request for a custom quote. Our team will review your requirements and get back to you within 24 hours.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="label">Location:</span> <span class="value">${city}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${start_date}</span></div>
        <div class="details-row"><span class="label">Guests:</span> <span class="value">${num_guests}</span></div>
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
        <div class="details-row"><span class="label">Name:</span> <span class="value">${customer_name}</span></div>
        <div class="details-row"><span class="label">Email:</span> <span class="value"><a href="mailto:${customer_email}">${customer_email}</a></span></div>
        <div class="details-row"><span class="label">Phone:</span> <span class="value">${data.customer_phone || 'N/A'}</span></div>
        <div class="details-row"><span class="label">Location:</span> <span class="value">${city}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${start_date}</span></div>
        <div class="details-row"><span class="label">Guests:</span> <span class="value">${num_guests}</span></div>
        <div class="details-row"><span class="label">Notes:</span> <span class="value">${notes || 'None'}</span></div>
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

  // A. Customer Email
  const customerHtml = getHtmlTemplate(
    'Booking Confirmed',
    `
      <h2>Booking Confirmed</h2>
      <p>Dear ${customer_name},</p>
      <p>We are delighted to confirm your Weekly Private Chef booking. Your payment has been successfully processed.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="label">Booking Ref:</span> <span class="value">#${booking.id.slice(0, 8)}</span></div>
        <div class="details-row"><span class="label">Plan:</span> <span class="value" style="text-transform: capitalize;">${plan.replace('_', ' ')}</span></div>
        <div class="details-row"><span class="label">Location:</span> <span class="value">${city}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${start_date}</span></div>
        <div class="details-row"><span class="label">Guests:</span> <span class="value">${num_guests}</span></div>
        <div class="details-row"><span class="label">Total Paid:</span> <span class="value">${formattedPrice}</span></div>
      </div>
      
      <p><strong>Next Steps:</strong> Our concierge team will contact you shortly to discuss menu preferences and dietary requirements.</p>
    `
  );

  // B. Organizer Email
  const organizerHtml = getHtmlTemplate(
    'New Booking Confirmed',
    `
      <h2>New Booking Confirmed! 💰</h2>
      <p>A new payment has been received via Stripe.</p>
      
      <div class="details-box">
        <div class="details-row"><span class="label">Customer:</span> <span class="value">${customer_name}</span></div>
        <div class="details-row"><span class="label">Email:</span> <span class="value">${customer_email}</span></div>
        <div class="details-row"><span class="label">Phone:</span> <span class="value">${customer_phone || 'N/A'}</span></div>
        <div class="details-row"><span class="label">Plan:</span> <span class="value">${plan}</span></div>
        <div class="details-row"><span class="label">Amount:</span> <span class="value">${formattedPrice}</span></div>
        <div class="details-row"><span class="label">Location:</span> <span class="value">${city}</span></div>
        <div class="details-row"><span class="label">Start Date:</span> <span class="value">${start_date}</span></div>
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
