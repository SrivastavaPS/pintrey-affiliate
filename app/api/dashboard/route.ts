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
import { getLatestPinsByProductIds } from '@/lib/pins';

// PLAIN: Shape of one product as the dashboard renders it.
// TECH:  Product fields + nested latest library_pin (with its status).
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
  // PLAIN: Latest pin generated for this product (null if no pin yet).
  // TECH:  From library_pins, joined client-side via getLatestPinsByProductIds.
  latest_pin: {
    id: string;
    title: string;
    image_url: string | null;
    description: string | null;
    hashtags: string | null;
    status: string;
    pin_url: string | null;
    generated_at: string;
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

  // PLAIN: 2. Get all active products from the library.
  //        Pin info is left NULL for now — pin generation directly off
  //        library products is wired up in Phase 2.2.
  // TECH:  Plain SELECT, no joins. Earlier attempt to join pins via
  //        Supabase relational shorthand failed because pins.product_id
  //        references the per-run `products` table, not `product_library`.
  const { data: productList, error: prodErr } = await supabase
    .from('product_library')
    .select(
      'id, asin, title, image_url, price, affiliate_url, niche_tags, source, niche_id, created_at'
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (prodErr) {
    return NextResponse.json({ error: prodErr.message }, { status: 500 });
  }

  // PLAIN: Fetch the latest pin for each product (Phase 2.2).
  // TECH:  One bulk query, returned as Map<product_id, pin>. Pins with
  //        no library_pin yet → null.
  const productIds = (productList ?? []).map((p) => p.id);
  const latestPinsByProduct = await getLatestPinsByProductIds(productIds);

  // PLAIN: Decorate each product with its latest pin.
  // TECH:  Lookup from the Map; carry niche_id for grouping below.
  const productsTyped = (productList ?? []).map((p) => {
    const pin = latestPinsByProduct.get(p.id);
    return {
      id: p.id,
      asin: p.asin,
      title: p.title,
      image_url: p.image_url,
      price: p.price,
      affiliate_url: p.affiliate_url,
      niche_tags: p.niche_tags,
      source: p.source,
      created_at: p.created_at,
      niche_id: p.niche_id,
      latest_pin: pin
        ? {
            id: pin.id,
            title: pin.title,
            image_url: pin.image_url,
            description: pin.description,
            hashtags: pin.hashtags,
            status: pin.status,
            pin_url: pin.pin_url,
            generated_at: pin.generated_at,
          }
        : null,
    };
  });

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

  return NextResponse.json({ niches: tree });
}
