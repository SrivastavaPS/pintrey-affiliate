// =============================================================================
// PAGE: /analytics — pipeline performance dashboard
// =============================================================================
// PLAIN: Shows the funnel (products → pins → approved → posted) plus a
//        leaderboard of which niches produce the most posted pins. Click-
//        through and revenue analytics will land in Phase 3.0.
// TECH:  Client component. Pulls /api/stats/funnel + /api/stats/niches.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Hammer,
  Trophy,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface FunnelStage {
  stage: string;
  count: number;
  percent: number;
  color: string;
}

interface FunnelData {
  funnel: FunnelStage[];
  sideStats: {
    rejected: number;
    failed: number;
    approvalRate: number;
    postRate: number;
  };
}

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

export default function AnalyticsPage() {
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [niches, setNiches] = useState<NichePerf[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [funnelRes, nichesRes] = await Promise.all([
        fetch('/api/stats/funnel'),
        fetch('/api/stats/niches'),
      ]);
      const funnelJson = await funnelRes.json();
      const nichesJson = await nichesRes.json();
      setFunnel(funnelJson);
      setNiches(nichesJson.niches ?? []);
    } catch (err) {
      toast.error('Failed to load analytics', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar
        title="Analytics"
        subtitle="Pipeline performance · per-niche leaderboard"
      />

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {/* PHASE 3 PLACEHOLDER NOTICE */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Hammer className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Click-through &amp; revenue analytics — Phase 3.0</p>
            <p className="mt-1 text-xs">
              The charts below show pipeline conversion data we can compute today.
              Adding tracking links + Amazon affiliate-report import (Phase 3.0)
              will unlock click-through rate, revenue per pin, and ROI per niche.
            </p>
          </div>
        </div>

        {/* SIDE STATS */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            label="Approval rate"
            value={loading ? null : `${funnel?.sideStats.approvalRate ?? 0}%`}
            hint="Approved / generated pins"
            color="indigo"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatTile
            label="Post rate"
            value={loading ? null : `${funnel?.sideStats.postRate ?? 0}%`}
            hint="Posted / approved pins"
            color="emerald"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatTile
            label="Rejected pins"
            value={loading ? null : funnel?.sideStats.rejected ?? 0}
            hint="Rejected during review"
            color="amber"
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <StatTile
            label="Failed gens"
            value={loading ? null : funnel?.sideStats.failed ?? 0}
            hint="AI generation errors"
            color="red"
            icon={<TrendingDown className="h-4 w-4" />}
          />
        </section>

        {/* FUNNEL CHART */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline funnel</CardTitle>
            <CardDescription>
              How products flow from library → generated pins → approved → posted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : !funnel || funnel.funnel.every((s) => s.count === 0) ? (
              <EmptyState
                icon={<BarChart3 className="h-5 w-5" />}
                title="No data yet"
                description="Add products and approve pins to see the funnel populate."
              />
            ) : (
              <FunnelChart data={funnel.funnel} />
            )}
          </CardContent>
        </Card>

        {/* NICHE LEADERBOARD */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top niches by posted pins
            </CardTitle>
            <CardDescription>
              Which niches your pipeline actually publishes most.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : !niches || niches.length === 0 ? (
              <EmptyState
                title="No niches yet"
                description="Discover niches and add products to populate this leaderboard."
              />
            ) : (
              <NicheLeaderboard niches={niches.slice(0, 10)} />
            )}
          </CardContent>
        </Card>

        {/* PHASE 3 ROADMAP */}
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s next in analytics</CardTitle>
            <CardDescription>Coming in Phase 3.0.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <li className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">Click-through tracking</p>
                <p className="mt-1 text-xs text-slate-500">
                  Redirect URLs (/r/[id]) log every click before bouncing to Amazon.
                </p>
              </li>
              <li className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">Revenue per pin</p>
                <p className="mt-1 text-xs text-slate-500">
                  Upload monthly Amazon affiliate report → match to clicks.
                </p>
              </li>
              <li className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">Per-niche ROI</p>
                <p className="mt-1 text-xs text-slate-500">
                  AI cost vs revenue, broken down by niche.
                </p>
              </li>
              <li className="rounded-lg border border-slate-200 p-3">
                <p className="font-semibold text-slate-900">Time-of-day insights</p>
                <p className="mt-1 text-xs text-slate-500">
                  When are pins most clicked? Schedule posts at peak times.
                </p>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// =============================================================================
// CHILD COMPONENTS
// =============================================================================

function StatTile({
  label,
  value,
  hint,
  color,
  icon,
}: {
  label: string;
  value: string | number | null;
  hint: string;
  color: 'indigo' | 'emerald' | 'amber' | 'red';
  icon: React.ReactNode;
}) {
  const palette = {
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }[color];

  return (
    <Card>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${palette}`}>
            {icon}
          </div>
        </div>
        {value === null ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        )}
        <p className="text-[10px] text-slate-400">{hint}</p>
      </div>
    </Card>
  );
}

function FunnelChart({ data }: { data: FunnelStage[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 30, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          dataKey="stage"
          type="category"
          tick={{ fill: '#475569', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, _name: any, props: any) => [
            `${value} (${props?.payload?.percent ?? 0}%)`,
            'Count',
          ]}
        />
        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
          {data.map((stage, idx) => (
            <Cell key={idx} fill={stage.color} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            fill="#0f172a"
            fontSize={12}
            fontWeight={600}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function NicheLeaderboard({ niches }: { niches: NichePerf[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {niches.map((n, idx) => (
        <li key={n.id} className="flex items-center gap-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
            {idx + 1}
          </div>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-medium text-slate-900">
              {n.name}
            </p>
            <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10px]">
              <Badge variant="neutral">{n.productCount} products</Badge>
              <Badge variant="primary">{n.pinCount} pins</Badge>
              <Badge variant="info">{n.approvedCount} approved</Badge>
              <Badge variant="success">{n.postedCount} posted</Badge>
              {n.approvalRate > 0 && (
                <Badge variant="warning">{n.approvalRate}% approval</Badge>
              )}
            </div>
          </div>
          {n.score !== null && (
            <Badge variant="neutral">Score {n.score}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
