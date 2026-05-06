// =============================================================================
// PINS MICROSERVICE — generate, approve, regenerate library pins
// =============================================================================
// PLAIN: Self-contained "service" that knows how to make a Pinterest pin
//        from a library product. Used by /api/pins/* routes. Does NOT
//        touch the per-run `pins` table — that's the POC pipeline's domain.
//
// TECH:  Pure-ish module: takes input data, returns/stores library_pins.
//        Imports Supabase + Groq but doesn't know about HTTP. Easy to test.
// =============================================================================

import { supabase } from '@/lib/supabase';
import { generateJson, SchemaType } from '@/lib/groq';
import type { LibraryPin } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

// PLAIN: One product as we receive it for pin generation (subset of fields).
// TECH:  Avoids tight coupling to product_library schema; only what we need.
export interface PinGenerationInput {
  product_id: string;
  title: string;
  price: string | null;
  image_url: string | null;
  affiliate_url: string;
  niche_tags: string | null;
}

// PLAIN: AI's response when generating pin copy.
// TECH:  Validated against PIN_CONTENT_SCHEMA below.
interface AiPinCopy {
  title: string;
  description: string;
  hashtags: string[];
  image_prompt: string;
}

// PLAIN: Schema we force the AI to follow.
const PIN_CONTENT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description:
        'Pinterest pin title, MAX 100 chars, hooky and benefit-driven',
    },
    description: {
      type: SchemaType.STRING,
      description:
        'Pinterest description, 200-500 chars, mentions key benefit, ' +
        'includes search keywords',
    },
    hashtags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '5-8 lowercase hashtags (no # prefix, just the words)',
    },
    image_prompt: {
      type: SchemaType.STRING,
      description:
        'A detailed AI image-generator prompt for a vertical 2:3 Pinterest ' +
        'pin: bright colors, clean background, lifestyle aesthetic, ' +
        'product-focused.',
    },
  },
  required: ['title', 'description', 'hashtags', 'image_prompt'],
} as const;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * PLAIN: Generates a fresh pin for a product. Asks AI for copy, picks the
 *        image (real product photo preferred over AI-generated), saves a
 *        new row in library_pins with status='pending_review'.
 *
 * TECH:  Returns the inserted LibraryPin row. Throws on AI/DB failures so
 *        the caller can mark the row as 'failed' if needed. Does NOT block
 *        on slow operations — single Groq call is the only network hop.
 */
