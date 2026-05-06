// =============================================================================
// PAGE: / — Home dashboard (niche hierarchy view)
// =============================================================================
// PLAIN: The main dashboard. Shows TOP 10 niches by score, with the products
//        you've collected under each one. One "Add product" button at the
//        top right (no per-niche button). Each niche has a "Search Amazon"
//        button using the niche's keywords + a delete button.
// TECH:  Client component. Fetches /api/dashboard on mount. Pagination of
//        niches done client-side after sort by score DESC.
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
    description: string | null;
    hashtags: string | null;
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

// PLAIN: How many niches to show on the dashboard before "show all" button.
// TECH:  Limit applied client-side; server returns all niches.
const TOP_N_NICHES = 10;

export default function HomePage() {
  const [niches, setNiches] = useState<DashNiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PLAIN: When true, show ALL niches instead of just top 10.
  // TECH:  Toggle via "show all N" / "show top 10" button.
  const [showAll, setShowAll] = useState(false);

  // PLAIN: Set of product IDs currently being acted on (generating / approving
  //        / rejecting / regenerating). Disables their buttons until done.
  // TECH:  Set semantics for O(1) presence checks; new Set per change so
  //        React re-renders.
  const [busyProductIds, setBusyProductIds] = useState<Set<string>>(new Set());

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

  // PLAIN: Permanently remove a niche. Products under it become "Uncategorised".
  // TECH:  DELETE /api/niches/<id>; trending_niches FK has ON DELETE SET NULL
  //        on product_library.niche_id, so products keep existing.
  async function deleteNiche(id: string, name: string) {
    if (!confirm(`Delete the niche "${name}"? Products under it will become Uncategorised.`)) return;
    try {
      const res = await fetch(`/api/niches/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await loadDashboard();
      }
    } catch {
      // PLAIN: Silent — user can retry.
    }
  }

  // PLAIN: Marks a product as "busy" (button disabled, spinner showing).
  // TECH:  Helper for the action handlers below.
  function setBusy(productId: string, busy: boolean) {
    setBusyProductIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }

  // PLAIN: User clicked "Create pin" on a product without a pin yet.
  // TECH:  POST /api/pins/generate with productId; reload dashboard on success.
  async function handleCreatePin(productId: string) {
    setBusy(productId, true);
    try {
      await fetch('/api/pins/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      await loadDashboard();
    } catch {
      // PLAIN: Silent — user can retry.
    } finally {
      setBusy(productId, false);
    }
  }

  // PLAIN: User clicked "Approve" — pin moves to /queue for posting.
  // TECH:  PATCH /api/pins/<id> with status='approved'.
  async function handleApprove(pinId: string, productId: string) {
    setBusy(productId, true);
    try {
      await fetch(`/api/pins/${pinId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      await loadDashboard();
    } catch {
      // PLAIN: Silent — user can retry.
    } finally {
      setBusy(productId, false);
    }
  }

  // PLAIN: User clicked "Reject" — soft-delete the pin (kept for analytics).
  // TECH:  PATCH /api/pins/<id> with status='rejected'.
  async function handleReject(pinId: string, productId: string) {
    setBusy(productId, true);
    try {
      await fetch(`/api/pins/${pinId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' }),
      });
      await loadDashboard();
    } catch {
      // PLAIN: Silent — user can retry.
    } finally {
      setBusy(productId, false);
    }
  }

  // PLAIN: User clicked "Recreate" — delete current pin + generate fresh.
  // TECH:  POST /api/pins/<id>/regenerate; new pin appears with status=pending_review.
  async function handleRegenerate(pinId: string, productId: string) {
    setBusy(productId, true);
    try {
      await fetch(`/api/pins/${pinId}/regenerate`, { method: 'POST' });
      await loadDashboard();
    } catch {
      // PLAIN: Silent — user can retry.
    } finally {
      setBusy(productId, false);
    }
  }

  // PLAIN: Open Amazon India search in a new tab using the niche's keywords.
  // TECH:  Opens https://www.amazon.in/s?k=<keywords>&tag=<store>; user's
  //        affiliate tag is attached so any purchase still pays commission.
  function searchAmazonForNiche(niche: DashNiche) {
    const keywords = niche.keywords?.split(',')[0]?.trim() || niche.name;
    const tag = 'prakshita-21';
    const url = `https://www.amazon.in/s?k=${encodeURIComponent(keywords)}&tag=${tag}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // PLAIN: Decide which niches to render. Always sort by score DESC; cap to
  //        top 10 unless user clicked "show all".
  // TECH:  Defensive copy; doesn't mutate the niches state array.
  const displayedNiches = [...niches]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, showAll ? niches.length : TOP_N_NICHES);

  const hiddenCount = niches.length - displayedNiches.length;

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
            {/* PLAIN: Single primary CTA for adding a product. */}
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
          <span className="text-sm text-gray-500">
            Showing {displayedNiches.length} of {niches.length} niche
            {niches.length === 1 ? '' : 's'} ·{' '}
            {niches.reduce((sum, n) => sum + n.products.length, 0)} products
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

        {/* NICHE LIST */}
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

                  {/* NICHE ACTION BUTTONS */}
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => searchAmazonForNiche(niche)}
                      className="whitespace-nowrap rounded-lg bg-yellow-400 px-3 py-2 text-xs font-semibold text-gray-900 shadow hover:bg-yellow-500"
                      title="Open Amazon India search using this niche's keywords"
                    >
                      🛒 Search Amazon
                    </button>
                    <button
                      onClick={() => deleteNiche(niche.id, niche.name)}
                      className="whitespace-nowrap rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow hover:bg-red-50"
                      title="Delete this niche (products keep existing as Uncategorised)"
                    >
                      ✕ Delete niche
                    </button>
                  </div>
                </div>
              </header>

              {niche.products.length === 0 ? (
                <div className="p-6 text-sm italic text-gray-500">
                  No products in this niche yet. Use{' '}
                  <b>🛒 Search Amazon</b> to find products, then{' '}
                  <b>+ Add product</b> at the top to paste their URLs.
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

                      <div className="mt-3 border-t border-gray-100 pt-2">
                        {p.latest_pin ? (
                          <PinStatusBlock
                            pin={p.latest_pin}
                            productId={p.id}
                            busy={busyProductIds.has(p.id)}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onRegenerate={handleRegenerate}
                          />
                        ) : (
                          <NoPinBlock
                            productId={p.id}
                            busy={busyProductIds.has(p.id)}
                            onCreate={handleCreatePin}
                          />
                        )}
                      </div>
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
// CHILD COMPONENTS
// =============================================================================

// PLAIN: Renders the "no pin yet" state with a Create-pin button.
// TECH:  Stateless presentational component; parent owns the action handler.
function NoPinBlock({
  productId,
  busy,
  onCreate,
}: {
  productId: string;
  busy: boolean;
  onCreate: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-xs italic text-gray-400">No pin yet</p>
      <button
        onClick={() => onCreate(productId)}
        disabled={busy}
        className="mt-2 rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:bg-gray-400"
      >
        {busy ? 'Generating…' : '✨ Create pin'}
      </button>
    </div>
  );
}

// PLAIN: Renders pin preview + status badge + Approve/Reject/Recreate buttons.
// TECH:  Status-aware: shows different action sets per status.
function PinStatusBlock({
  pin,
  productId,
  busy,
  onApprove,
  onReject,
  onRegenerate,
}: {
  pin: NonNullable<DashProduct['latest_pin']>;
  productId: string;
  busy: boolean;
  onApprove: (pinId: string, productId: string) => void;
  onReject: (pinId: string, productId: string) => void;
  onRegenerate: (pinId: string, productId: string) => void;
}) {
  // PLAIN: Friendly label + colour for each pin status.
  // TECH:  Avoids hardcoding inline; easy to extend later.
  const statusBadge = (() => {
    switch (pin.status) {
      case 'pending_review':
        return { text: 'Awaiting review', cls: 'bg-yellow-100 text-yellow-800' };
      case 'approved':
        return { text: 'Approved · in queue', cls: 'bg-blue-100 text-blue-800' };
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
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded px-2 py-0.5 font-semibold ${statusBadge.cls}`}>
          Pin: {statusBadge.text}
        </span>
        {pin.pin_url && (
          <a
            href={pin.pin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            view →
          </a>
        )}
      </div>

      <p className="line-clamp-2 text-xs text-gray-700">{pin.title}</p>

      {/* ACTION BUTTONS — different sets per status */}
      <div className="flex flex-wrap gap-2 text-xs">
        {pin.status === 'pending_review' && (
          <>
            <button
              onClick={() => onApprove(pin.id, productId)}
              disabled={busy}
              className="rounded bg-green-600 px-2 py-1 font-semibold text-white hover:bg-green-700 disabled:bg-gray-400"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => onReject(pin.id, productId)}
              disabled={busy}
              className="rounded bg-gray-200 px-2 py-1 font-semibold text-gray-700 hover:bg-gray-300 disabled:bg-gray-100"
            >
              ✕ Reject
            </button>
            <button
              onClick={() => onRegenerate(pin.id, productId)}
              disabled={busy}
              className="rounded bg-purple-100 px-2 py-1 font-semibold text-purple-700 hover:bg-purple-200 disabled:bg-gray-100"
            >
              ↻ Recreate
            </button>
          </>
        )}
        {(pin.status === 'rejected' || pin.status === 'failed') && (
          <button
            onClick={() => onRegenerate(pin.id, productId)}
            disabled={busy}
            className="rounded bg-purple-100 px-2 py-1 font-semibold text-purple-700 hover:bg-purple-200 disabled:bg-gray-100"
          >
            ↻ Try again
          </button>
        )}
        {pin.status === 'approved' && (
          <a
            href="/queue"
            className="rounded bg-blue-100 px-2 py-1 font-semibold text-blue-700 hover:bg-blue-200"
          >
            Open queue →
          </a>
        )}
      </div>
    </div>
  );
}
