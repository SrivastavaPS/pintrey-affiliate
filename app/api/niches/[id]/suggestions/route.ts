// =============================================================================
// API ROUTE: GET /api/niches/[id]/suggestions  +  POST
// =============================================================================
// PLAIN: Two endpoints:
//        - GET  → list all suggestions for this niche (cached)
//        - POST → ask AI to (re)generate a fresh batch of 10 suggestions
//
// TECH:  Thin wrappers over lib/suggestions. Both routes accept the
//        nicheId from the URL path.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getSuggestionsForNiche,
  generateSuggestionsForNiche,
} from '@/lib/suggestions';

// PLAIN: AI calls can take 5-15s. Allow up to 30s.
export const maxDuration = 30;

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PLAIN: List suggestions for the niche.
// TECH:  Optional ?status= filter; defaults to ALL.
export async function GET(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const status = req.nextUrl.searchParams.get('status') as
    | 'pending'
    | 'added'
    | 'dismissed'
    | null;

  try {
    const suggestions = await getSuggestionsForNiche(id, status ?? undefined);
    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PLAIN: Trigger a fresh AI brainstorm. Wipes existing pending ones first.
// TECH:  Optional { count } in body; defaults to 10.
export async function POST(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const count = typeof body.count === 'number' ? body.count : 10;

  try {
    const suggestions = await generateSuggestionsForNiche(id, count);
    return NextResponse.json({ suggestions });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
