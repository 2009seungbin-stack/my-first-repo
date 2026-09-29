# Nerulio site audit: current site, n2 platform gaps, renderer quality, data coverage

Date 2026-09-28. Branch `claude/epic-heisenberg-ey2d3p`, HEAD `06f53f2` ("v3 channel pages in code").
Method: I read the docs, route and sitemap baselines, migrations, `platform/**`, `server/**` and the seed files.
I ran `node tools/platform/preview.mjs <scratch>` (10 pages) and read the generated HTML. I also rendered
**every one of the 1,580 seeded entities** (ko) through `server/platform/pages.js#renderPlatformPage`
against the node:sqlite D1 shim, with a counting proxy on `prepare()`, and ran `EXPLAIN QUERY PLAN` on the
hot queries. `node --test tests/n2-*.test.mjs` shows 136 pass and 0 fail.

**Line numbers refer to HEAD `06f53f2`.** Another session is editing the working tree while this audit is
written. It has uncommitted changes in `server/platform/api.js` (new, API v2 writes),
`src/platform/islands.js` (new), `platform/render/write.js` (new), `tools/platform/dev-server.mjs`,
`tests/n2-api.test.mjs`, and edits to `pages.js`, `post.js`, `ui.js`, `db/channel.js`, `community.js`
and `n2.css`. Where that work already addresses a finding, the finding says so.

---

## 1. The current site and where its traffic comes from

### 1.1 What it is
- The site is static and has **904 entry pages** (the route baseline `tests/fixtures/n2-route-baseline.txt` lists 905). They are built by `tools/build.mjs` in ko/en/ja plus language-neutral roots. Files are processed locally in the browser. The optional Worker (`server/`) covers accounts, quota and billing only, sits behind `SERVICE_API` and is off in production.
- Route mix from the baseline, per language: `game/*` 126, `image/*` 38, `video/*` 11, `pdf/*` 6, about 20 standalone tool slugs, and the policy pages. The game-asset Studio and Labs make up about 42% of all pages.
- **Indexable set.** `docs/SEO-INTENT-INVENTORY.md` has 151 pages × 3 languages = 453 URLs. By type: create 28, format 8, tool 55, conversion 20, engine 18, compare 8, troubleshoot 14. The sitemap baseline has 472 URLs because it adds the home and hub pages. `tools/sitemaps.mjs` writes an index plus `sitemap-game.xml`, `sitemap-guides.xml`, `sitemap-tools.xml` and `sitemap-images.xml`. Only intents that pass `mayPromote()` are listed, with hreflang (x-default = en) and lastmod taken from content hashes.

### 1.2 Where traffic likely comes from
There is no first-party measurement. `src/analytics.js` has no transport ("disabled until an operator installs an adapter", `docs/GROWTH.md`), so only the Cloudflare Web Analytics beacon exists. What follows is inferred from the SEO machinery and the content depth.
1. **Organic long-tail search on Google.** Naver and Bing are also covered: `naverVerification`/`bingVerification` in `tools/site-config.mjs` and the IndexNow workflow `.github/workflows/indexnow.yml`. The pages with the most text are the engine and conversion game pages, with 6–12k characters of English copy each. Examples: `game/godot-sprite-sheet` 11,811, `game/godot-pixel-art-blurry` 10,674, `game/aseprite-to-godot` 10,102 (INVENTORY). These are the most likely entry points: game developers searching for "Godot/Unity/Phaser + sprite/tileset/atlas".
2. **Utility intents.** Examples are `image/resize/{youtube-thumbnail,discord-banner,x-header,…}`, `video/{mp4,mov,webm}-to-{gif,mp3}`, `pdf/*` and image compress/convert. Competition is high, and `docs/PRODUCT-ROADMAP.md` benchmarks these pages against iLovePDF, Squoosh and TinyPNG.
3. **Distribution.** `.github/workflows/distribution.yml` runs a scheduled job (Mon/Thu).

The traffic is tool-intent, split between creators and game developers, with a large en and ja share. n2 targets ko+en only (`PLATFORM_LOCALES`, `platform/schema.js:9`), and its audiences are AI users, Korean gamers, GPU buyers, DAW users and anime fans. **The overlap with the existing tool traffic is small.** n2 therefore needs its own search entry points (entity sitemaps, a content gate, structured data; see §2 and §3). It cannot rely on tool traffic.

### 1.3 How n2 should connect to the tools
- **Shared header.** n2 pages use their own header (`platform/render/ui.js:95-97`), with Radar and Tools links, while the static pages use `index.html` plus `src/content.js`. Recommendations:
  - With `PLATFORM=on`, add "커뮤니티 / Community" and "레이더 / Radar" entries to the static header at build time. There is no runtime cost, and a build without the flag stays byte-identical (D5).
  - Keep "도구 / Tools" → `/{l}/` in the n2 header.
  - Never link n2 from `/ja/` pages until ja exists.
- **Tool → channel links.** Build a static map in `platform/verticals/*` (`tools:` per type) and render a "관련 채널" row on tool pages at build time. No D1 is needed because the ids come from seeds. The pairs below are real ones from the current data:

