# Handoff: game-first SEO (branch `nerulio/game-seo-landings`)

- **Branch:** `nerulio/game-seo-landings` (pushed). The head commit is the one that adds this file (`git log -1`).
- **Worktree used:** `C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-a5b88297be1a16e1a`.
- **Base:** `origin/main` as of 2026-09-24. PR #29 (tile + pack), #30 (game home) and #31 (sprite custom grid) are merged in.
- **Rules:** follow `scratchpad/STUDIO-AGENT-RULES.md`, including the P1+ addendum and the no-corpus CI note. Port **4491**.

## 1. Goal and scope

The owner decided (2026-09-23) that the site becomes a game editor first. The image, PDF and video tools stay online but are secondary. SEO must target game-dev search demand; the research is in `scratchpad/competitors/PAIN-POINTS.md`, `SPRITE-PIXEL.md` and `TILE-TEXTURE-UI.md`.

The original brief:

1. Game routes the Studio covers become indexable landing pages that open the Studio:
   - keyword H1, title and description in ko/en/ja;
   - a drop zone that hands the files to the Studio (handoff);
   - a real Studio screenshot;
   - engine badges carrying the honest verification labels;
   - how-to, limits, FAQ and related tools.
2. New keyword landing pages, only for things that really work today.
3. `src/capabilities.js`: `mayPromote()` is true exactly where the evidence justifies it.
4. Structured data, sitemap, social cards and hreflang.
5. Tests.

The coordinator then expanded the scope:

- **Sitemap architecture.** A sitemap index (`sitemap.xml` pointing to `sitemap-game.xml`, `sitemap-guides.xml`, `sitemap-tools.xml` and `sitemap-images.xml`). Every URL gets its hreflang alternates and a real `<lastmod>`. Validate against the XSD and Google's limits. `robots.txt` lists the index.
- **Pixel, Texture and UI Labs** become indexable once they pass the browser suite in Chromium **and** Firefox. Their primary action points at the Lab for now, with a landing design that can switch to the Studio later.
- **60+ distinct, non-thin landings** in ko/en/ja with language-native phrasing.
- **Structured data:** SoftwareApplication (with an offer at price 0 and a featureList), BreadcrumbList, FAQPage where a FAQ is visible, and HowTo where steps are visible. Validate with tests.
- **Internal linking:**
  - the `/game/` hub groups every page by workflow;
  - each page links to 4–6 related pages plus its guide;
  - file-tool pages get a "Game studio" cross-link;
  - the footer carries game links.
- **IndexNow:** submit changed URLs after a production deploy (wire it into CI, or document the command). Do not fake a Google submission.
- **Guides registry:** read `src/guides.js` from branch `nerulio/game-guides` if it exists, otherwise use an empty list.

## 2. Done (committed and pushed)

### Studio landings

11 existing game routes are now dark landing pages that open `/game/studio/?ws=…`:
- `sprite-slicer`
- `game/sprite-lab`
- `normalize-sprite-frames`
- `game/sprite-animation-preview`
- `game/sprite-pivot-editor`
- `game/hitbox-editor`
- `game/collision-polygon-generator`
- `sprite-sheet-maker`
- `game/tile-lab`
- `game/autotile-tester`
- `game/tileset-slicer`

Where the files live:

| What | File |
|---|---|
| Copy and data | `src/game-seo.js` (`GAME_INTENT_PAGES`) |
| Builder | `tools/game-landing-build.mjs` |
| `<head>`: robots, canonical and hreflang, SoftwareApplication and BreadcrumbList JSON-LD, social tags | `tools/game-seo-build.mjs` |
| Client (drop, handoff, language switch, legacy forwarding) | `src/game-landing.js` |
| Styles (dark, uses the game-home palette) | `src/game-landing.css` |

How the landings behave:
- The old Lab UI lives at `<route>/classic/`. It is noindex through a `data-classic-robots` meta, which `updateSEO` does not remove. It is linked only where the Studio lacks something.
- Old Lab links carrying query settings (`?stage=…`) are forwarded to it.

### Pack pages and Firefox handoff

- **Pack pages** import through the Sprite workspace, then open Pack & Export. This uses `handoff.meta.workspace`, with a small hook in `src/studio/app.js` `start()`.
- **Handoff fix** (`src/task/handoff.js`): files are copied out of IndexedDB before the record is deleted. Without this, Firefox failed with "The operation was aborted" on later reads, so files handed off to Pack were never packed.

### Keyword landings

31 keyword landings under `game/…`. They are `src/landings.js` entries that carry a `studio` block:
- 15 are in `src/game-seo.js`;
- 16 are in `src/game-seo-more.js`: Phaser atlas, Pixi JSON, Defold, LÖVE, Spine, GameMaker strip (UNVERIFIED), Sparrow XML, CSS sprites, remove background, sheet to PNG frames, Lospec palette, fix AI pixel art, pixel art upscaler, pixel-art normal map, roughness to smoothness, LDtk rules (partly verified).

