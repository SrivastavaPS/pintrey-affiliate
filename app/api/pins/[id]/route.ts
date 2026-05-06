// =============================================================================
// API ROUTE: PATCH /api/pins/[id]  +  DELETE /api/pins/[id]
// =============================================================================
// PLAIN: Two endpoints for one pin:
//        - PATCH  → change status (approve, reject, posted)
//        - DELETE → remove the pin permanently
//
// TECH:  Wraps lib/pins setPinStatus + deletePin.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { setPinStatus, deletePin } from '@/lib/pins';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PLAIN: Valid status transitions allowed via PATCH.
// TECH:  Tuple of literal types so TS narrows correctly when calling setPinStatus.
//        Excludes 'failed' (auto-set on generation errors only).
const ALLOWED_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'posted',
] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

// PLAIN: Update pin status (and optional pin_url + pinterest_pin_id for posted).
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  const status = body.status as AllowedStatus | undefined;
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const pin = await setPinStatus(id, status, {
      pin_url: body.pin_url,
      pinterest_pin_id: body.pinterest_pin_id,
    });
    return NextResponse.json({ pin });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PLAIN: Permanently delete a pin row.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    await deletePin(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
