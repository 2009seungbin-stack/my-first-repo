# Handoff: landings for the Pixel workspace (branch `nerulio/pixel-landings`)

- **Branch:** `nerulio/pixel-landings`, from `origin/main` after PR #37 (Pixel workspace shipped).
  Dev port **4492** (full regression: 4173/4174; service browser test: 4493).
- **Why:** the Pixel workspace (`/game/studio/?ws=pixel`) is live, but the SEO copy still said it
  was "coming", and the "pixel art editor / 도트 에디터 / ドット絵 エディタ" demand had no page
  (docs/SEO-KEYWORDS.md §6 before this branch).
- **Source of every claim:** docs/STUDIO-PIXEL.md (§3 features, §5 cleanup benchmark on 69 CC0
  cases, §6 head-to-head with Aseprite 1.3.18, §7 performance) and docs/pixel-bench/H2H.md.
  Where another tool is better, the page says so.

## What is where

| What | File |
|---|---|
| Studio kind `pixelart` (`studioWs:'pixel'`), its accept list, drop text and limits | `src/game-seo.js` `WORKSPACES.pixelart` (`pixel` is the Pixel Lab's kind) |
| Outputs and their labels (.aseprite verified in Aseprite 1.3.18, palette files measured, engine files via Pack & Export verified, PNG/.nerulio plain) | `src/game-seo.js` `PIXEL_EXPORTS`; `exportsFor` in `tools/game-landing-build.mjs`, rows in `tools/generate-social.py` |
| Evidence paragraph (benchmark, T9/T10, T8, T11) | `tools/game-landing-build.mjs` `EVIDENCE.pixelart` |
| Hub group "Pixel art editor and cleanup" (after Normal maps) | `HUB_GROUPS.pixelart`, `GROUP_ORDER` |
| The six new pages | `src/game-seo-pixel.js` (registered in `src/game-seo-families.js`, Node-only loading) |
| Screenshots (6) | `tools/studio-screens.py` `PIXEL_SHOTS` → `assets/studio/pixel-{edit,anim,palette,cleanup,generated,outline}.webp` (+ `-780`) |
| Home Pixel row | `tools/task-build.mjs` (row `pixel`), strings `gh.flow.pixel/openPixel/pixelCaption` in `src/task/strings.js`, captures `tools/home-screens.py --only pixel` → `assets/home/shot-pixel-*` |
| Browser evidence | `tests/game-landing-browser.py` part 6 `pixel_family()` (Chromium + Firefox), parts 1 and 3 know `?ws=pixel` |

## Pages

New (all family pages, indexable — their base intents qualify under `mayPromote`):

| Path | Family | Opens | Main queries |
|---|---|---|---|
| `game/pixel-art-editor` | broad | `?ws=pixel` | pixel art editor online · 도트 에디터 · ドット絵 エディタ ブラウザ |
| `game/pixel-art-animation` | broad | `?ws=sprite` → `pixel` (`via`) | pixel art animation maker · 도트 애니메이션 만들기 · ドット絵 アニメーション 作成 |
| `game/pixel-art-palette-editor` | broad | `?ws=pixel` | pixel art palette editor · 도트 팔레트 · ドット絵 パレット / 減色 |
| `game/pixel-art-outline` | broad | `?ws=pixel` | pixel art outline generator · 도트 외곽선 · ドット絵 縁取り |
| `game/pixel-art-downscaler` | fixes | `?ws=pixel` | downscale pixel art, pixel art downscaler · ドット絵 縮小 |
| `game/pixel-snapper-alternative` | compare | `?ws=pixel` | pixel snapper, unfake pixel art (vs Pixel Snapper, unfake.js, perfectPixel) |

6 pages × ko/en/ja = **18 new URLs**. Retargeted to the Pixel workspace (same URLs):
`game/aseprite-alternative` (now the measured side-by-side of STUDIO-PIXEL §6 with a five-item
"where Aseprite is better" list) and `game/fix-ai-pixel-art` (was the Pixel Lab, which "does not
re-grid"; now the Studio cleanup with its generated-art numbers and the "unsure" behaviour).
Not made (would compete or no evidence): see docs/SEO-KEYWORDS.md §6 (photo → pixel art, Lospec
editor alternative, Piskel/Pixelorama alternative). The five Pixel Lab landings stay Lab pages
(their flows and part-4 evidence are the Lab's); they now link to the new pages.

## Stale claims fixed ("Pixel is coming" / "cannot draw")

`game/sprite-editor` (5 spots × 3 languages: workspace count, "does not draw yet", step 1, FAQ, table
row + lead), the Sprite workspace landing FAQ "not a pixel painter" (3), `game/aseprite-alternative`
(description, lead, FAQ, table row, better list × 3), `game/fix-ai-pixel-art` (× 3), home Labs row
("while their Studio workspaces are built", × 3). Plus additions: hub lead, home JSON-LD feature list,
footer game nav and the file-tool game picks name the pixel editor; 9 related pages link to the new
ones (each still 4–6 related).

## Quality gates (`node --test tests/game-seo-quality.test.mjs`)

All 45 family pages pass. The 6 new pages: own copy en ≥ 3021, ko ≥ 1593, ja ≥ 1467 characters
(minimums 1500/800/800). Closest pair involving any new or rewritten page: Jaccard en 0.146 / ko 0.179 /
ja 0.132 (limits 0.30/0.35/0.31), containment en 0.360 / ko 0.443 (pixel-art-animation ↔
sprite-animation-preview) / ja 0.354 (limits 0.46/0.55/0.49). No "AI" wording on family pages
(the retargeted `fix-ai-pixel-art` is a keyword page and names AI-generated input, as before).

## Verification

| Check | Result |
|---|---|
| `npm test` | 2234 pass / 0 fail / 1 skip |
| `npm run check` | OK |
| `NERULIO_CORPUS='C:\nope' python tools/regression.py` | FULL HTTP REGRESSION PASSED (18 suites): game-landing 227 check runs / 129 distinct (Chromium + Firefox, 0 page errors), design 347 (forced wide font at 390 px on 331 game pages + home + hub), studio-pixel 76, seo 526 |
| `SERVICE_PORT=4493 python tests/service-browser.py` | 119/119 |
| `python tools/validate-sitemaps.py dist` | ALL PASS, 472 page URLs (sitemap-game.xml 331 = 313 + 18) |

Two earlier full runs failed and were fixed or re-run: (1) design-browser caught a 390 px overflow
with a forced wide font from the long "Godot 4 · Unity 6 · Phaser · PixiJS" badge on the Pixel pages —
renamed "Engine bundles" (commit 9075201); (2) the known flaky Texture timing check ("a detection still
running for the previous picture…", also noted in HANDOFF-LANDINGS-2) failed once; it passed 2/2
standalone and in the third full run. Note: `tools/regression.py` crashes while printing a failure log
on a cp949 console; run it with `PYTHONIOENCODING=utf-8`.

## Open / next

- The Palette panel shows "0 colours used in the picture" for a multi-frame sprite that has no palette
  yet (visible on `pixel-anim` and the home Pixel row) — a Pixel workspace display bug, not touched here.
- Pixel Lab landings could retarget to the Studio once the Studio covers multi-frame palette locking
  with the same measured outputs.
- `docs/STUDIO-PIXEL.md` says "Evidence is Chromium only"; part 6 now runs the landing → Pixel flows
  (stroke, x7 cleanup, indexed conversion, outline) in Firefox too — the doc can be updated by the
  Pixel owner.
