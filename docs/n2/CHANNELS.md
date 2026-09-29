# Community channels (Nerulio 2.0, owner decision 2026-09-29)

The community has 7 big channels instead of one board per entity. A post lives in **one channel**, carries
**one 말머리** of that channel and **0–3 tags**. A tag is any entity (a service, a GPU, a game, a work …) and
crosses channels: an AI post tagged RTX 5070 also shows on the RTX 5070 page.

| Channel | URL | Default for tags of | 말머리 |
| --- | --- | --- | --- |
| AI | `/ko/community/ai/` | vertical `ai` (local LLM runtimes and models too) | 소식 · 정보 · 질문 · 사용기 · 팁 · 벤치 · 잡담 |
| 게임 | `/ko/community/games/` | `games`, and subculture works whose `media_type` is `game` (블루 아카이브 …) | 소식 · 정보 · 질문 · 공략 · 한글패치 · 리포트 · 스샷 · 잡담 |
| PC·하드웨어 | `/ko/community/hw/` | `hardware` | 소식 · 정보 · 질문 · 견적 · 벤치 · 사용기 · 잡담 |
| 창작 도구 | `/ko/community/studio/` | `studio` | 소식 · 질문 · 호환 · 팁 · 작업물 · 잡담 |
| 애니·서브컬처 | `/ko/community/sub/` | `subculture` | 소식 · 정보 · 감상 · 행사·굿즈 · 팬아트 · 질문 · 잡담 |
| 자유 | `/ko/community/free/` | `tools` and anything else | 잡담 · 질문 · 정보 |
| 공지·건의 | `/ko/community/notice/` (not in the channel bar) | — | 건의 (공지: staff) |

Staff may post a 공지 in any channel. Config: `platform/channels.js` (names, 말머리 and their per-channel
labels, featured tags); the ids match `migrations/0014_channels.sql`.

## Storage
- `discussions.channel_id`, `channel_no` (unique per channel, handed out from `channels.post_seq` in the
  same batch as the insert, so numbers have no gaps and no races), `flair` (the 말머리). `kind` keeps a
  value its old CHECK accepts (`storedKind`: info→guide, review→free, buy→question, event→news,
  feedback→free); reads use `COALESCE(flair, kind)`.
- `discussion_tags(discussion_id, entity_id, pos)`. A post without tags points `entity_id` at the hidden
  placeholder `channel:<id>` (the column is NOT NULL); placeholders never show anywhere.
- A tag includes its parts: `platform/db/channel.js` `SCOPE_CTE` walks relations two levels deep
  (child→parent: part_of, made_by, belongs_to, appears_in, translates, merchandise_of, variant_of,
  developed_by, published_by, produced_by; parent→child: has_plan, offers, includes_model). Claude → Claude
  Code, its plans → the models a plan includes.
- `legacy_posts(entity_id, post_no, discussion_id)`: the old per-entity numbers.
- `channel_pins(user_id, channel_id, pos)`; `tag_proposals` (members propose, the owner decides).

## Pages and URLs
| URL | What |
| --- | --- |
| `/{l}/community/` | ★ 전체 베스트, one box per channel, 공지 line, 인기 태그, 레이더 소식 |
| `/{l}/community/{ch}/` `?kind= &tag= &sort= &best=1 &page=` (+ `platform=`/`genre=` on 게임) | the board: 말머리 tabs, popular tag chips, one 공지 row (the rest folded), the Radar bot's 소식 of the last 7 days folded into one row |
| `/{l}/community/{ch}/{no}` | a post |
| `/{l}/community/{ch}/write?tag=&kind=` | write, with the channel and tag picked |
| `/{l}/community/{ch}/best`, `/{l}/community/{ch}/feed.xml` | the channel's 념글 and feed |
| `/{l}/community/best/?period=&ch=` | 전체 베스트 |
| `/{l}/community/games/?kind=patch` | 한글패치 모음 (pinned in the channel bar) |
| `/{l}/{vertical}/{slug}/` (unchanged) | the tag page: live info as before, "{name} 태그 글" from every channel (parts included; `?sub=0` = this tag only), 이 태그로 글쓰기 |

Redirects: `/{l}/{vertical}/{slug}/{no}` → 301 to the post's channel address (an unknown number → the tag
page); `/{l}/{vertical}/{slug}/write` → 302 to `/{l}/community/{default channel}/write?tag={id}`;
`/community/best/?v=` → 301 `?ch=`; `/community/?v=` → 301 to the channel. Entity URLs, `?kind=` and
`feed.xml` stay. Channel boards and `/community/best/` are in the sitemap; filtered boards are noindex with
the unfiltered board as canonical; every page has its ko/en alternate.

## Reader features
- **Channel bar**: 홈 · 전체 베스트 · the 6 channels · 한글패치 모음 · 전체 채널 (sheet). Pinned channels come
  first. Without an account pins live in `localStorage` (`n2-pins`) and move to the account at sign-in.
- **전체 채널 sheet**: a bottom sheet at phone width, a dialog on wide screens; search (channels + tags),
  내 채널, every channel with 고정, 최근 본 태그 (this browser).
- **★ 념글**: per channel (`best_at`, the channel's own threshold from its last 7 days) and 전체 베스트.
- **New tags**: members propose from the write page; the owner picks the kind and approves in /admin/
  (Radar → 새 태그), which creates the entity (noindex until it has facts) with its name as an alias.
- 유동 (anonymous) writing, 고정닉 ✓, images, auto-hide and moderation work the same in every channel.
