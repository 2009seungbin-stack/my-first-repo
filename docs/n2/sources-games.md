# Games vertical — sources, collectors and coverage

Branch `nerulio/n2-data-games`. Retrieval date of everything below: **2026-09-28**.
Seed files: `data/seed/games/steam-games.json` (collector output) and
`data/seed/games/translation-patches.json` (curated community patches).

## 1. Source inventory

| Source | URL / endpoint | Access | Documented? | Terms / robots | Cadence | Automated? |
| --- | --- | --- | --- | --- | --- | --- |
| Steam store app details (adapter `steam-store`) | `https://store.steampowered.com/api/appdetails?appids=<id>&l=english&cc=us` and `&l=koreana&cc=kr` (English data falls back to `cc=kr` when the app is not sold in the US store) | JSON over HTTPS, no key | **No.** This is the JSON endpoint behind the Steam store page. It is widely used and publicly reachable, but it is **not part of Valve's documented Steam Web API** (it is not listed at partner.steamgames.com/doc/webapi or in the public Web API docs). We use it because we observed it responding, not because it is documented. Valve can change or throttle it without notice. | `store.steampowered.com/robots.txt` (checked 2026-09-28) disallows `/share/`, `/news/externalpost/`, `/widget/` and a few account paths. It does not disallow `/api/`. Steam Subscriber Agreement: https://store.steampowered.com/subscriber_agreement/ . Rate limit: not published. Commonly reported as about 200 requests per 5 minutes. We send ≥1.5 s between requests and back off on HTTP 429 or a `null` body (30 s, then 90 s). | weekly (`freshnessHours: 168`) | yes |
| Steam news, developer announcements (adapter `steam-news`) | `https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=<id>&count=50&maxlength=300&feeds=steam_community_announcements&format=json` | JSON over HTTPS, no key | **Yes.** https://partner.steamgames.com/doc/webapi/ISteamNews documents GetNewsForApp v2 (appid, maxlength, enddate, count, feeds). No key is required. | Steam Web API Terms of Use: https://steamcommunity.com/dev/apiterms (100,000 calls/day; Valve attribution and links on pages that use the data; no implied endorsement). `api.steampowered.com/robots.txt` says `Disallow: /` for crawlers. We call a documented API at low volume (one request per game per day, ≥1.5 s apart). We do not crawl. The owner should confirm this reading. The alternative would be the store RSS feed `store.steampowered.com/feeds/news/app/<id>/`. | daily (`freshnessHours: 24`) | yes |
| Steam weekly top sellers, Korea (target selection only) | `https://api.steampowered.com/IStoreTopSellersService/GetWeeklyTopSellers/v1/?input_json={"country_code":"KR",…}`, the endpoint behind https://store.steampowered.com/charts/topselling/KR | JSON, no key | **No**, observed responding | as above | when `select-targets.mjs` is re-run | semi (script) |
| Steam most played, global (target selection only) | `https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/`, the endpoint behind https://store.steampowered.com/charts/mostplayed | JSON, no key | **No**, observed responding | as above | when `select-targets.mjs` is re-run | semi (script) |
| Korean community translation patches | each translator's own page: GitHub repositories, Naver blog posts, Steam Workshop items or Steam guides by the translator, Blogspot, and DC Inside or arca.live posts by the author | read by hand (research agents opened every page) | n/a | links only, **no files hosted**. No reuploads, mirrors, file lockers, aggregators, or anything that needs a cracked or pirated executable. | manual, re-check before a patch's page is promoted | **MANUAL_SOURCE** (curated) |

### Source kinds and verification labels (and why)
- `steam-store` sources are kind **`OFFICIAL`**. The source URL is the game's official Steam store page (`https://store.steampowered.com/app/<id>/`), and the developer or publisher enters the data on Steamworks. The kind is deliberately **not `OFFICIAL_API`**, because the JSON endpoint is undocumented. The note on each source names the exact endpoint URLs read.
- `steam-news` sources are kind **`OFFICIAL_API`**: a documented Steam Web API method returning posts written by the developer.
- All collector facts are **`AUTOMATED`**. They are machine-read, and some involve interpretation: the Korean mapping below, and update and version detection from post titles. They are not labelled OFFICIAL even though the underlying data is the developer's.
- Translation-patch data is **`COMMUNITY`**. It comes from the author's page and Nerulio has not verified it.

