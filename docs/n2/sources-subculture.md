# Subculture vertical — sources, collectors and coverage (N2 wave 1)

Retrieved/verified: **2026-09-28**. Scope: live/ongoing information around high-interest anime, manga/webtoon and
game IPs with Korean relevance — upcoming and recent **dated items** (seasons, films incl. Korean theatrical
dates, game version updates, Korean pop-ups/collaborations, conventions, figure pre-orders). Not an encyclopedia.

Seed files: `data/seed/subculture/*.json` (one per research chunk). Every fact cites a source opened on the
retrieval date; facts that could not be verified on an official page were omitted.

## 1. Source inventory

| Source | URL | Access | Documented? | Terms / robots | Cadence | Automated? |
| --- | --- | --- | --- | --- | --- | --- |
| AniList GraphQL API (third-party, community-edited) | https://graphql.anilist.co (POST) | adapter `anilist-schedule` | Yes — https://docs.anilist.co/ | Free for non-commercial use and for services under USD 150/month revenue; above that a commercial licence is needed. No use as backup/data store, no hoarding/mass collection, no competing list/tracker service. robots.txt allows all. Rate limit 90/min, **currently degraded to 30/min** (observed `X-RateLimit-Limit: 30`). GET returns 404 "Use POST". | 12 h | Yes — **COMMUNITY-labelled signal only** |
| Steam per-app news RSS (publisher announcements) | `https://store.steampowered.com/feeds/news/app/<appid>/?l=koreana` | adapter `steam-news-subculture` | Not formally documented; **observed responding** (text/xml, generator "Steam 뉴스 RSS") | store.steampowered.com robots.txt does not disallow `/feeds/`. `api.steampowered.com` is **not** used (robots.txt `Disallow: /`). | 12 h | Yes (AUTOMATED) |
| Steam store pages | `https://store.steampowered.com/app/<appid>/` | manual (seed) | — | Publisher-supplied store data (developer, publisher, Steam release date, website) | on change | No |
| X (Twitter) official accounts, single posts | `https://publish.twitter.com/oembed?url=<post>` | manual workflow tool | Yes (X oEmbed) | Reads one known post; no timeline scraping | on demand | No |
| Game official notice pages (HoYoverse, Nexon forum, Kakao Games) | e.g. genshin.hoyoverse.com/ko/news, hsr.hoyoverse.com/ko-kr/news, forum.nexon.com/bluearchive | manual (`subculture-official-news`) | Client-rendered; JSON endpoints are undocumented → **not used** | read in a browser | per version (~6 weeks) | No |
| Anime official sites (JP) and Korean distributors/streamers | official /news/ /onair/ /cast/ pages; Aniplus, Laftel, Netflix KR, TVING, Crunchyroll, CGV/Megabox/Lotte Cinema | manual (`subculture-official-news`) | No feeds found | robots respected | weekly in season | No |
| Organizer sites (conventions/fan events) | gstar.or.kr, comicw.co.kr, AGF Korea, sites.google.com/mihoyo.com/hoyoland2026, … | manual (`subculture-kr-collabs`) | No feeds found | — | weekly while upcoming | No |
| Brand / venue / ticketing pages for collab cafés & pop-ups | department stores, café chains, Ticketlink | manual (`subculture-kr-collabs`) | — | — | weekly while upcoming | No |
| Manufacturer product pages (figures) | Good Smile Company, Kotobukiya, Alter, … | manual (`subculture-figure-preorders`) | — | robots checked per site | monthly + delay notices | No |
| Press reports | e.g. inven.co.kr | seed only, kind `CURATED` | — | used only when the rights holder's announcement had no reachable official page; noted per source | — | No |

### AniList evaluation (honest labelling)
- AniList is a **third-party community database**, not the rights holder. The adapter's source is `kind:'FEED'`
  with a note saying so, and every value it emits is `ver:'COMMUNITY'` — it can never supersede an OFFICIAL
  fact (`mayOverride`). Its job is to tell curators *what changed* (a new next-episode time, a delay, a new
  episode count) so they re-check the official site.
- Only works Nerulio already tracks are queried (seed facts `anilist_id`, non-public property), batched 50 ids
  per request — a handful of requests per run. No discovery crawling (that would be "mass collection").
