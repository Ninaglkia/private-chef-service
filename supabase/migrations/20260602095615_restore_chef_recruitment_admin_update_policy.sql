-- Applied live as migration restore_chef_recruitment_admin_update_policy
-- (version 20260602095615).
--
-- SCHEMA DRIFT: the local migration 20260129_create_chef_recruitment_table.sql
-- defines an "Admins can update recruitment applications" UPDATE policy, but it
-- was MISSING on live (live only had the INSERT + SELECT policies). Restore it so
-- an admin can mark an application approved/rejected from the control panel.
--
-- Uses (select auth.uid()) so the auth function is evaluated once per query
-- instead of once per row (perf advisor 0003 auth_rls_initplan).

drop policy if exists "Admins can update recruitment applications" on public.chef_recruitment_applications;
create policy "Admins can update recruitment applications"
  on public.chef_recruitment_applications for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = (select auth.uid()) and profiles.role = 'admin'
    )
  );