export async function generatePinForProduct(
  product: PinGenerationInput
): Promise<LibraryPin> {
  // PLAIN: Ask AI to write Pinterest copy for this product.
  // TECH:  Single Groq call with JSON-mode output enforced.
  const prompt = `
You are writing a Pinterest pin for an Amazon affiliate product.

PRODUCT:
- Title: ${product.title}
- Price: ${product.price ?? 'N/A'}
- Niche tags: ${product.niche_tags ?? '(none)'}

Write engaging Pinterest content that:
- title: hooky, <100 chars (e.g. "This ₹4,499 air fryer changed how I cook").
- description: 200-500 chars; lead with benefit; include search keywords.
- hashtags: 5-8 relevant lowercase tags (no # symbol).
- image_prompt: vertical 2:3 lifestyle photo of THIS product, bright lighting,
  minimal background, Pinterest aesthetic.

Return JSON: { title, description, hashtags, image_prompt }.
  `.trim();

  const ai = await generateJson<AiPinCopy>(prompt, PIN_CONTENT_SCHEMA);

  // PLAIN: Truncate to Pinterest's hard limits (rejects oversized fields).
  // TECH:  100/500 chars per Pinterest API v5 spec.
  const safeTitle = ai.title.slice(0, 100);
  const safeDesc = ai.description.slice(0, 500);
  const hashtagStr = ai.hashtags
    .map((h) => h.replace(/^#/, ''))
    .filter(Boolean)
    .join(' ');

  // PLAIN: Pick the image. Priority:
  //   1. Real product photo (best — what buyers actually see)
  //   2. AI-generated Pinterest-style image (Pollinations.ai)
  // TECH:  Phase 4 will add canvas-composed pins (product + text overlay).
  const imageUrl = product.image_url || buildPollinationsUrl(ai.image_prompt);

  // PLAIN: Save the new pin to the library_pins table.
  // TECH:  Insert with status='pending_review' for the approval flow.
  const { data, error } = await supabase
    .from('library_pins')
    .insert({
      product_id: product.product_id,
      title: safeTitle,
      description: safeDesc,
      hashtags: hashtagStr,
      image_url: imageUrl,
      ai_image_prompt: ai.image_prompt,
      status: 'pending_review',
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[pins] db insert failed: ${error?.message}`);
  }

  return data as LibraryPin;
}

/**
 * PLAIN: Loads a product from product_library by id and generates a pin.
 *        Used by the API endpoint and by the background trigger after save.
 *
 * TECH:  Convenience wrapper that fetches the product first.
 */
export async function generatePinForProductId(
  productId: string
): Promise<LibraryPin> {
  const { data: product, error } = await supabase
    .from('product_library')
    .select('id, title, price, image_url, affiliate_url, niche_tags')
    .eq('id', productId)
    .single();

  if (error || !product) {
    throw new Error(`[pins] product not found: ${error?.message ?? 'no rows'}`);
  }

  return generatePinForProduct({
    product_id: product.id,
    title: product.title,
    price: product.price,
    image_url: product.image_url,
    affiliate_url: product.affiliate_url,
    niche_tags: product.niche_tags,
  });
}

/**
 * PLAIN: Updates a pin's status (approve / reject / posted).
 *
 * TECH:  Whitelisted UPDATE; refuses unknown statuses.
 */
export async function setPinStatus(
  pinId: string,
  status: 'pending_review' | 'approved' | 'rejected' | 'posted',
  extras?: { pin_url?: string; pinterest_pin_id?: string }
): Promise<LibraryPin> {
  const updates: Record<string, unknown> = { status };
  if (status === 'posted') {
    updates.posted_at = new Date().toISOString();
    if (extras?.pin_url) updates.pin_url = extras.pin_url;
    if (extras?.pinterest_pin_id)
      updates.pinterest_pin_id = extras.pinterest_pin_id;
  }

  const { data, error } = await supabase
    .from('library_pins')
    .update(updates)
    .eq('id', pinId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(`[pins] status update failed: ${error?.message}`);
  }
  return data as LibraryPin;
}

/**
 * PLAIN: Deletes a pin permanently.
 * TECH:  Hard delete; product row stays.
 */
export async function deletePin(pinId: string): Promise<void> {
  const { error } = await supabase.from('library_pins').delete().eq('id', pinId);
  if (error) {
    throw new Error(`[pins] delete failed: ${error.message}`);
  }
}

/**
 * PLAIN: Deletes the existing pin and generates a new one for the same
 *        product. Useful when AI's first attempt was bad.
 *
 * TECH:  Read product_id first, then delete + generate.
 */
export async function regeneratePin(pinId: string): Promise<LibraryPin> {
  const { data: existing, error } = await supabase
    .from('library_pins')
    .select('product_id')
    .eq('id', pinId)
    .single();

  if (error || !existing) {
    throw new Error(`[pins] pin not found: ${error?.message}`);
  }

  await deletePin(pinId);
  return generatePinForProductId(existing.product_id);
}

/**
 * PLAIN: Returns the latest pin (any status) for each given product.
 *        Used by the dashboard to show pin previews per product card.
 *
 * TECH:  Single SELECT with ORDER BY product_id, generated_at DESC; we
 *        de-dupe in JS (one row per product_id).
 */
export async function getLatestPinsByProductIds(
  productIds: string[]
): Promise<Map<string, LibraryPin>> {
  if (productIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('library_pins')
    .select('*')
    .in('product_id', productIds)
    .order('generated_at', { ascending: false });

  if (error || !data) return new Map();

  const map = new Map<string, LibraryPin>();
  for (const pin of data as LibraryPin[]) {
    if (!map.has(pin.product_id)) {
      map.set(pin.product_id, pin);
    }
  }
  return map;
}

// =============================================================================
// HELPERS
// =============================================================================

// PLAIN: Builds a free Pollinations.ai image URL from a text prompt.
// TECH:  Vertical 2:3 ratio (1000x1500) for Pinterest. nologo strips watermark.
function buildPollinationsUrl(prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  const params = new URLSearchParams({
    width: '1000',
    height: '1500',
    nologo: 'true',
    enhance: 'true',
  });
  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}
