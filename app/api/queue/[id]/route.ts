// =============================================================================
// API ROUTE: PATCH /api/queue/[id]  +  DELETE /api/queue/[id]
// =============================================================================
// PLAIN: Two endpoints:
//        - PATCH  → mark a queued pin as 'posted' (after manual posting)
//        - DELETE → remove a queued pin from the queue (don't want to post it)
//
// TECH:  Updates pinterest_posts row by id.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PLAIN: Mark as posted — clears it from the queue.
// TECH:  UPDATE status='posted', posted_at=now, optional pin_url + pinterest_pin_id.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  // PLAIN: Build the update payload. Only allow fields that make sense
  //        for a manual-post completion event.
  // TECH:  Whitelist fields; status is always 'posted' for this PATCH.
  const updates: Record<string, unknown> = {
    status: 'posted',
    posted_at: new Date().toISOString(),
  };

  // PLAIN: If user pasted the pin URL after posting, save it for tracking.
  // TECH:  Optional pin_url + pinterest_pin_id from request body.
  if (body.pin_url) updates.pin_url = body.pin_url;
  if (body.pinterest_pin_id) updates.pinterest_pin_id = body.pinterest_pin_id;

  const { data, error } = await supabase
    .from('pinterest_posts')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}

// PLAIN: Remove from queue without posting (you don't like the pin).
// TECH:  Hard delete; pin record + content stays for analytics.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const { error } = await supabase.from('pinterest_posts').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
