# Static SEO and deployment

## Rendering and URL ownership

`npm run build` creates 236 HTML entries: canonical intents, language variants, retained aliases and four policy pages. This is not 236 distinct tools. The 38 canonical intents (including home/generic workspaces) and four policy routes each have three localized canonical URLs. Query parameter variants never enter a sitemap. The unprefixed entries remain language-negotiation entry points and x-default destinations; English canonical pages use `/en/`. Aliases intentionally share their target's canonical and social metadata.

HTML contains its title, description, translated heading and tool instructions, crawlable related links and examples before JavaScript runs. The focused upload remains above editorial content. Canonical, reciprocal en/ko/ja/x-default alternates, OG and X metadata are generated from the same registry. File-tool intent pages use WebApplication and visible BreadcrumbList data; game pages and home use SoftwareApplication with a free offer (below). No page has ratings, review counts or invented organization information.

`SITE_URL` must be the final HTTP(S) base including a subdirectory if used. It is currently `https://fileforge-studio.pages.dev/`. No configured origin means no invented production canonicals or absolute social URLs. Production social assets are committed 1200×630 PNGs, generated for each intent and locale. Policy pages retain their own canonical/title/description and language links.

## Game pages (game editor first, 2026-09-23)

The site's search focus is the game-asset Studio (`/game/studio/`, an app shell that stays noindex).
Search traffic reaches it through landing pages built by `tools/game-landing-build.mjs` from the copy
and data in `src/game-seo.js`:

- **Studio landings** — existing game routes whose job the Studio now does (`sprite-slicer`,
  `game/sprite-lab`, `normalize-sprite-frames`, `game/sprite-animation-preview`,
  `game/sprite-pivot-editor`, `game/hitbox-editor`, `game/collision-polygon-generator`,
  `sprite-sheet-maker`, `game/tile-lab`, `game/autotile-tester`, `game/tileset-slicer`). Same URLs,
  now a dark page with a keyword H1/title/description (ko/en/ja), a drop zone that hands the files
  to the Studio workspace (`src/game-landing.js` → `src/task/handoff.js` → `/game/studio/?ws=…`;
  Pack pages import through Sprite and then open Pack & Export), a real Studio screenshot, engine
  badges and an export table whose labels come from the Studio's own verification labels, how-to,
  limits and FAQ. The old Lab UI lives at `<route>/classic/` (noindex, canonical → landing) and is
  linked only where the Studio still lacks something; old Lab links with Lab settings in the query
  are forwarded there.
- **Keyword landings** — `game/gif-to-sprite-sheet`, `game/sprite-sheet-to-gif`,
  `game/aseprite-to-{godot,unity,phaser}`, `game/texture-packer-free`, `game/godot-sprite-sheet`,
  `game/unity-sprite-sheet`, `game/godot-pixel-art-blurry`, `game/godot-autotile`,
  `game/rpg-maker-autotile-to-godot`, `game/blob-47-tileset`, `game/dual-grid-tileset`,
  `game/tiled-wang-set`, `game/unity-rule-tile`: `src/landings.js` entries with a `studio` block,
  inheriting their base intent's indexing decision.
- **Lab landings** — Pixel, Texture, UI and Tile Lab routes (21, copy in `src/game-seo-labs.js`).
  The Lab itself moved to `<route>/app/` (noindex, canonical → landing); the landing's drop zone
  hands the files to it. Their export tables say "Measured" (the download was re-opened outside the
  page and measured) and never claim an engine run — no Lab output was loaded in an engine.
- **More keyword landings** — 16 in `src/game-seo-more.js` (Phaser/Pixi/Defold/LÖVE/Spine/Sparrow
  exports, GameMaker strip (UNVERIFIED), CSS sprites, background removal, sheet → PNG frames, Lospec
  palette, AI pixel-art clean-up, integer upscaler, pixel-art normal maps, roughness → smoothness,
  LDtk rules (partly verified)). 31 keyword pages in total.
- **Hub** — `/game/`, the breadcrumb parent ("Game studio") of every game page, grouped by workflow;
  it lists every guide once `src/guides.js` has guides (`tools/guides-registry.mjs`).

64 game pages × ko/en/ja, all indexable today. Indexing is decided by `src/capabilities.js` as for
every tool: an intent qualifies on a workflow and a quality check of `tests/game-landing-browser.py`
that pass in Chromium **and** Firefox (`STUDIO_EVIDENCE`, `LAB_EVIDENCE`). Studio intents also cite
the real-engine runs (`docs/STUDIO-PACK.md`, `docs/STUDIO-SPRITE.md`, `docs/STUDIO-TILE.md`; those
drove the UI in Chromium only and do not count toward Firefox). Keyword pages inherit their base
intent's decision; the ones whose promise is a Lab flow are measured in part 5 of the suite. UI Lab
images pass through a canvas: Firefox rounds semi-transparent colour to one premultiplied step, which
the copy says.

Structured data on every game page: `SoftwareApplication` (`DeveloperApplication`, Web, a free offer,
a feature list with the export verification labels), `BreadcrumbList` Nerulio › Game studio › page,
`FAQPage` built from exactly the questions shown on the page, and `HowTo` from exactly the steps shown
under "How it works" (the hub has no steps, so no HowTo). `tests/game-seo.test.mjs` compares the
JSON-LD with the visible text on all 192 pages. Game pages have no ad slots.

Internal links: each game page links 4–5 related pages plus the guides about the same job (when
guides exist); file-tool pages carry a "Making a game?" block (`data-chrome`); every footer links the
game workflows.

