import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

// Server-side session resolution, exposed via Astro.locals.user.
//
// READ-ONLY for auth: this middleware only VERIFIES the access-token cookie and
// never refreshes/rotates tokens server-side. There must be exactly ONE refresher
// of the (single-use, rotating) refresh token, and that is the client SDK
// (autoRefreshToken + the onAuthStateChange cookie-sync in lib/supabase.ts, plus
// Header.syncAuthCookies on every page load). If the middleware ALSO refreshed,
// it would rotate the token server-side while the client's localStorage still
// held the old one; the client's next refresh would then fail and wipe the valid
// cookie the server just wrote → auth lockout. Keeping the server read-only
// eliminates that dual-refresher race entirely.
//
// If the access token is expired here, locals.user stays null and the gated page
// redirects to /login; the client (sole token holder) refreshes there, writes a
// fresh cookie, and bounces back — a single hop, never a loop.
//
// DEFENSIVE: any failure falls through with locals.user = null; the site never 500s.
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  try {
    const access = context.cookies.get('sb-access-token')?.value;
    if (!access) {
      return next();
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Verify the current access token only. No server-side refresh (see above).
    const { data, error } = await supabase.auth.getUser(access);
    if (!error && data.user) {
      context.locals.user = data.user;
    }

    return next();
  } catch {
    // A middleware failure must never break the site.
    return next();
  }
});
