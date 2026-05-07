// =============================================================================
// PAGE: / — Home dashboard (niche hierarchy view)
// =============================================================================
// PLAIN: Dashboard purpose: see what's in your library, organised by niche.
//        Pin actions (approve/reject/regenerate/post) live on /queue.
//        Each product card just shows the latest pin's STATUS + a link to
//        /queue. Cleaner separation of concerns.
//
// TECH:  Client component. Single /api/dashboard fetch. No pin mutations
//        from this page — those go through /queue.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

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
    image_url: string | null;
    status: string;
    pin_url: string | null;
    generated_at: string;
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

const TOP_N_NICHES = 10;

export default function HomePage() {
  const [niches, setNiches] = useState<DashNiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // PLAIN: Set of product IDs whose pin is being created right now.
  // TECH:  Disables the "Create pin" button while a request is in flight.
  const [creatingPin, setCreatingPin] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadDashboard();
  }, []);

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

  async function deleteNiche(id: string, name: string) {
    if (!confirm(`Delete the niche "${name}"? Products under it will become Uncategorised.`)) return;
    try {
      const res = await fetch(`/api/niches/${id}`, { method: 'DELETE' });
      if (res.ok) await loadDashboard();
    } catch {
      // PLAIN: Silent — user can retry.
    }
  }

  // PLAIN: Manually trigger pin generation for a product without a pin.
  //        (Background trigger may have failed; this is the manual retry.)
  // TECH:  POST /api/pins/generate; refresh dashboard on success.
  async function createPin(productId: string) {
    setCreatingPin((s) => new Set(s).add(productId));
    try {
      const res = await fetch('/api/pins/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (res.ok) await loadDashboard();
    } catch {
      // PLAIN: Silent — user can retry.
    } finally {
      setCreatingPin((s) => {
        const next = new Set(s);
        next.delete(productId);
        return next;
      });
    }
  }

  function searchAmazonForNiche(niche: DashNiche) {
    const keywords = niche.keywords?.split(',')[0]?.trim() || niche.name;
    const tag = 'prakshita-21';
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(keywords)}&tag=${tag}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  const displayedNiches = [...niches]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, showAll ? niches.length : TOP_N_NICHES);

  const hiddenCount = niches.length - displayedNiches.length;
  const totalProducts = niches.reduce((s, n) => s + n.products.length, 0);
  const pinsPending = niches
    .flatMap((n) => n.products)
    .filter((p) => p.latest_pin?.status === 'pending_review').length;

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Pintrey Affiliate
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Top {TOP_N_NICHES} niches · click any to add real Amazon products
            </p>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/queue" className="text-gray-600 hover:text-rose-600">
              Queue
              {pinsPending > 0 && (
                <span className="ml-1 rounded-full bg-yellow-200 px-2 text-[10px] font-bold text-yellow-800">
                  {pinsPending}
                </span>
              )}
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
            <a
              href="/products/add"
              className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white shadow hover:bg-rose-700"
            >
              + Add product
            </a>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
          <a
            href="/niches/cleanup"
            className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow hover:bg-gray-50"
            title="Find duplicate niches and merge them"
          >
            🧹 Clean up
          </a>
          <span className="text-sm text-gray-500">
            Showing {displayedNiches.length} of {niches.length} niche
            {niches.length === 1 ? '' : 's'} · {totalProducts} products
          </span>
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              Show all {niches.length}
            </button>
          )}
          {showAll && (
            <button
              onClick={() => setShowAll(false)}
              className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-200"
            >
              Show top {TOP_N_NICHES}
            </button>
          )}
        </section>

        {pinsPending > 0 && (
          <div className="mb-6 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800">
            <b>{pinsPending}</b> pin{pinsPending === 1 ? '' : 's'} awaiting your
            review.{' '}
            <a href="/queue" className="font-semibold underline">
              Open queue →
            </a>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

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

        <div className="space-y-6">
          {displayedNiches.map((niche) => (
            <section
              key={niche.id}
              className="overflow-hidden rounded-xl bg-white shadow"
            >
              <header className="border-b border-gray-100 bg-gradient-to-r from-rose-50 to-indigo-50 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
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
                      <p className="mt-2 text-xs">
                        <span className="font-semibold text-gray-500">
                          Search keywords:{' '}
                        </span>
                        <span className="text-gray-600">{niche.keywords}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => searchAmazonForNiche(niche)}
                      className="whitespace-nowrap rounded-lg bg-yellow-400 px-3 py-2 text-xs font-semibold text-gray-900 shadow hover:bg-yellow-500"
                    >
                      🛒 Search Amazon
                    </button>
                    <button
                      onClick={() => deleteNiche(niche.id, niche.name)}
                      className="whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow hover:bg-red-50"
                    >
                      ✕ Delete niche
                    </button>
                  </div>
                </div>

                {/* AI SUGGESTIONS PANEL */}
                <SuggestionsPanel nicheId={niche.id} nicheName={niche.name} />
              </header>

              {niche.products.length === 0 ? (
                <div className="p-6 text-sm italic text-gray-500">
                  No products in this niche yet. Use{' '}
                  <b>🛒 Search Amazon</b> to find products, then{' '}
                  <b>+ Add product</b> at the top.
                </div>
              ) : (
                <ul className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                  {niche.products.map((p) => (
                    <li
                      key={p.id}
                      className="flex flex-col rounded-lg border border-gray-200 p-3"
                    >
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

                      <PinStatusRow
                        product={p}
                        creating={creatingPin.has(p.id)}
                        onCreate={() => createPin(p.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

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

// =============================================================================
// CHILD: PinStatusRow
// =============================================================================
// PLAIN: Renders pin status for a product card. No action buttons here —
//        all pin management happens on /queue.
// TECH:  Three states: no pin (show Create button), has pin (show status
//        badge + link to /queue).
// =============================================================================
function PinStatusRow({
  product,
  creating,
  onCreate,
}: {
  product: DashProduct;
  creating: boolean;
  onCreate: () => void;
}) {
  const pin = product.latest_pin;

  if (!pin) {
    return (
      <div className="mt-3 border-t border-gray-100 pt-2">
        <p className="text-xs italic text-gray-400">
          {creating ? 'Generating pin…' : 'No pin yet'}
        </p>
        <button
          onClick={onCreate}
          disabled={creating}
          className="mt-2 rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:bg-gray-400"
        >
          {creating ? '…' : '✨ Create pin'}
        </button>
      </div>
    );
  }

  const badge = (() => {
    switch (pin.status) {
      case 'pending_review':
        return { text: 'Awaiting review', cls: 'bg-yellow-100 text-yellow-800' };
      case 'approved':
        return { text: 'Approved', cls: 'bg-blue-100 text-blue-800' };
      case 'rejected':
        return { text: 'Rejected', cls: 'bg-gray-200 text-gray-600' };
      case 'posted':
        return { text: 'Posted', cls: 'bg-green-100 text-green-800' };
      case 'failed':
        return { text: 'Failed', cls: 'bg-red-100 text-red-700' };
      default:
        return { text: pin.status, cls: 'bg-gray-100 text-gray-700' };
    }
  })();

  return (
    <div className="mt-3 border-t border-gray-100 pt-2">
      <div className="flex items-center justify-between">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badge.cls}`}>
          {badge.text}
        </span>
        {pin.pin_url ? (
          <a
            href={pin.pin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            view live →
          </a>
        ) : (
          <a
            href="/queue"
            className="text-xs text-rose-600 hover:underline"
          >
            manage in queue →
          </a>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// CHILD: SuggestionsPanel
// =============================================================================
// PLAIN: Per-niche AI suggestions panel. Lazy-loads on first expand. Each
//        suggestion is a name + brand + price hint + "Search Amazon" button.
//        User searches → finds real product → adds via /products/add → comes
//        back here and clicks "Mark added".
// TECH:  Self-contained: fetches /api/niches/<id>/suggestions on demand.
// =============================================================================

interface Suggestion {
  id: string;
  product_name: string;
  brand: string | null;
  approximate_price: string | null;
  why_relevant: string | null;
  search_query: string;
  status: string;
}

function SuggestionsPanel({
  nicheId,
  nicheName,
}: {
  nicheId: string;
  nicheName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  // PLAIN: Lazy-load suggestions when the user expands the panel.
  // TECH:  Triggers GET /api/niches/<id>/suggestions on first open.
  async function loadSuggestions() {
    setLoading(true);
    try {
      const res = await fetch(`/api/niches/${nicheId}/suggestions`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      // PLAIN: Silent — user can hit refresh.
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  // PLAIN: Click "Generate ideas" → AI brainstorms 10 products.
  // TECH:  POST /api/niches/<id>/suggestions; replaces existing pending list.
  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/niches/${nicheId}/suggestions`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.suggestions) setSuggestions(data.suggestions);
    } catch {
      // PLAIN: Silent.
    } finally {
      setGenerating(false);
    }
  }

  // PLAIN: Mark a suggestion as added (user has added the real product).
  // TECH:  PATCH; refresh list afterwards.
  async function markAdded(id: string) {
    setBusyIds((s) => new Set(s).add(id));
    try {
      await fetch(`/api/niches/${nicheId}/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'added' }),
      });
      await loadSuggestions();
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  // PLAIN: Dismiss a suggestion (user not interested).
  async function dismiss(id: string) {
    setBusyIds((s) => new Set(s).add(id));
    try {
      await fetch(`/api/niches/${nicheId}/suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      });
      await loadSuggestions();
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }
  }

  // PLAIN: Open Amazon India search in a new tab using the suggestion's query.
  function searchAmazon(query: string) {
    const tag = 'prakshita-21';
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&tag=${tag}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // PLAIN: Toggle panel open/closed; load on first expand.
  function toggle() {
    if (!open && suggestions === null) {
      void loadSuggestions();
    }
    setOpen(!open);
  }

  const pending = (suggestions ?? []).filter((s) => s.status === 'pending');

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between text-left text-sm font-semibold text-purple-700 hover:text-purple-900"
      >
        <span>
          ✨ AI product suggestions for &quot;{nicheName}&quot;
          {pending.length > 0 && (
            <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-bold">
              {pending.length}
            </span>
          )}
        </span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* GENERATE BUTTON */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={generate}
              disabled={generating}
              className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:bg-gray-400"
            >
              {generating
                ? 'Brainstorming…'
                : suggestions && suggestions.length > 0
                  ? '↻ Regenerate ideas'
                  : '✨ Generate 10 product ideas'}
            </button>
            <span className="text-xs text-gray-500">
              AI proposes specific Amazon India products. You search →
              verify → paste URL into <a href="/products/add" className="underline">/products/add</a>.
            </span>
          </div>

          {/* SUGGESTIONS LIST */}
          {loading && (
            <p className="text-xs italic text-gray-500">Loading…</p>
          )}

          {!loading && suggestions !== null && suggestions.length === 0 && (
            <p className="rounded bg-gray-50 p-3 text-xs italic text-gray-500">
              No suggestions yet. Click <b>✨ Generate 10 product ideas</b> above.
            </p>
          )}

          {pending.length > 0 && (
            <ul className="space-y-2">
              {pending.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-purple-100 bg-purple-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {s.product_name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {s.brand && <span className="font-semibold">{s.brand}</span>}
                        {s.brand && s.approximate_price && ' · '}
                        {s.approximate_price}
                      </p>
                      {s.why_relevant && (
                        <p className="mt-1 text-xs italic text-gray-500">
                          {s.why_relevant}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        onClick={() => searchAmazon(s.search_query)}
                        className="rounded bg-yellow-400 px-2.5 py-1 text-[11px] font-semibold text-gray-900 hover:bg-yellow-500"
                      >
                        🛒 Search Amazon
                      </button>
                      <button
                        onClick={() => markAdded(s.id)}
                        disabled={busyIds.has(s.id)}
                        className="rounded bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-700 disabled:bg-gray-300"
                      >
                        ✓ Mark added
                      </button>
                      <button
                        onClick={() => dismiss(s.id)}
                        disabled={busyIds.has(s.id)}
                        className="rounded bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-100 disabled:bg-gray-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
