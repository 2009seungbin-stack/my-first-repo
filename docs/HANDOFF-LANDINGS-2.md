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

## Status

In progress — see the final report / the commit log.
