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
| `GET /new-posts?entity=&after=` | anonymous | posts newer than `after` in a channel (the "↑ 새 글" bar) |
| `GET /follows?l=` | member | followed channels with names and links |
| `GET /my-radar?l=` | member | changes and posts of followed channels (event items carry `eventAt/eventEnd`), `replies` (comments on my posts, replies to my comments), `unread`, `unreadReplies`, `lastChangeId` |
| `GET /mine?l=` | member | my posts and comments (newest 30 each) |
| `GET /posts/source?id=&l=` | author | a post's markdown, its tag and the tags it may switch to |
| `GET /comments/source?id=` | author | a comment's markdown |
| `GET /mod/queue` | moderator, curator, admin (404 for others) | open flags with previews, `hidden` (임시조치 중, full text), `proposals` (정보 제안 with the most trusted current value), the action log |
| `GET /open-data/compat[?month=YYYY-MM]` | anonymous, edge-cached 1 h | ODbL. Without `month`: months and counts. With `month`: public compat reports of public posts: subject/target ids and versions, `env{os family, runtime, quant}`, result, day, `truncated` |

## Writes (POST, member unless noted)

| Route | Body | Notes |
| --- | --- | --- |
| `/follow` | `entityId, follow` | |
| `/posts` | `entityId, kind, title, body` | `kind` must be writable in the channel's vertical (공지 staff only) |
| `/posts/edit` | `postId, title, body, kind?` | author only; a 리포트 post keeps its tag |
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
