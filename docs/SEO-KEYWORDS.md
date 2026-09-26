# Keyword research for the game landing pages (2026-09-24)

Why these pages exist, which searches each one answers, and which searches were left out. The
pages themselves are in `src/game-seo-{broad,engines,formats,fixes,compare,pixel}.js` (see
`src/game-seo-families.js`); their quality gates are in `tests/game-seo-quality.test.mjs`.

## 1. Method and evidence types

No search volumes are claimed anywhere: none of the sources below publishes them, and we did not buy
any. Each query carries the kind of evidence that it is searched at all.

| Code | Evidence | How it was collected |
|---|---|---|
| **AC-G** | Google autocomplete suggests the phrase | `python tools/seo-keywords.py OUT.json` (suggestqueries.google.com, `hl`/`gl` per language), 2026-09-24, one request per 1.0–1.2 s. Seeds: the lists in the script plus `tools/seo-keywords-round2.json` |
| **AC-B** | Bing autosuggest suggests it | same script, api.bing.com/osjson.aspx with the ko-KR / ja-JP / en-US market. The ja-JP market stopped answering after ~40 queries (throttled); the Japanese evidence is mostly AC-G |
| **AC-N** | Naver autocomplete suggests it | same script, ac.search.naver.com (Korean only). Naver answers only for its most frequent phrases; an empty answer is not evidence of no demand |
| **CT** | A competitor ranks a page with that title / H1 | title, description and H1 fetched from the competitor's page on 2026-09-24 (list in §5) |
| **RS** | The pain is documented in our research | `C:\Users\2009s\nerulio-handoff\research\competitors\PAIN-POINTS.md` (GitHub 👍, forum threads, YouTube view counts, itch comments), `SPRITE-PIXEL.md`, `TILE-TEXTURE-UI.md` |
| **H2H** | We measured the competitor ourselves | `docs/STUDIO-PACK-H2H.md`, `docs/STUDIO-TILE.md` (Competitors), `docs/STUDIO-TEXTURE.md` (Head-to-head), and §4 of this file for ezgif |

Reddit could not be read by the research crawler (blocked), so Reddit questions appear only
indirectly ("… reddit" autocompletions).

A page is made only when (1) there is at least one evidence code for the query in that language or a
clear equivalent in the other two, (2) the Studio or a Lab really does the job today, and (3) the page
can say something the existing 64 pages do not (checked by the overlap gate). Same-intent queries share
one page.

## 2. Demand by language (selected clusters)

