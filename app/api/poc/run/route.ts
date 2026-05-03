// =============================================================================
// API ROUTE: POST /api/poc/run  (the orchestrator)
// =============================================================================
// PLAIN: This is the "Run POC" button's brain. It chains together all 4
//        steps in order: discover niche → find product → generate content
//        → post pin. If any step fails, it stops and records the failure.
//
// TECH:  Sequential pipeline orchestrator. Calls each sub-route via internal
//        fetch, propagating runId. Updates pipeline_runs row at start/end.
//        Returns final state for the dashboard to render.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { startPipelineRun, endPipelineRun, bumpStepCount, logEvent } from '@/lib/logger';

// PLAIN: Helper to call our own API routes from this server-side handler.
//        We use the request's own host so it works in dev AND production.
// TECH:  Builds absolute URL from x-forwarded-host or host header. Avoids
//        hardcoding localhost so Vercel deployments work too.
function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const protocol = req.headers.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
}

// PLAIN: Calls one of our /api/poc/* sub-routes and returns the JSON.
// TECH:  Wraps fetch with error normalization; throws on non-2xx.
async function callStep(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `step ${path} failed (${res.status}): ${data?.error ?? 'unknown'}`
    );
  }
  return data;
}

// PLAIN: The main pipeline runner.
// TECH:  Sequential await chain; each step depends on previous step's output.
export async function POST(req: NextRequest) {
  // PLAIN: First, create a new run record so we have an ID to track everything.
  // TECH:  Returns UUID; throws if DB unreachable (caller gets 500).
  let runId: string;
  try {
    runId = await startPipelineRun();
  } catch (err) {
    return NextResponse.json(
      { error: `could not start run: ${(err as Error).message}` },
      { status: 500 }
    );
  }

  const baseUrl = getBaseUrl(req);

  await logEvent({
    runId,
    step: 'run',
    status: 'info',
    message: 'POC pipeline started',
  });

  try {
    // -----------------------------------------------------------------------
    // STEP 1: Discover niche
    // -----------------------------------------------------------------------
    // PLAIN: Ask Gemini to pick a hot niche.
    // TECH:  POST /api/poc/discover-niche with runId; receive niche row.
    const step1 = await callStep(baseUrl, '/api/poc/discover-niche', { runId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const niche = (step1 as any).niche as { id: string; name: string };
    await bumpStepCount(runId, 1);

    // -----------------------------------------------------------------------
    // STEP 2: Find products
    // -----------------------------------------------------------------------
    // PLAIN: Search Amazon for the best product in that niche.
    // TECH:  Pass the niche.id into find-products; receive product row.
    const step2 = await callStep(baseUrl, '/api/poc/find-products', {
      runId,
      nicheId: niche.id,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = (step2 as any).product as { id: string; title: string };
    await bumpStepCount(runId, 2);

    // -----------------------------------------------------------------------
    // STEP 3: Generate content
    // -----------------------------------------------------------------------
    // PLAIN: AI writes the title/description and generates the image.
    // TECH:  POST /api/poc/generate-content with productId; get pin row.
    const step3 = await callStep(baseUrl, '/api/poc/generate-content', {
      runId,
      productId: product.id,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pin = (step3 as any).pin as { id: string; image_url: string };
    await bumpStepCount(runId, 3);

    // -----------------------------------------------------------------------
    // STEP 4: Post to Pinterest
    // -----------------------------------------------------------------------
    // PLAIN: Actually publish the pin to Pinterest.
    // TECH:  POST /api/poc/post-pin with pinId; get pinterest_post row.
    const step4 = await callStep(baseUrl, '/api/poc/post-pin', {
      runId,
      pinId: pin.id,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const post = (step4 as any).post;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dryRun = (step4 as any).dryRun ?? false;
    await bumpStepCount(runId, 4);

    // PLAIN: All 4 steps succeeded. Mark the run as success.
    // TECH:  Final UPDATE pipeline_runs; sets ended_at and status.
    await endPipelineRun(runId, true, { completedSteps: 4 });

    await logEvent({
      runId,
      step: 'run',
      status: 'success',
      message: 'POC pipeline completed successfully',
    });

    // PLAIN: Send everything back to the UI so it can show results.
    // TECH:  Single response object with all step outputs for dashboard.
    return NextResponse.json({
      runId,
      status: 'success',
      niche,
      product,
      pin,
      post,
      dryRun,
    });
  } catch (err) {
    // PLAIN: Something broke mid-pipeline. Mark the run as failed.
    // TECH:  Capture error, update run row, return 500 with details.
    const message = err instanceof Error ? err.message : 'unknown error';
    await endPipelineRun(runId, false, { errorMessage: message });
    await logEvent({
      runId,
      step: 'run',
      status: 'failed',
      message,
    });
    return NextResponse.json(
      { runId, status: 'failed', error: message },
      { status: 500 }
    );
  }
}

// PLAIN: GET endpoint to check the status of a run (for the live UI).
// TECH:  Reads pipeline_runs + recent events; used for polling progress.
export async function GET(req: NextRequest) {
  const runId = req.nextUrl.searchParams.get('runId');
  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  // PLAIN: Lazy import to avoid circular deps.
  // TECH:  Dynamic import keeps this route self-contained.
  const { supabase } = await import('@/lib/supabase');

  const [{ data: run }, { data: events }] = await Promise.all([
    supabase.from('pipeline_runs').select('*').eq('id', runId).single(),
    supabase
      .from('events')
      .select('*')
      .eq('run_id', runId)
      .order('created_at', { ascending: true }),
  ]);

  return NextResponse.json({ run, events: events ?? [] });
}
