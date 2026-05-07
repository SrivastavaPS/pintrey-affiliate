// =============================================================================
// API ROUTE: POST /api/niches/cleanup/deactivate
// =============================================================================
// PLAIN: Bulk-deactivates niches without deleting them. Useful for
//        archiving low-score or empty niches en masse.
//
// TECH:  Wraps lib/niche-cleanup.bulkDeactivateNiches.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { bulkDeactivateNiches } from '@/lib/niche-cleanup';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const nicheIds: string[] | undefined = body.niche_ids;

  if (!Array.isArray(nicheIds)) {
    return NextResponse.json(
      { error: 'niche_ids (string[]) required' },
      { status: 400 }
    );
  }

  try {
    const count = await bulkDeactivateNiches(nicheIds);
    return NextResponse.json({ ok: true, deactivated: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
