-- Robust profile creation on signup.
--
-- The profile-creation trigger had been absent in prod, so new users (incl.
-- first Google login) had NO profiles row → the onboarding gate bounced them to
-- /complete-profile forever. Re-add it, but make it EXCEPTION-SAFE: a failure
-- here must NEVER abort the auth.users insert (that would block ALL signups).
-- Same defensive pattern as handle_new_user_welcome.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
exception
  when others then
    return new;  -- never block signup
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: create a profiles row for any existing auth user missing one.
insert into public.profiles (id, full_name, role)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
  'customer'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
