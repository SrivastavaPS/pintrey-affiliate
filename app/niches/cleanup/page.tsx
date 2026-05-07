// =============================================================================
// PAGE: /niches/cleanup — find & merge duplicate niches
// =============================================================================
// PLAIN: After lots of "Discover top 10 niches" clicks, the catalog gets
//        cluttered with near-duplicates. This page asks AI to find them,
//        shows clusters, lets you pick a primary, then merges the duplicates
//        in one click.
//
// TECH:  Client component. Calls /api/niches/cleanup/analyze on demand.
//        Each cluster is editable: change primary, drop niches from cluster,
//        then click Merge.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

interface Cluster {
  primary_id: string;
  primary_name: string;
  similar_ids: string[];
  similar_names: string[];
  reason: string;
}

interface Stats {
  total: number;
  withProducts: number;
  empty: number;
  lowScore: number;
}

export default function CleanupPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [clusters, setClusters] = useState<Cluster[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [merging, setMerging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // PLAIN: Track which similar IDs the user has un-checked per cluster.
  // TECH:  Map keyed by primary_id → set of dropped IDs.
  const [droppedFromCluster, setDroppedFromCluster] = useState<
    Map<string, Set<string>>
  >(new Map());

  // PLAIN: Optional override of which niche should be the primary per cluster.
  //        Defaults to AI's pick if not overridden.
  const [primaryOverrides, setPrimaryOverrides] = useState<Map<string, string>>(
    new Map()
  );

  // PLAIN: Load just the stats on mount (cheap, no AI call).
  // TECH:  Lets the user see the numbers before paying for an AI scan.
  useEffect(() => {
    void loadStats();
  }, []);

  async function loadStats() {
    try {
      const res = await fetch('/api/niches/cleanup/analyze');
      const data = await res.json();
      setStats(data.stats ?? null);
    } catch {
      // PLAIN: Silent — stats are nice-to-have.
    }
  }

  // PLAIN: Run the AI duplicate analysis.
  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setResultMessage(null);
    setClusters(null);

    try {
      const res = await fetch('/api/niches/cleanup/analyze', {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Analysis failed');
      } else {
        setClusters(data.clusters ?? []);
        setStats(data.stats ?? stats);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAnalyzing(false);
    }
  }

  // PLAIN: Toggle whether a similar niche should be merged or left alone.
  // TECH:  Adds/removes from droppedFromCluster Map.
  function toggleSimilar(primaryId: string, similarId: string) {
    setDroppedFromCluster((prev) => {
      const next = new Map(prev);
      const dropped = new Set(next.get(primaryId) ?? []);
      if (dropped.has(similarId)) dropped.delete(similarId);
      else dropped.add(similarId);
      next.set(primaryId, dropped);
      return next;
    });
  }

  // PLAIN: Change which niche is the primary in this cluster.
  // TECH:  Updates primaryOverrides; UI re-renders with new primary.
  function setPrimary(originalPrimaryId: string, newPrimaryId: string) {
    setPrimaryOverrides((prev) => {
      const next = new Map(prev);
      next.set(originalPrimaryId, newPrimaryId);
      return next;
    });
  }

  // PLAIN: Apply a merge: send the chosen primary + duplicates to the API.
  async function merge(cluster: Cluster) {
    const primaryId = primaryOverrides.get(cluster.primary_id) ?? cluster.primary_id;

    // PLAIN: Compute the duplicates from the original cluster minus the
    //        primary minus any "dropped" entries.
    // TECH:  All IDs in the cluster except the active primary and any
    //        IDs the user un-checked.
    const allIds = [cluster.primary_id, ...cluster.similar_ids];
    const dropped = droppedFromCluster.get(cluster.primary_id) ?? new Set();
    const duplicateIds = allIds.filter(
      (id) => id !== primaryId && !dropped.has(id)
    );

    if (duplicateIds.length === 0) {
      setError('Nothing to merge — at least one niche must be kept as primary and one as duplicate.');
      return;
    }

    setMerging(cluster.primary_id);
    setError(null);
    setResultMessage(null);

    try {
      const res = await fetch('/api/niches/cleanup/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_id: primaryId,
          duplicate_ids: duplicateIds,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Merge failed');
      } else {
        setResultMessage(
          `✓ Merged into "${cluster.primary_name}". ` +
            `${data.productsMoved} products moved, ` +
            `${data.suggestionsMoved} suggestions moved, ` +
            `${data.nichesDeleted} niches deleted.`
        );
        // PLAIN: Remove this cluster from the UI now that it's merged.
        setClusters((prev) =>
          prev ? prev.filter((c) => c.primary_id !== cluster.primary_id) : prev
        );
        await loadStats();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMerging(null);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Niche Cleanup
            </h1>
            <p className="mt-2 text-gray-600">
              Find duplicate niches with AI, merge them in one click. Products
              and suggestions move to the primary niche.
            </p>
          </div>
          <a
            href="/"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow hover:bg-gray-50"
          >
            ← Back to dashboard
          </a>
        </header>

        {/* STATS */}
        {stats && (
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard count={stats.total} label="Active niches" colour="indigo" />
            <StatCard count={stats.withProducts} label="With products" colour="green" />
            <StatCard count={stats.empty} label="Empty" colour="yellow" />
            <StatCard count={stats.lowScore} label="Score < 50" colour="red" />
          </section>
        )}

        {/* RUN ANALYSIS */}
        <section className="mb-6 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">
            Step 1 — Find duplicates
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Click below to ask AI to scan all your active niches and group
            duplicates / near-duplicates into clusters.
          </p>
          <button
            onClick={analyze}
            disabled={analyzing}
            className="mt-4 rounded-lg bg-gradient-to-r from-rose-600 to-indigo-600 px-6 py-3 font-semibold text-white shadow transition hover:scale-[1.02] disabled:opacity-50"
          >
            {analyzing ? '🔍 Scanning with AI…' : '🔍 Scan for duplicates'}
          </button>
        </section>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {resultMessage && (
          <div className="mb-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            {resultMessage}
          </div>
        )}

        {/* CLUSTERS */}
        {clusters !== null && (
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Step 2 — Review &amp; merge clusters{' '}
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-sm font-semibold text-gray-700">
                {clusters.length}
              </span>
            </h2>

            {clusters.length === 0 ? (
              <p className="mt-4 rounded bg-green-50 p-4 text-sm text-green-800">
                ✓ No duplicates found. Your catalog is clean!
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {clusters.map((cluster) => {
                  const activePrimaryId =
                    primaryOverrides.get(cluster.primary_id) ?? cluster.primary_id;
                  const dropped = droppedFromCluster.get(cluster.primary_id) ?? new Set();
                  const allIds = [cluster.primary_id, ...cluster.similar_ids];
                  const allNames = [cluster.primary_name, ...cluster.similar_names];

                  return (
                    <li
                      key={cluster.primary_id}
                      className="rounded-lg border border-gray-200 bg-white p-4"
                    >
                      <p className="text-sm italic text-gray-600">
                        🤖 {cluster.reason}
                      </p>

                      <ul className="mt-3 space-y-2">
                        {allIds.map((id, idx) => {
                          const name = allNames[idx];
                          const isPrimary = id === activePrimaryId;
                          const isDropped = dropped.has(id);

                          return (
                            <li
                              key={id}
                              className={`flex items-center justify-between rounded border p-2 ${
                                isPrimary
                                  ? 'border-green-300 bg-green-50'
                                  : isDropped
                                    ? 'border-gray-200 bg-gray-100 opacity-60'
                                    : 'border-purple-200 bg-purple-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span
                                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                    isPrimary
                                      ? 'bg-green-600 text-white'
                                      : isDropped
                                        ? 'bg-gray-300 text-gray-600'
                                        : 'bg-purple-200 text-purple-800'
                                  }`}
                                >
                                  {isPrimary
                                    ? 'KEEP'
                                    : isDropped
                                      ? 'SKIP'
                                      : 'MERGE'}
                                </span>
                                <span className="text-sm font-semibold">{name}</span>
                              </div>
                              <div className="flex gap-2 text-xs">
                                {!isPrimary && (
                                  <button
                                    onClick={() =>
                                      setPrimary(cluster.primary_id, id)
                                    }
                                    className="rounded bg-white px-2 py-1 font-semibold text-green-700 hover:bg-green-100"
                                  >
                                    Make primary
                                  </button>
                                )}
                                {!isPrimary && (
                                  <button
                                    onClick={() =>
                                      toggleSimilar(cluster.primary_id, id)
                                    }
                                    className="rounded bg-white px-2 py-1 font-semibold text-gray-700 hover:bg-gray-100"
                                  >
                                    {isDropped ? 'Include' : 'Skip'}
                                  </button>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <button
                          onClick={() => merge(cluster)}
                          disabled={merging === cluster.primary_id}
                          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:bg-gray-400"
                        >
                          {merging === cluster.primary_id
                            ? 'Merging…'
                            : '🔀 Merge cluster'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function StatCard({
  count,
  label,
  colour,
}: {
  count: number;
  label: string;
  colour: 'indigo' | 'green' | 'yellow' | 'red';
}) {
  const palette = {
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    green: 'bg-green-50 border-green-200 text-green-900',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    red: 'bg-red-50 border-red-200 text-red-900',
  }[colour];
  return (
    <div className={`rounded-lg border p-4 ${palette}`}>
      <p className="text-3xl font-bold">{count}</p>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}