### Mapping rules (what each fact means)
- `korean_official` comes from the English `supported_languages`:
  - `Korean<strong>*</strong>` becomes `full_audio`.
  - `Korean` without the asterisk becomes `interface_subtitles`.
  - Korean absent becomes `none`.
  - A missing field produces no fact.
  - **Caveat:** Steam's field does not separate "interface" from "subtitles". The store's language table does, but we do not scrape HTML. `interface_subtitles` therefore means "Korean text support listed, no Korean full audio", and the fact note says so. The asterisk is the developer's own declaration. For example, Hollow Knight declares full audio for every language although its voices are mostly non-verbal.
- `official_languages` is the English language names exactly as Steam lists them.
- `release_date` uses the precision the store gives (`YYYY-MM-DD`, `YYYY-MM` or `YYYY`). "Coming soon", "TBA" and quarters are omitted. Upcoming games get `status: upcoming`, and any date is labelled as planned in the note.
- `platforms` are windows, macos and linux. `genres` are Steam's English genre labels. `homepage` is the store's `website` field when it is a valid http(s) URL.
- Korean names: `names.ko` is set only when the Korean store (`l=koreana`) shows a different name, for example 이터널 리턴 or 서브노티카 2. Otherwise only `en` is given (SEED-FORMAT rule 4).
- Developers and publishers become `org:<slug>` entities with `developed_by` / `published_by` relations. Existing orgs are reused by normalised name or alias.
- `last_update_at` is the UTC day of the newest **stable** update post. The exact timestamp and post title are in the fact note. A post counts as an update when:
  - the developer tagged it `patchnotes`, or
  - its title states a version, or uses patch, hotfix, changelog or release-notes wording (including 패치, 핫픽스, 업데이트 안내),
  - and it is not a preview, roadmap, announcement, known-issues, maintenance, service-report or ban notice, or 예정/예고 post.
  - Beta, experimental, PTR and playtest posts are ignored.
- `current_build` is the version stated in that newest update post, only when it states one.
- `versions[]` are stable update posts whose **title** states a version: dotted numbers (`1.5.12620`, `12.4a`), `Patch #7` / `Hotfix #36`, or `Version 20260924`. Bodies are never parsed, because they mention old versions. Date-like tokens (`09.25`, `2026.09.28`) are rejected. Each version keeps the date of its first post, and `notes_url` is the post URL Valve returns. A new stable version is what `platform/ingest.js` uses to move translation-patch compatibility to `unverified_after_update`.

## 2. Reproducing the data

```
node collectors/steam-store/select-targets.mjs   # charts (KR top sellers 1-200, most played 1-100) + curated.json → targets.json
node collectors/steam-store/build-seed.mjs       # runs steam-store + steam-news over targets.json → data/seed/games/steam-games.json
node tools/platform/validate-seed.mjs data/seed/games
node tools/platform/collect.mjs --adapter steam-store --limit 5 --out <scratch>.json   # live smoke run from the seed
node tools/platform/collect.mjs --adapter steam-news  --limit 5 --out <scratch>.json
node --test tests/n2-collector-steam-store.test.mjs tests/n2-collector-steam-news.test.mjs   # recorded fixtures, no network
```

- **Target list:** `collectors/steam-store/targets.json` lists every appid with its reasons (`kr_top_seller_week:<rank>`, `most_played_global:<rank>`, `curated:<reason>`). It lives next to the adapter because every `*.json` under `data/seed/` must be a `nerulio.seed/1` document.
- **Chart filters:**
  - chart entries that are not apps of type 0 (DLC, soundtracks) are dropped;
  - entries with Steam adult-content descriptors 3 or 4 are dropped;
  - Wallpaper Engine (software) is excluded.