### English
| Cluster | Queries (evidence) | Served by |
|---|---|---|
| Sprite editor / animator | sprite editor online, sprite sheet editor online, sprite animator online, sprite sheet animator online, 2d sprite animator online, sprite animation player online (AC-G/B); Piskel ranks "Free online sprite editor" (CT) | `game/sprite-editor`, `game/sprite-animator`, existing `game/sprite-lab`, `game/sprite-animation-preview` |
| Sheet / atlas viewer | sprite sheet viewer online, texture atlas viewer online, spritesheet animation viewer, fnf spritesheet viewer, spritesheet xml viewer (AC-G) | `game/sprite-atlas-viewer` |
| Tileset / tilemap | tilemap editor online / browser / free, tileset generator (free, online, pixel art), autotile generator, autotile tileset generator, godot autotile generator (AC-G); Sprite Fusion ranks "Free Tile Map Editor Online" (CT) | `game/tilemap-editor`, `game/tileset-generator` |
| Tile collision | godot tileset collision (generator, shape, not working), godot 4 tileset physics layer, tileset collision generator (AC-G/B); "Add Tilemap Collisions in Godot 4" 137k views (RS) | `game/godot-tileset-collision` |
| Normal maps | normal map generator for pixel art / from image / online, 2d sprite normal map generator, normal map sprite sheet, normal map animated sprite godot, godot 2d normal map (lighting, specular, animated sprite), unity 2d sprite normal map, unity 2d normal map not working (AC-G) | `game/sprite-normal-map`, `game/godot-2d-normal-map`, `game/unity-2d-normal-map`, `game/normal-map-sprite-sheet` |
| Normal map problems | normal map opengl vs directx (+ unity / godot / blender), flip / invert green channel, normal map seams (fix, unity), seamless / tileable normal map (AC-G) | `game/normal-map-opengl-or-directx`, `game/tiling-normal-map-seams` |
| Aseprite files | aseprite viewer online, aseprite file viewer, open aseprite file online, aseprite to png (online, converter), aseprite to sprite sheet, aseprite to gif, aseprite to gamemaker, import aseprite to gamemaker, sprite sheet to aseprite, import sprite sheet into aseprite (AC-G/B) | `game/aseprite-viewer`, `game/aseprite-to-sprite-sheet`, `game/aseprite-to-gif`, `game/aseprite-to-gamemaker`, `game/sprite-sheet-to-aseprite` |
| Atlas formats | texturepacker godot (plugin, godot 4), texture atlas godot 4, texture packer unity (plugin), sprite packer unity, aseprite pixijs (AC-G); "Nothing converts Aseprite JSON into Pixi animations" (RS) | `game/texturepacker-to-godot`, `game/texturepacker-to-unity`, `game/aseprite-json-to-pixi` |
| FNF | fnf spritesheet to gif (converter), fnf spritesheet and xml to gif, fnf spritesheet to png (AC-G/B) | `game/fnf-spritesheet-to-gif` |
| Video | sprite sheet to mp4, sprite sheet to video (AC-G) | `game/sprite-sheet-to-video` (WebM, and it says it is not MP4) |
| Engine settings | unity pixel art blurry (when moving, sprite, texture), unity sprite looks blurry (AC-G/B); godot animation frame duration (AC-G); gdevelop sprite sheet (animation, slice), how to import sprite sheet into gdevelop (AC-G/B) | `game/unity-pixel-art-blurry`, `game/godot-animation-frame-duration`, `game/gdevelop-sprite-sheet`, `game/sprite-sheet-frame-size` |
| Autotile trouble | godot terrain not showing up in tilemap, godot tilemap terrain not showing (AC-G); Godot terrain proposals 189/181/147 👍, "results depend on painting order" (RS) | `game/godot-terrain-wrong-tiles` |
| GameMaker autotile | gamemaker autotile (template, 16, not working) (AC-G/B) | `game/gamemaker-autotile-to-godot` |
| Comparisons | aseprite alternative (free, online, reddit), laigter online / alternative, normalmap online (generator, tool), free tex packer (cli, fnf), texture packer free alternative, ezgif alternative (local, offline), sprite fusion alternative (AC-G/B) | `game/aseprite-alternative`, `game/laigter-alternative`, `game/normalmap-online-alternative`, `game/sprite-sheet-packers-compared`, `game/ezgif-sprite-cutter-alternative`, `game/sprite-fusion-alternative` |
| Pixel editor (2026-09-26) | pixel art editor, pixel art editor online / free / web / browser, pixel art image editor online, best free pixel art editor, open source pixel art editor (AC-G/B); aseprite online, aseprite in browser, aseprite browser version / alternative, aseprite web version (AC-G/B); Novaboard, Pixelorama and Piskel rank as editors (CT) | `game/pixel-art-editor`, `game/aseprite-alternative` (now a measured side-by-side) |
| Pixel animation | pixel art animation maker / editor (online, free), pixel art animation software (online), pixel sprite animation maker (AC-G/B) | `game/pixel-art-animation` |
| Palettes and outline | pixel art palette editor (AC-G); pixel art outline generator (AC-G); add outline to sprite (aseprite), sprite outline (AC-G) | `game/pixel-art-palette-editor`, `game/pixel-art-outline` (+ existing `game/lospec-palette` Lab page) |
| Undo an upscale | pixel art downscaler (online), downscale pixel art (online, image, without blur, to actual pixel count), pixel art scale down (AC-G/B) | `game/pixel-art-downscaler` |
| Generated "pixel art" | ai pixel art fixer / fix, convert ai pixel art to real pixel art, ai pixel art cleanup, pixel art cleanup (AC-G/B); pixel snapper (github, tool, by spritefusion), sprite fusion pixel snapper, pixel art snapper, unfake pixel art, unfake.js (AC-G/B); our benchmark (H2H, docs/STUDIO-PIXEL.md §5) | `game/fix-ai-pixel-art` (retargeted to the Studio cleanup), `game/pixel-snapper-alternative` |
| Atlas trouble | phaser sprite rotation (AC-B); Phaser 3.90 trimmed-XML bug, rotated frames (our own engine runs, `docs/STUDIO-PACK.md`); PixiJS v8 misrenders with a wrong `meta.scale` (RS P10); pivots drift after trimming (RS P12); TexturePacker loses Aseprite tags (RS) | `game/phaser-atlas-frames-wrong`, `game/pixijs-2x-spritesheet-scale`, `game/sprite-jitter-after-trim`, `game/keep-aseprite-tags-when-packing`, `game/sprite-sheet-slicing-off` |

