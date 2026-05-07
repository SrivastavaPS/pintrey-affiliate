// =============================================================================
// API ROUTE: GET /api/queue
// =============================================================================
// PLAIN: Returns every library pin (regardless of status) so the /queue
//        page can group them into Pending Review / Approved / Posted.
//        Also includes POC pipeline pins from pinterest_posts (status='queued')
//        for backward-compatibility with the existing POC flow.
//
// TECH:  Two SELECTs. Each item carries a `source` ('library' | 'poc') and
//        a `status` (one of pending_review|approved|posted|rejected|queued).
//        UI groups client-side by status.
// =============================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface QueueItem {
  source: 'poc' | 'library';
  /** PLAIN: Underlying row id (pinterest_posts.id or library_pins.id). */
  id: string;
  /** PLAIN: Pin lifecycle status — drives which buttons the UI shows. */
  status: string;
  /** PLAIN: When it was created/queued. */
  created_at: string;
  /** PLAIN: Set when status='posted', else null. */
  posted_at: string | null;
  /** PLAIN: Live Pinterest pin URL after posting (manual or auto). */
  pin_url: string | null;
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
  // PLAIN: 1. POC pipeline queued pins (legacy, may be empty for most users).
  const { data: pocItems } = await supabase
    .from('pinterest_posts')
    .select(
      `
      id,
      status,
      created_at,
      posted_at,
      pin_url,
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
    .in('status', ['queued', 'posted'])
    .order('created_at', { ascending: false });

  // PLAIN: 2. ALL library pins regardless of status. The UI buckets by
  //        status so user sees Pending / Approved / Posted sections.
  const { data: libraryItems } = await supabase
    .from('library_pins')
    .select(
      `
      id,
      status,
      generated_at,
      posted_at,
      pin_url,
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
    .order('generated_at', { ascending: false });

  const items: QueueItem[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (pocItems ?? []) as any[]) {
    if (!row.pins || !row.pins.products) continue;
    items.push({
      source: 'poc',
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      posted_at: row.posted_at,
      pin_url: row.pin_url,
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
      status: row.status,
      created_at: row.generated_at,
      posted_at: row.posted_at,
      pin_url: row.pin_url,
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

  // PLAIN: Newest first within the merged list. UI re-groups by status.
  items.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json({ items });
}
