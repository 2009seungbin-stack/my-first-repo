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

**47 IPs (franchises)** across 9 seed files, **439 entities**, **850 facts** (804 OFFICIAL, 46 COMMUNITY =
AniList ids), **670 relations**, **170 dated events** (144 upcoming or running on 2026-09-28), **346 sources**
(341 OFFICIAL, 4 FEED, 1 CURATED). 161 entities carry an official Korean name.

| Entity type | Count | | Event kind | Count |
| --- | --- | --- | --- | --- |
| franchise | 47 | | broadcast | 27 |
| work | 84 | | release (films, games, volumes) | 19 |
| character | 112 | | update (game versions) | 10 |
| voice_actor | 65 | | event (conventions, fan events) | 27 |
| studio_org | 41 | | collab / popup / exhibition | 9 / 3 / 3 |
| creator | 36 | | merch_release / sale (pre-order windows) | 41 / 28 |
| merchandise | 41 | | other | 3 |
| event | 8 | | **date precision**: time 34 · day 84 · month 48 · year 4 | |
| collaboration | 5 | | **region**: JP 130 · KR 28 · GLOBAL 12 | |

| File | IPs | Highlights |
| --- | --- | --- |
| `anime-fall.json` | Apothecary Diaries, Black Clover, Blue Box, JoJo (SBR), Dragon Ball, Tokyo Revengers, Ranma ½, Cyberpunk, Aoashi, Mission: Yozakura Family, BLEACH | Fall 2026 premieres with JST times, Netflix KR / Laftel availability, casts with agency facts, Apothecary film 2026-12-11 (JP), BLEACH schedule changes, BLEACH FES. 2027 |
| `kr-origin.json` | Solo Leveling, Overgeared, Returner's Magic, SSS-Class Revival Hunter, Tower of God, Omniscient Reader | Korean original titles from KakaoPage/Naver Webtoon, Overgeared on Laftel (KR 2026-10-02), Returner's Magic S2 (2026-10-08 00:45 JST), Solo Leveling games (ARISE OVERDRIVE on Steam, KARMA pre-registration) |
| `jump.json` | One Piece, Chainsaw Man, JJK, Frieren, Demon Slayer, Sakamoto Days, Kaiju No. 8, Spy×Family, Dandadan, Oshi no Ko | THE ONE PIECE (Netflix, 2027-02), GOD VALLEY (2027) / BAAD (2029), Frieren S3 (2027-10), Sakamoto Days S2 (2027-01, Netflix KR), JJK exhibition, fan events |
| `films.json` | Made in Abyss, Witch on the Holy Night, Rascal, Takopi, Medalist, Detective Conan, Haikyu!!, Madoka | JP release dates; **KR: Conan 29th film 2026-08-12 (Megabox), Madoka Walpurgisnacht Nov 2026 (Lotte Cinema)**; Conan 30th-anniversary exhibition at AK PLAZA Hongdae |
| `games-a.json` | Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Wuthering Waves, NIKKE | Current versions (7.1 / 4.6 / 3.2 / 3.6 → 3.7 on 09-30), version windows, **HoYoLAND 2026 (KINTEX, 10-02–05)**, **HSR × Mega MGC Coffee (10-15–11-18)** |
| `games-b.json` | Blue Archive, Limbus Company, Uma Musume (KR), Trickcal | BA 09-29 update (11:00–14:00 KST), Limbus 1.115.0, Trickcal 3rd anniversary (to 10-22) |
| `game-characters.json` | Arknights, Fate | Arknights: Endfield on Steam (coming soon), FGO KR; characters referenced by figure pages |
| `events.json` | Chiikawa (+ conventions) | **G-STAR 2026 (BEXCO 11-18–22), AGF Korea 2026 (KINTEX 12-04–06), ILLUSTAR FES 14 (10-10–11), Comic World ×4**, C109, AnimeJapan 2027, Jump Festa 2027, Aniplus collab cafés, JUMP SHOP Seoul pop-up |
| `merch.json` | 15 IPs | 41 figures (GSC 27, ALTER 8, MegaHouse 6): JPY list price, pre-order window, shipping month |

Live collector runs (2026-09-28):
- `node tools/platform/collect.mjs --adapter steam-news-subculture` → 4 feeds, 0 validation errors, 2 works with
  versions (ZZZ 3.2 @ 2026-09-09, Wuthering Waves 3.6 @ 2026-08-20) and 4 update events (Blue Archive 2026-09-29 announced).
- `node tools/platform/collect.mjs --adapter anilist-schedule --limit 1000` → **1 request**, 46 works, 0 validation
  errors, 17 upcoming broadcast/release events. It surfaced two disagreements with official sites, which is exactly
  why its output is COMMUNITY-labelled: Aoashi S2 (AniList 23:00 vs NHK E-tele 17:00 official) and Tokyo Revengers
  (01:53 vs 01:23 official).
