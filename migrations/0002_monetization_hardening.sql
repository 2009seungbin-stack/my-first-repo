-- Monetization hardening (docs/MONETIZATION-SECURITY.md). Additive only: no existing column
-- changes meaning, so a Worker from before this migration keeps working against it.
-- Still no file names, bytes, hashes of files or processing history anywhere.

-- Accounts flagged by a payment dispute (chargeback). A flagged account is never Pro and
-- cannot start a new checkout until an operator clears the flag (docs/BILLING.md).
ALTER TABLE users ADD COLUMN flagged_at INTEGER;
ALTER TABLE users ADD COLUMN flag_reason TEXT;

-- past_due_since: first moment of the current past_due spell (grace period is measured from it).
-- disputed_at: set by a chargeback/dispute event; a disputed subscription never grants Pro.
-- price_id: the provider price the subscription is on (monthly, yearly, …).
ALTER TABLE subscriptions ADD COLUMN past_due_since INTEGER;
ALTER TABLE subscriptions ADD COLUMN disputed_at INTEGER;
ALTER TABLE subscriptions ADD COLUMN price_id TEXT;

-- Distinct networks (keyed daily HMAC, never an address) a signed-in account was seen from
-- per UTC day. Used only for aggregate abuse stats (one Pro account on many networks).
CREATE TABLE account_activity (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL,
  network TEXT NOT NULL,
  pro INTEGER NOT NULL DEFAULT 0 CHECK (pro IN (0, 1)),
  PRIMARY KEY (user_id, day, network)
) WITHOUT ROWID;
CREATE INDEX account_activity_day ON account_activity (day);

-- Aggregate counters of refusals and abuse signals per UTC day (sign_in_required,
-- network_limit, rate_limited, grace_invalid, daily_limit, …). Counts only.
CREATE TABLE daily_events (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0 CHECK (n >= 0),
  PRIMARY KEY (day, kind)
) WITHOUT ROWID;
