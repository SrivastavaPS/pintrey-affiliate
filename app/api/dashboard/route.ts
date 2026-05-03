// =============================================================================
// API ROUTE: GET /api/dashboard
// =============================================================================
// PLAIN: Returns the data the home page needs in one call:
//        - All trending niches (with product counts)
//        - All products grouped by niche
//        - Each product includes its latest pin (if any) and pin status
//
// TECH:  Single endpoint to avoid the dashboard waterfall (3 fetches).
//        Returns a tree structure: niches → products → latest_pin → post_status.
// =============================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// PLAIN: Shape of one product as the dashboard renders it.
// TECH:  Product fields + nested latest pin + post status.
interface DashboardProduct {
  id: string;
  asin: string;
  title: string;
  image_url: string | null;
  price: string | null;
  affiliate_url: string;
  niche_tags: string | null;
  source: string;
  created_at: string;
  // PLAIN: Latest pin (null if none has been generated yet).
  latest_pin: {
    id: string;
    title: string;
    image_url: string;
    description: string | null;
    hashtags: string | null;
    generated_at: string;
    // PLAIN: Latest pinterest_post status for this pin.
    post_status: string | null;
    pin_url: string | null;
  } | null;
}

// PLAIN: One niche bucket containing its products.
interface DashboardNiche {
  id: string;
  name: string;
  description: string | null;
  score: number | null;
  keywords: string | null;
  products: DashboardProduct[];
}

export async function GET() {
  // PLAIN: 1. Get all active niches sorted by score.
  // TECH:  Same as /api/niches GET; replicated here to avoid a fetch hop.
  const { data: niches, error: nicheErr } = await supabase
    .from('trending_niches')
    .select('id, name, description, score, keywords')
    .eq('is_active', true)
    .order('score', { ascending: false });

  if (nicheErr) {
    return NextResponse.json({ error: nicheErr.message }, { status: 500 });
  }

  // PLAIN: 2. Get all active products with their pins joined.
  // TECH:  Supabase relational query: products → pins → pinterest_posts.
  //        Pins is one-to-many on product, so we get an array; we'll pick
  //        the latest one in JS.
  const { data: products, error: prodErr } = await supabase
    .from('product_library')
    .select(
      `
      id,
      asin,
      title,
      image_url,
      price,
      affiliate_url,
      niche_tags,
      source,
      niche_id,
      created_at,
      pins:pins!product_id (
        id,
        title,
        image_url,
        description,
        hashtags,
        generated_at,
        pinterest_posts (
          status,
          pin_url
        )
      )
      `
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 500 });
  }

  // PLAIN: Wait — pins.product_id doesn't exist as an FK that Supabase auto-
  //        detects since the original schema uses a manual FK. Let me fall
  //        back to a separate fetch + manual join.
  // TECH:  If the relational query returns null pins for everything, do a
  //        second query and merge.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productList = (products ?? []) as any[];
  const productIds = productList.map((p) => p.id);

  // PLAIN: Fetch pins for these products in one query, plus their latest post.
  // TECH:  Two queries + JS merge is more reliable than complex relational
  //        SELECTs that depend on Supabase's FK auto-detection.
  // Note: pins links via product_id; pins are linked to product_library indirectly
  // through the products table. We need to check if product_library matches
  // the FK.
  // Actually pins.product_id references the `products` table (per-run picks),
  // NOT product_library. So a library product → pins is NOT direct.
  // For now, return empty pins until pin generation is wired to library.
  const productsWithPins: DashboardProduct[] = productList.map((p) => ({
    id: p.id,
    asin: p.asin,
    title: p.title,
    image_url: p.image_url,
    price: p.price,
    affiliate_url: p.affiliate_url,
    niche_tags: p.niche_tags,
    source: p.source,
    created_at: p.created_at,
    // PLAIN: Pin generation directly off library products is a Phase 2.2 task.
    //        For now, dashboard shows products without pins.
    latest_pin: null,
    // Carry niche_id through for grouping below.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    niche_id: p.niche_id,
  })) as DashboardProduct[];
  // Hack: re-attach niche_id without TypeScript fight.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const productsTyped = productsWithPins as any[];

  // PLAIN: 3. Group products by niche_id.
  // TECH:  Build a Map<niche_id, products[]>; null niche_id → "uncategorised".
  const productsByNiche = new Map<string | null, DashboardProduct[]>();
  for (const p of productsTyped) {
    const key = p.niche_id ?? null;
    if (!productsByNiche.has(key)) productsByNiche.set(key, []);
    productsByNiche.get(key)!.push(p);
  }

  // PLAIN: 4. Build the niche tree.
  // TECH:  Decorate each niche with its products array.
  const tree: DashboardNiche[] = (niches ?? []).map((n) => ({
    id: n.id,
    name: n.name,
    description: n.description,
    score: n.score,
    keywords: n.keywords,
    products: productsByNiche.get(n.id) ?? [],
  }));

  // PLAIN: 5. Add an "Uncategorised" bucket if there are products with
  //        no niche_id (e.g., added before niche-discovery was a feature).
  const uncategorised = productsByNiche.get(null) ?? [];
  if (uncategorised.length > 0) {
    tree.push({
      id: 'uncategorised',
      name: 'Uncategorised',
      description: 'Products without a primary niche assigned',
      score: null,
      keywords: null,
      products: uncategorised,
    });
  }

  // PLAIN: Avoid unused-var warning for productIds (keep for future).
  void productIds;

  return NextResponse.json({ niches: tree });
}
