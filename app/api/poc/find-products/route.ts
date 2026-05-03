// =============================================================================
// API ROUTE: POST /api/poc/find-products
// =============================================================================
// PLAIN: Given a niche (like "kitchen gadgets"), this endpoint tries to find
//        the best-selling product on Amazon. If the Amazon API isn't set up
//        yet (or fails), it falls back to mock data so we can still build
//        and test the rest of the pipeline.
//
// TECH:  Next.js POST handler. Calls amazon-paapi if creds exist, otherwise
//        returns hardcoded mock products. Saves chosen product to `products`
//        table with affiliate URL constructed from associate tag.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logEvent } from '@/lib/logger';

// PLAIN: The shape of one product we work with internally.
// TECH:  Lowest-common-denominator type that library, Amazon API, and mocks fit.
interface ProductInput {
  asin: string | null;
  title: string;
  price: string | null;
  image_url: string | null;
  product_url: string | null;
  source: 'amazon_paapi' | 'mock' | 'library';
}

// PLAIN: Builds a robust Amazon India SEARCH URL. Search URLs never 404
//        (unlike specific product URLs whose ASINs go stale), and your
//        affiliate tag still earns commission on anything bought after
//        the click within 24 hours.
// TECH:  https://www.amazon.in/s?k=<encoded-keyword> with affiliate tag
//        appended downstream by buildAffiliateUrl().
function amazonSearchUrl(keyword: string): string {
  return `https://www.amazon.in/s?k=${encodeURIComponent(keyword)}`;
}

// PLAIN: Hardcoded fallback products by niche (so we can test without
//        Amazon API access). product_url uses Amazon SEARCH URLs (not
//        specific product pages) so links never break due to stale ASINs.
// TECH:  Keyword → product list map; chosen by case-insensitive substring
//        match on niche name. Image URLs are stable Amazon CDN paths.
//        ASIN field is null for mock data — search URLs don't need it.
const MOCK_PRODUCTS_BY_NICHE: Record<string, ProductInput[]> = {
  default: [
    {
      asin: null,
      title: 'Air Fryer 4.5L — Digital Touch Panel',
      price: '₹4,499',
      image_url: 'https://m.media-amazon.com/images/I/71JBZpjz1ML._SL1500_.jpg',
      product_url: amazonSearchUrl('air fryer 4.5L digital'),
      source: 'mock',
    },
  ],
  kitchen: [
    {
      asin: null,
      title: 'Air Fryer 4.5L — Digital Touch Panel',
      price: '₹4,499',
      image_url: 'https://m.media-amazon.com/images/I/71JBZpjz1ML._SL1500_.jpg',
      product_url: amazonSearchUrl('air fryer 4.5L digital'),
      source: 'mock',
    },
  ],
  plant: [
    {
      asin: null,
      title: 'Wooden Plant Stand for Indoor Plants — 3 Tier',
      price: '₹1,299',
      image_url: 'https://m.media-amazon.com/images/I/71qYMmHpx2L._SL1500_.jpg',
      product_url: amazonSearchUrl('wooden plant stand 3 tier indoor'),
      source: 'mock',
    },
  ],
  skincare: [
    {
      asin: null,
      title: 'Korean Skincare Toner — AHA BHA PHA',
      price: '₹1,099',
      image_url: 'https://m.media-amazon.com/images/I/61W5+yfnp+L._SL1500_.jpg',
      product_url: amazonSearchUrl('korean skincare toner aha bha'),
      source: 'mock',
    },
  ],
  ayurved: [
    {
      asin: null,
      title: 'Ayurvedic Face Serum — Natural Glow',
      price: '₹699',
      image_url: 'https://m.media-amazon.com/images/I/61W5+yfnp+L._SL1500_.jpg',
      product_url: amazonSearchUrl('ayurvedic face serum natural'),
      source: 'mock',
    },
  ],
  decor: [
    {
      asin: null,
      title: 'Wooden Wall Hanging Decor — Boho Macrame',
      price: '₹699',
      image_url: 'https://m.media-amazon.com/images/I/81e3kRlPmJL._SL1500_.jpg',
      product_url: amazonSearchUrl('boho macrame wall hanging'),
      source: 'mock',
    },
  ],
  desk: [
    {
      asin: null,
      title: 'Minimalist Desk Organizer — Wooden',
      price: '₹999',
      image_url: 'https://m.media-amazon.com/images/I/71qYMmHpx2L._SL1500_.jpg',
      product_url: amazonSearchUrl('minimalist wooden desk organizer'),
      source: 'mock',
    },
  ],
  vastu: [
    {
      asin: null,
      title: 'Vastu Home Decor — Brass Tortoise on Plate',
      price: '₹499',
      image_url: 'https://m.media-amazon.com/images/I/81e3kRlPmJL._SL1500_.jpg',
      product_url: amazonSearchUrl('vastu brass tortoise plate home'),
      source: 'mock',
    },
  ],
};

