# Nerulio game-dev guides — writer spec (read all of it)

You are writing editorial how-to guides for **Nerulio** (https://nerulio.pages.dev), a free, local-first
browser **game asset studio** (sprite sheets, animation, atlas packing, autotile tilesets, pixel tools,
normal maps, UI/fonts) that exports to Godot, Unity, Phaser, PixiJS, Defold, LÖVE, Tiled, LDtk,
GameMaker (unverified), Spine. The guides are the search content that brings 2D game developers to the
studio. They must be **genuinely the best answer** to the query: accurate for the current engine
versions, concrete, with exact steps, snippets and the "why". Not marketing fluff.

Today is 2026-09-23. Current versions to target (check official docs of these versions):
Godot **4.7** (installed 4.7.2), Unity **6** (installed 6000.5.3f1 = Unity 6.5), GameMaker (2024+/2026
LTS/monthly — manual.gamemaker.io), Phaser **3.90** and **4.x** (4.2 installed), PixiJS **8** (8.21
installed), Defold **1.13**, LÖVE **11.5**, Tiled **1.12**, LDtk **1.5**, Aseprite **1.3**.

## Where things live

- Worktree (the repo): `C:\Users\2009s\Desktop\SITE\.claude\worktrees\agent-aef499f5f486793c5`
  (branch `nerulio/game-guides`). **Do not run git commands that change state** (no commit, stash,
  checkout, reset). The coordinator commits. Only create/edit the files listed below.
- Your guide bodies: `content/guides/<slug>/en.md`, `ko.md`, `ja.md` (in the worktree).
- Your guide metadata: `SCRATCH/guides/meta/<slug>.json` (schema below).
- Your verification work: `SCRATCH/guides/verify/<slug>/` — scripts, logs, engine projects, and a
  `REPORT.md` (format below).
- Engine render screenshots you produce: `assets/guides/engine-<name>.webp` in the worktree
  (locale-neutral, ≤ 1200 px wide, WebP, ideally < 120 KB; use Pillow: `im.save(p,'WEBP',quality=82,method=6)`;
  for pixel art use `lossless=True` if it stays small).
- SCRATCH = `C:\Users\2009s\AppData\Local\Temp\claude\C--Users-2009s-Desktop-SITE\6366d22b-5639-4c5c-b872-1c20b9b6adcd\scratchpad`
- A dev server of the worktree runs at **http://127.0.0.1:4531** (owned by the coordinator — do not
  start/stop servers on 4531; if you need your own server, use the port assigned to you). Once the
  renderer lands you can preview your guide at `http://127.0.0.1:4531/en/guides/<slug>/`
  (and `/ko/…`, `/ja/…`). The Studio is at `http://127.0.0.1:4531/game/studio/?ws=sprite|pack|tile`,
  the Labs at `/game/pixel-lab/`, `/game/texture-lab/`, `/game/ui-lab/`, `/game/tile-lab/`, `/game/sprite-lab/`.

## Accuracy rules (non-negotiable)

1. Every engine step (menu names, property names, inspector labels, API names, defaults) must be
   checked against the **official docs of the stated version** (docs.godotengine.org/en/4.x or /stable,
   docs.unity3d.com/6000.x Manual + package docs for com.unity.2d.*, manual.gamemaker.io,
   docs.phaser.io / newdocs.phaser.io, pixijs.com/8.x, defold.com/manuals, love2d.org/wiki,
   doc.mapeditor.org, ldtk.io/docs, aseprite.org/docs). Use WebSearch/WebFetch.
2. **Reproduce wherever you can** in the installed engine. Every code/config snippet you publish
   for Godot, Phaser, PixiJS, LÖVE must actually run (Godot 4.7.2 headless or with a render window;
   Phaser/Pixi via Playwright Chromium with the libs in `tools/engine-verify/web/node_modules`;
   LÖVE `lovec.exe` in `%LOCALAPPDATA%\nerulio-engine-verify\love-11.5-win64`). Unity C# snippets
   must compile and run in Unity 6000.5.3f1 batchmode (see Engines below). Property names you cite in
   prose (e.g. `texture_filter`, `TextureImporter.filterMode`) should be checked by script
   (Godot: `ClassDB.class_has_property` / `ProjectSettings.has_setting`; Unity: reflection) where feasible.
   Editor-GUI-only steps you cannot drive are checked against docs and marked "docs-checked" in REPORT.md.
3. Never invent version numbers, menu paths, defaults or statistics. If unsure, research or leave it out.
4. **Never fake an engine screenshot.** Engine images are only allowed if the engine rendered them
   (e.g. a Godot scene rendered with the real renderer and saved via `get_viewport().get_texture().get_image()`,
   or Phaser/Pixi canvas captured in Playwright, or LÖVE `Canvas:newImageData():encode`). Caption them
   honestly ("Rendered by Godot 4.7.2 with …"). No mock-ups of editor UI.
