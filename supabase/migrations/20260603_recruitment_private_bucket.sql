-- SECURITY (pre-launch C1 + H1) — PHASE B (apply AFTER the new code is deployed).
--
-- BEFORE: the 'chef-applications' bucket was PUBLIC with open SELECT + INSERT
-- policies, and the public form uploaded CVs, dish photos and a details.json
-- (with phone/bio) from the browser, exposing them at guessable public URLs.
-- chef_recruitment_applications also allowed anon INSERT (with check (true)) — a
-- spam surface — and stored tax_id + the public file URLs.
--
-- AFTER: all writes go through /api/recruitment/submit using the service role.
-- The bucket is PRIVATE (objects only reachable via short-lived signed URLs the
-- admin panel mints server-side). Anon can no longer read/upload objects nor
-- insert applications.
--
-- ORDER: apply this only once the new server endpoint is live in production, so
-- the old anon-upload form is gone (it would 403 against the private bucket).
-- The dedicated columns are added in PHASE A (20260603_recruitment_add_columns.sql).

-- 1) Make the storage bucket private.
update storage.buckets set public = false where id = 'chef-applications';

-- 2) Remove the open storage policies (anon read + anon upload).
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Public Upload" on storage.objects;

-- 3) Remove anon's ability to insert applications (the server uses the service
--    role, which bypasses RLS). Drop the permissive policy AND the table grant.
drop policy if exists "Public can insert recruitment applications" on public.chef_recruitment_applications;
revoke insert on public.chef_recruitment_applications from anon;

-- Admin SELECT/UPDATE policies (authenticated + profiles.role='admin') are left
-- untouched — the control panel reads applications via the service role anyway.