| Tool pages (existing paths) | Channels (existing entity ids) | Why |
| --- | --- | --- |
| `game/godot-sprite-sheet`, `game/godot-autotile`, `game/godot-pixel-art-blurry`, `game/aseprite-to-godot` | `app:godot` | Godot users. The channel has versions and OS compatibility. |
| `game/sprite-normal-map`, `game/godot-2d-normal-map` | `app:blender`, `app:godot` | 2D lighting workflow |
| `video/mp4-to-gif`, `video/mov-to-mp3`, `video/webm-to-*` | `app:obs-studio` | Recordings → clips |
| `game/fix-ai-pixel-art`, image background removal and upscale tools | `service:chatgpt`, `service:gemini-app`, `service:claude`, open models | AI-generated assets |
| `image/resize/discord-banner`, `x-header`, `youtube-banner`, `image-to-pixel-art` | subculture `work:*`/`franchise:*` channels | Fan and community banners |
| `ai-runtime/` (browser models) and a future `vram-fit` page | `hardware:gpu` channels | "Runs locally" |

- **Channel → tool links.** Today these are wrong or missing. `platform/render/channel.js:96-97` + `:108-109` (`TOOL_PATHS`) link only the five Labs, and they appear on **every game channel** because `games:game.tools` lists the Labs (`platform/verticals/games.js:10`). A Caves of Qud player does not need a sprite packer. `studio` and `subculture` configure no tools, and `vram-fit` has no page. Move the Lab links to `studio:app` (Godot, Blender) and give games screenshot and clip tools (image compress, mp4-to-gif).
- **Measurement.** `ANALYTICS_VERTICALS` already includes `TOOLS` (`platform/schema.js:7`). Wire the `tool_open` and `entity_related_click` events before judging the cross-links.

---

## 2. n2 platform gap analysis versus `NERULIO_2_ARCHITECTURE.md`

| Architecture item | State at HEAD | Evidence / what is missing |
| --- | --- | --- |
| Schema (§4) | **Done** | `migrations/0003` and `0004` (51 tables, FTS5 trigram) |
| Vertical configs | **Done** | `platform/verticals/*.js`. `indexMin` is defined per type but **nothing reads it** (grep finds it only in `_define.js:10`). |
| Ingest pipeline (D6) | **Done (library)** | `platform/ingest.js`. The seed import writes 11,089 `changes` rows; all seed kinds get importance 0 except events (1–2), which is correct. |
| Read repositories | **Partial** | Only `platform/db/channel.js`. There is no search, radar, sitemap, admin or My Radar repository. |
| SSR pages (§5) | **Partial** | `server/platform/pages.js:15` matches only `/{l}/community/`, `/{l}/{v}/{slug}/` and `/{l}/{v}/{slug}/{no}`. The working tree adds `…/write`. Missing: vertical hubs `/{l}/{v}/` (these reach the Worker through `_routes`, fail to match and return a static 404), `/{l}/radar/`, `/{l}/search/`, `/{l}/community/best/`, `…/wiki/history`, `/{l}/report`, `/{l}/my/*` and `/admin/`. Every one of them is **already linked** from rendered pages (§3.3 S1). |
| API v2 writes | **Not in HEAD. In progress, uncommitted.** | `server/platform/api.js` (working tree) has state, new-posts, follow, posts, comments, votes, reports, rollout and profile. Still missing: `POST /api/v2/admin/ingest`, which `tools/platform/collect.mjs:3` targets, plus wiki edit, content flags, moderation actions, alerts, stack, preflight, uploads (R2) and a search API. |
| Islands `src/platform/*` | **Not in HEAD. In progress.** | HEAD has only `n2.css`. The working tree adds `islands.js` (180 lines) and loads it from `ui.js`. |
| Search page | **Missing** | `search_docs` holds 2,470 rows after seeding, but there is no query function, route or `_routes` entry. The header search form (`ui.js:95`) submits to a 404. |
| Radar feed and My Radar | **Missing** | `radarChanges()` (`db/channel.js:209`) feeds only the front's fallback box. The `radar_state` and `alert_rules` tables are unused. |
| Write and report forms | **Partial (in progress)** | `platform/render/write.js` exists (untracked). There is no report form, yet `post.js:68` links to `/{l}/report?target=…`. |
| Entity sitemaps (§5, §6) | **Missing** | There is no `sitemap-entities-*.xml` in `tools/sitemaps.mjs` or the Worker, and the sitemap index cannot reference D1 output. |
| SEO content gate `platform/seo.js` (§6) | **Missing** | The file does not exist. `renderChannel` sets `noindex` only for filtered or paged views (`channel.js:104`), so **all 1,580 entities × 2 locales are indexable**, including 479 entities with zero facts (§4). |
| Auth: GitHub and Discord (D7) | **Missing** | Only `server/auth-google.js` exists. Channel and front pages link `/{l}/account/?next=…` (`channel.js:81`) and `?provider=google` (`front.js:37`), but the account page and the OAuth start (`auth-google.js:20`) read **`return`**, not `next`. After sign-in the user is not returned to the channel. |
| Moderation and admin | **Missing** | The `content_flags`, `moderation_actions` and `user_profiles.role` tables exist with no code behind them and no `/admin/` page. The comment "신고" is a plain `<span>` in HEAD (`post.js:47`). |
| Collectors and scheduling (D6) | **Partial** | There are 21 adapters, `_runtime.js`, and a test per adapter. **No workflow runs them** (`.github/workflows` has only ci, distribution and indexnow) and there is no ingest endpoint. PROGRESS "Known risks" says D6 should move to D1 REST, but the architecture doc is unchanged. |
| Edge cache invalidation (D4) | **Missing in HEAD** | The version bump on write is not implemented. The working-tree `api.js:55` purges `caches.default` by exact URL (see §3.4 X3). |
| First-party analytics (§8) | **Missing** | The `analytics_*` tables have no ingestion endpoint and no islands send events. |
| Type checking (D3) | **Missing** | There is no `tsconfig.json` and CI (`ci.yml`) never runs `tsc`, so `// @ts-check` is advisory only. |
| Referenced docs | **Missing** | `NERULIO_2_MIGRATION_PLAN.md` and `docs/NERULIO_2_SCHEMA.md` do not exist. |
| Security headers on SSR | **Missing** | `_headers` rules do not apply to Worker responses. Non-ads builds serve SSR HTML with only `nosniff` (`pages.js:61`): no CSP, `frame-ancestors`, Referrer-Policy or Permissions-Policy (§3.4 X4). |

