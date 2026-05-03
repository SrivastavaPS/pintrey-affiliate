-- =============================================================================
-- PINTREY AFFILIATE APP — DATABASE SCHEMA (Phase 1 POC)
-- =============================================================================
-- PLAIN: This file creates all the "filing cabinets" (tables) we need to
--        remember what the robot does — what niches it picked, what products
--        it found, what pins it made, and what got posted to Pinterest.
--
-- TECH:  PostgreSQL DDL for Supabase. Defines 6 relational tables with
--        foreign keys, indexes, and timestamps. Run once in Supabase SQL
--        Editor (Dashboard → SQL Editor → New Query → paste → Run).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TABLE 1: pipeline_runs
-- -----------------------------------------------------------------------------
-- PLAIN: Every time you click the "Run POC" button, we create one row here.
--        It's like a logbook entry: "Run #5 started at 9 AM, finished at
--        9:01 AM, status = success."
--
-- TECH:  Top-level audit table. One row per orchestrator invocation. Used
--        by the dashboard to list past runs and their outcomes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pipeline_runs (
  -- PLAIN: A unique ID for this run. Auto-generated.
  -- TECH:  UUID primary key, auto-generated server-side via gen_random_uuid().
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: When the run started.
  -- TECH:  Timestamp with timezone, defaults to current time on insert.
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PLAIN: When the run ended (NULL if still running).
  -- TECH:  Nullable; set by orchestrator on completion or failure.
  ended_at        TIMESTAMPTZ,

  -- PLAIN: Current status — running, success, or failed.
  -- TECH:  Constrained text field; check constraint enforces valid values.
  status          TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'success', 'failed')),

  -- PLAIN: If something broke, the error message goes here.
  -- TECH:  Nullable text; populated only when status = 'failed'.
  error_message   TEXT,

  -- PLAIN: How many steps the pipeline has (always 4 in POC: niche → product → content → post).
  -- TECH:  Static counter for progress UI; hardcoded to 4 in Phase 1.
  total_steps     INTEGER NOT NULL DEFAULT 4,

  -- PLAIN: How many steps have finished so far (used to show progress bar).
  -- TECH:  Incremented by orchestrator after each successful step.
  completed_steps INTEGER NOT NULL DEFAULT 0
);

-- PLAIN: Speeds up queries like "show me the last 10 runs."
-- TECH:  Descending index on started_at for ORDER BY ... DESC LIMIT N queries.
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_started_at
  ON pipeline_runs (started_at DESC);


