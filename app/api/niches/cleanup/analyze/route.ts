// =============================================================================
// API ROUTE: POST /api/niches/cleanup/analyze
// =============================================================================
// PLAIN: Asks the AI to find clusters of duplicate niches.
//        Returns the clusters for the user to review before merging.
//
// TECH:  Wraps lib/niche-cleanup.findDuplicateClusters. Read-only;
//        doesn't modify any data.
// =============================================================================

import { NextResponse } from 'next/server';
import { findDuplicateClusters, getNicheStats } from '@/lib/niche-cleanup';

// PLAIN: AI scan can take 5-15s. Allow up to 30s.
export const maxDuration = 30;

export async function POST() {
  try {
    const [clusters, stats] = await Promise.all([
      findDuplicateClusters(),
      getNicheStats(),
    ]);
    return NextResponse.json({ clusters, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PLAIN: GET version that just returns stats (no AI call).
//        Used to show counts before the user triggers analysis.
export async function GET() {
  try {
    const stats = await getNicheStats();
    return NextResponse.json({ stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
