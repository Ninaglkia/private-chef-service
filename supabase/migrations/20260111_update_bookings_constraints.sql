-- Update constraints to support luxury experience plan and flexible guest counts
-- This migration must be run manually in Supabase SQL Editor as the CLI is not authenticated.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_plan_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_plan_check CHECK (plan IN ('standard', 'plus', 'premium', 'luxury_experience'));

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_num_guests_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_num_guests_check CHECK (num_guests >= 1 AND num_guests <= 50);
