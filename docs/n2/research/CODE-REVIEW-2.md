# Code review 2 — Nerulio 2.0 changes of 2026-09-27/28

Scope: `git diff f5aaf94..HEAD -- server/ platform/ src/platform/ migrations/` on branch
`claude/epic-heisenberg-ey2d3p` (HEAD 8c02d59), read together with the surrounding code. Every
finding below was verified by reading the code. #1–#7, #9 and #11 were also reproduced with
throwaway scripts on the `tests/d1-shim.mjs` harness or checked with EXPLAIN QUERY PLAN. `node --test tests/n2-*.test.mjs` (167/167 pass)
and `npx tsc --noEmit -p .` (clean) run green, so none of these are covered by the current tests.

## Findings

| # | Severity | Location | Finding |
|---|----------|----------|---------|
| 1 | High | platform/markdown.js:48, :58 | A line that starts with `\|` but does not end with `\|`, followed by a `---` separator line, sends `renderMarkdown` into an infinite loop. Any member can use this to take down a post page (post body or comment). |
| 2 | High | server/platform/api.js:591-592, platform/render/panels/generic.js:34, platform/db/channel.js:57, api.js:526 | An accepted proposal is written with scope `*`. When the OFFICIAL fact is region-scoped (JP price, KR/JP dates) or language-scoped (`price_note` ko), no conflict is recorded and the wiki shows the community value **instead of** the official one. The mod queue shows the official value as "current", which misleads the moderator. |
| 3 | Medium | server/platform/api.js:396 + platform/community.js:166 | When removing a vote leaves a patch-version combination with no reports, `recomputeCompat` returns early on `unknown`, so the old verdict stays current even though nothing supports it. |
| 4 | Medium | server/platform/api.js:486, :490 | Open data exports compat reports whose post the author deleted or a moderator hid, because `community_reports.status` is never synced with the post. It also exports `unlisted` reports. |
| 5 | Medium | server/platform/api.js:388-412 | `POST /reports` validates `title` only after the DELETE of the user's votes and the INSERT of the report have run. A 400 response then leaves an orphan report (no post, so it cannot be moderated) that still counts, and it leaves verdicts un-recomputed. |
| 6 | Medium | server/platform/api.js:120, src/platform/islands.js:249 | When staff edit a 공지 (notice), the tag select has no `notice` option, so the browser picks the first kind and the save silently turns the notice into 한글패치 or 질문. |
| 7 | Medium | platform/render/write.js:35, server/platform/api.js:33, platform/render/panels/game.js:45 | The write page now pre-fills the game's latest version, but `optVersion` rejects real version strings such as `Hotfix #36` (Baldur's Gate 3), so the report form fails with "Invalid version" on those games. The vote strip already had the same problem. |
| 8 | Low | server/platform/api.js:588, :594 | Proposal review is check-then-write: two moderators can accept the same proposal twice, or accept and reject it concurrently. The fact is ingested and the proposal still ends up `rejected`. |
| 9 | Low | server/platform/api.js:275, platform/render/format.js:100, :107 | A proposal's `unit` is never validated for non-money properties or for money properties with a fixed unit, yet it overrides the property's own unit when displayed. The API also accepts `url`-type properties that the form hides. |
| 10 | Low | server/platform/api.js:90, :486, :490 | `GET /open-data/compat` is anonymous, has no rate limit and no edge cache (the `Cache-Control: public` header does nothing for a Worker response). Each hit runs a full GROUP BY or a read of up to 50,000 rows, and months over 50,000 rows are truncated without any flag. |
| 11 | Low | server/platform/api.js:388-389, migrations/0004:142 | Every bare vote click runs a `DELETE … NOT EXISTS (… discussions.report_id …)`. With no index on `discussions.report_id`, that means full scans of `discussions`: one for the subquery and one for the FK `ON DELETE SET NULL` of each deleted row. |
| 12 | Low | server/platform/api.js:282, :522-523 | Proposals are limited to 5 per minute per user, with no cap on open proposals. The queue shows the oldest 50 first, so one member can bury everyone else's proposals. |

Checked with no finding: the new GETs (`/mine`, `/comments/source`, `/posts/source`, `/my-radar`
replies, `/state` flag and compat) are all scoped to `context.user.id` and return only published
or locked content. All POSTs go through `assertSameOrigin`. Per-user API responses keep
`Cache-Control: no-store`, and only `/open-data/compat` is public, answered before the session
lookup and without Set-Cookie. All SQL is parameterized, and IN lists stay under 100 parameters
(`modTargets` chunks by 90, `hk` ≤ 50, events ≤ 30, posts ≤ 40). The islands build DOM with
`textContent`, and the one `innerHTML=''` holds no data. `data-back` and the mod-queue links come
from the server (`postUrl`, `channelUrl`, or an `^https?://` source URL). Table cells in
markdown go through the same escaping `inline()`. Migrations 0007 and 0008 are valid on
SQLite/D1, and `comments_parent` (partial) and `comments_author` are used by the reply queries
(checked with EXPLAIN QUERY PLAN).

