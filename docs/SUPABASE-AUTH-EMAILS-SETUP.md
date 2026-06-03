# Branded Supabase Auth emails (Confirm signup + Reset password)

Goal: replace the ugly default Supabase email ("Confirm Your Signup", sender
*Mail App Supabase Noreply*) with our branded template, sent from
**info@ninos-privatechefs.com** via Resend, and have the confirmation link land on
our own branded **/welcome** page (never a 404).

How the link works now: the templates point the button at
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`. Our page
`src/pages/auth/confirm.astro` verifies the token client-side (works even if the
guest opens the email on a different device), logs them in, and redirects to
`/welcome` (or `/reset-password` for the recovery email).

All steps below are in the Supabase Dashboard (project `zyptbqfldwvbxntwrfqq`).

---

## PART 0 — Site URL (so the link resolves to the live site)

Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://ninos-privatechefs.com`

`{{ .SiteURL }}` in the email templates resolves to this value, so it MUST be the
production domain (not localhost / a preview URL).

---

## PART 1 — Send auth emails from our domain (Resend SMTP)

By default Supabase sends from its own shared address (poor deliverability, ends
in spam). Point it at Resend so the email comes from our verified domain.

Dashboard → **Project Settings → Authentication → SMTP Settings** → enable
**"Set up custom SMTP server"**:

| Field | Value |
|---|---|
| Sender email | `info@ninos-privatechefs.com` |
| Sender name | `Nino's Private Chef` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_...`) — same `RESEND_API_KEY` as Vercel, or a new one |

The domain is already verified in Resend (the app already sends from it), so no
extra DNS is needed.

> Without custom SMTP the template is still pretty, but the sender stays
> "Supabase" and you hit a low free-tier rate limit. SMTP is what makes it come
> from *Nino's Private Chef <info@ninos-privatechefs.com>*.

---

## PART 2 — Paste the branded templates

Dashboard → **Authentication → Emails → Templates**.

### Confirm signup
- **Subject:** `Confirm your email — Nino's Private Chef`
- **Message body:** paste the full contents of
  `supabase/auth-email-templates/confirm-signup.html`
  (button → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`).

### Reset password
- **Subject:** `Reset your password — Nino's Private Chef`
- **Message body:** paste the full contents of
  `supabase/auth-email-templates/reset-password.html`
  (button → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`).

(Magic Link / Change Email can reuse the same shell later; not needed now.)

---

## Verify end-to-end
1. Live site → Sign up with a throwaway email.
2. Inbox shows the **branded** "Confirm your email" from
   *Nino's Private Chef <info@ninos-privatechefs.com>*.
3. Click **Confirm my email** → lands on **/welcome** ("Welcome to Nino's Private
   Chef"), logged in — NOT a 404.
4. (Optional) Reset password from /reset-password → branded email → the link opens
   /auth/confirm?type=recovery → redirects to /reset-password to set a new one.

If the email still shows the old sender → custom SMTP not enabled (Part 1).
If the link 404s → Site URL wrong (Part 0) or the template still uses the old
`{{ .ConfirmationURL }}` (re-paste Part 2).
