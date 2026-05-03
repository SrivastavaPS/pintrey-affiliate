// =============================================================================
// PAGE: /queue — manual posting workflow
// =============================================================================
// PLAIN: Shows every pin the AI has prepared but not yet posted. For each
//        pin, you get the image, title, description, hashtags, and affiliate
//        link with one-click "Copy" buttons. Click "Open Pinterest" to land
//        on Pinterest's create-pin page with everything pre-filled (where
//        possible). After posting on Pinterest, click "Mark as posted" here
//        to clear it from the queue.
//
// TECH:  Client component. Polls /api/queue on mount + after each action.
//        Uses navigator.clipboard for copy-to-clipboard feedback.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

// PLAIN: Shape of one queued item from /api/queue.
// TECH:  Mirrors the SELECT shape with nested pins + products.
interface QueuedItem {
  id: string;
  pin_id: string;
  status: string;
  created_at: string;
  pins: {
    id: string;
    title: string;
    description: string | null;
    hashtags: string | null;
    image_url: string;
    products: {
      id: string;
      title: string;
      price: string | null;
      affiliate_url: string;
      asin: string | null;
    } | null;
  } | null;
}

export default function QueuePage() {
  const [items, setItems] = useState<QueuedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // PLAIN: Fetch the queue on mount.
  // TECH:  useEffect with empty deps runs once.
  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/queue');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // PLAIN: Silent fail — user can hit refresh button.
    } finally {
      setLoading(false);
    }
  }

  // PLAIN: Copy text to clipboard with visual feedback.
  // TECH:  navigator.clipboard.writeText; resets the badge after 1.5s.
  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // PLAIN: Older browser without clipboard — silently ignore.
    }
  }

  // PLAIN: Mark a pin as posted — removes it from the queue.
  // TECH:  PATCH /api/queue/<id> with status='posted'.
  async function markPosted(id: string) {
    try {
      await fetch(`/api/queue/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      await refresh();
    } catch {
      // PLAIN: User can retry — refresh on its own won't show stale state.
    }
  }

  // PLAIN: Remove from queue without posting.
  // TECH:  DELETE /api/queue/<id>.
  async function discard(id: string) {
    if (!confirm("Remove this pin from the queue without posting?")) return;
    try {
      await fetch(`/api/queue/${id}`, { method: 'DELETE' });
      await refresh();
    } catch {}
  }

  // PLAIN: Build a Pinterest "Save URL" — opens the Pinterest pin builder
  //        pre-filled with the affiliate link, image, and description.
  //        User just needs to pick a board and click Save.
  // TECH:  Pinterest's official pin builder URL accepts url, media, description.
  function pinterestBuilderUrl(item: QueuedItem): string {
    const product = item.pins?.products;
    const pin = item.pins;
    if (!product || !pin) return 'https://www.pinterest.com/';

    const params = new URLSearchParams({
      url: product.affiliate_url,
      media: pin.image_url,
      description: `${pin.title}\n\n${pin.description ?? ''}\n\n${pin.hashtags ?? ''}`.trim(),
    });
    return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Posting Queue
            </h1>
            <p className="mt-2 text-gray-600">
              Pins ready to post manually. Click <b>Open Pinterest</b>, paste,
              save. Then click <b>Mark posted</b> here to clear.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </header>

        {/* EMPTY STATE */}
        {!loading && items.length === 0 && (
          <section className="rounded-xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-gray-700">
              No pins waiting.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Run the POC at <a href="/poc" className="text-rose-600 hover:underline">/poc</a>{' '}
              to generate pins. They&apos;ll appear here after.
            </p>
          </section>
        )}

        {/* QUEUE ITEMS */}
        <ul className="space-y-6">
          {items.map((item) => {
            const pin = item.pins;
            const product = pin?.products;
            if (!pin || !product) return null;

            const fullDescription = `${pin.description ?? ''}\n\n${pin.hashtags ?? ''}`.trim();

            return (
              <li
                key={item.id}
                className="overflow-hidden rounded-xl bg-white shadow"
              >
                <div className="grid gap-6 md:grid-cols-[300px_1fr]">
                  {/* IMAGE PREVIEW */}
                  <div className="bg-gray-50 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pin.image_url}
                      alt={pin.title}
                      className="w-full rounded-lg shadow"
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Right-click → <b>Save image as…</b> if you need a copy.
                    </p>
                  </div>

                  {/* COPY-PASTE CONTENT */}
                  <div className="space-y-3 p-4">
                    {/* TITLE */}
                    <CopyField
                      label="Title"
                      value={pin.title}
                      onCopy={() => copyText(pin.title, `${item.id}-title`)}
                      copied={copied === `${item.id}-title`}
                    />

                    {/* DESCRIPTION + HASHTAGS */}
                    <CopyField
                      label="Description"
                      value={fullDescription}
                      multiline
                      onCopy={() => copyText(fullDescription, `${item.id}-desc`)}
                      copied={copied === `${item.id}-desc`}
                    />

                    {/* AFFILIATE LINK */}
                    <CopyField
                      label="Destination link (your affiliate URL)"
                      value={product.affiliate_url}
                      onCopy={() => copyText(product.affiliate_url, `${item.id}-link`)}
                      copied={copied === `${item.id}-link`}
                    />

                    {/* PRODUCT INFO */}
                    <p className="pt-2 text-xs text-gray-500">
                      {product.title} · {product.price ?? '—'}
                      {product.asin && ` · ASIN ${product.asin}`}
                    </p>

                    {/* ACTION BUTTONS */}
                    <div className="flex flex-wrap gap-2 pt-3">
                      <a
                        href={pinterestBuilderUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                      >
                        Open Pinterest →
                      </a>
                      <button
                        onClick={() => markPosted(item.id)}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                      >
                        ✓ Mark posted
                      </button>
                      <button
                        onClick={() => discard(item.id)}
                        className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-300"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

// PLAIN: Reusable input row with a label + copy button.
// TECH:  Stateless component; parent owns clipboard logic.
function CopyField({
  label,
  value,
  onCopy,
  copied,
  multiline,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <div className="mt-1 flex gap-2">
        {multiline ? (
          <textarea
            readOnly
            value={value}
            rows={4}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        ) : (
          <input
            readOnly
            value={value}
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-mono"
          />
        )}
        <button
          onClick={onCopy}
          className={`shrink-0 rounded px-3 py-2 text-xs font-semibold transition ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