### Korean
Korean searchers write 노멀맵 and 노말맵 (both), 텍스처 and 텍스쳐, 에이스프라이트 for Aseprite,
유니티/고도(엔진) for the engines, 도트 for pixel art and 알만툴/쯔꾸르 for RPG Maker.

| Cluster | Queries (evidence) | Served by |
|---|---|---|
| 스프라이트 | 스프라이트 시트 만들기 (사이트), 스프라이트 시트 자르기, 스프라이트 시트 분리 고도 엔진 (AC-B), 스프라이트 애니메이션 만들기 / 툴, 스프라이트 에디터 (mostly = Unity's Sprite Editor), 유니티 스프라이트 에디터 자르기 (AC-G) | `game/sprite-editor`, `game/sprite-animator` (+ existing slicer / sheet maker) |
| gif | gif 스프라이트 변환, 스프라이트 시트 gif 변환 (AC-G/B) | existing GIF pages; `game/aseprite-to-gif`, `game/fnf-spritesheet-to-gif` |
| 타일 | 타일셋 만들기, 타일맵 에디터, 타일맵 만들기, 타일맵 콜라이더, 유니티 타일맵 틈새, 오토타일 (유니티, 알만툴), 유니티 룰타일 (만들기, 규칙) (AC-G/B/N) | `game/tilemap-editor`, `game/tileset-generator`, `game/godot-tileset-collision` |
| 노멀맵 | 노멀맵 사이트, 노멀맵 만들기, 노멀맵 만드는 사이트, 노멀맵 온라인, 노멀맵 생성 (사이트), 노말맵 변환, 노말맵 추출 (사이트), 노말맵 만들어주는 사이트, 유니티 2d 노말맵 (AC-G/B/N) | `game/sprite-normal-map` (ko title uses 노멀맵 만들기), `game/unity-2d-normal-map`, `game/normal-map-opengl-or-directx` |
| Aseprite | aseprite 한글 / 무료 / 대체 / 사용법, 에이스프라이트 (애니메이션, 프레임 속도), aseprite 가격 / 아이패드 / 모바일 (AC-G/B/N) | `game/aseprite-alternative`, `game/aseprite-viewer` |
| 유니티 도트 | 유니티 도트 깨짐, 유니티 도트 (AC-G) | `game/unity-pixel-art-blurry` (ko title says 도트가 흐리거나 깨질 때) |
| 도트 에디터 (2026-09-26) | 도트 에디터, 도트 아트 에디터, 픽셀아트 에디터, 도트 툴 (추천, 무료), 도트 찍는 툴, 도트 그리기 사이트 / 프로그램, 도트 프로그램 (추천, aseprite), aseprite 대체 (AC-G/B) | `game/pixel-art-editor` (ko title 도트 에디터 온라인), `game/aseprite-alternative` |
| 도트 애니메이션 | 도트 애니메이션 만들기 / 사이트 / 프로그램 / 만드는 법 / 프레임 (AC-G/B) | `game/pixel-art-animation` (ko title 도트 애니메이션 만들기) |
| 도트 팔레트·외곽선 | 도트 팔레트 (사이트, 추천), 도트 컬러 팔레트, 픽셀아트 팔레트 (사이트), 도트 외곽선, 도트 테두리, 에이스프라이트 외곽선 / 테두리 (AC-G/B) | `game/pixel-art-palette-editor`, `game/pixel-art-outline` |

### Japanese
Japanese searchers write ノーマルマップ and 法線マップ, ドット絵 for pixel art, ツクール / ウディタ for
RPG Maker / WOLF RPG Editor, and often end queries with 作り方 / 作成 / サイト / ツール / 変換.

| Cluster | Queries (evidence) | Served by |
|---|---|---|
| スプライトシート | スプライトシート作成ツール (比較, オンライン, 無料), スプライトシート 分割 (ツール, サイト), スプライトシート gif 変換, スプライト アニメーション 作り方 / ツール, スプライトシート再生 (AC-G/B) | `game/sprite-animator`, `game/sprite-atlas-viewer`, `game/sprite-sheet-packers-compared` (ja title: スプライトシート作成ツール比較) |
| タイル | オートタイル 作り方 / 変換 / 47 / 仕組み, godot オートタイル, rpgツクール オートタイル, タイルマップエディタ, godot タイルマップ 当たり判定 / コリジョン, unity タイルマップ 当たり判定 (AC-G) | `game/tileset-generator`, `game/tilemap-editor`, `game/godot-tileset-collision`, `game/gamemaker-autotile-to-godot` |
| ノーマルマップ | ノーマルマップ 作成 (サイト, ツール), ノーマルマップオンライン, ノーマルマップ 生成, 法線マップ 作成 ツール, ハイトマップ ノーマルマップ 変換, ノーマルマップ opengl directx 変換, godot ノーマルマップ, unity 2d ライト 反映されない (AC-G) | `game/sprite-normal-map`, `game/normal-map-opengl-or-directx`, `game/godot-2d-normal-map`, `game/unity-2d-normal-map` |
| ドット絵 | unity ドット絵 ぼやける / 崩れる, ドット絵 ぼやける, ドット絵 拡大 ぼやける (AC-G) | `game/unity-pixel-art-blurry` (+ existing Godot and upscaler pages) |
| ドット絵エディタ (2026-09-26) | ドット絵 エディタ (ブラウザ, 無料, おすすめ, png), ドット絵 ツール (ブラウザ, web, 無料 ブラウザ), ドット絵エディタ 無料, ピクセルアート エディタ (AC-G/B) | `game/pixel-art-editor` (ja title ドット絵エディタ ブラウザ版) |
| ドット絵アニメーション | ドット絵 アニメーション (作成, 作り方, ツール, ソフト, サイト, ブラウザ) (AC-G/B) | `game/pixel-art-animation` |
| パレット・縁取り・縮小 | ドット絵 パレット (サイト, 作り方), ドット絵 減色 (ツール), ドット絵 縁取り, ドット絵 輪郭 (線), ドット絵 縮小 (ツール, ぼやける) (AC-G/B) | `game/pixel-art-palette-editor`, `game/pixel-art-outline`, `game/pixel-art-downscaler` |
| Aseprite | aseprite 日本語 / 使い方 / 無料 / アニメーション (AC-G) | `game/aseprite-alternative`, `game/aseprite-viewer` |

## 3. The pages (45 × ko/en/ja)

| Family | Path (`game/…`) | Workspace (`?ws=`) | Main queries |
|---|---|---|---|
| broad | sprite-editor | sprite | sprite editor online · 스프라이트 에디터 · スプライトエディター |
| broad | sprite-animator | sprite | sprite animator online · 스프라이트 애니메이션 만들기 · スプライトアニメーション 作り方 |
| broad | sprite-atlas-viewer | sprite | sprite sheet / texture atlas viewer online · 스프라이트 시트 뷰어 · スプライトシート 再生 |
| broad | tileset-generator | tile | tileset / autotile generator · 타일셋 만들기 · オートタイル 作り方 |
| broad | tilemap-editor | tile | tilemap editor online · 타일맵 에디터 · タイルマップエディタ |
| broad | sprite-normal-map | texture | normal map generator for sprites · 노멀맵 만들기 사이트 · ノーマルマップ 作成 サイト |
| engines | godot-tileset-collision | tile | godot tileset collision · 고도 타일맵 충돌 · godot タイルマップ 当たり判定 |
| engines | godot-2d-normal-map | texture | godot 2d normal map lighting · 고도 2D 노멀맵 · godot ノーマルマップ |
| engines | unity-2d-normal-map | texture | unity 2d sprite normal map · 유니티 2D 노말맵 · unity 2D ノーマルマップ |
| engines | sprite-sheet-frame-size | sprite | frameWidth / hframes / grid by cell size |
| engines | godot-animation-frame-duration | sprite | godot animation frame duration |
| engines | gdevelop-sprite-sheet | classic Sprite Lab | gdevelop sprite sheet |
| formats | aseprite-viewer | sprite | aseprite viewer online, aseprite to png |
| formats | aseprite-to-sprite-sheet | sprite → pack | aseprite to sprite sheet |
| formats | aseprite-to-gif | sprite | aseprite to gif |
| formats | sprite-sheet-to-aseprite | sprite | sprite sheet to aseprite |
| formats | sprite-sheet-to-video | sprite | sprite sheet to video / mp4 |
| formats | texturepacker-to-godot | sprite | texturepacker godot |
| formats | texturepacker-to-unity | sprite | texture packer unity |
| formats | aseprite-json-to-pixi | sprite | aseprite pixijs |
| formats | fnf-spritesheet-to-gif | sprite | fnf spritesheet to gif |
| formats | gamemaker-autotile-to-godot | tile | gamemaker autotile |
| formats | aseprite-to-gamemaker | sprite | aseprite to gamemaker (UNVERIFIED in GameMaker) |
| formats | normal-map-sprite-sheet | sprite → texture | normal map sprite sheet / animated sprite |
| fixes | godot-terrain-wrong-tiles | tile | godot terrain not showing / wrong tile |
| fixes | unity-pixel-art-blurry | sprite → pack | unity pixel art blurry |
| fixes | normal-map-opengl-or-directx | texture | normal map opengl or directx |
| fixes | pixijs-2x-spritesheet-scale | sprite → pack | pixijs @2x meta.scale |
| fixes | phaser-atlas-frames-wrong | sprite → pack | phaser rotated / trimmed atlas frames |
| fixes | sprite-sheet-slicing-off | sprite | sprite sheet slice off / misaligned |
| fixes | keep-aseprite-tags-when-packing | sprite → pack | texturepacker loses aseprite tags |
| fixes | tiling-normal-map-seams | texture | normal map seams, tileable normal map |
| fixes | sprite-jitter-after-trim | sprite → pack | sprite jitter after trimming |
| compare | aseprite-alternative | sprite | aseprite alternative |
| compare | laigter-alternative | texture | laigter online / alternative |
| compare | normalmap-online-alternative | texture | normalmap online |
| compare | sprite-sheet-packers-compared | sprite → pack | free texture packer, スプライトシート作成ツール比較 |
| compare | sprite-fusion-alternative | tile | sprite fusion alternative |
| compare | ezgif-sprite-cutter-alternative | sprite | ezgif alternative, ezgif sprite sheet cutter |
| broad | pixel-art-editor | pixel | pixel art editor online · 도트 에디터 · ドット絵 エディタ ブラウザ |
| broad | pixel-art-animation | sprite → pixel | pixel art animation maker · 도트 애니메이션 만들기 · ドット絵 アニメーション 作成 |
| broad | pixel-art-palette-editor | pixel | pixel art palette editor · 도트 팔레트 · ドット絵 パレット / 減色 |
| broad | pixel-art-outline | pixel | pixel art outline generator · 도트 외곽선 · ドット絵 縁取り |
| fixes | pixel-art-downscaler | pixel | downscale pixel art, pixel art downscaler · ドット絵 縮小 |
| compare | pixel-snapper-alternative | pixel | pixel snapper, unfake pixel art (Pixel Snapper, unfake.js, perfectPixel) |

The Pixel rows (kind `pixelart`, `?ws=pixel`) are in `src/game-seo-pixel.js` (2026-09-26, branch
`nerulio/pixel-landings`, docs/HANDOFF-LANDINGS-PIXEL.md). Two older pages moved to the Pixel
workspace with them: `game/aseprite-alternative` (compare; now the measured side-by-side of
docs/STUDIO-PIXEL.md §6) and `game/fix-ai-pixel-art` (keyword page; now the Studio cleanup, which
re-grids, instead of the Pixel Lab, which did not).

## 4. ezgif hands-on data (used by `game/ezgif-sprite-cutter-alternative`)

From the competitor research's hands-on log (`research/competitors/SPRITE-PIXEL.md` §1, 2026-09-23,
Playwright on the live site with a 128×64 test sheet of 8 × 32 px frames):

