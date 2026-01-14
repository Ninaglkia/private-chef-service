
import type { APIRoute } from 'astro';
import { notifyCustomer } from '../../lib/sms';

export const POST: APIRoute = async () => {
  try {
    const phone = '+393285515590';
    const message = 'Test notification from Localhost: System is working!';
    
    // Try sending via WhatsApp (true)
    const result = await notifyCustomer(phone, message, true);
    
    if (result) {
      return new Response(JSON.stringify({ success: true, message: 'WhatsApp sent' }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Failed to send. Check console logs.' }), { status: 500 });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
  }
};
