import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';

export const prerender = false;

// Step 1 of the guest-review flow: mint short-lived signed UPLOAD URLs for the
// PRIVATE 'review-media' bucket. Vercel serverless caps request bodies at
// ~4.5 MB, so media is NEVER proxied through our API — the browser asks here
// for signed URLs, PUTs each file DIRECTLY to Supabase Storage, then posts the
// storage paths (JSON, no files) to /api/reviews/submit. Random object names
// keep paths non-guessable; the bucket itself enforces the 100 MB ceiling and
// an image/video mime allowlist (see the reviews migration).

const BUCKET = 'review-media';
const MAX_PHOTOS = 3;
const MAX_VIDEOS = 1;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB per photo
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB hard cap (~60s recommended)

// content-type -> stored extension (mirrors the bucket's allowed_mime_types).
const PHOTO_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};
const VIDEO_TYPES: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

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

// Non-guessable object name (same pattern as recruitment/submit).
function randomName(prefix: string, ext: string): string {
  const rand =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `${prefix}_${rand}.${ext}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Per-IP rate limit before any work.
    const ip = getClientIp(request);
    const limit = rateLimit(`review-upload-url:${ip}`, { limit: 5, windowMs: 60_000 });
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

    // Honeypot: bots fill this hidden field. Pretend success (empty grant) and bail.
    if (data.company_website && String(data.company_website).trim() !== '') {
      return json({ ok: true, uploads: [] }, 200);
    }

    const files = Array.isArray(data.files) ? data.files : [];
    if (files.length === 0) return json({ error: 'No files requested' }, 400);
    if (files.length > MAX_PHOTOS + MAX_VIDEOS) return json({ error: 'Too many files' }, 400);

    let photoCount = 0;
    let videoCount = 0;
    const grants: { kind: 'photo' | 'video'; path: string }[] = [];
    for (const f of files) {
      const kind = f?.kind === 'video' ? 'video' : 'photo';
      const type = String(f?.content_type || '').toLowerCase();
      const size = Number(f?.size);
      if (!Number.isFinite(size) || size <= 0) return json({ error: 'Invalid file size' }, 400);
      if (kind === 'video') {
        if (++videoCount > MAX_VIDEOS) return json({ error: 'Please attach at most 1 video' }, 400);
        const ext = VIDEO_TYPES[type];
        if (!ext) return json({ error: 'The video must be MP4, MOV or WEBM' }, 400);
        if (size > MAX_VIDEO_BYTES) return json({ error: 'The video is too large (max 100 MB)' }, 400);
        grants.push({ kind, path: `videos/${randomName('video', ext)}` });
      } else {
        if (++photoCount > MAX_PHOTOS) return json({ error: `Please attach at most ${MAX_PHOTOS} photos` }, 400);
        const ext = PHOTO_TYPES[type];
        if (!ext) return json({ error: 'Photos must be JPEG, PNG, WEBP or HEIC' }, 400);
        if (size > MAX_PHOTO_BYTES) return json({ error: 'A photo is too large (max 8 MB each)' }, 400);
        grants.push({ kind, path: `photos/${randomName('photo', ext)}` });
      }
    }

    // Uploads are returned in the SAME ORDER as the requested files — the
    // browser matches them positionally.
    const uploads: { kind: string; path: string; url: string; token: string }[] = [];
    for (const g of grants) {
      const { data: signed, error } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUploadUrl(g.path);
      if (error || !signed) {
        console.error('createSignedUploadUrl error:', g.path, error);
        return json({ error: 'Could not prepare the upload' }, 500);
      }
      uploads.push({ kind: g.kind, path: signed.path, url: signed.signedUrl, token: signed.token });
    }

    return json({ ok: true, uploads }, 200);
  } catch (error) {
    console.error('Review upload-url error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};
