// =============================================================================
// PAGE: /products/add — your product library manager
// =============================================================================
// PLAIN: This page lets you paste any Amazon India URL → preview the product
//        → save it to your library. Shows everything saved below.
//
// TECH:  Client component. Uses /api/library endpoints for CRUD operations.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

// PLAIN: Shape of one product in the library.
// TECH:  Mirrors product_library table.
interface LibraryProduct {
  id: string;
  asin: string;
  title: string;
  image_url: string | null;
  product_url: string;
  affiliate_url: string;
  price: string | null;
  niche_tags: string | null;
  notes: string | null;
  is_active: boolean;
  source: string;
  niche_id: string | null;
  created_at: string;
}

// PLAIN: One niche option in the dropdown.
// TECH:  Subset of trending_niches needed for selection.
interface NicheOption {
  id: string;
  name: string;
  score: number | null;
}

// PLAIN: Shape of the preview returned by POST /api/library (mode=preview).
// TECH:  Same fields as LibraryProduct minus DB-only ones. Includes AI-
//        suggested niche_tags and scraped price.
interface ProductPreview {
  asin: string;
  title: string;
  image_url: string | null;
  product_url: string;
  affiliate_url: string;
  price: string | null;
  niche_tags: string | null;
  notes: string | null;
}

export default function AddProductPage() {
  // PLAIN: The Amazon URL the user typed.
  // TECH:  Controlled input.
  const [url, setUrl] = useState('');

  // PLAIN: Loading state while fetching preview or saving.
  // TECH:  Disables the form.
  const [busy, setBusy] = useState(false);

  // PLAIN: Error message to show in red.
  // TECH:  Cleared on each new action.
  const [error, setError] = useState<string | null>(null);

  // PLAIN: The preview returned from the server (before save).
  // TECH:  null = no preview yet; populated after Extract click.
  const [preview, setPreview] = useState<ProductPreview | null>(null);

  // PLAIN: User-editable fields on top of the preview (title, price, tags).
  // TECH:  Bound to preview but split so user edits override scraped values.
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // PLAIN: All products currently in your library.
  // TECH:  Refreshed after every save/delete.
  const [library, setLibrary] = useState<LibraryProduct[]>([]);

  // PLAIN: Available niches for the dropdown.
  // TECH:  Fetched from /api/niches on mount.
  const [niches, setNiches] = useState<NicheOption[]>([]);

  // PLAIN: Currently selected niche for this product.
  // TECH:  Optional — products without niche show as "Uncategorised" on dashboard.
  const [selectedNicheId, setSelectedNicheId] = useState<string>('');

  // PLAIN: Load the library list + niches list on first render.
  //        Pre-fill niche from ?niche=<id> URL param if present (deep link
  //        from dashboard's "+ Add product" button under each niche).
  // TECH:  Empty deps array → runs once on mount. URLSearchParams reads
  //        the query string client-side.
  useEffect(() => {
    void refreshLibrary();
    void refreshNiches();

    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('niche');
      if (param) setSelectedNicheId(param);
    }
  }, []);

  // PLAIN: Re-fetches the library list from the server.
  // TECH:  GET /api/library; updates state.
  async function refreshLibrary() {
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      setLibrary(data.products ?? []);
    } catch {
      // PLAIN: Silent fail — list is non-critical.
    }
  }

  // PLAIN: Loads the trending_niches catalog for the dropdown.
  // TECH:  GET /api/niches; sorted by score server-side.
  async function refreshNiches() {
    try {
      const res = await fetch('/api/niches');
      const data = await res.json();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setNiches((data.niches ?? []).map((n: any) => ({
        id: n.id,
        name: n.name,
        score: n.score,
      })));
    } catch {
      // PLAIN: Silent fail — dropdown just stays empty.
    }
  }

  // PLAIN: Click "Extract" → fetch preview from server.
  // TECH:  POST /api/library with mode=preview; populate preview state.
  async function handleExtract() {
    if (!url.trim()) {
      setError('Please paste an Amazon URL first.');
      return;
    }
    setBusy(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), mode: 'preview' }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Could not preview product.');
      } else {
        // PLAIN: Pre-fill the form with everything the server extracted —
        //        title from og:title, price from page HTML, and AI-suggested
        //        niche tags. User can edit anything before saving.
        // TECH:  Defaults from preview; nullable values fall back to ''.
        setPreview(data.preview);
        setEditTitle(data.preview.title ?? '');
        setEditPrice(data.preview.price ?? '');
        setEditTags(data.preview.niche_tags ?? '');
        setEditNotes('');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // PLAIN: Click "Save" → write to library, clear form, refresh list.
  // TECH:  POST /api/library mode=save with edited fields.
  async function handleSave() {
    if (!preview) return;
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: preview.product_url,
          mode: 'save',
          title: editTitle || preview.title,
          price: editPrice || null,
          niche_tags: editTags || null,
          notes: editNotes || null,
          // PLAIN: Primary niche assignment for dashboard grouping.
          // TECH:  Empty string → null so DB FK is unset.
          niche_id: selectedNicheId || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Could not save product.');
      } else {
        // PLAIN: Saved! Clear the form and refresh the library.
        // TECH:  Reset all controlled inputs; refetch list.
        setUrl('');
        setPreview(null);
        setEditTitle('');
        setEditPrice('');
        setEditTags('');
        setEditNotes('');
        await refreshLibrary();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // PLAIN: Delete a product from the library.
  // TECH:  DELETE /api/library/<id>; refresh list.
  async function handleDelete(id: string) {
    if (!confirm('Remove this product from your library?')) return;
    try {
      await fetch(`/api/library/${id}`, { method: 'DELETE' });
      await refreshLibrary();
    } catch {
      // PLAIN: Silent — user can retry.
    }
  }

  // PLAIN: Toggle a product on/off without deleting.
  // TECH:  PATCH /api/library/<id> with is_active flip.
  async function handleToggleActive(p: LibraryProduct) {
    try {
      await fetch(`/api/library/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      await refreshLibrary();
    } catch {
      // PLAIN: Silent — user can retry.
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Product Library</h1>
          <p className="mt-2 text-gray-600">
            Paste any Amazon India URL to add a product. Your POC will pick
            from these instead of mock data.
          </p>
        </header>

        {/* ADD FORM */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">
            Add a product
          </h2>

          <div className="flex gap-3">
            <input
              type="url"
              placeholder="https://www.amazon.in/dp/B0BS6XRQDF"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={busy}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-rose-500 focus:outline-none"
            />
            <button
              onClick={handleExtract}
              disabled={busy || !url.trim()}
              className="rounded-lg bg-rose-600 px-6 py-3 font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {busy ? 'Working…' : 'Extract'}
            </button>
          </div>

          {error && (
            <p className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {/* PREVIEW + EDIT */}
          {preview && (
            <div className="mt-6 grid gap-6 rounded-lg border border-gray-200 bg-gray-50 p-4 md:grid-cols-[200px_1fr]">
              {/* IMAGE PREVIEW */}
              <div>
                {preview.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview.image_url}
                    alt={preview.title}
                    className="w-full rounded-lg border border-gray-200 bg-white"
                  />
                ) : (
                  <div className="flex h-48 w-full items-center justify-center rounded-lg border border-gray-200 bg-white text-xs text-gray-400">
                    No image
                  </div>
                )}
                <p className="mt-2 font-mono text-xs text-gray-500">
                  ASIN: {preview.asin}
                </p>
              </div>

              {/* EDITABLE FIELDS */}
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Title
                  </span>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Price {preview.price && (
                      <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        AUTO-DETECTED
                      </span>
                    )}
                  </span>
                  <input
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    placeholder="₹1,099"
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Niche tags (comma-separated) {preview.niche_tags && (
                      <span className="ml-2 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                        AI-SUGGESTED
                      </span>
                    )}
                  </span>
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="skincare, korean, toner, anti-acne"
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-gray-400">
                    AI matches niches to these tags. Edit if you want
                    different keywords. More tags = more chances your
                    product gets picked.
                  </span>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Primary niche
                  </span>
                  <select
                    value={selectedNicheId}
                    onChange={(e) => setSelectedNicheId(e.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">— No niche assigned (Uncategorised) —</option>
                    {niches.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.name}
                        {n.score !== null ? ` (score ${n.score})` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400">
                    Groups this product on the dashboard. If no niches show
                    here, click <b>✨ Discover top 10 niches</b> on the home
                    page first.
                  </span>
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Notes (optional)
                  </span>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={busy}
                    className="rounded-lg bg-green-600 px-5 py-2 font-semibold text-white transition hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {busy ? 'Saving…' : 'Save to library'}
                  </button>
                  <button
                    onClick={() => setPreview(null)}
                    disabled={busy}
                    className="rounded-lg bg-gray-200 px-5 py-2 font-semibold text-gray-700 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* LIBRARY LIST */}
        <section className="rounded-xl bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Your products ({library.length})
            </h2>
            {library.length === 0 && (
              <span className="text-sm text-gray-400">
                Add your first product above ↑
              </span>
            )}
          </div>

          {library.length > 0 && (
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {library.map((p) => (
                <li
                  key={p.id}
                  className={`rounded-lg border p-4 transition ${
                    p.is_active
                      ? 'border-gray-200 bg-white'
                      : 'border-gray-200 bg-gray-100 opacity-60'
                  }`}
                >
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="mb-3 h-40 w-full rounded object-contain"
                    />
                  ) : (
                    <div className="mb-3 flex h-40 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                      No image
                    </div>
                  )}
                  <p className="font-semibold text-sm">{p.title}</p>
                  <p className="text-xs text-gray-500">
                    {p.price ?? '—'} · ASIN {p.asin}
                  </p>
                  {p.niche_tags && (
                    <p className="mt-1 text-xs text-rose-600">
                      {p.niche_tags}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2 text-xs">
                    <a
                      href={p.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View on Amazon
                    </a>
                    <span className="text-gray-300">·</span>
                    <button
                      onClick={() => handleToggleActive(p)}
                      className="text-gray-600 hover:underline"
                    >
                      {p.is_active ? 'Disable' : 'Enable'}
                    </button>
                    <span className="text-gray-300">·</span>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
