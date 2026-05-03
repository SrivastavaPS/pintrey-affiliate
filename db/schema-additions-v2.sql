-- =============================================================================
-- SCHEMA ADDITIONS V2 — trending niches catalog (Phase 2.0)
-- =============================================================================
-- PLAIN: Run this in Supabase SQL Editor after schema-additions.sql.
--        Adds a top-level "trending_niches" catalog so the dashboard can
--        group products by niche, and links product_library to it.
--
-- TECH:  Idempotent — safe to re-run. Adds one new table + one nullable FK
--        column on product_library. Existing rows get NULL niche_id (shown
--        in dashboard's "Uncategorised" bucket).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TABLE: trending_niches
-- -----------------------------------------------------------------------------
-- PLAIN: A curated list of niches the AI thinks are worth promoting.
--        Refreshed when you click "Discover niches" (calls Groq).
--        Each product in your library belongs to one primary niche from here.
--
-- TECH:  Singleton catalog table (top-level, not per-run). UNIQUE name to
--        prevent duplicates. last_used_at lets us round-robin niches when
--        the daily cron picks one to focus on.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trending_niches (
  -- PLAIN: Unique ID for this niche.
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: Niche name, e.g., "Korean skincare", "Indoor plants".
  -- TECH:  Lowercased + trimmed at app layer; UNIQUE for upsert ergonomics.
  name            TEXT NOT NULL UNIQUE,

  -- PLAIN: Why the AI picked this niche (1-2 sentences).
  description     TEXT,

  -- PLAIN: 0-100 confidence score that this niche will earn money.
  -- TECH:  Smallint with check constraint.
  score           SMALLINT CHECK (score BETWEEN 0 AND 100),

  -- PLAIN: Keywords the AI suggests for finding products in this niche.
  --        Comma-separated (e.g., "skincare, korean, k-beauty, toner").
  -- TECH:  Used by Phase 2.4 AI suggestions to seed product searches.
  keywords        TEXT,

  -- PLAIN: Toggle to enable/disable a niche without deleting it.
  -- TECH:  Dashboard filters by is_active = true.
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- PLAIN: When this niche was added.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- PLAIN: When the daily pipeline last picked this niche.
  --        Used for round-robin selection (avoid spamming the same niche).
  -- TECH:  Updated by post-pin step in future phase.
  last_used_at    TIMESTAMPTZ
);

-- PLAIN: Speeds up "show me active niches sorted by score."
-- TECH:  Partial index on is_active + score DESC.
CREATE INDEX IF NOT EXISTS idx_trending_niches_active_score
  ON trending_niches (score DESC) WHERE is_active = TRUE;


-- -----------------------------------------------------------------------------
-- ALTER product_library — link products to a primary niche
-- -----------------------------------------------------------------------------
-- PLAIN: Each product now has a "primary niche" pointer. The existing
--        `niche_tags` (comma-separated) still lives — niche_id is for
--        dashboard grouping, niche_tags is for AI fuzzy-matching.
--
-- TECH:  Nullable FK so existing rows keep working. Cascading SET NULL on
--        delete so removing a niche doesn't orphan products.
-- -----------------------------------------------------------------------------
ALTER TABLE product_library
  ADD COLUMN IF NOT EXISTS niche_id UUID
  REFERENCES trending_niches(id) ON DELETE SET NULL;

-- PLAIN: Speeds up "show me all products under this niche."
-- TECH:  Standard FK index for the join used by the dashboard.
CREATE INDEX IF NOT EXISTS idx_product_library_niche_id
  ON product_library (niche_id);


-- -----------------------------------------------------------------------------
-- ALTER product_library.source — allow new sources
-- -----------------------------------------------------------------------------
-- PLAIN: We're adding 'ai_suggested' (AI proposed it, user approved) and
--        'auto_extracted' (future PA-API import) as valid sources.
-- TECH:  Drop and re-add the CHECK constraint with the expanded enum.
-- -----------------------------------------------------------------------------
ALTER TABLE product_library DROP CONSTRAINT IF EXISTS product_library_source_check;
ALTER TABLE product_library ADD CONSTRAINT product_library_source_check
  CHECK (source IN ('manual', 'amazon_paapi', 'ai_suggested', 'auto_extracted'));
