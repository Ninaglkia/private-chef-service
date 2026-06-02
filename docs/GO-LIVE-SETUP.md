# Go-Live Setup — Private Chef Service

Click-by-click guide to take **ninos-privatechefs.com** fully live. ~15 minutes.
Everything below is derived from the actual code in this repo and the current
state of the Vercel and Stripe accounts (verified at time of writing).

- **Vercel project:** `private-chef-service` (team "nino's projects", `team_UJAl5hM2O5UEyHYWfukUDLPa`), production domain `ninos-privatechefs.com`.
- **Stripe account:** `acct_1IXPruGnODfeVx0f` (display name "https://ninos-privatechefs.com/").
- **Supabase project:** `private chef at home` (ref `zyptbqfldwvbxntwrfqq`).

---

## ⚠️ TL;DR — what is actually blocking go-live

Verified against Vercel Production right now:

| Status | Item |
|--------|------|
| 🔴 **BLOCKER** | `STRIPE_WEBHOOK_SECRET` is **not set in any Vercel environment.** Without it, `/api/stripe-webhook` returns 400 on every event → **paid bookings never become `confirmed`, and NO confirmation email/SMS is sent.** Fix in **Section B**. |
| 🟠 **WRONG DOMAIN** | `EMAIL_FROM` / `EMAIL_SYSTEM` in Production point to **`@cleanhomeapp.com`** (a different project's domain), not `@ninos-privatechefs.com`. Emails go out off-brand and only work if that other domain is verified in this Resend account. Fix in **Section C**. |
| 🟡 **MISSING ON PREVIEW** | `EMAIL_FROM`, `EMAIL_SYSTEM`, `RESEND_API_KEY`, `WELCOME_WEBHOOK_SECRET` exist only on **Production** (not Preview). Preview deploys will degrade/break server endpoints. Fix in **Section A**. |
| 🟡 **OPTIONAL, UNSET** | `TWILIO_*` and `ORGANIZER_PHONE` are not set in Vercel → SMS/WhatsApp notifications are silently disabled. The site works fine without them. Add later if you want SMS (**Section A**). |
| 🟢 OK | `STRIPE_SECRET_KEY` in Production is already a **LIVE** key (`sk_live_…`). |
| 🟢 OK | `RESEND_API_KEY` is already set in Production (`re_…`). Just verify the sending domain (**Section C**). |

> The local `.env` in this repo still has `sk_test_…` — that's fine, it's for
> local dev only. **Vercel Production is the source of truth** and already runs LIVE Stripe.

Do the sections **in order**: A (env hygiene) → B (Stripe webhook, the real blocker) → C (email domain) → D (checklist + smoke test).

---

## A) Vercel environment variables

### Every env var the code reads

Grepped from `import.meta.env.*` across `src/`. "Where" = where the value comes from.
"Server-only" vars must **never** be `PUBLIC_`-prefixed.

| Variable | Used by | What it is / where it comes from | Required? |
|----------|---------|----------------------------------|-----------|
| `PUBLIC_SUPABASE_URL` | supabase client, middleware, all API routes, admin pages | Supabase → Project Settings → API → Project URL | **Yes** |
| `PUBLIC_SUPABASE_ANON_KEY` | supabase client, middleware | Supabase → Project Settings → API → anon/publishable key | **Yes** |
| `SUPABASE_SERVICE_ROLE_KEY` | request-booking, request-quote, create-checkout-session, stripe-webhook, admin/* , booking/confirmation/dashboard pages | Supabase → Project Settings → API → **service_role** key (secret, bypasses RLS) | **Yes** |
| `STRIPE_SECRET_KEY` | create-checkout-session, stripe-webhook, admin/send-payment-link, admin/update-booking | Stripe → Developers → API keys → **Secret key** (`sk_live_…` in prod) | **Yes** |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook (signature verification) | Stripe → Developers → Webhooks → your endpoint → **Signing secret** (`whsec_…`). **Per-endpoint and per-mode** (test vs live differ). | **Yes — currently MISSING** |
| `RESEND_API_KEY` | `src/lib/email.ts` (all transactional email) | resend.com → API Keys (`re_…`). If unset, email is silently skipped. | **Yes** (already set) |
| `EMAIL_FROM` | `src/lib/email.ts` — customer-facing "from" | Display-name + verified address. Falls back to `info@ninos-privatechefs.com`. | Recommended |
| `EMAIL_SYSTEM` | `src/lib/email.ts` — internal-notification "from" | Falls back to `sistema@ninos-privatechefs.com`. | Recommended |
| `WELCOME_WEBHOOK_SECRET` | `src/pages/api/welcome.ts` | Shared secret; caller must send it as header `x-webhook-secret`. Any long random string. If unset, `/api/welcome` returns 500. | Yes (if you wire welcome emails) |
| `TWILIO_ACCOUNT_SID` | `src/lib/sms.ts` | Twilio Console → Account SID (`AC…`). If unset, SMS/WhatsApp disabled (no crash). | Optional |
| `TWILIO_AUTH_TOKEN` | `src/lib/sms.ts` | Twilio Console → Auth Token | Optional |
| `TWILIO_FROM_NUMBER` | `src/lib/sms.ts` | Twilio SMS-capable number, E.164 (`+1…`) | Optional |
| `TWILIO_WHATSAPP_NUMBER` | `src/lib/sms.ts` | WhatsApp sender; defaults to Twilio sandbox `whatsapp:+14155238886` | Optional |
| `ORGANIZER_PHONE` | `src/lib/sms.ts` | Owner's WhatsApp for new-booking alerts; defaults to `+393285515590` | Optional |

**Not needed by current code (ignore):**
- `ADMIN_EMAILS` / `PUBLIC_ADMIN_EMAILS` — present in `.env` / Vercel but **no code reads them.** Admin authorization in `admin/send-payment-link.ts` and `admin/update-booking.ts` is hardcoded to `ninaglia089@gmail.com` plus a `profiles.role === 'admin'` check. Leaving the var set is harmless; don't rely on it.
- `PUBLIC_STRIPE_PUBLISHABLE_KEY` — set in Vercel but **unused.** Hosted Checkout and Payment Links redirect to Stripe-hosted pages, so the publishable key is never needed on the client. Safe to keep or remove.

### The Preview gotcha

Vercel evaluates env vars **per environment**. A Preview deployment (every PR / branch
push) that lacks `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_*` will throw inside the
`createClient(...)` / `new Stripe(...)` module init and **500 every server endpoint**.
Today these exist on Production but several are missing on Preview.

**Rule: set every server var on Production AND Preview** (Development too, for `vercel dev`).

### How to set them (Vercel UI)

1. https://vercel.com → team **nino's projects** → project **private-chef-service**.
2. **Settings → Environment Variables.**
3. For each variable: enter **Key** and **Value**, then under "Environments" tick
   **Production**, **Preview**, **Development** (tick all three unless noted otherwise).
4. **Save.**
5. After changing vars, **redeploy** so they take effect: **Deployments → latest
   production deployment → ⋯ → Redeploy** (env vars are baked at build/deploy time).

CLI equivalent (optional), from the repo root (already linked to the project):
```bash
vercel env add EMAIL_FROM preview        # prompts for value, applies to Preview
vercel env ls                            # verify what exists per environment
```

### Action items for Section A

- [ ] Add `EMAIL_FROM`, `EMAIL_SYSTEM`, `RESEND_API_KEY`, `WELCOME_WEBHOOK_SECRET` to **Preview** (they're Production-only now).
- [ ] Fix `EMAIL_FROM` / `EMAIL_SYSTEM` to use `@ninos-privatechefs.com` (see Section C).
- [ ] (Optional) Add `TWILIO_*` + `ORGANIZER_PHONE` to Production+Preview if you want SMS/WhatsApp.
- [ ] `STRIPE_WEBHOOK_SECRET` → handled in Section B.

---

## B) Stripe: confirm LIVE + create the webhook (the real blocker)

The account is already activated and Production already uses `sk_live_…`, and the
three live products already exist:
`Private Chef — Single Day`, `Private Chef — Weekend`, `Private Chef — Full Week`.
So the only missing piece is the **live webhook signing secret**.

> **You do NOT need to manually create a Product/Price for go-live.** The code creates
> what it needs on the fly:
> - **Hosted Checkout** (`create-checkout-session.ts`) builds the line item with inline
>   `price_data` — no pre-existing product required.
> - **Pay-later Payment Links** (`admin/send-payment-link.ts`) create a fresh Product +
>   one-off Price on every call. (Side effect: each payment link spawns a new
>   "Private Chef Service" product in your dashboard — cosmetic clutter only, not a blocker.)

### B1. Confirm the account is fully activated (if not already)

1. https://dashboard.stripe.com → make sure the top-left toggle shows **live mode** (not "Test mode").
2. If a banner says "Activate your account", complete: business details, bank account for payouts, identity. This is required to actually receive money.

### B2. Get the LIVE secret key (only if you ever need to rotate it)

Production already has `sk_live_…`. To re-fetch: **Developers → API keys → Secret key
→ Reveal**. (No publishable key needed on the client for this site.)

### B3. Create the LIVE webhook endpoint — REQUIRED

1. Dashboard in **live mode** → **Developers → Webhooks → Add endpoint** (or **+ Add destination**).
2. **Endpoint URL:**
   ```
   https://ninos-privatechefs.com/api/stripe-webhook
   ```
3. **Events to send → Select events →** check **`checkout.session.completed`**.
   (This is the only event the handler acts on — it covers both Hosted Checkout
   and Payment Link payments.)
4. **Add endpoint.**
5. Open the new endpoint → **Signing secret → Reveal** → copy the **`whsec_…`** value.

### B4. Put the signing secret in Vercel

1. Vercel → **private-chef-service → Settings → Environment Variables → Add New.**
2. **Key:** `STRIPE_WEBHOOK_SECRET`  **Value:** the `whsec_…` from B3.
3. Environments: tick **Production** (and **Preview** if you'll test payments on previews).
4. **Save**, then **redeploy** production.

> Why this matters: `src/pages/api/stripe-webhook.ts` rejects the event with HTTP 400 if
> `STRIPE_WEBHOOK_SECRET` is missing, and verifies every payload with
> `stripe.webhooks.constructEvent(...)`. No secret → no `pending → confirmed` transition,
> no confirmation email, no owner SMS. **This single var is what stands between a paid
> booking and a confirmed one.**

### Action items for Section B

- [ ] Confirm dashboard is in **live mode** and account fully activated (payouts enabled).
- [ ] Create live webhook → `https://ninos-privatechefs.com/api/stripe-webhook`, event `checkout.session.completed`.
- [ ] Copy `whsec_…` → set `STRIPE_WEBHOOK_SECRET` in Vercel (Production) → redeploy.

---

## C) Resend: verify the sending domain & fix the from-addresses

`RESEND_API_KEY` is already set. The problem is the **domain**: emails send from
`@cleanhomeapp.com` today, not `@ninos-privatechefs.com`.

### C1. Create / confirm the API key

1. https://resend.com → **API Keys**. If you need a fresh one: **Create API Key**,
   name e.g. `private-chef-prod`, permission **Sending access**, copy the `re_…` value.
2. (Only if rotating) update `RESEND_API_KEY` in Vercel (Production + Preview) → redeploy.

### C2. Add & verify the domain `ninos-privatechefs.com`

1. Resend → **Domains → Add Domain** → enter `ninos-privatechefs.com` → choose your
   region → **Add**.
2. Resend shows DNS records. Add them at your DNS provider (where
   ninos-privatechefs.com is hosted — likely Vercel DNS or your registrar):

   | Type | Host / Name | Value | Purpose |
   |------|-------------|-------|---------|
   | `MX` | `send` (e.g. `send.ninos-privatechefs.com`) | `feedback-smtp.<region>.amazonses.com` (priority 10) | bounce/feedback routing |
   | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | **SPF** |
   | `TXT` | `resend._domainkey` | the long `p=…` key Resend gives you | **DKIM** |
   | `TXT` (optional) | `_dmarc` | `v=DMARC1; p=none;` | **DMARC** (recommended) |

   > Copy the **exact** values from the Resend dashboard — the region host and the DKIM
   > `p=` key are unique to your account. The table shows the shape, not literal values.
   > If you use Vercel DNS: Vercel → Domains → ninos-privatechefs.com → add each record.

3. Back in Resend, click **Verify**. DNS can take minutes to ~1 hour. Status must read **Verified**.

### C3. Set the from-addresses (fix the cleanhomeapp.com mismatch)

The code uses two senders (`src/lib/email.ts`):
- `EMAIL_FROM` → customer-facing (booking confirmations, payment links, welcome, quotes).
- `EMAIL_SYSTEM` → internal copies sent to the owner (`ninaglia089@gmail.com`).

Resend requires `from` in the form `Display Name <user@verified-domain>`.

In Vercel (Production **and** Preview), set:
```
EMAIL_FROM    = Nino's Private Chef <hello@ninos-privatechefs.com>
EMAIL_SYSTEM  = Private Chef System <system@ninos-privatechefs.com>
```
Use any local-part you like (`hello@`, `info@`, `bookings@`) **as long as the domain is
the verified `ninos-privatechefs.com`.** Redeploy after saving.

> If you leave these unset, the code falls back to `info@ninos-privatechefs.com` /
> `sistema@ninos-privatechefs.com` — also fine, **provided the domain is verified**.
> What's broken today is that they're explicitly set to `@cleanhomeapp.com`.

### Action items for Section C

- [ ] Add + **verify** `ninos-privatechefs.com` in Resend (SPF TXT, DKIM TXT, MX; optional DMARC).
- [ ] Set `EMAIL_FROM` / `EMAIL_SYSTEM` to `@ninos-privatechefs.com` on Production + Preview → redeploy.

---

## D) Final checklist & smoke test

### Do these in this order

1. **Supabase** — confirm `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` are set on **Production + Preview** (already are).
2. **Stripe live webhook** (Section B) → set `STRIPE_WEBHOOK_SECRET`. ← the blocker.
3. **Resend domain verified** + `EMAIL_FROM`/`EMAIL_SYSTEM` on `@ninos-privatechefs.com` (Section C).
4. **Backfill Preview** with `EMAIL_FROM`, `EMAIL_SYSTEM`, `RESEND_API_KEY`,
   `WELCOME_WEBHOOK_SECRET` (Section A).
5. **(Optional) Twilio** vars if you want SMS/WhatsApp alerts.
6. **Redeploy Production** (Vercel → Deployments → ⋯ → Redeploy) so all new vars apply.
7. Run the **smoke test** below.

### Smoke test (end-to-end on the live site)

**Pay-later flow (the primary one):**
1. Go to https://ninos-privatechefs.com → submit a **booking request** (name, email,
   city, date, a plan). Expect a success message. *(This hits `/api/request-booking`,
   inserts a `pending` booking — no payment yet.)*
2. Log in as the owner (`ninaglia089@gmail.com`) → **/admin/control-panel** → confirm
   the new booking appears as `pending`.
3. Set the amount and **send the payment link**. *(Hits `/api/admin/send-payment-link`,
   creates a Stripe Payment Link and emails the customer.)* Confirm the customer
   receives the **"Your Private Chef payment link"** email (check the **from** address
   is `@ninos-privatechefs.com`).
4. Open the link, pay. In **live mode use a real card** (Stripe will charge it — refund
   yourself after). To rehearse without real money, do this run in **Stripe test mode**
   with a separate test webhook and card `4242 4242 4242 4242`, any future expiry, any CVC.
5. After payment, Stripe fires `checkout.session.completed` → the webhook flips the
   booking to **`confirmed`**. Verify:
   - Admin panel shows `confirmed`.
   - Customer gets the **"Booking Confirmation"** email; owner gets a **`[NEW BOOKING]`** email.
   - (If Twilio configured) owner gets a WhatsApp alert.

**Instant Hosted-Checkout flow (if used):** submit via `/booking` → redirected to Stripe
Checkout → pay → redirected to `/confirmation?session_id=…` → same webhook path confirms
the booking and sends the same emails.

**Verify the webhook actually fired:** Stripe Dashboard → **Developers → Webhooks →
your endpoint → "Events"**: the `checkout.session.completed` delivery should show **200**.
A `400` there means `STRIPE_WEBHOOK_SECRET` is wrong/missing (back to Section B). You can
also **Resend** a failed event from that screen after fixing the secret.

### Pass criteria
- [ ] Booking request → appears in admin as `pending`.
- [ ] Payment link email arrives, from `@ninos-privatechefs.com`.
- [ ] Payment succeeds → webhook shows **200** in Stripe → booking becomes `confirmed`.
- [ ] Customer confirmation email + owner notification email both arrive.

---

### Reference: env var → environment matrix (set ALL on Production + Preview)

| Var | Production | Preview | Notes |
|-----|:----------:|:-------:|-------|
| `PUBLIC_SUPABASE_URL` | ✅ | ✅ | set |
| `PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | set |
| `STRIPE_SECRET_KEY` | ✅ (sk_live) | ✅ | set |
| `STRIPE_WEBHOOK_SECRET` | ❌ **add** | ❌ **add** | **blocker — Section B** |
| `RESEND_API_KEY` | ✅ | ❌ **add** | Production-only today |
| `EMAIL_FROM` | ⚠️ wrong domain | ❌ **add** | fix to @ninos-privatechefs.com |
| `EMAIL_SYSTEM` | ⚠️ wrong domain | ❌ **add** | fix to @ninos-privatechefs.com |
| `WELCOME_WEBHOOK_SECRET` | ✅ | ❌ **add** | Production-only today |
| `TWILIO_*`, `ORGANIZER_PHONE` | ❌ optional | ❌ optional | SMS/WhatsApp off until set |
