-- Nerulio service control plane. No table stores file names, file bytes, hashes of
-- files, previews or processing history: user files never leave the browser.
-- All timestamps are Unix epoch milliseconds (UTC).

-- Accounts. The identity key is (provider, provider_subject); e-mail is display data only.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (provider, provider_subject)
);

-- Only SHA-256(raw token) is stored; the raw token exists only in the HttpOnly cookie.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE INDEX sessions_expiry ON sessions (expires_at);

-- Written only by verified billing webhooks (or by an operator for provider 'manual').
CREATE TABLE subscriptions (
  provider TEXT NOT NULL,
  external_subscription_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_customer_id TEXT,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, external_subscription_id)
);
CREATE INDEX subscriptions_user ON subscriptions (user_id, status, current_period_end);

-- One counter per subject (anonymous 'a:…', user 'u:…', abuse bucket 'ip:…') per UTC day.
-- last_operation_id records which operation won the most recent increment, so the
-- authorization batch can tell "counted" from "limit reached" inside one transaction.
CREATE TABLE daily_usage (
  subject_id TEXT NOT NULL,
  day TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  last_operation_id TEXT,
  PRIMARY KEY (subject_id, day)
) WITHOUT ROWID;
CREATE INDEX daily_usage_day ON daily_usage (day);

-- Idempotency record: a retried (subject, operation) returns the stored decision.
CREATE TABLE job_authorizations (
  subject_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'done')),
  allowed INTEGER CHECK (allowed IN (0, 1)),
  used_after INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (subject_id, operation_id)
) WITHOUT ROWID;
CREATE INDEX job_authorizations_created ON job_authorizations (created_at);

-- Webhook de-duplication. state: pending → processed | ignored, all inside one batch.
CREATE TABLE billing_events (
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processed', 'ignored')),
  processed_at INTEGER NOT NULL,
  PRIMARY KEY (provider, event_id)
);
CREATE INDEX billing_events_processed ON billing_events (processed_at);
