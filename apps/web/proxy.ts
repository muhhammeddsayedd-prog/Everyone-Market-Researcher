import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { readPublicEnv } from '@/lib/env';

/** Routes reachable without a session. Everything else needs one (and the app layout checks membership). */
const PUBLIC_PATHS = new Set(['/login', '/auth/callback', '/unavailable']);
const NO_STORE = 'private, no-store, max-age=0';

// Self-contained 503 notice (no app code, data or assets) for unconfigured deployments.
const UNAVAILABLE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Unavailable · everyone. Market Radar</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#000;color:#fff;font:500 16px/1.5 system-ui,sans-serif}main{max-width:480px;padding:24px}p{color:#c4c4c4}</style></head><body><main><h1>Market Radar isn't available here.</h1><p>This deployment is missing its sign-in and data configuration, so nothing is served. Ask the project owner to check the environment settings.</p></main></body></html>`;

function finalize(response: NextResponse): NextResponse {
  // Personalized, session-bearing responses must never land in a shared cache.
  response.headers.set('Cache-Control', NO_STORE);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

function redirectKeepingCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return finalize(redirect);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const config = readPublicEnv();

  // Fail closed: without valid configuration no page other than the notice is served.
  if (!config.ok) {
    if (pathname === '/unavailable') return finalize(NextResponse.next());
    return finalize(
      new NextResponse(UNAVAILABLE_HTML, {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '300' },
      }),
    );
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.env.supabaseUrl, config.env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  // getClaims validates the JWT (and refreshes an expired session); getSession is never trusted here.
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === 'string';

  if (!signedIn && !PUBLIC_PATHS.has(pathname)) {
    const login = new URL('/login', request.url);
    if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
    return redirectKeepingCookies(login, response);
  }

  if (signedIn && pathname === '/login') return redirectKeepingCookies(new URL('/', request.url), response);

  return finalize(response);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|fonts/|brand/).*)'],
};
