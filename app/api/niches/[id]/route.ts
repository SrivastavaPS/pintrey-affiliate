// =============================================================================
// API ROUTE: DELETE /api/niches/[id]  +  PATCH /api/niches/[id]
// =============================================================================
// PLAIN: Two endpoints:
//        - DELETE → permanently remove a niche (products under it become uncategorised)
//        - PATCH  → update fields (description, keywords, score, is_active)
//
// TECH:  product_library.niche_id has ON DELETE SET NULL so deleting a niche
//        doesn't cascade-delete products — they just lose their niche link.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PLAIN: Permanently remove a niche. Products keep existing but lose niche link.
// TECH:  DELETE FROM trending_niches WHERE id = $1.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const { error } = await supabase.from('trending_niches').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PLAIN: Update niche fields (e.g., disable it without deleting).
// TECH:  Whitelisted fields only; partial PATCH.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  // PLAIN: Only allow these fields to be edited via PATCH.
  // TECH:  Defense against accidental ID/timestamp overwrites.
  const allowed = ['name', 'description', 'keywords', 'score', 'is_active'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('trending_niches')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ niche: data });
}
