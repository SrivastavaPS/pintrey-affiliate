// =============================================================================
// PAGE: / — Home dashboard (niche hierarchy view)
// =============================================================================
// PLAIN: New main dashboard. Shows the top trending niches and the products
//        you've collected under each one. Big "Discover niches" button kicks
//        off AI niche discovery. Each product card has placeholders for
//        Approve / Reject / Recreate (wired in Phase 2.3).
//
// TECH:  Client component. Fetches /api/dashboard on mount. Top-bar with
//        action buttons + grid of niche cards.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

// PLAIN: One product as the dashboard renders it.
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
    image_url: string;
    post_status: string | null;
    pin_url: string | null;
  } | null;
}

// PLAIN: One niche bucket with its products.
interface DashNiche {
  id: string;
  name: string;
  description: string | null;
  score: number | null;
  keywords: string | null;
  products: DashProduct[];
}

export default function HomePage() {
  // PLAIN: Niche+product tree from the dashboard API.
  const [niches, setNiches] = useState<DashNiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadDashboard();
  }, []);

  // PLAIN: Reload the dashboard data.
  // TECH:  GET /api/dashboard — single call returns the whole tree.
  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load dashboard');
      } else {
        setNiches(data.niches ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // PLAIN: Trigger AI to discover top 10 niches.
  // TECH:  POST /api/niches → upserts trending_niches → reload dashboard.
  async function discoverNiches() {
    setDiscovering(true);
    setError(null);
    try {
      const res = await fetch('/api/niches', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Discovery failed');
      } else {
        await loadDashboard();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDiscovering(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50">
      {/* HEADER */}
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Pintrey Affiliate
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Niche-by-niche overview of your automated Pinterest pipeline
            </p>
          </div>
          <nav className="flex gap-4 text-sm">
            <a href="/products/add" className="text-gray-600 hover:text-rose-600">
              Add product
            </a>
            <a href="/queue" className="text-gray-600 hover:text-rose-600">
              Queue
            </a>
            <a href="/poc" className="text-gray-600 hover:text-rose-600">
              Run POC
            </a>
            <a
              href="/pinterest/setup"
              className="text-gray-600 hover:text-rose-600"
            >
              Pinterest
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ACTION BAR */}
        <section className="mb-8 flex flex-wrap items-center gap-3">
          <button
            onClick={discoverNiches}
            disabled={discovering}
            className="rounded-lg bg-gradient-to-r from-rose-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow transition hover:scale-[1.02] disabled:opacity-50"
          >
            {discovering ? 'Discovering with AI…' : '✨ Discover top 10 niches'}
          </button>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow hover:bg-gray-50"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <span className="text-sm text-gray-500">
            {niches.length} niche{niches.length === 1 ? '' : 's'} ·{' '}
            {niches.reduce((sum, n) => sum + n.products.length, 0)} products
          </span>
        </section>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* EMPTY STATE */}
        {!loading && niches.length === 0 && (
          <section className="rounded-xl bg-white p-12 text-center shadow">
            <h2 className="text-xl font-semibold text-gray-700">
              No niches yet.
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Click <b>✨ Discover top 10 niches</b> above to let AI seed your
              dashboard.
            </p>
          </section>
        )}

        {/* NICHE LIST */}
        <div className="space-y-6">
          {niches.map((niche) => (
            <section
              key={niche.id}
              className="overflow-hidden rounded-xl bg-white shadow"
            >
              {/* NICHE HEADER */}
              <header className="flex items-start justify-between border-b border-gray-100 bg-gradient-to-r from-rose-50 to-indigo-50 p-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900">
                      {niche.name}
                    </h2>
                    {niche.score !== null && (
                      <span className="rounded-full bg-rose-100 px-3 py-0.5 text-xs font-semibold text-rose-700">
                        Score {niche.score}
                      </span>
                    )}
                    <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-700">
                      {niche.products.length} product
                      {niche.products.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  {niche.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {niche.description}
                    </p>
                  )}
                  {niche.keywords && (
                    <p className="mt-1 text-xs text-gray-400">
                      keywords: {niche.keywords}
                    </p>
                  )}
                </div>
                <a
                  href={`/products/add?niche=${encodeURIComponent(niche.id)}`}
                  className="ml-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow hover:bg-gray-50"
                >
                  + Add product
                </a>
              </header>

              {/* PRODUCT GRID */}
              {niche.products.length === 0 ? (
                <div className="p-6 text-sm italic text-gray-500">
                  No products in this niche yet. Click <b>+ Add product</b> to
                  paste an Amazon URL.
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                  {niche.products.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col rounded-lg border border-gray-200 p-3"
                    >
                      {/* PRODUCT IMAGE */}
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt={p.title}
                          className="h-40 w-full rounded object-contain"
                        />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center rounded bg-gray-50 text-xs text-gray-400">
                          No image
                        </div>
                      )}

                      {/* PRODUCT META */}
                      <div className="mt-2 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                          <a
                            href={p.affiliate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {p.title}
                          </a>
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {p.price ?? '—'} · {p.source}
                        </p>
                      </div>

                      {/* PIN STATUS */}
                      <div className="mt-3 border-t border-gray-100 pt-2">
                        {p.latest_pin ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="rounded bg-green-100 px-2 py-0.5 font-semibold text-green-700">
                              Pin: {p.latest_pin.post_status ?? 'generated'}
                            </span>
                            {p.latest_pin.pin_url && (
                              <a
                                href={p.latest_pin.pin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                view →
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs italic text-gray-400">
                            No pin yet (auto-generation in Phase 2.2)
                          </p>
                        )}

                        {/* ACTION BUTTONS (placeholders for Phase 2.3) */}
                        <div className="mt-2 flex gap-2 text-xs">
                          <button
                            disabled
                            className="rounded bg-gray-100 px-2 py-1 text-gray-400"
                            title="Coming in Phase 2.2 (auto pin generation)"
                          >
                            Create pin
                          </button>
                          <button
                            disabled
                            className="rounded bg-gray-100 px-2 py-1 text-gray-400"
                            title="Coming in Phase 2.3"
                          >
                            Approve
                          </button>
                          <button
                            disabled
                            className="rounded bg-gray-100 px-2 py-1 text-gray-400"
                            title="Coming in Phase 2.3"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {/* FOOTER */}
        <footer className="mt-12 border-t border-gray-200 pt-6 text-center text-xs text-gray-500">
          <a href="/privacy" className="hover:text-gray-700">
            Privacy
          </a>
          <span className="mx-2">·</span>
          <a href="/terms" className="hover:text-gray-700">
            Terms
          </a>
        </footer>
      </div>
    </main>
  );
}
