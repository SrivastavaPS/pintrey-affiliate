// =============================================================================
// API ROUTE: POST /api/poc/generate-content
// =============================================================================
// PLAIN: Given a product, this endpoint asks Gemini to write a Pinterest
//        title, description, and hashtags. Then it generates a Pinterest-
//        optimized image using Pollinations.ai (free, no API key needed).
//
// TECH:  Two-stage: (1) Gemini structured output for copy, (2) Pollinations
//        URL construction for image. Saves both into `pins` table.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// PLAIN: Using Groq instead of Gemini (free tier blocked in some regions).
// TECH:  Same generateJson signature; only the import path changed.
import { generateJson, SchemaType } from '@/lib/groq';
import { logEvent } from '@/lib/logger';

// PLAIN: What Gemini returns — title, description, hashtags, and an
//        image-prompt we'll feed to Pollinations.
// TECH:  Strongly typed response shape for compile-time safety.
interface ContentResponse {
  title: string;
  description: string;
  hashtags: string[];
  image_prompt: string;
}

// PLAIN: The schema we force Gemini to follow.
// TECH:  responseSchema for Gemini JSON mode; arrays use items.
const CONTENT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: {
      type: SchemaType.STRING,
      description: 'Pinterest pin title, max 100 chars, hooky and benefit-driven',
    },
    description: {
      type: SchemaType.STRING,
      description: 'Pinterest description, 200-500 chars, includes keywords',
    },
    hashtags: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: '5-8 relevant hashtags (no # prefix, just the words)',
    },
    image_prompt: {
      type: SchemaType.STRING,
      description:
        'Detailed prompt for an AI image generator to create a Pinterest-' +
        'style image (vertical 2:3 ratio, bright colors, clean background, ' +
        'product-focused, lifestyle aesthetic)',
    },
  },
  required: ['title', 'description', 'hashtags', 'image_prompt'],
} as const;

// PLAIN: Builds the Pollinations image URL from a text prompt. No API key
//        needed — they generate the image on demand from the URL itself.
// TECH:  https://image.pollinations.ai/prompt/<encoded prompt>?<params>
//        We pass width/height for a 2:3 vertical Pinterest pin (1000x1500).
function buildPollinationsUrl(prompt: string): string {
  // PLAIN: URL-encode the prompt so spaces and special chars don't break it.
  // TECH:  encodeURIComponent escapes per RFC 3986.
  const encoded = encodeURIComponent(prompt);

  // PLAIN: Pinterest pins look best at 2:3 ratio (1000 wide × 1500 tall).
  // TECH:  Pollinations supports width/height query params; nologo=true
  //        removes the watermark; seed makes it deterministic for retries.
  const params = new URLSearchParams({
    width: '1000',
    height: '1500',
    nologo: 'true',
    enhance: 'true',
  });

  return `https://image.pollinations.ai/prompt/${encoded}?${params.toString()}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const runId: string | undefined = body.runId;
  const productId: string | undefined = body.productId;

  if (!runId || !productId) {
    return NextResponse.json(
      { error: 'runId and productId required' },
      { status: 400 }
    );
  }

  await logEvent({
    runId,
    step: 'generate_content',
    status: 'info',
    message: 'Generating pin copy and image...',
  });

  try {
    // PLAIN: Fetch the product so we know what to write about.
    // TECH:  Single SELECT by id; needed for prompt context.
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (prodErr || !product) {
      throw new Error(`product not found: ${prodErr?.message ?? 'no rows'}`);
    }

    // PLAIN: Tell Gemini to write the pin content.
    // TECH:  Prompt with product context; output coerced via responseSchema.
    const prompt = `
You are writing a Pinterest pin for an Amazon affiliate product.

PRODUCT:
- Title: ${product.title}
- Price: ${product.price ?? 'N/A'}

Write engaging Pinterest content that:
- Title: hook the reader in <100 chars (e.g., "This ₹4,499 air fryer changed how I cook").
- Description: 200-500 chars, mention key benefit, include keywords for Pinterest search.
- Hashtags: 5-8 relevant lowercase tags (no # symbol).
- Image prompt: describe a clean, vertical, lifestyle-style image of this
  product. Bright lighting, minimal background, aesthetic Pinterest vibe.

Return JSON: { title, description, hashtags, image_prompt }.
    `.trim();

    const content = await generateJson<ContentResponse>(prompt, CONTENT_SCHEMA);

    // PLAIN: Make sure title fits Pinterest's 100-char limit.
    // TECH:  Hard truncate; Pinterest API rejects oversized titles.
    const safeTitle = content.title.slice(0, 100);
    const safeDesc = content.description.slice(0, 500);
    const hashtagStr = content.hashtags
      .map((h) => h.replace(/^#/, ''))
      .join(' ');

    // PLAIN: Pick the image for the pin. Priority order:
    //   1. The actual product photo (from your library or Amazon CDN) —
    //      loads instantly, shows the real thing buyers will receive.
    //   2. AI-generated image via Pollinations — fallback if no product image.
    // TECH:  Pollinations is slow (15-30s first render), so we prefer the
    //        real product image. Phase 4 will add canvas-based pin design
    //        (product image + branded text overlay).
    const imageUrl = product.image_url
      ? product.image_url
      : buildPollinationsUrl(content.image_prompt);

    // PLAIN: Save the pin (image + copy) to the database.
    // TECH:  Insert into pins table linked to product_id.
    const { data: pin, error: pinErr } = await supabase
      .from('pins')
      .insert({
        product_id: productId,
        image_url: imageUrl,
        title: safeTitle,
        description: safeDesc,
        hashtags: hashtagStr,
      })
      .select()
      .single();

    if (pinErr || !pin) {
      throw new Error(`db insert failed: ${pinErr?.message}`);
    }

    await logEvent({
      runId,
      step: 'generate_content',
      status: 'success',
      message: `Generated pin: "${safeTitle}"`,
      payload: { pin, image_prompt: content.image_prompt },
    });

    return NextResponse.json({ pin });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await logEvent({
      runId,
      step: 'generate_content',
      status: 'failed',
      message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
