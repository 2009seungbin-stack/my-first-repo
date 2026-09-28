# Nerulio 2.0 platform — code review

Branch `claude/epic-heisenberg-ey2d3p`, reviewed 2026-09-28 at `bbe057a` plus the uncommitted
`platform/community.js` change (channel-relative ★ threshold). Line numbers refer to that state.
`node --test tests/n2-*.test.mjs`: 151/151 pass. "Verified" means reproduced against
`tools/platform/dev-server.mjs`. Everything else comes from reading the code and says so.

## Summary

| # | Severity | Where | Finding |
|---|----------|-------|---------|
| 1 | High | server/platform/api.js:304-308, 340-343 | Moderators can restrict admins, other moderators and themselves (verified) |
| 2 | High | server/platform/api.js:106-113, 37-43 | Nickname impersonation: another user's default name can be claimed, case variants are allowed, and there is no UNIQUE constraint (verified) |
| 3 | Medium | server/platform/api.js:155-165 | Votes are accepted on hidden, deleted and moderated content and can still earn ★ (verified) |
| 4 | Medium | server/platform/api.js:336-337 | "Hide" then "restore" republishes author-deleted posts and unlocks locked posts |
| 5 | Medium | server/platform/api.js:58-61, 349; pages.js:174-183 | Cache purge misses most cached variants; hidden comments and posts stay served from the edge |
| 6 | Medium | server/platform/api.js:252-264; platform/community.js recomputeCompat | Compat report is not atomic: a concurrent recompute hits the `compatibility_current` unique index, and the report is stored without its post |
| 7 | Low | server/platform/api.js:177-189 | Flags are not checked for an existing target: fake entries fill the moderator queue and transparency counts (verified) |
| 8 | Low | server/platform/api.js:340-348 | Mod actions on a missing user or post succeed and are logged as done (verified) |
| 9 | Low | server/platform/pages.js:122 | A renamed channel's `feed.xml` redirects to `…/feed`, which is a 404 |
| 10 | Low | server/platform/pages.js:167-170; platform/db/channel.js:301 | Sitemaps are never edge-cached; each hit runs an unbounded query with correlated subqueries per entity |
| 11 | Low | server/platform/api.js:311-318 | N+1 queries in the moderator queue (up to 100 extra queries) |
| 12 | Low | server/platform/api.js:271-283 | Benchmarks have no per-user dedupe: one account can move the GPU median |
| 13 | Low | server/platform/api.js:106 | `POST /profile` has no rate limit |
| 14 | Low (UI claim) | platform/render/status.js:57 | "No reported incident" is shown while user reports exist below the spike threshold |

Checked with no issue found: SQL construction, HTML escaping, JSON-LD, RSS/XML escaping, island DOM
building, CSRF, open redirects, account-name leaks, the transparency page, and dev-server isolation
(details at the end).

---

## 1. High — Moderators can restrict admins and each other

`server/platform/api.js:304-308` (`moderator()`) treats `moderator`, `curator` and `admin` as one
level. `modAction` (`:340-343`) then runs `UPDATE user_profiles SET restricted_until=…` on any
`user:<id>` target, including staff accounts and the moderator's own account.

**Scenario (verified):** a user with role `moderator` sends `mod/action` `restrict` against an admin
for 365 days. The response is `{"ok":true}`, and the admin's next write returns
`FORBIDDEN … temporarily restricted`. A compromised or rogue moderator can lock out every admin.
Because `assertMayWrite` runs before every write route, the admin also cannot call
`mod/action unrestrict` on themselves (see `api.js:102-103`, where `assertMayWrite` runs before the
switch). Recovery then requires direct DB access.

**Fix:** before a `user:` action, load the target's role. Refuse the action when the target's role
rank is at or above the actor's rank, or when the target is the actor. Also let `POST /mod/action`
skip `assertMayWrite` for admins, or check moderator status before `assertMayWrite`, so a restricted
admin can still undo it.

## 2. High — Nickname impersonation

