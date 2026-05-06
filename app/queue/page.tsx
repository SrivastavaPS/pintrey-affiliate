// =============================================================================
// PAGE: /queue — manual posting workflow
// =============================================================================
// PLAIN: Shows every pin ready to be manually posted. Two sources merged:
//        POC pipeline pins AND approved library pins. For each, you get
//        copy buttons + an "Open Pinterest" link with image/description
//        pre-filled. Click "Mark posted" after posting on Pinterest.
//
// TECH:  Client component. Reads /api/queue (returns unified items with
//        a `source` discriminator). Mark-posted dispatches to the correct
//        endpoint based on source.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

// PLAIN: Unified shape returned by /api/queue.
// TECH:  source field tells us which API to PATCH for "Mark posted".
interface QueueItem {
  source: 'poc' | 'library';
  id: string;
  created_at: string;
  pin: {
    id: string;
    title: string;
    description: string | null;
    hashtags: string | null;
    image_url: string | null;
  };
  product: {
    id: string;
    title: string;
    price: string | null;
    affiliate_url: string;
    asin: string | null;
  };
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

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

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // PLAIN: Older browser without clipboard — silently ignore.
    }
  }

  // PLAIN: Mark a queued pin as posted. Different endpoints based on source:
  //   - POC pipeline pin → PATCH /api/queue/<id>
  //   - Library pin     → PATCH /api/pins/<id> with status='posted'
  // TECH:  source-aware dispatch keeps both paths working.
  async function markPosted(item: QueueItem) {
    try {
      if (item.source === 'poc') {
        await fetch(`/api/queue/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      } else {
        await fetch(`/api/pins/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'posted' }),
        });
      }
      await refresh();
    } catch {
      // PLAIN: User can retry.
    }
  }

  // PLAIN: Remove from queue without posting (didn't like the pin).
  // TECH:  Source-aware DELETE — same dispatch logic as markPosted.
  async function discard(item: QueueItem) {
    if (!confirm("Remove this pin from the queue without posting?")) return;
    try {
      if (item.source === 'poc') {
        await fetch(`/api/queue/${item.id}`, { method: 'DELETE' });
      } else {
        // PLAIN: For library pins, "discard" = mark as rejected (kept for analytics).
        await fetch(`/api/pins/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected' }),
        });
      }
      await refresh();
    } catch {
      // PLAIN: Silent.
    }
  }

  // PLAIN: Build a Pinterest pin-builder URL pre-filled with image/link/desc.
  function pinterestBuilderUrl(item: QueueItem): string {
    const params = new URLSearchParams({
      url: item.product.affiliate_url,
      media: item.pin.image_url ?? '',
      description: `${item.pin.title}\n\n${item.pin.description ?? ''}\n\n${item.pin.hashtags ?? ''}`.trim(),
    });
    return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Posting Queue</h1>
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

        {!loading && items.length === 0 && (
          <section className="rounded-xl bg-white p-12 text-center shadow">
            <p className="text-lg font-semibold text-gray-700">
              No pins waiting.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Approve pins from the dashboard or run{' '}
              <a href="/poc" className="text-rose-600 hover:underline">
                /poc
              </a>{' '}
              to generate them.
            </p>
          </section>
        )}

        <ul className="space-y-6">
          {items.map((item) => {
            const fullDescription = `${item.pin.description ?? ''}\n\n${item.pin.hashtags ?? ''}`.trim();

            return (
              <li
                key={`${item.source}-${item.id}`}
                className="overflow-hidden rounded-xl bg-white shadow"
              >
                <div className="grid gap-6 md:grid-cols-[300px_1fr]">
                  <div className="bg-gray-50 p-4">
                    {item.pin.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.pin.image_url}
                        alt={item.pin.title}
                        className="w-full rounded-lg shadow"
                      />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
                        No image
                      </div>
                    )}
                    <p className="mt-2 text-xs text-gray-500">
                      Right-click → <b>Save image as…</b> if you need a copy.
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
                      Source: {item.source === 'library' ? 'Library' : 'POC'}
                    </p>
                  </div>

                  <div className="space-y-3 p-4">
                    <CopyField
                      label="Title"
                      value={item.pin.title}
                      onCopy={() =>
                        copyText(item.pin.title, `${item.source}-${item.id}-title`)
                      }
                      copied={copied === `${item.source}-${item.id}-title`}
                    />

                    <CopyField
                      label="Description"
                      value={fullDescription}
                      multiline
                      onCopy={() =>
                        copyText(fullDescription, `${item.source}-${item.id}-desc`)
                      }
                      copied={copied === `${item.source}-${item.id}-desc`}
                    />

                    <CopyField
                      label="Destination link (your affiliate URL)"
                      value={item.product.affiliate_url}
                      onCopy={() =>
                        copyText(
                          item.product.affiliate_url,
                          `${item.source}-${item.id}-link`
                        )
                      }
                      copied={copied === `${item.source}-${item.id}-link`}
                    />

                    <p className="pt-2 text-xs text-gray-500">
                      {item.product.title} · {item.product.price ?? '—'}
                      {item.product.asin && ` · ASIN ${item.product.asin}`}
                    </p>

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
                        onClick={() => markPosted(item)}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                      >
                        ✓ Mark posted
                      </button>
                      <button
                        onClick={() => discard(item)}
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
