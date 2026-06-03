-- Track when the post-event thank-you email (with the optional tip link) was
-- sent, so the daily thank-you cron sends it exactly once per booking.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS thankyou_sent_at timestamptz;