`server/platform/api.js:106-113`: the only uniqueness check is an exact-match
`SELECT 1 … WHERE display_name=? AND user_id<>?`. There are three gaps:

* **Default names can be claimed before their owner has a profile.** Profiles are created lazily on
  first write (`ensureProfile`, `:37-43`), so user C's future default `user-xxxxxx` is not in
  `user_profiles` yet. User B can take it. When C writes for the first time, `ensureProfile` inserts
  the same name, because `display_name` has no UNIQUE constraint (`migrations/0004…sql:8`).
  **Verified:** bob set `user-devcar`, then carol posted, and `/api/v2/state` returns
  `user-devcar` for both accounts.
* **Case variants are allowed.** `USER-DEVALI` was accepted while `user-devali` exists (verified).
  The reserved-name regex already uses `/i`, but the uniqueness check does not.
* **Race condition.** Check-then-update allows two concurrent requests to take the same name.

The post and comment SQL fallback (`platform/db/channel.js:140,171`:
`'user-'||lower(substr(u.id,1,6))`) also differs from `defaultNickname()`, which strips
non-alphanumerics first. For ids containing `-` or `_`, the name shown before a profile exists
differs from the one stored later.

**Fix:** reserve the `user-` prefix for generated names in `/profile`. Add a
`UNIQUE INDEX … ON user_profiles(lower(display_name))`, or store a normalized column
(NFKC + lowercase) with a UNIQUE index. Rely on the constraint violation (map it to
`OPERATION_CONFLICT`) instead of the pre-check. Make the SQL fallback use the same derivation as
`defaultNickname`, or create the profile at sign-in.

## 3. Medium — Votes accepted on hidden, deleted and moderated content

`server/platform/api.js:160` looks up only `author_id`. It has no status filter and no entity
status check.

**Scenario (verified):** a moderator hides a post (임시조치). Another user then votes on it, and
the response is `{"up":1,…}`. With `castVote` (`platform/community.js`), a hidden post can also
reach ★ and get `best_at` set. It then reappears in 념글 lists after an `unhide`, and counters keep
moving while the content is under review. The same applies to hidden or deleted comments and to
posts in inactive channels.

**Fix:** select `status` as well. Return `NOT_FOUND` unless the status is `published` (or `locked`
for posts), and for comments also require the parent discussion to be visible.

## 4. Medium — Hide, then restore, overwrites `deleted` and `locked`

`server/platform/api.js:336` sets `status='hidden'` from any status. `:337` restores to
`'published'` whenever the status is `hidden`.

**Scenario (from code):** an author deletes a post (status `deleted`), or staff lock it (`locked`).
A stale flag in the queue is then handled with "임시조치" and later "복구". The deleted post
becomes public again, or the locked thread accepts comments again. This is data loss and could
become a privacy problem, because the author asked for removal.

**Fix:** hide only `published`/`locked` rows, and keep the previous status, either in a
`status_before_hide` column or in the `moderation_actions.meta` of the hide action. Restore to
that saved status. A simpler option is to add `AND status IN ('published','locked')` to hide and
to record the prior status in `meta`.

## 5. Medium — Cache purge misses most cached copies

Cached pages are stored under the full request URL (`server/platform/pages.js:174,183`), including
the canonical query. `purge()` (`api.js:58-61`) deletes only
`cfg.siteOrigin || url.origin` + bare path.

* Channel variants (`?sort=…`, `?kind=…`, `?best=1`, `?page=N`), the community front,
  `/community/best/`, the hub, and `feed.xml` (cached for 600 s via `s-maxage`) are never purged.
* `mod/action` on a **comment** purges nothing (`:349` handles only `discussion`). A hidden comment
  stays on the cached post page until the entry expires.
* When the request host differs from `SITE_URL` (for example `www` versus apex, or a preview
  domain), the purge keys do not match the stored keys.

**Why it matters:** 임시조치 is supposed to make the content disappear at once, and the
transparency page says so. For feeds this can take up to 10 minutes, and for other variants up to
60 s.

