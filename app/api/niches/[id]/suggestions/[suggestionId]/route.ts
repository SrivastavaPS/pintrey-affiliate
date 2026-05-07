// =============================================================================
// API ROUTE: PATCH /api/niches/[id]/suggestions/[suggestionId]
// =============================================================================
// PLAIN: Mark a suggestion as 'added' (user added the real product) or
//        'dismissed' (user said not interested).
//
// TECH:  Wraps lib/suggestions.markSuggestionAdded + dismissSuggestion.
//        nicheId in path is for URL hierarchy only — the suggestionId
//        identifies the row.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  markSuggestionAdded,
  dismissSuggestion,
} from '@/lib/suggestions';

interface RouteContext {
  params: Promise<{ id: string; suggestionId: string }>;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { suggestionId } = await context.params;
  const body = await req.json().catch(() => ({}));
  const status = body.status as 'added' | 'dismissed' | undefined;

  if (status !== 'added' && status !== 'dismissed') {
    return NextResponse.json(
      { error: 'status must be "added" or "dismissed"' },
      { status: 400 }
    );
  }

  try {
    const suggestion =
      status === 'added'
        ? await markSuggestionAdded(suggestionId, body.added_product_id)
        : await dismissSuggestion(suggestionId);
    return NextResponse.json({ suggestion });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
