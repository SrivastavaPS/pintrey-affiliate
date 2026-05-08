// =============================================================================
// PAGE: /pin-manager — pin review, approval, posting, history
// =============================================================================
// PLAIN: Three sections: Pending Review · Approved (ready to post) · Posted.
//        Failed pins show in their own section if any exist. Each section
//        has the right buttons for that lifecycle stage.
// TECH:  Client component. Reads /api/queue (unified pin list).
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  Send,
  RotateCw,
  X,
  Copy,
  Check,
  Inbox,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

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

export default function PinManagerPage() {
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
    } catch (err) {
      toast.error('Failed to load pins', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

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
      toast.error('Clipboard not available');
    }
  }

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
      toast.success('Pin approved · ready to post');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(item.id, false);
    }
  }

  async function handleReject(item: QueueItem) {
    if (!confirm('Reject this pin? It will be removed from review.')) return;
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
      toast.success('Pin rejected');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(item.id, false);
    }
  }

  async function handleRegenerate(item: QueueItem) {
    if (item.source !== 'library') return;
    setBusy(item.id, true);
    try {
      await fetch(`/api/pins/${item.id}/regenerate`, { method: 'POST' });
      toast.success('Pin regenerated · review the new one');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(item.id, false);
    }
  }

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
      toast.success('Marked as posted');
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(item.id, false);
    }
  }

  function pinterestBuilderUrl(item: QueueItem): string {
    const params = new URLSearchParams({
      url: item.product.affiliate_url,
      media: item.pin.image_url ?? '',
      description: `${item.pin.title}\n\n${item.pin.description ?? ''}\n\n${item.pin.hashtags ?? ''}`.trim(),
    });
    return `https://www.pinterest.com/pin/create/button/?${params.toString()}`;
  }

  const pending = items.filter((i) => i.status === 'pending_review');
  const approved = items.filter((i) => i.status === 'approved' || i.status === 'queued');
  const posted = items.filter((i) => i.status === 'posted');
  const failed = items.filter((i) => i.status === 'failed');

  return (
    <>
      <TopBar
        title="Pin Manager"
        subtitle="Review, approve, post — all your pins in one place"
        actions={
          <Button variant="outline" size="md" onClick={refresh} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {/* STAT CARDS */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            count={pending.length}
            label="Pending"
            icon={<Clock className="h-4 w-4" />}
            color="amber"
          />
          <StatCard
            count={approved.length}
            label="Ready to post"
            icon={<Send className="h-4 w-4" />}
            color="indigo"
          />
          <StatCard
            count={posted.length}
            label="Posted"
            icon={<CheckCircle2 className="h-4 w-4" />}
            color="emerald"
          />
          <StatCard
            count={failed.length}
            label="Failed"
            icon={<AlertCircle className="h-4 w-4" />}
            color="red"
          />
        </section>

        {/* PENDING REVIEW */}
        <SectionCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          title="Pending review"
          subtitle="AI generated these. Approve, reject, or regenerate."
          count={pending.length}
        >
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-5 w-5" />}
              title="No pins awaiting review"
              description="Add a product → AI auto-generates a pin → it shows up here."
            />
          ) : (
            <ul className="space-y-3">
              {pending.map((item) => (
                <PinCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  copied={copied}
                  onCopy={copyText}
                >
                  <Button
                    size="sm"
                    onClick={() => handleApprove(item)}
                    disabled={busyIds.has(item.id)}
                    icon={<Check className="h-3.5 w-3.5" />}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReject(item)}
                    disabled={busyIds.has(item.id)}
                    icon={<X className="h-3.5 w-3.5" />}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerate(item)}
                    disabled={busyIds.has(item.id) || item.source !== 'library'}
                    icon={<RotateCw className="h-3.5 w-3.5" />}
                  >
                    Regenerate
                  </Button>
                </PinCard>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* APPROVED — READY TO POST */}
        <SectionCard
          icon={<Send className="h-5 w-5 text-indigo-600" />}
          title="Approved · ready to post"
          subtitle="Open Pinterest, paste, save, then mark as posted."
          count={approved.length}
        >
          {loading ? (
            <Skeleton className="h-32 w-full" />
          ) : approved.length === 0 ? (
            <EmptyState title="Nothing approved yet" description="Approve pins from the section above." />
          ) : (
            <ul className="space-y-3">
              {approved.map((item) => (
                <PinCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  copied={copied}
                  onCopy={copyText}
                  showCopyFields
                >
                  <a href={pinterestBuilderUrl(item)} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="secondary" icon={<ExternalLink className="h-3.5 w-3.5" />}>
                      Open Pinterest
                    </Button>
                  </a>
                  <Button
                    size="sm"
                    onClick={() => handleMarkPosted(item)}
                    disabled={busyIds.has(item.id)}
                    icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                  >
                    Mark posted
                  </Button>
                </PinCard>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* POSTED */}
        <SectionCard
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          title="Posted"
          subtitle="History of pins you've published."
          count={posted.length}
          collapsible
        >
          {posted.length === 0 ? (
            <EmptyState title="No posted pins yet" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {posted.map((item) => (
                <li key={item.id} className="flex items-center gap-4 py-3">
                  {item.pin.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.pin.image_url}
                      alt={item.pin.title}
                      className="h-14 w-14 shrink-0 rounded object-contain"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded bg-slate-100" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm font-medium text-slate-900">{item.pin.title}</p>
                    <p className="line-clamp-1 text-xs text-slate-500">
                      {item.product.title}
                      {item.posted_at && ` · ${new Date(item.posted_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {item.pin_url && (
                    <a
                      href={item.pin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-medium text-indigo-600 hover:underline"
                    >
                      View →
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        {/* FAILED — only if any */}
        {failed.length > 0 && (
          <SectionCard
            icon={<AlertCircle className="h-5 w-5 text-red-600" />}
            title="Failed generations"
            subtitle="These pins failed to generate. Try again or remove."
            count={failed.length}
          >
            <ul className="space-y-3">
              {failed.map((item) => (
                <PinCard
                  key={item.id}
                  item={item}
                  busy={busyIds.has(item.id)}
                  copied={copied}
                  onCopy={copyText}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRegenerate(item)}
                    disabled={busyIds.has(item.id) || item.source !== 'library'}
                    icon={<RotateCw className="h-3.5 w-3.5" />}
                  >
                    Try again
                  </Button>
                </PinCard>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>
    </>
  );
}

// =============================================================================
// CHILD COMPONENTS
// =============================================================================

function StatCard({
  count,
  label,
  icon,
  color,
}: {
  count: number;
  label: string;
  icon: React.ReactNode;
  color: 'amber' | 'indigo' | 'emerald' | 'red';
}) {
  const palette = {
    amber: 'bg-amber-50 text-amber-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
  }[color];

  return (
    <Card>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-2xl font-semibold text-slate-900">{count}</p>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {label}
          </p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${palette}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  count,
  children,
  collapsible,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible || count > 0);
  return (
    <Card>
      <CardHeader
        className={collapsible ? 'cursor-pointer select-none' : ''}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <CardTitle className="flex items-center gap-2">
                {title}
                <Badge variant="neutral">{count}</Badge>
              </CardTitle>
              <CardDescription>{subtitle}</CardDescription>
            </div>
          </div>
          {collapsible && (
            <span className="text-sm text-slate-400">{open ? '−' : '+'}</span>
          )}
        </div>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
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
    <li className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid gap-4 md:grid-cols-[160px_1fr]">
        <div className="bg-slate-50 p-3">
          {item.pin.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.pin.image_url}
              alt={item.pin.title}
              className="w-full rounded object-contain"
            />
          ) : (
            <div className="flex h-32 w-full items-center justify-center rounded bg-white text-xs text-slate-400">
              No image
            </div>
          )}
          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
            {item.source === 'library' ? 'Library' : 'POC'}
          </p>
        </div>

        <div className="p-4">
          <p className="font-medium text-slate-900">{item.pin.title}</p>
          <p className="mt-1 line-clamp-3 text-sm text-slate-600">
            {item.pin.description}
          </p>
          {item.pin.hashtags && (
            <p className="mt-1 line-clamp-1 text-xs text-rose-600">{item.pin.hashtags}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {item.product.title} · {item.product.price ?? '—'}
          </p>

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

          <div className="mt-3 flex flex-wrap gap-2">{children}</div>
          {busy && (
            <p className="mt-2 text-xs italic text-slate-500">Working…</p>
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
      <span className="w-24 shrink-0 pt-1 text-[10px] font-semibold uppercase text-slate-500">
        {label}
      </span>
      <span className="flex-1 truncate rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
        {value}
      </span>
      <button
        onClick={onCopy}
        className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold transition ${
          copied
            ? 'bg-emerald-600 text-white'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
        }`}
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}
