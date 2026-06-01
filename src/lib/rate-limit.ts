/**
 * Simple in-memory sliding-window rate limiter.
 *
 * NOTE: This is per-instance / best-effort only. On serverless (Vercel,
 * Netlify, Cloudflare, etc.) each instance keeps its own Map, and instances
 * are short-lived, so this does NOT give strict global limits — it just blunts
 * obvious single-instance spam. For real global limits use a shared/hosted
 * limiter such as Upstash Ratelimit (Redis) keyed by IP.
 */

// Module-level store: key -> sorted-ish list of request timestamps (ms).
const hits = new Map<string, number[]>();

export interface RateLimitOptions {
  /** Max requests allowed within the window. Default: 5. */
  limit?: number;
  /** Window length in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
}

export interface RateLimitResult {
  /** true if the request is allowed, false if it should be rejected (429). */
  ok: boolean;
  /** Seconds the caller should wait before retrying (0 when ok). */
  retryAfterSec: number;
}

/**
 * Record a hit for `key` and decide whether it is within the allowed rate.
 *
 * Sliding window: on each call we drop timestamps older than `windowMs`. If the
 * remaining count is under `limit`, we record `now` and allow; otherwise we
 * reject and report how long until the oldest hit ages out of the window.
 */
export function rateLimit(
  key: string,
  opts: RateLimitOptions = {}
): RateLimitResult {
  const limit = opts.limit ?? 5;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  const cutoff = now - windowMs;

  const existing = hits.get(key) ?? [];
  // Drop timestamps that have fallen out of the sliding window.
  const recent = existing.filter((ts) => ts > cutoff);

  if (recent.length >= limit) {
    // Over the limit: do not record this hit. Report retry-after based on the
    // oldest in-window timestamp (when it will expire).
    const oldest = recent[0];
    const retryAfterMs = Math.max(0, oldest + windowMs - now);
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) || 1 };
  }

  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Derive a best-effort client IP from a Request.
 *
 * Prefers the first IP in `x-forwarded-for` (left-most = original client),
 * then `x-real-ip`, falling back to 'unknown'. Header values are spoofable by
 * the client, but behind a trusted proxy/CDN this is the standard source.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  const xRealIp = request.headers.get('x-real-ip');
  if (xRealIp) {
    const trimmed = xRealIp.trim();
    if (trimmed) return trimmed;
  }

  return 'unknown';
}