- Files are processed on ezgif's server ("file will be removed from our servers in 1 hour").
- The sprite cutter's tile size defaults to 100 × 100; there is no automatic grid detection. Cutting
  is by tile size or by columns/rows, with offsets and spacing.
- Output: PNG, GIF, JPG, BMP or WebP frames; a ZIP; or the frames sent on to the GIF maker (per-frame
  delays in 1/100 s, loop count, global colour map).
- For transparent sprites the GIF maker's "don't stack frames" box must be ticked, otherwise frames
  pile up.
- It accepts `.aseprite` uploads. It writes no engine data files.

## 5. Competitor titles (CT, fetched 2026-09-24)

| Page | Title / H1 |
|---|---|
| aseprite.org | Aseprite - Animated sprite editor & pixel art tool |
| piskelapp.com | Piskel - Free online sprite editor |
| lospec.com/pixel-editor | Lospec Pixel Editor (banner: no longer developed) |
| spritefusion.com (+ /editor) | Sprite Fusion - Tilemap Editor and Pixel Art Generator for Game Developers · Free Tile Map Editor Online |
| codeandweb.com/texturepacker | TexturePacker - Create Sprite Sheets for your game! |
| codeandweb.com/free-sprite-sheet-packer | Free Sprite Sheet Packer - Online Sprite Sheet Maker ("A free alternative to TexturePacker") |
| mapeditor.org | Tiled \| Flexible level editor |
| ldtk.io | LDtk – 2D level editor from the director of Dead Cells |
| azagaya.itch.io/laigter | Laigter — "Simple normal map generator for 2D sprites!" |
| cpetry.github.io/NormalMap-Online | NormalMap-Online — "Online NormalMap Generator FREE! … No Uploads required" |
| pbrforge.com | PBR Forge - The Best Online Normal Map & PBR Texture Generator |
| novaboard.app | Novaboard - Pixel Art Editor and Animator |
| pixelorama.org | Pixelorama, your free & open source sprite editor. |
| gaptools.in/tools/texture-packer | Free Texture Packer — Online Sprite Atlas / Sprite Sheet Maker |
| snowb.org | Bitmap Font Generator Online - SnowB Bitmap Font |
| blobsmith.itch.io/blobsmith-lite | Blobsmith Lite — free Godot 4 autotile maker |
| led.itch.io/tilesetter | Tilesetter - Tileset generator & map editor tool |
| codeandweb.com/spriteilluminator | SpriteIlluminator - Normal map editor for 2d dynamic lighting |
| wayline.io/tools | Free Game-Dev Tools — Sprites, Tilemaps, Palettes, Sound & More |
| toolpkg.com/sprite-atlas | Sprite atlas packer - Pack sprites into a texture atlas with Phaser/Godot/Aseprite metadata |
| spritesheetgenerator.online | Spritesheet Generator - Create Game Sprite Sheets Online |

