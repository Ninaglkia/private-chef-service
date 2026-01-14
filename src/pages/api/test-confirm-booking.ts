
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { notifyOrganizer, notifyCustomer } from '../../lib/sms';

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export const POST: APIRoute = async ({ request }) => {
  try {
    const { booking_id } = await request.json();

    // 1. Fetch booking
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', booking_id)
      .single();

    if (error || !booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 });
    }

    // 2. Notify Organizer (WhatsApp)
    const formattedPrice = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(booking.total_price / 100);
    const organizerMsg = `[NOTIFICA CHEF] Booking Paid - ${booking.customer_name}. Total: ${formattedPrice}. Plan: ${booking.plan}.`;
    const organizerSuccess = await notifyOrganizer(organizerMsg);

    // 3. Notify Customer (WhatsApp)
    let customerSuccess = false;
    if (booking.customer_phone) {
        // Ensure phone has +39 prefix if missing (basic fix for testing)
        let phone = booking.customer_phone;
        if (!phone.startsWith('+')) {
            phone = '+39' + phone;
        }

        const customerMsg = `[CONFERMA CLIENTE] Dear ${booking.customer_name}, your booking for ${booking.city} is confirmed! We look forward to serving you. Our team will be in touch shortly.`;
        customerSuccess = await notifyCustomer(phone, customerMsg, true);
    }

    if (!organizerSuccess || (booking.customer_phone && !customerSuccess)) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: 'Some notifications failed. Check server logs for details.',
            details: {
                organizer: organizerSuccess ? 'Sent' : 'Failed',
                customer: booking.customer_phone ? (customerSuccess ? 'Sent' : 'Failed') : 'No phone'
            }
        }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, message: 'All notifications sent successfully' }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
