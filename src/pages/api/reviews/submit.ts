import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';
import { sendReviewNotificationEmail } from '../../../lib/email';

export const prerender = false;

// Step 2 of the guest-review flow: the browser has already uploaded media
// DIRECTLY to the private 'review-media' bucket (signed URLs minted by
// /api/reviews/upload-url), so this endpoint receives ONLY JSON: the text
// fields + the storage paths. Paths are accepted only if they have the exact
// shape upload-url issues (photos/photo_<rand>.<ext> / videos/video_<rand>.<ext>)
// AND the object really exists in the bucket within the per-kind size caps.
// The row is inserted with the service role as status='pending' — nothing shows
// on the site until the owner approves it in /owner#reviews.

const BUCKET = 'review-media';
const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB per photo
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

const PHOTO_PATH_RE = /^photos\/photo_[a-z0-9]{10,40}\.(jpg|png|webp|heic|heif)$/;
const VIDEO_PATH_RE = /^videos\/video_[a-z0-9]{10,40}\.(mp4|mov|webm)$/;

const supabaseAdmin = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Object metadata from the bucket (existence + size). list() is used instead of
// download() so a 100 MB video never has to be pulled into the function.
async function statObject(path: string): Promise<{ size: number } | null> {
  const slash = path.indexOf('/');
  const prefix = path.slice(0, slash);
  const name = path.slice(slash + 1);
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .list(prefix, { limit: 1, search: name });
  if (error || !data) {
    console.error('Storage list error:', path, error);
    return null;
  }
  const hit = data.find((o) => o.name === name);
  if (!hit) return null;
  return { size: Number((hit.metadata as { size?: number } | null)?.size ?? 0) };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Per-IP rate limit before any work.
    const ip = getClientIp(request);
    const limit = rateLimit(`review-submit:${ip}`, { limit: 5, windowMs: 60_000 });
    if (!limit.ok) {
      return new Response(
        JSON.stringify({ error: 'Too many requests, please try again shortly.' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfterSec) },
        }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return json({ error: 'Unsupported content type' }, 400);
    }
    const data = await request.json();

    // Honeypot: bots fill this hidden field. Pretend success and bail.
    if (data.company_website && String(data.company_website).trim() !== '') {
      return json({ ok: true }, 200);
    }

    const name = String(data.name || '').trim();
    const email = String(data.email || '').trim().toLowerCase();
    const occasion = String(data.occasion || '').trim();
    const reviewText = String(data.review_text || '').trim();
    const rating = Number(data.rating);

    if (!name || !reviewText) return json({ error: 'Name and review are required' }, 400);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return json({ error: 'Rating must be between 1 and 5 stars' }, 400);
    }
    // Length caps so a direct POST can't store megabytes of junk in the row.
    if (name.length > 120 || email.length > 200 || occasion.length > 120 || reviewText.length > 4000) {
      return json({ error: 'One or more fields are too long' }, 400);
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: 'Invalid email address' }, 400);
    }

    // Media: shape must match what upload-url issues, and the object must
    // actually exist in the bucket within the per-kind size caps.
    const photoPathsRaw = Array.isArray(data.photo_paths) ? data.photo_paths : [];
    if (photoPathsRaw.length > MAX_PHOTOS) {
      return json({ error: `Please attach at most ${MAX_PHOTOS} photos` }, 400);
    }
    const photoPaths: string[] = [];
    for (const p of photoPathsRaw) {
      const path = String(p || '');
      if (!PHOTO_PATH_RE.test(path)) return json({ error: 'Invalid photo reference' }, 400);
      const stat = await statObject(path);
      if (!stat) return json({ error: 'A photo upload is missing — please try again' }, 400);
      if (stat.size > MAX_PHOTO_BYTES) return json({ error: 'A photo is too large (max 8 MB each)' }, 400);
      photoPaths.push(path);
    }
    let videoPath: string | null = null;
    if (data.video_path) {
      const path = String(data.video_path);
      if (!VIDEO_PATH_RE.test(path)) return json({ error: 'Invalid video reference' }, 400);
      const stat = await statObject(path);
      if (!stat) return json({ error: 'The video upload is missing — please try again' }, 400);
      if (stat.size > MAX_VIDEO_BYTES) return json({ error: 'The video is too large (max 100 MB)' }, 400);
      videoPath = path;
    }

    // Insert the review (service role; stores object PATHS, signed on read).
    const { error: dbErr } = await supabaseAdmin.from('reviews').insert({
      name,
      email: email || null,
      rating,
      review_text: reviewText,
      occasion: occasion || null,
      photos: photoPaths,
      video_path: videoPath,
      status: 'pending',
    });
    if (dbErr) {
      console.error('Review insert error:', dbErr);
      return json({ error: 'Failed to save the review' }, 500);
    }

    // Owner alert best-effort — an email failure must never lose a saved review.
    try {
      await sendReviewNotificationEmail({
        name,
        rating,
        review_text: reviewText,
        occasion: occasion || null,
        photo_count: photoPaths.length,
        has_video: !!videoPath,
      });
    } catch (e) {
      console.error('Review notification email failed:', e);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Review submit error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};
