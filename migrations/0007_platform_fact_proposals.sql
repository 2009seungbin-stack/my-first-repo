-- Fact proposals: a member suggests a value with a source (from a channel or a post); a moderator
-- accepts it into the graph through the ingest pipeline (as COMMUNITY_VERIFIED, never above an
-- official value) or rejects it. COMPETITORS.md #7 ("념글에서 위키 사실로 승격").
CREATE TABLE fact_proposals (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  property TEXT NOT NULL,
  value TEXT NOT NULL,                 -- JSON
  unit TEXT,
  source_url TEXT NOT NULL,
  note TEXT,
  discussion_id TEXT REFERENCES discussions(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','rejected')),
  reviewer_id TEXT,
  reviewed_at INTEGER,
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX fact_proposals_status ON fact_proposals (status, created_at);
CREATE INDEX fact_proposals_entity ON fact_proposals (entity_id, status);
