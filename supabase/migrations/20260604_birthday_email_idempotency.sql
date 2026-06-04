-- Makes the daily birthday cron idempotent: records the year the birthday email
-- was last sent to each user, so a same-day re-run or a Vercel cron retry never
-- double-greets. Additive, nullable column — no backfill needed.
alter table public.profiles
  add column if not exists birthday_email_sent_year integer;

comment on column public.profiles.birthday_email_sent_year is
  'Year the birthday email was last sent to this user; makes the daily birthday cron idempotent (no double-send on a re-run / Vercel retry).';
