// =============================================================================
// API ROUTE: GET /api/library  +  POST /api/library
// =============================================================================
// PLAIN: Two endpoints in one file:
//        - GET  → list all products in your library
//        - POST → add a new product (paste an Amazon URL, we extract the rest)
//
// TECH:  Next.js App Router conventions: each HTTP verb is a named export.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import {
  extractAsin,
  resolveShortUrl,
  fetchProductMetadata,
  buildAffiliateUrl,
  canonicalUrlFromAsin,
} from '@/lib/amazon-url';
import { generateJson, SchemaType } from '@/lib/groq';

// PLAIN: Schema we make Groq follow when suggesting niche tags.
// TECH:  Single field response — array of tag strings.
const TAG_SUGGESTION_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        '5-8 lowercase niche keywords separated by commas, e.g., ' +
        '["skincare", "korean", "toner", "anti-acne", "glow"]',
    },
  },
  required: ['tags'],
} as const;

interface TagResponse {
  tags: string[];
}

/**
 * PLAIN: Asks the AI to suggest niche tags for a product based on its title.
 *        Used for the "auto-fill tags" UX in /products/add.
 *
 * TECH:  Single Groq call with a strict response schema. Returns empty
 *        array on failure so caller can fall back to manual entry.
 */
async function suggestNicheTags(title: string): Promise<string[]> {
  try {
    const prompt = `
You're helping categorise an Amazon product for a Pinterest affiliate library.

PRODUCT TITLE: ${title}

Generate 5-8 lowercase, single-word or two-word niche tags that describe what
kind of audience would search for this on Pinterest. Think Pinterest search
keywords, not product features.

Good examples:
- "Korean skincare toner" → ["skincare", "korean", "toner", "k-beauty", "anti-acne"]
- "Wooden plant stand 3 tier" → ["plant stand", "indoor plants", "home decor", "boho"]
- "Air fryer 4.5L" → ["kitchen gadgets", "air fryer", "healthy cooking", "meal prep"]

Return JSON: { tags: [...] }
    `.trim();

    const result = await generateJson<TagResponse>(prompt, TAG_SUGGESTION_SCHEMA);
    return Array.isArray(result.tags) ? result.tags : [];
  } catch {
    // PLAIN: AI suggestion is best-effort. Don't block the form.
    // TECH:  Silent catch; user can type tags manually.
    return [];
  }
}

// =============================================================================
// GET /api/library  — list all products
// =============================================================================
// PLAIN: Returns every product you've added. Used by the /products/add
//        page to show your existing library below the form.
// TECH:  SELECT * FROM product_library ORDER BY created_at DESC.
// =============================================================================
export async function GET() {
  const { data, error } = await supabase
    .from('product_library')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ products: data ?? [] });
}

// =============================================================================
// POST /api/library  — add or preview a product
// =============================================================================
// PLAIN: Two modes:
//        1. mode='preview'  → fetch metadata but don't save (form preview)
//        2. mode='save'     → fetch + save into product_library
//
// TECH:  Single endpoint to keep the form UX tight. Body { url, mode, ... }.
// =============================================================================

interface AddRequestBody {
  /** PLAIN: The Amazon URL the user pasted. */
  url?: string;

  /** PLAIN: 'preview' = just extract & return, 'save' = persist to DB. */
  mode?: 'preview' | 'save';

  /** PLAIN: Optional user-provided overrides (used in 'save' mode). */
  title?: string;
  price?: string;
  niche_tags?: string;
  notes?: string;
  image_url?: string;
}

export async function POST(req: NextRequest) {
  // PLAIN: Read the JSON body the form sent.
  // TECH:  Standard JSON parse; bail with 400 if malformed.
  const body = (await req.json().catch(() => ({}))) as AddRequestBody;

  if (!body.url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  const mode = body.mode ?? 'preview';

  try {
    // PLAIN: Step 1 — if it's a short URL, follow redirects to the full one.
    // TECH:  amzn.in/d/X → www.amazon.in/dp/Y resolution.
    const fullUrl = await resolveShortUrl(body.url);

    // PLAIN: Step 2 — pull the ASIN out of the URL.
    // TECH:  Regex over multiple Amazon URL shapes.
    const asin = extractAsin(fullUrl);
    if (!asin) {
      return NextResponse.json(
        {
          error:
            'Could not find a product ID (ASIN) in the URL. Make sure ' +
            'the URL is from amazon.in and points to a specific product.',
        },
        { status: 400 }
      );
    }

    // PLAIN: Step 3 — build the clean canonical URL + affiliate URL.
    // TECH:  Marketplace from env, fallback to .in.
    const marketplace = process.env.AMAZON_MARKETPLACE ?? 'www.amazon.in';
    const associateTag =
      process.env.AMAZON_ASSOCIATE_TAG ?? 'prakshita-21';
    const productUrl = canonicalUrlFromAsin(asin, marketplace);
    const affiliateUrl = buildAffiliateUrl(productUrl, associateTag);

    // PLAIN: Step 4 — fetch the page meta tags for title, image, and price.
    // TECH:  Single fetch returns all three via fetchProductMetadata.
    const meta = await fetchProductMetadata(productUrl);

    // PLAIN: Step 5 — for PREVIEW mode, ask AI to suggest niche tags from
    //        the title. Skipped on SAVE if user already typed tags.
    // TECH:  Only run AI on preview to save tokens; users can override.
    let suggestedTags: string[] = [];
    if (mode === 'preview' && (meta.title || asin)) {
      suggestedTags = await suggestNicheTags(meta.title ?? asin);
    }

    // PLAIN: Use override values from the form if the user typed them.
    // TECH:  Body overrides > scraped meta > AI suggestion > defaults.
    const finalTitle = body.title ?? meta.title ?? `Amazon product ${asin}`;
    const finalImage = body.image_url ?? meta.image ?? null;
    const finalPrice = body.price ?? meta.price ?? null;
    const finalTags =
      body.niche_tags ??
      (suggestedTags.length > 0 ? suggestedTags.join(', ') : null);

    // PLAIN: Build the data object that represents this product.
    // TECH:  Shared across preview and save responses.
    const productData = {
      asin,
      title: finalTitle,
      image_url: finalImage,
      product_url: productUrl,
      affiliate_url: affiliateUrl,
      price: finalPrice,
      niche_tags: finalTags,
      notes: body.notes ?? null,
      is_active: true,
      source: 'manual' as const,
    };

    // PLAIN: If preview mode, return without saving.
    // TECH:  Lets the form show a confirm UI before committing.
    if (mode === 'preview') {
      return NextResponse.json({
        preview: productData,
        meta_ok: meta.ok,
      });
    }

    // PLAIN: Save mode — write to DB. Use UPSERT so re-adding the same
    //        product just updates the existing row.
    // TECH:  ON CONFLICT (asin) DO UPDATE — relies on idx_library_unique_asin.
    const { data, error } = await supabase
      .from('product_library')
      .upsert(productData, { onConflict: 'asin' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ product: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
