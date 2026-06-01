-- profiles was missing columns that complete-profile.astro writes.
-- Without these, the profile upsert fails ("Could not find the 'onboarding_completed' column").

alter table public.profiles
  add column if not exists phone text,
  add column if not exists onboarding_completed boolean not null default false;

-- Ensure a logged-in user can read and update THEIR OWN profile (needed for the
-- onboarding gate read and the complete-profile save). Idempotent.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ( (select auth.uid()) = id );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ( (select auth.uid()) = id )
  with check ( (select auth.uid()) = id );
