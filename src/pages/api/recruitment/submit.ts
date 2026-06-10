import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, getClientIp } from '../../../lib/rate-limit';
import { sendRecruitmentEmails } from '../../../lib/email';
import { notifyOrganizer, sendMessage } from '../../../lib/sms';

// Server-side recruitment submission — the ONLY write path for "Work with us".
// The browser does client-side AI verification (UX gate) then POSTs a multipart
// form here. We validate, store files in the PRIVATE 'chef-applications' bucket
// (keeping only the object PATH in the DB), insert the row with the service role
// (bypassing RLS), and notify the owner best-effort. The bucket being private +
// anon having no INSERT means none of this is reachable from the public anon key.

const BUCKET = 'chef-applications';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per file
const MAX_PHOTOS = 5;
const ALLOWED_ROLES = new Set(['chef', 'waiter']);

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

function str(v: FormDataEntryValue | null): string {
  return v == null ? '' : String(v).trim();
}

// Allow only a short alphanumeric extension; otherwise fall back to a safe one.
function safeExt(name: string, fallback: string): string {
  const ext = name.includes('.') ? name.split('.').pop()! : '';
  return /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : fallback;
}

// Non-guessable object name. The bucket is private, so this is defense-in-depth.
function randomName(prefix: string, ext: string): string {
  const rand =
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `${prefix}_${rand}.${ext}`;
}

async function uploadFile(path: string, file: File, fallbackType: string): Promise<boolean> {
  const buf = await file.arrayBuffer();
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: file.type || fallbackType, upsert: false });
  if (error) {
    console.error('Storage upload error:', path, error);
    return false;
  }
  return true;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // 1) Per-IP rate limit before any work.
    const ip = getClientIp(request);
    const limit = rateLimit(`recruitment-submit:${ip}`, { limit: 5, windowMs: 60_000 });
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
    if (!contentType.includes('multipart/form-data')) {
      return json({ error: 'Unsupported content type' }, 400);
    }

    const form = await request.formData();

    // 2) Honeypot: bots fill this hidden field. Pretend success and bail.
    const honeypot = form.get('company_website');
    if (honeypot && String(honeypot).trim() !== '') {
      return json({ ok: true }, 200);
    }

    // 3) Fields + validation.
    const firstName = str(form.get('first_name'));
    const lastName = str(form.get('last_name'));
    const email = str(form.get('email'));
    const phone = str(form.get('phone'));
    const city = str(form.get('city'));
    const taxId = str(form.get('tax_id'));
    const role = str(form.get('role')).toLowerCase();
    const availability = str(form.get('availability'));
    const bio = str(form.get('bio'));

    if (!firstName || !lastName || !email || !phone || !city || !taxId || !role || !availability || !bio) {
      return json({ error: 'Missing required fields' }, 400);
    }
    if (!ALLOWED_ROLES.has(role)) {
      return json({ error: 'Invalid role' }, 400);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: 'Invalid email address' }, 400);
    }

    // 4) CV (required for everyone).
    const cvFile = form.get('cv_file');
    if (!(cvFile instanceof File) || cvFile.size === 0) {
      return json({ error: 'A CV file is required' }, 400);
    }
    if (cvFile.size > MAX_FILE_BYTES) {
      return json({ error: 'CV file is too large (max 8 MB)' }, 400);
    }
    const cvPath = `cvs/${randomName('cv', safeExt(cvFile.name, 'pdf'))}`;
    if (!(await uploadFile(cvPath, cvFile, 'application/octet-stream'))) {
      return json({ error: 'Failed to upload CV' }, 500);
    }

    // 5) Photos (required for chefs, optional otherwise; images only, max 5).
    const photoPaths: string[] = [];
    if (role === 'chef') {
      const photos = form
        .getAll('photos')
        .filter((p): p is File => p instanceof File && p.size > 0);
      if (photos.length === 0) {
        return json({ error: 'At least one dish photo is required for chefs' }, 400);
      }
      if (photos.length > MAX_PHOTOS) {
        return json({ error: `Please upload at most ${MAX_PHOTOS} photos` }, 400);
      }
      for (const photo of photos) {
        if (photo.size > MAX_FILE_BYTES) {
          return json({ error: 'A photo is too large (max 8 MB each)' }, 400);
        }
        if (!String(photo.type || '').startsWith('image/')) {
          return json({ error: 'Photos must be image files' }, 400);
        }
        const path = `photos/${randomName('dish', safeExt(photo.name, 'jpg'))}`;
        if (!(await uploadFile(path, photo, 'image/jpeg'))) {
          return json({ error: 'Failed to upload a photo' }, 500);
        }
        photoPaths.push(path);
      }
    }

    // 6) Insert the application (service role; stores PATHS, not public URLs).
    const { error: dbErr } = await supabaseAdmin
      .from('chef_recruitment_applications')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        city,
        tax_id: taxId,
        role,
        availability,
        bio,
        cv_url: cvPath, // object PATH within the private bucket (signed on read)
        photos_urls: photoPaths, // object PATHS within the private bucket
        status: 'pending',
      });
    if (dbErr) {
      console.error('Recruitment insert error:', dbErr);
      return json({ error: 'Failed to save application' }, 500);
    }

    // 7) Notify best-effort — never let messaging break a saved application.
    // The owner email carries the CV as an attachment + 30-day signed links to
    // the dish photos, so applications are fully reviewable from the inbox
    // without opening the Supabase dashboard.
    try {
      let cv_attachment = null;
      try {
        const cvBuf = Buffer.from(await cvFile.arrayBuffer());
        cv_attachment = {
          filename: `CV_${firstName}_${lastName}`.replace(/[^\w-]+/g, '_') + '.' + safeExt(cvFile.name, 'pdf'),
          content: cvBuf.toString('base64'),
        };
      } catch (e) {
        console.error('CV attachment build failed (sending email without it):', e);
      }
      let photo_links: string[] = [];
      if (photoPaths.length) {
        const { data: signed } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrls(photoPaths, 30 * 24 * 60 * 60);
        photo_links = (signed || []).map((s) => s.signedUrl).filter(Boolean);
      }
      await sendRecruitmentEmails({ first_name: firstName, last_name: lastName, email, phone, role, availability, city, bio, cv_attachment, photo_links });
    } catch (e) {
      console.error('Recruitment email failed:', e);
    }
    try {
      await notifyOrganizer(
        `New application: ${firstName} ${lastName} — ${role} • ${city} • ${email} • ${phone}`
      );
    } catch (e) {
      console.error('Owner WhatsApp notification failed:', e);
    }
    try {
      await sendMessage({
        to: phone,
        body: `Hi ${firstName}, thank you for applying as ${role} with Nino's Private Chef. We have received your details and will be in touch soon!`,
        channel: 'whatsapp',
      });
    } catch (e) {
      console.error('Candidate WhatsApp notification failed:', e);
    }

    return json({ ok: true }, 200);
  } catch (error) {
    console.error('Recruitment submit error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
};
