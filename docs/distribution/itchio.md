# itch.io manual listing kit

## Listing fields

- **Title:** Nerulio — Browser Game Asset Studio
- **Short description:** Prepare sprite animations, pixel art, tilesets and normal maps for your game engine in the browser.
- **Classification:** Software/tool. If the current form has no Software choice, use Other with the custom noun “tool”. Do not classify it as a game or an asset pack.
- **Kind:** Link to the externally hosted browser application. Do not claim an itch-hosted HTML5 build or a downloadable native application.
- **Suggested tags:** game-development, tools, pixel-art, sprites, animation, tileset, godot, unity. Choose the closest existing tags in the form; omit unavailable tags.
- **Platform wording:** Web browser. Intended for desktop workflows on Windows, macOS and Linux with a current browser; this is not a claim that native packages or every browser/device were tested. JavaScript and Canvas are required; some previews need WebGL2.
- **Destination:** https://nerulio.com/en/game/
- **Support:** https://github.com/2009seungbin-stack/my-first-repo/issues

## Long description — ready to paste

Nerulio is a browser-based studio for preparing 2D game assets. Bring in a sprite sheet, an
Aseprite file or a sequence of frames, inspect the animation, and prepare the files your engine
needs. It also provides pixel-art editing and cleanup, tile workflows and texture/normal-map tools.

The workflow connects jobs that otherwise require repeated exports between tools: inspect a grid,
adjust frame timing and pivots, pack an atlas, then choose the relevant engine output. Godot and
Unity workflows are included, with format-specific notes and limitations available in the guides.

Useful starting points:

- Inspect sprite-sheet grids and preview animations before slicing or exporting.
- Bring Aseprite frames and animation metadata into a browser workflow.
- Edit pixel art and review palette or cleanup changes across frames.
- Check tile layouts, terrain-pattern coverage and a small test map.
- Generate or inspect normal maps and compare lighting conventions.

Selected asset files are processed in your browser. Studio projects can be saved as .nerulio files
and use browser storage for local recovery. Keep downloaded backups: clearing site data can remove
local projects. Loading the website and optional features still involves network requests; this is
not a fully offline application or a zero-network guarantee.

Start with the workflow that matches your asset: https://nerulio.com/en/game/

## What makes it different

The emphasis is the handoff from source art to game assets: frame layout, timing, trim placement,
atlas metadata and engine-specific output in one browser workflow. It can complement an existing
pixel editor; no claim is made that it replaces every authoring feature of a desktop package.

## Disclose these limitations

- Check each export target's notes. Different formats represent timing, pivots and collision data differently.
- The Aseprite-to-Godot flow flattens layers; finite repeat counts above one and automatic physics-node creation need additional integration.
- Imported rotated TexturePacker sprites are not a verified Godot conversion path.
- Terrain rebuilding starts from supported images/layouts; it does not edit an existing Godot .tres in place, and it cannot invent missing art.
- Normal-convention detection can be uncertain. Preview lighting and confirm the result.
- Large assets depend on browser memory and device capabilities. Save originals.

## Pricing and launch assets

List access as free for the current static service, and recheck the live site before submission.
Optional Pro/account infrastructure exists in the repository but no live subscription price was
verified. Do not invent a price, a perpetual-free guarantee, or an open-source license.

Use the gallery order in [assets.md](assets.md): Aseprite/timing → pack/export → pixel cleanup →
terrain → normal maps. Suggested cover: a real sprite frame, its actual animation timeline and a
small “Nerulio / Game Asset Studio” label, composed from existing captures. Produce a 630×500 crop
without cutting controls or adding unimplemented features; this crop is not yet produced.

Create the account/listing manually, save privately, inspect it and then choose public visibility.
The [official itch.io page guide](https://itch.io/docs/creators/getting-started) explains categories,
external links, cover proportions, screenshot guidance and manual publication. No listing was submitted.
