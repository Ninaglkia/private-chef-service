-- Payment model: store the chef fee and the estimated grocery budget separately
-- on each booking, so the Payment Link can charge "compenso + spesa stimata"
-- upfront and the groceries can be reconciled against receipts afterwards.
--
-- These columns were declared in 20260114_update_business_model.sql but had
-- drifted out of the live database; this re-applies them idempotently.
alter table public.bookings
  add column if not exists chef_payout integer,     -- chef fee, in euro cents
  add column if not exists grocery_budget integer;  -- estimated groceries, in euro cents
