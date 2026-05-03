// =============================================================================
// LOGGER — writes events to the "events" table for tracking & debugging
// =============================================================================
// PLAIN: Whenever the robot does something important (or something breaks),
//        it should call logEvent(...) to leave a paper trail. Then later we
//        can look at the `events` table in Supabase to see exactly what
//        happened, in what order, and why something failed.
//
// TECH:  Thin wrapper around supabase.from('events').insert(). Returns
//        the inserted row's ID. Never throws — failed logging shouldn't
//        crash the pipeline, so errors are swallowed and console.error'd.
// =============================================================================

import { supabase } from './supabase';
import type { EventStatus } from './supabase';

// PLAIN: The shape of one log entry.
// TECH:  Argument bag for logEvent() — keyed args > positional for clarity.
export interface LogEventArgs {
  // PLAIN: Which run this log belongs to (the click of "Run POC").
  // TECH:  FK to pipeline_runs.id — required.
  runId: string;

  // PLAIN: Short name of what happened, e.g., "discover_niche".
  // TECH:  String identifier, lowercase_snake_case convention.
  step: string;

  // PLAIN: Was this a success, failure, or just informational note?
  // TECH:  Constrained enum from supabase types.
  status: EventStatus;

  // PLAIN: Human-readable explanation.
  // TECH:  Optional but recommended for debugging.
  message?: string;

  // PLAIN: Any extra data worth saving (API response, params, etc.).
  // TECH:  Stored in JSONB column; must be JSON-serializable.
  payload?: Record<string, unknown>;
}

/**
 * PLAIN: Saves one event row to the database. Use this anywhere you'd
 *        normally console.log — but with structured fields so we can
 *        query/filter later.
 *
 * TECH:  Insert into events table. Errors are caught and logged to
 *        console; never thrown — logging must never break the pipeline.
 */
export async function logEvent(args: LogEventArgs): Promise<void> {
  const { runId, step, status, message, payload } = args;

  try {
    // PLAIN: Insert one row into the events table.
    // TECH:  Supabase JS client; await ensures the write completes before
    //        the next pipeline step runs.
    const { error } = await supabase.from('events').insert({
      run_id: runId,
      step_name: step,
      status,
      message: message ?? null,
      payload: payload ?? null,
    });

    if (error) {
      // PLAIN: Log to terminal if writing to DB failed.
      // TECH:  Don't rethrow — pipeline should continue even if logs fail.
      console.error('[logger] failed to write event:', error.message);
    }
  } catch (err) {
    // PLAIN: Catch-all for unexpected errors (network down, etc.).
    // TECH:  Last-resort safety net.
    console.error('[logger] unexpected error:', err);
  }
}

/**
 * PLAIN: Helper to start a new pipeline run. Returns the run's ID so
 *        every subsequent log can be linked to it.
 *
 * TECH:  Insert into pipeline_runs with status='running' and return id.
 *        Throws on failure (caller can't proceed without a run ID).
 */
export async function startPipelineRun(): Promise<string> {
  const { data, error } = await supabase
    .from('pipeline_runs')
    .insert({ status: 'running' })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`[logger] could not start pipeline run: ${error?.message}`);
  }

  return data.id;
}

/**
 * PLAIN: Mark a run as finished. Pass success=true if everything worked,
 *        or false + an error message if it failed.
 *
 * TECH:  UPDATE pipeline_runs SET status, ended_at, error_message, completed_steps.
 */
export async function endPipelineRun(
  runId: string,
  success: boolean,
  options?: { errorMessage?: string; completedSteps?: number }
): Promise<void> {
  const { error } = await supabase
    .from('pipeline_runs')
    .update({
      status: success ? 'success' : 'failed',
      ended_at: new Date().toISOString(),
      error_message: options?.errorMessage ?? null,
      completed_steps: options?.completedSteps ?? (success ? 4 : 0),
    })
    .eq('id', runId);

  if (error) {
    console.error('[logger] failed to end pipeline run:', error.message);
  }
}

/**
 * PLAIN: Bumps the "completed_steps" counter on a run, so the UI can show
 *        a progress bar (1/4, 2/4, etc.).
 *
 * TECH:  Atomic increment via UPDATE ... SET completed_steps = completed_steps + 1
 *        — but Supabase JS doesn't do raw expressions, so we read-then-write.
 *        Race conditions don't matter here (single-user POC).
 */
export async function bumpStepCount(runId: string, newCount: number): Promise<void> {
  await supabase
    .from('pipeline_runs')
    .update({ completed_steps: newCount })
    .eq('id', runId);
}