### Lab landings (in progress, see 3.1)

21 Lab landings are wired, with copy in `src/game-seo-labs.js` (`GAME_LAB_PAGES`, `LAB_KINDS`):
- Pixel: pixel-lab, palette-extractor, palette-swap-ramp, pixel-art-cleanup, pixel-perfect-checker.
- Texture: texture-lab, channel-unpacker, normal-map-converter, pbr-texture-validator, texture-edge-bleed, texture-map, mask-packer.
- UI: ui-lab, 9-slice-editor, button-state-generator, missing-glyph-checker, ui-scale-preview, bitmap-font.
- Tile Lab: seamless-tile-checker, tile-helper, atlas-padding.

How they work:
- The Lab itself moved to `<route>/app/` (aliases in `src/intents.js`).
- Their drop zone hands the files to that Lab through `stashFiles` → `takeFiles` in `src/task/shell.js`.
- **They are still noindex**: `mayPromote()` is false because no Lab evidence has been added to capabilities yet. atlas-padding is the exception; it was already promoted on its old Chromium+Firefox evidence.

### The hub and page totals

- **Hub:** `/game/` (`gameHubPage`). Pages are grouped by workflow: sprite, pack, tile, pixel, texture, ui, tilelab, spritelab.
- **Totals:** 11 + 21 + 31 + hub = **64 game pages** × ko/en/ja. 11 + 1 + the Studio-kind keyword pages are indexable today.

### Capabilities

`src/capabilities.js` `STUDIO_EVIDENCE`: each Studio intent qualifies on two checks from `tests/game-landing-browser.py`, which pass in **Chromium and Firefox**:
- a workflow check and a quality check (landing → Studio → a measured result on committed CC0 fixtures);
- plus the `engine`-kind entries from the real engine runs (Chromium only; these do not count toward the Firefox requirement).

`tests/game-seo.test.mjs` asserts that every cited check name exists verbatim in the suite.

### Home page JSON-LD

`src/seo.js` `homeStructuredData()`: SoftwareApplication, `DeveloperApplication`, free offer (the coordinator asked for this).

### Sitemaps

`tools/build.mjs` `sitemap()` lists home first, then game pages, then file tools. It is **not an index yet** and has **no lastmod** (see 3.2).

`tools/growth-build.mjs` `imageSitemap()` lists game pages with their Studio screenshot first.

### Screenshots and social cards

- **Screenshots:** `tools/studio-screens.py`, which needs `TEST_URL`. It writes `assets/studio/{sprite-sheet,sprite-frame,pack,tile-check,tile-map}{,-780}.webp`.
- **Social cards:** `python tools/generate-social.py --game --force` writes the dark cards to `assets/social/<locale>-<stem>.png`. Cards exist for the first 27 game pages (11 intents, 15 keywords, hub). **They are not yet generated for the Lab pages or the 16 new keyword pages**; the generator also needs `GAME_LAB_PAGES` added (see 3.3).

### Guides hook

`tools/guides-registry.mjs` dynamically imports `src/guides.js`; if it is absent it returns empty lists. Landings link matching guides; the hub does not list them yet.

### Tests

| File | What |
|---|---|
| `tests/game-landing-browser.py` | 4 parts, env `PARTS` and `BROWSERS`. Part 1: the pages (Chromium). Part 2: Studio flows (Chromium + Firefox). Part 3: keyword → workspace. Part 4: Lab flows (Chromium + Firefox, see 3.1) |
| `tests/game-seo.test.mjs` | New unit tests |
| `tests/landings-browser.py`, `tests/seo-browser.py` | Game cases added |
| `task-browser.py`, `recipes-browser.py`, `studio-browser.py`, `tools/engine-verify/baseline.py` | Old-Lab URLs changed to `…/classic/` |
| `tools/regression.py` | Now runs `game-landing-browser` |

### Fixtures

`tests/fixtures/game-seo/`: Kenney UI Pack and ambientCG Bricks076C / Ground054, CC0, with `SOURCES.md`.

### Docs

`docs/SEO.md`, section "Game pages".

### Last full verification (before the Lab and keyword expansion)

| Check | Result |
|---|---|
| `npm test` | 1800 pass |
| `tools/regression.py` | all suites up to studio-sprite; one flaky studio-sprite Enter-play check passed on rerun (82/82) |
| studio-pack / studio-tile / game-landing | 63 / 45 / 80 |
| With `NERULIO_CORPUS='C:\nope'`: studio / studio-sprite / studio-pack / studio-tile | 103 / 82 / 61 / 45 |

`tests/service-browser.py` **has not been run** on this branch yet.

## 3. In progress

