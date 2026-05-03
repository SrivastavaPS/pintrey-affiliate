// =============================================================================
// API ROUTE: GET /api/niches  +  POST /api/niches
// =============================================================================
// PLAIN: Two endpoints:
//        - GET  → list all trending niches (for the dashboard)
//        - POST → ask AI to discover top 10 trending niches and save them
//
// TECH:  Read = simple SELECT. Discovery = Groq call with structured output,
//        UPSERT by name so re-running just refreshes scores/descriptions
//        without creating duplicates.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { generateJson, SchemaType } from '@/lib/groq';

// =============================================================================
// GET /api/niches — list all niches (with product counts)
// =============================================================================
// PLAIN: Returns every saved niche, plus a count of how many products are
//        in each one. Sorted by score (best first).
// TECH:  Two-step: SELECT niches, then SELECT counts grouped by niche_id,
//        then merge in JS. Could use a Postgres view for efficiency later.
// =============================================================================
export async function GET() {
  // PLAIN: 1. Get all active niches sorted by score.
  // TECH:  Standard SELECT.
  const { data: niches, error: nicheErr } = await supabase
    .from('trending_niches')
    .select('*')
    .eq('is_active', true)
    .order('score', { ascending: false });

  if (nicheErr) {
    return NextResponse.json({ error: nicheErr.message }, { status: 500 });
  }

  // PLAIN: 2. Get product counts grouped by niche_id.
  // TECH:  We can't easily do GROUP BY via Supabase client, so we fetch the
  //        IDs and tally in JS. For ~10 niches × 50 products it's fine.
  const { data: products } = await supabase
    .from('product_library')
    .select('niche_id')
    .eq('is_active', true);

  const counts = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.niche_id) {
      counts.set(p.niche_id, (counts.get(p.niche_id) ?? 0) + 1);
    }
  }

  // PLAIN: Merge counts into the niche list.
  // TECH:  Decorate each niche row with productCount.
  const enriched = (niches ?? []).map((n) => ({
    ...n,
    productCount: counts.get(n.id) ?? 0,
  }));

  return NextResponse.json({ niches: enriched });
}


// =============================================================================
// POST /api/niches — discover trending niches via AI
// =============================================================================
// PLAIN: Click "Discover niches" → AI returns 10 trending Pinterest niches
//        for the Indian market → we UPSERT them into trending_niches.
// TECH:  Single Groq call with structured output. UPSERT on UNIQUE name so
//        repeat discoveries refresh scores instead of duplicating rows.
// =============================================================================

interface DiscoveredNiche {
  name: string;
  description: string;
  score: number;
  keywords: string[];
}

interface DiscoveryResponse {
  niches: DiscoveredNiche[];
}

// PLAIN: Schema we force the AI to follow.
// TECH:  Array of objects with name/description/score/keywords.
const DISCOVERY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    niches: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: {
            type: SchemaType.STRING,
            description: 'Short niche name, 2-4 words, e.g., "Korean skincare"',
          },
          description: {
            type: SchemaType.STRING,
            description:
              'One sentence about why this niche is trending RIGHT NOW',
          },
          score: {
            type: SchemaType.NUMBER,
            description: 'Confidence 0-100 that this niche will earn money',
          },
          keywords: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description: '5-8 search keywords for finding products in this niche',
          },
        },
        required: ['name', 'description', 'score', 'keywords'],
      },
    },
  },
  required: ['niches'],
} as const;

export async function POST(_req: NextRequest) {
  try {
    // PLAIN: Ask the AI for 10 trending niches.
    // TECH:  Single structured Groq call.
    const prompt = `
You are an expert affiliate marketer building a Pinterest content strategy
for the Indian market. Generate the TOP 10 niches that:

1. Have strong search intent on Pinterest in India RIGHT NOW.
2. Have abundant products on Amazon India in the ₹500-₹5000 price range.
3. Have visual appeal (photogenic products that look good in pin images).
4. Are NOT oversaturated (avoid: "phone cases", "basic clothing", "generic gadgets").
5. Have clear buyer intent (people Pinterest these to BUY, not just to admire).

Examples of GOOD niches:
- "Korean skincare under 1500"
- "Vastu home decor"
- "Indoor plant stands"
- "Boho aesthetic bedroom"
- "Pre-wedding gifts"
- "Minimalist desk setup"
- "Ayurvedic haircare"
- "Sustainable living kitchen"

For each niche, provide:
- name: short, specific, 2-4 words
- description: ONE sentence about why this is trending
- score: 0-100 confidence
- keywords: 5-8 search terms used to find products in this niche

Return JSON: { niches: [...] } with EXACTLY 10 niches.
    `.trim();

    const result = await generateJson<DiscoveryResponse>(prompt, DISCOVERY_SCHEMA);

    if (!Array.isArray(result.niches) || result.niches.length === 0) {
      return NextResponse.json(
        { error: 'AI returned no niches' },
        { status: 500 }
      );
    }

    // PLAIN: UPSERT each niche by name. New ones get inserted, existing
    //        ones get their score/description/keywords refreshed.
    // TECH:  ON CONFLICT (name) DO UPDATE — relies on UNIQUE constraint.
    const rows = result.niches.map((n) => ({
      name: n.name.toLowerCase().trim(),
      description: n.description,
      score: Math.min(100, Math.max(0, Math.round(n.score))),
      keywords: Array.isArray(n.keywords) ? n.keywords.join(', ') : null,
    }));

    const { data, error } = await supabase
      .from('trending_niches')
      .upsert(rows, { onConflict: 'name' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ niches: data ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
