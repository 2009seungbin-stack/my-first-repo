-- Indexes for the read paths of the server-rendered platform pages (docs/n2/research/SITE-AUDIT.md §3):
-- channel bar / popular channels, today's post count, cross-channel lists by tag, board order,
-- Radar releases. D1 bills rows read, so every per-page query must be an index range, not a scan.
CREATE INDEX discussions_created ON discussions (status, created_at);
CREATE INDEX discussions_entity_created ON discussions (entity_id, status, created_at);
CREATE INDEX discussions_kind_created ON discussions (kind, status, created_at);
CREATE INDEX discussions_board ON discussions (entity_id, pinned, post_no);
CREATE INDEX versions_released ON versions (released_at);
CREATE INDEX community_reports_kind_created ON community_reports (kind, entity_id, created_at);
