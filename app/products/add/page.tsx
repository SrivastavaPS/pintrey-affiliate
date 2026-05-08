// =============================================================================
// PAGE: /products/add — add a product from any affiliate source
// =============================================================================
// PLAIN: Source selector at top (Amazon active, others "Coming Soon"),
//        then paste-URL → Extract → Save flow. AI auto-fills title, image,
//        price, niche tags, and matches/creates the right niche.
//
// TECH:  Client component. /api/library handles extraction + AI niche match.
//        /api/pins/generate fires synchronously after save.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import {
  Search,
  Save,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  PowerOff,
  Power,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

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

interface NicheOption {
  id: string;
  name: string;
  score: number | null;
}

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
  niche_top3?: string[];
}

type Source = 'amazon' | 'flipkart' | 'myntra' | 'meesho';

const SOURCES: {
  id: Source;
  label: string;
  active: boolean;
  color: string;
  emoji: string;
}[] = [
  { id: 'amazon', label: 'Amazon India', active: true, color: 'bg-amber-50 border-amber-200', emoji: '🛍️' },
  { id: 'flipkart', label: 'Flipkart', active: false, color: 'bg-blue-50 border-blue-200', emoji: '🏪' },
  { id: 'myntra', label: 'Myntra', active: false, color: 'bg-pink-50 border-pink-200', emoji: '👗' },
  { id: 'meesho', label: 'Meesho', active: false, color: 'bg-purple-50 border-purple-200', emoji: '🎁' },
];

