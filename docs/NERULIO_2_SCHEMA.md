# Nerulio 2.0 — schema

D1 (SQLite). Migrations: `0001`–`0002` service layer (accounts, sessions, usage, billing), `0003`
graph, `0004` community, `0005` read-path indexes, `0006` unique nicknames, `0007` fact proposals, `0008` reply alerts (radar_state.replies_seen_at) and author indexes. Timestamps are Unix epoch ms (UTC); JSON is TEXT.
There are no triggers: all writes go through `platform/ingest.js` (graph) or `server/platform/api.js`
(community). Reads go through `platform/db/channel.js`.

## Graph (0003)

```
sources ─< snapshots
   │
entities ─< entity_aliases           (norm = searchable name; prefix search is an index range)
   │  └─< entity_redirects            (old slugs → 301)
   ├─< facts        (entity, property, scope) → value; one current row per scope, history kept
   │     └─< fact_conflicts           (a less-trusted value that may not supersede)
   ├─< relations    subject ─predicate→ object (made_by, translates, appears_in, voiced_by …)
   ├─< versions     (game builds, app/driver releases)
   ├─< events >─ event_entities       (broadcasts, collab cafés, incidents; dedup by url)
   ├─< availability (feature/model × plan × platform × region → state)
   ├─< compatibility (subject@ver × target@ver × env → status; UNVERIFIED_AFTER_UPDATE on new target version)
   └─< changes      (the Radar/history spine; phrased at render time by platform/change-text.js)
search_docs  FTS5 trigram over entity names, aliases, descriptions (Korean without a morphological analyzer)
```

Verification order (a lower one never overwrites a higher one): OFFICIAL > AUTOMATED >
COMMUNITY_VERIFIED > ESTIMATE > COMMUNITY > DISPUTED > UNKNOWN.

## Community (0004)

| Table | Holds | Written by |
| --- | --- | --- |
| `user_profiles` | nickname (never the account name), role, tier, strikes, restriction | `/api/v2/profile`, moderators |
| `follows` | reader × channel | `/api/v2/follow` |
| `radar_state` | last change id the reader has seen (My Radar unread) | `/api/v2/my-radar/seen` |
| `discussions` | posts; `post_no` per channel; `best_at` = 념글; `report_id` for report posts | `/api/v2/posts`, `/reports` |
| `comments` | threaded by `parent_id` | `/api/v2/comments` |
| `votes` | one per user per post/comment | `/api/v2/votes` |
| `community_reports` | compat / issue / benchmark reports (structured, ProtonDB-style) | `/api/v2/reports` |
| `rollout_votes` | "I have it / not yet" per feature | `/api/v2/rollout` |
| `content_flags` | 신고, one open flag per reporter and target | `/api/v2/flags` |
| `fact_proposals` (0007) | 정보 제안: value + source from a member; a moderator accepts it (ingest, COMMUNITY_VERIFIED) or rejects it | `/api/v2/facts/propose`, `/api/v2/mod/action` |
| `moderation_actions` | every hide/unhide/dismiss/restrict with its reason | `/api/v2/mod/action` |
| `collectors`, `collector_runs` | source health: last success, failures | `tools/platform/collect.mjs --d1` |
| `wiki_revisions`, `wiki_pages`, `stack_items`, `alert_rules`, `preflight_runs`, `uploads`, `analytics_*`, `vertical_settings` | defined for later features; not written yet | — |

## Indexes for page reads (0005)

`discussions (status, created_at)` popular channels · `(entity_id, status, created_at)` today's count ·
`(kind, status, created_at)` lists by tag · `(entity_id, pinned, post_no)` board order ·
`versions (released_at)` Radar releases · `community_reports (kind, entity_id, created_at)` status page.
`tests/n2-render.test.mjs` fails if any of these queries turns into a table scan.
