-- Owner-only admin app (docs/CLOUDFLARE.md "관리 앱"): passkey sign-in, Web Push, collector write counts.
-- Minimal writes by design: a passkey sign-in writes one credential update + one session; the notify
-- checks write one small marker row only when a push is actually sent.

-- Passkeys (WebAuthn) of admin accounts. The account itself is a normal users row
-- (provider 'passkey', provider_subject = the WebAuthn user handle) with user_profiles.role='admin'.
CREATE TABLE admin_credentials (
  id TEXT PRIMARY KEY,                       -- credential id (base64url)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,                  -- COSE_Key (base64url), as the authenticator sent it
  alg INTEGER NOT NULL CHECK (alg IN (-7, -257)),   -- ES256 | RS256
  sign_count INTEGER NOT NULL DEFAULT 0,
  transports TEXT NOT NULL DEFAULT '[]',
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);
CREATE INDEX admin_credentials_user ON admin_credentials (user_id);

-- WebAuthn challenges are stateless (HMAC-signed, 5 minutes); a challenge that signed someone in is
-- remembered until it expires so the same assertion cannot be replayed.
CREATE TABLE webauthn_used (
  challenge_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;

-- Web Push subscriptions of admin devices, with that device's notification preferences (JSON).
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  prefs TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_sent_at INTEGER,
  failures INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX push_subscriptions_user ON push_subscriptions (user_id);

-- One row per alert already delivered (usage:2026-09-29:80, cf:steam-news:…), so a check that runs
-- every 30 minutes pushes each event once.
CREATE TABLE admin_alerts (
  key TEXT PRIMARY KEY,
  at INTEGER NOT NULL
) WITHOUT ROWID;

-- Per-run D1 cost of a collector (D1's own rows_written count, and REST queries).
ALTER TABLE collector_runs ADD COLUMN rows_written INTEGER;
ALTER TABLE collector_runs ADD COLUMN queries INTEGER;

-- "Today" counts on the admin overview and community screens read only today's rows.
CREATE INDEX changes_detected ON changes (detected_at);
CREATE INDEX comments_created ON comments (created_at);
CREATE INDEX users_created ON users (created_at);
