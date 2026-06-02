-- Pay-later / payment-link feature.
--
-- A booking now starts as a guest REQUEST (status 'pending') with NO payment up
-- front, so total_price must be allowed to be NULL until the owner agrees an
-- amount and generates a Stripe payment link. We also store the generated link,
-- when it was sent, and the customer's marketing consent.
--
-- This migration is idempotent and safe to re-run.

-- 1) total_price: drop the NOT NULL constraint (only if it is still set).
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'total_price'
      and is_nullable = 'NO'
  ) then
    alter table public.bookings alter column total_price drop not null;
  end if;
end $$;

-- 2) New columns for the payment link flow (all guarded with IF NOT EXISTS).
alter table public.bookings
  add column if not exists payment_link_url  text,
  add column if not exists payment_link_id   text,
  add column if not exists link_sent_at      timestamptz,
  add column if not exists marketing_consent boolean not null default false;
