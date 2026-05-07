// =============================================================================
// API ROUTE: POST /api/niches/cleanup/merge
// =============================================================================
// PLAIN: Merges duplicate niches into a primary one. Body:
//          { primary_id: string, duplicate_ids: string[] }
//
// TECH:  Wraps lib/niche-cleanup.mergeNiches. Returns counts of moved
//        products + suggestions + deleted niches.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { mergeNiches } from '@/lib/niche-cleanup';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const primaryId: string | undefined = body.primary_id;
  const duplicateIds: string[] | undefined = body.duplicate_ids;

  if (!primaryId || !Array.isArray(duplicateIds)) {
    return NextResponse.json(
      { error: 'primary_id (string) and duplicate_ids (string[]) required' },
      { status: 400 }
    );
  }

  try {
    const result = await mergeNiches(primaryId, duplicateIds);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