- **Curated picks:** in `curated.json` with a stated reason (`korean_patch`, `indie_hit`, `korean_developer`, `big_release`, `classic`). The build compares each curated name with the store name, as a wrong-appid guard.
- **Stability across builds:**
  - ids are `game:steam-<appid>`;
  - slugs and org ids already in the seed file are kept on rebuild;
  - a game whose fetch fails keeps its previous entity.

## 3. Coverage (build of 2026-09-28)

**Targets.** 268 appids in `targets.json`, plus curated `korean_patch` games. A game can have several reasons, so the groups overlap:

| Reason | Games |
| --- | --- |
| KR weekly top-seller chart | 92 |
| Global most-played chart | 99 |
| `curated:indie_hit` | 51 |
| `curated:big_release` | 31 |
| `curated:korean_patch` | 32 |
| `curated:classic` | 20 |
| `curated:korean_developer` | 10 |

Three targets turned out not to be games (a demo, a mod and an advertising app) and were skipped.

**Entities:**
- **265 `game`** entities.
- **314 `org`** entities: developers and publishers, with 326 `developed_by` and 288 `published_by` relations.
- **67** games have an official Korean store name (`names.ko`).

**Game facts** (all `AUTOMATED`):

| Fact | Games |
| --- | --- |
| `steam_appid` | 265 |
| `korean_official` | 265 |
| `official_languages` | 265 |
| `platforms` | 265 |
| `release_date` | 264 |
| `genres` | 264 |
| `homepage` | 224 |
| `last_update_at` | 231 |
| `current_build` | 157 |
| `status: upcoming` | 2 |

`versions[]`: 1,137 version rows across 190 games.

**Korean support per the Steam store:**

| `korean_official` | Games |
| --- | --- |
| `interface_subtitles` | 163 |
| `full_audio` | 49 |
| `none` | 53 |

**Update recency:** 86 games posted an update in the last 30 days and 122 in the last 90 days.

**Sources:**
- 265 `OFFICIAL` store-page sources.
- 231 `OFFICIAL_API` news sources, one per game with detected updates.
- 34 `COMMUNITY` patch-author pages.

**Live smoke runs** (2026-09-28, `collect.mjs --limit 5`):
- `steam-store`: 5 games, 10 snapshots, 19 entities, validation OK.
- `steam-news`: 5 read, 4 with updates, validation OK.
- Full builds: 265/265 store reads and 265/265 news reads, 0 failures, no HTTP 429 seen at 1.5 s spacing.

## 4. Translation patches (curated)

There are 34 `translation_patch` entities covering 33 games. Every game in this list shows `korean_official: none` on Steam.

**How they were researched.** Three research passes on 2026-09-28 covered:
- strategy and Bethesda games;
- CRPGs and indie games;
- Japanese games, visual novels and action games.

For each patch the researcher opened the **translator's own page**: a GitHub repo or release, a Naver blog post, a Steam Workshop item or Steam guide by the translator, Blogspot, or the author's own DC Inside or arca.live post.

**Facts on every patch** (all `COMMUNITY`): `patch_language`, `author_name`, `distribution` and `homepage`.
- `distribution` is `link_only` for 23 patches. It is `official_mod_platform` for 11 patches hosted on Steam Workshop by the author.
- `patch_version` is set on 14 patches, and only where the page states it.
- `verified_game_version` is set on 7 patches, and only where the author names the game version.
- Each patch has a `translates` relation to its game.
- There are 14 patch `versions`. `released` is filled only where the page gives the date.

**Compatibility.** There is one row per patch, from patch to game.
- 7 rows have `status: works`, with the author's stated game version as `target_version`: Starfield 1.15.216, Fallout 4 1.11.240, Terraria 1.4.5.3, NWN:EE 8193.35, Be My Horde v0.14.7, Caves of Qud 2.0.212.31 (env `branch=lang-experimental`) and NieR:Automata (final July 2021 update).
- 27 rows have `status: unknown`, meaning the author names no tested version. The brief asked for "unverified". `COMPAT_STATUS` has no plain "unverified" value, so `unknown` is used, and each row's note says why.
- Several stated versions are already older than the game's `current_build`: Starfield 1.16.244 against the stated 1.15.216, and Terraria 1.4.5.7 against the stated 1.4.5.3. This is exactly the case the `unverified_after_update` flow is for. The flow fires on the first non-seed ingest of a newer version.

