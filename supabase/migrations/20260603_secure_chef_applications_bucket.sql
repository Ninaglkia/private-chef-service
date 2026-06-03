-- SECURITY: the chef-applications bucket held candidate CVs, photos and tax IDs
-- but was PUBLIC, so anyone with (or guessing) a URL could read personal data
-- (GDPR exposure). Make it private and drop the anonymous public-read policy.
-- The "Public Upload" INSERT policy is kept so the public application form can
-- still upload; reads now require the service role (Supabase dashboard) or a
-- short-lived signed URL.
update storage.buckets set public = false where id = 'chef-applications';
drop policy if exists "Public Access" on storage.objects;
