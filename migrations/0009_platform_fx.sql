-- Reference exchange rates for "≈ ₩" next to USD prices (owner decision 2026-09-29). Filled daily by
-- tools/platform/fx.mjs from the ECB euro reference rates; shown as an approximation, never stored
-- as a price fact.
CREATE TABLE fx_rates (
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate REAL NOT NULL,          -- units of quote per 1 base
  as_of TEXT NOT NULL,         -- the source's reference date (YYYY-MM-DD)
  source_url TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (base, quote)
);
