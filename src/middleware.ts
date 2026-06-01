import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';

// Server-side session refresh.
// The access token (sb-access-token) is a Supabase JWT that expires after ~1h.
// Login only sets it client-side, so without this middleware protected pages
// (which call supabase.auth.getUser(accessToken)) bounce the user to /login
// once the token expires. Here we transparently refresh it using the
// refresh token and re-write both cookies BEFORE the page runs.
//
// DEFENSIVE: any failure must fall through to next() so the site never 500s
// because of a refresh hiccup.
export const onRequest = defineMiddleware(async (context, next) => {
  try {
    const access = context.cookies.get('sb-access-token')?.value;
    const refresh = context.cookies.get('sb-refresh-token')?.value;

    // No auth cookies → nothing to refresh; let the request continue.
    if (!access || !refresh) {
      return next();
    }

    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL,
      import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { error } = await supabase.auth.getUser(access);

    // Token still valid → no refresh needed.
    if (!error) {
      return next();
    }

    // Token expired/invalid → try to refresh using the refresh token.
    const { data } = await supabase.auth.refreshSession({ refresh_token: refresh });

    if (data?.session) {
      const cookieOptions = {
        path: '/',
        httpOnly: true,
        secure: context.url.protocol === 'https:',
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      };
      context.cookies.set('sb-access-token', data.session.access_token, cookieOptions);
      context.cookies.set('sb-refresh-token', data.session.refresh_token, cookieOptions);
    }

    return next();
  } catch {
    // A middleware failure must never break the site.
    return next();
  }
});
