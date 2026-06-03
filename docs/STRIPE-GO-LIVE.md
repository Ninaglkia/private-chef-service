# Stripe Go-Live Checklist (H4)

The site runs on real `ninos-privatechefs.com` but Stripe is still in **TEST** mode,
so no real money can be collected. These steps require LIVE keys from the Stripe
Dashboard and cannot be done from the codebase — they are action items for the owner.

## 1. Get the LIVE keys
- Stripe Dashboard → toggle **View test data** OFF (top-right) so you are in **Live mode**.
- Developers → API keys → copy:
  - **Publishable key** `pk_live_...`
  - **Secret key** `sk_live_...` (reveal once, store safely)

## 2. Create the LIVE webhook endpoint
- Live mode → Developers → Webhooks → **Add endpoint**
- URL: `https://ninos-privatechefs.com/api/stripe-webhook`
- Events to send: at minimum `checkout.session.completed` (and `payment_intent.succeeded` if used)
- After creating, copy the **Signing secret** `whsec_...` (this is the LIVE one — different from test)

## 3. Set the env vars in Vercel (Production scope)
Update these in Vercel → Project → Settings → Environment Variables (Production):
- `STRIPE_SECRET_KEY` = `sk_live_...`
- `STRIPE_WEBHOOK_SECRET` = `whsec_...` (the LIVE one from step 2)
- `PUBLIC_STRIPE_PUBLISHABLE_KEY` (or whatever the publishable var is named) = `pk_live_...`
- Redeploy so the new values take effect.

> Verify the exact env var names against the code before changing:
> `grep -rn "STRIPE_SECRET_KEY\|STRIPE_WEBHOOK_SECRET\|PUBLISHABLE" src/`

## 4. Confirm the API version still matches
- `send-payment-link.ts` pins `apiVersion: '2025-12-15.clover'`. Make sure the live
  account is on a compatible version (Stripe is backward compatible; leave as is unless
  the Dashboard warns otherwise).

## 5. Smoke test ONE real payment (small amount)
- Create a real pending booking from the site (`/richiesta`).
- From the admin panel, send a payment link for a tiny amount (e.g. €1) to yourself.
- Pay it with a real card.
- Confirm: redirect to `/confirmation` shows **Paid**, the booking flips to `confirmed`,
  and the confirmation emails arrive.
- Refund the €1 test in the Dashboard.

## 6. Final
- Confirm the webhook shows a `200` for the test event in the Dashboard.
- Remove any leftover test bookings from the DB if desired.

Once 1–6 pass, Stripe is live.
