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
  imageUrlFromAsin,
} from '@/lib/amazon-url';
import { generateJson, SchemaType } from '@/lib/groq';

// =============================================================================
// AI HELPER — combined tag + niche suggestion
// =============================================================================
// PLAIN: One Groq call that does two things at once:
//        1. Generates Pinterest-style niche tags for a product.
//        2. Picks the best niche from the user's existing trending_niches
//           catalog — OR proposes a brand-new one if none fit.
// TECH:  Saves an API call vs. running these as two separate prompts.
// =============================================================================

// PLAIN: AI's response when matching/suggesting a niche.
//        match_existing_id is set if the AI picks an existing niche;
//        otherwise the new_niche fields are populated and we INSERT.
// TECH:  Discriminated structure but represented as flat fields for
//        Groq's JSON-mode reliability (oneOf/discriminators are flaky).
interface ProductMetaResponse {
  tags: string[];
  /** PLAIN: Top niche match (best fit). Empty string if nothing fits. */
  match_existing_id: string | null;
  /** PLAIN: Up to 2 alternative niches the AI also thinks fit reasonably. */
  alt_niche_ids: string[];
  /** PLAIN: Filled if AI is proposing a new niche. */
  new_niche_name: string | null;
  new_niche_description: string | null;
  new_niche_keywords: string[];
  new_niche_score: number | null;
}

const PRODUCT_META_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    tags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '5-8 lowercase Pinterest-style niche keywords for this product',
    },
    match_existing_id: {
      type: SchemaType.STRING,
      description:
        'UUID of the BEST existing niche for this product (single best fit). ' +
        'Use EXACT id from AVAILABLE NICHES. Empty string "" if nothing fits.',
    },
    alt_niche_ids: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description:
        'Up to 2 ALTERNATIVE niche UUIDs that also reasonably fit (in order ' +
        'of relevance). Empty array if only one niche fits or none fit. ' +
        'Do NOT include the match_existing_id here.',
    },
    new_niche_name: {
      type: SchemaType.STRING,
      description:
        'If match_existing_id is empty, propose a new niche name (2-4 words). ' +
        'Empty string if matching to existing.',
    },
    new_niche_description: {
      type: SchemaType.STRING,
      description: 'One sentence describing the new niche. Empty if matching existing.',
    },
    new_niche_keywords: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '5-8 search keywords for the new niche. Empty array if matching existing.',
    },
    new_niche_score: {
      type: SchemaType.NUMBER,
      description: '0-100 confidence the new niche will earn money. 0 if matching existing.',
    },
  },
  required: [
    'tags',
    'match_existing_id',
    'alt_niche_ids',
    'new_niche_name',
    'new_niche_description',
    'new_niche_keywords',
    'new_niche_score',
  ],
} as const;

/**
 * PLAIN: One AI call that returns niche tags AND either picks an existing
 *        niche or proposes a new one. Caller handles INSERT for new niches.
 *
 * TECH:  Reads trending_niches as the candidate pool, asks Groq to either
 *        return one of those IDs or propose a new niche. Returns null on
 *        failure so the form still works without AI assistance.
 */
