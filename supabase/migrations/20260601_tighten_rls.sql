-- Tighten over-permissive anon SELECT policies on bookings & quote_requests.
--
-- Problem: existing policies allowed anyone (anon) to read ANY row by iterating
-- ids / session ids (e.g. USING (stripe_session_id IS NOT NULL)) — a data-exposure
-- / GDPR issue.
--
-- Safe because: the app reads these tables with the SERVICE-ROLE key everywhere
-- that needs full access (confirmation page, admin panel, stripe webhook) — that
-- bypasses RLS. The ONLY anon/authenticated reader is the customer dashboard,
-- which reads its OWN bookings matched by email. quote_requests is never read by
-- anon/authenticated (only service-role), only inserted by the public quote form.

-- 1. Drop every existing SELECT policy on the two tables (names vary across past migrations).
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'bookings' and cmd = 'SELECT' loop
    execute format('drop policy %I on public.bookings', p.policyname);
  end loop;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'quote_requests' and cmd = 'SELECT' loop
    execute format('drop policy %I on public.quote_requests', p.policyname);
  end loop;
end $$;

-- 2. A logged-in customer may read ONLY their own bookings (case-insensitive email match).
create policy "bookings_select_own" on public.bookings
  for select to authenticated
  using ( lower(customer_email) = lower(auth.jwt() ->> 'email') );

-- 3. quote_requests: intentionally NO anon/authenticated SELECT policy.
--    Reads happen only via the service-role key (admin panel / confirmation), which
--    bypasses RLS. The public INSERT policy (request-quote form) is left untouched.
