// =============================================================================
// API ROUTE: GET /api/queue
// =============================================================================
// PLAIN: Returns every pin currently waiting to be manually posted to
//        Pinterest, joined with its content (image, title, description) and
//        the affiliate link. Used by the /queue page.
//
// TECH:  SELECT pinterest_posts WHERE status='queued' joined with pins +
//        products via FK. Newest first.
// =============================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  // PLAIN: Pull queued posts with everything needed to render the UI.
  // TECH:  Nested select uses Supabase's relational shorthand.
  const { data, error } = await supabase
    .from('pinterest_posts')
    .select(
      `
      id,
      pin_id,
      status,
      created_at,
      pins (
        id,
        title,
        description,
        hashtags,
        image_url,
        products (
          id,
          title,
          price,
          affiliate_url,
          asin
        )
      )
      `
    )
    .eq('status', 'queued')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}