---

## 1. High — Markdown table detection loops forever

`renderMarkdown` checks for a table start with `/^\s*\|.*\|\s*$/` (line 48): the line must end
with `|`. The paragraph collector at line 58 stops at any line matching `/^\s*\|/` when the next
line is a separator (`TABLE_SEP`), without checking for the trailing pipe. For input such as

```
| a | b
|---|---|
```

the table branch does not match. The paragraph loop then stops before it consumes anything, so it
pushes `<p></p>` without advancing `i`, and the outer `while` repeats forever. `out` grows until
the isolate runs out of memory or CPU.

Reproduced with `renderMarkdown('hello\n| a\n---')`: it had not returned after 3 s inside a
worker thread.

Failure scenario: a member writes a post, or a comment on any post, with a table that has no
trailing pipe, which is a very common way to write one. Every render of that post page
(`platform/render/post.js:50`, `:69`) hangs until the Worker is killed. The `try/catch` in
`handlePlatformPage` cannot catch that, and nothing is cached, so every view repeats it. The post
cannot be read or flagged from the page, and a moderator can act on it only through the queue.

Fix: make both checks use the same predicate. Use one `isTableStart(i)` that tests
`/^\s*\|.*\|\s*$/.test(lines[i]) && TABLE_SEP.test(lines[i+1]||'')` in both places, or accept a
table row without the trailing pipe in both places. Also add a guard: if the paragraph buffer is
empty, push the line as a paragraph and `i++`. Add a regression test with the input above.

## 2. High — An accepted proposal outranks OFFICIAL facts that have a region or language

`modAction` accept (api.js:591-592) ingests `{p, v, ver:'COMMUNITY_VERIFIED'}` with no scope,
which gives region `*` and language `*`. `ingest` looks for a conflict only in the **same scope
key** (ingest.js `scopeKey`). An OFFICIAL row with region `JP` or language `ko` is therefore not a
conflict: a second current row is inserted next to it. The display pickers then prefer the `*`
row whenever the reader's region has no row of its own:

- `factRows` (generic.js:34): `cand.find(x=>x.region===ctx.region||x.region==='*'||…)`. On Korean
  pages (`KR`) and English pages (`US`), a JP-only official price loses to the `*` community row.
- The language sort (generic.js:32-33, channel.js `pickFact`) puts `*` ahead of `ko`, so on
  English pages a community `price_note` hides the official Korean note.

The mod queue's "current" value (api.js:526) orders by KR, then `*`, then any other region, so it
shows the official JP value. The moderator sees "Now: 16500 JPY (OFFICIAL)". The form, the queue
and the policy all promise that official values are never replaced.

Reproduced: merchandise `price` 16500 JPY with region JP, OFFICIAL. A member
proposes `1 JPY` with any https source. The moderator accepts, `fact_conflicts` gets 0 rows, and
both the ko and en wiki show `¥1 ● 커뮤니티 검증`. Across the seeds this affects 41 goods prices,
27+27 pre-order dates, 36 release dates, 40 streaming lists and 12 AI price notes.

Fix: on accept, treat any current OFFICIAL or AUTOMATED row of the same entity and property (in
any region or language with plan `*`) as a conflict, and record it in `fact_conflicts` instead of
inserting. The alternative is to have the moderator choose the scope, with the region defaulting
to the official row's region, and to reject a less trusted value in that scope. Also make the mod
queue list every current row for the property, with its region, rather than a single one.

## 3. Medium — A vote removed by "one voice per game version" leaves a stale verdict

`recomputeStale` (api.js:396) recomputes each patch version whose bare vote was just deleted.
When that deletion removed the last report for the combination, `compatVerdict` returns `unknown`.
`recomputeCompat` then returns early (community.js:166) and never closes the current
`compatibility` row.

Reproduced: user A casts a bare vote `broken` on patch 1.6 × game 2.3.1, and
compatibility 1.6×2.3.1 becomes `broken/COMMUNITY`. A then files a detailed report on patch 1.7.
The 1.6 vote is deleted, `community_reports` has 0 rows for 1.6, and the 1.6×2.3.1 row still says
`broken`. The game panel and the history keep showing a verdict that no one supports.

