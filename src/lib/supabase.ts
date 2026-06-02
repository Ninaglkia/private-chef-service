import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE is the default in supabase-js v2, but pin it explicitly so the
    // ?code=... returned to /auth/callback can be exchanged for a session.
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// --- Server-readable session cookies, kept in sync with the client session ---
//
// The SSR middleware authenticates each request from the `sb-access-token` /
// `sb-refresh-token` cookies. The client SDK rotates these tokens on every
// refresh (autoRefreshToken) and stores the new ones in localStorage — but the
// cookies were historically written ONCE at login and never updated. After the
// first client-side refresh the cookie held a stale/rotated refresh token; once
// the access token expired the server could no longer refresh it → redirect to
// /login → the client (still "logged in" via localStorage) rewrote the same dead
// cookie and redirected back → infinite loop.
//
// Fix: mirror EVERY auth state change into the cookies so the server always sees
// the latest valid tokens, and clear them on sign-out. `Secure` is only set on
// https so the cookies are not silently dropped during http localhost dev.
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function cookieSecureSuffix(): string {
  if (typeof window === 'undefined') return '; Secure';
  return window.location.protocol === 'https:' ? '; Secure' : '';
}

export function writeSessionCookies(
  session: { access_token?: string; refresh_token?: string } | null,
) {
  if (typeof document === 'undefined' || !session?.access_token || !session?.refresh_token) return;
  const suffix = cookieSecureSuffix();
  document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax${suffix}`;
  document.cookie = `sb-refresh-token=${session.refresh_token}; path=/; max-age=${SESSION_COOKIE_MAX_AGE}; SameSite=Lax${suffix}`;
}

export function clearSessionCookies() {
  if (typeof document === 'undefined') return;
  const suffix = cookieSecureSuffix();
  document.cookie = `sb-access-token=; path=/; max-age=0; SameSite=Lax${suffix}`;
  document.cookie = `sb-refresh-token=; path=/; max-age=0; SameSite=Lax${suffix}`;
}

// Browser-only: keep cookies aligned with the live session on every event
// (INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, SIGNED_OUT).
// This is what prevents the cookie from ever going stale relative to the
// localStorage session — the root cause of the post-login redirect loop.
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      clearSessionCookies();
    } else {
      writeSessionCookies(session);
    }
  });
}

export type Booking = {
  id: string;
  city: string;
  start_date: string;
  end_date?: string | null;
  num_guests: number;
  plan: 'day' | 'weekend' | 'week' | 'custom';
  add_saturday: boolean;
  add_sunday: boolean;
  dietary_preferences: string;
  total_price: number | null;
  chef_payout?: number | null;
  grocery_budget?: number | null;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'refunded';
  customer_email: string;
  customer_name: string;
  customer_phone: string | null;
  address?: string | null;
  chef_id?: string | null;
  payment_link_url?: string | null;
  payment_link_id?: string | null;
  link_sent_at?: string | null;
  marketing_consent?: boolean;
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
