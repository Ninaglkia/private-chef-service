# Recruitment Security Hardening — Implementation Plan

> **For agentic workers:** executed inline this session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the pre-launch security holes in the "Work with us" recruitment flow (public bucket with CVs + tax IDs, anon table insert, unescaped/unprotected notify endpoint) by moving all persistence server-side behind the service role, making the storage bucket private, and giving the admin a real view of applications via signed URLs.

**Architecture:** All recruitment writes go through ONE server endpoint (`/api/recruitment/submit`) using the service-role key. The browser only does client-side AI verification (UX gate) and POSTs a multipart form. The `chef-applications` bucket becomes private; the DB stores object PATHS (not public URLs); the admin control panel renders short-lived signed URLs generated server-side. Owner email is centralized in `src/lib/admin.ts`.

**Tech Stack:** Astro 5 (SSR, Vercel adapter), `@supabase/supabase-js` (service role), Supabase Storage signed URLs, Resend (email via `src/lib/email.ts`), existing `src/lib/rate-limit.ts`.

**Supabase project (chef):** `zyptbqfldwvbxntwrfqq` — migration applied LIVE (the bucket is public in production right now; a migration file alone does not secure prod).

**Verification reality:** this project has no test runner (no `test` script, no test files). "Tests" here = `npx astro check` (type/diagnostics) + build must pass + a security-reviewer pass + explicit reasoning about the RLS/storage access properties. TDD with a runner is out of scope (no harness exists; adding one is not part of this task).

---

## File map

- **Modify (migration, applied live):** `supabase/migrations/20260603_recruitment_private_bucket.sql` (Create)
- **Create:** `src/lib/admin.ts` — owner-email allowlist + `isOwnerEmail()` + `ORGANIZER_EMAIL`
- **Modify:** `src/lib/email.ts` — add `sendRecruitmentEmails()` (escaped); import `ORGANIZER_EMAIL` from `admin.ts`
- **Create:** `src/pages/api/recruitment/submit.ts` — server-side submit (rate-limit, honeypot, validate, upload to private bucket as paths, insert, notify)
- **Modify:** `src/pages/work-with-us.astro` — POST FormData to the endpoint; add honeypot; drop direct storage/table writes
- **Delete:** `src/pages/api/notify-recruitment.ts` — superseded (was unescaped + unauthenticated + no rate-limit)
- **Modify:** `src/pages/admin/control-panel.astro` — fetch applications + render signed URLs; use `isOwnerEmail`
- **Modify:** `src/pages/api/admin/send-payment-link.ts`, `src/pages/api/admin/update-booking.ts`, `src/pages/dashboard.astro` — use `isOwnerEmail` from `admin.ts` (M3 cleanup)
- **Create:** `docs/STRIPE-GO-LIVE.md` — H4 checklist (action items for Nino; cannot be flipped without live keys)

---

## Task 1: Migration — private bucket, kill anon write surface, real columns

**Files:** Create `supabase/migrations/20260603_recruitment_private_bucket.sql`

- [ ] Write migration:
  - `update storage.buckets set public = false where id = 'chef-applications';`
  - `drop policy if exists "Public Access" on storage.objects;` (anon read of objects)
  - `drop policy if exists "Public Upload" on storage.objects;` (anon upload)
  - `drop policy if exists "Public can insert recruitment applications" on public.chef_recruitment_applications;`
  - `revoke insert on public.chef_recruitment_applications from anon;`
  - Add real columns so we stop hacking `city` + a public `details.json`:
    `alter table public.chef_recruitment_applications add column if not exists role text, add column if not exists availability text, add column if not exists bio text, add column if not exists phone text;`
  - Keep the existing admin SELECT/UPDATE policies (untouched). After this, the table is writable only by service-role; objects are readable only by service-role (signed URLs).
- [ ] Apply LIVE to project `zyptbqfldwvbxntwrfqq` via Supabase MCP `apply_migration`.
- [ ] Verify: `get_advisors(security)` shows no new errors; the bucket row `public=false`.

## Task 2: `src/lib/admin.ts` — centralize owner identity (M3)

- [ ] Create with: `OWNER_EMAIL` fallback const; `ADMIN_EMAILS` parsed from `import.meta.env.ADMIN_EMAILS` (comma-separated, lowercased) unioned with the fallback; `export function isOwnerEmail(email?: string | null): boolean`; `export const ORGANIZER_EMAIL` (first/primary owner email, for outbound notifications).

