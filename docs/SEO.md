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
- **Hub** — `/game/`, the breadcrumb parent ("Game studio") of every game page.

Indexing is decided by `src/capabilities.js` as for every tool: the Studio intents qualify on
`tests/game-landing-browser.py` checks (landing → Studio → measured result on committed CC0 fixtures)
that pass in Chromium **and** Firefox, and cite the real-engine runs (`docs/STUDIO-PACK.md`,
`docs/STUDIO-SPRITE.md`, `docs/STUDIO-TILE.md`). Pixel, Texture and UI Lab routes and `tile-helper`
are not in the Studio and stay noindex. Game pages carry `SoftwareApplication` JSON-LD
(`DeveloperApplication`, operating system Web, a free offer, a feature list built from the shipped
features and export verification labels) and a BreadcrumbList Nerulio › Game studio › page; the
home page carries the same type as the game asset studio. Game pages have no ad slots.

Assets: `python tools/studio-screens.py` (needs a running server, `TEST_URL`) regenerates the
screenshots in `assets/studio/` (1440×900 + 780 px WebP); `python tools/generate-social.py --game
--force` regenerates the dark social cards (`assets/social/<locale>-<intent id | game-<slug> | game>.png`).

## Sitemaps, images and robots

The page sitemap lists the home page, then every indexable game page (hub, Studio landings, other
qualified game tools, keyword landings), then the file tools and policies. The image sitemap lists
the game pages with their Studio screenshot first.

- `/sitemap.xml`: canonical localized intent and policy pages, including reciprocal alternate links.
- `/sitemap-images.xml`: pages with real before/after assets and their image locations.
- `/robots.txt`: allows public crawling and advertises both sitemaps.

The page/image serializers are separate so a sitemap index can replace the root when scale warrants it. There is no index needed for the current URL count. Do not add aliases, query combinations or nonexistent features. Tests compare generated routes, sitemap entries, reciprocal links, image files and decoded dimensions.

Tests, debug files, transfer archives, source-control metadata and build tooling are not copied into the public output. There are no temporary file-state URLs. Unknown URLs return the static `404.html` with an actual 404 response in the local host/Cloudflare Pages. The 404 has search and popular-tool links; there is no SPA fallback to home. Preview builds use robots disallow plus HTML and response-header noindex; their sitemaps are empty and ads/verification keys are disabled. Robots is not access control.

Example PNGs are original geometric samples run through actual engines. Filenames describe the intent, HTML uses width/height/alt/lazy/async, and adjacent captions distinguish actual archive previews. Social assets are tool cards, not claims about a visitor's private output. No external artwork was copied.

## Custom domain and Google Search Console

1. Optional: add an owned hostname under Cloudflare Pages → Custom domains and follow its DNS checks. The free pages.dev URL remains usable now.
2. Set production `SITE_URL` to the chosen canonical HTTPS hostname, rebuild, and verify its canonical and sitemap URLs. If migrating, arrange redirects from the old hostname rather than leaving two competing origins.
3. In Search Console add a URL-prefix property matching the live URL, or use a Domain property with its requested DNS record. A pages.dev subdomain can use a URL-prefix property.
4. For HTML-tag verification, copy only the issued token into production `GOOGLE_SITE_VERIFICATION` and redeploy. The build emits `google-site-verification`; no fake token is checked in. DNS verification does not need that token.
5. Complete Verify in Search Console and submit `sitemap.xml` and `sitemap-images.xml`. Inspect one URL per locale and confirm the rendered canonical. Indexing is neither immediate nor guaranteed.

## Bing and IndexNow

Add the live site in Bing Webmaster Tools and complete its verification method; the normal sitemaps work independently of IndexNow.

IndexNow ownership keys are **public verification files by design**, not private API credentials. Generate a random 8–128 character alphanumeric/hyphen key, configure `INDEXNOW_KEY` in production build environment, build and deploy. The build writes `<key>.txt` containing the key. No IndexNow request or submission code is in the browser bundle.

From a trusted deployment job or local environment with the same `SITE_URL` and `INDEXNOW_KEY`, run:

```sh
node tools/indexnow.mjs
node tools/indexnow.mjs --submit
```

The first command validates the canonical sitemap and reports a dry run. `--submit` first checks that the public key file is already live, then POSTs to the official IndexNow endpoint. It rejects foreign-host/path URLs, queries, preview builds and lists over 10,000 URLs. Small releases can submit the canonical sitemap; large sites should supply a deployment diff/chunking adapter. HTTP 200/202 is submission acceptance, not indexing proof. Do not embed any private CI/API credential in public config. No submission has been made by default.

## Sources checked

- [Google image SEO](https://developers.google.com/search/docs/appearance/google-images)
- [Google image sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
- [Canonical URL guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [IndexNow protocol](https://www.indexnow.org/documentation)

Search Console API integration, automatic submission schedules and a custom domain purchase are outside this code change.
