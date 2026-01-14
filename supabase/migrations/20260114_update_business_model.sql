alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add column if not exists city text,
  add column if not exists haccp_url text,
  add column if not exists bio text,
  add column if not exists specialties text[],
  add column if not exists strikes integer not null default 0,
  add column if not exists is_verified boolean not null default true;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'customer', 'chef'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, role)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );
  return new;
end;
$$;

create or replace function public.enforce_chef_strikes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.strikes >= 3 then
    new.is_verified := false;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_strikes_trigger on public.profiles;

create trigger profiles_strikes_trigger
  before update on public.profiles
  for each row
  execute procedure public.enforce_chef_strikes();

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add column if not exists address text,
  add column if not exists end_date date,
  add column if not exists chef_payout integer,
  add column if not exists grocery_budget integer,
  add column if not exists chef_id uuid references public.profiles(id);

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'searching', 'assigned', 'completed'));

create index if not exists idx_bookings_chef_id on public.bookings(chef_id);
create index if not exists idx_bookings_city on public.bookings(city);

create table if not exists public.chef_applications (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  chef_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.chef_applications enable row level security;

create policy "Chefs can see their applications"
  on public.chef_applications for select
  using (auth.uid() = chef_id);

create policy "Chefs can apply to bookings"
  on public.chef_applications for insert
  with check (auth.uid() = chef_id);

create index if not exists idx_chef_applications_booking_id on public.chef_applications(booking_id);
create index if not exists idx_chef_applications_chef_id on public.chef_applications(chef_id);

