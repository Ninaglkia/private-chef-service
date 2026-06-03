import type { APIRoute } from 'astro';
import { sendEmail } from '../../lib/email';
import { sendMessage, notifyOrganizer } from '../../lib/sms';
import { rateLimit, getClientIp } from '../../lib/rate-limit';

const OWNER_EMAIL = 'ninaglia089@gmail.com';

// Escape user-controlled values before interpolating into HTML email bodies.
function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// One-line, length-capped value for email subjects (prevents header injection).
function subjectSafe(value: unknown, max = 120): string {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Per-IP rate limiting (blunts obvious spam; for strict global limits move to Upstash).
    const ip = getClientIp(request);
    const limit = rateLimit(`notify-recruitment:${ip}`, { limit: 5, windowMs: 60_000 });
    if (!limit.ok) {
      return new Response(JSON.stringify({ error: 'Too many requests, please try again shortly.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfterSec) },
      });
    }

    const data = await request.json().catch(() => ({}));
    const { firstName, lastName, email, phone, role, city, company_website } = data as Record<string, any>;

    // Honeypot: real users never fill this. If present, pretend success and bail.
    if (company_website && String(company_website).trim() !== '') {
      return json({ success: true }, 200);
    }

    if (!email || !firstName) {
      return json({ error: 'Missing required fields' }, 400);
    }

    const fullName = `${escapeHtml(firstName)} ${escapeHtml(lastName)}`;
    const roleE = escapeHtml(role);
    const cityE = escapeHtml(city);

    // 1. Email to Candidate
    const candidateHtml = `
      <h2>Thank you for your application, ${escapeHtml(firstName)}!</h2>
      <p>We have received your application for the position of <strong>${roleE}</strong> in ${cityE}.</p>
      <p>Our team will review your profile and get in touch with you soon if there are opportunities matching your skills.</p>
      <br>
      <p>Kind regards,<br>The Private Chef Team</p>
    `;

    await sendEmail({
      to: String(email),
      subject: 'Application received - Private Chef',
      html: candidateHtml,
    });

    // 2. WhatsApp to Candidate (plain text — not HTML — so no escaping needed)
    if (phone) {
      const waMsg = `Hi ${firstName}, thank you for applying as ${role}. We have received your details and will be in touch soon!`;
      await sendMessage({ to: String(phone), body: waMsg, channel: 'whatsapp' });
    }

    // 3. Email to Admin
    const adminHtml = `
      <h2>New Application Received</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Role:</strong> ${roleE}</p>
      <p><strong>City:</strong> ${cityE}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || 'N/A')}</p>
      <br>
      <p>Open the Supabase dashboard to view the CV and photos for this application.</p>
    `;

    await sendEmail({
      to: OWNER_EMAIL,
      subject: subjectSafe(`New Application: ${firstName} ${lastName || ''} (${role || ''})`),
      html: adminHtml,
    });

    // 4. WhatsApp to Admin (plain text)
    const adminWaMsg = `🔔 New Application!\n${firstName} ${lastName || ''} applied as ${role} in ${city}.`;
    await notifyOrganizer(adminWaMsg);

    return json({ success: true }, 200);
  } catch (error) {
    console.error('Notification error:', error);
    return json({ error: 'Internal Server Error' }, 500);
  }
};