### 3.1 Part 4 of `tests/game-landing-browser.py` (Lab flows)

- **Chromium:** passes, 44/44.
- **Firefox:** stops at `button-state-generator`.
  - The UI Lab goes through a canvas, and Firefox rounds semi-transparent RGB by ±1. Verified: the Kenney panel and button at alpha 159/207 give (22,…) against (21,…).
  - A helper `near()` was added: alpha and opaque pixels must match exactly, semi-transparent RGB may differ by ±1.
  - The button check still fails. Its detail message was temporarily widened to print the differing pixels. The first 6 diffs shown are all within `near`'s rule, so look for another pixel, e.g. alpha 0 with different RGB. `near()` does not ignore RGB when alpha = 0, and a canvas zeroes it.
  - **Likely fix:** in `near()`, treat alpha-0 pixels as equal whatever their RGB. Then rerun `BROWSERS=firefox PARTS=4`.
  - The checks after button-state-generator have not run in Firefox yet: ui-lab, ui-scale-preview, bitmap-font, missing-glyph, seamless, tile-helper, atlas-padding.
- **When part 4 passes in both browsers:**
  1. Add `LAB_EVIDENCE` to `src/capabilities.js`, mirroring `STUDIO_EVIDENCE`: a workflow check and a quality check per Lab intent, names copied verbatim from part 4.
  2. Extend `tests/game-seo.test.mjs` so it checks the Lab intents the same way. Its current assertion that pixel-lab, texture-lab and ui-lab are **not** promotable must change.
  3. If a Lab cannot pass in Firefox, it stays noindex. Say so.
- **Honest copy to fix:** the UI Lab and 9-slice copy in `src/game-seo-labs.js` says "byte-identical". Qualify it: exact in Chromium; in Firefox, semi-transparent colour may differ by one level.

### 3.2 Not started from the expanded brief

1. **Sitemap index with real lastmod.**
   - CI checkout (`actions/checkout@v4`) is shallow, and Cloudflare Pages history is unknown, so per-page git dates are unreliable.
   - Planned design: a committed ledger, e.g. `src/lastmod.json` = {route: [contentHash, date]}. The hash covers `<title>`, the description and the main content of each rendered page.
     - Hash matches the ledger → use the ledger date.
     - Hash differs → use the HEAD commit date (`git log -1 --format=%cI` works in a shallow clone), or the build date if there is no git.
     - A `tools/lastmod.mjs --write` command refreshes the ledger.
     - Document this honestly.
   - Guides: use `guideLastmod(route)` from the guides registry.
   - Files: split into `sitemap-game.xml`, `sitemap-guides.xml` and `sitemap-tools.xml`; add `sitemap-images.xml` to the index; list only the index in `robots.txt`.
   - Update:
     - `tests/deployment.test.mjs` (it counts the `<url>` entries of `sitemap.xml`);
     - `tests/growth.test.mjs`;
     - `tests/game-seo.test.mjs`, the sitemap order test;
     - `tools/indexnow.mjs`, which reads `dist/sitemap.xml` and must now follow the index.
   - Validate against `sitemaps.org` XSD rules (≤50k URLs, ≤50 MB, W3C datetime) in a unit test.
2. **FAQPage and HowTo JSON-LD** in `tools/game-seo-build.mjs`:
   - `gameFaq(game, locale)` in `tools/game-landing-build.mjs` already returns exactly the visible Q/A pairs; `copy.steps` holds the visible steps.
   - Add a unit test that the JSON-LD text equals the visible text, plus required-property checks.
3. **Internal links.**
   - A "Game studio" cross-link on file-tool pages (`src/content.js` `toolContent`) and in the footer. The coordinator owns `guides.home`; avoid those lines.
   - A guides list on the hub.
4. **IndexNow workflow.**
   - A GitHub Actions workflow on push to main:
     1. build with `SITE_URL=https://nerulio.pages.dev/`;
     2. fetch the live sitemaps before the deploy;
     3. poll until the live sitemap equals the new build (deployed);
     4. `node tools/indexnow.mjs --submit` with only the URLs whose content or lastmod changed. Needs a small `--urls` or diff option.
   - The key file `/aeb52199b8b46fbc510766f496462876.txt` is served (200, checked 2026-09-24).
   - No Google submission API.
5. **Screenshots.**
   - Add six shots to `tools/studio-screens.py`, all driven from committed fixtures: `pixel-lab` (ninja frames), `texture-lab` (bricks maps), `ui-lab` (Kenney panel in 9-slice), `tile-seams` (ground054), `tile-slice` (Kenney tiny dungeon in Tile Lab), `sprite-lab` (samurai in the classic Sprite Lab).
   - Until these exist, the Lab pages and 6 keyword pages point at missing WebP files. Part 1's "screenshot decodes" check would fail for them, which is why they must exist before promotion.
