-- Create the storage bucket for chef applications
insert into storage.buckets (id, name, public)
values ('chef-applications', 'chef-applications', true)
on conflict (id) do nothing;

-- Allow public access to view files (needed for getPublicUrl)
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'chef-applications' );

-- Allow public uploads (needed for the application form)
create policy "Public Upload"
  on storage.objects for insert
  with check ( bucket_id = 'chef-applications' );
