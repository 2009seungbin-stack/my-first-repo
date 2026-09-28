# Product Hunt manual launch kit

## Product and destination

**Name:** Nerulio

**Exact destination:** https://nerulio.com/en/game/

**Tagline options:**

- Prepare 2D game assets in your browser
- From sprite sheets to engine-ready assets
- A browser studio for sprites, tiles and normal maps

**Short description:** Inspect sprites, preserve animation timing, edit pixel art and prepare tile
and normal-map workflows in one browser-based game asset studio.

## Full description — ready to paste

Nerulio helps game developers prepare and convert 2D assets in the browser. Start with an Aseprite
file, sprite sheet or frame sequence, inspect the animation and layout, then prepare a supported
engine bundle. Pixel-art editing and cleanup, tile-pattern checks and texture/normal-map tools
cover adjacent tasks in the same production workflow.

Use it to inspect a grid before slicing, preserve timing during conversion, check trim placement,
review cleanup candidates, or compare normal-map conventions under lighting. The guides explain
what each format preserves and where additional work in the engine is needed.

Selected assets are processed locally in the browser. Save project backups as .nerulio files;
browser recovery storage is useful but can be cleared. The website and optional online features
still make network requests. Start with a small asset and check the actual export in your engine.

## Maker comment draft

Hi! Nerulio focuses on the space between making game art and using it in an engine: frame grids,
animation timing, trim offsets, atlas metadata, tile layouts and normal-map conventions.

You can start from a source file in the browser, inspect the relevant data and prepare an export.
The guides include concrete examples and format limitations so a working preview is not mistaken
for complete compatibility with every engine setup.

For a first try, choose an Aseprite-to-Godot or sprite-sheet workflow, or inspect a normal map under
a moving light. Which part of your current asset handoff takes the most manual correction?

## Launch-day first comment draft

A useful way to evaluate Nerulio is to bring one asset you already know: a sprite with a held pose,
a trimmed animation, or a tileset with an awkward corner. Compare the source and output in your
engine. Keep the source file and read the selected format's limitations. The starting workflows
are at https://nerulio.com/en/game/.

These are alternative comment drafts for the human maker. Post only what is useful in context;
do not automatically post both, invent a personal origin story, or generate follow-up replies.

## Feature bullets

- Sprite-sheet grid inspection, frame slicing and animation preview.
- Aseprite import, timing and tag workflows with documented target limitations.
- Atlas packing, pivots and collision-related data for supported exports.
- Pixel editing, shared palettes and reviewable cleanup candidates.
- Tileset recognition, terrain-pattern checks and test maps.
- Texture/normal-map generation, convention checks and lighting previews.
- Browser-local asset processing and downloadable project backups.

## Gallery and thumbnail

Use the five-image sequence in [assets.md](assets.md). Lead with the visible source-to-output job,
not a generic dashboard. For a thumbnail, use the existing Nerulio mark with one real sprite at
nearest-neighbour scale on a plain background. Produce the final platform-specific crop after
checking the current upload form; it has not been created in this task. Do not use a mocked engine
success screen or place verification badges on the images.

## FAQ and likely questions

**Is it a game engine?** No. It prepares 2D assets and supported export files for use in an engine.

**Does it replace Aseprite?** It overlaps in pixel editing and animation, and it can complement
an Aseprite workflow. Complete authoring and format parity are not claimed.

**Are my asset files uploaded?** The asset-processing code reads selected files and generates
outputs locally. Hosting, optional downloads, palette retrieval and enabled account/advertising
services can still make network requests. Do not describe the website as zero-network.

**Is it free?** The current static site provides free access. Optional account/Pro infrastructure
exists, but this kit does not claim an active subscription or a price. Recheck the live offering
before launch and update this answer if it changes.

**Does every export work in every engine version?** No such claim is made. Export documentation
separates verification evidence from format-only support. Test the generated bundle in your project.

**What gets lost?** It depends on the format. In the Aseprite-to-Godot route, layers flatten;
finite repeat counts beyond once and physics-node creation need additional integration. Rotated
TexturePacker sprites are not a verified Godot conversion path.

**Will normal-map detection always know GL versus DX?** No. Some maps are ambiguous; use a known
shape and a light test. Correct channel convention does not prove correct surface shape.

**Can I edit an existing Godot terrain resource?** The tile flow rebuilds from supported image
layouts and bits. It does not import and preserve an arbitrary .tres resource in place.

**Can I rely on browser recovery?** Keep downloaded backups. Clearing site storage may erase
local projects, and large assets are constrained by device resources.

**Where can I report a problem?** Use the public
[repository issue tracker](https://github.com/2009seungbin-stack/my-first-repo/issues). Do not
include confidential assets or secrets in a public report.

## Manual launch gate

Check the live destination and offering, prepare real gallery crops, review wording and choose
the launch date in Product Hunt's current submission interface. The operator supplies the maker
identity and account. No launch date, upvotes, reviews, user counts or testimonials are invented.
No submission, comments, replies or engagement automation is implemented.