Fix: when the verdict is `unknown` and the current row is non-OFFICIAL and was made by the
community (status in works/works_with_issues/broken with verification COMMUNITY,
COMMUNITY_VERIFIED or DISPUTED), close it (`is_current=0, valid_until=now`). Optionally insert an
`unknown`/`UNKNOWN` row as well.

## 4. Medium — Open data publishes reports that the author deleted or moderators hid

`openCompat` selects `status='published' AND visibility<>'private'` from `community_reports`.
Nothing ever updates `community_reports.status`: `POST /posts/delete` and `mod/action hide` change
only `discussions.status`, and a grep for `UPDATE community_reports` finds nothing. The free-text
`env.os` and `env.device` values of such a report are exported too.

Reproduced: A's detailed report post is deleted by A, and `GET /open-data/compat?month=2026-09`
still lists it. A report whose post a moderator hides as spam keeps counting in the ODbL dump,
which third parties may mirror permanently. The same rows also keep counting in `recomputeCompat`
and in `/state` compat. `visibility<>'private'` also exports `unlisted` reports, even though the
description says "published".

Fix: when a report post is deleted, hidden or unhidden, set the linked
`community_reports.status` in the same batch (deleted/hidden/published), and recompute the
verdict. Alternatively, have `openCompat` (and `recomputeCompat`) exclude reports whose linked
discussion is not published or locked. Export only `visibility='public'`.

## 5. Medium — `POST /reports` writes before its last validation

In `report()`, the order is: DELETE the user's bare votes (line 388) → INSERT the report (392) →
`text(body.title,[2,120])` (410) → `createPost` → `recompute`. When the title is too short, too
long or not a string, the request fails with 400 after the first two writes.

Reproduced: user B casts a bare vote on 1.6, then sends a detailed report on 1.8 with
`title:'a', comment:'x'`. The response is 400, B's 1.6 vote is gone, and a 1.8 report with a
comment and **no post** remains. No verdict is recomputed. Because it has a comment, the orphan
report is never replaced by later votes, and because it has no post, a moderator cannot hide it.
Retries create more orphans, and each retry uses up one of the 3 per minute.

Fix: validate everything, including the title and the `quick` inputs, before the first write.
Put the DELETE, the INSERT and the post creation into one `db.batch` so that a double-click
cannot interleave (today two concurrent quick clicks both delete nothing and both insert).

## 6. Medium — Editing a notice turns it into another tag

`GET /posts/source` returns `kinds` = `writableKinds(vertical)` without `report`, which never
includes `notice` (it is staff-only). The edit form (islands.js:249) builds a `<select>` from that
list and marks the current kind as `selected`. No option matches, so the browser selects the
first one (`patch` on game channels, `question` elsewhere), and the save sends it. The server
accepts it because `patch` is writable (api.js:216-218).

Reproduced: a moderator posts a `notice`, and `/posts/source` returns
`kinds:[patch,question,guide,screenshot,free]`. An edit that sends the first option stores
`kind='patch'`. Any moderator who fixes a typo in a notice demotes it off the 공지 tab.

Fix: when `!kinds.some(k=>k.id===p.kind)`, return `kinds:[]` (no select) or prepend the current
kind. On the server, keep allowing `notice` for staff when it is unchanged.

## 7. Medium — Pre-filled game versions that the API rejects

`optVersion` allows only `[\w.+\- ()*]`. Real version names in the seed contain `#`: "Hotfix #36"
and "Hotfix #1" (BG3 `game:steam-1086940`, `steam-2879840`, `steam-1144200`, `steam-1867240`,
among others). The write page now fills `targetVersion` with `m.versions[0]` (write.js:35), so a
member who submits the form unchanged gets "버전 형식이 올바르지 않아요". The game panel's vote strip
sends `data-target-version="${cur.version}"` (game.js:45, from before tonight), so every bare vote
on those games fails with 400.

Reproduced: `POST /reports {targetVersion:'Hotfix #36'}` → 400 "Invalid version."

Fix: widen `optVersion` to accept any printable text up to 40 characters without control
characters, since it is always bound as a parameter and escaped on output. The alternative is to
accept any version that exists in `versions` for the target.

## 8. Low — Race in proposal review

`modAction` reads `pr.status`, runs `ingest`, then writes
`UPDATE fact_proposals … WHERE id=?` with no `AND status='open'`. If two moderators click at the
same time, both pass the check. With accept + accept, the fact is ingested twice and two log
entries are written. With accept + reject, the value goes into the wiki while the proposal and the
log say "rejected".

