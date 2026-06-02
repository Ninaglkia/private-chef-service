-- Applied live as migration fix_bookings_end_date_and_guest_cap (version 20260602094839).
-- Mirrors the schema-drift fix the orchestrator applied directly so the local
-- migration history matches live going forward.
--
-- Schema drift: the live bookings table was missing end_date even though both
-- create-checkout-session and request-booking insert it -> the insert failed ->
-- every booking request returned 500 "An error occurred".

alter table public.bookings
  add column if not exists end_date date;

-- Allow the open-ended 'custom' / abroad plan to exceed 15 guests (the app caps
-- custom at 200). Fixed plans (day/weekend/week) stay <= 15.
alter table public.bookings
  drop constraint if exists bookings_num_guests_check;
alter table public.bookings
  add constraint bookings_num_guests_check
  check (num_guests >= 1 and (num_guests <= 15 or plan = 'custom'));
