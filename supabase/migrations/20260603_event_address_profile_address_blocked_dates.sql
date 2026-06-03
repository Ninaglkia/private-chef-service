-- Where the client wants the event to take place (per booking request).
alter table public.bookings add column if not exists event_address text;

-- Saved address on the user profile (auto-fill for logged-in customers).
alter table public.profiles add column if not exists address text;

-- Owner unavailability: dates manually blocked by Nino (holidays / busy).
create table if not exists public.blocked_dates (
  date date primary key,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.blocked_dates enable row level security;

-- The public /richiesta calendar reads blocked dates (server-side); allow read.
drop policy if exists "blocked_dates_select_all" on public.blocked_dates;
create policy "blocked_dates_select_all"
  on public.blocked_dates for select
  using (true);

-- Writes happen only via the service-role admin endpoint (RLS bypassed).
