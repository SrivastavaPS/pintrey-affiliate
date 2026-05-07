// =============================================================================
// API ROUTE: POST /api/pins/generate
// =============================================================================
// PLAIN: Generates a Pinterest pin for a library product. Saves it as
//        "pending_review" so the user can approve or reject it on the
//        dashboard.
//
// TECH:  Thin wrapper over lib/pins.generatePinForProductId. Returns the
//        new library_pins row.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { generatePinForProductId } from '@/lib/pins';

// PLAIN: Allow up to 30s for AI pin generation. Default Vercel limit is 10s.
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const productId: string | undefined = body.productId;

  if (!productId) {
    return NextResponse.json({ error: 'productId required' }, { status: 400 });
  }

  try {
    const pin = await generatePinForProductId(productId);
    return NextResponse.json({ pin });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