---

## 3. Quality review: `platform/render/*`, `platform/db/channel.js`, `server/platform/pages.js`

Severity: **H** = wrong output, cost or security problem in production. **M** = user-visible defect or SEO loss. **L** = polish.

### 3.1 Correctness bugs
| # | Sev | Where | Problem | Fix |
| --- | --- | --- | --- | --- |
| C1 | H | `render/panels/ai.js:66-70` | The status box says "보고된 장애 없음 / No reported incident" for every service **even when no status collector has ever run**, because `collector` is null and there are no incident events. In the seeded DB there are 0 incident events and the claim shows on all 13 service channels. This is an invented fact. | If `d.collector?.last_success_at` is missing or older than 2 h, render "상태 확인 전 / not checked yet" with the grey dot. Show "no incident" only when the adapter's last success is fresh. |
| C2 | H | `render/panels/generic.js:33` (`factRows`) | Ignores `PropertyDef.public:false`. `anilist_id` (`verticals/subculture.js:37`) renders as "AniList ID 185,874" on work pages (preview `ko-bleach-tybw-the-calamity.html`). The value is also formatted with a thousands separator because its type is `number`. | Skip `propertyDef(...)?.public===false`. Add an `id` type that `factText` prints raw (`steam_appid` has the same problem). |
| C3 | M | `render/post.js:43` + `:70` | The best comment renders twice, once pinned and once in the thread, with the **same `id="c-…"`**. A single comment with 5 or more upvotes always qualifies because `!top[1]` is true, so it appears twice (preview `ko-caves-of-qud-4.html`). The result is duplicate IDs, a broken `#c-` anchor and duplicate text. | Give the pinned copy `id="best-c-…"` and a link to `#c-…`. Require `top.length>=2` or show the pinned copy only when the thread is longer than one screen. |
| C4 | M | `render/channel.js:34` | `o.kind in POST_KINDS` also accepts inherited keys. `?kind=constructor` renders an empty board with canonical `…/?kind=constructor` (verified). | `Object.hasOwn(POST_KINDS,o.kind)`. |
| C5 | M | `server/platform/pages.js:58` | `page` is not an integer. `?page=1.5` gives OFFSET 15, and the pager shows "1.5" and links `page=0.5` (verified). | `Math.floor(Number(...))`. 301 to the canonical form when the query was not canonical. |
| C6 | M | `render/panels/gpu.js:18-26` | "최신 드라이버" takes **any** `driver` made by the vendor. The only driver collector is `nvidia-datacenter-drivers` (`driver:nvidia-dc-r*`), so GeForce channels will show a datacenter branch as their driver once it runs. | Filter drivers by a `segment`/`applies_to` relation to the GPU (or its segment fact). Hide the box otherwise. |
| C7 | M | `server/platform/pages.js:32` | `entitiesByIds` returns rows in DB order, so the featured channel bar and "인기 채널" fallback appear alphabetically by id (ableton, blender, 5070, ChatGPT…), not in `FEATURED` order. | `FEATURED.map(id=>map.get(id)).filter(Boolean)`. |
| C8 | M | `render/post.js:33` | The comment says "the newest page that contains it", but the code takes the newest 12 posts. For older posts the current row is never highlighted and the list is unrelated to the post. | Query a window with `post_no BETWEEN no-6 AND no+6`, using the `discussions_entity` index. |
| C9 | M | `db/channel.js:187` | `recentTitles` uses `ORDER BY id DESC LIMIT 300`, but discussion ids are random tokens, so this is not "most recent". | `ORDER BY post_no DESC`. |
| C10 | L | `db/channel.js:57-61`, used by `panels/ai.js` (provider `[0]`) and `studio.js` (`maker`) | There is no `ORDER BY`, so "first relation" is nondeterministic. | `ORDER BY r.id`. |
| C11 | L | `render/channel.js:76` | The subtitle repeats itself on game channels ("게임 · 게임"). | Drop the vertical label when it equals the type label. |
| C12 | L | `render/panels/ai.js:83`, `game.js:38` | Dates for ko pages are taken in UTC (`getUTCDate`, `toISOString().slice`), so they can be a day off against KST. | Use `format.js` `dateText(...,l)`. |
| C13 | L | `server/platform/pages.js:15` | `/ko/ai/claude` (no slash) and `/ko/ai/claude/9/` fall through to a static 404. | 301 to the canonical slash form. |

