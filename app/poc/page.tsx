// =============================================================================
// PAGE: /poc — the "Run POC" dashboard
// =============================================================================
// PLAIN: This is the page where you click "Run POC" and watch the robot
//        do its 4 steps live. After it finishes, you see what was posted
//        and (if Pinterest is configured) a link to the live pin.
//
// TECH:  Client component (uses useState/useEffect). Calls /api/poc/run,
//        then polls /api/poc/run?runId=... every second for live progress
//        events until the run reaches a terminal status.
// =============================================================================

'use client';

import { useEffect, useState } from 'react';

// PLAIN: Shape of one log event we render in the live feed.
// TECH:  Mirrors the events table row.
interface EventRow {
  id: number;
  step_name: string;
  status: 'info' | 'success' | 'failed';
  message: string | null;
  created_at: string;
}

// PLAIN: Shape of the run row we get back from the GET endpoint.
// TECH:  Subset of pipeline_runs columns.
interface RunRow {
  id: string;
  status: 'running' | 'success' | 'failed';
  completed_steps: number;
  total_steps: number;
  error_message: string | null;
  started_at: string;
  ended_at: string | null;
}

// PLAIN: Shape of the final result returned by POST /api/poc/run.
// TECH:  Aggregated step outputs.
interface PocResult {
  runId: string;
  status: 'success' | 'failed';
  niche?: { id: string; name: string; reason: string; score: number };
  product?: {
    id: string;
    title: string;
    price: string | null;
    image_url: string | null;
    affiliate_url: string;
    source: string;
  };
  pin?: {
    id: string;
    title: string;
    description: string;
    image_url: string;
    hashtags: string;
  };
  post?: {
    pin_url: string | null;
    pinterest_pin_id: string | null;
    status: string;
    error_message: string | null;
  };
  dryRun?: boolean;
  error?: string;
}

