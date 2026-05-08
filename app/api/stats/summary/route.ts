// =============================================================================
// API ROUTE: GET /api/stats/summary
// =============================================================================
// PLAIN: One-call source of truth for the home dashboard:
//        - KPIs (niches, products, pins by status)
//        - Posts-by-source timeline (for the line chart)
//        - Queue breakdown (for the pie/donut chart)
//        - Recent activity (last 10 events)
//
// TECH:  Aggregates from multiple tables. Returns shape:
//        { kpis, postsBySource, queueBreakdown, recentActivity }
// =============================================================================

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface DailyPosts {
  date: string;
  amazon: number;
  flipkart: number;
  myntra: number;
  meesho: number;
}

export async function GET() {
  try {
    // -------------------------------------------------------------------
    // KPIs — total counts in parallel
    // -------------------------------------------------------------------
    const [
      { count: totalNiches },
      { count: totalProducts },
      { count: pendingPins },
      { count: approvedPins },
      { count: postedPins },
      { count: failedPins },
    ] = await Promise.all([
      supabase
        .from('trending_niches')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('product_library')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_review'),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'posted'),
      supabase
        .from('library_pins')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed'),
    ]);

    const kpis = {
      totalNiches: totalNiches ?? 0,
      totalProducts: totalProducts ?? 0,
      pendingPins: pendingPins ?? 0,
      approvedPins: approvedPins ?? 0,
      postedPins: postedPins ?? 0,
      failedPins: failedPins ?? 0,
    };

    // -------------------------------------------------------------------
    // POSTS BY SOURCE — last 14 days
    // -------------------------------------------------------------------
    // PLAIN: Each row in library_pins (status='posted') joined to its
    //        product → product source field. Group by date + source.
    // TECH:  Two queries: posted pins last 14d, and their product sources.
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: postedRows } = await supabase
      .from('library_pins')
      .select('posted_at, product_id, product_library(source)')
      .eq('status', 'posted')
      .gte('posted_at', fourteenDaysAgo.toISOString());

    // PLAIN: Build a 14-day grid filled with zeros, then merge in counts.
    // TECH:  ISO date-only key for grouping.
    const byDay = new Map<string, DailyPosts>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay.set(key, {
        date: key,
        amazon: 0,
        flipkart: 0,
        myntra: 0,
        meesho: 0,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (postedRows ?? []) as any[]) {
      if (!row.posted_at) continue;
      const dayKey = String(row.posted_at).slice(0, 10);
      const day = byDay.get(dayKey);
      if (!day) continue;

      // PLAIN: Source comes from the joined product. Default = amazon
      //        (current code only handles Amazon; future networks plug in).
      // TECH:  product_library.source values include 'manual', 'amazon_paapi',
      //        'ai_suggested', 'auto_extracted' — all are Amazon for now.
      const source = (row.product_library?.source ?? 'manual') as string;
      // PLAIN: Bucket all Amazon-related sources into 'amazon' for the chart.
      if (source === 'flipkart') day.flipkart += 1;
      else if (source === 'myntra') day.myntra += 1;
      else if (source === 'meesho') day.meesho += 1;
      else day.amazon += 1;
    }

    const postsBySource = Array.from(byDay.values());

    // -------------------------------------------------------------------
    // QUEUE BREAKDOWN — for pie chart
    // -------------------------------------------------------------------
    const queueBreakdown = [
      { status: 'Pending Review', count: kpis.pendingPins, color: '#d97706' },
      { status: 'Approved', count: kpis.approvedPins, color: '#4f46e5' },
      { status: 'Posted', count: kpis.postedPins, color: '#059669' },
      { status: 'Failed', count: kpis.failedPins, color: '#dc2626' },
    ].filter((s) => s.count > 0);

    // -------------------------------------------------------------------
    // RECENT ACTIVITY — last 10 library_pins by generated_at, joined
    // -------------------------------------------------------------------
    // PLAIN: Most recent pin events (generated/approved/posted) so the
    //        dashboard can show a live activity feed.
    // TECH:  Single SELECT ordered DESC; UI filters per-status if needed.
    const { data: activityRows } = await supabase
      .from('library_pins')
      .select(
        'id, title, status, generated_at, posted_at, product_library(title)'
      )
      .order('generated_at', { ascending: false })
      .limit(10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recentActivity = (activityRows ?? []).map((row: any) => ({
      id: row.id,
      pin_title: row.title,
      product_title: row.product_library?.title ?? 'Unknown product',
      status: row.status,
      timestamp: row.posted_at ?? row.generated_at,
    }));

    return NextResponse.json({
      kpis,
      postsBySource,
      queueBreakdown,
      recentActivity,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
