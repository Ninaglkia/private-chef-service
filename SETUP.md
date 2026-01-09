# Weekly Private Chef - Setup Guide

A premium, luxury website for a private chef service where professional chefs cook directly at the client's home.

## Features

- Modern, elegant design with premium aesthetics
- Three pricing tiers based on household size
- Dynamic pricing calculator with weekend add-ons
- Stripe payment integration
- Supabase database for booking management
- Fully responsive design
- GDPR-compliant booking flow

## Tech Stack

- **Frontend**: Astro with SSR
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **Payments**: Stripe
- **Hosting**: Node.js adapter (Vercel, Railway, or similar)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Update your `.env` file with the following variables:

```env
PUBLIC_SUPABASE_URL=your_supabase_project_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
STRIPE_SECRET_KEY=your_stripe_secret_key
PUBLIC_STRIPE_PUBLIC_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

#### Getting Supabase Credentials

1. Create a project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your project URL and anon/public key

The database migration has already been applied. The `bookings` table is ready to use.

#### Getting Stripe Credentials

1. Create an account at [stripe.com](https://stripe.com)
2. Go to Developers > API keys
3. Copy your Secret key and Publishable key
4. For webhooks: Go to Developers > Webhooks > Add endpoint
   - Endpoint URL: `https://yourdomain.com/api/stripe-webhook`
   - Events to listen: `checkout.session.completed`
   - Copy the signing secret

### 3. Development

Start the development server:

```bash
npm run dev
```

Visit `http://localhost:4321`

### 4. Build for Production

```bash
npm run build
```

### 5. Preview Production Build

```bash
npm run preview
```

## Pricing Plans

### Plan 1 - Weekly Private Chef
- **Price**: €2,500/week
- **Guests**: 2-4 people
- **Staff**: 1 private chef
- **Saturday**: +€800
- **Sunday**: +€800

### Plan 2 - Weekly Private Chef Plus
- **Price**: €4,000/week
- **Guests**: 5-7 people
- **Staff**: 1 private chef + 1 waiter
- **Saturday**: +€1,200
- **Sunday**: +€1,200

### Plan 3 - Weekly Private Chef Premium
- **Price**: €6,000/week
- **Guests**: 8-10 people
- **Staff**: 2 private chefs + 1 waiter
- **Saturday**: +€1,800
- **Sunday**: +€1,800

## Payment Flow

1. Customer selects plan and fills booking form
2. Booking is created in database with "pending" status
3. Customer is redirected to Stripe Checkout
4. After successful payment, webhook updates booking to "confirmed"
5. Customer is redirected to confirmation page

## Deployment

This project uses Astro with SSR mode and requires a Node.js hosting environment. Recommended platforms:

- Vercel
- Railway
- Render
- Fly.io
- DigitalOcean App Platform

Remember to set environment variables in your hosting platform's settings.

## Pages

- **/** - Home page with hero, features, pricing, FAQ
- **/booking** - Booking form with dynamic pricing
- **/confirmation** - Post-payment confirmation page
- **/terms** - Terms and conditions
- **/privacy** - Privacy policy

## API Endpoints

- **POST /api/create-checkout-session** - Creates Stripe checkout session
- **POST /api/stripe-webhook** - Handles Stripe payment webhooks
