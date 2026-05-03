// =============================================================================
// SUPABASE CLIENT — connection to our database
// =============================================================================
// PLAIN: This file creates the "phone line" to our Supabase database. Other
//        files import the `supabase` object from here whenever they want to
//        read or write data (e.g., save a niche, log an event).
//
// TECH:  Singleton Supabase client using the service_role key. Server-side
//        only — bypasses Row-Level Security. Re-use this client across all
//        API routes to avoid recreating connections per request.
// =============================================================================

// PLAIN: Import the official Supabase library we just installed.
// TECH:  Named import of the client factory from @supabase/supabase-js.
import { createClient } from '@supabase/supabase-js';

// PLAIN: Read the secret keys from .env.local.
// TECH:  process.env access; throws helpful error if missing in dev.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// PLAIN: If keys are missing, fail loudly so we know to fix .env.local.
// TECH:  Early validation; better than silent runtime errors deep in code.
if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    '[supabase] Missing env vars. Set NEXT_PUBLIC_SUPABASE_URL and ' +
    'SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

// PLAIN: Create the database connection. We use it everywhere via:
//          import { supabase } from '@/lib/supabase'
// TECH:  Singleton instance with service_role auth. `auth.persistSession`
//        is false because this is a server-side, stateless connection.
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // PLAIN: We don't need to remember login state; each request is fresh.
    // TECH:  Disable cookie/session persistence on server-side client.
    persistSession: false,
    autoRefreshToken: false,
  },
});

// =============================================================================
// TYPE DEFINITIONS — what each table row looks like in TypeScript
// =============================================================================
// PLAIN: These tell our code "a niche has these fields, a product has those
//        fields, etc." so TypeScript can catch typos before they crash.
//
// TECH:  Mirrors db/schema.sql. Update both together if schema changes.
//        For Phase 2+ we'll auto-generate these via `supabase gen types`.
// =============================================================================

export type PipelineRunStatus = 'running' | 'success' | 'failed';
export type EventStatus = 'info' | 'success' | 'failed';
export type ProductSource = 'amazon_paapi' | 'mock' | 'library';
export type PinterestPostStatus = 'pending' | 'posted' | 'failed';

export interface PipelineRun {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: PipelineRunStatus;
  error_message: string | null;
  total_steps: number;
  completed_steps: number;
}

export interface Niche {
  id: string;
  run_id: string;
  name: string;
  reason: string | null;
  score: number | null;
  created_at: string;
}

export interface Product {
  id: string;
  niche_id: string;
  asin: string | null;
  title: string;
  price: string | null;
  image_url: string | null;
  product_url: string | null;
  affiliate_url: string;
  source: ProductSource;
  created_at: string;
}

export interface Pin {
  id: string;
  product_id: string;
  image_url: string;
  title: string;
  description: string | null;
  hashtags: string | null;
  generated_at: string;
}

export interface PinterestPost {
  id: string;
  pin_id: string;
  pinterest_pin_id: string | null;
  pin_url: string | null;
  board_id: string | null;
  posted_at: string | null;
  status: PinterestPostStatus;
  error_message: string | null;
  created_at: string;
}
