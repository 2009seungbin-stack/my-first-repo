# Handoff: game home and landing design (branch `nerulio/game-home-design`)

- **Branch:** `nerulio/game-home-design`, based on `nerulio/game-seo-landings` (merged in again at ba1bcee). Port **4541**.
- **Why:** the owner found the home cluttered and not like a game editor's front door, while the Studio looked right. This branch gives the home, the `/game/` hub and every game landing the Studio's dark language and a product-first structure.
- **Ownership:** this branch owns layout, markup structure, CSS and visuals of the home, the hub and the landing template. `nerulio/game-seo-landings` owns copy, meta, JSON-LD, sitemaps and link data.

## What is where

| What | File |
|---|---|
| Design system: tokens, type (CJK-aware stacks), header, buttons, section heads, status dots, FAQ, ad slots, footer grid | `src/game-site.css` (scoped by `body[data-gs]`) |
| Home styles | `src/game-home.css` |
| Landing + hub styles | `src/game-landing.css` |
| Shared header and footer brand column | `tools/game-chrome.mjs` (`siteHeader`, `footerBrand`) |
| Home markup | `tools/task-build.mjs` `homePage()` (own shell: loads only game-site.css + game-home.css, not the file-tool CSS) |
| Landing + hub markup | `tools/game-landing-build.mjs` (`gameLandingPage`, `gameHubPage`, `shell`, `shot`, `badges`, `dropZone`, `toc`) |
| Home UI strings (new: `gh.nav*`, `gh.dropOr`, `gh.dragTitle`, `gh.shotCaption`, `gh.flow.*`, `gh.status.*`, `gh.toolsLead`, `gh.footerLine`) | `src/task/strings.js` |
| Home relabel on language switch (shots swap per language) | `src/task/home.js` |
| Product shots | `assets/home/shot-{hero,hero-crop,pack,tile}-{ko,en,ja}-*.webp`, `assets/home/lab-*.webp` — made by `tools/home-screens.py` from the real Studio |
| CC0 art for the hero project and the live demo | `assets/home/art/` (+ `LICENSE.md`) |
| Ad positions | markers in `#siteContent` (home) and `[data-ad-host]` (landings, hub); `src/ads.js` finds both; `tools/build.mjs` adds `adHead` to game pages. Details: `docs/ADS.md` |
| Tests | `tests/design-browser.py` (new, in `tools/regression.py`), `tests/seo-browser.py` ads-mode checks for game pages |

## Page structure