export default function AddProductPage() {
  const [selectedSource, setSelectedSource] = useState<Source>('amazon');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const [preview, setPreview] = useState<ProductPreview | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  const [library, setLibrary] = useState<LibraryProduct[]>([]);
  const [niches, setNiches] = useState<NicheOption[]>([]);
  const [selectedNicheId, setSelectedNicheId] = useState<string>('');

  const [topNicheSuggestions, setTopNicheSuggestions] = useState<string[]>([]);
  const [aiCreatedNewNiche, setAiCreatedNewNiche] = useState(false);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const [reSuggesting, setReSuggesting] = useState(false);

  useEffect(() => {
    void refreshLibrary();
    void refreshNiches();

    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('niche');
      if (param) setSelectedNicheId(param);
    }
  }, []);

  async function refreshLibrary() {
    try {
      const res = await fetch('/api/library');
      const data = await res.json();
      setLibrary(data.products ?? []);
    } catch {
      // PLAIN: Silent — list is non-critical.
    }
  }

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
      // PLAIN: Silent — dropdown stays empty.
    }
  }

  async function handleExtract() {
    if (!url.trim()) {
      toast.warning('Please paste an Amazon URL first');
      return;
    }
    setBusy(true);
    setPreview(null);
    setAiCreatedNewNiche(false);

    try {
      const knownIds = new Set(niches.map((n) => n.id));

      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), mode: 'preview' }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error('Could not extract product', { description: data.error });
        return;
      }

      setPreview(data.preview);
      setEditTitle(data.preview.title ?? '');
      setEditPrice(data.preview.price ?? '');
      setEditTags(data.preview.niche_tags ?? '');
      setEditImageUrl(data.preview.image_url ?? '');
      setEditNotes('');

      const isFallbackTitle =
        (data.preview.title ?? '').startsWith('Amazon product ');
      setExtractionFailed(isFallbackTitle);

      if (data.preview.niche_id) {
        await refreshNiches();
        setSelectedNicheId(data.preview.niche_id);
        setAiCreatedNewNiche(!knownIds.has(data.preview.niche_id));
      }

      setTopNicheSuggestions(data.preview.niche_top3 ?? []);

      if (isFallbackTitle) {
        toast.warning('Amazon blocked auto-extraction', {
          description: 'Please fill in Title and Image URL manually.',
        });
      } else {
        toast.success('Product extracted', {
          description: data.preview.niche_id
            ? aiCreatedNewNiche
              ? 'AI created a new niche for this product.'
              : 'AI matched it to an existing niche.'
            : undefined,
        });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResuggestNiche() {
    if (!preview || !editTitle.trim()) return;
    setReSuggesting(true);

    try {
      const knownIds = new Set(niches.map((n) => n.id));
      const res = await fetch('/api/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: preview.product_url,
          mode: 'preview',
          title: editTitle,
        }),
      });
      const data = await res.json();
      if (res.ok && data.preview) {
        setEditTags(data.preview.niche_tags ?? editTags);
        if (data.preview.niche_id) {
          await refreshNiches();
          setSelectedNicheId(data.preview.niche_id);
          setAiCreatedNewNiche(!knownIds.has(data.preview.niche_id));
        }
        setTopNicheSuggestions(data.preview.niche_top3 ?? []);
        toast.success('AI re-matched the niche');
      } else {
        toast.error('Re-suggestion failed', { description: data.error });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setReSuggesting(false);
    }
  }

  async function handleSave() {
    if (!preview) return;
    setBusy(true);

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
          image_url: editImageUrl || preview.image_url || null,
          niche_id: selectedNicheId || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error('Save failed', { description: data.error });
      } else {
        if (data.pin_gen_error) {
          toast.warning('Saved, but pin generation failed', {
            description: data.pin_gen_error,
            action: {
              label: 'Open Pin Manager',
              onClick: () => (window.location.href = '/pin-manager'),
            },
          });
        } else {
          toast.success('Product saved · pin generating', {
            description: 'Pin will appear in Pin Manager in a few seconds.',
            action: {
              label: 'View Queue',
              onClick: () => (window.location.href = '/pin-manager'),
            },
          });
        }
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
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this product from your library?')) return;
    try {
      await fetch(`/api/library/${id}`, { method: 'DELETE' });
      toast.success('Product deleted');
      await refreshLibrary();
    } catch {
      toast.error('Delete failed');
    }
  }

  async function handleToggleActive(p: LibraryProduct) {
    try {
      await fetch(`/api/library/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      toast.success(p.is_active ? 'Disabled' : 'Enabled');
      await refreshLibrary();
    } catch {
      toast.error('Update failed');
    }
  }

  return (
    <>
      <TopBar
        title="Add Product"
        subtitle="Paste a product URL and AI does the rest"
      />

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {/* SOURCE SELECTOR */}
        <Card>
          <CardHeader>
            <CardTitle>Choose source</CardTitle>
            <CardDescription>
              Currently only Amazon India is supported. Other networks coming soon.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {SOURCES.map((s) => {
                const isSelected = selectedSource === s.id && s.active;
                return (
                  <button
                    key={s.id}
                    onClick={() => s.active && setSelectedSource(s.id)}
                    disabled={!s.active}
                    className={[
                      'relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all',
                      s.active
                        ? isSelected
                          ? 'border-indigo-600 bg-indigo-50 shadow-md'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                        : 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60',
                    ].join(' ')}
                  >
                    <span className="text-3xl">{s.emoji}</span>
                    <span className={`text-sm font-medium ${s.active ? 'text-slate-900' : 'text-slate-500'}`}>
                      {s.label}
                    </span>
                    {!s.active && (
                      <Badge variant="neutral">
                        <Lock className="mr-1 h-3 w-3" />
                        Coming soon
                      </Badge>
                    )}
                    {isSelected && s.active && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                        <CheckCircle2 className="h-3 w-3" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* URL INPUT */}
        <Card>
          <CardHeader>
            <CardTitle>Paste {SOURCES.find((s) => s.id === selectedSource)?.label} URL</CardTitle>
            <CardDescription>
              Right-click the product on Amazon → Copy link → paste below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <input
                type="url"
                placeholder="https://www.amazon.in/dp/B0BS6XRQDF"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={busy}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none disabled:bg-slate-50"
              />
              <Button
                onClick={handleExtract}
                loading={busy && !preview}
                disabled={!url.trim()}
                icon={<Search className="h-4 w-4" />}
              >
                Extract
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* EXTRACTION PREVIEW */}
        {preview && (
          <Card>
            <CardHeader>
              <CardTitle>Review &amp; save</CardTitle>
              <CardDescription>
                Edit anything below, then save. Pin auto-generates after save.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {extractionFailed && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Amazon blocked auto-extraction</p>
                    <p className="mt-1 text-xs">
                      Vercel servers from US datacenters sometimes get blocked.
                      Fill in the Title and Image URL manually below, then click{' '}
                      <strong>Re-suggest niche</strong>.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-6 md:grid-cols-[180px_1fr]">
                <div>
                  {(editImageUrl || preview.image_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={editImageUrl || preview.image_url || ''}
                      alt={preview.title}
                      className="w-full rounded-lg border border-slate-200 bg-white"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400">
                      No image
                    </div>
                  )}
                  <p className="mt-2 font-mono text-xs text-slate-500">
                    ASIN: {preview.asin}
                  </p>
                </div>

                <div className="space-y-3">
                  <FieldLabel
                    label="Title"
                    badge={extractionFailed ? { text: 'FILL MANUALLY', variant: 'warning' } : undefined}
                  >
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    {extractionFailed && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResuggestNiche}
                        loading={reSuggesting}
                        disabled={!editTitle.trim()}
                        icon={<Sparkles className="h-3.5 w-3.5" />}
                        className="mt-2"
                      >
                        Re-suggest niche from title
                      </Button>
                    )}
                  </FieldLabel>

                  <FieldLabel
                    label="Image URL"
                    badge={extractionFailed ? { text: 'PASTE MANUALLY', variant: 'warning' } : undefined}
                  >
                    <input
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="https://m.media-amazon.com/images/I/..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </FieldLabel>

                  <FieldLabel
                    label="Price"
                    badge={preview.price ? { text: 'AUTO-DETECTED', variant: 'success' } : undefined}
                  >
                    <input
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="₹1,099"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </FieldLabel>

                  <FieldLabel
                    label="Niche tags"
                    badge={preview.niche_tags ? { text: 'AI-SUGGESTED', variant: 'primary' } : undefined}
                    hint="AI matches niches to these tags. Edit to fine-tune matching."
                  >
                    <input
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="skincare, korean, toner, anti-acne"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </FieldLabel>

                  <FieldLabel
                    label="Primary niche"
                    badge={
                      preview.niche_id
                        ? aiCreatedNewNiche
                          ? { text: 'NEW NICHE CREATED', variant: 'warning' }
                          : { text: 'AI-MATCHED', variant: 'primary' }
                        : undefined
                    }
                    hint={aiCreatedNewNiche ? "AI didn't find a good match, so it created a new niche." : undefined}
                  >
                    {topNicheSuggestions.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {topNicheSuggestions.map((id, idx) => {
                          const n = niches.find((nx) => nx.id === id);
                          if (!n) return null;
                          const isSelected = selectedNicheId === n.id;
                          return (
                            <button
                              key={n.id}
                              type="button"
                              onClick={() => setSelectedNicheId(n.id)}
                              className={[
                                'rounded-full px-3 py-1 text-xs font-medium transition',
                                isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
                              ].join(' ')}
                            >
                              {idx === 0 ? '⭐ ' : ''}{n.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <select
                      value={selectedNicheId}
                      onChange={(e) => setSelectedNicheId(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="">— Uncategorised —</option>
                      {niches.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.name}
                          {n.score !== null ? ` · score ${n.score}` : ''}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>

                  <FieldLabel label="Notes (optional)">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                  </FieldLabel>

                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={handleSave}
                      loading={busy}
                      icon={<Save className="h-4 w-4" />}
                    >
                      Save to library
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setPreview(null)}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* LIBRARY LIST */}
        <Card>
          <CardHeader>
            <CardTitle>Your products ({library.length})</CardTitle>
            <CardDescription>
              All saved products. Toggle off to skip from automation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {library.length === 0 ? (
              <EmptyState
                title="No products yet"
                description="Add your first product above by pasting an Amazon URL."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {library.map((p) => (
                  <li
                    key={p.id}
                    className={`flex flex-col rounded-lg border border-slate-200 bg-white p-3 transition-colors ${
                      p.is_active ? '' : 'opacity-60'
                    }`}
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="h-32 w-full rounded object-contain"
                      />
                    ) : (
                      <div className="flex h-32 w-full items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                        No image
                      </div>
                    )}
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-900">
                      {p.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {p.price ?? '—'} · ASIN {p.asin}
                    </p>
                    {p.niche_tags && (
                      <p className="mt-1 line-clamp-1 text-xs text-rose-600">
                        {p.niche_tags}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
                      <a
                        href={p.affiliate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-indigo-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Amazon
                      </a>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(p)}
                          className="text-slate-500 hover:text-slate-900"
                          title={p.is_active ? 'Disable' : 'Enable'}
                        >
                          {p.is_active ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// =============================================================================
// CHILD: FieldLabel
// =============================================================================
// PLAIN: Wraps form fields with a consistent label + optional badge + hint.
// =============================================================================
function FieldLabel({
  label,
  badge,
  hint,
  children,
}: {
  label: string;
  badge?: { text: string; variant: 'success' | 'warning' | 'primary' };
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {label}
        </span>
        {badge && (
          <Badge variant={badge.variant} className="text-[9px]">
            {badge.text}
          </Badge>
        )}
      </div>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </label>
  );
}
