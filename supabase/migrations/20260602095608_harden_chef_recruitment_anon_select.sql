-- Applied live as migration harden_chef_recruitment_anon_select (version 20260602095608).
--
-- SECURITY (advisor 0026 pg_graphql_anon_table_exposed):
-- chef_recruitment_applications holds PII (names, emails, tax_id, CV/photo URLs).
-- The public "Work with us" form INSERTs into it using the browser ANON client,
-- so anon must KEEP INSERT. But anon was ALSO granted SELECT, which exposed every
-- application via the REST/GraphQL anon surface (anyone with the anon key could
-- list all applicants). Revoke SELECT from anon only.
--
-- Admins still read the table via the authenticated role + the
-- "Admins can select recruitment applications" RLS policy.

revoke select on public.chef_recruitment_applications from anon;