## 6. Searched, but no page (and why)

| Query cluster (evidence) | Why not |
|---|---|
| video to sprite sheet, mp4 to sprite sheet (AC-G/B, strong) | The Studio does not read video. Only a two-step route through the video → GIF file tool exists; not a Studio flow. |
| gif to sprite sheet vrchat, sprite sheet maker vrchat, 1024x1024 (AC-G/B, strong) | VRChat's animated emoji need frames in a fixed grid order on a 1024² sheet; the packer does not promise grid order, and nothing was checked in VRChat. |
| 한글 비트맵 폰트 만들기, ビットマップフォント 日本語 (AC-G) | Real demand, but the UI Lab's font-file mode has open bugs (wrong `info size`, missing glyphs silently baked from a system font — `START-HERE.md` §8). No page until they are fixed. |
| godot 3 autotile → godot 4 (RS) | The Godot 3 "3×3 minimal" layout is recognised only on generated test sheets (`tests/tiles.test.mjs`); no real Godot 3 tileset was checked. |
| unity tilemap collider (AC-G/B), 유니티 타일맵 콜라이더, unity タイルマップ 当たり判定 | The Unity Rule Tile export was verified for sprites and rules; tile collision shapes in Unity were not checked. Godot collision was (`game/godot-tileset-collision`). |
| unity tilemap gaps, 유니티 타일맵 틈새 (AC-G) | The existing `atlas-padding` page covers extrusion; a Unity-specific page would be a near-duplicate. |
| texture atlas generator, sprite atlas generator, texture packer online (AC-G) | Same intent as the existing `sprite-sheet-maker` and `game/texture-packer-free` pages. |
| height map to normal map (AC-G, ハイトマップ ノーマルマップ 変換) | The existing `normal-map-generator` Lab page already targets "from height"; a Studio page for it would compete with it. The Studio height-map input is described on `game/sprite-normal-map`. |
| nine patch generator, 나인패치 이미지 만들기 (AC-G/B) | Android `.9.png` output does not exist; the existing `game/9-slice-editor` covers 9-slice borders. |
| spine atlas unpacker / viewer (AC-G/B) | The Studio does not read Spine `.atlas` files. |
| construct 3 import sprite sheet (AC-G) | Nothing was checked in Construct. |
| sprite illuminator alternative, piskel alternatives, tilesetter, blobsmith (AC-G) | No head-to-head data of our own (SpriteIlluminator, Piskel, Tilesetter), or no search demand for the name (Blobsmith: autocomplete returns "bob smith"). Blobsmith's measured result is quoted on `game/tileset-generator` instead. |
| ai sprite sheet generator, sprite sheet ai (AC-G, strong in all three languages) | Nerulio does not generate art. |
| pixel art maker online / from image, 픽셀아트 변환 (사이트), ドット絵 変換 (AC-G) | "Photo to pixel art" is a different job (the image tool `pixel` does pixelation); the Pixel workspace does not turn photos into pixel art, and the cleanup is for art that already is pixel art. |
| lospec pixel editor (online, download) (AC-G/B) | "lospec pixel editor alternative" has no autocomplete answer, and only two tasks were executed in the Lospec editor (T9 100 %, T10 80.1 % with the size typed; docs/pixel-bench/H2H.md §4) — too little for an honest comparison page. |
| piskel / pixelorama alternative, piskel online, pixelorama online (AC-G/B) | Still no executed head-to-head: Pixelorama's web build and Piskel's import wizard did not load a file headless (docs/STUDIO-PIXEL.md §6). |
| 에이스프라이트 온라인, aseprite ブラウザ, ドット絵 エディタ オンライン, 픽셀아트 축소 (no autocomplete answer on 2026-09-26) | No evidence in that language; the English and main-language phrases are served by the pages above. |

