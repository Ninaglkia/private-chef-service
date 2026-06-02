-- Applied live as migration optimize_rls_initplan_policies (version 20260602095624).
--
-- PERFORMANCE (advisor 0003 auth_rls_initplan): wrap auth.*() calls in a scalar
-- sub-select so Postgres evaluates them ONCE per query instead of once per row.
-- Behaviour is identical; only the query plan improves. Idempotent (drop+create).

-- 1) bookings: a logged-in customer reads only their own bookings (by email).
drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own" on public.bookings
  for select to authenticated
  using ( lower(customer_email) = lower((select auth.jwt()) ->> 'email') );

-- 2) chef_recruitment_applications: admins can read all applications.
drop policy if exists "Admins can select recruitment applications" on public.chef_recruitment_applications;
create policy "Admins can select recruitment applications"
  on public.chef_recruitment_applications for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );
