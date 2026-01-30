import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Booking = {
  id: string;
  city: string;
  start_date: string;
  end_date?: string | null;
  num_guests: number;
  plan: 'standard' | 'plus' | 'premium';
  add_saturday: boolean;
  add_sunday: boolean;
  dietary_preferences: string;
  total_price: number;
  chef_payout?: number | null;
  grocery_budget?: number | null;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  status: 'pending' | 'searching' | 'assigned' | 'completed';
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  address?: string | null;
  chef_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'customer';
  phone: string | null;
  city: string | null;
  created_at: string | null;
  onboarding_completed: boolean;
  strikes?: number;
  avatar_url?: string | null;
};

export type ChefRecruitmentApplication = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  city: string;
  tax_id?: string | null;
  cv_url?: string | null;
  photos_urls?: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
};

export type ChefBookingApplication = {
  id: string;
  booking_id: string;
  chef_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
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