- **Licence risk:** Nerulio has ads/billing. Once monthly revenue exceeds USD 150, AniList requires a commercial
  licence (contact@anilist.co). The owner must decide before enabling the adapter in production; until then run
  it as a curator aid, not as a public data source. Nerulio must also not become a list/tracker competitor.
- The runtime's `ctx.get()` is GET-only; the adapter carries a POST helper that applies the same host allowlist,
  politeness interval and snapshot recording (see §5 suggested core change).

### Steam news feed evaluation
- The per-app RSS carries the publisher's own announcements (e.g. Blue Archive's "9/29(화) 업데이트 상세 안내",
  Wuthering Waves "3.6 버전 … 업데이트 내용", Zenless Zone Zero "3.2 버전 … 업데이트 공지", Limbus Company
  "2026년 9월 24일 정기 업데이트 안내"). The adapter keeps only update posts (업데이트/update/patch; livestream,
  preview, bug/issue posts skipped), dates them from the date written in the title (`9/29(화)`, `2026년 9월 24일`,
  `2026.10.01`) or else the KST post date, and extracts a version only when the title names it next to 버전/version.
- Games not on Steam (Genshin Impact, Honkai: Star Rail, Uma Musume KR, NIKKE, FGO KR) have no documented feed →
  manual.

## 2. Collectors

| Adapter id | Mode | Hosts | Interval | Output |
| --- | --- | --- | --- | --- |
| `anilist-schedule` | auto | graphql.anilist.co | 2.5 s | airing_status, episodes, release_date, end_date (COMMUNITY) + next-episode `broadcast` event (time precision, JST) |
| `steam-news-subculture` | auto | store.steampowered.com | 1.5 s | `update` events, versions[], current_version (AUTOMATED) for works with `steam_appid` |
| `subculture-official-news` | manual | — | — | curator workflow (official anime/game news, Korean distributors, cinema chains) |
| `subculture-kr-collabs` | manual | — | — | curator workflow (collab cafés, pop-ups, conventions, fan events) |
| `subculture-figure-preorders` | manual | — | — | curator workflow (manufacturer product pages) |

Adapter id note: `steam-news-subculture` is deliberately distinct from the games vertical's `steam-news`.

Tests: `node --test tests/n2-collector-anilist-schedule.test.mjs tests/n2-collector-steam-news-subculture.test.mjs tests/n2-collector-subculture-manual.test.mjs`
(recorded fixtures under `tests/fixtures/n2/collectors/<adapter>/`, no network).

## 3. Manual workflows

### Official news (anime/game) — `subculture-official-news`
1. Triggered by an `anilist-schedule` / `steam-news-subculture` change or the weekly in-season sweep.
2. Open the official page (JP anime site news/onair/cast; Korean distributor/streamer page or official X post via
   oEmbed; game notice page in a browser). Record the fact with `ver:'OFFICIAL'` and a new `src` with the
   retrieval date.
3. Korean titles: exactly as used by the Korean distributor/streamer/official Korean account; never our own
   transliteration. If none exists, only `en`/`ja`.
4. Dates keep the source's precision; broadcast times `+09:00`; Korean dates with `region:'KR'`.

### Collab cafés, pop-ups, conventions — `subculture-kr-collabs`
Channels (in order): organizer sites → official Korean IP accounts on X (read single posts via
`https://publish.twitter.com/oembed?url=…`) → brand/venue event pages (department stores, café chains, animate
Korea) → ticketing pages (Ticketlink etc.) → game notice boards. Row checklist: title en/ko, start/end with
precision, region, venue, url, kind (`popup|collab|event|exhibition|sale`), linked franchise (+characters),
`status` re-checked weekly (postponed/cancelled/ended).

### Figures — `subculture-figure-preorders`
Manufacturer product page only: manufacturer_name, list price + currency + tax note, preorder_start/end as stated,
release month; re-check monthly and on delay notices (history is kept by the diff engine).

## 4. Coverage (2026-09-28)

_Filled at integration — see §4 table below._

## 5. Known gaps, staleness and suggested core changes

_Filled at integration._
