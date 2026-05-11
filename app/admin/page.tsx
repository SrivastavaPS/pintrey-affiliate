// =============================================================================
// PAGE: /admin — secrets & integrations control panel
// =============================================================================
// PLAIN: Lists every API key / token the app uses, grouped by integration
//        (Supabase, Groq, Amazon, Pinterest, Flipkart, Myntra, Meesho).
//        For each: status badge, masked preview, copy button, and link to
//        edit on Vercel (the only place env vars can actually be modified
//        in production).
//
// SECURITY:
//        - Real secret values NEVER returned to the browser; only last 4 chars.
//        - This app has no auth yet, so anyone hitting this URL sees the page.
//          We show a banner reminding the operator of that.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Database,
  Brain,
  ShoppingBag,
  Image as ImageIcon,
  Store,
  Shirt,
  Gift,
  Lock,
  Unlock,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { TopBar } from '@/components/layout/TopBar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';

interface SecretStatus {
  key: string;
  label: string;
  description: string;
  status: 'configured' | 'placeholder' | 'missing';
  preview: string;
  length: number;
  sensitive: boolean;
  required: boolean;
}

interface SecretGroup {
  integration: string;
  description: string;
  items: SecretStatus[];
}

interface SecretsResponse {
  groups: SecretGroup[];
  summary: {
    total: number;
    configured: number;
    placeholder: number;
    missing: number;
    requiredMissing: number;
  };
}

// PLAIN: Pick an icon for each integration name.
function iconForIntegration(name: string) {
  if (name.startsWith('Database')) return <Database className="h-5 w-5" />;
  if (name.startsWith('AI')) return <Brain className="h-5 w-5" />;
  if (name.startsWith('Amazon')) return <ShoppingBag className="h-5 w-5" />;
  if (name.startsWith('Pinterest')) return <ImageIcon className="h-5 w-5" />;
  if (name.startsWith('Flipkart')) return <Store className="h-5 w-5" />;
  if (name.startsWith('Myntra')) return <Shirt className="h-5 w-5" />;
  if (name.startsWith('Meesho')) return <Gift className="h-5 w-5" />;
  return <Database className="h-5 w-5" />;
}

