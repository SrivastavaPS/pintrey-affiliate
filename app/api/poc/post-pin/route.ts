// =============================================================================
// API ROUTE: POST /api/poc/post-pin
// =============================================================================
// PLAIN: Takes a pin we generated and actually posts it to your Pinterest
//        board using Pinterest's official API. Pinterest gives us back a
//        URL to the live pin which we save for tracking.
//
// TECH:  Calls Pinterest API v5 POST /v5/pins. If access token is missing,
//        we mark the post as 'pending' (dry run) so the rest of the
//        pipeline still works during local development.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { logEvent } from '@/lib/logger';

// PLAIN: Pinterest API base URL.
// TECH:  v5 is current. v4 is deprecated.
const PINTEREST_API = 'https://api.pinterest.com/v5';

// PLAIN: The shape of the Pinterest API response when a pin is created.
// TECH:  Subset of fields we care about; full schema at developers.pinterest.com.
interface PinterestPinResponse {
  id: string;
  url: string;
  board_id: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const runId: string | undefined = body.runId;
  const pinId: string | undefined = body.pinId;

  if (!runId || !pinId) {
    return NextResponse.json(
      { error: 'runId and pinId required' },
      { status: 400 }
    );
  }

  await logEvent({
    runId,
    step: 'post_pin',
    status: 'info',
    message: 'Posting pin to Pinterest...',
  });

  try {
    // PLAIN: Get the pin details (image, title, etc.) we want to post.
    // TECH:  Join via FK so we also have the product's affiliate URL.
    const { data: pin, error: pinErr } = await supabase
      .from('pins')
      .select('*, products(affiliate_url)')
      .eq('id', pinId)
      .single();

    if (pinErr || !pin) {
      throw new Error(`pin not found: ${pinErr?.message ?? 'no rows'}`);
    }

    // PLAIN: Pull Pinterest credentials from .env.local.
    // TECH:  Both the access token and target board ID are required to post.
    const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
    const boardId = process.env.PINTEREST_DEFAULT_BOARD_ID;

    // PLAIN: If Pinterest isn't set up yet, do a "dry run" — save a
    //        pending record but don't actually call Pinterest. Lets us
    //        test the full pipeline before Pinterest creds are ready.
    // TECH:  Token guard + dry-run fallback writes to pinterest_posts table.
    const isDryRun =
      !accessToken ||
      !boardId ||
      accessToken.startsWith('your_') ||
      boardId.startsWith('your_');

    if (isDryRun) {
      const { data: dryPost, error: dryErr } = await supabase
        .from('pinterest_posts')
        .insert({
          pin_id: pinId,
          status: 'pending',
          error_message: 'Dry run — Pinterest credentials not configured',
        })
        .select()
        .single();

      if (dryErr) throw new Error(`dry-run insert failed: ${dryErr.message}`);

      await logEvent({
        runId,
        step: 'post_pin',
        status: 'success',
        message: 'DRY RUN — Pinterest creds not set; pin saved as pending.',
        payload: { post: dryPost, dry_run: true },
      });

      return NextResponse.json({ post: dryPost, dryRun: true });
    }

    // PLAIN: Build the request body Pinterest expects.
    // TECH:  Per https://developers.pinterest.com/docs/api/v5/#operation/pins/create
    //        media_source.source_type 'image_url' lets Pinterest fetch the
    //        image themselves (no upload required).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestBody: any = {
      board_id: boardId,
      title: pin.title,
      description: `${pin.description ?? ''}\n\n${pin.hashtags ?? ''}`.trim(),
      // PLAIN: The affiliate link — clicking the pin sends the user here.
      // TECH:  Pinterest's "destination link" field; supports our affiliate URL.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      link: (pin as any).products?.affiliate_url ?? null,
      media_source: {
        source_type: 'image_url',
        url: pin.image_url,
      },
    };

    // PLAIN: Make the actual API call to Pinterest.
    // TECH:  fetch with Bearer auth header; await response and check status.
    const response = await fetch(`${PINTEREST_API}/pins`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // PLAIN: If Pinterest rejected the post, capture the error and bail.
    // TECH:  Read body once; non-2xx → throw with response details.
    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(
        `pinterest api error ${response.status}: ${responseText}`
      );
    }

    const pinterestData = JSON.parse(responseText) as PinterestPinResponse;

    // PLAIN: Save the live Pinterest URL and ID so we can find the pin
    //        later (and track its performance).
    // TECH:  Insert into pinterest_posts with status='posted'.
    const { data: post, error: postErr } = await supabase
      .from('pinterest_posts')
      .insert({
        pin_id: pinId,
        pinterest_pin_id: pinterestData.id,
        pin_url: pinterestData.url,
        board_id: pinterestData.board_id,
        posted_at: new Date().toISOString(),
        status: 'posted',
      })
      .select()
      .single();

    if (postErr || !post) {
      throw new Error(`db insert failed: ${postErr?.message}`);
    }

    await logEvent({
      runId,
      step: 'post_pin',
      status: 'success',
      message: `Pin posted! ${pinterestData.url}`,
      payload: { post },
    });

    return NextResponse.json({ post });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';

    // PLAIN: Save the failed attempt so we can debug later.
    // TECH:  Best-effort insert with status='failed'; don't throw on DB error
    //        (we still need to return the original error to the orchestrator).
    await supabase
      .from('pinterest_posts')
      .insert({
        pin_id: pinId,
        status: 'failed',
        error_message: message,
      })
      .select()
      .single();

    await logEvent({
      runId,
      step: 'post_pin',
      status: 'failed',
      message,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
