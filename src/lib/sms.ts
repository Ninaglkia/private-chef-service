
import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = import.meta.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = import.meta.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = import.meta.env.TWILIO_FROM_NUMBER; // SMS number
const TWILIO_WHATSAPP_NUMBER = import.meta.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886'; // Twilio sandbox number
const ORGANIZER_PHONE = import.meta.env.ORGANIZER_PHONE || '+393285515590'; 

let client: twilio.Twilio | null = null;

if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} else {
  console.warn('Twilio credentials missing. Messaging will be disabled.');
}

interface MessageOptions {
  to: string;
  body: string;
  channel?: 'sms' | 'whatsapp';
}

/**
 * Send a message (SMS or WhatsApp) via Twilio
 */
export async function sendMessage({ to, body, channel = 'sms' }: MessageOptions): Promise<boolean> {
  if (!client) {
    console.warn('Twilio client not initialized.');
    return false;
  }

  const from = channel === 'whatsapp' ? TWILIO_WHATSAPP_NUMBER : TWILIO_FROM_NUMBER;
  
  // Format the 'to' number strictly for WhatsApp
  let finalTo = to;
  if (channel === 'whatsapp') {
      // 1. Remove any existing 'whatsapp:' prefix to start clean
      let cleanNumber = to.replace(/^whatsapp:/, '').trim();
      
      // 2. Add +39 if missing (assuming Italian number if no country code)
      if (!cleanNumber.startsWith('+')) {
          cleanNumber = '+39' + cleanNumber;
      }
      
      // 3. Add 'whatsapp:' prefix
      finalTo = `whatsapp:${cleanNumber}`;
  }

  console.log(`Sto inviando a: ${finalTo}`);

  if (!from) {
    // If SMS number is missing but WhatsApp is requested (and vice versa), try fallback or warn
    if (channel === 'sms' && !TWILIO_FROM_NUMBER) {
        console.warn('SMS number not configured. Skipping SMS.');
        return false;
    }
    console.warn(`Twilio 'From' number for ${channel} not configured.`);
    return false;
  }

  try {
    await client.messages.create({
      body,
      from,
      to: finalTo,
    });
    console.log(`${channel.toUpperCase()} sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(`Failed to send ${channel}:`, error);
    return false;
  }
}

/**
 * Send notification to the organizer (Internal)
 */
export async function notifyOrganizer(message: string): Promise<boolean> {
  // Default to WhatsApp for organizer
  return sendMessage({ to: ORGANIZER_PHONE, body: message, channel: 'whatsapp' });
}

/**
 * Send notification to the customer
 */
export async function notifyCustomer(customerPhone: string, message: string, preferWhatsapp = false): Promise<boolean> {
  const channel = preferWhatsapp ? 'whatsapp' : 'sms';
  return sendMessage({ to: customerPhone, body: message, channel });
}

