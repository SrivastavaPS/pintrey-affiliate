// =============================================================================
// API ROUTE: POST /api/pins/[id]/regenerate
// =============================================================================
// PLAIN: User clicked "Recreate" on a pin they didn't like — delete the
//        old one and generate a fresh pin for the same product.
//
// TECH:  Wraps lib/pins.regeneratePin. Returns the new pin row.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { regeneratePin } from '@/lib/pins';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const pin = await regeneratePin(id);
    return NextResponse.json({ pin });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
