-- Nerulio 2.0 shared entity graph: entities, aliases, relations, sources, snapshots, facts,
-- changes, versions, events, availability, compatibility. Timestamps are Unix epoch ms (UTC).
-- JSON values are stored as TEXT. No triggers: all writes go through platform/db/*.

CREATE TABLE entities (
  id TEXT PRIMARY KEY,                       -- 'type:key', e.g. 'gpu:rtx-5070'
  vertical TEXT NOT NULL CHECK (vertical IN ('ai','games','hardware','studio','subculture','tools')),
  type TEXT NOT NULL,
  slug TEXT NOT NULL,
  names TEXT NOT NULL,                       -- {"en":"…","ko":"…"}
  descriptions TEXT NOT NULL DEFAULT '{}',   -- {"en":"…","ko":"…"} short factual text
  image_url TEXT,
  image_credit TEXT,
  regions TEXT NOT NULL DEFAULT '["GLOBAL"]',
  languages TEXT NOT NULL DEFAULT '[]',
  official_urls TEXT NOT NULL DEFAULT '[]',  -- [{"label":"…","url":"https://…"}]
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','hidden','merged','deleted')),
  merged_into TEXT REFERENCES entities(id),
  index_state TEXT NOT NULL DEFAULT 'auto' CHECK (index_state IN ('auto','index','noindex')),
  content_score INTEGER NOT NULL DEFAULT 0,  -- computed by platform/seo.js on write
  version INTEGER NOT NULL DEFAULT 1,        -- bumped on any visible change (cache key)
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (vertical, slug)
);
CREATE INDEX entities_type ON entities (vertical, type, status);
CREATE INDEX entities_updated ON entities (updated_at);

-- Old slugs of renamed or merged entities → permanent redirects.
CREATE TABLE entity_redirects (
  vertical TEXT NOT NULL,
  slug TEXT NOT NULL,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (vertical, slug)
) WITHOUT ROWID;

-- Every searchable name. norm = lower-case, NFKC, spaces/punctuation removed.
CREATE TABLE entity_aliases (
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  norm TEXT NOT NULL,
  alias TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT '*',
  kind TEXT NOT NULL DEFAULT 'alias' CHECK (kind IN ('name','alias','abbr','codename','model_number','store_id')),
  PRIMARY KEY (entity_id, norm)
) WITHOUT ROWID;
CREATE INDEX entity_aliases_norm ON entity_aliases (norm);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,                       -- 'src:…'
  url TEXT,
  title TEXT,
  publisher TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('OFFICIAL','OFFICIAL_API','FEED','CURATED','COMMUNITY','MANUAL_SOURCE','ESTIMATE_METHOD')),
  adapter TEXT,                              -- collector id when automated
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Raw provenance: why Nerulio believes a fact. Large bodies go to R2 (r2_key); excerpt is small.
CREATE TABLE snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES sources(id),
  adapter TEXT,
  url TEXT,
  fetched_at INTEGER NOT NULL,
  http_status INTEGER,
  content_type TEXT,
  checksum TEXT,                             -- sha256 of the fetched body
  byte_size INTEGER,
  r2_key TEXT,
  excerpt TEXT,                              -- parsed/normalized JSON, ≤ 16 KiB
  parser_version TEXT,
  error TEXT
);
CREATE INDEX snapshots_source ON snapshots (source_id, fetched_at);

CREATE TABLE relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  object_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  meta TEXT NOT NULL DEFAULT '{}',
  region TEXT NOT NULL DEFAULT '*',
  valid_from INTEGER,
  valid_until INTEGER,
  verification TEXT NOT NULL DEFAULT 'UNKNOWN',
  source_id TEXT REFERENCES sources(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (subject_id, predicate, object_id, region)
);
CREATE INDEX relations_object ON relations (object_id, predicate);

-- One current row per scope (entity, property, region, language, platform, plan, app_version).
CREATE TABLE facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  property TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '*',
  language TEXT NOT NULL DEFAULT '*',
  platform TEXT NOT NULL DEFAULT '*',
  plan TEXT NOT NULL DEFAULT '*',
  app_version TEXT NOT NULL DEFAULT '*',
  value TEXT NOT NULL,                       -- JSON
  unit TEXT,
  verification TEXT NOT NULL CHECK (verification IN ('OFFICIAL','AUTOMATED','COMMUNITY','COMMUNITY_VERIFIED','DISPUTED','UNKNOWN','ESTIMATE')),
  confidence REAL NOT NULL DEFAULT 1,
  source_id TEXT REFERENCES sources(id),
  snapshot_id INTEGER REFERENCES snapshots(id),
  note TEXT,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER,
  observed_at INTEGER NOT NULL,              -- last time a source confirmed this value
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  created_by TEXT NOT NULL,                  -- 'seed', 'collector:<id>', 'user:<id>'
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX facts_current ON facts (entity_id, property, region, language, platform, plan, app_version) WHERE is_current = 1;
CREATE INDEX facts_entity ON facts (entity_id, is_current);
CREATE INDEX facts_property ON facts (property, is_current);

-- A value that disagrees with the current fact but may not supersede it (lower trust, or equal
-- trust from another source). Resolved in the admin console.
CREATE TABLE fact_conflicts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_id INTEGER NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  verification TEXT NOT NULL,
  source_id TEXT REFERENCES sources(id),
  snapshot_id INTEGER REFERENCES snapshots(id),
  observed_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  resolved_by TEXT,
  resolved_at INTEGER,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX fact_conflicts_open ON fact_conflicts (status, created_at);

-- The history/radar spine. summary is only set for curated or manual changes; generated changes
-- are phrased at render time from (kind, property, old, new) in the reader's language.
CREATE TABLE changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  vertical TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fact_added','fact_changed','fact_removed','version_released','relation_added','relation_removed','availability_changed','compat_changed','event_announced','event_changed','incident','entity_added','note')),
  property TEXT,
  scope TEXT NOT NULL DEFAULT '{}',
  old_value TEXT,
  new_value TEXT,
  summary TEXT,                              -- {"en":"…","ko":"…"} or NULL
  importance INTEGER NOT NULL DEFAULT 2 CHECK (importance BETWEEN 0 AND 3), -- 0 = history only, not on Radar
  source_id TEXT REFERENCES sources(id),
  fact_id INTEGER REFERENCES facts(id),
  ref_id TEXT,                               -- version/event/compat row the change is about
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','pending','hidden')),
  approved_by TEXT,
  effective_at INTEGER NOT NULL,
  detected_at INTEGER NOT NULL
);
CREATE INDEX changes_feed ON changes (visibility, importance, id);
CREATE INDEX changes_vertical ON changes (vertical, visibility, id);
CREATE INDEX changes_entity ON changes (entity_id, id);

CREATE TABLE versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'stable',
  released_at INTEGER,
  build_id TEXT,
  notes_url TEXT,
  source_id TEXT REFERENCES sources(id),
  verification TEXT NOT NULL DEFAULT 'OFFICIAL',
  detected_at INTEGER NOT NULL,
  UNIQUE (entity_id, channel, version)
);
CREATE INDEX versions_entity ON versions (entity_id, released_at);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL, -- the event's own page, if any
  kind TEXT NOT NULL CHECK (kind IN ('release','event','collab','popup','merch_release','broadcast','exhibition','sale','update','other')),
  title TEXT NOT NULL,                       -- {"en":"…","ko":"…"}
  starts_at INTEGER,
  ends_at INTEGER,
  date_precision TEXT NOT NULL DEFAULT 'day' CHECK (date_precision IN ('time','day','month','quarter','year')),
  region TEXT NOT NULL DEFAULT '*',
  location TEXT,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'announced' CHECK (status IN ('announced','confirmed','postponed','cancelled','ended')),
  verification TEXT NOT NULL DEFAULT 'OFFICIAL',
  source_id TEXT REFERENCES sources(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX events_time ON events (starts_at);
CREATE TABLE event_entities (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'about',
  PRIMARY KEY (event_id, entity_id)
) WITHOUT ROWID;
CREATE INDEX event_entities_entity ON event_entities (entity_id);

-- Official/automated availability of a feature/model/service per plan × platform × region.
CREATE TABLE availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,  -- feature or model
  plan_id TEXT NOT NULL DEFAULT '*',         -- plan entity id or '*'
  platform TEXT NOT NULL DEFAULT '*',        -- web | ios | android | windows | macos | api | *
  region TEXT NOT NULL DEFAULT '*',          -- ISO 3166-1 alpha-2 | EEA | *
  state TEXT NOT NULL CHECK (state IN ('available','rolling_out','preview','limited','unavailable','deprecated','unknown')),
  verification TEXT NOT NULL DEFAULT 'OFFICIAL',
  source_id TEXT REFERENCES sources(id),
  note TEXT,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER,
  observed_at INTEGER NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX availability_current ON availability (entity_id, plan_id, platform, region) WHERE is_current = 1;

-- subject (patch/plugin/model) at subject_version × target (game/app/os/gpu) at target_version.
CREATE TABLE compatibility (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  subject_version TEXT NOT NULL DEFAULT '*',
  target_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  target_version TEXT NOT NULL DEFAULT '*',
  env TEXT NOT NULL DEFAULT '{}',            -- {"os":"windows","arch":"arm64","format":"vst3",…}
  env_key TEXT NOT NULL DEFAULT '',          -- canonical string of env for uniqueness
  status TEXT NOT NULL CHECK (status IN ('supported','works','works_with_issues','broken','unsupported','unverified_after_update','unknown')),
  verification TEXT NOT NULL DEFAULT 'UNKNOWN',
  source_id TEXT REFERENCES sources(id),
  note TEXT,
  min_subject_version TEXT,                  -- "update first" guidance
  confirmations INTEGER NOT NULL DEFAULT 0,
  contradictions INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL DEFAULT 0,
  last_confirmed_at INTEGER,
  valid_from INTEGER NOT NULL,
  valid_until INTEGER,
  is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX compatibility_current ON compatibility (subject_id, subject_version, target_id, target_version, env_key) WHERE is_current = 1;
CREATE INDEX compatibility_target ON compatibility (target_id, is_current);

-- Search: one FTS5 trigram index over entities, tools, discussions and wiki text.
CREATE VIRTUAL TABLE search_docs USING fts5(
  doc_key UNINDEXED,                         -- 'entity:gpu:rtx-5070', 'tool:compress', 'discussion:…'
  kind UNINDEXED,
  vertical UNINDEXED,
  locale UNINDEXED,
  title,
  body,
  tokenize = 'trigram'
);
