// =============================================================================
// PAGE: / — Home Dashboard
// =============================================================================
// PLAIN: KPI cards + 2 charts (posts by source, queue breakdown) +
//        recent activity feed. Top-bar quick actions to add a product or
//        run the POC.
// TECH:  Client component. Pulls /api/stats/summary on mount + auto-refresh
//        every 60s.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Compass,
  Package,
  Clock,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  Sparkles,
  ListChecks,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface Kpis {
  totalNiches: number;
  totalProducts: number;
  pendingPins: number;
  approvedPins: number;
  postedPins: number;
  failedPins: number;
}

interface DailyPosts {
  date: string;
  amazon: number;
  flipkart: number;
  myntra: number;
  meesho: number;
}

interface QueueSlice {
  status: string;
  count: number;
  color: string;
}

interface ActivityRow {
  id: string;
  pin_title: string;
  product_title: string;
  status: string;
  timestamp: string;
}

interface StatsResponse {
  kpis: Kpis;
  postsBySource: DailyPosts[];
  queueBreakdown: QueueSlice[];
  recentActivity: ActivityRow[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    try {
      const res = await fetch('/api/stats/summary');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load stats');
      } else {
        setStats(data);
        setError(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="Overview of your Pinterest affiliate pipeline"
        actions={
          <>
            <Link href="/poc">
              <Button variant="ghost" size="md" icon={<Sparkles className="h-4 w-4" />}>
                Run POC
              </Button>
            </Link>
            <Link href="/products/add">
              <Button variant="primary" size="md" icon={<PlusCircle className="h-4 w-4" />}>
                Add Product
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* KPI ROW */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Trending niches"
            value={loading ? null : stats?.kpis.totalNiches ?? 0}
            icon={<Compass className="h-5 w-5" />}
            color="indigo"
          />
          <KpiCard
            label="Products in library"
            value={loading ? null : stats?.kpis.totalProducts ?? 0}
            icon={<Package className="h-5 w-5" />}
            color="rose"
          />
          <KpiCard
            label="Awaiting review"
            value={loading ? null : stats?.kpis.pendingPins ?? 0}
            icon={<Clock className="h-5 w-5" />}
            color="amber"
            href="/pin-manager"
          />
          <KpiCard
            label="Posted to Pinterest"
            value={loading ? null : stats?.kpis.postedPins ?? 0}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="emerald"
          />
        </section>

        {/* CHARTS ROW */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* POSTS BY SOURCE — line chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Posts by source · last 14 days</CardTitle>
              <CardDescription>
                Pins posted to Pinterest, grouped by affiliate network.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <PostsBySourceChart data={stats?.postsBySource ?? []} />
              )}
            </CardContent>
          </Card>

          {/* QUEUE BREAKDOWN — donut chart */}
          <Card>
            <CardHeader>
              <CardTitle>Pin queue</CardTitle>
              <CardDescription>Current pipeline state.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-64 w-full" />
              ) : (stats?.queueBreakdown ?? []).length === 0 ? (
                <EmptyState
                  icon={<ListChecks className="h-5 w-5" />}
                  title="No pins yet"
                  description="Add a product to generate your first pin."
                />
              ) : (
                <QueueDonutChart data={stats?.queueBreakdown ?? []} />
              )}
            </CardContent>
          </Card>
        </section>

        {/* RECENT ACTIVITY */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>
                Latest pin events from across your library.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (stats?.recentActivity ?? []).length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  description="Once pins start generating, you'll see them here."
                  action={
                    <Link href="/products/add">
                      <Button variant="primary" size="sm" icon={<PlusCircle className="h-4 w-4" />}>
                        Add your first product
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {(stats?.recentActivity ?? []).map((row) => (
                    <ActivityRowItem key={row.id} row={row} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  );
}

// =============================================================================
// CHILD COMPONENTS
// =============================================================================

function KpiCard({
  label,
  value,
  icon,
  color,
  href,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
  color: 'indigo' | 'rose' | 'amber' | 'emerald';
  href?: string;
}) {
  const palette = {
    indigo: 'bg-indigo-50 text-indigo-700',
    rose: 'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  }[color];

  const inner = (
    <Card className={`transition-all ${href ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''}`}>
      <div className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
          {value === null ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {value.toLocaleString()}
            </p>
          )}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${palette}`}>
          {icon}
        </div>
      </div>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function PostsBySourceChart({ data }: { data: DailyPosts[] }) {
  // PLAIN: Format the date label so the X-axis shows "Mon 12" instead of ISO.
  const display = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={display} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="amazonFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Area
          type="monotone"
          dataKey="amazon"
          name="Amazon"
          stroke="#4f46e5"
          strokeWidth={2}
          fill="url(#amazonFill)"
        />
        {/* Other affiliates land here as we add them. */}
        <Area type="monotone" dataKey="flipkart" name="Flipkart" stroke="#f59e0b" strokeWidth={2} fillOpacity={0} />
        <Area type="monotone" dataKey="myntra" name="Myntra" stroke="#ec4899" strokeWidth={2} fillOpacity={0} />
        <Area type="monotone" dataKey="meesho" name="Meesho" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function QueueDonutChart({ data }: { data: QueueSlice[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="count"
            nameKey="status"
          >
            {data.map((slice, i) => (
              <Cell key={i} fill={slice.color} stroke="white" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[64px] flex flex-col items-center">
        <p className="text-2xl font-semibold text-slate-900">{total}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-500">total</p>
      </div>
    </div>
  );
}

function ActivityRowItem({ row }: { row: ActivityRow }) {
  const timeAgo = formatRelativeTime(row.timestamp);
  const variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral' = (() => {
    switch (row.status) {
      case 'posted':
        return 'success';
      case 'approved':
        return 'info';
      case 'pending_review':
        return 'warning';
      case 'rejected':
      case 'failed':
        return 'danger';
      default:
        return 'neutral';
    }
  })();

  const label = (() => {
    switch (row.status) {
      case 'posted':
        return 'Posted';
      case 'approved':
        return 'Approved';
      case 'pending_review':
        return 'Pending';
      case 'rejected':
        return 'Rejected';
      case 'failed':
        return 'Failed';
      default:
        return row.status;
    }
  })();

  return (
    <li className="flex items-center justify-between py-3">
      <div className="flex min-w-0 items-center gap-3">
        <Badge variant={variant}>{label}</Badge>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {row.pin_title}
          </p>
          <p className="truncate text-xs text-slate-500">{row.product_title}</p>
        </div>
      </div>
      <span className="ml-4 shrink-0 text-xs text-slate-400">{timeAgo}</span>
    </li>
  );
}

// PLAIN: Returns a friendly relative timestamp like "5m ago" or "2h ago".
// TECH:  No date-fns; minimal helper for the activity feed.
function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const m = Math.floor(diffMs / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

// PLAIN: Suppress unused-import warning for ArrowRight used in card hover styling.
// TECH:  Keep it imported so future iterations can wire it to KpiCard.
void ArrowRight;
