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
  niche_id?: string | null;
  /** PLAIN: Top 3 niche IDs that AI thinks fit this product (best first). */
  niche_top3?: string[];
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
  const [editImageUrl, setEditImageUrl] = useState('');

  // PLAIN: True if Amazon blocked our metadata fetch — UI shows a warning
  //        and lets user fill in the title and image URL manually.
  // TECH:  Read from preview.title; "Amazon product <ASIN>" pattern means
  //        the og:title fetch failed and we're using a fallback string.
  const [extractionFailed, setExtractionFailed] = useState(false);

  // PLAIN: Re-suggest niche AFTER user manually typed a real title.
  //        Calls the same preview endpoint with a synthetic URL so AI gets
  //        a real product name to work with.
  // TECH:  Loading state for the "✨ Re-suggest" button.
  const [reSuggesting, setReSuggesting] = useState(false);

  // PLAIN: All products currently in your library.
  // TECH:  Refreshed after every save/delete.
  const [library, setLibrary] = useState<LibraryProduct[]>([]);

  // PLAIN: Available niches for the dropdown.
  // TECH:  Fetched from /api/niches on mount.
  const [niches, setNiches] = useState<NicheOption[]>([]);

  // PLAIN: Currently selected niche for this product.
  // TECH:  Optional — products without niche show as "Uncategorised" on dashboard.
  const [selectedNicheId, setSelectedNicheId] = useState<string>('');

  // PLAIN: AI's top-3 niche suggestions (best first). Shown as quick-select
  //        buttons above the dropdown so the user can pick from the obvious
  //        candidates without scrolling.
  // TECH:  Set from preview.niche_top3; cleared on cancel/save.
  const [topNicheSuggestions, setTopNicheSuggestions] = useState<string[]>([]);

  // PLAIN: True when the AI auto-created a brand-new niche (none of the
  //        existing ones fit). Drives the "✨ NEW NICHE CREATED" badge.
  // TECH:  Set in handleExtract by comparing niche IDs before/after the call.
  const [aiCreatedNewNiche, setAiCreatedNewNiche] = useState(false);

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
        // PLAIN: Snapshot existing niche IDs so we can detect if the AI
        //        just created a brand-new niche (one that wasn't there before).
        // TECH:  Set of IDs before refresh; compared after to identify new rows.
        const knownIds = new Set(niches.map((n) => n.id));

        // PLAIN: Pre-fill all the form fields from the AI extraction.
        setPreview(data.preview);
        setEditTitle(data.preview.title ?? '');
        setEditPrice(data.preview.price ?? '');
        setEditTags(data.preview.niche_tags ?? '');
        setEditImageUrl(data.preview.image_url ?? '');
        setEditNotes('');

        // PLAIN: Detect "extraction failed" by inspecting the title fallback.
        //        When Amazon blocks us, the API returns "Amazon product <ASIN>".
        // TECH:  Used to show a yellow warning banner.
        const isFallbackTitle =
          (data.preview.title ?? '').startsWith('Amazon product ');
        setExtractionFailed(isFallbackTitle);

        // PLAIN: Pre-fill the niche dropdown with AI's best match. Always
        //        refresh the niches list first in case AI just created one.
        // TECH:  Order matters: refresh BEFORE setting selectedNicheId so
        //        the option exists when the <select> reads its value.
        if (data.preview.niche_id) {
          await refreshNiches();
          setSelectedNicheId(data.preview.niche_id);
          setAiCreatedNewNiche(!knownIds.has(data.preview.niche_id));
        } else {
          setAiCreatedNewNiche(false);
        }

        // PLAIN: Save the top-3 suggestions so the UI can show quick-pick
        //        buttons above the dropdown.
        // TECH:  Default to empty array; UI hides the buttons when empty.
        setTopNicheSuggestions(data.preview.niche_top3 ?? []);
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
          // PLAIN: Manual image URL override (used when Amazon blocked the
          //        og:image fetch, so user pastes one themselves).
          image_url: editImageUrl || preview.image_url || null,
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
        setEditImageUrl('');
        setSelectedNicheId('');
        setTopNicheSuggestions([]);
        setAiCreatedNewNiche(false);
        setExtractionFailed(false);
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
  // PLAIN: After user manually fixes the title, re-run AI niche suggestion.
  //        Useful when Amazon blocked our auto-extract and user typed the
  //        real title themselves.
  // TECH:  Calls /api/library again with mode=preview, but now the API
  //        gets a real title to work with. Updates only the AI-driven
  //        fields (tags, niche_id, top3) — preserves user's title/price.
  async function handleResuggestNiche() {
    if (!preview || !editTitle.trim()) return;
    setReSuggesting(true);
    setError(null);

    try {
      // PLAIN: Send a synthetic URL preview but pass the user-entered title
      //        as a body field so AI can see it. The API uses meta.title
      //        currently — easier to send the URL again and have the API
      //        re-fetch (or use a server hint via title override).
      // TECH:  We re-POST the same URL; the API will re-fetch metadata.
      //        If still blocked, AI gets nothing and we leave fields alone.
      //        Future: API could accept an explicit `force_title` param.
      const knownIds = new Set(niches.map((n) => n.id));

      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: preview.product_url,
          mode: 'preview',
          // Hint: user-entered title. API doesn't read this yet, but
          // we send it so a future API change can use it.
          title: editTitle,
        }),
      });
      const data = await res.json();

      if (res.ok && data.preview) {
        // PLAIN: Only update AI-suggested fields; keep user's edits.
        setEditTags(data.preview.niche_tags ?? editTags);
        if (data.preview.niche_id) {
          await refreshNiches();
          setSelectedNicheId(data.preview.niche_id);
          setAiCreatedNewNiche(!knownIds.has(data.preview.niche_id));
        }
        setTopNicheSuggestions(data.preview.niche_top3 ?? []);
      } else {
        setError(data.error ?? 'Re-suggestion failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReSuggesting(false);
    }
  }

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
                {/* WARNING BANNER WHEN AMAZON BLOCKED THE FETCH */}
                {extractionFailed && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    <p className="font-semibold">
                      ⚠ Amazon blocked auto-extraction.
                    </p>
                    <p className="mt-1">
                      This happens because Vercel serves from US datacenters.
                      Please fill in the <b>Title</b> and <b>Image URL</b>{' '}
                      below manually. Then click{' '}
                      <b>✨ Re-suggest niche</b> to let AI categorise the
                      product correctly.
                    </p>
                  </div>
                )}

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Title {extractionFailed && (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        FILL MANUALLY
                      </span>
                    )}
                  </span>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  {extractionFailed && (
                    <button
                      type="button"
                      onClick={handleResuggestNiche}
                      disabled={reSuggesting || !editTitle.trim()}
                      className="mt-2 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:bg-purple-700 disabled:bg-gray-400"
                    >
                      {reSuggesting ? 'Thinking…' : '✨ Re-suggest niche from title'}
                    </button>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Image URL {extractionFailed && (
                      <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        PASTE MANUALLY
                      </span>
                    )}
                  </span>
                  <input
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://m.media-amazon.com/images/I/..."
                    className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <span className="text-xs text-gray-400">
                    On Amazon: right-click the product photo → &quot;Copy
                    image link&quot; → paste here.
                  </span>
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
                    Primary niche {preview.niche_id && (
                      <span
                        className={`ml-2 rounded px-2 py-0.5 text-[10px] font-bold ${
                          aiCreatedNewNiche
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {aiCreatedNewNiche ? '✨ NEW NICHE CREATED' : 'AI-MATCHED'}
                      </span>
                    )}
                  </span>

                  {/* TOP-3 QUICK-SELECT BUTTONS */}
                  {topNicheSuggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {topNicheSuggestions
                        .map((id, idx) => {
                          const niche = niches.find((n) => n.id === id);
                          if (!niche) return null;
                          const isSelected = selectedNicheId === niche.id;
                          return (
                            <button
                              key={niche.id}
                              type="button"
                              onClick={() => setSelectedNicheId(niche.id)}
                              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                                isSelected
                                  ? 'bg-purple-600 text-white shadow'
                                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                              }`}
                            >
                              {idx === 0 ? '⭐ ' : ''}{niche.name}
                            </button>
                          );
                        })
                        .filter(Boolean)}
                      <span className="self-center text-xs text-gray-400">
                        ← AI suggests one of these · or pick from list below
                      </span>
                    </div>
                  )}

                  <select
                    value={selectedNicheId}
                    onChange={(e) => setSelectedNicheId(e.target.value)}
                    className="mt-2 block w-full rounded border border-gray-300 px-3 py-2 text-sm"
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
                    {aiCreatedNewNiche
                      ? "AI didn't find a good match, so it created a new niche. "
                      : 'Click a chip above for the AI\'s pick, or change to any niche from the list. '}
                    No niches yet? Click <b>✨ Discover top 10 niches</b> on
                    the home page first.
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