**Excluded on purpose:**
- A Skyrim SE "integrated" patch: an anonymous compilation of other people's patches, not the translator's own page.
- A New Vegas all-in-one repack, and an Attila "emergency fix" that is an unauthorised reupload.
- Ys SEVEN: it bundles ripped Japanese voice files.
- Tales of Berseria: the author offers to e-mail patched game data files.
- The Steins;Gate family and Chaos;Child: the only install route is a site that also hosts ROM downloads.
- Obsolete patches for games that now have official Korean, such as Kenshi, Stellaris, CK3 and HOI4.
- Candidates with no reachable author page: Tyranny, Pillars of Eternity II, Citizen Sleeper, Underrail and Dwarf Fortress.

**Worth knowing:**
- Some patches modify the user's own install. NWN:EE patches the game executable and injects a DLL. Pathologic 2 replaces .asset files. Distant Worlds 2 loads a DLL via a launch option. Warriors Orochi 3U adds dinput8.dll.
- Three patches say they are AI-translated in full or in part: Rogue Trader, Imperator Invictus and Distant Worlds 2. Starfield is about one-third AI.
- The descriptions say all of this.
- None of the patches uses or links to a cracked executable.

## 5. Known gaps and risks

### Endpoints and terms
- **Undocumented store endpoint.** `appdetails` can change shape, throttle or disappear. The adapter fails soft: a game that cannot be read keeps its previous seed entity, and a run with zero successes reports an error.
- **Chart endpoints** (top sellers and most played) are undocumented too. They are only used by the manual `select-targets.mjs`.
- **`api.steampowered.com` robots.txt disallows everything for crawlers.** We treat GetNewsForApp as a documented API call, not crawling. If the owner reads robots.txt strictly, switch `steam-news` to the store RSS feed `https://store.steampowered.com/feeds/news/app/<id>/`, which the store robots.txt allows.
- **Steam Web API Terms** ask for Valve attribution and links on pages that use the data. Entity pages should show a "Data: Steam" link to the store page (see the suggested core changes in the final report).

### Korean support and names
- **`interface_subtitles` is coarser than Steam's own language table**, which separates interface, audio and subtitles. The store HTML table is not scraped. The full-audio marker is the developer's own claim.
- **Regional editions.** Facts describe the Steam store listing. Some Korean-made games list no Korean on their Steam (global) edition because a separate Korean service exists: Lost Ark, Black Desert and MapleStory show `none`. That is correct for the Steam page, but the page copy should say "on Steam".
- **Two games the US store does not sell** (SoulWorker and GIRLS' FRONTLINE 2) are read through the KR store. Their `official_languages` then reflect the KR listing.
- **Korean names** come only from the Korean store. Some are stylised as the store shows them, for example "P의 거짓 (Lies of P)" or "BIOHAZARD RE:4". Games without a localised store name have no `ko` name.

### Update detection
- Detection is title-based and heuristic. Known limits:
  - developers who post updates without patch wording or the `patchnotes` tag are missed, so 34 games have no `last_update_at`;
  - an update inside a multi-topic post may be dated by a later post;
  - a DLC or tool version can appear first in a title, for example Bannerlord's "Patch WS v1.2.8 / BL v1.4.8".
- **Post bodies are never parsed.**
- `count=50` posts per game. For very chatty feeds, such as esports-heavy ones, the newest update can be older than the 50th post. Then `last_update_at` is omitted rather than guessed.

### Translation patches
- **Patch data is manual.** It needs a periodic re-check: author pages move and Naver blog links change. The seed records the page's last-update date in each source note.
- **Date inference.** Three Workshop "updated" dates showed no year on the page (Steam hides the current year). They were read as 2026 and appear only in source notes.

### Coverage
- **Not covered yet:** non-Steam storefronts (Epic, Battle.net, Microsoft Store), console editions, and prices. `current_build` is taken from news titles; it is not a SteamPipe build id, because that needs a key or partner API.