### 3.2 D1 / SQL performance
Queries per uncached render, measured with the counting proxy over all 1,580 entities: generic pages 9, games about 12, GPUs 15, IP pages 12–16, AI services 20–23 (ChatGPT is the maximum at 23), front 7, post 7, and **4 for a 404**. Every query is awaited **sequentially**. Rendering takes 1–4 ms of CPU when warm; the Claude page takes 4.0 ms. `format.js` builds a new `Intl.DateTimeFormat` on every call, about 0.14 ms per `boardTime`. On Workers Free (10 ms CPU) a cold isolate risks the limit.

| # | Sev | Where | Problem (plan verified with EXPLAIN on the shim) | Fix |
| --- | --- | --- | --- | --- |
| P1 | **H** | `server/platform/pages.js:44` → `db/channel.js:204-206` `activeChannels` | Runs on **every** SSR miss (the channel bar) and again on the front. Plan: `SEARCH d USING INDEX discussions_feed (status=?)` with a temp B-tree for GROUP BY and ORDER BY. It reads **every published post** because `created_at` is not in the index. D1 bills rows read, and with 100k posts a single miss reads more than 100k rows. | Add the index `discussions_recent ON discussions(status, created_at, entity_id)`. Better, compute the bar once every 10 min into `vertical_settings`/KV or cache it at module level with a TTL. Compute it after the entity lookup so 404s and redirects do not pay for it. |
| P2 | **H** | `db/channel.js:181-183` `channelStats` | `COUNT(*)` of all posts in the channel, plus a `created_at>=?` count via `discussions_entity(entity_id,status,post_no)`, scans every post in the channel on every render. | Keep `post_count` and `today` counters on a `channel_stats` row, updated in the write path (`api.js`), or add the index `(entity_id,status,created_at)`. |
| P3 | H | `db/channel.js:152-161` `channelPosts` | `ORDER BY d.pinned DESC, …` gives `USE TEMP B-TREE FOR ORDER BY` over the channel's whole board. The `hot` sort computes an expression per row (full sort). `page` up to 1000 means OFFSET 29,970. | Query pinned posts separately (few rows), then `ORDER BY post_no DESC` served by the index. Use keyset pagination (`post_no < ?`) instead of OFFSET. Cap `page` at about 50 for anonymous users, or precompute `hot_score` on write and index `(entity_id,status,hot_score)`. |
| P4 | M | `db/channel.js:88-90` `changesFor` | The planner picks `changes_feed (visibility, importance>?)`, a scan of all public changes, instead of `changes_entity`. There are already 11k rows after the seed import. | Add the index `(entity_id, visibility, importance, id)`, or write `+importance` to steer the planner. Run `PRAGMA optimize` after migrations. |
| P5 | M | `db/channel.js:192-201` `frontPosts` (news, kind) | `discussions_feed(status)` followed by a sort on `created_at` scans all published posts. | Add the index `(kind, status, created_at)`. The news filter can use `author_id LIKE 'system:%'` because kind=news is selective. |
| P6 | M | `db/channel.js:219-224` `openModels` and `:227-230` `entitiesWithFact` | They filter `e.type=?` without `vertical`, so the `entities_type(vertical,type,status)` index cannot be used. `openModels` runs on every GPU page. | Add `e.vertical='ai'` / `'hardware'`. Memoize `openModels` per isolate for 10 min. |
| P7 | M | N+1 loops: `panels/game.js:20` (`compatReportCounts` per patch), `panels/gpu.js:22-26` (versions and issues per driver), `panels/ai.js:47` (versions per service), `panels/ip.js:22` (`related` per family member; a franchise with 30 works means 30 queries) | Sequential round trips; D1 counts 50 queries per invocation on Free. | Batch with `inChunks`: `WHERE subject_id IN (…)` / `entity_id IN (…)` with GROUP BY. Use `db.batch()` for the independent reads in `loadChannel`. |
| P8 | L | `db/channel.js:80-81` `eventsFor` | `SELECT DISTINCT` over joined rows with filters; sorting and slicing happen in JS after fetching **all** matching events. | Push `ORDER BY starts_at LIMIT ?` into SQL. |

