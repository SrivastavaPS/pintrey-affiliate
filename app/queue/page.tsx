// =============================================================================
// PAGE: /queue — pin management & manual posting workflow
// =============================================================================
// PLAIN: Three sections in one page:
//          1. PENDING REVIEW — newly generated pins waiting for your decision
//             → buttons: Approve · Reject · Regenerate
//          2. APPROVED · READY TO POST — approved pins waiting to be posted
//             → buttons: Open Pinterest · Mark Posted
//          3. POSTED — history of pins you've already published
//             → read-only with link to live pin
//
// TECH:  Client component. Fetches /api/queue on mount + after each action.
//        Groups items by status client-side for UI bucketing.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

interface QueueItem {
  source: 'poc' | 'library';
  id: string;
  status: string;
  created_at: string;
  posted_at: string | null;
  pin_url: string | null;
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
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
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
      // PLAIN: Silent fail — user can hit refresh.
    } finally {
      setLoading(false);
    }
  }

  // PLAIN: Helper to mark an item busy (disables its buttons + shows spinner).
  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
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

  // PLAIN: Approve a pending pin. Library pins → /api/pins/[id] PATCH approved.
  async function handleApprove(item: QueueItem) {
    setBusy(item.id, true);
    try {
      if (item.source === 'library') {
        await fetch(`/api/pins/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'approved' }),
        });
      }
      // POC pins are already 'queued' (no separate approval step).
      await refresh();
    } finally {
      setBusy(item.id, false);
    }
  }

  // PLAIN: Reject = soft-delete. Library pins → status='rejected'.
  async function handleReject(item: QueueItem) {
    if (!confirm('Reject this pin? It will be removed from the queue.')) return;
    setBusy(item.id, true);
    try {
      if (item.source === 'library') {
        await fetch(`/api/pins/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'rejected' }),
        });
      } else {
        await fetch(`/api/queue/${item.id}`, { method: 'DELETE' });
      }
      await refresh();
    } finally {
      setBusy(item.id, false);
    }
  }

  // PLAIN: Regenerate = delete the pin and create a new one for same product.
  async function handleRegenerate(item: QueueItem) {
    if (item.source !== 'library') return; // not supported for POC pins
    setBusy(item.id, true);
    try {
      await fetch(`/api/pins/${item.id}/regenerate`, { method: 'POST' });
      await refresh();
    } finally {
      setBusy(item.id, false);
    }
  }

  // PLAIN: Mark posted (after user pasted on Pinterest manually).
  async function handleMarkPosted(item: QueueItem) {
    setBusy(item.id, true);
    try {
      if (item.source === 'library') {
        await fetch(`/api/pins/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'posted' }),
        });
      } else {
        await fetch(`/api/queue/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
      }
      await refresh();
    } finally {
      setBusy(item.id, false);
    }
  }

  // PLAIN: Build the Pinterest pin-builder URL with image+link+desc pre-filled.
  function pinterestBuilderUrl(item: QueueItem): string {
    const params = new URLSearchParams({
      url: item.product.affiliate_url,
      media: item.pin.image_url ?? '',
      description: `${item.pin.title}\n\n${item.pin.description ?? ''}\n\n${item.pin.hashtags ?? ''}`.trim(),
    });
    return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
  }

  // PLAIN: Group items by status bucket: pending / approved / posted / rejected.
  // TECH:  POC 'queued' counts as approved-ready-to-post; 'posted' as posted.
  const pending = items.filter((i) => i.status === 'pending_review');
  const approved = items.filter(
    (i) => i.status === 'approved' || i.status === 'queued'
  );
  const posted = items.filter((i) => i.status === 'posted');
  const failed = items.filter((i) => i.status === 'failed');

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Pin Queue</h1>
            <p className="mt-2 text-gray-600">
              Review AI-generated pins, approve the good ones, post them
              manually, see history.
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

        {/* SUMMARY STATS */}
        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard count={pending.length} label="Pending review" colour="yellow" />
          <StatCard count={approved.length} label="Ready to post" colour="blue" />
          <StatCard count={posted.length} label="Posted" colour="green" />
          <StatCard count={failed.length} label="Failed" colour="red" />
        </section>

        {/* SECTION 1: PENDING REVIEW */}
        <Section
          title="📝 Pending review"
          subtitle="AI generated these pins. Approve the good ones, reject the rest, or regenerate."
          count={pending.length}
        >
          {pending.length === 0 ? (
            <EmptyHint text="No pins awaiting review. Add a product → AI auto-generates a pin." />
          ) : (
            <ul className="space-y-4">
              {pending.map((item) => (
                <PinCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  copied={copied}
                  onCopy={copyText}
                >
                  <ActionButton
                    onClick={() => handleApprove(item)}
                    disabled={busyIds.has(item.id)}
                    colour="green"
                  >
                    ✓ Approve
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleReject(item)}
                    disabled={busyIds.has(item.id)}
                    colour="gray"
                  >
                    ✕ Reject
                  </ActionButton>
                  <ActionButton
                    onClick={() => handleRegenerate(item)}
                    disabled={busyIds.has(item.id) || item.source !== 'library'}
                    colour="purple"
                  >
                    ↻ Regenerate
                  </ActionButton>
                </PinCard>
              ))}
            </ul>
          )}
        </Section>

        {/* SECTION 2: APPROVED — READY TO POST */}
        <Section
          title="✅ Approved · ready to post"
          subtitle="Open Pinterest, paste, save — then click Mark Posted to clear from this list."
          count={approved.length}
        >
          {approved.length === 0 ? (
            <EmptyHint text="No approved pins waiting. Approve some from above first." />
          ) : (
            <ul className="space-y-4">
              {approved.map((item) => (
                <PinCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  copied={copied}
                  onCopy={copyText}
                  showCopyFields
                >
                  <a
                    href={pinterestBuilderUrl(item)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                  >
                    📤 Open Pinterest
                  </a>
                  <ActionButton
                    onClick={() => handleMarkPosted(item)}
                    disabled={busyIds.has(item.id)}
                    colour="green"
                  >
                    ✓ Mark posted
                  </ActionButton>
                </PinCard>
              ))}
            </ul>
          )}
        </Section>

        {/* SECTION 3: POSTED HISTORY */}
        <Section
          title="📍 Posted"
          subtitle="Pins you've published. Click to view the live pin on Pinterest."
          count={posted.length}
          collapsible
        >
          {posted.length === 0 ? (
            <EmptyHint text="No posted pins yet." />
          ) : (
            <ul className="space-y-2">
              {posted.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-3"
                >
                  {item.pin.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.pin.image_url}
                      alt={item.pin.title}
                      className="h-16 w-16 rounded object-contain"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded bg-gray-100" />
                  )}
                  <div className="flex-1">
                    <p className="line-clamp-1 text-sm font-semibold">
                      {item.pin.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.product.title}
                      {item.posted_at &&
                        ` · posted ${new Date(item.posted_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {item.pin_url && (
                    <a
                      href={item.pin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View on Pinterest →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* SECTION 4: FAILED (only if any) */}
        {failed.length > 0 && (
          <Section
            title="⚠ Failed generations"
            subtitle="These pins failed to generate. Click Regenerate to try again."
            count={failed.length}
          >
            <ul className="space-y-4">
              {failed.map((item) => (
                <PinCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  copied={copied}
                  onCopy={copyText}
                >
                  <ActionButton
                    onClick={() => handleRegenerate(item)}
                    disabled={busyIds.has(item.id) || item.source !== 'library'}
                    colour="purple"
                  >
                    ↻ Try again
                  </ActionButton>
                </PinCard>
              ))}
            </ul>
          </Section>
        )}
      </div>
    </main>
  );
}

// =============================================================================
// CHILD COMPONENTS
// =============================================================================

function StatCard({
  count,
  label,
  colour,
}: {
  count: number;
  label: string;
  colour: 'yellow' | 'blue' | 'green' | 'red';
}) {
  const palette = {
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    blue: 'bg-blue-50 border-blue-200 text-blue-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  }[colour];
  return (
    <div className={`rounded-lg border p-4 ${palette}`}>
      <p className="text-3xl font-bold">{count}</p>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Section({
  title,
  subtitle,
  count,
  children,
  collapsible,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible || count > 0);
  return (
    <section className="mb-8 rounded-xl bg-white p-6 shadow">
      <header
        className={collapsible ? 'cursor-pointer' : ''}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {title}{' '}
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
              {count}
            </span>
          </h2>
          {collapsible && (
            <span className="text-sm text-gray-400">{open ? '−' : '+'}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
      </header>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded bg-gray-50 p-4 text-sm italic text-gray-500">{text}</p>;
}

function ActionButton({
  onClick,
  disabled,
  colour,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  colour: 'green' | 'gray' | 'purple' | 'red';
  children: React.ReactNode;
}) {
  const palette = {
    green: 'bg-green-600 text-white hover:bg-green-700',
    gray: 'bg-gray-200 text-gray-700 hover:bg-gray-300',
    purple: 'bg-purple-600 text-white hover:bg-purple-700',
    red: 'bg-red-600 text-white hover:bg-red-700',
  }[colour];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:bg-gray-300 disabled:text-gray-500 ${palette}`}
    >
      {children}
    </button>
  );
}

