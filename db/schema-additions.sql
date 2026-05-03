-- =============================================================================
-- SCHEMA ADDITIONS — product library (Phase 1.5)
-- =============================================================================
-- PLAIN: Run this in Supabase SQL Editor (same way you ran schema.sql).
--        It adds ONE new table to store products YOU manually curate by
--        pasting Amazon URLs. The POC will pick from here instead of mock
--        data.
--
-- TECH:  Idempotent — safe to re-run. Adds product_library table only.
--        Does NOT modify existing tables.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- EXTENSIONS — required by indexes below. MUST be first.
-- -----------------------------------------------------------------------------
-- PLAIN: Turns on Postgres's "trigram" feature so we can do fast fuzzy
--        text search on niche_tags later. Must be enabled BEFORE creating
--        any index that uses gin_trgm_ops.
--
-- TECH:  pg_trgm provides trigram-based ILIKE/similarity matching. Enabled
--        once per database; idempotent via IF NOT EXISTS.
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- -----------------------------------------------------------------------------
-- TABLE: product_library
-- -----------------------------------------------------------------------------
-- PLAIN: Your hand-picked Amazon products, ready to be promoted on Pinterest.
--        Each row = one product you've verified is real and worth promoting.
--
-- TECH:  Decoupled from `products` (which logs per-run picks). This is the
--        catalog; `products` is the history. find-products picks from here.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_library (
  -- PLAIN: Unique ID for this library entry.
  -- TECH:  UUID primary key.
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: The 10-character Amazon code (e.g., B0BS6XRQDF).
  -- TECH:  Amazon Standard Identification Number; extracted from URL.
  asin            TEXT NOT NULL,

  -- PLAIN: The product name, e.g., "Philips Air Fryer 4.5L."
  -- TECH:  Pulled from og:title meta tag (or user-edited).
  title           TEXT NOT NULL,

  -- PLAIN: URL of the product photo.
  -- TECH:  Pulled from og:image meta tag; Amazon CDN URLs are stable.
  image_url       TEXT,

  -- PLAIN: The plain Amazon URL (no affiliate tag).
  -- TECH:  Canonical https://www.amazon.in/dp/<ASIN> form.
  product_url     TEXT NOT NULL,

  -- PLAIN: The URL with your affiliate tag attached. THIS is what we
  --        post to Pinterest so you earn commission.
  -- TECH:  product_url + ?tag=<associate_tag>.
  affiliate_url   TEXT NOT NULL,

  -- PLAIN: Price as text (e.g., "₹1,099"). User-editable since prices
  --        change a lot.
  -- TECH:  Stored as text for display fidelity, no FX/currency math.
  price           TEXT,

  -- PLAIN: Comma-separated niche keywords like "skincare,korean,toner."
  --        AI uses these to match products to discovered niches.
  -- TECH:  Comma-list for Phase 1 simplicity. Can migrate to text[] later.
  niche_tags      TEXT,

  -- PLAIN: Your private notes, e.g., "good for dry skin niche."
  -- TECH:  Free-form; not used by automation, just for your reference.
  notes           TEXT,

  -- PLAIN: Toggle to enable/disable a product without deleting it.
  -- TECH:  find-products WHERE is_active = TRUE.
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,

  -- PLAIN: Where this product came from — manual paste or auto-imported.
  -- TECH:  Discriminator; future PA-API import will set 'amazon_paapi'.
  source          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (source IN ('manual', 'amazon_paapi')),

  -- PLAIN: When you added it.
  -- TECH:  Auto-set on insert.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLAIN: Speeds up "show me all active products" queries.
-- TECH:  Partial index on active rows only — smaller, faster.
CREATE INDEX IF NOT EXISTS idx_library_active
  ON product_library (is_active) WHERE is_active = TRUE;

-- PLAIN: Speeds up niche-tag lookups (e.g., "skincare%").
-- TECH:  GIN index for substring/LIKE queries on niche_tags. Requires
--        pg_trgm extension (enabled at the top of this file).
CREATE INDEX IF NOT EXISTS idx_library_niche_tags
  ON product_library USING gin (niche_tags gin_trgm_ops);

-- PLAIN: Each ASIN should only appear once (you can't add the same product twice).
-- TECH:  Unique constraint; UPSERT-friendly via ON CONFLICT (asin).
CREATE UNIQUE INDEX IF NOT EXISTS idx_library_unique_asin
  ON product_library (asin);


-- -----------------------------------------------------------------------------
-- ALTER products.source — allow 'library' as a valid source value
-- -----------------------------------------------------------------------------
-- PLAIN: The original products table only allowed 'amazon_paapi' or 'mock.'
--        Now we also allow 'library' for products picked from your library.
-- TECH:  Drop and re-add the CHECK constraint with the expanded enum.
-- -----------------------------------------------------------------------------
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE products ADD CONSTRAINT products_source_check
  CHECK (source IN ('amazon_paapi', 'mock', 'library'));