Assets: `python tools/studio-screens.py [--only a,b]` (needs a running server, `TEST_URL`)
regenerates the screenshots in `assets/studio/` (1440×900 + 780 px WebP) from committed CC0 fixtures;
`python tools/generate-social.py --game --force` regenerates the dark social cards
(`assets/social/<locale>-<intent id | game-<slug> | game>.png`, 192 cards).

## Sitemaps, images and robots

`/sitemap.xml` is a **sitemap index** (`tools/sitemaps.mjs`); `robots.txt` names only the index.

| File | Lists |
|---|---|
| `sitemap-game.xml` | home, the `/game/` hub, every indexable game page grouped by workflow |
| `sitemap-guides.xml` | the guides (only once `src/guides.js` has guides; dated by each guide's `updated`) |
| `sitemap-tools.xml` | image / PDF / video tools, their task landings, policies (+ pricing with the service layer) |
| `sitemap-images.xml` | game pages with their screenshot, tools with their before/after examples |

Every `<url>` is a language page with its hreflang alternates (ko, en, ja, x-default = the
language-neutral URL) and a `<lastmod>`. noindex pages (`/game/studio/`, `…/classic/`, `…/app/`,
unqualified tools) are never listed.

**lastmod is when the page's content changed, never the build time.** Builds run from shallow
clones, so the dates live in `tools/lastmod-ledger.json`: per language page, a hash of its title,
description and `<main>` text (header, footer, scripts and `data-chrome` navigation excluded) and the
date that content was committed. The ledger was bootstrapped from the first-parent history of
`origin/main` (each merge is a deploy: `node tools/lastmod.mjs --bootstrap`). When a page's content
changes, run `node tools/lastmod.mjs --write` and commit the ledger with the change — `npm test`
fails while it is stale. If a stale page is ever built anyway, it gets the date of the commit being
built, or no `<lastmod>` without git; it never gets an invented date.

Validation: `tests/sitemap.test.mjs` (CI, no network) checks the structure the schemas require,
the 50,000-URL / 50 MB limits, W3C dates, uniqueness and reciprocal hreflang.
`python tools/validate-sitemaps.py dist` (needs `pip install lxml`; downloads the schemas once)
validates a SITE_URL build against sitemaps.org `sitemap.xsd` / `siteindex.xsd`, Google's image
schema and the W3C XHTML schema for `xhtml:link` (sitemap.xsd checks foreign elements strictly).

Do not add aliases, query combinations or nonexistent features.

Tests, debug files, transfer archives, source-control metadata and build tooling are not copied into the public output. There are no temporary file-state URLs. Unknown URLs return the static `404.html` with an actual 404 response in the local host/Cloudflare Pages. The 404 has search and popular-tool links; there is no SPA fallback to home. Preview builds use robots disallow plus HTML and response-header noindex; their sitemaps are empty and ads/verification keys are disabled. Robots is not access control.

Example PNGs are original geometric samples run through actual engines. Filenames describe the intent, HTML uses width/height/alt/lazy/async, and adjacent captions distinguish actual archive previews. Social assets are tool cards, not claims about a visitor's private output. No external artwork was copied.

## Custom domain and Google Search Console

1. Optional: add an owned hostname under Cloudflare Pages → Custom domains and follow its DNS checks. The free pages.dev URL remains usable now.
2. Set production `SITE_URL` to the chosen canonical HTTPS hostname, rebuild, and verify its canonical and sitemap URLs. If migrating, arrange redirects from the old hostname rather than leaving two competing origins.
3. In Search Console add a URL-prefix property matching the live URL, or use a Domain property with its requested DNS record. A pages.dev subdomain can use a URL-prefix property.
4. For HTML-tag verification, copy only the issued token into production `GOOGLE_SITE_VERIFICATION` and redeploy. The build emits `google-site-verification`; no fake token is checked in. DNS verification does not need that token.
5. Complete Verify in Search Console and submit `sitemap.xml` (the index; its child sitemaps are read from it). Inspect one URL per locale and confirm the rendered canonical. Indexing is neither immediate nor guaranteed.

## Bing and IndexNow

Add the live site in Bing Webmaster Tools and complete its verification method; the normal sitemaps work independently of IndexNow.

IndexNow ownership keys are **public verification files by design**, not private API credentials. Generate a random 8–128 character alphanumeric/hyphen key, configure `INDEXNOW_KEY` in production build environment, build and deploy. The build writes `<key>.txt` containing the key. No IndexNow request or submission code is in the browser bundle.

**Automatic:** `.github/workflows/indexnow.yml` runs on every push to `main`: it builds this commit
and the commit that was live before the push (`github.event.before`), waits until the live site lists
every page of the new build with the new lastmod (the Cloudflare deploy has finished; up to 30 min),
then submits only the URLs that are new or whose lastmod changed. The key is `BRAND.indexNowKey` in
`src/brand.js` (or `INDEXNOW_KEY`); `/<key>.txt` is served. There is no Google submission API —
Google reads the sitemap index (robots.txt, Search Console).

By hand, with the same `SITE_URL`:

```sh
SITE_URL=https://nerulio.pages.dev/ node tools/build.mjs
node tools/indexnow.mjs                                   # dry run: every page URL
node tools/indexnow.mjs --since ../previous/dist          # dry run: new or changed only
node tools/indexnow.mjs --since ../previous/dist --wait-live --submit
```

`--submit` first checks that the public key file is live, then POSTs to api.indexnow.org. It rejects
foreign-host/path URLs, queries, preview builds and lists over 10,000 URLs. HTTP 200/202 is
submission acceptance, not indexing proof.

## Sources checked

- [Google image SEO](https://developers.google.com/search/docs/appearance/google-images)
- [Google image sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
- [Canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [IndexNow protocol](https://www.indexnow.org/documentation)

Search Console API integration, automatic submission schedules and a custom domain purchase are outside this code change.
