# Pay-later booking via Stripe Payment Link — Design

**Date:** 2026-06-02
**Status:** Approved (design), pending implementation plan
**Author:** Nino + Claude

## Problem & Goal

Today the site forces the customer to **pay €600+ online instantly**, before ever speaking
with the chef. For a high-touch private-chef service this is wrong friction: the customer
wants to talk about the menu, dates and details first.

New model — **request → talk → pay**:

1. The customer (as a **guest**, no account required) submits a **request** with their
   contact details and what they'd like to eat. **No payment at this point.**
2. The owner (Nino) is notified, talks to the customer, agrees the menu and the price.
3. From the admin panel the owner generates and sends a **Stripe Payment Link** (an amount
   he sets, non-expiring) by **email** and, if the customer has an account, as a **"Pay now"**
   button in their profile.
4. The customer pays via the link → the webhook confirms the booking → confirmation
   email/SMS fire (as today).
5. (Separate, later phase) **promotional emails** to customers who opted in, to drive re-bookings.

## Non-goals (explicitly out of scope for this spec)

- Stripe **Invoices** (PDF + automatic dunning). Payment Link is the default; an invoice
  path can be added later for business clients. Code should not preclude it.
- **Actual sending** of promotional campaigns. We only **capture consent + email** now.
- Full **auth refactor**. The paid path no longer depends on auth, so the known session/signup
  bugs do not block this feature.

## Key decisions (approved)

| Decision | Choice |
|---|---|
| Who can request | **Guest** (no account). Account optional; logged-in users get prefill + "Pay now" in profile. |
| Payment mechanism | **Stripe Payment Link** (non-expiring, custom amount). Not instant Checkout (24h expiry). |
| Amount | Set by owner per booking; **prefilled** with the package price, **editable** (abroad/events = custom). |
| Pipeline | **Single pipeline** — every request (incl. abroad, `plan='custom'`) becomes a `bookings` row. `quote_requests` retired for new traffic. |
| Marketing | Capture `marketing_consent` checkbox now; promo sending later. GDPR-compliant (explicit opt-in + future unsubscribe). |

## Architecture & data flow

```
Guest /booking form (no login)
   │  POST /api/request-booking   (validate, rate-limit, honeypot)
   ▼
bookings row: status='pending', total_price=NULL|package price,
              marketing_consent, no payment_link yet
   │  notify owner (email + WhatsApp/SMS)
   ▼
Admin panel → "Requests" section (pending bookings)
   │  owner talks to customer, then "Send payment link" (amount)
   │  POST /api/admin/send-payment-link
   │     → create one-off Stripe Price (shared "Private Chef Service" Product)
   │     → create Payment Link (price, metadata.booking_id,
   │                            restrictions: 1 completed session,
   │                            after_completion → /confirmation?session_id=...)
   │     → store payment_link_url, payment_link_id, link_sent_at, total_price
   │     → email link to customer (Resend)
   ▼
Customer pays (email link, or "Pay now" in account)
   │  Stripe → webhook checkout.session.completed
   │     resolve booking by session.metadata.booking_id
   │       OR fallback: bookings.payment_link_id == session.payment_link
   │     pending → confirmed (idempotent), store stripe_session_id + payment_intent
   ▼
Confirmation page + confirmation email/SMS (existing)
```

## Data model changes (`bookings`)

Reuse existing statuses — **no new status values**, so the existing CHECK constraint and the
dashboard labels keep working: `pending → confirmed → completed | cancelled | refunded`.

Add columns:

- `payment_link_url text` — the Stripe Payment Link URL sent to the customer
- `payment_link_id text` — Stripe Payment Link id (`plink_…`), used as the robust webhook lookup key
- `link_sent_at timestamptz` — when the link was generated/sent
- `marketing_consent boolean not null default false`

Constraints/notes:

- Ensure `total_price` is **nullable** (custom/abroad requests have no price until quoted).
- `plan` already allows `'custom'` (per `20260601_solo_chef_model.sql`).
- A migration adds the columns idempotently (`add column if not exists`) and must be applied to
  the **live** project `zyptbqfldwvbxntwrfqq`.

Admin state derived from these (no extra column needed):

- `pending` + `link_sent_at IS NULL` → 🟡 **"To contact"**
- `pending` + `link_sent_at IS NOT NULL` → 🔵 **"Link sent — awaiting payment"**
- `confirmed` → paid, etc.

This also fixes the earlier blind spot: pending bookings are now **visible** in admin.

## Components

### 1. Request form — `src/pages/booking.astro`
- **Remove the login gate** (allow guests). Keep profile prefill when logged in.
- Single submit path → `POST /api/request-booking` for **all** plans (day/weekend/week and
  custom/abroad). Remove the customer-facing `create-checkout-session` call.
- Add fields: "what you'd like to eat / dietary needs" (reuse `dietary_preferences`/`notes`),
  **marketing consent checkbox** (unchecked by default).
- Keep honeypot; keep client-side validation.
- On success → a friendly **"Thanks, I'll contact you"** state/page (not Stripe).

### 2. Request endpoint — `src/pages/api/request-booking.ts` (new)
- Rate-limit per IP (reuse `lib/rate-limit`), honeypot check.
- Validate required fields + product (`isValidProduct` or `'custom'`). Guests: fixed plans
  `1..15` (`MAX_GUESTS`); `custom` allows `1..200` (matches the old quote-request cap).