-- -----------------------------------------------------------------------------
-- TABLE 2: niches
-- -----------------------------------------------------------------------------
-- PLAIN: When the AI picks a niche (like "kitchen gadgets"), we save it here.
--        We also save WHY the AI picked it ("trending on Pinterest in India").
--
-- TECH:  Stores Gemini's niche-discovery output. Linked to the parent
--        pipeline_run via run_id (foreign key with cascade delete).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS niches (
  -- PLAIN: Unique ID for this niche.
  -- TECH:  UUID primary key.
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: Which run produced this niche.
  -- TECH:  FK to pipeline_runs(id). ON DELETE CASCADE = if the run is
  --        deleted, its niches are deleted too (no orphaned data).
  run_id      UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,

  -- PLAIN: The niche name, e.g., "kitchen gadgets" or "vastu home decor."
  -- TECH:  Text, indexed for grouping/aggregation queries later.
  name        TEXT NOT NULL,

  -- PLAIN: Why the AI picked this niche.
  -- TECH:  Free-form text from Gemini's reasoning field.
  reason      TEXT,

  -- PLAIN: A score 0–100 of how good the AI thinks this niche is.
  -- TECH:  Smallint (0–32k range, cheap storage); enforced 0–100 by check.
  score       SMALLINT CHECK (score BETWEEN 0 AND 100),

  -- PLAIN: When this niche record was saved.
  -- TECH:  Auto-set on insert.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_niches_run_id ON niches (run_id);


-- -----------------------------------------------------------------------------
-- TABLE 3: products
-- -----------------------------------------------------------------------------
-- PLAIN: For each niche, the robot finds 1–5 best-selling products on Amazon.
--        Each one gets saved here, including the affiliate link.
--
-- TECH:  Stores Amazon PA-API (or mock) product data plus the constructed
--        affiliate URL. Linked to a niche via niche_id.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: Which niche this product belongs to.
  -- TECH:  FK to niches(id), cascade delete.
  niche_id        UUID NOT NULL REFERENCES niches(id) ON DELETE CASCADE,

  -- PLAIN: Amazon's unique product code (e.g., "B07XJ8C8F5").
  -- TECH:  Amazon Standard Identification Number; 10-char alphanumeric.
  asin            TEXT,

  -- PLAIN: The product name, e.g., "Philips Air Fryer HD9252."
  -- TECH:  Non-null text; truncate at app layer if needed for pin titles.
  title           TEXT NOT NULL,

  -- PLAIN: Price as text (e.g., "₹4,999"). We keep the currency symbol.
  -- TECH:  Stored as text for display fidelity; numeric value can be
  --        parsed app-side if analytics need it.
  price           TEXT,

  -- PLAIN: URL of the product photo.
  -- TECH:  HTTPS URL pointing to Amazon CDN image.
  image_url       TEXT,

  -- PLAIN: The plain Amazon product page URL (no affiliate tag).
  -- TECH:  Canonical product URL.
  product_url     TEXT,

  -- PLAIN: The Amazon URL with our affiliate tag attached. THIS is the link
  --        we attach to the Pinterest pin so we earn commission.
  -- TECH:  product_url with ?tag=<associate_tag> query param appended.
  affiliate_url   TEXT NOT NULL,

  -- PLAIN: Where the product data came from — real Amazon API or mock data.
  -- TECH:  Discriminator field; useful for debugging / filtering test data.
  source          TEXT NOT NULL DEFAULT 'mock'
                  CHECK (source IN ('amazon_paapi', 'mock')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_niche_id ON products (niche_id);
CREATE INDEX IF NOT EXISTS idx_products_asin ON products (asin);


-- -----------------------------------------------------------------------------
-- TABLE 4: pins
-- -----------------------------------------------------------------------------
-- PLAIN: After the AI writes a catchy title and generates an image, we save
--        the pin design here — before posting it to Pinterest.
--
-- TECH:  Stores generated Pinterest pin content (image URL, copy). One pin
--        per product in Phase 1 (1:1 product→pin mapping).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: Which product this pin is for.
  -- TECH:  FK to products(id), cascade delete.
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- PLAIN: The Pinterest-optimized image (generated by Pollinations.ai).
  -- TECH:  HTTPS URL; can be Pollinations URL or Supabase Storage URL.
  image_url       TEXT NOT NULL,

  -- PLAIN: The pin's title (max 100 chars on Pinterest).
  -- TECH:  Pinterest enforces 100 char limit; we truncate app-side.
  title           TEXT NOT NULL,

  -- PLAIN: The pin's description (the longer text below the title).
  -- TECH:  Up to 500 chars per Pinterest spec.
  description     TEXT,

  -- PLAIN: Hashtags like #kitchen #airfryer #recipes (comma-separated).
  -- TECH:  Stored as text; could become text[] later if needed.
  hashtags        TEXT,

  -- PLAIN: When the pin was generated.
  -- TECH:  Auto-set on insert.
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pins_product_id ON pins (product_id);


-- -----------------------------------------------------------------------------
-- TABLE 5: pinterest_posts
-- -----------------------------------------------------------------------------
-- PLAIN: After the pin is posted to Pinterest, Pinterest gives us back a
--        unique pin ID and URL. We save those here so we can find the pin
--        later (and track its performance).
--
-- TECH:  Stores Pinterest API response data after a successful POST /v5/pins.
--        Decoupled from `pins` table so we can retry posting without losing
--        the generated content.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pinterest_posts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: Which pin (our internal pin) was posted.
  -- TECH:  FK to pins(id).
  pin_id              UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,

  -- PLAIN: Pinterest's own ID for this pin (different from our internal ID).
  -- TECH:  Returned by Pinterest API; nullable until POST succeeds.
  pinterest_pin_id    TEXT,

  -- PLAIN: The public URL of the pin on Pinterest.
  -- TECH:  e.g., https://www.pinterest.com/pin/123456/
  pin_url             TEXT,

  -- PLAIN: Which Pinterest board the pin was posted to.
  -- TECH:  Pinterest board ID (string from API).
  board_id            TEXT,

  -- PLAIN: When it was posted.
  -- TECH:  Set on successful API response.
  posted_at           TIMESTAMPTZ,

  -- PLAIN: Whether the post worked or not.
  -- TECH:  Status enum-like text field.
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'posted', 'failed')),

  -- PLAIN: If posting failed, the error message.
  -- TECH:  Captured from API error response or exception.
  error_message       TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pinterest_posts_pin_id ON pinterest_posts (pin_id);
CREATE INDEX IF NOT EXISTS idx_pinterest_posts_status ON pinterest_posts (status);


-- -----------------------------------------------------------------------------
-- TABLE 6: events
-- -----------------------------------------------------------------------------
-- PLAIN: A blow-by-blow log of EVERYTHING the robot does. Each tiny step
--        ("called Gemini," "got products," "uploaded image") becomes one
--        row. This is your CCTV camera for debugging.
--
-- TECH:  Append-only event log. Granular telemetry per pipeline step.
--        payload column stores arbitrary JSON for flexibility.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id          BIGSERIAL PRIMARY KEY,

  -- PLAIN: Which run this event belongs to.
  -- TECH:  FK to pipeline_runs.
  run_id      UUID NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,

  -- PLAIN: Name of the step, e.g., "discover_niche" or "post_pin."
  -- TECH:  Programmatic step identifier; used for filtering/grouping.
  step_name   TEXT NOT NULL,

  -- PLAIN: Did this event succeed, fail, or is it just info?
  -- TECH:  Severity-like enum; 'info' for progress, others for outcomes.
  status      TEXT NOT NULL CHECK (status IN ('info', 'success', 'failed')),

  -- PLAIN: Human-readable note about what happened.
  -- TECH:  Optional message string for human readers.
  message     TEXT,

  -- PLAIN: Any extra data we want to remember (the raw API response, etc.).
  -- TECH:  JSONB column — indexed/queryable, more efficient than JSON.
  payload     JSONB,

  -- PLAIN: When this event happened.
  -- TECH:  High-resolution timestamp.
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_run_id ON events (run_id);
CREATE INDEX IF NOT EXISTS idx_events_step_name ON events (step_name);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events (created_at DESC);


-- =============================================================================
-- DONE.
-- =============================================================================
-- PLAIN: After running this, your Supabase project has 6 empty tables ready
--        to be filled by the robot.
--
-- TECH:  Schema is idempotent (IF NOT EXISTS guards). Safe to re-run.
--        For Phase 1, RLS (Row-Level Security) is intentionally off — single
--        user, server-side only access. Enable RLS in Phase 6 (multi-user).
-- =============================================================================