**Fix:** on a moderation hide, purge the post URL, the channel's canonical variants you can list,
`feed.xml`, the front page and best pages, in both locales. For comment hides, look up the
discussion and purge its post URL. Alternatively, put a version counter per channel in the cache
key (for example a `channel_rev` read from a cheap row), so a moderation action invalidates all
variants at once. Build purge keys from `url.origin` as well as `siteOrigin`.

## 6. Medium — Compat report is not atomic

`report()` inserts `community_reports` (`api.js:252`), then calls `recomputeCompat` (`:255`), then
calls `createPost` (`:264`) as three separate round trips. `recomputeCompat` reads the current row
and then batch-inserts a new `is_current=1` row. Two concurrent reports for the same key can both
read the old row, and the second batch then violates `compatibility_current`
(`migrations/0003…sql:251`). (Race: from code, not reproduced.)

**Result:** a 500 is returned, but the report row is already stored, is counted in later verdicts,
and has no post. The client retries, which creates a duplicate report.

**Fix:** catch the unique-constraint error in `recomputeCompat` and re-run it once. Make the
report insert and the post creation one `db.batch`. Or create the post first and insert the report
last, so a failure leaves nothing counted.

## 7. Low — Flags accept targets that do not exist

`api.js:177-189` validates only the target's format. **Verified:** flagging
`discussion:doesnotexist` returns `{"ok":true}`. With 10 flags per minute per account, a user can
bury real reports in the queue (ordered oldest first, `LIMIT 100`) and inflate the public
transparency counts.

**Fix:** for `discussion`, `comment` and `user`, check that the row exists (and is not already
hidden) before inserting. Return 404 otherwise.

## 8. Low — Mod actions on missing targets report success

`modAction` never checks affected rows. **Verified:** `restrict user:nobody-here` returns
`{"ok":true}` and writes an action-log row. Restricting a real user who has never written also
does nothing, because there is no `user_profiles` row for the `UPDATE` to change. The same applies
to `hide` on an unknown id. The log then records actions that never took effect.

**Fix:** verify that the target exists first. For users, upsert the profile
(`INSERT … ON CONFLICT DO UPDATE SET restricted_until=…`). Return 404 when nothing matches.

## 9. Low — Renamed channel's feed redirect is broken

`server/platform/pages.js:122` builds the redirect path from `route.page`. For `feed.xml` the page
name is `'feed'`, so the result is `…/{new-slug}/feed`. That path does not match `ROUTE` and falls
through to a 404. It is a cacheable 301 (`max-age=3600`), so feed readers keep failing.

**Fix:** map `feed` to `feed.xml`, or reuse the matched `sub` segment instead of `route.page`.

## 10. Low — Sitemaps are uncached and unbounded

`pages.js:167-170` returns the sitemap response directly and never calls `cache.put`. Worker
responses are not cached by the CDN just because they carry `s-maxage`. `sitemapEntities`
(`platform/db/channel.js:301`) has no `LIMIT` and runs five correlated subqueries per entity. Every
crawler hit scans the whole vertical, and the sitemap may exceed the 50,000-URL limit because each
entity yields 2 or 4 URLs.

**Fix:** store sitemaps with the same `cache.put` path, or precompute them. Page them with
`LIMIT/OFFSET` (for example `sitemap-n2-ai-1.xml`) below 50,000 URLs.

## 11. Low — N+1 queries in the moderator queue

`api.js:314-318` runs one query per flagged target, up to 100. **Fix:** collect ids by kind and
fetch them with two `IN (…)` queries (the `inChunks` helper in `channel.js`).

## 12. Low — Benchmark median can be skewed by one account

`benchmark()` (`api.js:271-283`) inserts a new row every time. The page shows the median and a
count. One account can submit 3 per minute, so it can steer the median for a model × GPU pair.

**Fix:** keep the latest benchmark per (user, model, gpu, runtime, quant) with an upsert, or count
only the latest one per user when aggregating, as `compatVerdict` already does.

## 13. Low — Profile updates are not rate-limited