Fix: claim the proposal first with
`UPDATE fact_proposals SET status='reviewing' … WHERE id=? AND status='open'` (or go straight to
the final state), check `meta.changes===1`, and only then ingest. Roll back to `open` if the
ingest fails.

## 9. Low — Unvalidated `unit` on proposals; `url` properties reachable through the API

`fact.unit=String(body.unit)` is checked by `validateSeed` only for money properties that have no
fixed unit. Anywhere else it can be any string, up to the 8 KB body limit (verified: a 4000-char
`unit` on a date property gives 201). `factText` shows `f.unit||def.unit` (format.js:100, :107), so
an accepted proposal can show "12 TB" on a GB field, or ₩ on a USD price. The moderator sees the
unit, so this is data quality rather than an exploit. `proposeForm` hides `type:'url'` properties,
but the API does not refuse them.

Fix: allow `unit` only when `def.type==='money' && !def.unit` and it matches `/^[A-Z]{3}$/`;
otherwise reject it or drop it. Reject `def.type==='url'` on the server as well.

## 10. Low — Open-data endpoint cost and silent truncation

`/api/v2/open-data/compat` sends `Cache-Control: public, max-age=3600`, but the Worker does not use
`caches.default` for `/api/v2`, and Cloudflare does not cache Worker responses by default. Every
anonymous request, including one with junk query parameters, therefore runs the query. Without
`month`, it is a GROUP BY over every compat report using `strftime` (the plan shows `USE TEMP
B-TREE`). With `month`, it reads up to 50,000 rows and stringifies them. There is no rate limit.
A month with more than 50,000 reports is cut off with no `truncated` or next-page marker, which
matters for a published dataset.

Fix: serve it through the Cache API (keyed on the canonical `?month=`, with other parameters
redirected or ignored) or build it into R2 once a day. Add an IP rate limit, and paginate
(`?after=`) or return `truncated:true`.

## 11. Low — Missing index on `discussions.report_id`

The new quick-vote DELETE in `report()` has a correlated
`NOT EXISTS (SELECT 1 FROM discussions d WHERE d.report_id=community_reports.id)`, and
`discussions.report_id REFERENCES community_reports(id) ON DELETE SET NULL`. EXPLAIN QUERY PLAN
shows `SCAN d | SCAN discussions`. Every "✓ 작동" click on a game, and every "안 돼요" click within
the hour, costs one or more full scans of the discussions table (D1 bills rows read) and gets
slower as the boards grow.

Fix: in a new migration, `CREATE INDEX discussions_report ON discussions (report_id) WHERE
report_id IS NOT NULL;`.

## 12. Low — The proposal queue can be flooded

`limit('proposal',5)` allows 5 per minute, which is about 7,200 per day per account, with no cap
on open proposals per user or per entity-property. `modQueue` shows the 50 oldest open
proposals, and it runs one `facts` lookup per proposal. One member can keep the queue filled with
their own items, so real proposals never reach the first page.

Fix: cap open proposals per user (for example 20) and per entity+property+user (1: a repeat
updates the existing one). Use a per-day rate limit. Order or group the queue by author.

---

## Status (2026-09-29 ~04:55 KST)

| # | Status | Fix |
|---|---|---|
| 1 | Fixed | One `tableAt()` test for both the table branch and the paragraph stop; the paragraph loop always consumes its first line. Regression test with five pipe-line shapes. |
| 2 | Fixed | `pickFact`: without a row for the reader's region, the most trusted row wins (region-neutral on a tie); wiki rows use `pickFact`; the moderator sees the most trusted current value with its region. |
| 3 | Fixed | `recomputeCompat` closes a verdict built from reports (confirmations + contradictions > 0) when none are left; seeded rows stay. |
| 4 | Fixed | Open data: `visibility='public'` only, reports whose post is deleted/hidden are left out, OS reduced to a family, `device`/free text dropped, `truncated` flag. |
| 5 | Fixed | The report title is validated before the first write. |
| 6 | Fixed | The post's own tag is always the first option in the edit form (a 공지 stays a 공지). |
| 7 | Fixed | Version names allow `#`, `:`, `/`, `,`, `'` and letters in any script ("Hotfix #36"). |
| 8 | Fixed | The proposal is claimed with `UPDATE … WHERE status='open'` before ingest; a second reviewer gets 409. |
| 9 | Fixed | URL properties cannot be proposed; a unit only for money without a fixed currency (ISO code). |
| 10 | Fixed | Edge cache (Cache API, 1 h) in front of `/open-data/compat`; `truncated` marker. |
| 11 | Fixed | `discussions_report` partial index in migration 0008. |
| 12 | Fixed | At most 20 open proposals per member. |
