// Private Chef — pricing model.
//
// Single chef (Nino), flat rate, up to 15 guests (price does NOT change with
// headcount). Groceries are always billed separately, at cost. Service in
// Lombardy; travel abroad is quoted per destination (accommodation on top,
// unless the client provides a room for the chef).

export type Product = 'day' | 'weekend' | 'week';

export interface ProductDetails {
  id: Product;
  name: string;
  /** Number of service days the package covers. */
  days: number;
  /** Price in euro cents (integer, no floating point). */
  priceCents: number;
  tagline: string;
  highlight?: boolean;
  features: string[];
}

/** Max guests served at the flat price. Beyond this -> custom / abroad quote. */
export const MAX_GUESTS = 15;

const SHARED_FEATURES = [
  'Breakfast, lunch & dinner — or whatever you prefer',
  `Up to ${MAX_GUESTS} guests, same price`,
  'Personalised menu planning',
  'Full kitchen management',
  'Groceries billed separately, at cost',
];

export const PRODUCTS: Record<Product, ProductDetails> = {
  day: {
    id: 'day',
    name: 'Single Day',
    days: 1,
    priceCents: 60000, // €600
    tagline: 'A full day with your private chef',
    features: ['One full service day', ...SHARED_FEATURES],
  },
  weekend: {
    id: 'weekend',
    name: 'Weekend',
    days: 2,
    priceCents: 120000, // €1,200
    tagline: 'Saturday & Sunday at home',
    features: ['Two consecutive service days', ...SHARED_FEATURES],
  },
  week: {
    id: 'week',
    name: 'Full Week',
    days: 7,
    priceCents: 370000, // €3,700
    tagline: 'Seven days — best value',
    highlight: true,
    features: ['Seven consecutive service days', 'Best value — save vs the daily rate', ...SHARED_FEATURES],
  },
};

export const PRODUCT_LIST: ProductDetails[] = [PRODUCTS.day, PRODUCTS.weekend, PRODUCTS.week];

export function isValidProduct(value: unknown): value is Product {
  return value === 'day' || value === 'weekend' || value === 'week';
}

/** Authoritative, server-side price for a product (in cents). */
export function getProductPrice(product: Product): number {
  return PRODUCTS[product].priceCents;
}

export function getProductDays(product: Product): number {
  return PRODUCTS[product].days;
}

export function formatPrice(cents: number): string {
  return `€${(cents / 100).toLocaleString('en-EU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

// Custom / abroad: handled as a quote request, not instant checkout.
export const CUSTOM_PLAN = {
  name: 'Abroad & Bespoke',
  guestRange: '15+ / outside Lombardy',
  guests: 'Larger events or service outside Lombardy',
  tagline: 'Tailored to your destination',
  features: [
    'Service anywhere outside Lombardy',
    'Travel & accommodation quoted per destination',
    'Or provide a room for the chef — no extra cost',
    'Tailored menus & dietary needs',
    'Response within 24 hours',
  ],
};
