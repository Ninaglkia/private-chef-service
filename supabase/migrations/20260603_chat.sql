-- In-app two-way chat (client <-> Chef Nino), one thread per client.
-- Applied to the live DB via MCP on 2026-06-03; kept here for repo parity.

-- Owner/admin check used by RLS.
create or replace function public.is_owner_or_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (auth.jwt() ->> 'email') = 'ninaglia089@gmail.com'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'),
    false
  );
$$;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('client','owner')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_by_owner boolean not null default false,
  read_by_client boolean not null default false
);
create index if not exists messages_client_created_idx on public.messages (client_id, created_at);

alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (client_id = (select auth.uid()) or public.is_owner_or_admin());

drop policy if exists messages_insert_client on public.messages;
create policy messages_insert_client on public.messages for insert to authenticated
  with check (sender = 'client' and client_id = (select auth.uid()));

drop policy if exists messages_insert_owner on public.messages;
create policy messages_insert_owner on public.messages for insert to authenticated
  with check (sender = 'owner' and public.is_owner_or_admin());

drop policy if exists messages_update_read on public.messages;
create policy messages_update_read on public.messages for update to authenticated
  using (client_id = (select auth.uid()) or public.is_owner_or_admin())
  with check (client_id = (select auth.uid()) or public.is_owner_or_admin());

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- Admin inbox summary (one row per client). Service-role only.
create or replace function public.chat_conversations()
returns table (client_id uuid, full_name text, email text, last_body text, last_at timestamptz, unread integer)
language sql security definer set search_path = '' as $$
  select m.client_id, p.full_name, u.email,
    (array_agg(m.body order by m.created_at desc))[1] as last_body,
    max(m.created_at) as last_at,
    count(*) filter (where m.sender = 'client' and not m.read_by_owner)::int as unread
  from public.messages m
  left join public.profiles p on p.id = m.client_id
  left join auth.users u on u.id = m.client_id
  group by m.client_id, p.full_name, u.email
  order by max(m.created_at) desc;
$$;
revoke execute on function public.chat_conversations() from public, anon, authenticated;
grant execute on function public.chat_conversations() to service_role;

-- Email Nino when a client sends a message (pg_net -> /api/chat/notify).
create or replace function public.notify_owner_new_chat()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_name text;
begin
  if new.sender <> 'client' then
    return new;
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'welcome_webhook_secret' limit 1;
  select full_name into v_name from public.profiles where id = new.client_id;
  perform net.http_post(
    url := 'https://ninos-privatechefs.com/api/chat/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', coalesce(v_secret, '')),
    body := jsonb_build_object('record', jsonb_build_object('client_name', v_name, 'body', new.body))
  );
  return new;
exception
  when others then
    return new;
end;
$$;

drop trigger if exists on_new_chat_message on public.messages;
create trigger on_new_chat_message
  after insert on public.messages
  for each row execute function public.notify_owner_new_chat();
