-- Channels (owner decision 2026-09-29, docs/n2/CHANNELS.md): posts live in 7 big channels instead of
-- one board per entity. Every entity becomes a tag (1–3 per post); the entity page shows the posts of
-- its tag across all channels.
-- Additive only: existing posts, comments, votes, flags and images are untouched. The kind CHECK of
-- discussions cannot be changed without rebuilding the table (whose DROP would cascade to comments),
-- so the new 말머리 (info, review, buy, event, feedback) go into a new `flair` column; `kind` keeps a
-- value its CHECK accepts.

CREATE TABLE channels (
  id TEXT PRIMARY KEY,                       -- the URL segment: /{l}/community/{id}/
  vertical TEXT,                             -- the entity vertical whose tags default here (NULL: none)
  sort INTEGER NOT NULL,
  in_bar INTEGER NOT NULL DEFAULT 1 CHECK (in_bar IN (0,1)),   -- 공지·건의 stays out of the channel bar
  post_seq INTEGER NOT NULL DEFAULT 0,       -- last post number handed out in this channel
  created_at INTEGER NOT NULL
);
INSERT INTO channels (id, vertical, sort, in_bar, post_seq, created_at) VALUES
  ('ai', 'ai', 1, 1, 0, 0),
  ('games', 'games', 2, 1, 0, 0),
  ('hw', 'hardware', 3, 1, 0, 0),
  ('studio', 'studio', 4, 1, 0, 0),
  ('sub', 'subculture', 5, 1, 0, 0),
  ('free', NULL, 6, 1, 0, 0),
  ('notice', NULL, 7, 0, 0, 0);

-- discussions.entity_id is NOT NULL and (entity_id, post_no) is UNIQUE. A post without tags (자유 잡담,
-- 공지) points at its channel's placeholder entity, which is hidden: no page, no sitemap, no search.
INSERT INTO entities (id, vertical, type, slug, names, status, index_state, created_at, updated_at) VALUES
  ('channel:ai', 'ai', 'channel', '-channel', '{"ko":"AI","en":"AI"}', 'hidden', 'noindex', 0, 0),
  ('channel:games', 'games', 'channel', '-channel', '{"ko":"게임","en":"Games"}', 'hidden', 'noindex', 0, 0),
  ('channel:hw', 'hardware', 'channel', '-channel', '{"ko":"PC·하드웨어","en":"PC & hardware"}', 'hidden', 'noindex', 0, 0),
  ('channel:studio', 'studio', 'channel', '-channel', '{"ko":"창작 도구","en":"Creative tools"}', 'hidden', 'noindex', 0, 0),
  ('channel:sub', 'subculture', 'channel', '-channel', '{"ko":"애니·서브컬처","en":"Anime & subculture"}', 'hidden', 'noindex', 0, 0),
  ('channel:free', 'tools', 'channel', '-channel-free', '{"ko":"자유","en":"Free talk"}', 'hidden', 'noindex', 0, 0),
  ('channel:notice', 'tools', 'channel', '-channel-notice', '{"ko":"공지·건의","en":"Notices & feedback"}', 'hidden', 'noindex', 0, 0);

ALTER TABLE discussions ADD COLUMN channel_id TEXT REFERENCES channels(id);
ALTER TABLE discussions ADD COLUMN channel_no INTEGER;     -- the post's number in its channel (/community/{ch}/{no})
ALTER TABLE discussions ADD COLUMN flair TEXT;             -- 말머리 (platform/community.js POST_KINDS); NULL = kind

-- Existing posts: the channel of their entity's vertical, numbered in the order they were written.
UPDATE discussions SET channel_id = CASE (SELECT vertical FROM entities WHERE id = discussions.entity_id)
  WHEN 'ai' THEN 'ai' WHEN 'games' THEN 'games' WHEN 'hardware' THEN 'hw' WHEN 'studio' THEN 'studio'
  WHEN 'subculture' THEN 'sub' ELSE 'free' END
  WHERE channel_id IS NULL;
UPDATE discussions SET flair = kind WHERE flair IS NULL;
UPDATE discussions SET channel_no = x.n
  FROM (SELECT id, ROW_NUMBER() OVER (PARTITION BY channel_id ORDER BY created_at, id) AS n FROM discussions) AS x
  WHERE x.id = discussions.id AND discussions.channel_no IS NULL;
UPDATE channels SET post_seq = (SELECT COALESCE(MAX(channel_no), 0) FROM discussions WHERE channel_id = channels.id);
CREATE UNIQUE INDEX discussions_channel_no ON discussions (channel_id, channel_no);
CREATE INDEX discussions_channel_list ON discussions (channel_id, status, created_at);

-- Tags: 1–3 entities per post, in the writer's order. Posts are found by tag across channels.
CREATE TABLE discussion_tags (
  discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (discussion_id, entity_id)
);
CREATE INDEX discussion_tags_entity ON discussion_tags (entity_id, created_at);
INSERT OR IGNORE INTO discussion_tags (discussion_id, entity_id, pos, created_at)
  SELECT id, entity_id, 0, created_at FROM discussions WHERE entity_id NOT LIKE 'channel:%';

-- The old per-entity numbers, so /{l}/{vertical}/{slug}/{no} answers 301 to the post's new address.
CREATE TABLE legacy_posts (
  entity_id TEXT NOT NULL,
  post_no INTEGER NOT NULL,
  discussion_id TEXT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  PRIMARY KEY (entity_id, post_no)
);
INSERT OR IGNORE INTO legacy_posts (entity_id, post_no, discussion_id) SELECT entity_id, post_no, id FROM discussions;

-- Channels a member pinned to the channel bar (readers without an account keep theirs in the browser).
CREATE TABLE channel_pins (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, channel_id)
);

-- New tags: a member (고정닉) proposes, the owner approves in the admin app (/admin/). Approval creates the
-- entity (hidden from search engines until it has facts) and links the proposal to it.
CREATE TABLE tag_proposals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  name TEXT NOT NULL,
  note TEXT,
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  entity_id TEXT REFERENCES entities(id) ON DELETE SET NULL,
  decided_by TEXT,
  decided_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX tag_proposals_open ON tag_proposals (status, created_at);
