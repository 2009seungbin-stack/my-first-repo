# SEO cannibalization audit (2026-09-28)

Scope: the 151 indexable search pages (453 URLs, ko/en/ja) after the intent-content upgrade
(`docs/SEO-CONTENT-MODEL.md`). Two inputs:

1. **Text similarity** — `node tools/seo-inventory.mjs` (English page-specific text: existing copy +
   intent content, character 6-shingle Jaccard, closest other page).
2. **Intent overlap** — the pages whose search task is close even when the text differs, reported by
   the 13 content agents and reviewed here.

Nothing was deleted, merged, redirected or noindexed in this change. Recommendations below are for
decisions that need Search Console data (impressions per query per URL) first.

## 1. Text similarity before and after

| | Before (baseline) | After |
| --- | --- | --- |
| Pages whose closest page is above 0.50 | 30 | 0 |
| Pages above 0.30 | 30 | 0 |
| Highest pair | 0.961 (`image/compress-to-20kb` ↔ `compress-to-200kb`) | 0.297 (`image/compress-to-100kb` ↔ `compress-to-200kb`) |
| Game page pairs above 0.30 | 0 | 0 |

Before the upgrade the generated file-tool variants (compress-to-*, resize presets, format pairs)
were near-copies of each other: same sentences with a different number. Each now carries its own
measured example, table and failure modes, so no pair is textually close. Textual difference does
not settle intent overlap, which is judged below.

Closest pairs now (≥ 0.20): compress-to-100kb↔200kb 0.297, 50kb↔100kb 0.279, 500kb↔100kb 0.276,
instagram-post↔instagram-portrait 0.264, webp-to-png↔webp-to-jpg 0.256, avif-to-jpg↔avif-to-png
0.251, 20kb↔50kb 0.246, x-header↔linkedin-banner 0.244, mp4-to-mp3↔webm-to-mp3 0.240,
1mb↔200kb 0.239, gamemaker-sprite-strip↔aseprite-to-gamemaker 0.237, instagram-story↔portrait 0.237,
sprite-slicer↔sprite-sheet-slicing-off 0.222.

## 2. Intent groups and decisions

Action vocabulary: **keep separate**, **merge**, **canonicalize**, **redirect**, **noindex**,
**repurpose**. "Watch" = keep, then decide with Search Console data (two URLs ranking for the same
query and swapping positions is the signal to consolidate).

