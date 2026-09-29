-- Nerulio 2.0 — one-off cleanup of rows written by the pre-fix ingest pipeline (2026-09-29).
-- Branch nerulio/data-pipeline fixed the causes; this removes what they left behind.
--
-- Run AFTER the branch is merged to main (collectors run from main: step 5 would otherwise be undone by
-- the old anilist-schedule adapter on its next run), before or after the seed sync that the merge
-- triggers (either order ends in the same state), on preview first, then production:
--   npx wrangler d1 execute nerulio-preview --remote --config ops/d1.wrangler.toml --file ops/sql/2026-09-29-data-cleanup.sql
--
-- Idempotent: every statement only matches rows that are still wrong; a second run changes nothing.
-- Expected on preview (read-only SELECT COUNTs, 2026-09-29): step 1 → 6 rows, step 2 → 6, step 3 → 4,
-- step 4 → 1 + 1, step 5 → 35 facts (+ 26 entity version bumps). Production: whatever the same conditions match (0 if never affected).
--
-- Not in this file, done by the fixed pipeline itself (same semantics as any edit: the old fact row gets
-- valid_until, a new current row and a `changes` row are written, open conflicts are settled):
--   * the six corrected anime release dates (data/seed/subculture): the push to main triggers
--     .github/workflows/seed-sync.yml for "subculture" (or run it by hand), which also settles the
--     two anilist-schedule conflicts (fact_conflicts 1, 2 → 'accepted', resolved_by 'system:ingest');
--   * REAPER 7.80 → 7.81: the next reaper-whatsnew run (now OFFICIAL) replaces the seeded value and
--     settles conflict 3 the same way;
--   * the second "Deprecation announcement" / "chat-latest snapshot" changelog items: the next
--     gemini-/openai-api-changelog run inserts the missing dated event once (a past item: importance 0).

-- 1. fact_conflicts: the same reading (fact, value, label, source) re-raised on every collector run.
--    Keep the earliest row of each group, whatever its status (the fixed pipeline may already have
--    settled the whole group when the seed sync ran first). Preview: ids 4–9 (6 rows); 1–3 stay.
DELETE FROM fact_conflicts
 WHERE EXISTS (SELECT 1 FROM fact_conflicts e
                WHERE e.fact_id = fact_conflicts.fact_id AND e.value = fact_conflicts.value
                  AND e.verification = fact_conflicts.verification
                  AND COALESCE(e.source_id, '') = COALESCE(fact_conflicts.source_id, '')
                  AND e.id < fact_conflicts.id);

-- 2. changes: exact duplicates (same entity, kind, property, scope, old → new, referenced row).
--    Keep the earliest. Preview: 6 rows (service:gemini-api ×5, service:openai-api ×1).
DELETE FROM changes
 WHERE EXISTS (SELECT 1 FROM changes d
                WHERE d.entity_id = changes.entity_id AND d.kind = changes.kind
                  AND d.property IS changes.property AND d.scope = changes.scope
                  AND d.old_value IS changes.old_value AND d.new_value IS changes.new_value
                  AND d.ref_id IS changes.ref_id AND d.id < changes.id);

-- 3. changes: the remaining date flip-flops of changelog items. A changelog repeated a title on two
--    dates, both items matched one event row, and every run moved its date back and forth. A dated
--    changelog entry never really moves, so a date-only event_changed from these three adapters is
--    always this artifact. Preview: 4 rows (ids 11390, 11658, 11703, 11705).
DELETE FROM changes
 WHERE kind = 'event_changed'
   AND source_id IN ('src:collector-gemini-api-changelog', 'src:collector-openai-api-changelog', 'src:collector-claude-release-notes')
   AND json_extract(old_value, '$.status') = json_extract(new_value, '$.status')
   AND json_extract(old_value, '$.ends_at') IS NULL AND json_extract(new_value, '$.ends') IS NULL;

-- 4. versions: blender-releases recorded the seeded LTS release 4.5.14 a second time as "stable".
--    Ingest now treats stable and lts as the same release. Preview: version 1343 + its change 11204.
DELETE FROM changes
 WHERE kind = 'version_released'
   AND ref_id IN (SELECT CAST(v.id AS TEXT) FROM versions v
                   WHERE v.channel = 'stable'
                     AND EXISTS (SELECT 1 FROM versions l WHERE l.entity_id = v.entity_id AND l.version = v.version AND l.channel = 'lts' AND l.id < v.id));
DELETE FROM versions
 WHERE channel = 'stable'
   AND EXISTS (SELECT 1 FROM versions l WHERE l.entity_id = versions.entity_id AND l.version = versions.version AND l.channel = 'lts' AND l.id < versions.id);

-- 5. facts: anilist-schedule wrote release_date/end_date unscoped ('*') next to the seed's JP/GLOBAL
--    release date, so those works showed two release dates. The adapter now writes into the seeded
--    scope; close the unscoped copies (history kept: is_current=0 + valid_until, like any superseded
--    value). Only works whose seed release date is JP/GLOBAL and not unscoped. Preview: 35 rows.
UPDATE facts
   SET is_current = 0, valid_until = CAST(strftime('%s', 'now') AS INTEGER) * 1000
 WHERE is_current = 1 AND created_by = 'collector:anilist-schedule' AND region = '*'
   AND property IN ('release_date', 'end_date')
   AND EXISTS (SELECT 1 FROM facts s WHERE s.entity_id = facts.entity_id AND s.property = 'release_date' AND s.is_current = 1
                AND s.created_by = 'seed' AND s.region IN ('JP', 'GLOBAL'))
   AND NOT EXISTS (SELECT 1 FROM facts s WHERE s.entity_id = facts.entity_id AND s.property = 'release_date' AND s.is_current = 1
                    AND s.created_by = 'seed' AND s.region = '*')
   AND NOT EXISTS (SELECT 1 FROM facts s WHERE s.entity_id = facts.entity_id AND s.property = facts.property AND s.is_current = 1
                    AND s.region = '*' AND s.created_by <> 'collector:anilist-schedule');
-- Pages of those works re-render from their per-entity version (edge cache key), once: an entity is
-- bumped only while it is older than the close of its unscoped copy (ingest bumps the same way).
UPDATE entities
   SET version = version + 1, updated_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
 WHERE id IN (SELECT f.entity_id FROM facts f
               WHERE f.created_by = 'collector:anilist-schedule' AND f.region = '*' AND f.is_current = 0
                 AND f.property IN ('release_date', 'end_date') AND f.valid_until > entities.updated_at);
