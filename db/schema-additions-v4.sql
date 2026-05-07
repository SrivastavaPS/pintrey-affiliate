-- =============================================================================
-- SCHEMA ADDITIONS V4 — niche product suggestions (Phase 2.4)
-- =============================================================================
-- PLAIN: Run this in Supabase SQL Editor after schema-additions-v3.sql.
--        Adds ONE table to cache AI-generated product name suggestions
--        per niche (e.g., "Mamaearth Onion Hair Oil" for hair-care niche).
--        Saves you from typing each product URL — you click → search Amazon
--        → grab the URL → paste back into /products/add.
--
-- TECH:  Idempotent. Decoupled from product_library so caching suggestions
--        doesn't mutate the library. After user adds the real product, we
--        link suggestion → product_library row.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TABLE: niche_product_suggestions
-- -----------------------------------------------------------------------------
-- PLAIN: Each row = one product the AI thinks would do well in the niche.
--        It's just a NAME (no URL, no image) — the user verifies on Amazon.
--
-- TECH:  status lifecycle:
--          'pending'   = AI suggested it, waiting for user action
--          'added'     = user found the real product on Amazon and added
--                        it to product_library (added_product_id is the FK)
--          'dismissed' = user said "not interested" (kept for analytics)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS niche_product_suggestions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: Which niche this suggestion is for.
  -- TECH:  FK; cascade delete (delete a niche → its suggestions go too).
  niche_id            UUID NOT NULL REFERENCES trending_niches(id) ON DELETE CASCADE,

  -- PLAIN: Suggested product name, e.g., "Mamaearth Onion Hair Oil 250 ml".
  product_name        TEXT NOT NULL,

  -- PLAIN: Brand if AI knows it (e.g., "Mamaearth").
  brand               TEXT,

  -- PLAIN: Rough price range hint, e.g., "₹300-500" — for user to verify.
  approximate_price   TEXT,

  -- PLAIN: One sentence explaining why this product fits the niche.
  why_relevant        TEXT,

  -- PLAIN: Optimised search query for Amazon India.
  --        e.g., "Mamaearth Onion Hair Oil 250ml original"
  search_query        TEXT NOT NULL,

  -- PLAIN: Has the user acted on this suggestion yet?
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'added', 'dismissed')),

  -- PLAIN: If added, link to the product_library row the user created.
  added_product_id    UUID REFERENCES product_library(id) ON DELETE SET NULL,

  -- PLAIN: When the AI generated this suggestion.
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLAIN: Speeds up "show me suggestions for niche X" lookups.
CREATE INDEX IF NOT EXISTS idx_suggestions_niche_id
  ON niche_product_suggestions (niche_id);

-- PLAIN: Speeds up filtering by status (e.g., only pending).
CREATE INDEX IF NOT EXISTS idx_suggestions_status
  ON niche_product_suggestions (status);
