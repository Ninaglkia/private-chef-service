/**
 * Single source of truth for "who is the owner/admin by email".
 *
 * Historically the owner address ('ninaglia089@gmail.com') was hardcoded in 5+
 * files (control panel, send-payment-link, update-booking, dashboard, email).
 * Centralise it here so there is ONE place to change it, and allow extra owner
 * emails via the ADMIN_EMAILS env var (comma-separated).
 *
 * Note: profiles.role === 'admin' remains the primary, DB-backed RBAC check.
 * This email allowlist is the override used ALONGSIDE it (so the owner can always
 * get in even if their profile row is missing/misconfigured).
 */

const FALLBACK_OWNER_EMAIL = 'ninaglia089@gmail.com';

function parseAdminEmails(): string[] {
  const raw = import.meta.env.ADMIN_EMAILS;
  const fromEnv = (raw ? String(raw) : '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Set keeps the fallback first and de-duplicates.
  return Array.from(new Set<string>([FALLBACK_OWNER_EMAIL, ...fromEnv]));
}

/** All emails treated as owner/admin (lowercased, de-duplicated). */
export const ADMIN_EMAILS: string[] = parseAdminEmails();

/** Primary owner address — recipient for owner/organizer notifications. */
export const ORGANIZER_EMAIL: string = FALLBACK_OWNER_EMAIL;

/** True if `email` belongs to an owner/admin (case-insensitive). */
export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