function PinCard({
  item,
  busy,
  copied,
  onCopy,
  showCopyFields,
  children,
}: {
  item: QueueItem;
  busy: boolean;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  showCopyFields?: boolean;
  children: React.ReactNode;
}) {
  const fullDescription = `${item.pin.description ?? ''}\n\n${item.pin.hashtags ?? ''}`.trim();
  const copyKey = (suffix: string) => `${item.source}-${item.id}-${suffix}`;

  return (
    <li className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="grid gap-4 md:grid-cols-[180px_1fr]">
        {/* IMAGE */}
        <div className="bg-gray-50 p-3">
          {item.pin.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.pin.image_url}
              alt={item.pin.title}
              className="w-full rounded object-contain"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
              No image
            </div>
          )}
          <p className="mt-1 text-[10px] uppercase text-gray-400">
            {item.source === 'library' ? 'Library' : 'POC'}
          </p>
        </div>

        {/* CONTENT */}
        <div className="p-4">
          <p className="font-semibold text-gray-900">{item.pin.title}</p>
          <p className="mt-1 line-clamp-3 text-sm text-gray-600">
            {item.pin.description}
          </p>
          {item.pin.hashtags && (
            <p className="mt-1 text-xs text-rose-600">{item.pin.hashtags}</p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            {item.product.title} · {item.product.price ?? '—'}
          </p>

          {/* COPY FIELDS — only shown for "ready to post" stage */}
          {showCopyFields && (
            <div className="mt-3 space-y-2">
              <CopyRow
                label="Title"
                value={item.pin.title}
                copied={copied === copyKey('t')}
                onCopy={() => onCopy(item.pin.title, copyKey('t'))}
              />
              <CopyRow
                label="Description"
                value={fullDescription}
                copied={copied === copyKey('d')}
                onCopy={() => onCopy(fullDescription, copyKey('d'))}
              />
              <CopyRow
                label="Affiliate link"
                value={item.product.affiliate_url}
                copied={copied === copyKey('l')}
                onCopy={() => onCopy(item.product.affiliate_url, copyKey('l'))}
              />
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="mt-3 flex flex-wrap gap-2">{children}</div>
          {busy && (
            <p className="mt-2 text-xs italic text-gray-500">Working…</p>
          )}
        </div>
      </div>
    </li>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 shrink-0 pt-1 text-[10px] font-semibold uppercase text-gray-500">
        {label}
      </span>
      <span className="flex-1 truncate rounded bg-gray-50 px-2 py-1 font-mono text-xs text-gray-700">
        {value}
      </span>
      <button
        onClick={onCopy}
        className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold transition ${
          copied
            ? 'bg-green-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        {copied ? '✓' : 'Copy'}
      </button>
    </div>
  );
}
