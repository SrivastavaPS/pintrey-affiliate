// =============================================================================
// PAGE: /products — niche-grouped product browser
// =============================================================================
// PLAIN: Browse your library by niche. Search box at top, click a niche
//        to expand its products. Each product shows pin status. All pin
//        management happens on /pin-manager.
//
// TECH:  Client component. Reads /api/dashboard for the niche tree.
// =============================================================================

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  PlusCircle,
  Sparkles,
  ShoppingCart,
  ChevronDown,
  ChevronRight,
  Trash2,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface DashProduct {
  id: string;
  asin: string;
  title: string;
  image_url: string | null;
  price: string | null;
  affiliate_url: string;
  niche_tags: string | null;
  source: string;
  created_at: string;
  latest_pin: {
    id: string;
    title: string;
    status: string;
    pin_url: string | null;
  } | null;
}

interface DashNiche {
  id: string;
  name: string;
  description: string | null;
  score: number | null;
  keywords: string | null;
  products: DashProduct[];
}

export default function ProductsPage() {
  const [niches, setNiches] = useState<DashNiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [expandedNiches, setExpandedNiches] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setNiches(data.niches ?? []);
    } catch (err) {
      toast.error('Failed to load products', {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function discoverNiches() {
    setDiscovering(true);
    try {
      const res = await fetch('/api/niches', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error('Niche discovery failed', { description: data.error });
      } else {
        toast.success(`Discovered ${data.niches?.length ?? 0} niches`);
        await load();
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDiscovering(false);
    }
  }

  async function deleteNiche(id: string, name: string) {
    if (!confirm(`Delete the niche "${name}"? Products under it become Uncategorised.`)) return;
    try {
      const res = await fetch(`/api/niches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Deleted "${name}"`);
        await load();
      } else {
        toast.error('Delete failed');
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function searchAmazonForNiche(niche: DashNiche) {
    const keywords = niche.keywords?.split(',')[0]?.trim() || niche.name;
    const tag = 'prakshita-21';
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(keywords)}&tag=${tag}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function toggleNiche(id: string) {
    setExpandedNiches((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // PLAIN: Filter niches+products by search query. A niche stays visible
  //        if its name matches OR any of its products' titles match.
  // TECH:  Lowercase compare; niche.products gets filtered too.
  const filteredNiches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return niches;
    return niches
      .map((n) => {
        const matchedProducts = n.products.filter((p) =>
          p.title.toLowerCase().includes(q)
        );
        const nicheMatches = n.name.toLowerCase().includes(q);
        if (nicheMatches || matchedProducts.length > 0) {
          return { ...n, products: nicheMatches ? n.products : matchedProducts };
        }
        return null;
      })
      .filter((n): n is DashNiche => n !== null);
  }, [niches, query]);

  const totalProducts = niches.reduce((s, n) => s + n.products.length, 0);

  return (
    <>
      <TopBar
        title="Products"
        subtitle={`${totalProducts} products across ${niches.length} niches`}
        actions={
          <>
            <Button
              variant="outline"
              size="md"
              onClick={discoverNiches}
              loading={discovering}
              icon={<Sparkles className="h-4 w-4" />}
            >
              Discover niches
            </Button>
            <Link href="/products/add">
              <Button variant="primary" size="md" icon={<PlusCircle className="h-4 w-4" />}>
                Add Product
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {/* SEARCH BAR */}
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search niches or products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* NICHE LIST */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : filteredNiches.length === 0 ? (
          <EmptyState
            icon={<Package className="h-5 w-5" />}
            title={query ? 'No matches' : 'No niches yet'}
            description={
              query
                ? 'Try a different search term.'
                : 'Click Discover niches above to seed your catalog.'
            }
            action={
              !query ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={discoverNiches}
                  loading={discovering}
                  icon={<Sparkles className="h-4 w-4" />}
                >
                  Discover top 10 niches
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {filteredNiches.map((niche) => (
              <NicheRow
                key={niche.id}
                niche={niche}
                expanded={expandedNiches.has(niche.id) || query.length > 0}
                onToggle={() => toggleNiche(niche.id)}
                onSearchAmazon={() => searchAmazonForNiche(niche)}
                onDelete={() => deleteNiche(niche.id, niche.name)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// =============================================================================
// CHILD COMPONENTS
// =============================================================================

function NicheRow({
  niche,
  expanded,
  onToggle,
  onSearchAmazon,
  onDelete,
}: {
  niche: DashNiche;
  expanded: boolean;
  onToggle: () => void;
  onSearchAmazon: () => void;
  onDelete: () => void;
}) {
  return (
    <Card>
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-5 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-start gap-3">
          {expanded ? (
            <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">
                {niche.name}
              </h3>
              {niche.score !== null && (
                <Badge variant="primary">Score {niche.score}</Badge>
              )}
              <Badge variant="neutral">
                {niche.products.length} product{niche.products.length === 1 ? '' : 's'}
              </Badge>
            </div>
            {niche.description && (
              <p className="mt-1 line-clamp-1 text-sm text-slate-500">
                {niche.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="outline"
            size="sm"
            onClick={onSearchAmazon}
            icon={<ShoppingCart className="h-3.5 w-3.5" />}
          >
            Search Amazon
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            icon={<Trash2 className="h-3.5 w-3.5" />}
          >
            Delete
          </Button>
        </div>
      </button>

      {expanded && (
        <CardContent className="pt-0">
          {niche.products.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm italic text-slate-500">
              No products in this niche yet. Use{' '}
              <strong>Search Amazon</strong> to find products, then{' '}
              <Link href="/products/add" className="text-indigo-600 hover:underline">
                Add Product
              </Link>{' '}
              to paste their URLs.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {niche.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ProductCard({ product }: { product: DashProduct }) {
  const pin = product.latest_pin;

  const pinBadge: { text: string; variant: 'success' | 'warning' | 'info' | 'danger' | 'neutral' } | null = (() => {
    if (!pin) return null;
    switch (pin.status) {
      case 'posted':
        return { text: 'Posted', variant: 'success' };
      case 'approved':
        return { text: 'Approved', variant: 'info' };
      case 'pending_review':
        return { text: 'Pending', variant: 'warning' };
      case 'rejected':
        return { text: 'Rejected', variant: 'neutral' };
      case 'failed':
        return { text: 'Failed', variant: 'danger' };
      default:
        return { text: pin.status, variant: 'neutral' };
    }
  })();

  return (
    <li className="flex flex-col rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300">
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.title}
          className="h-36 w-full rounded object-contain"
        />
      ) : (
        <div className="flex h-36 w-full items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
          No image
        </div>
      )}
      <div className="mt-2 min-h-[3rem] flex-1">
        <p className="line-clamp-2 text-sm font-medium text-slate-900">
          <a
            href={product.affiliate_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {product.title}
          </a>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {product.price ?? '—'} · {product.source}
        </p>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
        {pinBadge ? (
          <Badge variant={pinBadge.variant}>{pinBadge.text}</Badge>
        ) : (
          <span className="text-xs italic text-slate-400">No pin yet</span>
        )}
        <Link
          href="/pin-manager"
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          Manage →
        </Link>
      </div>
    </li>
  );
}
