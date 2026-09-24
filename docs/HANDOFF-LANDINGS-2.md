# Handoff: many more game landings (branch `nerulio/game-landings-2`)

- **Branch:** `nerulio/game-landings-2`, from `origin/nerulio/game-home-design`, with `origin/main`
  merged in (Texture workspace, PR #34 home redesign + monetization). Port **4491** (full regression:
  4173/4174).
- **Owner request (2026-09-24):** "랜딩 개많이 추가" — broad searches such as "sprite editor", "tilemap
  editor", "스프라이트 에디터" had no page. Flow stays: search → landing (indexable) → drop a file → the
  Studio opens in the right workspace with the file imported.

## What is where

| What | File |
|---|---|
| Keyword research, evidence codes, page map, rejected intents | `docs/SEO-KEYWORDS.md` |
| Autocomplete collector (Google, Bing, Naver) | `tools/seo-keywords.py` (+ `tools/seo-keywords-round2.json`) |
| Family registry (Node-only loading) | `src/game-seo-families.js` |
| Pages per family | `src/game-seo-{broad,engines,formats,fixes,compare}.js` |
| Texture workspace as a Studio kind (`normalmap`, `?ws=texture`), its export labels | `src/game-seo.js` (`WORKSPACES.normalmap`, `TEXTURE_EXPORTS`, `STATUS.plain`) |
| Own table / head-to-head / "where X is better" sections, `via` handoff, family hub groups | `tools/game-landing-build.mjs` (`tableHTML`, `compareHTML`, `targetOf`, `groupOf`, `gameGroups`) |
| Anti-doorway gates | `tests/game-seo-quality.test.mjs` |
| New Studio screenshots (9) | `tools/studio-screens.py` (`FAMILY_SHOTS`), `assets/studio/*.webp` |

## Decisions

- **Family copy is loaded only in Node** (build, tests, social cards, screenshots): every file-tool
  page imports `src/game-seo.js` through `src/landings.js`, and the new copy (~1 MB) must not ride
  along. `GAME_FAMILY_PAGES` is `{}` in the browser; no browser code reads these pages (the landings are
  static HTML + `src/game-landing.js`). The older 64 pages' copy (~390 KB) is still in the browser graph —
  a follow-up could move it the same way.
- **Gates = the closest existing pair.** The overlap thresholds are the most similar pair among the
  64 pre-existing pages (texture-map ↔ game/pixel-art-normal-map), so no new page is closer to any
  page than that. Minimum own copy: en 1500, ko/ja 800 characters (existing pages: en median 1088).
- **Texture kind is `normalmap`** because `texture` is already the Texture Lab's kind.
- **Pages that would compete with an existing page were not made** (see SEO-KEYWORDS.md §6).

## Status (2026-09-24)

- **39 new pages × ko/en/ja = 117 URLs**, all indexable (base intents qualify): broad 6, engines 6,
  formats 12, fixes 9, compare 6. Game pages: 64 → 103 (sitemap-game.xml 196 → 313 URLs).
- Quality gates (`node --test tests/game-seo-quality.test.mjs` prints them): own copy en min 2496 /
  median 3220, ko 1433 / 1800, ja 1289 / 1686 characters; closest pair to any game page Jaccard ≤ 0.219,
  containment ≤ 0.513 (thresholds 0.30/0.35/0.31 and 0.46/0.55/0.49).
- 9 new real Studio screenshots (family shots) + recaptured Studio landing shots and home hero/pack/tile
  captures (Texture was shown as "coming" before). 117 new social cards.
- Existing pages link to the new ones (30 pages got 1–2 more related links; each stays at 4–6).
- Home: one row under the game-tool index links the hub's family groups.
- PixiJS @2x verified (`tools/engine-verify/pixi_scale.py`, results in `tools/engine-verify/results/`).
- Browser checks: `tests/game-landing-browser.py` part 3 hands a file to every Studio family page;
  part 6 follows a sample page of every family into the Studio in Chromium and Firefox and measures it.

Writers were sub-agents working from `briefs/COMMON.md` + `briefs/FAMILIES.md` (session scratchpad); the
facts they were allowed to use are the numbers in docs/STUDIO-*.md. Claims they softened or left out are
listed in the final report.

## Verification (after merging origin/main with PR #35, 2026-09-24)

| Check | Result |
|---|---|
| `npm test` | 2176 pass / 0 fail / 1 skip (incl. `tests/game-seo-quality.test.mjs`) |
| `npm run check` | OK |
| `NERULIO_CORPUS='C:\nope' python tools/regression.py` | PASSED: browser 51, recipes 46, growth 22, seo 526, landings 32, task 318, studio 103, studio-sprite 95, studio-pack 61, studio-tile 45, studio-texture 41, studio-monetization 79, game-landing 207 check runs / 119 distinct (Chromium + Firefox, 0 page errors), design 347 (forced wide font at 390 px: 313 game pages + home + hub, no overflow) |
| `tests/game-landing-browser.py` standalone, dist build | parts 1–6 PASS: 5110 Chromium and 88 Firefox check runs |
| `python tests/service-browser.py` | 119/119 |
| `python tools/validate-sitemaps.py dist` | ALL PASS, 454 page URLs (sitemap-game.xml 313) |

The first regression run had one failure in `studio-texture-browser.py` ("a detection still running for
the previous picture does not land on this one") — a timing check in the Texture workspace, not touched
here; it passed 2/2 standalone and in the next full run.

## Open / next

- Retarget the old Texture Lab landings `normal-map-generator` and `game/pixel-art-normal-map` to the
  Studio's Texture workspace (their Lab evidence in part 4 would need a Studio counterpart).
- `src/game-seo-more.js` `game/phaser-texture-atlas` still says Phaser draws rotated frames "mirrored";
  a later run measured "sideways and clipped" — the new pages say "drawn wrongly, not turned back".
- The older 64 pages' copy is still in the browser module graph (~390 KB); it could move to Node-only
  loading like the families.
- Demand we could not serve yet (docs/SEO-KEYWORDS.md §6): pixel art editor, video → sprite sheet,
  VRChat sheets, CJK bitmap fonts (UI Lab bugs), Unity tile collision.