5. Nerulio claims must be true **today** on this branch. Read the relevant docs in the repo before
   writing the "Do it in Nerulio" block: `docs/STUDIO-SPRITE.md`, `docs/STUDIO-PACK.md`,
   `docs/STUDIO-TILE.md`, `docs/SPRITE-LAB.md`, `docs/PIXEL-LAB.md`, `docs/TILE-LAB.md`,
   `docs/TEXTURE-LAB.md`, `docs/UI-LAB.md`, `docs/ASEPRITE-IO.md`, `docs/ENGINE-VERIFY.md`, and open the
   UI on :4531 to see it. Say "verified in <engine version>" only for exports the docs list as
   verified; GameMaker exports are UNVERIFIED (no GameMaker here) — say so plainly. Never use the word
   "AI" for Nerulio's own heuristics (say "automatic", "detected", with confidence). Nerulio has no
   generative AI; files never leave the browser.
6. Cite sources: every guide ends with `## Sources {#sources}` listing the official doc pages used
   (title + URL, version in the text). Third-party community tools (Aseprite Wizard, anim8, STI,
   tile-extruder, YATI…) may be recommended as alternatives with a link — be fair to competitors.

## Content bar

- Answer the query in the first paragraph (a 2–3 sentence direct answer — this is the featured
  snippet). Then the detailed steps.
- EN body 900–2,000 words (count prose + lists, not code). Use the length the topic needs; no padding.
- Structure: intro → numbered main procedure (`:::steps`) → deeper sections (why it happens, pitfalls,
  variants per engine version, performance) → `:::nerulio` block → `## FAQ {#faq}` (3–5 real questions
  people search, each answered in 1–4 sentences) → `## Sources {#sources}`.
- Show the exact engine steps AND how Nerulio does the asset side (slicing, packing, padding, bits,
  normal map…), with honest limits.
- Snippets: minimal, runnable, commented, with the file name when relevant.
- **ko.md and ja.md are native rewrites, not literal translations.** Same facts, same section ids,
  same snippets (translate code comments only if natural), same images. Korean: 합니다체, natural
  developer Korean; keep engine UI labels in English as they appear in the (English) editor, and add
  the Korean label in parentheses only when the engine ships an official Korean UI label you verified
  (Godot editor has Korean/Japanese translations; if you cite them, check them). Japanese: です・ます調,
  natural developer Japanese (e.g. ドット絵, スプライトシート, 当たり判定, タイルセット, オートタイル).
  Titles in KO/JA must use the phrases people actually search locally (e.g. "Godot 4 도트 흐림",
  "픽셀 아트 흐릿함", "유니티 스프라이트 자르기", "Unity スプライト 分割", "ドット絵 ぼやける",
  "Godot4 スプライトシート アニメーション"). Use WebSearch to check local phrasing where useful.
- No marketing superlatives, no emoji, no "In this article we will…" filler, no disclaimer walls.

## Markdown dialect (the renderer supports exactly this)

- No `#` H1 (the page title is the H1). Text before the first `##` is the intro.
- `## Heading {#anchor-id}` — **every `##` needs an explicit `{#id}`** (ascii lowercase, dashes),
  identical in en/ko/ja. The table of contents is built from `##`. `### Sub {#id}` (id optional).
- Inline: `**bold**`, `*italic*`, `` `code` ``, `[text](https://…)`, `[text](guide:<slug>)`,
  `[text](guide:<slug>#anchor)`, `[text](tool:<intent-id>)` (a Nerulio tool page),
  `[text](studio:sprite)` / `studio:pack` / `studio:tile` (a Studio workspace), `[text](#anchor)`.
- Lists: `- item` and `1. item` (one level; a nested level with 2-space indent `  - sub` is supported).
- Tables: GFM pipe tables with a `|---|` separator row. Keep them ≤ 5 columns (phones).
- Code fences: ```` ```gdscript ````, `csharp`, `js`, `ts`, `lua`, `ini`, `json`, `xml`, `text`, `shell`, `glsl`.
- Images on their own line: `![alt text](shot:<name> "Caption")`. `shot:<name>` resolves to
  `assets/guides/<name>-<locale>.webp` if it exists, else `assets/guides/<name>.webp`.
- Callout: a paragraph starting with `> ` (e.g. `> **Tip:** …`, `> **Godot 4.3+:** …`).
- Main procedure (becomes HowTo structured data — so it must be the visible steps):
  ```
  :::steps
  1. **Short step name.** What to do, exact labels, values.
  2. **Next step.** …
  :::
  ```
  At most one `:::steps` block per guide (other numbered lists are plain lists). 3–10 steps.
- The Nerulio block (exactly one per guide):
  ```
  :::nerulio ws=sprite
  One short paragraph + a short list of what to click in Nerulio and what you get.
  :::
  ```
  Target is `ws=sprite|pack|tile` (Studio workspaces) or `tool=<intent-id>` (e.g. `tool=pixel-lab`,
  `tool=texture-lab`, `tool=ui-lab`, `tool=tile-lab`, `tool=normal-map-converter`, `tool=bitmap-font`,
  `tool=atlas-padding`, `tool=pixel-art-cleanup`, `tool=palette-swap`, `tool=9-slice-editor`,
  `tool=hitbox-editor`, `tool=missing-glyph-checker`). The renderer adds the heading "Do it in Nerulio"
  and the button; you write only the body.
- FAQ: `## FAQ {#faq}` then `### Question?` + answer paragraph(s). This becomes FAQPage data, so
  every FAQ must be visible and self-contained.
