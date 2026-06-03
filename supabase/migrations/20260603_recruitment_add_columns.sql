-- SECURITY (pre-launch C1/H1) — PHASE A (apply BEFORE deploying the new code).
--
-- Add the dedicated columns the new server endpoint writes to, so we stop
-- packing role/availability into `city` and stop storing bio/phone in a public
-- details.json. Safe for the currently-deployed form (it ignores these columns),
-- so this applies with zero downtime ahead of the deploy. PHASE B (private bucket
-- + revoke anon) lives in 20260603_recruitment_private_bucket.sql and is applied
-- AFTER the new code is live.
alter table public.chef_recruitment_applications
  add column if not exists role text,
  add column if not exists availability text,
  add column if not exists bio text,
  add column if not exists phone text;
