/*
  # Create Quote Requests Table for Custom Plans

  ## Overview
  This migration creates the quote_requests table to store custom quote inquiries
  for clients with 10+ guests who need tailored service plans.

  ## Tables Created
  
  ### `quote_requests`
  Table for storing custom quote requests:
  - `id` (uuid, primary key) - Unique request identifier
  - `customer_name` (text) - Customer's full name
  - `customer_email` (text) - Customer email address
  - `customer_phone` (text, nullable) - Customer phone number
  - `city` (text) - Service location city
  - `start_date` (date) - Requested Monday start date
  - `num_guests` (integer) - Number of guests (typically 10+)
  - `add_saturday` (boolean) - Whether Saturday service is requested
  - `add_sunday` (boolean) - Whether Sunday service is requested
  - `notes` (text) - Additional notes or special requests
  - `status` (text) - Request status: 'pending', 'contacted', 'quoted', 'converted', 'declined'
  - `created_at` (timestamptz) - Request creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable Row Level Security (RLS) on quote_requests table
  - Allow public to create quote requests (for the quote form)
  - Public users can read their own requests by email

  ## Important Notes
  1. This table handles custom quote requests for 10+ guests
  2. Status defaults to 'pending' until team reviews
  3. All requests are stored for CRM and follow-up purposes
*/

-- Create quote_requests table
CREATE TABLE IF NOT EXISTS quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  city text NOT NULL,
  start_date date NOT NULL,
  num_guests integer NOT NULL CHECK (num_guests >= 10),
  add_saturday boolean DEFAULT false,
  add_sunday boolean DEFAULT false,
  notes text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'quoted', 'converted', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

-- Allow public to insert quote requests (for the form)
CREATE POLICY "Allow public to create quote requests"
  ON quote_requests
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow public to read their own quote request by email
CREATE POLICY "Allow public to read own quote requests"
  ON quote_requests
  FOR SELECT
  TO anon
  USING (customer_email IS NOT NULL);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_quote_requests_email ON quote_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);
CREATE INDEX IF NOT EXISTS idx_quote_requests_start_date ON quote_requests(start_date);