- No raw HTML.

## Nerulio screenshots (the coordinator produces these; reference them by name)

Localized Studio/Lab screenshots available as `shot:<name>` (you just reference them; captions yours):
- `studio-sprite-import` — Sprite workspace right after dropping a sheet: grid decision with confidence, frames cut
- `studio-sprite-timeline` — Sprite workspace: timeline with animation tags, durations, preview
- `studio-sprite-boxes` — a frame with pivot, hitbox/hurtbox rectangles and a collision polygon
- `studio-pack-atlas` — Pack & Export: packed atlas page, settings (padding, extrude, trim), used %
- `studio-pack-export` — Pack & Export: engine target list with the "Loaded in Godot 4.7.2"-style verification line
- `studio-tile-layout` — Tile workspace: layout candidates with confidence, peering bits applied
- `studio-tile-map` — Tile workspace: test map drawn with the Godot rule
- `studio-tile-generator` — Tile workspace: generated 47-tile set from an RPG Maker A2 block
- `lab-pixel-cleanup` — Pixel Lab: cleanup of an upscaled/"fake" pixel image (grid, palette)
- `lab-pixel-palette` — Pixel Lab: palette extraction / ramp swap
- `lab-texture-normal` — Texture Lab: normal map from a sprite, OpenGL/DirectX (Y) toggle
- `lab-tile-padding` — Tile Lab padding/extrude stage (or atlas-padding)
- `lab-ui-nine-slice` — UI Lab 9-slice editor
- `lab-ui-font` — UI Lab bitmap font stage (glyphs + missing-glyph check)
If you need a Nerulio screenshot that is not in this list, write its name and what it should show in
REPORT.md under "Screenshot requests"; the coordinator decides. Use 1–3 images per guide (Nerulio +
any real engine renders you produced).

## meta.json schema (`SCRATCH/guides/meta/<slug>.json`)

```json
{
  "slug": "godot-4-sprite-sheet-animation",
  "section": "sprites",            // sprites | pixel-art | tiles | atlas | animation | lighting | ui
  "engines": ["godot"],            // godot unity gamemaker phaser pixi defold love tiled ldtk aseprite rpgmaker
  "tools": ["sprite-slicer","sprite-animation-preview"],   // Nerulio intent ids (list in the brief)
  "open": {"ws": "sprite"},        // or {"tool": "pixel-lab"} — must match the :::nerulio target
  "related": ["unity-6-slice-sprite-sheet-animation", "..."],   // 2–4 slugs from the guide list
  "tested": ["Godot 4.7.2"],       // ONLY engines in which you actually ran the guide's steps/snippets
  "title": {"en": "…", "ko": "…", "ja": "…"},              // en ≤ 65 chars; ko/ja ≤ 40 chars ideally
  "description": {"en": "…", "ko": "…", "ja": "…"}         // en 120–160 chars; ko/ja 60–110 chars
}
```

## REPORT.md per guide (`SCRATCH/guides/verify/<slug>/REPORT.md`)

- Word counts (en words; ko/ja characters).
- A table of every engine claim in the guide: claim · status (`reproduced` in <engine version> with
  script/log path | `docs-checked` with URL | `not reproducible here` and why).
- Engine screenshots produced and how (command).
- Anything you were unsure about.
- Screenshot requests (optional).

## Engines on this machine

- Godot 4.7.2: `C:\Users\2009s\Desktop\Godot_v4.7.2-stable_win64_console.exe`. Headless:
  `--headless --path <proj> --script res://check.gd` or `--headless --import`. For real rendering
  omit `--headless` and add `--rendering-driver opengl3 --rendering-method gl_compatibility`
  (a small window opens briefly; that is fine). See `tools/engine-verify/godot/probe.gd` and
  `tools/engine-verify/godot_runner.py` for working patterns. Make your own project dir under
  `SCRATCH/guides/verify/<slug>/`.
