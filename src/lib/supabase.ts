import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Booking = {
  id: string;
  city: string;
  start_date: string;
  num_guests: number;
  plan: 'standard' | 'plus' | 'premium';
  add_saturday: boolean;
  add_sunday: boolean;
  dietary_preferences: string;
  total_price: number;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteRequest = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  city: string;
  start_date: string;
  num_guests: number;
  add_saturday: boolean;
  add_sunday: boolean;
  notes: string;
  status: 'pending' | 'contacted' | 'quoted' | 'converted' | 'declined';
  created_at: string;
  updated_at: string;
};
