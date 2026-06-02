import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

// Server-side session resolution + refresh, exposed via Astro.locals.user.
//
// The access token (sb-access-token) is a Supabase JWT that expires after ~1h.
// Pages must NOT call getUser on the raw cookie themselves: a cookie refreshed
// here is not visible to the page within the same request, AND refresh tokens
// rotate (a second refresh would fail). So we resolve the user ONCE here and
// hand it to every page/endpoint via context.locals.user.
//
// DEFENSIVE: any failure falls through with locals.user = null; the site never 500s.
export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  try {
    const access = context.cookies.get('sb-access-token')?.value;
    const refresh = context.cookies.get('sb-refresh-token')?.value;

    if (!access && !refresh) {
      return next();
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 1. Try the current access token.
    if (access) {
      const { data, error } = await supabase.auth.getUser(access);
      if (!error && data.user) {
        context.locals.user = data.user;
        return next();
      }
    }

    // 2. Expired/invalid → refresh once using the refresh token, rotate cookies.
    if (refresh) {
      const { data } = await supabase.auth.refreshSession({ refresh_token: refresh });
      if (data?.session && data.user) {
        // NOT httpOnly: the client SDK must be able to keep these cookies in
        // sync with its rotating localStorage session via document.cookie. An
        // httpOnly cookie set here would shadow and permanently block those
        // client-side updates → stale cookie → the post-login redirect loop.
        // (The tokens already live in JS-readable localStorage, so httpOnly
        // would add no real protection while breaking the sync.)
        const cookieOptions = {
          path: '/',
          httpOnly: false,
          secure: context.url.protocol === 'https:',
          sameSite: 'lax' as const,
          maxAge: 60 * 60 * 24 * 7, // 7 days
        };
        context.cookies.set('sb-access-token', data.session.access_token, cookieOptions);
        context.cookies.set('sb-refresh-token', data.session.refresh_token, cookieOptions);
        context.locals.user = data.user;
      }
    }

    return next();
  } catch {
    // A middleware failure must never break the site.
    return next();
  }
});
