-- User-submitted guest reviews: stars + text + up to 3 photos + 1 video,
-- moderated by the owner in /owner#reviews before appearing on the homepage.
--
-- Write path (hardened like chef_recruitment_applications): the browser asks
-- /api/reviews/upload-url for short-lived signed UPLOAD urls to the PRIVATE
-- 'review-media' bucket, uploads media DIRECTLY to Storage (Vercel serverless
-- caps request bodies at ~4.5 MB, so files must never proxy through the API),
-- then posts the storage paths to /api/reviews/submit which validates them and
-- inserts the row with the service role as status='pending'. Anon has NO
-- insert/update/delete — and can only SELECT approved rows, minus the
-- submitter email / moderation note (column-level grant).

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text,
  rating int not null check (rating between 1 and 5),
  review_text text not null,
  occasion text,
  location text,
  photos jsonb not null default '[]'::jsonb,
  video_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_note text
);

alter table public.reviews enable row level security;

-- Public can read APPROVED reviews only. The homepage renders them via the
-- service role anyway, so this is defense-in-depth for direct PostgREST access.
-- (No auth.*() calls here, so there is nothing to initplan-wrap.)
drop policy if exists "reviews_select_approved" on public.reviews;
create policy "reviews_select_approved" on public.reviews
  for select to anon, authenticated
  using ( status = 'approved' );

-- Column-level privileges: never expose the submitter email or admin_note to
-- the public roles, and no INSERT/UPDATE/DELETE at all (service role only).
revoke all on public.reviews from anon, authenticated;
grant select (id, created_at, name, rating, review_text, occasion, location, photos, video_path, status)
  on public.reviews to anon, authenticated;

-- The only public query shape is "newest approved first".
create index if not exists reviews_status_created_at_idx
  on public.reviews (status, created_at desc);

-- PRIVATE media bucket. No storage.objects policies for anon: uploads happen
-- only via server-minted signed upload URLs, reads only via 1h signed URLs.
-- Storage itself enforces the 100 MB ceiling (video cap; the API enforces 8 MB
-- for photos) and the image/video mime allowlist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-media',
  'review-media',
  false,
  104857600, -- 100 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
