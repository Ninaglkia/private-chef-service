-- Harden the anon API surface. bookings & quote_requests are written only by the
-- server via the service-role key (create-checkout-session, request-quote), so the
-- always-true anon INSERT policies are removed, and these tables are taken off the
-- anon API/GraphQL surface. RLS already restricts rows; authenticated keeps only what
-- the app needs (dashboard reads own bookings, complete-profile reads own profile).

drop policy if exists "Allow public to create bookings" on public.bookings;
drop policy if exists "Allow public to create quote requests" on public.quote_requests;

revoke select on public.bookings from anon;
revoke select on public.quote_requests from anon, authenticated;
revoke select on public.profiles from anon;