async function suggestProductMeta(
  title: string
): Promise<ProductMetaResponse | null> {
  try {
    // PLAIN: Pull existing niches so AI knows what to match against.
    // TECH:  Lightweight SELECT — id, name, keywords are enough context.
    const { data: existingNiches } = await supabase
      .from('trending_niches')
      .select('id, name, keywords')
      .eq('is_active', true);

    const nichesContext =
      existingNiches && existingNiches.length > 0
        ? existingNiches
            .map(
              (n) =>
                `  - id: ${n.id}\n    name: "${n.name}"\n    keywords: ${n.keywords ?? '(none)'}`
            )
            .join('\n')
        : '  (no existing niches yet — propose a new one)';

    const prompt = `
You're helping categorise an Amazon product for a Pinterest affiliate library.

PRODUCT TITLE: ${title}

AVAILABLE NICHES (existing catalog):
${nichesContext}

Tasks:
1. Generate 5-8 Pinterest-style lowercase niche tags for this product.
2. Pick the BEST existing niche match (match_existing_id), then optionally
   list up to 2 ALTERNATIVE niches that also fit (alt_niche_ids).
3. If NO existing niche fits well at all, leave match_existing_id empty and
   propose a brand-new niche by filling new_niche_name, description, keywords, score.

Rules:
- alt_niche_ids must NEVER include the match_existing_id (no duplicates).
- alt_niche_ids should be empty if only one niche fits (don't pad with weak fits).
- Don't force a match — propose new if existing options are weak.

Return JSON matching the schema.
    `.trim();

    return await generateJson<ProductMetaResponse>(prompt, PRODUCT_META_SCHEMA);
  } catch {
    // PLAIN: AI failed — caller falls back to manual entry.
    return null;
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
  /** PLAIN: Primary niche this product belongs to (FK to trending_niches). */
  niche_id?: string;
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

    // PLAIN: Step 5 — for PREVIEW mode, ask AI to:
    //          1. Suggest 5-8 niche tags
    //          2. Pick the BEST existing niche + up to 2 ALTERNATIVES
    //          3. OR propose a brand-new niche (which we'll INSERT below).
    // TECH:  Single combined Groq call. Returns top-3 niche IDs in order.
    let suggestedTags: string[] = [];
    let suggestedNicheId: string | null = null;
    let suggestedNicheTop3: string[] = [];
    let suggestedNicheNew: { id: string; name: string } | null = null;

    // PLAIN: Decide what title to feed AI.
    //        Priority: user-supplied title (re-suggest flow) > Amazon meta title.
    //        If neither has a real title, skip AI to avoid junk "unknown product" niches.
    // TECH:  body.title is sent by the UI's "Re-suggest niche" button after
    //        the user types the real title manually.
    const userTitleHint = body.title?.trim();
    const aiTitleSource = userTitleHint || meta.title?.trim() || '';
    const hasRealTitle = aiTitleSource.length > 0;

    if (mode === 'preview' && hasRealTitle) {
      const ai = await suggestProductMeta(aiTitleSource);
      if (ai) {
        suggestedTags = ai.tags;

        if (ai.match_existing_id && ai.match_existing_id.trim().length > 0) {
          // PLAIN: AI matched an existing niche — use it directly.
          suggestedNicheId = ai.match_existing_id;
        } else if (ai.new_niche_name && ai.new_niche_name.trim().length > 0) {
          // PLAIN: AI proposed a NEW niche — auto-create it now so the
          //        dashboard immediately has it (and the dropdown can
          //        pre-select it).
          // TECH:  UPSERT by name to avoid duplicates if user is rapid-firing.
          const { data: created, error: createErr } = await supabase
            .from('trending_niches')
            .upsert(
              {
                name: ai.new_niche_name.toLowerCase().trim(),
                description: ai.new_niche_description ?? null,
                score: ai.new_niche_score
                  ? Math.min(100, Math.max(0, Math.round(ai.new_niche_score)))
                  : 70,
                keywords: ai.new_niche_keywords?.join(', ') ?? null,
              },
              { onConflict: 'name' }
            )
            .select('id, name')
            .single();

          if (!createErr && created) {
            suggestedNicheId = created.id;
            suggestedNicheNew = { id: created.id, name: created.name };
          }
        }

        // PLAIN: Build the top-3 suggestions list: best match + alternates.
        //        UI shows these as quick-select buttons above the dropdown.
        // TECH:  Filter out empty strings, dedupe, and validate against
        //        existing niches OR the just-created one.
        const candidates = [
          suggestedNicheId,
          ...(Array.isArray(ai.alt_niche_ids) ? ai.alt_niche_ids : []),
        ].filter((id): id is string => typeof id === 'string' && id.trim().length > 0);

        // PLAIN: Verify each ID exists in trending_niches (defends against
        //        AI hallucinating UUIDs).
        // TECH:  IN() query against trending_niches to validate IDs.
        const seen = new Set<string>();
        const uniqueCandidates = candidates.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });

        if (uniqueCandidates.length > 0) {
          const { data: validNiches } = await supabase
            .from('trending_niches')
            .select('id')
            .in('id', uniqueCandidates);

          const validIds = new Set((validNiches ?? []).map((n) => n.id));
          suggestedNicheTop3 = uniqueCandidates
            .filter((id) => validIds.has(id))
            .slice(0, 3);
        }
      }
    }

    // PLAIN: Use override values from the form if the user typed them.
    // TECH:  Body overrides > scraped meta > AI suggestion > defaults.
    const finalTitle = body.title ?? meta.title ?? `Amazon product ${asin}`;
    // PLAIN: Image priority: user-supplied → Amazon's og:image → ASIN-based
    //        CDN fallback. The fallback works for many products and is
    //        better than showing a "No image" placeholder.
    // TECH:  imageUrlFromAsin builds Amazon's product-thumbnail URL pattern.
    const finalImage = body.image_url ?? meta.image ?? imageUrlFromAsin(asin);
    const finalPrice = body.price ?? meta.price ?? null;
    const finalTags =
      body.niche_tags ??
      (suggestedTags.length > 0 ? suggestedTags.join(', ') : null);
    const finalNicheId = body.niche_id ?? suggestedNicheId ?? null;

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
      niche_id: finalNicheId,
    };

    // PLAIN: If preview mode, return without saving. We pass niche_top3
    //        so the UI can show quick-select buttons above the dropdown.
    // TECH:  Extra preview-only fields don't bleed into save flow.
    if (mode === 'preview') {
      return NextResponse.json({
        preview: {
          ...productData,
          niche_top3: suggestedNicheTop3,
        },
        new_niche_created: suggestedNicheNew,
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

    // PLAIN: Fire-and-forget pin generation. We don't await — the form
    //        returns immediately, and the pin appears on the dashboard a
    //        few seconds later when the AI call finishes.
    // TECH:  Dynamic import to keep cold-start lean for users who never
    //        hit save. Errors are swallowed (logged) since pin gen is
    //        best-effort — user can retry from the dashboard via Recreate.
    if (data?.id) {
      void (async () => {
        try {
          const { generatePinForProductId } = await import('@/lib/pins');
          await generatePinForProductId(data.id);
        } catch (err) {
          console.error(
            '[library] background pin generation failed:',
            (err as Error).message
          );
        }
      })();
    }

    return NextResponse.json({ product: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
