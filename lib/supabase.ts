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

// PLAIN: Read the secret keys from .env.local. We default to empty strings
//        so this file doesn't blow up at build/import time — runtime calls
//        will fail loudly if vars are missing (which is the right place to
//        surface the error, after the build succeeds).
// TECH:  Build-safe: Vercel "collect page data" imports server modules
//        without runtime env access. Throwing here would break the build.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// PLAIN: Warn (don't throw) at startup if vars are obviously missing —
//        helps spot missing config in dev without blocking builds.
// TECH:  console.warn fires once on first import; non-fatal.
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY ' +
    'missing. Database calls will fail until these are set.'
  );
}

// PLAIN: Create the database connection. Use it everywhere via:
//          import { supabase } from '@/lib/supabase'
// TECH:  Singleton client. createClient does not validate keys at
//        construction; bad creds fail at first API call, not at import.
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    // PLAIN: Server-side stateless — no session memory needed.
    // TECH:  Disable cookie/session persistence; each request is fresh.
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
export type LibrarySource = 'manual' | 'amazon_paapi' | 'ai_suggested' | 'auto_extracted';

// PLAIN: Shape of one row in trending_niches (the niches catalog).
// TECH:  Mirrors db/schema-additions-v2.sql.
export interface TrendingNiche {
  id: string;
  name: string;
  description: string | null;
  score: number | null;
  keywords: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

// PLAIN: Shape of one row in product_library.
// TECH:  Mirrors db/schema-additions.sql + v2.
export interface LibraryProduct {
  id: string;
  asin: string;
  title: string;
  image_url: string | null;
  product_url: string;
  affiliate_url: string;
  price: string | null;
  niche_tags: string | null;
  notes: string | null;
  is_active: boolean;
  source: LibrarySource;
  niche_id: string | null;
  created_at: string;
}
export type PinterestPostStatus = 'pending' | 'queued' | 'posted' | 'failed';
export type LibraryPinStatus = 'pending_review' | 'approved' | 'rejected' | 'posted' | 'failed';

// PLAIN: One row in library_pins — an AI-generated pin for a library product.
// TECH:  Mirrors db/schema-additions-v3.sql.
export interface LibraryPin {
  id: string;
  product_id: string;
  title: string;
  description: string | null;
  hashtags: string | null;
  image_url: string | null;
  ai_image_prompt: string | null;
  status: LibraryPinStatus;
  posted_at: string | null;
  pinterest_pin_id: string | null;
  pin_url: string | null;
  error_message: string | null;
  generated_at: string;
}

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
