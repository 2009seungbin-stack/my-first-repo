-- Nerulio 2.0 users' side: profiles/reputation, follows, stack, alerts, rollout votes, structured
-- community reports, wiki revisions, discussions, comments, flags, moderation, collectors, analytics.

-- Public profile + trust. users (0001) stays the identity row; this is 1:1 and created lazily.
CREATE TABLE user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE,
  display_name TEXT,
  avatar_key TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','curator','admin')),
  tier TEXT NOT NULL DEFAULT 'new' CHECK (tier IN ('new','contributor','trusted','maintainer','curator')),
  accepted_contributions INTEGER NOT NULL DEFAULT 0,
  rejected_contributions INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 0,
  restricted_until INTEGER,
  banned_at INTEGER,
  ban_reason TEXT,
  locale TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE follows (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, entity_id)
) WITHOUT ROWID;
CREATE INDEX follows_entity ON follows (entity_id);

-- Where the user last read My Radar (unread counts without a notifications table).
CREATE TABLE radar_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_seen_change_id INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

-- My Stack: private by default.
CREATE TABLE stack_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('hardware','ai','studio','games','other')),
  label TEXT,                                -- free text when no entity matches (e.g. "32GB RAM")
  version TEXT,
  detail TEXT NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','unlisted','public')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX stack_items_user ON stack_items (user_id);

CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_id TEXT REFERENCES entities(id) ON DELETE CASCADE,
  kinds TEXT NOT NULL DEFAULT '[]',          -- change kinds, [] = all
  min_importance INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL DEFAULT 'radar' CHECK (channel IN ('radar','email_digest')),
  created_at INTEGER NOT NULL
);
CREATE INDEX alert_rules_user ON alert_rules (user_id);

-- "I have it / Not yet" per user per feature; the latest vote per user counts.
CREATE TABLE rollout_votes (
  feature_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  has_it INTEGER NOT NULL CHECK (has_it IN (0,1)),
  country TEXT NOT NULL DEFAULT '*',         -- ISO 3166-1 alpha-2 chosen by the user
  plan_id TEXT NOT NULL DEFAULT '*',
  platform TEXT NOT NULL DEFAULT '*',
  app_version TEXT,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','hidden','spam')),
  weight REAL NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (feature_id, user_id)
) WITHOUT ROWID;
CREATE INDEX rollout_votes_feature ON rollout_votes (feature_id, status, updated_at);

-- Structured community reports: compatibility results, benchmarks, known issues.
CREATE TABLE community_reports (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('compat','benchmark','issue')),
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,       -- subject (patch, plugin, model, gpu…)
  subject_version TEXT,
  target_id TEXT REFERENCES entities(id) ON DELETE SET NULL,               -- game, app, os, gpu…
  target_version TEXT,
  env TEXT NOT NULL DEFAULT '{}',            -- {"os":"windows","os_version":"11 24H2","arch":"x64","gpu":"gpu:rtx-4070","runtime":"llama.cpp","quant":"Q4_K_M","ctx":8192,"ram_gb":32}
  result TEXT CHECK (result IN ('works','works_with_issues','broken')),
  metrics TEXT NOT NULL DEFAULT '{}',        -- benchmark numbers {"tokens_per_s":…, "vram_gb":…}
  comment TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('private','unlisted','public')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending','published','hidden','spam','deleted')),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight REAL NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX community_reports_entity ON community_reports (entity_id, kind, status, created_at);
CREATE INDEX community_reports_target ON community_reports (target_id, kind, status);
CREATE INDEX community_reports_user ON community_reports (user_id, created_at);

-- The wiki is the entity page: sections × locale, each with a revision chain.
CREATE TABLE wiki_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  locale TEXT NOT NULL,
  content_md TEXT NOT NULL,
  summary TEXT,
  author_id TEXT NOT NULL,                   -- user id or 'seed'
  parent_id INTEGER REFERENCES wiki_revisions(id),
  rollback_of INTEGER REFERENCES wiki_revisions(id),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','pending','reverted','hidden')),
  created_at INTEGER NOT NULL
);
CREATE INDEX wiki_revisions_page ON wiki_revisions (entity_id, section, locale, id);
CREATE TABLE wiki_pages (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  locale TEXT NOT NULL,
  current_revision_id INTEGER REFERENCES wiki_revisions(id),
  locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0,1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (entity_id, section, locale)
) WITHOUT ROWID;

