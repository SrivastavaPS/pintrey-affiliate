// =============================================================================
// API ROUTE: GET /api/pinterest/boards
// =============================================================================
// PLAIN: Returns the list of boards on your Pinterest account so you can
//        pick which one the POC should post pins to.
//
// TECH:  Wraps lib/pinterest.listBoards(). Returns 200 + array on success.
// =============================================================================

import { NextResponse } from 'next/server';
import { listBoards } from '@/lib/pinterest';

export async function GET() {
  try {
    const boards = await listBoards();
    return NextResponse.json({ ok: true, boards });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}
