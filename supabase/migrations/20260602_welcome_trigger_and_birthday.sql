-- Welcome email trigger + birthday field.
--
-- 1) profiles.birthday: optional date of birth, used by the daily birthday email
--    cron (/api/cron/birthday). Nullable: users who don't set it get nothing.
alter table public.profiles add column if not exists birthday date;

-- 2) Welcome email on signup. The /api/welcome endpoint (in the Astro app) sends
--    the branded welcome email + 10% code. It is authenticated with a shared
--    secret stored in Supabase Vault under the name 'welcome_webhook_secret'
--    (created out-of-band, NOT in this file, since the repo is public). The same
--    value must be set as WELCOME_WEBHOOK_SECRET in the Vercel env.
--
--    A trigger on auth.users AFTER INSERT fires exactly once per new account
--    (email signup OR first Google login both create the row once), and uses
--    pg_net to POST asynchronously so it never blocks/breaks the signup.
create extension if not exists pg_net;

create or replace function public.handle_new_user_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'welcome_webhook_secret'
    limit 1;

  perform net.http_post(
    url := 'https://ninos-privatechefs.com/api/welcome',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', coalesce(v_secret, '')
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'email', new.email,
        'raw_user_meta_data', new.raw_user_meta_data
      )
    )
  );

  return new;
exception
  -- A welcome-email failure must never block account creation.
  when others then
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_welcome on auth.users;
create trigger on_auth_user_created_welcome
  after insert on auth.users
  for each row execute function public.handle_new_user_welcome();
