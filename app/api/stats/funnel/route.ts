// =============================================================================
// API ROUTE: GET /api/stats/funnel
// =============================================================================
// PLAIN: Returns the pipeline conversion funnel:
//          Products added → Pins generated → Approved → Posted
//        with counts at each stage and conversion percentages between stages.
//
// TECH:  Aggregates from product_library + library_pins. No PA-API needed.
// =============================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    // PLAIN: Run four counts in parallel for speed.
    // TECH:  count: 'exact' on a HEAD request — no rows transferred.
    const [
      { count: totalProducts },
      { count: totalPins },
      { count: approvedPins },
      { count: postedPins },
      { count: rejectedPins },
      { count: failedPins },
    ] = await Promise.all([
      supabase
        .from('product_library')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .in('status', ['approved', 'posted']),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted'),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'rejected'),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),
    ]);

    // PLAIN: Build the funnel stages with conversion rate compared to the
    //        FIRST stage (products). Each stage also shows its drop-off.
    // TECH:  Pure math; no DB write.
    const products = totalProducts ?? 0;
    const generated = totalPins ?? 0;
    const approved = approvedPins ?? 0;
    const posted = postedPins ?? 0;

    function pct(n: number, d: number): number {
      if (d === 0) return 0;
      return Math.round((n / d) * 100);
    }

    const funnel = [
      {
        stage: 'Products added',
        count: products,
        percent: 100,
        color: '#4f46e5',
      },
      {
        stage: 'Pins generated',
        count: generated,
        percent: pct(generated, products),
        color: '#7c3aed',
      },
      {
        stage: 'Approved',
        count: approved,
        percent: pct(approved, products),
        color: '#0891b2',
      },
      {
        stage: 'Posted to Pinterest',
        count: posted,
        percent: pct(posted, products),
        color: '#059669',
      },
    ];

    // PLAIN: Side-stats (rejections + failures help see where pins die).
    const sideStats = {
      rejected: rejectedPins ?? 0,
      failed: failedPins ?? 0,
      approvalRate: pct(approved, generated),
      postRate: pct(posted, approved),
    };

    return NextResponse.json({ funnel, sideStats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
