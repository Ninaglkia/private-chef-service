
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
    const subject = `Candidatura Ricevuta: ${role} - ${fullName}`;
    
    // 1. Email to Candidate
    const candidateHtml = `
      <h2>Grazie per la tua candidatura, ${firstName}!</h2>
      <p>Abbiamo ricevuto la tua richiesta per la posizione di <strong>${role}</strong> su ${city}.</p>
      <p>Il nostro team valuterà il tuo profilo e ti contatterà presto se ci saranno opportunità in linea con le tue competenze.</p>
      <br>
      <p>Cordiali saluti,<br>Il Team di Weekly Private Chef</p>
    `;

    await sendEmail({
      to: email,
      subject: 'Candidatura ricevuta - Weekly Private Chef',
      html: candidateHtml
    });

    // 2. WhatsApp to Candidate (if phone provided)
    if (phone) {
      const waMsg = `Ciao ${firstName}, grazie per esserti candidato come ${role}. Abbiamo ricevuto i tuoi dati e ti faremo sapere presto!`;
      await sendMessage({ to: phone, body: waMsg, channel: 'whatsapp' });
    }

    // 3. Email to Admin
    const adminHtml = `
      <h2>Nuova Candidatura Ricevuta</h2>
      <p><strong>Nome:</strong> ${fullName}</p>
      <p><strong>Ruolo:</strong> ${role}</p>
      <p><strong>Città:</strong> ${city}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Telefono:</strong> ${phone || 'N/A'}</p>
      <br>
      <p>Accedi al pannello di controllo per visualizzare CV e Foto.</p>
      <a href="https://weeklyprivatechef.com/admin/control-panel" style="background:#000;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Vai al Pannello Admin</a>
    `;

    // Send to Admin (Organizer Email)
    // Note: ensure sendEmail handles 'to' correctly.
    // Ideally we import ORGANIZER_EMAIL from lib/email but it's not exported.
    // We'll hardcode or use a known admin email for now, or export it from lib/email if needed.
    // Looking at lib/email.ts, ORGANIZER_EMAIL is a const not exported. 
    // I will use 'ninaglia089@gmail.com' directly as seen in the file.
    
    await sendEmail({
      to: 'ninaglia089@gmail.com', 
      subject: `Nuova Candidatura: ${fullName} (${role})`,
      html: adminHtml
    });

    // 4. WhatsApp to Admin
    const adminWaMsg = `🔔 Nuova Candidatura!\n${fullName} si è candidato come ${role} su ${city}.\nControlla il pannello admin.`;
    await notifyOrganizer(adminWaMsg);

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error('Notification error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
};
