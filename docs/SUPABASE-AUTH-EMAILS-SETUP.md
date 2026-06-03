# Branded Supabase Auth emails (Confirm signup + Reset password)

Goal: replace the ugly default Supabase email ("Confirm Your Signup", sender
*Mail App Supabase Noreply*) with our branded template, sent from
**info@ninos-privatechefs.com** via Resend.

There are two parts, both done in the Supabase Dashboard (project `zyptbqfldwvbxntwrfqq`).

---

## PART 1 — Send auth emails from our domain (Resend SMTP)

By default Supabase sends auth emails from its own shared address (bad design,
poor deliverability, ends in spam). Point it at Resend so the email comes from
our verified domain.

Dashboard → **Project Settings → Authentication → SMTP Settings** → enable
**"Set up custom SMTP server"** and fill in:

| Field | Value |
|---|---|
| Sender email | `info@ninos-privatechefs.com` |
| Sender name | `Nino's Private Chef` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_...`) — the same `RESEND_API_KEY` already in Vercel, or a new one from resend.com → API Keys |

Save. (The domain `ninos-privatechefs.com` is already verified in Resend because
the app already sends transactional email from it, so no extra DNS is needed.)

> Note: on Supabase's free tier custom SMTP is required to send more than a few
> emails/hour anyway — this also lifts the default rate limit.

---

## PART 2 — Paste the branded templates

Dashboard → **Authentication → Emails → Templates**.

### Confirm signup
- **Subject:** `Confirm your email — Nino's Private Chef`
- **Message body:** paste the full contents of
  `supabase/auth-email-templates/confirm-signup.html`
  (it uses the `{{ .ConfirmationURL }}` variable for the button + fallback link).

### Reset password
- **Subject:** `Reset your password — Nino's Private Chef`
- **Message body:** paste the full contents of
  `supabase/auth-email-templates/reset-password.html`

(The other templates — Magic Link, Change Email — can reuse the same shell later;
not needed for the current email+password flow.)

---

## Verify
1. Open the live site → Sign up with a throwaway email.
2. The inbox should now show the **branded** "Confirm your email" from
   *Nino's Private Chef <info@ninos-privatechefs.com>* (not "Mail App Supabase").
3. Click **Confirm my email** → it should land on the site logged in / confirmed.
4. (Optional) Trigger a password reset from /reset-password and check that email too.

If the email still shows the old sender, double-check that custom SMTP is **enabled**
(Part 1) and that you **saved** the template subject + body (Part 2).