| Group | Pages | Why they could compete | Decision |
| --- | --- | --- | --- |
| Compress to a size | `image/compress`, `compress-to-20kb`, `-50kb`, `-100kb`, `-200kb`, `-500kb`, `-1mb` | Same mechanism; queries differ only by the number | **Keep separate, watch.** People search the exact limit ("사진 100kb 줄이기"). Each page now answers its own limit with a measured outcome (20 KB unreachable at full size; 500 KB where PNG misses by 63,694 B; 1 MB = 1,024,000 B) and its byte table. If Search Console shows 20/50 or 200/500 swapping on the same queries, merge those pairs into one page each and 301 the other. |
| Resize presets | 8 `image/resize/<platform>` pages | Same tool and preset UI | **Keep separate.** Each platform has its own official size, ratio range, file limit and safe area (verified on the platform's help pages, dated 2026-09-28). |
| Format pairs | 10 `image/<a>-to-<b>` pages + `image/convert` | Same converter | **Keep separate.** Direction matters (PNG→JPG loses alpha; JPG→PNG gains nothing), each has measured sizes. |
| Video → GIF / MP3 by container | `video/to-gif`, `mp4/mov/webm-to-gif`; `video/to-mp3`, `mp4/mov/webm-to-mp3` | Same job, container in the query | **Keep separate, watch.** Content is built around each container's codecs (HEVC/ProRes MOV failures, VP8/VP9/AV1 WebM, AAC/Opus audio). Candidate to canonicalize a container page to its generic page if it gets no impressions of its own after 3 months. |
| "Normal map generator" | `game/sprite-normal-map`, `normal-map-generator`, `game/pixel-art-normal-map` | Same head query | **Keep separate; repurpose one.** Split: sprite + Studio lighting / height→gradient Lab / quantised pixel-art normals. `game/pixel-art-normal-map`'s primary action opens the classic Texture Lab, which has no quantisation — **repurpose** it to open the Studio Texture workspace (rewrite of its what/steps copy needed; not done here). |
| GL vs DX | `game/normal-map-opengl-or-directx`, `game/normal-map-converter` | Both about the green channel | **Keep separate, cross-linked.** Detect/diagnose vs convert. Merge candidate if one never earns impressions. |
| Tileset slicing | `game/tileset-slicer`, `tile-grid-slicer`, `sprite-slicer`, `game/sprite-sheet-slicing-off` | "slice a sheet" | **Keep separate** for sprite-slicer (tool) vs slicing-off (troubleshoot). **Watch** `tile-grid-slicer` vs `game/tileset-slicer`: same query family; the first cuts single tile files (Lab), the second prepares an engine tileset. If they swap on "tileset slicer", canonicalize `tile-grid-slicer` → `game/tileset-slicer`. |
| Autotile diagnosis | `game/autotile-tester`, `game/godot-terrain-wrong-tiles`, `game/tile-lab`, `game/blob-47-tileset` | Missing combinations appear on all | **Keep separate.** Generic engine-agnostic tester / Godot-specific diagnosis / identification / format reference. |
| Recover 1× pixel art | `game/pixel-art-downscaler`, `game/pixel-perfect-checker`, `game/fix-ai-pixel-art`, `game/pixel-art-cleanup` | "fix/unscale pixel art" | **Keep separate.** Measure any resize / prove integer scale / generated images without a grid / cleanup of strays and AA. |
| Sprite editor | `game/sprite-editor`, `game/sprite-lab`, `game/pixel-art-editor` | "sprite editor" | **Watch.** Painting vs data prep vs the classic pipeline. If `game/sprite-lab` (classic) ranks against the Studio pages, noindex it in favour of `game/sprite-editor`. |
| Packers | `sprite-sheet-maker`, `game/texture-packer-free`, `game/sprite-sheet-packers-compared` | "sprite sheet packer" | **Keep separate.** Tool / TexturePacker Pro comparison / free-packer comparison. |
| GameMaker | `game/aseprite-to-gamemaker`, `game/gamemaker-sprite-strip` | Same exporter (UNVERIFIED) | **Watch; merge candidate.** Tags/timing vs strip import. Both are "partial" (never loaded in GameMaker); if GameMaker verification never happens and neither earns impressions, merge into `game/gamemaker-sprite-strip`. |
| PixiJS | `game/pixi-spritesheet-json`, `game/aseprite-json-to-pixi`, `game/pixijs-2x-spritesheet-scale` | PixiJS spritesheets | **Keep separate.** Format / Aseprite route / @2x troubleshooting. |
| Phaser atlas | `game/phaser-texture-atlas`, `game/phaser-atlas-frames-wrong`, `game/sparrow-xml-spritesheet`, `game/fnf-spritesheet-to-gif` | Rotation and XML-trim facts repeat | **Keep separate.** Engine how-to / troubleshooting / format / FNF conversion. |
| GIF | `game/aseprite-to-gif`, `game/sprite-sheet-to-gif`, `game/gif-to-sprite-sheet` | GIF timing | **Keep separate.** Direction and source differ. |
| Collision | `game/godot-tileset-collision`, `game/collision-polygon-generator` | Collision polygons | **Keep separate.** Per-tile TileSet physics vs per-frame sprite polygons. |
| Padding | `atlas-padding`, `game/texture-edge-bleed`, `sprite-sheet-maker` (extrude) | Bleeding lines | **Keep separate.** Tilesheet extrude / alpha bleed for mips / atlas settings. |
| GDevelop | `game/gdevelop-sprite-sheet`, `game/sprite-sheet-to-png-frames` | Nerulio has no GDevelop export; the page routes to PNG frames | **Keep, watch.** Honest page (support: partial). If it earns no impressions, canonicalize to `game/sprite-sheet-to-png-frames`. |
| Palettes | `game/pixel-art-palette-editor`, `game/palette-swap-ramp`, `game/lospec-palette`, `game/palette-extractor` | Palettes | **Keep separate.** Ramps / recolour / file formats / extraction. |

## 3. What to do next (needs data, not code)

1. After 4–8 weeks of Search Console data on nerulio.com: export Queries × Pages, and look for
   queries where two URLs from the same row above both get impressions with alternating positions.
2. Consolidate only those pairs (301 + canonical + sitemap update + tests), starting with
   compress-to-20kb/50kb, tile-grid-slicer/tileset-slicer and the GameMaker pair.
3. Repurpose `game/pixel-art-normal-map` to the Studio Texture workspace (its copy and primary action).
