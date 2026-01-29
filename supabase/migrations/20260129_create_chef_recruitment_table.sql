-- Create a specific table for new chef recruitments (Lavora con noi)
-- to avoid conflict with the existing chef_applications (booking applications) table.

create table if not exists public.chef_recruitment_applications (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  city text not null,
  tax_id text,
  cv_url text,
  photos_urls text[],
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.chef_recruitment_applications enable row level security;

-- Allow public insertion (for the application form)
create policy "Public can insert recruitment applications" 
  on public.chef_recruitment_applications for insert 
  with check (true);

-- Allow admins to view/manage
create policy "Admins can select recruitment applications" 
  on public.chef_recruitment_applications for select 
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

create policy "Admins can update recruitment applications" 
  on public.chef_recruitment_applications for update 
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