### 3.3 SEO
| # | Sev | Where | Problem | Fix |
| --- | --- | --- | --- | --- |
| S1 | **H** | `ui.js:95` (`/search/`), `:96` (`/radar/`), `:100` (`community/best/`), `channel.js:81` (`write`, fixed in the working tree), `:91` (search), `:94` (`wiki/history`), `post.js:68` (`/report`), `front.js:34` (`/radar/`) | Every cached page links to **6–8 URLs that return 404**. Crawlers follow them and log soft errors, and users hit dead ends. | Until each route ships, render these as `<span aria-disabled>` or omit them. Add a test that crawls the preview and asserts every internal href resolves. |
| S2 | **H** | (missing `platform/seo.js`) `channel.js:104` | There is no content gate. `games:org` (314), `subculture:character` (112), `creator` (36) and most `voice_actor` pages have 0 facts, no description and an empty wiki box (e.g. `/ko/games/07th-expansion/`), yet they are `index`. That is about 960 thin URLs. | Implement `seoGate(entity,facts,relations,posts)` using the existing `indexMin` per type. Emit `noindex,follow` below it and keep those entities out of sitemaps. |
| S3 | M | `post.js:77` | For a ko post viewed at `/en/…`, the page is `noindex` but canonical is **self**. The indexable ko version declares `hreflang="en"` pointing at that noindex page, which is a hreflang conflict. | Posts: canonical = `postUrl(p.locale,…)`, no alternates (or `x-default` = the original only). |
| S4 | M | `channel.js:103-104` | Filtered and paged views are noindex but still emit hreflang alternates that point to the **unfiltered** base URLs, so they do not reciprocate. | Emit alternates only when `!noindex`. |
| S5 | M | `pages.js:69` (cache key) and `channel.js:102` | Any query string creates a new page (`?utm_source=x` renders `index` with canonical = base, but is a separate cache entry). | Normalize (see X1) and 301 on non-canonical parameters. |
| S6 | M | `ui.js:71-92` `page()` | No `og:type`, `og:image`, `og:locale`, `twitter:card` or `BreadcrumbList`. The static site already has `socialMetadata()` (`src/seo.js`). | Reuse it. Add BreadcrumbList (Community › vertical › channel › post). |
| S7 | M | `channel.js:105` | JSON-LD is a generic `CollectionPage` whose `name` is the full `<title>`. | Choose by type: `VideoGame` (games), `SoftwareApplication` (ai:service, studio:app), `Product` (gpu, merchandise), `TVSeries`/`Movie`/`CreativeWork` (works), `Person` (voice actors), plus **`Event`** for IP-panel dates (start date, location, url), which is eligible for rich results. |
| S8 | M | `post.js:79` | `DiscussionForumPosting` lacks `text` (required by Google together with author and datePublished), `author.url`, `dateModified` and `comment[]`. | Add `text: plainExcerpt(body,500)` and the first N comments as `Comment`. |
| S9 | L | English channel pages | The board mixes Korean posts into `/en/` pages marked as the English alternate. | Show the board filtered to `locale=en`, with a "Korean posts (n)" link. |
| S10 | L | `channel.js:99-100` | Title and description templates repeat across the 479 entities without a description. | The gate (S2) covers it. For indexable pages, build the description from 2–3 key facts. |

### 3.4 Security
| # | Sev | Where | Problem | Fix |
| --- | --- | --- | --- | --- |
| X1 | **H** | `server/platform/pages.js:69` | The cache key is `request.url` **including arbitrary query strings**. `?x=<random>` on every request bypasses the cache and costs 9–23 D1 queries plus P1/P2 full scans per hit. That is cheap cost amplification and cache fragmentation. Pages are not poisoned, because output depends only on the URL and D1, and the key includes the host. | Build the key from path plus an allowlist (`kind`, `sort`, `best`, `page`, `v`) in fixed order, after validation. 301 on anything else. Apply a per-IP miss limit (`server/ratelimit.js`). |
| X2 | M | `render/html.js:28` `safeHref` | `'/\\evil.example'` passes the `'/'`-but-not-`'//'` check, and browsers treat `/\` as `//`, so it becomes an external protocol-relative link. It is reachable from collector or seed URLs (event `url`, `notes_url`, `official_urls`) and any future user-supplied link. | Resolve with `new URL(s, 'https://nerulio.com')` and accept only when the origin matches or the protocol is http(s). Also reject `/\\` and control characters. |
| X3 | M | Working tree `server/platform/api.js:55-57` | The purge deletes exact URLs from `caches.default`, which is **per data centre**. Variants (`?sort=hot`, `?page=2`, junk params) stay stale for up to 60 s + SWR. | Use a per-entity version in the cache key (`?v=<entity.version>` read from a small table), as D4 intends, together with X1 normalization. |
| X4 | M | `pages.js:61` | SSR responses carry no CSP, `frame-ancestors`, Referrer-Policy or Permissions-Policy, because `_headers` does not apply to Worker responses. In **ads builds** `secureResponse` adds `form-action 'none'` (`tools/ads-worker.mjs:7`), which **blocks the header search form and every n2 form**. | Add a platform CSP in `html()` (`default-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'`). In ads builds, allow `form-action 'self'` for platform paths. |
| X5 | M | `db/channel.js:140` (HEAD) | `author_name` fell back to `users.display_name`, which is the **Google profile name** (`auth-google.js:62`), a real-name leak. | **Fixed in the working tree** (`user-xxxxxx` fallback, `ensureProfile`). Add a test that pins it. |
| X6 | L | `pages.js:40-60` | There is no try/catch, so a D1 error becomes an uncaught 500. HEAD returns the same body as GET. | Wrap the call: log it, return 503 with `Retry-After`, and fall through for HEAD with no body. |
| X7 | OK | `html.js` / `markdown.js` / JSON-LD | Escaping is sound: every interpolation is escaped, JSON-LD escapes `<`, and `tests/n2-markdown.test.mjs` covers the XSS vectors. The slug-rename redirect (`pages.js:51`) builds a same-origin path from a DB slug, so there is no open redirect. `safeReturnPath` (`auth-google.js:11-14`) is strict. | — |

