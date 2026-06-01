-- Solo-chef business model.
--
-- Replaces the marketplace "dispatch" model (searching/assigned + multi-chef
-- applications) with a single chef offering flat products: day / weekend / week,
-- up to 15 guests, groceries billed separately.
--
-- IMPORTANT: drop each CHECK constraint BEFORE normalising existing rows,
-- otherwise the UPDATE is rejected by the still-active old constraint.

-- 1. Booking status: real lifecycle for a single-chef service.
alter table public.bookings drop constraint if exists bookings_status_check;
update public.bookings
  set status = 'pending'
  where status not in ('pending', 'confirmed', 'completed', 'cancelled', 'refunded');
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'refunded'));

-- 2. The `plan` column now stores the product type.
alter table public.bookings drop constraint if exists bookings_plan_check;
update public.bookings
  set plan = 'week'
  where plan not in ('day', 'weekend', 'week', 'custom');
alter table public.bookings
  add constraint bookings_plan_check
  check (plan in ('day', 'weekend', 'week', 'custom'));

-- 3. Guests up to 15 (price is flat regardless of headcount).
alter table public.bookings drop constraint if exists bookings_num_guests_check;
update public.bookings
  set num_guests = 15
  where num_guests > 15;
alter table public.bookings
  add constraint bookings_num_guests_check
  check (num_guests >= 1 and num_guests <= 15);

-- 4. Quote requests (Abroad & Bespoke) are no longer limited to 10+ guests.
alter table public.quote_requests drop constraint if exists quote_requests_num_guests_check;
update public.quote_requests
  set num_guests = 15
  where num_guests > 200;
alter table public.quote_requests
  add constraint quote_requests_num_guests_check
  check (num_guests >= 1 and num_guests <= 200);