CREATE TABLE discussions (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('question','discussion','guide','issue','benchmark')),
  title TEXT NOT NULL,
  body_md TEXT NOT NULL,
  locale TEXT NOT NULL,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted','locked')),
  score INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  solved_comment_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_activity_at INTEGER NOT NULL
);
CREATE INDEX discussions_entity ON discussions (entity_id, status, last_activity_at);
CREATE INDEX discussions_feed ON discussions (status, last_activity_at);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_md TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX comments_discussion ON comments (discussion_id, created_at);

-- One vote per user per target (discussion/comment/report): +1 helpful / -1.
CREATE TABLE votes (
  target_kind TEXT NOT NULL CHECK (target_kind IN ('discussion','comment','report')),
  target_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value IN (-1,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (target_kind, target_id, user_id)
) WITHOUT ROWID;

CREATE TABLE content_flags (
  id TEXT PRIMARY KEY,
  target_kind TEXT NOT NULL CHECK (target_kind IN ('discussion','comment','report','wiki_revision','fact','entity','user','rollout_vote')),
  target_id TEXT NOT NULL,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam','abuse','wrong_info','source_dispute','duplicate','copyright','other')),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX content_flags_open ON content_flags (status, created_at);

CREATE TABLE moderation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,                      -- hide | unhide | delete | ban | unban | restrict | rollback | merge | approve | reject | resolve_conflict | edit_fact | alias_add | alias_remove
  target_kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX moderation_actions_target ON moderation_actions (target_kind, target_id);
CREATE INDEX moderation_actions_time ON moderation_actions (created_at);

-- Preflight results shared by link (unlisted). Inputs are names/versions only.
CREATE TABLE preflight_runs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  schema TEXT NOT NULL,
  input TEXT NOT NULL,
  result TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'unlisted' CHECK (visibility IN ('private','unlisted')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

-- Collector health, shown in the admin console and as stale-data warnings.
CREATE TABLE collectors (
  adapter TEXT PRIMARY KEY,
  vertical TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'auto' CHECK (mode IN ('auto','manual')),
  enabled INTEGER NOT NULL DEFAULT 1,
  freshness_hours INTEGER NOT NULL DEFAULT 24,
  last_attempt_at INTEGER,
  last_success_at INTEGER,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE collector_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adapter TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  finished_at INTEGER,
  status TEXT NOT NULL CHECK (status IN ('running','ok','partial','error')),
  observations INTEGER NOT NULL DEFAULT 0,
  changes INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX collector_runs_adapter ON collector_runs (adapter, id);

-- First-party analytics with a vertical dimension. visitor = HMAC(anon cookie); no IP, no UA string.
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,                         -- UTC yyyy-mm-dd
  ts INTEGER NOT NULL,
  event TEXT NOT NULL,
  vertical TEXT NOT NULL,
  visitor TEXT NOT NULL,
  signed_in INTEGER NOT NULL DEFAULT 0,
  entity_id TEXT,
  tool_id TEXT,
  locale TEXT,
  source TEXT,                               -- search | direct | referral | social | internal
  device TEXT,                               -- mobile | desktop
  props TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX analytics_events_day ON analytics_events (day, vertical, event);
CREATE INDEX analytics_events_visitor ON analytics_events (visitor, day);
CREATE TABLE analytics_visitors (
  visitor TEXT PRIMARY KEY,
  first_day TEXT NOT NULL,
  first_vertical TEXT NOT NULL,
  first_source TEXT,
  last_day TEXT NOT NULL,
  days_seen INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX analytics_visitors_first ON analytics_visitors (first_day, first_vertical);
-- Distinct (visitor, vertical, day) for retention per vertical.
CREATE TABLE analytics_visits (
  visitor TEXT NOT NULL,
  vertical TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (visitor, vertical, day)
) WITHOUT ROWID;
CREATE INDEX analytics_visits_day ON analytics_visits (vertical, day);

-- Vertical maturity (LIVE / BETA / EXPERIMENT / PAUSED), editable in the admin console.
CREATE TABLE vertical_settings (
  vertical TEXT PRIMARY KEY,
  maturity TEXT NOT NULL CHECK (maturity IN ('LIVE','BETA','EXPERIMENT','PAUSED')),
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

-- Images stored in R2 (avatars, wiki images, small community images). Bytes never pass through D1.
CREATE TABLE uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('avatar','wiki','community')),
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL CHECK (mime IN ('image/webp','image/png','image/jpeg')),
  bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  variants TEXT NOT NULL DEFAULT '{}',       -- {"thumb":"key","medium":"key"}
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','deleted')),
  created_at INTEGER NOT NULL
);
CREATE INDEX uploads_user ON uploads (user_id, created_at);