`POST /profile` (`api.js:106`) has no `limit()`. A user can rename rapidly, which makes impersonation
(#2) easier and churns names on cached pages. **Fix:** `await limit('profile',3)`, and consider a
cooldown on name changes.

## 14. Low (UI claim) — "No reported incident" with user reports present

`platform/render/status.js:57` shows "보고된 장애 없음 / no reported incident" whenever the status
collector has run and there is no spike. A few Nerulio user reports in the last hour (below the
3-report / 3× threshold) still produce this headline, while the chart below shows them. Incidents
are also filtered to URLs containing `status.` (`:23`), so incidents collected from differently
named status hosts are silently dropped. (Uncertain whether any configured adapter uses such a
host.)

**Fix:** use a headline that describes what was checked, such as "공식 장애 없음 · 사용자 리포트
N건" / "No official incident · N user reports", and filter incidents by the adapter's source rather
than by a URL substring.

---

## Checked, no issue found

* **SQL:** every template-literal SQL in `channel.js`, `api.js` and `community.js` interpolates only
  constants, whitelisted identifiers (`table` from a two-value ternary, `ORDER BY` from `SORTS`) or
  `?` placeholder lists. User values are always bound. LIKE input is escaped, and FTS input is
  quoted as a phrase.
* **HTML:** renderers use the escaping `html` tag. `raw()` is used only for `renderMarkdown`
  output (the input is escaped first, links are limited to http(s) and same-site paths, and images
  to the uploads path) and for JSON-LD, where `<` is escaped as `<`. Attribute values,
  including the `data-report` JSON, are escaped. `officialLinks`/status links go through `safeHref`.
* **RSS/XML:** `feed.js` and the sitemap escape all five XML special characters.
* **Islands:** DOM is built with `textContent`/`createElement`. The only `innerHTML` writes the
  constant `''`.
* **CSRF:** every POST goes through `assertSameOrigin`, and requests with neither `Origin` nor
  `Sec-Fetch-Site: same-origin` are rejected (verified). JSON content type is required. GET routes
  have no side effects.
* **Redirects:** canonical-query redirects reuse the matched pathname, which is anchored to
  `/(ko|en)/`. Slug redirects use DB values. Sign-in return paths go through server-side
  `safeReturnPath` (not re-audited here).
* **Cache poisoning:** public pages hold no per-user state, and `mod` and `search` are `no-store`.
  The cache key includes the host.
* **Info leaks:** author names come from `user_profiles` or generated ids. The Google display name
  is used only for `provider='system'`, and email is never selected. The transparency page shows
  aggregates only. Moderator ids appear only in `/mod/queue`, which returns 404 to non-staff.
* **Post numbering:** single `INSERT … SELECT MAX+1` backed by `UNIQUE(entity_id, post_no)`. A lost
  race fails loudly instead of duplicating.
* **Vote counts:** recomputed from `votes` in the same batch. Self-votes are rejected.
* **Dev server:** `/__dev/login` exists only in `tools/platform/dev-server.mjs`, which is referenced
  only by the `dev:platform` npm script. `server/index.js` does not import it.


---
## Status (2026-09-29, same night)
Fixed with regression tests in `tests/n2-api.test.mjs`: #1 role hierarchy (strictly higher rank, no
self-moderation), #2 nicknames (case-insensitive unique index `migrations/0006`, `user-…` reserved,
rate limit — also #13), #3 no votes on hidden/deleted content, #4 hide stores the previous status and
restore returns to it (deleted posts cannot be hidden/republished), #5 purge covers post, channel,
feed, front and 념글 in both languages and hidden comments; stale window cut to 60 s, #6 report post is
created before the verdict and a concurrent recompute retries once, #7 flags need an existing target,
#8 moderator actions on missing targets are 404 and a never-written member gets a profile so a
restriction applies, #9 feed redirect, #10 sitemaps go through the edge cache with a LIMIT, #12 one
benchmark per user per model × GPU × runtime × quantization, #14 the status headline states the
official status and the user-report count separately.
Not changed: #11 (the moderator queue is capped at 100 items; one extra query per item is acceptable
until the queue is busy).
