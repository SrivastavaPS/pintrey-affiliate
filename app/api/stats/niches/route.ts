// =============================================================================
// API ROUTE: GET /api/stats/niches
// =============================================================================
// PLAIN: Returns per-niche performance — how many products, pins, approved,
//        and posted for each active niche. Lets you see which niches your
//        pipeline is actually producing content for.
//
// TECH:  Three SELECTs (niches, products, library_pins), aggregated in JS.
//        Returns top N sorted by posted-count desc.
// =============================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface NichePerf {
  id: string;
  name: string;
  score: number | null;
  productCount: number;
  pinCount: number;
  approvedCount: number;
  postedCount: number;
  approvalRate: number;
}

export async function GET() {
  try {
    // PLAIN: 1. Active niches.
    const { data: niches } = await supabase
      .from('trending_niches')
      .select('id, name, score')
      .eq('is_active', true);

    // PLAIN: 2. Active products with their niche_id.
    const { data: products } = await supabase
      .from('product_library')
      .select('id, niche_id')
      .eq('is_active', true);

    // PLAIN: 3. Library pins with their product_id and status.
    const { data: pins } = await supabase
      .from('library_pins')
      .select('product_id, status');

    if (!niches) {
      return NextResponse.json({ niches: [] });
    }

    // PLAIN: Build maps for fast lookup.
    // TECH:  product_id → niche_id mapping; tally counts.
    const productToNiche = new Map<string, string | null>();
    for (const p of products ?? []) {
      productToNiche.set(p.id, p.niche_id);
    }

    // PLAIN: Initialise zero counters per niche.
    const perf = new Map<string, NichePerf>();
    for (const n of niches) {
      perf.set(n.id, {
        id: n.id,
        name: n.name,
        score: n.score,
        productCount: 0,
        pinCount: 0,
        approvedCount: 0,
        postedCount: 0,
        approvalRate: 0,
      });
    }

    // PLAIN: Count products per niche.
    for (const p of products ?? []) {
      if (p.niche_id && perf.has(p.niche_id)) {
        perf.get(p.niche_id)!.productCount += 1;
      }
    }

    // PLAIN: Count pins per niche (route through product_id).
    for (const pin of pins ?? []) {
      const nicheId = productToNiche.get(pin.product_id);
      if (!nicheId || !perf.has(nicheId)) continue;
      const row = perf.get(nicheId)!;
      row.pinCount += 1;
      if (pin.status === 'approved' || pin.status === 'posted') {
        row.approvedCount += 1;
      }
      if (pin.status === 'posted') {
        row.postedCount += 1;
      }
    }

    // PLAIN: Compute approval rate per niche.
    // TECH:  approved / pins. Zero pins → zero rate.
    for (const row of perf.values()) {
      row.approvalRate =
        row.pinCount === 0
          ? 0
          : Math.round((row.approvedCount / row.pinCount) * 100);
    }

    // PLAIN: Sort by posted count desc, fall back to product count.
    const sorted = Array.from(perf.values()).sort((a, b) => {
      if (b.postedCount !== a.postedCount)
        return b.postedCount - a.postedCount;
      if (b.approvedCount !== a.approvedCount)
        return b.approvedCount - a.approvedCount;
      return b.productCount - a.productCount;
    });

    return NextResponse.json({ niches: sorted });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
