
import type { APIRoute } from 'astro';
import { sendEmail } from '../../lib/email';
import { sendMessage, notifyOrganizer } from '../../lib/sms';

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { firstName, lastName, email, phone, role, city } = data;

    if (!email || !firstName) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    const fullName = `${firstName} ${lastName}`;
    const subject = `Application Received: ${role} - ${fullName}`;

    // 1. Email to Candidate
    const candidateHtml = `
      <h2>Thank you for your application, ${firstName}!</h2>
      <p>We have received your application for the position of <strong>${role}</strong> in ${city}.</p>
      <p>Our team will review your profile and get in touch with you soon if there are opportunities matching your skills.</p>
      <br>
      <p>Kind regards,<br>The Private Chef Team</p>
    `;

    await sendEmail({
      to: email,
      subject: 'Application received - Private Chef',
      html: candidateHtml
    });

    // 2. WhatsApp to Candidate (if phone provided)
    if (phone) {
      const waMsg = `Hi ${firstName}, thank you for applying as ${role}. We have received your details and will be in touch soon!`;
      await sendMessage({ to: phone, body: waMsg, channel: 'whatsapp' });
    }

    // 3. Email to Admin
    const adminHtml = `
      <h2>New Application Received</h2>
      <p><strong>Name:</strong> ${fullName}</p>
      <p><strong>Role:</strong> ${role}</p>
      <p><strong>City:</strong> ${city}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || 'N/A'}</p>
      <br>
      <p>Log in to the control panel to view CV and Photo.</p>
      <a href="https://ninos-privatechefs.com/admin/control-panel" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Go to Admin Panel</a>
    `;

    // Send to Admin (Organizer Email)
    // Note: ensure sendEmail handles 'to' correctly.
    // Ideally we import ORGANIZER_EMAIL from lib/email but it's not exported.
    // We'll hardcode or use a known admin email for now, or export it from lib/email if needed.
    // Looking at lib/email.ts, ORGANIZER_EMAIL is a const not exported. 
    // I will use 'ninaglia089@gmail.com' directly as seen in the file.
    
    await sendEmail({
      to: 'ninaglia089@gmail.com', 
      subject: `New Application: ${fullName} (${role})`,
      html: adminHtml
    });

    // 4. WhatsApp to Admin
    const adminWaMsg = `🔔 New Application!\n${fullName} applied as ${role} in ${city}.\nCheck the admin panel.`;
    await notifyOrganizer(adminWaMsg);

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error('Notification error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