- `--limit 5` returns 0 entities because `collect.mjs` slices targets before the adapter filters for `anilist_id`
  (the first five subculture targets are studios). See §5.

## 5. Known gaps, staleness and suggested core changes

Gaps
- **Korean theatrical dates** confirmed only for Detective Conan (2026-08-12) and Madoka (Nov 2026). No official Korean
  release yet for Made in Abyss, Witch on the Holy Night, Rascal, Takopi, Medalist, Haikyu!!, the Apothecary film or
  the Chiikawa film (press says 2026-09-30 via Daewon Media — unconfirmed, omitted).
- The Madoka KR source is the X account 애니무비(ANI MOVIE) (@Animovie_ofc), which tags #애니플러스; no link from
  aniplustv.com to the account was found — noted on the source.
- Game characters for Genshin/HSR/ZZZ/WuWa are not seeded (official sites render CV credits client-side; time-boxed out).
  NIKKE has one Korean CV credit (Rapi — 김보나, Korean official site).
- Uma Musume KR, FGO KR and Arknights are thin (homepage/publisher only); no dated KR items verified.
- VTubers (hololive, stellive) not defined: the franchise type allows only homepage/origin_media, so ≥3 official facts
  were not reachable; the hololive FLOW GLOW Aniplus café is recorded as a collaboration without a franchise link.
- AGF 2026 (Tokyo) skipped (organizer site 503). The December Comiket is **C109** (not C107).
- Press-only Korean leads not seeded (manual pass needed): JJK café at AK PLAZA Hongdae (09-23–12-01), BLEACH TYBW café
  Hongdae (to 10-11), Omniscient Reader animate café (to 10-13), JJK Phantom Parade pop-up, Haikyu!! SMG Store Suwon.
- HSR × Mega MGC Coffee is sourced from a press report of HoYoverse Korea's announcement (`CURATED`); replace it with
  the official post when found.
- Agency/homepage facts were added for 31 voice actors and 12 studios from agency/company pages; still without facts: Megumi Hayashibara (no agency site), Kim Bo-na (freelance), Netmarble Neo (no own site); Japanese voice actors carry no Korean name (unofficial
  transliterations were removed on purpose).
- English romanisations not taken from an official English page: Park Saenal, Cha Hae-in, Desir Arman, Romantica Eru,
  Kim Gongja (their Korean/Japanese names are sourced), and some descriptive English names of ALTER/MegaHouse products.

Research-time access notes (not used by collectors): Laftel item pages were read via the JSON the page itself loads;
Aniplus shop collab-café list via `api.aniplustv.com:3060/api/v2/offline-collabo`; ILLUSTAR via `api.illustar.net`;
GSC pre-order calendar via `/en/calendar-preorder/list`. All are undocumented and were only observed responding — they
are **not** automated. Jump Festa has a working RSS (`https://www.jumpfesta.com/feed/`), a candidate for a future FEED
adapter. No manufacturer RSS was found (GSC `/en/news/rss` 500, ALTER `/rss/` 404, MegaHouse `/feed/` returns HTML).

Staleness to watch: game version facts (fast SLA), BLEACH episode reschedules, the "coming soon" AGF Korea programme,
figure shipping months (delays), the Arknights: Endfield Steam date.

Suggested core changes
1. `collectors/_runtime.js`: add `ctx.post(url, body, o)` with the same allowlist/politeness/snapshot handling —
   GraphQL APIs (AniList) are POST-only; the AniList adapter carries a local helper until then.
2. `tools/platform/validate-seed.mjs`: a relative directory argument loads each file twice (relative + absolute path)
   and reports every entity as "also defined in" itself; normalise with `path.resolve`.
3. `tools/platform/collect.mjs`: apply `--limit` after the adapter selects relevant targets (or let adapters declare a
   target filter); avoid `process.exit()` right after `fetch` on Windows (libuv `UV_HANDLE_CLOSING` assertion, exit
   code 127 after a successful run) — set `process.exitCode` instead.
4. Seed format / ingest: document and ingest the event fields `date_precision`, `status` and `entity` (the event's own
   page; the `events` table already has these columns). This vertical sets them on every event.
5. Relation qualifiers: `voiced_by` needs a language/scope (Japanese original vs Korean dub); it is in `note` for now.
6. Ingest de-duplication: a collector event (AUTOMATED/COMMUNITY) for the same entity + kind + day as a curated OFFICIAL
   event should attach as corroboration instead of creating a second row.
7. Renderers should honour `public:false` properties (`anilist_id`).
