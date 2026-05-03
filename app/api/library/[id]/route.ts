// =============================================================================
// API ROUTE: DELETE /api/library/[id]  +  PATCH /api/library/[id]
// =============================================================================
// PLAIN: Two endpoints:
//        - DELETE → permanently removes a product from your library
//        - PATCH  → toggles is_active or edits fields without delete
//
// TECH:  Dynamic route segment [id] is the UUID of the product_library row.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PLAIN: Type for the dynamic route params (Next.js 15+ uses Promises).
// TECH:  context.params is a Promise in App Router since v15.
interface RouteContext {
  params: Promise<{ id: string }>;
}

// PLAIN: Permanently removes a product from your library.
// TECH:  DELETE FROM product_library WHERE id = $1.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;

  const { error } = await supabase.from('product_library').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PLAIN: Updates fields on an existing product (e.g., toggle is_active,
//        change niche tags, change price).
// TECH:  PATCH body is partial; only sent fields get updated.
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));

  // PLAIN: Whitelist which fields can be edited via PATCH.
  // TECH:  Defense against accidental ASIN/affiliate_url changes.
  const allowed = [
    'title',
    'price',
    'niche_tags',
    'notes',
    'is_active',
    'image_url',
  ];

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no valid fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('product_library')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ product: data });
}