// PLAIN: Picks a mock product based on the niche keyword.
// TECH:  Substring lookup over MOCK_PRODUCTS_BY_NICHE keys; falls back to default.
function pickMockProduct(nicheName: string): ProductInput {
  const lower = nicheName.toLowerCase();
  for (const key of Object.keys(MOCK_PRODUCTS_BY_NICHE)) {
    if (key !== 'default' && lower.includes(key)) {
      return MOCK_PRODUCTS_BY_NICHE[key][0];
    }
  }
  return MOCK_PRODUCTS_BY_NICHE.default[0];
}

// PLAIN: Adds your affiliate tag to a plain Amazon URL so you earn
//        commission when someone buys.
// TECH:  Appends/replaces ?tag=<associateTag> query param.
function buildAffiliateUrl(productUrl: string, associateTag: string): string {
  try {
    const url = new URL(productUrl);
    url.searchParams.set('tag', associateTag);
    return url.toString();
  } catch {
    // PLAIN: If URL parsing fails, just append the tag manually.
    // TECH:  Defensive fallback; should rarely hit for valid Amazon URLs.
    const sep = productUrl.includes('?') ? '&' : '?';
    return `${productUrl}${sep}tag=${associateTag}`;
  }
}

// PLAIN: Result of a library lookup attempt.
// TECH:  Includes diagnostic info so the orchestrator can log why it
//        chose a particular product (or fell back to mock).
interface LibraryPickResult {
  product: ProductInput | null;
  matchType: 'niche_match' | 'any_active' | 'empty';
  totalActive: number;
  matchedCount: number;
}

// PLAIN: Looks in YOUR product library for a product. Two-tier strategy:
//        1. PREFER products whose niche_tags or title contain any word
//           from the AI's chosen niche.
//        2. If no match, fall back to ANY active product in your library
//           (still better than mock data — at least it's a real product).
//        3. Returns null only if your library is completely empty.
//
// TECH:  Two queries: niche-filtered then unfiltered fallback. Returns
//        diagnostic metadata so caller can log clearly.
async function pickFromLibrary(nicheName: string): Promise<LibraryPickResult> {
  // PLAIN: First, count how many active products you have in total.
  // TECH:  Lightweight count query for diagnostic logging.
  const { count: totalCount } = await supabase
    .from('product_library')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  const totalActive = totalCount ?? 0;

  // PLAIN: If library is empty, bail with diagnostic info.
  // TECH:  Caller will fall back to PA-API or mock.
  if (totalActive === 0) {
    return { product: null, matchType: 'empty', totalActive: 0, matchedCount: 0 };
  }

  // PLAIN: Break niche into meaningful words.
  // TECH:  Drop short stop-words; lowercase for case-insensitive matching.
  const words = nicheName
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  // PLAIN: TIER 1 — try to find a product whose tags or title match
  //        any niche word.
  // TECH:  Build Supabase OR filter: niche_tags.ilike.%w1%,title.ilike.%w1%,...
  if (words.length > 0) {
    const orFilter = words
      .map((w) => `niche_tags.ilike.%${w}%,title.ilike.%${w}%`)
      .join(',');

    const { data: matched } = await supabase
      .from('product_library')
      .select('*')
      .eq('is_active', true)
      .or(orFilter)
      .limit(50);

    if (matched && matched.length > 0) {
      const random = matched[Math.floor(Math.random() * matched.length)];
      return {
        product: toProductInput(random),
        matchType: 'niche_match',
        totalActive,
        matchedCount: matched.length,
      };
    }
  }

  // PLAIN: TIER 2 — no niche match found. Pick ANY active product from
  //        your library. Still better than mock data.
  // TECH:  Plain SELECT WHERE is_active = true.
  const { data: anyActive } = await supabase
    .from('product_library')
    .select('*')
    .eq('is_active', true)
    .limit(50);

  if (!anyActive || anyActive.length === 0) {
    return { product: null, matchType: 'empty', totalActive, matchedCount: 0 };
  }

  const random = anyActive[Math.floor(Math.random() * anyActive.length)];
  return {
    product: toProductInput(random),
    matchType: 'any_active',
    totalActive,
    matchedCount: 0,
  };
}

// PLAIN: Converts a product_library row into the standard ProductInput shape.
// TECH:  Type-safe mapper.
function toProductInput(row: {
  asin: string;
  title: string;
  price: string | null;
  image_url: string | null;
  product_url: string;
}): ProductInput {
  return {
    asin: row.asin,
    title: row.title,
    price: row.price,
    image_url: row.image_url,
    product_url: row.product_url,
    source: 'library',
  };
}

