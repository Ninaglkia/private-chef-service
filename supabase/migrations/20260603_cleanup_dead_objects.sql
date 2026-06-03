-- Cleanup of inert/dead objects flagged by the Supabase security advisors and
-- left over after: chat removal (WhatsApp launcher replaced it), the old quote
-- flow, and "availability not managed in-site". All target tables are empty and
-- unused by the current product. Reduces attack surface + GraphQL exposure.

-- Chat backend (no UI writes to it anymore; superseded by the WhatsApp launcher).
drop table if exists public.messages cascade;
drop function if exists public.notify_owner_new_chat() cascade;
-- is_owner_or_admin() was referenced ONLY by the messages RLS policies (now gone).
drop function if exists public.is_owner_or_admin() cascade;

-- Dead tables.
drop table if exists public.blocked_dates cascade;   -- availability is not managed in-site
drop table if exists public.quote_requests cascade;  -- legacy quote flow, removed

-- The welcome-email trigger function must NOT be callable as a public RPC; it is
-- invoked by the on_auth_user_created_welcome trigger as SECURITY DEFINER.
revoke execute on function public.handle_new_user_welcome() from public, anon, authenticated;