### 3.5 Accessibility
| # | Sev | Where | Problem | Fix |
| --- | --- | --- | --- | --- |
| A1 | M | `ui.js:36` `badge(v,l,text)` with glyph-only text (`'✓'`, `'⚙'` in `front.js:35`, `generic.js:24`, `ip.js:39`) | The verification state reaches screen readers as "✓" alone. The meaning is carried only by colour and class. | Keep the glyph `aria-hidden` and add visually hidden text with the full label (or a `title` plus an `sr-only` span). |
| A2 | M | `panels/game.js:76` (matrix), `studio.js:40` (OS chips) | Cells show only ✓ ◐ ✕ – with the meaning in `title=`. "–" means both "no row" and "unknown". | Add `sr-only` status text. Use distinct marks for unknown and no-data. |
| A3 | M | `src/platform/n2.css` `.hq input{outline:0}` | The search box has no visible focus indicator (WCAG 2.4.7), and there is no `:focus-within` rule. | Add `.hq:focus-within{outline:2px solid …}`. |
| A4 | M | `post.js` (whole page) | The post page has **no `<main>` landmark**. Channel and front pages wrap only the left column. | Wrap the body in `<main id="main">` and put `<aside>` beside it. The skip link already targets `#main`. |
| A5 | L | `ui.js:59` (`postRow`) | `<span aria-label="image">` on a non-interactive span without a role is ignored. `postRow` puts `aria-hidden` on a header `<li>` inside the list, which breaks list semantics. | Use `role="img"` or `sr-only` text. Render the column header outside the `<ol>`. |
| A6 | L | `post.js:47` (HEAD) | "신고" is a `<span>` and "답글" jumps to its own anchor. Vote buttons are disabled without explanation. | Partly addressed in the working tree. Add `aria-describedby` "로그인 필요". |
| A7 | L | `page()` | Korean entity names on `/en/` pages have no `lang="ko"`. | Wrap names with `lang` when the chosen name's locale differs from `l`. |

---

## 4. Data coverage (seed: 32 files, 1,580 entities)

### 4.1 Per vertical and type
Counts come from `data/seed/**`. "Empty top" means the channel has no dedicated panel, so the top of the page is empty apart from generic changes and events.

| Type | n | No `names.ko` | No `description.ko` | 0 facts | Panel | Notes |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| ai:model | 100 | 85 | 0 | 0 | generic | 9.8 facts avg; 47 open models drive the GPU estimate |
| ai:service | 13 | 5 | 0 | 0 | ai | **0 incident events**; status box unbacked (C1) |
| ai:plan / feature / provider / runtime | 19 / 39 / 8 / 4 | 0 / 0 / 1 / 0 | 0 | 0 / 6 / 0 / 0 | generic | 2 features in `preview`, 0 `rolling_out` → rollout box empty |
| games:game | 265 | **198** | 0 | 0 | game | 190 have versions; **0 game events** → "이번 주" empty on all 265 |
| games:org | 314 | **314** | **314** | **314** | generic | name only, pure thin pages |
| games:translation_patch | 34 | 0 | 0 | 0 | generic | cover 32 games; compat rows mostly `target_version='*'` or build numbers that do not match Steam versions (Caves of Qud: patch row `2.0.212.31` vs Steam `1.04`; Be My Horde `v0.14.7` vs `0.14.5`) |
| hardware:gpu | 90 | 0 | 0 | 0 | gpu | specs complete; **no `driver` entities**, 0 benchmarks → driver box hidden, benchmark board empty |
| hardware:vendor | 3 | 0 | 0 | 0 | generic | |
| studio:app | 11 | 1 | 0 | 0 | studio | strong: versions + OS compatibility (1,216 compat rows overall) |
| studio:plugin | 158 | **158** | 2 | 0 | studio | |
| studio:audio_device | 35 | **35** | 0 | 0 | studio | |
| studio:vendor / os_release | 36 / 12 | 9 / 0 | 1 / 0 | 0 | generic | |
| subculture:work | 84 | 39 | 27 | 0 | ip | 160 events total across subculture (101 in the future) |
| subculture:franchise | 47 | 3 | 0 | 0 | ip | |
| subculture:character | 112 | 70 | **111** | **112** | ip | relations only |
| subculture:voice_actor | 65 | **64** | **64** | 7 | generic | e.g. "Masakazu Morita", no Korean name |
| subculture:creator / studio_org | 36 / 41 | 29 / 30 | 0 | 36 / 4 | generic | |
| subculture:merchandise / event / collaboration | 41 / 8 / 5 | 41 / 2 / 0 | 0 | 0 | generic | |

**Korean-facing gaps.**
- **1,084 of 1,580 entities (69%) have no `names.ko`.** Another 67 have a `ko` value without Hangul; most are brand names such as "Claude", which is acceptable. Only **429 have a Hangul name**.
- 519 lack a Korean description.
- The worst gaps are for Korean readers: games (198/265; the Korean-patch audience will search the Korean title), voice actors (64/65), plugins (158) and merchandise (41).
- Only 7 entities have a Hangul alias and no Hangul name, so the aliases do not fill the gap either. This hurts `search_docs` trigram search in Korean as well.

