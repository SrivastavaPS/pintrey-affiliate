// =============================================================================
// API ROUTE: GET /api/pinterest/account
// =============================================================================
// PLAIN: Returns info about your Pinterest account (username, type, image)
//        if the access token is valid. Used by the setup page as a "token
//        sanity check" — green checkmark if this works.
//
// TECH:  Wraps lib/pinterest.getAccount(). Returns 200 + account on success,
//        500 + error on token failure.
// =============================================================================

import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/pinterest';

export async function GET() {
  try {
    const account = await getAccount();
    return NextResponse.json({ ok: true, account });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
