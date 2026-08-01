// Guest reviews displayed on the homepage.
//
// Reviews are written by guests on independent third-party platforms
// (Google Business Profile, Trustpilot) and curated here manually.
// Each entry should link back to the original review (url) so it can be
// verified at the source. To add a review, append one object to `reviews`.

export interface Review {
  source: 'google' | 'trustpilot';
  /** 1-5 star rating as shown on the source platform. */
  rating: number;
  quote: string;
  author: string;
  occasion?: string;
  location?: string;
  /** ISO date of the original review, e.g. '2026-08-01'. */
  date: string;
  /** Link to the original review on the source platform, for verification. */
  url?: string;
}

export const reviews: Review[] = [];

export interface Platform {
  name: string;
  /** Direct "write a review" link. null = platform not active yet (button hidden). */
  writeReviewUrl: string | null;
  /** Public profile listing all reviews. null = not available yet (link hidden). */
  profileUrl: string | null;
}

export const platforms: { trustpilot: Platform; google: Platform } = {
  trustpilot: {
    name: 'Trustpilot',
    writeReviewUrl: 'https://www.trustpilot.com/evaluate/ninos-privatechefs.com',
    profileUrl: null,
  },
  // Google Business Profile is pending verification.
  // Once verified, set writeReviewUrl to the "write a review" link
  // (https://g.page/r/<placeId>/review) and the button appears automatically.
  google: {
    name: 'Google',
    writeReviewUrl: null,
    profileUrl: null,
  },
};