- Insert `bookings` row: `status='pending'`, `total_price` = package price for fixed plans else
  `NULL`, `marketing_consent`, end_date computed via the existing UTC-safe math.
- Notify owner (email + SMS/WhatsApp). Best-effort (never 500 on notify failure).
- Returns success JSON; no Stripe call.

### 3. Admin "Send payment link" — new `src/pages/api/admin/send-payment-link.ts`
(Kept separate from `update-booking.ts`: the Stripe Product/Price/Link logic is substantial and
distinct from the existing complete/refund/quote actions.)
- Auth gate: owner email OR `role='admin'` (reuse existing pattern).
- Input: `booking_id`, `amount` (cents).
- Create/reuse a shared Stripe **Product** ("Private Chef Service"); create a **one-off Price**
  (`unit_amount=amount`, `currency=eur`) — Payment Links require a Price, not inline price_data.
- Create **Payment Link**: `line_items:[{price, quantity:1}]`,
  `metadata:{ booking_id }`, `payment_intent_data:{ metadata:{ booking_id } }`,
  `restrictions:{ completed_sessions:{ limit:1 } }` (no double payment),
  `after_completion:{ type:'redirect', redirect:{ url: <origin>/confirmation?session_id={CHECKOUT_SESSION_ID} } }`.
- Update booking: `total_price=amount`, `payment_link_url`, `payment_link_id`, `link_sent_at=now()`.
- Send the **payment-link email** to the customer (Resend). Best-effort but surfaced to the
  owner (so he knows if email isn't configured and must resend/copy the link manually).

### 4. Admin panel UI — `src/pages/admin/control-panel.astro`
- New **"Requests"** section: lists `pending` bookings with the 🟡/🔵 state, the
  "what they want to eat" note, and a **"Send payment link"** control (amount input prefilled
  with the package price + send button). After sending, show the link + a "copy"/"resend" action.
- Existing Bookings (paid) and Quote sections stay; Quote section can be folded into legacy view.

### 5. Customer account — `src/pages/dashboard.astro`
- For a logged-in customer with a `pending` booking that has `payment_link_url`, show a
  **"Pay now"** button linking to the Payment Link.

### 6. Webhook — `src/pages/api/stripe-webhook.ts`
- On `checkout.session.completed`: resolve booking by `session.metadata.booking_id`, with a
  **fallback** lookup by `payment_link_id = session.payment_link`.
- Store `stripe_session_id = session.id` (so the confirmation page, which queries by session_id,
  finds the row) in addition to `stripe_payment_intent`.
- Keep the existing idempotent `pending → confirmed` transition + amount-mismatch log.

### 7. Confirmation page — `src/pages/confirmation.astro`
- Handle the **redirect-before-webhook race**: poll booking status (or re-check the Stripe
  session) for ~30s on the `!isPaid` branch, then fall back to "we'll email you / contact us".

### 8. Payment-link email — `src/lib/email.ts`
- New transactional template "Your payment link" (link button, amount, what was agreed,
  groceries-billed-separately note). Transactional → no marketing consent required.
- **Dependency:** Resend (`RESEND_API_KEY` + verified domain) must be configured for the link
  to actually reach the customer; otherwise the owner must copy the link from the panel.

## Error handling & edge cases

- **Double payment:** Payment Link `restrictions.completed_sessions.limit = 1`.
- **Webhook idempotency:** existing `pending → confirmed` single-row transition.
- **Amount mismatch:** existing webhook check (`session.amount_total` vs `total_price`).
- **Abandoned requests / unpaid links:** stay `pending`, visible in admin, owner can cancel.
- **Redirect beats webhook:** confirmation page polling (component 7).
- **Resend not configured:** payment-link send surfaces a warning; owner copies link manually.
- **Guest with no account:** link delivered by email only (no "Pay now" button — that's account-only).

## Security & privacy

- Request endpoint: rate limit + honeypot; server is source of truth for any prefilled price.
- Admin endpoints: owner/admin gate via service-role; never trust client for amount beyond the
  owner-entered value (owner is trusted).
- GDPR: `marketing_consent` explicit opt-in; promotional sends (future) must include an
  unsubscribe link and only target consenting addresses. Transactional emails are exempt.
- RLS (separate, pre-launch): tighten anon SELECT on `bookings`/`quote_requests` (tracked in
  `REMAINING-2026-06-01.md`); confirmation read is already server-side via service-role.

## Testing

- **Unit:** request validation (required fields, product, guests), amount/price helpers,
  admin auth gate.
- **Integration:** request → `pending` booking; admin send-link → Price+Link created, columns
  stored, email attempted; webhook confirm via metadata **and** via payment_link fallback;
  double-pay blocked by restriction.
- **Manual E2E (Stripe test mode):** submit request as guest → admin "Send payment link" →
  pay with test card → booking `confirmed` → shows under Bookings → refund from admin.

## Rollout

1. Migration (columns) on live `zyptbqfldwvbxntwrfqq` + verify `bookings_status_check` allows
   `confirmed` (the go-live blocker).
2. Ship code; test end-to-end in Stripe **test** mode.
3. Configure Resend (link email is core to this flow).
4. Switch Stripe to **LIVE** (sk_live + live webhook secret on Vercel Production) — see the
   separate go-live checklist.

## Future phases (not now)

- Promotional / re-booking email campaigns (consent-gated, with unsubscribe).
- Stripe Invoices for business clients.
- Auth hardening (`@supabase/ssr`, middleware, OAuth callback).
