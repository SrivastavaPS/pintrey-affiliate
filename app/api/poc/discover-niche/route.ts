// =============================================================================
// API ROUTE: POST /api/poc/discover-niche
// =============================================================================
// PLAIN: This endpoint asks Gemini "What's a hot Pinterest niche right now
//        for selling Amazon products in India?" and saves the answer to
//        the database.
//
// TECH:  Next.js App Router POST handler. Calls Gemini in JSON mode with
//        a constrained schema, persists to `niches` table, returns the
//        niche row to the orchestrator.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
// PLAIN: Switched from Gemini to Groq because Gemini free tier is blocked
//        in this region. Same function signatures, same JSON-mode behavior.
// TECH:  Drop-in replacement; lib/groq.ts mirrors lib/gemini.ts API.
import { generateJson, SchemaType } from '@/lib/groq';
import { logEvent } from '@/lib/logger';

// PLAIN: The shape Gemini must return.
// TECH:  Type used to cast the parsed JSON for compile-time safety.
interface NicheResponse {
  name: string;
  reason: string;
  score: number;
}

// PLAIN: This describes the JSON shape we want Gemini to return.
//        Like a fill-in-the-blank form for the AI.
// TECH:  Gemini responseSchema; SchemaType.OBJECT with required fields.
const NICHE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description: 'Short niche name, 2-4 words, e.g., "kitchen gadgets"',
    },
    reason: {
      type: SchemaType.STRING,
      description: 'One sentence explaining why this niche is good RIGHT NOW',
    },
    score: {
      type: SchemaType.NUMBER,
      description: 'Confidence score 0-100 that this niche will earn money',
    },
  },
  required: ['name', 'reason', 'score'],
} as const;

// PLAIN: The actual request handler. Called when the orchestrator hits
//        this URL.
// TECH:  Next.js App Router POST export. Receives runId in JSON body.
export async function POST(req: NextRequest) {
  // PLAIN: Pull the runId out of the request body.
  // TECH:  Standard JSON body parse; bail with 400 if missing.
  const body = await req.json().catch(() => ({}));
  const runId: string | undefined = body.runId;

  if (!runId) {
    return NextResponse.json({ error: 'runId required' }, { status: 400 });
  }

  // PLAIN: Tell the events log we're starting niche discovery.
  // TECH:  Initial 'info' event for traceability.
  await logEvent({
    runId,
    step: 'discover_niche',
    status: 'info',
    message: 'Asking Gemini for a trending Pinterest niche...',
  });

  // PLAIN: The instruction we send to the AI. Specific = better answers.
  // TECH:  Prompt engineered for India market + Pinterest + affiliate fit.
  const prompt = `
You are an expert affiliate marketer running a Pinterest account in India.
Your goal is to pick ONE niche that:
1. Has strong search intent on Pinterest right now (people ARE searching).
2. Has products available on Amazon India.
3. Has visual appeal (looks good in pin images).
4. Is NOT oversaturated (avoid: phone cases, basic clothing, generic gadgets).
5. Has a price range of ₹500–₹5000 (sweet spot for impulse buys).

Examples of GOOD niches: "indoor plant stands", "korean skincare under 1000",
"vastu home decor", "minimalist desk setup", "pre-wedding gifts for couples".

Pick ONE niche that you genuinely believe will convert NOW. Be bold and
specific — narrow niches outperform broad ones.

Return JSON: { name, reason, score }.
  `.trim();

  try {
    // PLAIN: Make the AI call.
    // TECH:  generateJson enforces the schema; throws on parse error.
    const niche = await generateJson<NicheResponse>(prompt, NICHE_SCHEMA);

    // PLAIN: Save the niche to our database so we can use it in the
    //        next step (finding products).
    // TECH:  Insert into niches table; .select().single() returns the row.
    const { data, error } = await supabase
      .from('niches')
      .insert({
        run_id: runId,
        name: niche.name,
        reason: niche.reason,
        score: Math.min(100, Math.max(0, Math.round(niche.score))),
      })
      .select()
      .single();

    if (error) throw new Error(`db insert failed: ${error.message}`);

    // PLAIN: Log success.
    // TECH:  Final 'success' event with the chosen niche in payload.
    await logEvent({
      runId,
      step: 'discover_niche',
      status: 'success',
      message: `Picked niche: "${niche.name}" (score ${niche.score})`,
      payload: { niche },
    });

    // PLAIN: Send the niche back to whoever called us.
    // TECH:  Return DB row to orchestrator for chaining.
    return NextResponse.json({ niche: data });
  } catch (err) {
    // PLAIN: Something broke. Log the error and tell the caller.
    // TECH:  Catch-all error handler; logs to events table + returns 500.
    const message = err instanceof Error ? err.message : 'unknown error';

    await logEvent({
      runId,
      step: 'discover_niche',
      status: 'failed',
      message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
