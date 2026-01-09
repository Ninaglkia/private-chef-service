export type Plan = 'standard' | 'plus' | 'premium';

export interface PlanDetails {
  name: string;
  guestRange: string;
  guests: string;
  weekPrice: number;
  saturdayPrice: number;
  sundayPrice: number;
  staff: string[];
  features: string[];
}

export const PLANS: Record<Plan, PlanDetails> = {
  standard: {
    name: 'Weekly Private Chef',
    guestRange: '2-4',
    guests: 'from 2 up to 4 people',
    weekPrice: 250000,
    saturdayPrice: 80000,
    sundayPrice: 80000,
    staff: ['1 private chef'],
    features: [
      'Monday to Friday service',
      'Breakfast, lunch & dinner',
      '2 to 4 guests',
      'Menu planning included',
      'Kitchen management',
      'Groceries handled internally',
    ],
  },
  plus: {
    name: 'Weekly Private Chef Plus',
    guestRange: '5-7',
    guests: 'from 5 up to 7 people',
    weekPrice: 400000,
    saturdayPrice: 125000,
    sundayPrice: 125000,
    staff: ['1 private chef', '1 waiter'],
    features: [
      'Monday to Friday service',
      'Breakfast, lunch & dinner',
      '5 to 7 guests',
      'Professional waiter service',
      'Menu planning included',
      'Kitchen management',
      'Groceries handled internally',
    ],
  },
  premium: {
    name: 'Weekly Private Chef Premium',
    guestRange: '8-10',
    guests: 'from 8 up to 10 people',
    weekPrice: 600000,
    saturdayPrice: 180000,
    sundayPrice: 180000,
    staff: ['2 private chefs', '1 waiter'],
    features: [
      'Monday to Friday service',
      'Breakfast, lunch & dinner',
      '8 to 10 guests',
      'Dual chef service',
      'Professional waiter service',
      'Menu planning included',
      'Kitchen management',
      'Groceries handled internally',
    ],
  },
};

export function getPlanForGuests(numGuests: number): Plan {
  if (numGuests >= 2 && numGuests <= 4) return 'standard';
  if (numGuests >= 5 && numGuests <= 7) return 'plus';
  if (numGuests >= 8 && numGuests <= 10) return 'premium';
  return 'standard';
}

export function calculatePrice(
  plan: Plan,
  addSaturday: boolean,
  addSunday: boolean
): number {
  const planDetails = PLANS[plan];
  let total = planDetails.weekPrice;

  if (addSaturday) {
    total += planDetails.saturdayPrice;
  }

  if (addSunday) {
    total += planDetails.sundayPrice;
  }

  return total;
}

export function formatPrice(cents: number): string {
  return `€${(cents / 100).toLocaleString('en-EU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export const CUSTOM_PLAN = {
  name: 'Custom Plan',
  guestRange: '10+',
  guests: '10+ guests',
  staff: ['Tailored staffing', 'Multiple chefs and waiters if needed'],
  features: [
    'Tailored staffing solution',
    'Personalized menu and dietary preferences',
    'Location-based logistics',
    'Response within 24 hours',
    'Flexible service arrangements',
    'Dedicated account manager',
  ],
};