- Unity 6000.5.3f1: find the editor path in `tools/engine-verify/unity_runner.py`. A template project
  is cached in `%LOCALAPPDATA%\nerulio-engine-verify\unity-template` (and `unity-template-tile` with
  2D Tilemap Extras). **Copy it** to your own dir under `SCRATCH/guides/verify/<slug>/` before use —
  never open the cached one directly (other agents use it). Batchmode:
  `Unity.exe -batchmode -nographics -projectPath <copy> -executeMethod Class.Method -logFile <log> -quit`.
  Each run takes 1–2 min; run at most one Unity process at a time yourself.
- Phaser 3.90 / 4.2, PixiJS 8.21: `tools/engine-verify/web/node_modules` (installed). Serve a small
  harness page with your own static server on your assigned port and drive it with Python Playwright
  Chromium (see `tools/engine-verify/web_runner.py`, `web/harness.html`).
- LÖVE 11.5: `%LOCALAPPDATA%\nerulio-engine-verify\love-11.5-win64\lovec.exe` (see `love_runner.py`).
- Defold bob.jar 1.13.1 + JDK 25: `%LOCALAPPDATA%\nerulio-engine-verify\bob.jar`, `jdk-25`
  (see `defold_runner.py`) — builds only, no rendering.
- Tiled 1.12.2 CLI: `%LOCALAPPDATA%\nerulio-engine-verify\tiled` (see `tools/engine-verify/tile/tiled_check.py`).
- Aseprite 1.3.18 CLI: `C:\Users\2009s\asebuild\b\bin\aseprite.exe`.
- msdfgen: `%LOCALAPPDATA%\nerulio-engine-verify\msdfgen`.
- CC0 test art: `tests/fixtures/kenney/`, `tests/fixtures/tile/`, `tests/fixtures/sprite/`,
  `tests/fixtures/aseprite/`, and the corpus `C:\Users\2009s\nerulio-asset-corpus` (manifest.json has
  licences). Only CC0 art in published screenshots; credit Kenney etc. in the caption if shown.
- Python has Pillow and Playwright. Node is available.

## The full guide list (slug — owner group)

A godot-4-sprite-sheet-animation · godot-4-pixel-art-blurry-jitter · aseprite-files-godot-unity-phaser · hitboxes-pivots-2d-animation
B unity-6-slice-sprite-sheet-animation · unity-pixel-art-blurry-pixel-perfect · unity-rule-tile-autotile · nine-slice-ui-godot-unity-phaser
C phaser-sprite-sheet-atlas-animation · pixijs-8-spritesheet-animation · love2d-sprite-sheet-quads-anim8 · defold-atlas-tile-source-flipbook · gamemaker-import-sprite-strip
D godot-4-terrain-autotile-47-blob · dual-grid-autotile · tiled-wang-sets-terrain · rpg-maker-a2-autotile-to-godot · tile-seams-texture-bleeding-padding-extrude
E sprite-sheet-vs-texture-atlas · 2d-normal-maps-lighting-godot-unity · opengl-vs-directx-normal-maps · palette-swap-sprites
F bitmap-font-sdf-msdf-game-ui · cjk-font-atlas-localization · fix-ai-generated-pixel-art · pixel-art-crisp-in-browser-phaser-pixi

Use these slugs in `related` and `guide:` links (link generously but naturally to sibling guides).

## Nerulio intent ids you may use in `tools` / `tool:` links

sprite-lab, pixel-lab, tile-lab, texture-lab, ui-lab, sprite-slicer, frame-normalize,
sprite-animation-preview, sprite-pivot-editor, hitbox-editor, collision-polygon-generator,
palette-extractor, palette-swap-ramp, pixel-art-cleanup, pixel-perfect-checker, tileset-slicer,
autotile-tester, seamless-tile-checker, tile-helper, channel-unpacker, normal-map-converter,
pbr-texture-validator, texture-edge-bleed, texture-map, 9-slice-editor, button-state-generator,
missing-glyph-checker, ui-scale-preview, bitmap-font, pixel, refiner, palette-swap,
sprite-sheet-maker, atlas-padding, mask-packer.

## Hand-off

When done, reply with: slugs finished, word counts, tested engines per guide, anything not reproduced,
screenshot requests, and any doubts. Keep it short; details go in the REPORT.md files.

## Ports (important)

Do NOT start servers on arbitrary ports (other agents own them). For Phaser/Pixi in Chromium, use
Playwright **request interception** instead of a server: `page.route('http://guides.local/**', handler)`
that fulfils each request from disk (`route.fulfill(path=...)` with the right content type), then
`page.goto('http://guides.local/index.html')`. Map `/lib/...` to `tools/engine-verify/web/node_modules/...`.
Keep harness files in `SCRATCH/guides/verify/<slug>/`. The coordinator's dev server on 4531 may be
used read-only for previews and Studio screenshots/tests of your own.
