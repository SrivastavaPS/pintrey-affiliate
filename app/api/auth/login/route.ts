// =============================================================================
// API ROUTE: POST /api/auth/login  +  POST /api/auth/logout
// =============================================================================
// PLAIN: Two endpoints for the password gate:
//        - POST /api/auth/login   → check password, set session cookie
//        - POST /api/auth/logout  → clear session cookie
//
// TECH:  Cookies are httpOnly + sameSite=lax + secure (in production).
//        Token = HMAC-signed expiry timestamp (see lib/auth.ts).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import {
  createSessionToken,
  isPasswordCorrect,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const password = String(body.password ?? '');

  if (!password) {
    return NextResponse.json({ error: 'Password required' }, { status: 400 });
  }

  // PLAIN: Check the password against ADMIN_PASSWORD env var.
  // TECH:  Constant-time hash comparison; see lib/auth.ts.
  const ok = await isPasswordCorrect(password);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  // PLAIN: Issue a 7-day session cookie.
  // TECH:  HMAC token stored in httpOnly cookie.
  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  return response;
}