## 7. Round 3: pixel editor demand (2026-09-26)

Collected with `python tools/seo-keywords.py OUT.json --extra EXTRA.json` on top of the round-1/2
cache (986 queries, all answered). Seeds added for the Pixel workspace pages: pixel art downscaler,
downscale pixel art, fix upscaled pixel art, ai pixel art fixer, ai pixel art to real pixel art, pixel
art cleanup, lospec pixel editor, indexed palette editor, pixel art palette editor, pixel art outline
generator, sprite outline, pixelorama / piskel online, pixel art editor browser, aseprite in browser,
aseprite web, pixel snapper, sprite fusion pixel snapper, unfake pixel art, unfake.js, pixel art snapper,
pixel art animation maker / editor; 도트 에디터 온라인 / 사이트, 픽셀아트 에디터 온라인, 픽셀아트 축소, 도트 팔레트,
픽셀아트 팔레트, 도트 외곽선, 도트 테두리, 도트 애니메이션 사이트, 에이스프라이트 온라인 / 대체; ドット絵 エディタ
オンライン, ドット絵 縮小 (ぼやける), ドット絵 パレット (変更), ドット絵 縁取り, ドット絵 輪郭, ドット絵 減色,
ドット絵 アニメーション サイト / ブラウザ, aseprite ブラウザ / 代わり. The round-1 answers for "pixel art editor",
"도트 에디터" and "ドット絵 エディタ" (§2) were already in the cache. What each seed returned is summarised in the
rows marked 2026-09-26 in §2; seeds with an empty answer are listed in §6.

