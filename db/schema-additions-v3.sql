-- =============================================================================
-- SCHEMA ADDITIONS V3 — library pins (Phase 2.2 + 2.3)
-- =============================================================================
-- PLAIN: Run this in Supabase SQL Editor after schema-additions-v2.sql.
--        Adds ONE new table for AI-generated pins linked to library products.
--        Decoupled from the existing `pins` table (which is per-POC-run).
--
-- TECH:  Idempotent. Independent from pins/pinterest_posts so we don't
--        disturb the working POC pipeline.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- TABLE: library_pins
-- -----------------------------------------------------------------------------
-- PLAIN: One row per pin generated for a library product.
--        Status flows: pending_review → approved/rejected → posted.
--        "Approved" pins show in /queue for manual posting.
--
-- TECH:  Independent of `pins` (per-run) so we can iterate without
--        breaking the POC orchestrator. FK to product_library cascades
--        delete (delete a product → its pins go too).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS library_pins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PLAIN: Which product in your library this pin is for.
  -- TECH:  FK to product_library(id), cascade delete.
  product_id      UUID NOT NULL REFERENCES product_library(id) ON DELETE CASCADE,

  -- PLAIN: Pin title (max 100 chars per Pinterest spec).
  title           TEXT NOT NULL,

  -- PLAIN: Pin description (max 500 chars per Pinterest spec).
  description     TEXT,

  -- PLAIN: Hashtags (space-separated lowercase).
  hashtags        TEXT,

  -- PLAIN: Image URL — usually the product image, sometimes AI-generated.
  -- TECH:  Pollinations URL or Amazon CDN URL.
  image_url       TEXT,

  -- PLAIN: The AI prompt used to generate the image (if AI-generated).
  -- TECH:  Saved for debugging / regenerating with same prompt.
  ai_image_prompt TEXT,

  -- PLAIN: Pin lifecycle status.
  --   pending_review = waiting for user to approve/reject
  --   approved       = ready to post (shows in /queue)
  --   rejected       = soft-deleted, kept for analytics
  --   posted         = manually posted to Pinterest by user
  -- TECH:  CHECK constraint enforces valid values.
  status          TEXT NOT NULL DEFAULT 'pending_review'
                  CHECK (status IN ('pending_review', 'approved', 'rejected', 'posted', 'failed')),

  -- PLAIN: When the pin was actually posted to Pinterest (if status='posted').
  posted_at       TIMESTAMPTZ,

  -- PLAIN: Pinterest's own ID for this pin (after posting).
  pinterest_pin_id TEXT,

  -- PLAIN: Public URL of the pin on Pinterest (after posting).
  pin_url         TEXT,

  -- PLAIN: Error message if generation/posting failed.
  error_message   TEXT,

  -- PLAIN: When this pin row was created (generation started).
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLAIN: Speeds up "show me pins for this product" lookups.
CREATE INDEX IF NOT EXISTS idx_library_pins_product_id
  ON library_pins(product_id);

-- PLAIN: Speeds up "show me all approved pins" (queue load).
CREATE INDEX IF NOT EXISTS idx_library_pins_status
  ON library_pins(status);

-- PLAIN: Most recent first when listing per product.
CREATE INDEX IF NOT EXISTS idx_library_pins_generated_at
  ON library_pins(generated_at DESC);