export default function PocPage() {
  // PLAIN: Track whether the pipeline is currently running.
  // TECH:  Disables the Run button + shows spinner.
  const [isRunning, setIsRunning] = useState(false);

  // PLAIN: The current run's ID (so we can poll for live events).
  // TECH:  Set when POST /api/poc/run kicks off.
  const [runId, setRunId] = useState<string | null>(null);

  // PLAIN: Live progress events from the events table.
  // TECH:  Refreshed every 1s while a run is in progress.
  const [events, setEvents] = useState<EventRow[]>([]);

  // PLAIN: Run metadata (status, step counter).
  // TECH:  Used for the progress bar.
  const [run, setRun] = useState<RunRow | null>(null);

  // PLAIN: Final result after the run finishes.
  // TECH:  Set once POST /api/poc/run resolves.
  const [result, setResult] = useState<PocResult | null>(null);

  // PLAIN: Polling effect — while a run is in progress, refresh events
  //        every second so the UI shows live updates.
  // TECH:  setInterval driven by runId + isRunning; cleared on unmount/done.
  useEffect(() => {
    if (!runId || !isRunning) return;

    const tick = async () => {
      try {
        const res = await fetch(`/api/poc/run?runId=${runId}`);
        const data = await res.json();
        if (data.run) setRun(data.run);
        if (Array.isArray(data.events)) setEvents(data.events);
      } catch {
        // PLAIN: Network blip — ignore, we'll retry next tick.
        // TECH:  Silent catch; polling is best-effort.
      }
    };

    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [runId, isRunning]);

  // PLAIN: Click handler for the "Run POC" button.
  // TECH:  Resets state, POSTs to orchestrator, awaits final result.
  const runPoc = async () => {
    setIsRunning(true);
    setEvents([]);
    setRun(null);
    setResult(null);
    setRunId(null);

    try {
      const res = await fetch('/api/poc/run', { method: 'POST' });
      const data = (await res.json()) as PocResult;
      setRunId(data.runId);
      setResult(data);
    } catch (err) {
      setResult({
        runId: '',
        status: 'failed',
        error: (err as Error).message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  // PLAIN: Map step status → emoji-like indicator.
  // TECH:  Pure function; rendered inline.
  const statusIcon = (s: EventRow['status']) =>
    s === 'success' ? '✓' : s === 'failed' ? '✗' : '•';

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 to-indigo-50 p-8">
      <div className="mx-auto max-w-5xl">
        {/* HEADER */}
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Phase 1 POC — End-to-End Pipeline
          </h1>
          <p className="mt-2 text-gray-600">
            Click the button to run the full automation: niche discovery →
            product search → AI content → Pinterest post.
          </p>
        </header>

        {/* RUN BUTTON */}
        <section className="mb-8">
          <button
            onClick={runPoc}
            disabled={isRunning}
            className="rounded-xl bg-rose-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {isRunning ? 'Running…' : '▶ Run POC'}
          </button>
        </section>

        {/* PROGRESS BAR */}
        {run && (
          <section className="mb-8 rounded-xl bg-white p-6 shadow">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">
                Progress: {run.completed_steps} / {run.total_steps} steps
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  run.status === 'success'
                    ? 'bg-green-100 text-green-700'
                    : run.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {run.status}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-rose-600 transition-all"
                style={{
                  width: `${(run.completed_steps / run.total_steps) * 100}%`,
                }}
              />
            </div>
            {run.error_message && (
              <p className="mt-3 text-sm text-red-600">⚠ {run.error_message}</p>
            )}
          </section>
        )}

        {/* LIVE EVENT FEED */}
        {events.length > 0 && (
          <section className="mb-8 rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Live Events
            </h2>
            <ul className="space-y-2 font-mono text-sm">
              {events.map((e) => (
                <li
                  key={e.id}
                  className={`flex gap-3 rounded px-3 py-2 ${
                    e.status === 'failed'
                      ? 'bg-red-50 text-red-800'
                      : e.status === 'success'
                        ? 'bg-green-50 text-green-800'
                        : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="font-bold">{statusIcon(e.status)}</span>
                  <span className="font-semibold">[{e.step_name}]</span>
                  <span className="flex-1">{e.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* FINAL RESULT */}
        {result && result.status === 'success' && result.pin && (
          <section className="rounded-xl bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Result
            </h2>

            <div className="grid gap-6 md:grid-cols-2">
              {/* GENERATED PIN */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Generated Pin
                </h3>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.pin.image_url}
                  alt={result.pin.title}
                  className="w-full rounded-lg shadow"
                />
                <p className="mt-3 font-semibold">{result.pin.title}</p>
                <p className="mt-1 text-sm text-gray-600">
                  {result.pin.description}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {result.pin.hashtags}
                </p>
              </div>

              {/* META INFO */}
              <div className="space-y-4">
                {result.niche && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Niche
                    </h3>
                    <p className="font-semibold">{result.niche.name}</p>
                    <p className="text-sm text-gray-600">
                      {result.niche.reason}
                    </p>
                    <p className="text-xs text-gray-400">
                      AI confidence: {result.niche.score}/100
                    </p>
                  </div>
                )}

                {result.product && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Product
                    </h3>
                    <p className="font-semibold">{result.product.title}</p>
                    <p className="text-sm text-gray-600">
                      {result.product.price ?? '—'}
                    </p>
                    <a
                      href={result.product.affiliate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                    >
                      Affiliate link →
                    </a>
                    <p className="text-xs text-gray-400">
                      Source: {result.product.source}
                    </p>
                  </div>
                )}

                {result.post && (
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                      Pinterest Post
                    </h3>
                    {result.dryRun ? (
                      <p className="text-sm text-yellow-700">
                        Dry run — Pinterest creds not set yet. Pin saved as
                        pending.
                      </p>
                    ) : result.post.pin_url ? (
                      <a
                        href={result.post.pin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View live pin →
                      </a>
                    ) : (
                      <p className="text-sm text-red-600">
                        {result.post.error_message ?? 'Failed'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* FAILURE CARD */}
        {result && result.status === 'failed' && (
          <section className="rounded-xl border border-red-200 bg-red-50 p-6">
            <h2 className="text-xl font-semibold text-red-800">Run Failed</h2>
            <p className="mt-2 font-mono text-sm text-red-700">
              {result.error}
            </p>
            <p className="mt-2 text-sm text-red-600">
              Check the live events above to see which step failed.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
