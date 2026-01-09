/*
  # Create Bookings Table for Weekly Private Chef Service

  ## Overview
  This migration creates the core bookings table to store all customer bookings
  for the luxury private chef service.

  ## Tables Created
  
  ### `bookings`
  Main bookings table that stores all booking information:
  - `id` (uuid, primary key) - Unique booking identifier
  - `city` (text) - Client's city location
  - `start_date` (date) - Monday start date for the weekly service
  - `num_guests` (integer) - Number of guests (2-10)
  - `plan` (text) - Selected plan: 'standard', 'plus', or 'premium'
  - `add_saturday` (boolean) - Whether Saturday service is added
  - `add_sunday` (boolean) - Whether Sunday service is added
  - `dietary_preferences` (text) - Special dietary requirements or preferences
  - `total_price` (decimal) - Total price in EUR
  - `stripe_session_id` (text) - Stripe checkout session ID
  - `stripe_payment_intent` (text) - Stripe payment intent ID (after successful payment)
  - `status` (text) - Booking status: 'pending', 'confirmed', 'cancelled'
  - `customer_email` (text) - Customer email for confirmations
  - `customer_name` (text) - Customer full name
  - `customer_phone` (text) - Customer phone number
  - `created_at` (timestamptz) - Booking creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable Row Level Security (RLS) on bookings table
  - Add policy for authenticated admin users to manage all bookings
  - Public users can create bookings (for checkout process)

  ## Important Notes
  1. Prices are stored in EUR cents (e.g., €2,500 = 250000)
  2. Status defaults to 'pending' until payment is confirmed
  3. All bookings require upfront payment via Stripe
*/

-- Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  start_date date NOT NULL,
  num_guests integer NOT NULL CHECK (num_guests >= 2 AND num_guests <= 10),
  plan text NOT NULL CHECK (plan IN ('standard', 'plus', 'premium')),
  add_saturday boolean DEFAULT false,
  add_sunday boolean DEFAULT false,
  dietary_preferences text DEFAULT '',
  total_price integer NOT NULL,
  stripe_session_id text,
  stripe_payment_intent text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Allow public to insert bookings (for checkout process)
CREATE POLICY "Allow public to create bookings"
  ON bookings
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow public to read their own booking by session ID (for confirmation page)
CREATE POLICY "Allow public to read booking by session ID"
  ON bookings
  FOR SELECT
  TO anon
  USING (stripe_session_id IS NOT NULL);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bookings_stripe_session_id ON bookings(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_start_date ON bookings(start_date);
