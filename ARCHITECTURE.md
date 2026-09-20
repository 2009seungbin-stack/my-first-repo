# FileForge Primitive → Recipe architecture

## Scope and integration

This expansion builds on main `200d232540c27a037806cdc9007a0501224e22fe` and its validation-only successor `7cc2b45d607d3bd1ba7dd5d1240e49d9eae41625`. The original image, PDF, pixel and media engines remain; no original feature or test assertion was removed. `tests/browser.py` shares its former setup with the new `tests/browser_harness.py`.

The data path is `File → existing decoder → bounded primitives → recipe → preview + encoded Blob → explicit download`. The live canvas is never transferred to a worker. Generated pixel buffers may be transferred because the recipe owns them.

## Modules

| Layer | Source | Responsibility |
| --- | --- | --- |
| Existing primitives | `src/image.js`, `src/core.js` | Decode, Canvas allocation, resize/fit/crop, median-cut quantization, dithering, connected background removal, outline, encoding and ZIP |
| Pure new primitives | `src/primitives.js` | Alpha bounds; 8-connected components; rectangle/grid validation; sheet layout; alignment; color swap; luminance/gradient normals; channel packing; extrusion; white-margin bounds; font metadata |
| Worker | `src/recipe-worker.js` | Components, palette swap, texture conversion, mask packing, atlas extrusion and margin analysis |
| Recipes | `src/recipes.js` | Compose owned primitives into downloadable PNG/JPG/ICO/FNT/JSON/ZIP outputs; validate limits; serialize output; create share cards |
| Registry/config | `src/tool-registry.js`, `src/platform-presets.js` | Sixteen tool definitions, paths, related tools, limitations, dated platform choices, print ratios, share branding |
| Contextual UI | `src/toolkit.js`, `src/toolkit.css` | Search/Explore, settings, frame candidates, input ordering, recent/favorite IDs, share actions |
| Existing intent integration | `src/experience.js`, `src/intents.js` | Dispatch recipes without replacing editor state, retain URL/language/history behavior |
| Localization/static content | `src/tool-messages.js`, existing i18n/content modules | ko/en/ja UI, useful pre-rendered intent text and tool-specific limitations |

`offset()` is an internal primitive, not a published seamless-texture feature. No completed-tool claim is made for it.

## Ownership and resource limits

The existing application limits input to 24 files, 32 MiB per image, 128 MiB total input, 8192 pixels per side and 16 million decoded pixels. New recipes additionally reject analysis inputs above 4 million pixels. New output canvases use the existing 8192/16-million limits; extruded atlas output is restricted to 4 million pixels. Sprite/grid candidate count is at most 256. Encoded recipe entries are capped at 128 MiB before ZIP assembly; ZIP overhead is additional. These are protective limits, not measurements of the total process memory peak.

Multi-file recipes decode sequentially with concurrency 1. Canvases owned by a recipe are released in `finally`; successful preview ownership passes to `Experience.invalidate()`. ZIP workflows keep one reduced preview and encoded Blobs rather than every decoded canvas. PNG generation for an RGBA mask intentionally uses a straight-alpha writer: Canvas encoding would erase RGB data under alpha zero. This writer is lossless and uses stored DEFLATE blocks, favoring correctness over compression.

Abort uses the existing task AbortController. Worker cancellation terminates that worker. The compatibility path is allowed only for analysis input at or below 262144 pixels; larger requests fail explicitly when a module worker is unavailable. Synchronous Canvas drawing/encoding and ZIP assembly cannot be interrupted in their middle; checks surround those bounded steps. No claim of zero UI-thread work or universal low-end performance is made.

## ZIP and metadata correctness

The old `zip(entries)` behavior is preserved. Recipes opt into `zip(entries, {paths:true})`, which preserves folders while rejecting absolute paths, traversal, empty path segments, backslashes and drive prefixes. Duplicate leaf names are resolved within their folder. Every coordinate is derived from actual placement, not an assumed preset.

A normalized frame's original crop and placement offset are recorded. An atlas's output dimensions and coordinates change when padding is inserted; callers must update UVs. Fixed-grid BMFont metadata is generated from supplied character order, not OCR.

## Privacy and dependencies

No new runtime package, model, CDN or file-upload endpoint is introduced. Existing optional PDF, HEIC, MP3 and portrait-model dependencies retain their documented network behavior. Local storage holds only language and tool IDs; files, names and results stay in memory. The privacy page discloses the new favorite/recent preference key in all three languages.

Branding for generated cards/packs is centralized in `BRAND` in `src/platform-presets.js`; existing site branding elsewhere is unchanged. Share-card branding is never composited into downloadable asset pixels.
