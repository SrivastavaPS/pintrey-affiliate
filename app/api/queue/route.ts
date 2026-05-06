// =============================================================================
// API ROUTE: GET /api/queue
// =============================================================================
// PLAIN: Returns every pin that's ready to be manually posted to Pinterest.
//        Two sources merged into one list:
//          1. POC pipeline pins (pinterest_posts where status='queued')
//          2. Approved library pins (library_pins where status='approved')
//
// TECH:  Two SELECTs, merged into a single sorted array. Each item carries
//        a 'source' discriminator so the /queue page knows which API to
//        call for "Mark posted".
// =============================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PLAIN: A unified shape both sources can fit into.
// TECH:  source field tells the UI which PATCH endpoint to call.
interface QueueItem {
  // PLAIN: 'poc' for old POC-pipeline pins, 'library' for approved library pins.
  source: 'poc' | 'library';
  /** PLAIN: Underlying row id (pinterest_posts.id or library_pins.id). */
  id: string;
  /** PLAIN: When it was queued/approved. */
  created_at: string;
  pin: {
    id: string;
    title: string;
    description: string | null;
    hashtags: string | null;
    image_url: string | null;
  };
  product: {
    id: string;
    title: string;
    price: string | null;
    affiliate_url: string;
    asin: string | null;
  };
}

export async function GET() {
  // PLAIN: 1. Fetch POC pipeline queued pins (existing behaviour, unchanged).
  // TECH:  Same shape as before — pinterest_posts joined to pins+products.
  const { data: pocItems } = await supabase
    .from('pinterest_posts')
    .select(
      `
      id,
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

  // PLAIN: 2. Fetch approved library pins (Phase 2.3 addition).
  // TECH:  library_pins joined to product_library for product context.
  const { data: libraryItems } = await supabase
    .from('library_pins')
    .select(
      `
      id,
      generated_at,
      title,
      description,
      hashtags,
      image_url,
      product_library (
        id,
        title,
        price,
        affiliate_url,
        asin
      )
      `
    )
    .eq('status', 'approved')
    .order('generated_at', { ascending: false });

  // PLAIN: Normalise both shapes into the unified QueueItem.
  // TECH:  TypeScript can't auto-derive the joined select shape, so we
  //        cast through `any` for the nested objects.
  const items: QueueItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (pocItems ?? []) as any[]) {
    if (!row.pins || !row.pins.products) continue;
    items.push({
      source: 'poc',
      id: row.id,
      created_at: row.created_at,
      pin: {
        id: row.pins.id,
        title: row.pins.title,
        description: row.pins.description,
        hashtags: row.pins.hashtags,
        image_url: row.pins.image_url,
      },
      product: {
        id: row.pins.products.id,
        title: row.pins.products.title,
        price: row.pins.products.price,
        affiliate_url: row.pins.products.affiliate_url,
        asin: row.pins.products.asin,
      },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (libraryItems ?? []) as any[]) {
    if (!row.product_library) continue;
    items.push({
      source: 'library',
      id: row.id,
      created_at: row.generated_at,
      pin: {
        id: row.id,
        title: row.title,
        description: row.description,
        hashtags: row.hashtags,
        image_url: row.image_url,
      },
      product: {
        id: row.product_library.id,
        title: row.product_library.title,
        price: row.product_library.price,
        affiliate_url: row.product_library.affiliate_url,
        asin: row.product_library.asin,
      },
    });
  }

  // PLAIN: Newest first across both sources.
  // TECH:  ISO date strings sort lexicographically just fine.
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json({ items });
}
