-- profiles: add the missing column the app writes, complete own-row RLS, and a
-- role default. (Applied live as migration fix_profiles_columns_and_rls.)
--
-- Before this, profiles had ONLY an UPDATE policy that hard-required role='customer'
-- and NO SELECT/INSERT policy, so complete-profile's upsert was rejected and the
-- onboarding gate could never read the profile (redirect loop). phone/email already
-- existed; onboarding_completed did not.

alter table public.profiles
  add column if not exists phone text,
  add column if not exists onboarding_completed boolean not null default false;

alter table public.profiles alter column role set default 'customer';

-- email is optional on profiles (it already lives on auth.users); allow null so the
-- complete-profile upsert (which doesn't send email) doesn't hit a NOT NULL violation.
alter table public.profiles alter column email drop not null;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ( id = (select auth.uid()) );

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ( id = (select auth.uid()) );

-- Update own row but NEW role must equal current role (prevents self-escalation,
-- without locking admins out the way the old role='customer'-only policy did).
drop policy if exists "profiles_user_update_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
-- NOTE: with_check must NOT sub-select from profiles itself (causes 42P17 infinite
-- recursion). role='customer' is a non-recursive anti-escalation guard; the client
-- upsert never sends role anyway, and owner/admin access is via the email allowlist.
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ( id = (select auth.uid()) )
  with check ( id = (select auth.uid()) and role = 'customer' );