export default function AdminPage() {
  const [data, setData] = useState<SecretsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/secrets');
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error('Failed to load secrets', {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <TopBar
        title="Admin"
        subtitle="API keys, tokens, and integration status"
        actions={
          <Button variant="outline" size="md" onClick={load} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="flex-1 space-y-6 p-4 md:p-8">
        {/* SECURITY BANNER */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">No auth on this page yet</p>
            <p className="mt-1 text-xs">
              This app currently has no login wall. Anyone with the URL can
              see this status page. Real secret values are{' '}
              <strong>never</strong> sent to the browser — only last 4 chars
              are shown. Editing happens via Vercel dashboard or
              <code className="mx-1 rounded bg-amber-100 px-1">.env.local</code>
              file. Add auth before sharing this URL publicly.
            </p>
          </div>
        </div>

        {/* SUMMARY */}
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : data ? (
          <SummaryRow summary={data.summary} />
        ) : null}

        {/* GROUPS */}
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))
          : (data?.groups ?? []).map((group) => (
              <IntegrationGroup key={group.integration} group={group} onMutate={load} />
            ))}

        {/* HOW TO EDIT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-indigo-600" />
              How to edit a secret
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  Production (Vercel)
                </h4>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                  <li>
                    Open{' '}
                    <a
                      href="https://vercel.com/dashboard"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline"
                    >
                      vercel.com/dashboard
                    </a>
                  </li>
                  <li>Pick your project → Settings → Environment Variables</li>
                  <li>Edit / add the env var → save</li>
                  <li>Click Deployments → latest → ⋯ → Redeploy</li>
                  <li>Come back here, click Refresh — status updates</li>
                </ol>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  Local development
                </h4>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600">
                  <li>
                    Open{' '}
                    <code className="rounded bg-slate-200 px-1">.env.local</code>{' '}
                    in your project root
                  </li>
                  <li>Edit the var (no quotes around values)</li>
                  <li>Save the file</li>
                  <li>
                    In terminal: <code className="rounded bg-slate-200 px-1">Ctrl+C</code>
                    , then <code className="rounded bg-slate-200 px-1">npm run dev</code>
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// =============================================================================
// CHILD COMPONENTS
// =============================================================================

function SummaryRow({ summary }: { summary: SecretsResponse['summary'] }) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <SummaryCard
        count={summary.configured}
        total={summary.total}
        label="Configured"
        color="emerald"
        icon={<CheckCircle2 className="h-4 w-4" />}
      />
      <SummaryCard
        count={summary.placeholder}
        total={summary.total}
        label="Placeholder"
        color="amber"
        icon={<AlertTriangle className="h-4 w-4" />}
      />
      <SummaryCard
        count={summary.missing}
        total={summary.total}
        label="Missing"
        color="red"
        icon={<XCircle className="h-4 w-4" />}
      />
      <SummaryCard
        count={summary.requiredMissing}
        total={undefined}
        label="Required missing"
        color={summary.requiredMissing > 0 ? 'red' : 'emerald'}
        icon={
          summary.requiredMissing > 0 ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )
        }
      />
    </section>
  );
}

function SummaryCard({
  count,
  total,
  label,
  color,
  icon,
}: {
  count: number;
  total?: number;
  label: string;
  color: 'emerald' | 'amber' | 'red';
  icon: React.ReactNode;
}) {
  const palette = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }[color];
  return (
    <Card>
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {count}
            {total !== undefined && (
              <span className="ml-1 text-sm font-normal text-slate-400">
                / {total}
              </span>
            )}
          </p>
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

function IntegrationGroup({
  group,
  onMutate,
}: {
  group: SecretGroup;
  onMutate: () => void;
}) {
  const allConfigured = group.items.every((i) => i.status === 'configured');
  const someMissing = group.items.some(
    (i) => i.required && i.status !== 'configured'
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                allConfigured
                  ? 'bg-emerald-50 text-emerald-700'
                  : someMissing
                    ? 'bg-red-50 text-red-700'
                    : 'bg-amber-50 text-amber-700'
              }`}
            >
              {iconForIntegration(group.integration)}
            </div>
            <div>
              <CardTitle>{group.integration}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-slate-100">
          {group.items.map((item) => (
            <SecretRow key={item.key} item={item} onMutate={onMutate} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SecretRow({
  item,
  onMutate,
}: {
  item: SecretStatus;
  onMutate: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  const statusBadge = (() => {
    switch (item.status) {
      case 'configured':
        return <Badge variant="success">Configured</Badge>;
      case 'placeholder':
        return <Badge variant="warning">Placeholder</Badge>;
      case 'missing':
        return item.required ? (
          <Badge variant="danger">Missing · required</Badge>
        ) : (
          <Badge variant="neutral">Not set</Badge>
        );
    }
  })();

  // PLAIN: Vercel deep link — opens the project's env vars settings.
  // TECH:  We can't deep-link to a specific row (Vercel doesn't support it),
  //        so we link to the env-vars page and the user filters there.
  const vercelEnvUrl =
    'https://vercel.com/dashboard';

  function copyKeyName() {
    void navigator.clipboard
      .writeText(item.key)
      .then(() => toast.success(`Copied: ${item.key}`));
  }

  return (
    <li className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-700">
            {item.key}
          </code>
          {statusBadge}
          {item.sensitive ? (
            <Badge variant="neutral" className="gap-1">
              <Lock className="h-3 w-3" />
              Sensitive
            </Badge>
          ) : (
            <Badge variant="neutral" className="gap-1">
              <Unlock className="h-3 w-3" />
              Public
            </Badge>
          )}
          {item.required && <Badge variant="primary">Required</Badge>}
        </div>
        <p className="mt-1 text-sm font-medium text-slate-900">{item.label}</p>
        <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>

        {/* PREVIEW VALUE */}
        {item.preview && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              Value:
            </span>
            <code className="rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-600">
              {item.sensitive && !revealed ? '••••••••' + item.preview : item.preview}
            </code>
            {item.sensitive && (
              <button
                onClick={() => setRevealed((v) => !v)}
                className="text-slate-400 hover:text-slate-700"
                aria-label={revealed ? 'Hide preview' : 'Show preview'}
              >
                {revealed ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
            )}
            {item.length > 0 && (
              <span className="text-[10px] text-slate-400">
                {item.length} chars
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={copyKeyName}
          icon={<Copy className="h-3.5 w-3.5" />}
        >
          Copy name
        </Button>
        <a href={vercelEnvUrl} target="_blank" rel="noopener noreferrer">
          <Button
            size="sm"
            variant="ghost"
            icon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Edit on Vercel
          </Button>
        </a>
      </div>

      {/* PLAIN: onMutate is wired but not used yet — reserved for future
          when we add app-managed config (e.g., PINTEREST_MODE swap stored in DB). */}
      {void onMutate}
    </li>
  );
}