6. **Social cards** for the Lab pages and the 16 new keyword pages: extend `game_pages()` in `tools/generate-social.py` with `GAME_LAB_PAGES`, and use `LAB_KINDS` export rows for the chips.
7. **Screenshots at 1440 and 390** of the Lab and new keyword pages, into `scratchpad/p0/nerulio-game-seo-landings/`; look at them and fix the layout.
8. **Full run:** `npm test`, `tools/regression.py`, `tests/service-browser.py`, and the studio suites with `NERULIO_CORPUS='C:\nope'`. Then the final report per the rules file.

## 4. How to run

```
node tools/serve.mjs                        # dev (entry() rendered live; restart after route changes). PORT=4491
SITE_URL=https://fileforge.example.test/ node tools/build.mjs && PORT=4491 node tools/serve.mjs --dist   # canonical/hreflang present
TEST_URL=http://127.0.0.1:4491 BROWSERS=chromium,firefox PARTS=1234 PYTHONWARNINGS=ignore python tests/game-landing-browser.py
npm test
python tools/regression.py                  # uses fixed ports 4173/4174 — check they are free first
NERULIO_CORPUS='C:\nope' TEST_URL=… python tests/studio-*-browser.py
TEST_URL=… python tools/studio-screens.py   # regenerate assets/studio/*.webp
python tools/generate-social.py --game --force
```

- Part 1 of the game-landing suite checks canonical and hreflang only when the build has a `SITE_URL`: use the `--dist` build, or `regression.py`, which sets it.
- Git Bash rewrites `/en/...` arguments into paths; use `MSYS_NO_PATHCONV=1`.

## 5. Verification status and UNVERIFIED items

- **Engine labels** follow `docs/STUDIO-PACK.md` and `docs/STUDIO-TILE.md`:
  - GameMaker is UNVERIFIED.
  - Defold is "built" (bob.jar).
  - GIF/APNG/WebM are "decoded".
  - LDtk is partly verified (the app was not opened).
  - Tiled: the terrain brush was not driven.
  - Spine: libGDX itself was not run.
  - Unity: corner and dual-grid tile sets are not exported.
- **Lab outputs:** no Lab output was imported into any engine; the Lab pages say so.
- **Unconfirmed copy claims** in `src/game-seo-more.js`, written by a sub-agent:
  - The key-colour page: the tolerance wording was fixed to match `src/game/color-key.js`.
  - The Sprite Lab `frames.zip` exactness has no row in `docs/SPRITE-LAB.md`. Add a check in part 4 or soften the copy.

## 6. Known bugs and risks

- **UI Lab in Firefox:** semi-transparent RGB drifts by ±1 because of canvas premultiplication. This is a real product difference: the UI Lab is not byte-exact in Firefox.
- **Flaky check:** `tests/studio-sprite-browser.py` "Enter plays" failed once inside `regression.py` and passed on rerun.
- **Landing pages have no ad slots** (decided: game pages look like tools).
- **Language negotiation:** the language-neutral URL of a landing redirects with JavaScript to ko/ja when the browser prefers them. The x-default page is English.

## 7. Merge-conflict hotspots

| File | Risk |
|---|---|
| `tools/build.mjs` | `entry()` routing. `nerulio/game-guides` also adds a `guideEntry` line right after the studio route, and `ALL_ROUTES` pushes. Both are small; keep both |
| `src/content.js` | The coordinator owns `guides.home`, formats and related-for-home |
| `tools/task-build.mjs` homePage/header, `src/task/home.js`, `src/task/strings.js` home/gh | Not touched by this branch |
| `tools/generate-social.py` | The guides branch also extends it (77 lines); merge by hand |
| `src/studio/app.js` `start()` | One hook added after the handoff import |
| `src/task/handoff.js` | `takeHandoff` rewritten (Firefox fix) |
| `src/intents.js` ALIASES | classic/app aliases added |
| Tests that count sitemap URLs | `deployment.test.mjs`, `growth.test.mjs` |

## 8. Decisions and why

- **Landings replace the tool at the same URL** (to keep link equity). The old tool moves to `/classic/` (Studio-covered) or `/app/` (Labs). Both are noindex, with the canonical pointing at the landing.
- **Evidence stays strict.** Promotion still requires workflow and quality checks in Chromium **and** Firefox (`ADVANCED_CRITERIA` unchanged). Studio flows were run in Firefox for real; `engine`-kind evidence is recorded as Chromium-only.
- **Keyword pages stay separate** only where the search intent differs. Same-intent queries share one page (e.g. no separate "png to sprite sheet" page).
- **Pack pages open Sprite first**, so numbered frames become one tagged animation before packing.
- **Screenshots and cards come from committed CC0 fixtures** (samurai, ninja, cave-47, Kenney, ambientCG) for reproducibility.