### 4.2 Showcase channels in production (no demo posts)
I rendered them from the seed with no `demo-posts`:
- **Community front.** "실시간 베스트", "새 리포트" and "답을 기다리는 질문" are empty. "지금 바뀌는 것" falls back to `radarChanges(minImportance 2)`, and the only rows at that importance are 12 subculture `event_changed` entries, so the front's news box is **all anime schedule changes** ("템빨 일정 변경 / 템빨"). "인기 채널" is the unordered featured list (C7).
- **`ai/claude`.** The status is unbacked (C1). The "just changed" box contains only model releases derived from facts. The models, prices and plans are solid. The board is empty.
- **`hardware/rtx-5070`.** The VRAM-fit estimate is good. There is no driver box. "측정 리포트 없음" appears four times and the benchmark board is empty. **More than half of the page is empty states.**
- **`games/caves-of-qud`.** Version history and patches are good. The patch strip says "알 수 없음" (the data really is unknown). "이번 주 일정 없음" appears. In the matrix, "–" means both unknown and no row.
- **`studio/ableton-live`.** This is the strongest page: versions plus the OS matrix. The chips "12 ✓ 12 ✓" repeat because two rows share a major version, which is ambiguous.
- **`subculture/bleach-tybw-the-calamity`.** Countdown and events are good. The cast names are romaji only. The AniList ID leaks (C2).

**The best launch channels on data today** are studio apps, AI services (once the status collector runs), IP works with events, and GPUs (once driver and benchmark data exist). Game channels need Korean titles and game events or updates from collectors to avoid looking empty.

---

## 5. Prioritized backlog

Ordering rule: items 1–12 need **no external accounts, no D1 provisioning and no deploy**. One engineer can do them tonight with `node --test` and the preview. Effort: S < 2 h, M ≈ half a day, L ≥ 1 day.