**Home:** header (Workflow · Engines · Game tools · File tools · language · Studio) → hero (kicker, H1, lead, "Open the Studio" + "Choose files", drop-anywhere hint, a large 2× capture of the real Studio: Classic Hero cut into 5 tagged animations with pivot, hurt and hit box and the preview window; a phone crop below 700 px) → workflow (Sprite: a CSS-only live demo, the sheet cut into tagged rows with the walk row played at 10 fps; Pack & Export and Tile: real Studio captures; Pixel/Texture/UI: Lab cards) → "Exports tested in the real engines" (12 engines with the Studio's own labels, merged from `SPRITE_EXPORTS`/`TILE_EXPORTS`, weakest label wins) → single game tools as a compact index grouped by workspace, search on top, file tools folded → the SEO reading content (`#siteContent`, how-to, formats, FAQ, related) → footer (brand column + game links + about). Dropping files anywhere shows a full-page overlay.

**Landing:** header (Game tools · Guides when present · All tools · language · Studio) → centred hero (crumb, keyword H1, lead, the drop zone as the one action, the page's real screenshot large below) → "Exports to" strip → reading part with a sticky "On this page" rail (desktop) and the sections (what, how, ad 1, exports table + evidence, limits, classic, FAQ, ad 2, related) → footer. **Hub:** same frame; the rail lists the workflow groups.

## Decisions

- **Real product, big.** The hero is a 2× capture shown at ~0.94 of its CSS size, so the UI is readable; on phones a crop of the canvas. The one live element is CSS-only (no JS, no video, 2.4 KB PNG) and stops under `prefers-reduced-motion`.
- **Honest proof.** Engine tiles use the exact verification words from `src/game-seo.js`; nothing new is claimed. GameMaker shows UNVERIFIED, LDtk "Partly verified", Defold "Built".
- **No engine logos.** Trademark/licence terms differ per engine (Unity's forbid most uses); typographic tiles instead.
- **Fonts.** No web fonts (the site makes no external requests). Stacks name Segoe UI / SF first, then the page language's CJK face, then `system-ui`: `system-ui` first makes Korean Windows draw Japanese kana with Malgun Gothic (wide, wrong). `Segoe UI Variable` was dropped: it doubled layout time (≈800 → ≈400 ms at 4× CPU on a landing).
- **Long unbreakable runs** (keep-all Korean, "hover·pressed·disabled·focus") break anywhere only when nothing else fits (`src/game-site.css`), checked at 390 px with a forced wide font on all 196 game pages.
- **lastmod stays honest:** the design-only chrome (TOC, the strip label) is `data-chrome`, the badge text keeps its old words, so only the home and hub (whose content really changed) got new dates.
- **Structure the suites read is kept:** `<h1>…</h1>`, `<ol class="gl-steps"><li>`, `<details><summary>…</summary><p>…</p></details>`, `id="how"`, `data-gl-drop`, `#glFiles`, one `data-studio-link` per game page, `<img src="assets/studio/…webp" width="1440" height="900" alt=…>`, `class="gl-badge`, home `.directory section` ×4, `.tool-card` with `b`/`small`, `#toolQuery`, `class="task-page home-page game-home"`, `<html lang="xx">`, `<p class="page-lead" id="taskLead">`.

## How to run

```
PORT=4541 node tools/serve.mjs                                  # dev
SITE_URL=https://nerulio.pages.dev/ node tools/build.mjs && PORT=4541 node tools/serve.mjs --dist
TEST_URL=http://127.0.0.1:4541 python tests/design-browser.py   # 347 checks
TEST_URL=http://127.0.0.1:4541 python tools/home-screens.py     # recapture the home shots (all languages)
python tests/seo-browser.py                                     # own ports 4270–4273, includes the ads-mode game-page checks
node tools/lastmod.mjs --write                                  # after changing visible page content
```

Do not edit UTF-8 files with PowerShell `Get-Content`/`Set-Content` (it rewrote `→` and `·` as mojibake once); use Python or the editor.

## Status (2026-09-24)

Done: home, hub and landing redesign in ko/en/ja; shots; ads positions + tests; design suite; perf pass.

Verified at e386f8a's parent (1fc7eed, same code): `npm test` 1964 pass / 0 fail / 1 skip; `npm run check` OK;
`NERULIO_CORPUS='C:\nope' python tools/regression.py` all 12 browser suites PASS (browser 52, recipes 47, growth 23,
seo 527, landings 32, task 318, studio 103, studio-sprite 95, studio-pack 61, studio-tile 45, game-landing 3261,
design 347); `python tests/service-browser.py` 50/50; Firefox smoke (home, landing, hub at 390/1440): no overflow,
no errors. Performance (dist build, slow 4G + 4× CPU, median of 5): home LCP 2.40 s → 1.22 s; landing 0.84 s → 1.04 s;
hub 0.82 s → 1.00 s; CLS 0 everywhere (data: `scratch/design/lcp5-*.json`, `perf-*.json`). Screenshots: `C:\Users\2009s\nerulio-handoff\scratch\design\{before,after,ads,reference}`.

Next (not done):
- Lab cards and Lab landings still show the light Lab UI (real pages); recapture when the Pixel/Texture/UI workspaces land in the Studio (`tools/home-screens.py` + `tools/studio-screens.py`).
- The Studio itself renders Japanese with Malgun Gothic on Korean Windows (its stack starts with `system-ui`, `src/studio/studio.css`) — visible in the ja hero shot. Studio agents' area.
- Side-rail ad position (`sidebar-1`) is only proposed (docs/ADS.md).