// PLAIN: PA-API support removed.
//        Amazon's new "Creators API" gates access behind 10 qualifying
//        sales in 30 days — a chicken-and-egg problem for new affiliates.
//        Until that's solved, the manual product library at /products/add
//        is the way to bring real products into the pipeline.
//
// TECH:  Stub left in place so the orchestrator's three-tier resolution
//        chain (library → API → mock) compiles unchanged. Always returns
//        null. When PA-API access is granted later, restore the real
//        implementation here (also re-add `amazon-paapi` to package.json).
//
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function tryAmazonApi(_keyword: string): Promise<ProductInput | null> {
  return null;
}

// PLAIN: The main handler.
// TECH:  Reads runId + nicheId from body, fetches niche, finds product,
//        saves to DB, returns row.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const runId: string | undefined = body.runId;
  const nicheId: string | undefined = body.nicheId;

  if (!runId || !nicheId) {
    return NextResponse.json(
      { error: 'runId and nicheId required' },
      { status: 400 }
    );
  }

  await logEvent({
    runId,
    step: 'find_products',
    status: 'info',
    message: 'Looking up niche and searching for best products...',
  });

  try {
    // PLAIN: Get the niche we saved in the previous step.
    // TECH:  SELECT by id; .single() returns one row or error.
    const { data: niche, error: nicheErr } = await supabase
      .from('niches')
      .select('*')
      .eq('id', nicheId)
      .single();

    if (nicheErr || !niche) {
      throw new Error(`niche not found: ${nicheErr?.message ?? 'no rows'}`);
    }

    // PLAIN: Three-tier product resolution:
    //   1. YOUR product library (curated real products) — preferred
    //   2. Amazon PA-API (only works if creds set + you have access)
    //   3. Hardcoded mock data (last-resort, always works)
    // TECH:  First non-null result wins. Each tier logs an info event so
    //        you can see in the UI which path was taken.
    let product: ProductInput;

    const libResult = await pickFromLibrary(niche.name);
    await logEvent({
      runId,
      step: 'find_products',
      status: 'info',
      message:
        `Library lookup: ${libResult.totalActive} active products, ` +
        `${libResult.matchedCount} matched niche, ` +
        `result=${libResult.matchType}`,
      payload: {
        niche_name: niche.name,
        total_active: libResult.totalActive,
        matched: libResult.matchedCount,
      },
    });

    if (libResult.product) {
      const matchNote =
        libResult.matchType === 'niche_match'
          ? '(niche match)'
          : '(any active — no niche match found)';
      await logEvent({
        runId,
        step: 'find_products',
        status: 'info',
        message: `Picked from library ${matchNote}: "${libResult.product.title}"`,
      });
      product = libResult.product;
    } else {
      // PLAIN: Library empty — try Amazon API, then mock.
      const apiProduct = await tryAmazonApi(niche.name);
      if (apiProduct) {
        await logEvent({
          runId,
          step: 'find_products',
          status: 'info',
          message: 'Library empty — using Amazon PA-API.',
        });
        product = apiProduct;
      } else {
        await logEvent({
          runId,
          step: 'find_products',
          status: 'info',
          message:
            'Library empty + no Amazon API — using mock product. ' +
            'Add real products at /products/add.',
        });
        product = pickMockProduct(niche.name);
      }
    }

    // PLAIN: Build the affiliate URL using your store ID (prakshita-21).
    // TECH:  Read tag from env, fall back to known value to avoid blank tag.
    const associateTag = process.env.AMAZON_ASSOCIATE_TAG ?? 'prakshita-21';
    const affiliateUrl = product.product_url
      ? buildAffiliateUrl(product.product_url, associateTag)
      : `https://www.amazon.in/dp/${product.asin}?tag=${associateTag}`;

    // PLAIN: Save the product to our database.
    // TECH:  Insert into products table linked to nicheId.
    const { data: saved, error: saveErr } = await supabase
      .from('products')
      .insert({
        niche_id: nicheId,
        asin: product.asin,
        title: product.title,
        price: product.price,
        image_url: product.image_url,
        product_url: product.product_url,
        affiliate_url: affiliateUrl,
        source: product.source,
      })
      .select()
      .single();

    if (saveErr || !saved) {
      throw new Error(`db insert failed: ${saveErr?.message}`);
    }

    await logEvent({
      runId,
      step: 'find_products',
      status: 'success',
      message: `Picked product: "${product.title}" (${product.source})`,
      payload: { product: saved },
    });

    return NextResponse.json({ product: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await logEvent({
      runId,
      step: 'find_products',
      status: 'failed',
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
