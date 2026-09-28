-- Reply alerts: comments on my posts and replies to my comments since I last looked (My Radar and
-- the header's 알림 count), and the author lookups behind 내 정보 (my posts / my comments).
ALTER TABLE radar_state ADD COLUMN replies_seen_at INTEGER NOT NULL DEFAULT 0;
CREATE INDEX discussions_author ON discussions (author_id, created_at);
CREATE INDEX comments_author ON comments (author_id, created_at);
CREATE INDEX comments_parent ON comments (parent_id) WHERE parent_id IS NOT NULL;
-- Vote clicks check whether a report belongs to a post (docs/n2/research/CODE-REVIEW-2.md #11).
CREATE INDEX discussions_report ON discussions (report_id) WHERE report_id IS NOT NULL;
