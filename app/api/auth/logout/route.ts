// =============================================================================
// API ROUTE: POST /api/auth/logout
// =============================================================================
// PLAIN: Clears the session cookie. Browser bounces to /login on next nav.
// TECH:  Sets maxAge=0 on the same cookie name to expire it immediately.
// =============================================================================

import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // PLAIN: Overwrite the cookie with an empty value and zero lifetime.
  // TECH:  Browsers treat maxAge=0 as "delete now".
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}
