// =============================================================================
// SUGGESTIONS MICROSERVICE — AI proposes products per niche
// =============================================================================
// PLAIN: Self-contained "service" that asks the AI to brainstorm 10 specific
//        product names for a given niche. Each suggestion is a NAME +
//        Amazon search query — the user verifies on Amazon and adds the
//        real URL via /products/add. Bridges the gap until PA-API access.
//
// TECH:  Pure-ish module — Supabase + Groq, no HTTP. Used by /api/niches/[id]/
//        suggestions routes. Keeps presentation concerns out of API layer.
// =============================================================================

import { supabase } from '@/lib/supabase';
import { generateJson, SchemaType } from '@/lib/groq';
import type { NicheProductSuggestion } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

interface AiSuggestion {
  product_name: string;
  brand: string;
  approximate_price: string;
  why_relevant: string;
  search_query: string;
}

interface AiSuggestionsResponse {
  suggestions: AiSuggestion[];
}

// PLAIN: The schema we force the AI to follow.
const SUGGESTIONS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    suggestions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          product_name: {
            type: SchemaType.STRING,
            description:
              'Specific product name with brand and key features ' +
              '(e.g., "Mamaearth Onion Hair Oil 250 ml")',
          },
          brand: {
            type: SchemaType.STRING,
            description: 'Brand name only (e.g., "Mamaearth")',
          },
          approximate_price: {
            type: SchemaType.STRING,
            description:
              'Price range hint in INR (e.g., "₹300-500"). Empty if unsure.',
          },
          why_relevant: {
            type: SchemaType.STRING,
            description:
              'One sentence explaining why this fits the niche and would ' +
              'sell well on Pinterest.',
          },
          search_query: {
            type: SchemaType.STRING,
            description:
              'Optimised Amazon India search query (e.g., ' +
              '"Mamaearth Onion Hair Oil 250ml")',
          },
        },
        required: [
          'product_name',
          'brand',
          'approximate_price',
          'why_relevant',
          'search_query',
        ],
      },
    },
  },
  required: ['suggestions'],
} as const;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * PLAIN: Asks the AI for 10 specific product names that fit this niche,
 *        saves them to niche_product_suggestions, returns the inserted rows.
 *
 * TECH:  Single Groq call. Existing PENDING suggestions for this niche are
 *        wiped first (regeneration replaces; doesn't accumulate forever).
 *        ADDED / DISMISSED suggestions are kept for analytics.
 */
export async function generateSuggestionsForNiche(
  nicheId: string,
  count: number = 10
): Promise<NicheProductSuggestion[]> {
  // PLAIN: Fetch the niche so AI knows what we're suggesting for.
  const { data: niche, error: nicheErr } = await supabase
    .from('trending_niches')
    .select('id, name, description, keywords')
    .eq('id', nicheId)
    .single();

  if (nicheErr || !niche) {
    throw new Error(`[suggestions] niche not found: ${nicheErr?.message}`);
  }

  // PLAIN: Ask the AI for product ideas.
  // TECH:  Prompt anchors on Amazon India + Pinterest-buyer-intent.
  const prompt = `
You're brainstorming Amazon India products for a Pinterest affiliate marketer.

NICHE: ${niche.name}
DESCRIPTION: ${niche.description ?? '(none)'}
KEYWORDS: ${niche.keywords ?? '(none)'}

Suggest ${count} SPECIFIC products that:
- Are real items sold on Amazon India (not generic categories).
- Are in the ₹500-₹5000 price range (Pinterest impulse-buy sweet spot).
- Are visually appealing (look good in pin images).
- Have clear buyer intent on Pinterest (people pin these to BUY).

Mix popular established products with up-and-coming/niche brands.
Avoid: generic phrases like "any toner" — give specific brands and SKUs.

For each: product_name, brand, approximate_price (₹X-Y), why_relevant
(1 sentence), search_query (optimised for Amazon India search box).

Return JSON: { suggestions: [...] } with exactly ${count} items.
  `.trim();

  const ai = await generateJson<AiSuggestionsResponse>(prompt, SUGGESTIONS_SCHEMA);

  if (!Array.isArray(ai.suggestions) || ai.suggestions.length === 0) {
    throw new Error('[suggestions] AI returned no suggestions');
  }

  // PLAIN: Wipe old PENDING suggestions for this niche to avoid clutter.
  //        Keep ADDED + DISMISSED ones (analytics value).
  // TECH:  Hard delete; keep this niche's data clean.
  await supabase
    .from('niche_product_suggestions')
    .delete()
    .eq('niche_id', nicheId)
    .eq('status', 'pending');

  // PLAIN: Save fresh suggestions.
  // TECH:  Bulk insert; .select() returns the inserted rows.
  const rows = ai.suggestions.map((s) => ({
    niche_id: nicheId,
    product_name: s.product_name,
    brand: s.brand || null,
    approximate_price: s.approximate_price || null,
    why_relevant: s.why_relevant || null,
    search_query: s.search_query,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('niche_product_suggestions')
    .insert(rows)
    .select();

  if (error || !data) {
    throw new Error(`[suggestions] insert failed: ${error?.message}`);
  }

  return data as NicheProductSuggestion[];
}

/**
 * PLAIN: Returns suggestions for a niche, optionally filtered by status.
 *
 * TECH:  SELECT with optional status filter; sorted newest first.
 */
export async function getSuggestionsForNiche(
  nicheId: string,
  status?: 'pending' | 'added' | 'dismissed'
): Promise<NicheProductSuggestion[]> {
  let query = supabase
    .from('niche_product_suggestions')
    .select('*')
    .eq('niche_id', nicheId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`[suggestions] fetch failed: ${error.message}`);
  }
  return (data ?? []) as NicheProductSuggestion[];
}

/**
 * PLAIN: Marks a suggestion as added (user grabbed the URL and added it).
 *
 * TECH:  UPDATE status='added' and link to product_library row.
 */
export async function markSuggestionAdded(
  suggestionId: string,
  addedProductId?: string
): Promise<NicheProductSuggestion> {
  const updates: Record<string, unknown> = { status: 'added' };
  if (addedProductId) updates.added_product_id = addedProductId;

  const { data, error } = await supabase
    .from('niche_product_suggestions')
    .update(updates)
    .eq('id', suggestionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[suggestions] mark added failed: ${error?.message}`);
  }
  return data as NicheProductSuggestion;
}

/**
 * PLAIN: Marks a suggestion as dismissed (user didn't like it).
 *
 * TECH:  UPDATE status='dismissed'; kept for analytics.
 */
export async function dismissSuggestion(
  suggestionId: string
): Promise<NicheProductSuggestion> {
  const { data, error } = await supabase
    .from('niche_product_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', suggestionId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[suggestions] dismiss failed: ${error?.message}`);
  }
  return data as NicheProductSuggestion;
}