| # | Task | Why | Files | Effort | Depends on |
| ---: | --- | --- | --- | :-: | --- |
| 1 | **Normalize the cache key and query strings.** Allowlist `kind/sort/best/page/v`, use an integer `page` of 50 or less, `Object.hasOwn` for `kind`, and 301 to the canonical form. Add slash-normalization redirects. | X1, C4, C5, C13, S5. Cost amplification and cache fragmentation. | `server/platform/pages.js`, `platform/render/channel.js`, `tests/n2-render.test.mjs` | S | — |
| 2 | **Stop rendering dead links.** Hide or disable search, radar, best, wiki history and report until their routes exist. Add a test that crawls the preview and resolves every internal href. | S1. Every cached page ships 6–8 404 links. | `platform/render/{ui,channel,post,front}.js`, new `tests/n2-links.test.mjs` | S | — |
| 3 | **Status box honesty.** Show "not checked yet" when there is no fresh collector run. | C1. The page currently invents a fact. | `platform/render/panels/ai.js` | S | — |
| 4 | **Honour `public:false` and add an `id` property type.** | C2. Private fact leak and "185,874". | `panels/generic.js`, `render/format.js`, `verticals/{subculture,games}.js` | S | — |
| 5 | **Fix `safeHref`.** Reject `/\`, resolve with `URL`, and add tests. | X2. | `platform/render/html.js`, tests | S | — |
| 6 | **Post page fixes.** Best-comment id/duplicate, canonical to the original locale, drop alternates, add `<main>`, add JSON-LD `text` and comments, and the "around" window. | C3, C8, S3, S8, A4. | `platform/render/post.js`, `db/channel.js` | M | coordinate with in-progress `post.js` edits |
| 7 | **SEO content gate `platform/seo.js`.** Use the existing `indexMin` per type (facts + relations + description + posts). Output `noindex,follow` below the threshold and the list of indexable ids. | S2. About 960 thin URLs today. | new `platform/seo.js`, `render/channel.js`, tests | M | — |
| 8 | **Indexes and query rewrites.** Migration `0005`: `discussions(status,created_at,entity_id)`, `discussions(entity_id,status,created_at)`, `discussions(kind,status,created_at)`, `changes(entity_id,visibility,importance,id)`. Add `vertical=` to `openModels`/`entitiesWithFact`. Split the pinned query and use keyset pagination. Use `ORDER BY post_no` in `recentTitles`. Verify with `EXPLAIN` in a test. | P1–P6, C9. | `migrations/0005_platform_indexes.sql`, `platform/db/channel.js`, new `tests/n2-query-plan.test.mjs` | M | — |
| 9 | **Channel bar off the hot path.** Compute it after the entity lookup, memoize per isolate (60–300 s), keep `FEATURED` order, and do not run it for 404s and redirects. | P1, C7. Every render currently scans all recent posts. | `server/platform/pages.js` | S | 8 |
| 10 | **Batch the panel reads.** Remove the N+1 loops in game, gpu, ai and ip. Run independent `loadChannel` reads in parallel or through `db.batch`. Memoize `Intl.DateTimeFormat` in `format.js`. | P7, P8, CPU budget on Workers Free. | `platform/render/panels/*.js`, `platform/db/channel.js`, `platform/render/format.js` | M | 8 |
| 11 | **SSR security headers.** Add a platform CSP (`form-action 'self'`), `frame-ancestors`, Referrer-Policy, try/catch → 503, and HEAD without a body. In ads builds, keep `form-action 'self'` for platform paths. | X4, X6. The search form is blocked in ads builds. | `server/platform/pages.js`, `tools/ads-worker.mjs`, `tests/service-build.test.mjs` | S | — |
| 12 | **Structured data and social meta.** Use a schema type per entity type, `Event` for IP dates, BreadcrumbList, OG image/type/locale via `src/seo.js#socialMetadata`, and hreflang only on indexable views. | S4, S6, S7. | `platform/render/{ui,channel}.js`, `platform/verticals/*.js` | M | 7 |
| 13 | **Accessibility pass.** `sr-only` labels for glyph badges and matrix cells, the focus ring on search, list semantics, and `lang` on foreign names. Add an axe run in the preview test. | A1–A3, A5, A7. | `platform/render/{ui,panels/*}.js`, `src/platform/n2.css` | M | — |
| 14 | **Correct the tool ↔ channel mapping.** Move the Labs to `studio:app` (Godot, Blender), give games compress and mp4-to-gif, drop `vram-fit` until it exists, and render "관련 채널" on tool pages at build time behind `PLATFORM`. | §1.3. It is the only bridge from existing traffic. | `platform/verticals/*.js`, `platform/render/channel.js`, `tools/build.mjs` (flagged), `src/content.js` | M | — |
| 15 | **Search page `/{l}/search/`.** FTS5 trigram for queries of 3 or more characters, an alias prefix for shorter ones, and the `in=` channel scope. Add the `_routes` entry. | The header box already posts there. `search_docs` is populated. | new `platform/db/search.js`, `platform/render/search.js`, `server/platform/pages.js`, `tools/service-build.mjs` (`PLATFORM_ROUTES`) | M | 1 |
| 16 | **Radar feed `/{l}/radar/` (+ `?v=`).** Use `changes` at importance 1 or more, grouped by day, with `describeChange`. Add a hub `/{l}/{vertical}/` listing the top channels. | The architecture's central loop. The hub URLs are already routed to the Worker and 404 today. | new `platform/render/{radar,hub}.js`, `db/channel.js` or `db/radar.js`, `pages.js`, service-build routes | M | 8 |
| 17 | **Entity sitemaps.** `/sitemap-entities-{vertical}.xml` from D1 (gated ids only, lastmod = `updated_at`), and link it from the sitemap index at build time when `PLATFORM=on`. | Discovery for about 1,000 gated URLs; §6 of the architecture. | `server/platform/sitemaps.js`, `tools/sitemaps.mjs`, `tools/service-build.mjs` | M | 7 |
| 18 | **Korean name backfill.** Games (198) from the Steam `l=koreana` store API (the collector exists), voice actors and characters from the existing "Korean name credit" sources. Validator warning when `names.ko` is missing on types with `koRequired`. | §4.1: 69% of entities have no Korean name, which hurts ko search and titles. | `data/seed/{games,subculture,studio}/*.json`, `collectors/steam-store`, `tools/platform/validate-seed.mjs` | L | — |
| 19 | **Cache invalidation by entity version.** A `entity_versions` row bumped on write and folded into the cache key, replacing exact-URL purge. | X3. Stale variants and per-colo purge. | `server/platform/{pages,api}.js`, migration `0005` | M | 1, API v2 |
| 20 | **Finish the API v2 write path.** Land the in-progress `api.js` and `islands.js` with the tests. Fix the sign-in link to `?return=` in place of `?next=`/`?provider=`. | Follow, vote and comment are all disabled today. The login round-trip loses the channel. | `server/platform/api.js`, `src/platform/islands.js`, `platform/render/{channel,front}.js` | M | 1, 11 |
| 21 | **Report form and moderation minimum.** Report submit, `content_flags` write, a moderator queue at `/admin/` (role-gated) and `moderation_actions` log. | Needed before any public UGC. | `server/platform/api.js`, new `platform/render/admin.js`, `platform/db/moderation.js` | L | 20 |
| 22 | **Collectors on a schedule.** A GitHub Actions workflow per cadence (status 15 min, releases hourly, Steam daily) writing through the D1 REST API as PROGRESS proposes. Update D6 in the architecture doc. | Status, drivers and game updates are what make channels "live". | `.github/workflows/collect.yml`, `tools/platform/collect.mjs`, `NERULIO_2_ARCHITECTURE.md` | M | **needs D1 + API token** |
| 23 | **GeForce driver data and GPU driver scoping.** A consumer driver collector plus a GPU→driver relation. | C6, and the missing driver box on 90 channels. | `collectors/nvidia-geforce-drivers/`, `panels/gpu.js` | M | 22 |
| 24 | **GitHub and Discord OAuth.** Reuse the state, nonce and cookie code from `auth-google.js`. | D7. | `server/auth-github.js`, `server/auth-discord.js`, `server/api.js` | M | **needs OAuth apps** |
| 25 | **Type checking and the missing docs.** Add `tsconfig.json` (strict, `platform/` and `server/platform/`) and CI `tsc --noEmit` via `npx`, and write `docs/NERULIO_2_SCHEMA.md` and `NERULIO_2_MIGRATION_PLAN.md`. | D3 is claimed but not enforced. The docs are referenced but missing. | `tsconfig.json`, `.github/workflows/ci.yml`, docs | S | — |
