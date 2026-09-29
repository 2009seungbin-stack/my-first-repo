# Nerulio 2.0 — `/api/v2` reference

Served by the service Worker when `PLATFORM=on` (`server/platform/api.js`). JSON in, JSON out.
Errors are `{"error":{"code","message",…}}`; Korean pages translate the messages in
`src/platform/islands.js` (`KO_ERR`).

- **Auth**: the service layer's session cookie (`nerulio_session`). Reads marked *anonymous* work
  without it; everything else answers `401 LOGIN_REQUIRED`.
- **CSRF**: every POST must come from Nerulio's own origin (`assertSameOrigin`).
- **Limits**: per user and minute (`LIMITS` in `platform/community.js`): posts/reports 3, comments 10,
  votes and one-click reports 60, flags 10, fact proposals 5 (and at most 20 open per member).
- **Accounts**: members are shown by nickname only; the Google account name and email never appear in
  any response.

## Reads

| Route | Who | Returns |
| --- | --- | --- |
| `GET /state?entity=&post=&flag=` | anonymous | `signedIn`, `user{name,tier}`, `following`, the reader's votes on a post and its comments, `mine{post,comments}`, `compat{"patch|gameVersion":result}` on a game channel, `flagged{reason}` for a 신고 target |
| `GET /new-posts?channel=&after=` | anonymous | how many posts newer than channel number `after` (the "↑ 새 글" bar), `last` |
| `GET /tags?q=&l=` | anonymous | up to 10 tags (active entities) by name or alias: `id, name, vertical, type, url, channel` (its default channel) |
| `GET /pins` | anonymous | the member's pinned channels in bar order; `{pins:null}` signed out (pins then live in the browser, `localStorage` `n2-pins`) |
| `GET /follows?l=` | member | followed tags with names and links |
| `GET /my-radar?l=` | member | changes and posts of followed channels (event items carry `eventAt/eventEnd`), `replies` (comments on my posts, replies to my comments), `unread`, `unreadReplies`, `lastChangeId` |
| `GET /mine?l=` | member | my posts and comments (newest 30 each) |
| `GET /posts/source?id=&l=` | author | a post's markdown, its 말머리 and the 말머리 of its channel it may switch to, `channel`, `tags` |
| `GET /comments/source?id=` | author | a comment's markdown |
| `GET /mod/queue` | moderator, curator, admin (404 for others) | open flags with previews, `hidden` (임시조치 중, full text), `proposals` (정보 제안 with the most trusted current value), the action log |
| `GET /open-data/compat[?month=YYYY-MM]` | anonymous, edge-cached 1 h | ODbL. Without `month`: months and counts. With `month`: public compat reports of public posts: subject/target ids and versions, `env{os family, runtime, quant}`, result, day, `truncated` |

## Writes (POST, member unless noted)

| Route | Body | Notes |
| --- | --- | --- |
| `/follow` | `entityId, follow` | |
| `/posts` | `channel, kind, tags[], title, body` (+ `name, password` without an account) | `kind` = a 말머리 of the channel (`platform/channels.js`; 공지 staff only, any channel). `tags` = 0–3 entity ids from any area, in order. Answers `{id, channel, postNo, url}`. The old body `entityId, kind, …` still works: the entity's default channel with it as the only tag. |
| `/pins` | `channels[]` | the member's pinned channels (in-bar channels only, order kept) |
| `/tags/propose` | `name, channel, sourceUrl?, note?` | members only (유동 cannot); a topic channel (not 자유/공지); at most 10 open per member. The owner decides in /admin/ (Radar → 새 태그). |
| `/posts/edit` | `postId, title, body, kind?, tags?` | author only; a 말머리 of the post's channel; a 리포트 post keeps its 말머리 |
| `/posts/delete` | `postId` | author only |
| `/posts/solve` | `postId, commentId` | question author accepts an answer |
| `/comments` | `postId, body, parentId?` | |
| `/comments/edit`, `/comments/delete` | `commentId, body?` | author only |
| `/votes` | `kind: discussion|comment, id, value: -1|0|1` | not on one's own writing |
| `/reports` | `kind: compat|issue|benchmark, entityId, targetId?, subjectVersion?, targetVersion?, result, env?, title?, comment?, metrics?` | A bare compat click is a vote: one per person and game version, never a post. A report with text or setup is a 리포트 post and replaces the person's vote. An outage click counts once per hour. A benchmark is one per person × model × GPU × runtime × quant. |
| `/rollout` | `featureId, hasIt, country?, planId?, platform?, appVersion?` | one per person and feature |
| `/profile` | `displayName` | unique regardless of case; reserved names refused |
| `/flags` | `target: kind:id, reason, note?` | one open flag per reporter and target; a repeat tells the reporter the earlier reason |
| `/facts/propose` | `entityId, property, value, unit?, sourceUrl, note?, postId?` | validated like a seed fact; only fields the channel's wiki shows |
| `/my-radar/seen` | `lastChangeId, repliesSeenAt?` | |
| `/mod/action` | `target, action, reason, days?` | moderators. `hide`/`unhide`/`dismiss` on posts and comments, `restrict`/`unrestrict` on accounts (strictly higher role only), `accept`/`reject` on `proposal:<id>` (accept ingests the value as COMMUNITY_VERIFIED; an official value is never replaced). Every action is logged with its reason and counted on `/community/transparency`. |

Cached pages that a write changes are purged from the edge cache (`purge` + `pagesOf`), in both
languages.
