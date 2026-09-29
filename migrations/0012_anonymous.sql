-- Anonymous (유동) posting, image uploads and report-driven auto-hide (docs/CLOUDFLARE.md "익명 글쓰기와 이미지").
-- Additive only. Nothing here stores an IP address: a writer is known by
--   anon_id  — the public daily ID ("ㅇㅇ (a3F9)"): HMAC(secret, KST day + network prefix), 4 characters;
--   anon_net — HMAC(secret, network prefix) without the day, for bans and per-network limits. It is cleared
--              after 90 days by the cleanup statements (server/platform/anon.js anonCleanupStatements).
-- The network prefix is the IPv4 /24 or the IPv6 /48 of the client address.

-- Every anonymous post, comment and upload belongs to this one system account row (the FKs to users stay
-- intact; provider 'system' keeps it out of member counts).
INSERT INTO users (id, email, display_name, provider, provider_subject, created_at) VALUES ('anon', NULL, '익명', 'system', 'anonymous', 0);

ALTER TABLE discussions ADD COLUMN anon_name TEXT;          -- nickname typed by the writer (default ㅇㅇ)
ALTER TABLE discussions ADD COLUMN anon_id TEXT;            -- public daily ID
ALTER TABLE discussions ADD COLUMN anon_net TEXT;           -- network HMAC (bans, limits), NULL after 90 days
ALTER TABLE discussions ADD COLUMN anon_pw TEXT;            -- pbkdf2-sha256$iterations$salt$hash of the edit password
ALTER TABLE discussions ADD COLUMN text_hash TEXT;          -- short hash of the normalized text (flood check)
ALTER TABLE comments ADD COLUMN anon_name TEXT;
ALTER TABLE comments ADD COLUMN anon_id TEXT;
ALTER TABLE comments ADD COLUMN anon_net TEXT;
ALTER TABLE comments ADD COLUMN anon_pw TEXT;
ALTER TABLE comments ADD COLUMN text_hash TEXT;
CREATE INDEX discussions_text_hash ON discussions (text_hash, created_at) WHERE text_hash IS NOT NULL;
CREATE INDEX comments_text_hash ON comments (text_hash, created_at) WHERE text_hash IS NOT NULL;
CREATE INDEX discussions_anon_net ON discussions (anon_net) WHERE anon_net IS NOT NULL;
CREATE INDEX comments_anon_net ON comments (anon_net) WHERE anon_net IS NOT NULL;

-- Votes without an account: one per daily key (day + network) per target. The voter key is replaced by an
-- opaque value after 90 days.
CREATE TABLE anon_votes (
  target_kind TEXT NOT NULL CHECK (target_kind IN ('discussion','comment')),
  target_id TEXT NOT NULL,
  voter TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (target_kind, target_id, voter)
) WITHOUT ROWID;
CREATE INDEX anon_votes_created ON anon_votes (created_at);

-- Reports without an account (reporter_id NULL, reporter_key = the daily key) and the finer report
-- categories (illegal_filming, csam, privacy …) that the 0004 CHECK on reason does not list.
ALTER TABLE content_flags ADD COLUMN reporter_key TEXT;
ALTER TABLE content_flags ADD COLUMN category TEXT;
CREATE INDEX content_flags_target ON content_flags (target_kind, target_id, status);

-- Network bans set from the moderation queue ("이 ID 차단 1일/7일/30일").
CREATE TABLE anon_bans (
  net TEXT PRIMARY KEY,
  until INTEGER NOT NULL,
  anon_id TEXT,
  reason TEXT,
  actor_id TEXT,
  created_at INTEGER NOT NULL
) WITHOUT ROWID;

-- Daily counters per network (posts, comments, images, reports, votes) and per-item password attempts.
CREATE TABLE anon_counters (
  key TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, day)
) WITHOUT ROWID;

-- Keyword / domain blocklist, editable later (admin app or D1 console). reject = refuse the write;
-- hide = publish hidden and put it in the moderation queue.
CREATE TABLE blocklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('keyword','domain')),
  pattern TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'reject' CHECK (action IN ('reject','hide')),
  note TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (kind, pattern)
);

-- Community images in R2 (binding UPLOADS). owner binds an upload to its uploader until a post uses it
-- (u:<user id> or a:<HMAC of the anonymous cookie id>); attached_* names the post; removed says who
-- removed it (author, mod, expired). Unattached uploads older than a day are deleted by the cleanup.
ALTER TABLE uploads ADD COLUMN owner TEXT;
ALTER TABLE uploads ADD COLUMN anon_net TEXT;
ALTER TABLE uploads ADD COLUMN attached_kind TEXT;
ALTER TABLE uploads ADD COLUMN attached_id TEXT;
ALTER TABLE uploads ADD COLUMN sha256 TEXT;
ALTER TABLE uploads ADD COLUMN removed TEXT;
CREATE INDEX uploads_attached ON uploads (attached_kind, attached_id) WHERE attached_id IS NOT NULL;
CREATE INDEX uploads_unattached ON uploads (created_at) WHERE attached_id IS NULL;
CREATE INDEX uploads_owner ON uploads (owner, created_at);
