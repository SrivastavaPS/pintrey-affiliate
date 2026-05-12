// =============================================================================
// MIDDLEWARE — single-password auth wall for the entire app
// =============================================================================
// PLAIN: Every request to the app passes through here. If the visitor
//        doesn't have a valid session cookie, we send them to /login.
//        Public exceptions: /login, /api/auth/login, /privacy, /terms,
//        and static files.
//
// TECH:  Runs on Edge runtime. Verifies the HMAC-signed cookie issued by
//        /api/auth/login. Bypasses static assets via the matcher config
//        and a regex on the pathname.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

// PLAIN: URLs anyone can hit without logging in.
// TECH:  startsWith check — easy to extend. /privacy and /terms are public
//        so Pinterest's app review can read them.
const PUBLIC_ROUTES = [
  '/login',
  '/api/auth/login',
  '/privacy',
  '/terms',
];

// PLAIN: File extensions to ignore (images, fonts, etc.).
// TECH:  Edge middleware sees these too unless excluded.
const PUBLIC_FILE_PATTERN = /\.(.*)$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // PLAIN: Let static files through (favicons, images, JS bundles).
  // TECH:  Anything with a dot in the last path segment.
  if (PUBLIC_FILE_PATTERN.test(pathname)) {
    return NextResponse.next();
  }

  // PLAIN: Let public routes through.
  // TECH:  startsWith handles nested paths.
  for (const route of PUBLIC_ROUTES) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      return NextResponse.next();
    }
  }

  // PLAIN: If ADMIN_PASSWORD isn't set, we can't enforce auth — let
  //        through but show a banner on /admin later.
  // TECH:  Fail-open for dev environments where the env var is missing,
  //        but operator should set it before deploying.
  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  // PLAIN: Check the session cookie.
  // TECH:  Tamper-proof HMAC verification.
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = token ? await verifySessionToken(token) : false;

  if (!valid) {
    // PLAIN: Not logged in → send to /login. Remember where they wanted to go.
    // TECH:  redirect query param so /login can bounce back after success.
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// PLAIN: Tells Next.js which paths the middleware should run for.
//        We run for everything EXCEPT framework internals.
// TECH:  Negative lookahead skips _next/static, _next/image, and favicon.
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