## Task 3: `src/lib/email.ts` — escaped recruitment emails + shared owner const

- [ ] Replace the local `const ORGANIZER_EMAIL = 'ninaglia089@gmail.com'` with `import { ORGANIZER_EMAIL } from './admin'`.
- [ ] Add `export async function sendRecruitmentEmails(data)` building BOTH the candidate confirmation and the owner alert with `getHtmlTemplate()` + `escapeHtml()` on every dynamic field, owner button via `emailButton()` to the control panel. Best-effort (Promise.all, errors caught by caller).

## Task 4: `src/pages/api/recruitment/submit.ts` — the only write path

- [ ] `POST`: rate-limit per IP (`recruitment-submit:${ip}`, limit 5/min) → 429; parse `multipart/form-data`; honeypot field `company_website` → fake-200; validate required (`first_name,last_name,email,phone,city,tax_id,role,availability,bio`, role ∈ {chef,waiter}); cap file sizes (CV ≤ 8 MB, each photo ≤ 8 MB, ≤ 5 photos) and types; upload CV to `cvs/<rand>.<ext>` and photos to `photos/<rand>.<ext>` in `chef-applications` via service-role, storing PATHS; insert row (paths in `cv_url`/`photos_urls`, plus new `role/availability/bio/phone` columns); fire `sendRecruitmentEmails` + `notifyOrganizer` best-effort; return `{ ok: true }`.
- [ ] Use a private filename generator that does not rely on `Math.random` only for security (paths are non-guessable AND the bucket is private; both hold).

## Task 5: `src/pages/work-with-us.astro` — thin client

- [ ] Add a hidden honeypot input `company_website` (visually hidden, `tabindex=-1`, `autocomplete=off`).
- [ ] Replace the submit handler body: keep AI verification gate; on submit build `FormData(form)` (already includes files + fields) and `fetch('/api/recruitment/submit', { method:'POST', body: formData })`; on `res.ok` show success, else show returned error. Remove the `import { supabase }` and ALL direct `supabase.storage`/`.from('chef_recruitment_applications')` calls and the `details.json` blob.

## Task 6: Delete `src/pages/api/notify-recruitment.ts`

- [ ] `git rm` — it is now unreferenced (only caller was work-with-us, rewritten in Task 5) and was the unescaped/unauthenticated path.

## Task 7: `src/pages/admin/control-panel.astro` — real applications view

- [ ] In frontmatter: fetch `chef_recruitment_applications` (service-role, newest first). For each, build signed URLs: `supabaseAdmin.storage.from('chef-applications').createSignedUrl(path, 3600)` for `cv_url` and each `photos_urls[]`. Be robust to legacy values that are full public URLs (strip the `…/object/public/chef-applications/` prefix to recover the path).
- [ ] Replace `isOwner` hardcode with `isOwnerEmail(user.email)` from `admin.ts`.
- [ ] Add a "Recruitment" section rendering applicant name/email/phone/city/role/availability/bio/tax_id + signed links to CV and photos, with the existing approve/reject affordance if present (status badge).

## Task 8: M3 cleanup in remaining files

- [ ] `send-payment-link.ts`, `update-booking.ts`, `dashboard.astro`: replace the local `'ninaglia089@gmail.com'` checks with `isOwnerEmail(...)` from `admin.ts`.

## Task 9: H4 — `docs/STRIPE-GO-LIVE.md`

- [ ] Write the go-live checklist (swap `sk_live`/`pk_live` in Vercel, create LIVE webhook endpoint + secret, verify `apiVersion`, smoke-test one real payment, confirm webhook → `confirmed`). Note: cannot be executed without Nino providing LIVE keys.

## Verify

- [ ] `npx astro check` → no new errors in touched files.
- [ ] `npx astro build` → succeeds.
- [ ] security-reviewer agent pass on the recruitment flow + migration.
- [ ] Commit (conventional, no attribution) + push.

## Self-review notes

- Spec coverage: C1 (Tasks 1,4,5,6,7), H1 (Tasks 3,4,5,6), H4 (Task 9), M3 (Tasks 2,3,7,8). Covered.
- Type consistency: `ChefRecruitmentApplication` in `lib/supabase.ts` gains optional `role/availability/bio/phone` — update the type. `cv_url`/`photos_urls` keep their names but now hold PATHS (documented).
- No placeholders: each task lists exact files + concrete operations.
