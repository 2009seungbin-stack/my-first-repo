# FileForge new tools and release boundaries

All sixteen tools below are executable recipes, not placeholder buttons. Existing Image/PDF/Pixel/Media tools and their URLs remain available. New tools accept still raster images through the existing decoder (PNG/JPG/WebP/AVIF when supported; HEIC through the existing optional engine). SVG input is not supported. Browser decode support, limits and local errors still apply.

| Tool / canonical URL | Recipe and actual output | Important limit |
| --- | --- | --- |
| Game Asset Refiner `/game-asset-pixelizer/` | Optional connected cleanup → alpha trim → centered exact square → palette/dither → outline. PNG or ZIP of 16/32/64/128/custom squares | Custom up to 512; alpha cutoff rather than semantic AI; outline may add a color |
| Sprite Slicer `/sprite-slicer/` | Alpha connected components → user-edited rectangles → cropped PNGs and JSON in ZIP | At most 256 candidates; touching subjects/islands need review; no automatic animation understanding |
| Normalize Frames `/normalize-sprite-frames/` | Bounds → common dimensions → top/center/bottom alignment and horizontal anchor → PNG/JSON ZIP | No rescaling; destination must fit every frame |
| Sprite Sheet Maker `/sprite-sheet-maker/` | Ordered frames → trim/normalize → grid placement with padding → sheet PNG + measured JSON ZIP | Columns specified, rows derived; no optimal bin packing |
| Palette Swap `/palette-swap/` | Sampled palette → exact/tolerance replacement → PNG | At most 16 sampled swatches; shading mode is luminance-offset approximation |
| Marketplace Pack `/marketplace-image-pack/` | Per-input fit/crop/background → dated Etsy/Shopify/custom sizes → JPG folders and preset JSON ZIP | No Amazon/Instagram presets; one shared fit/crop setting; JPEG quality fixed at 0.92 |
| Print Ratio Pack `/etsy-print-size-generator/` | 2:3, 3:4, 4:5, 11:14 and √2 proportions → per-ratio JPG ZIP | Pixel rounding; no promised physical print size/DPI or restored detail |
| Logo Background `/remove-white-background-from-logo/` | Border-connected selected color removal → transparent PNG | Enclosed white retained; no general AI segmentation |
| Bitmap Font `/bitmap-font-maker/` | Exact cell grid + Unicode order/baseline → PNG + BMFont text FNT + JSON ZIP | Fixed-width cells, no kerning, glyph detection, grid-spacing control or tested Godot resource generation |
| Mask Packer `/texture-mask-packer/` | First four equal-sized input luminances/0/255 → channel mapping → straight-alpha PNG | Input order matters; no per-source resampling or separate channel-preview UI; stored PNG favors exact bytes over compression |
| Atlas Padding `/atlas-padding/` | Exact grid tiles → edge extrusion → PNG + new coordinates JSON ZIP | Grid only; UV coordinates change; not a UV bake |
| Texture Map `/normal-map-generator/` | Luminance → grayscale/invert/alpha preview or height-gradient normal approximation → PNG | No PBR material reconstruction or height inference; Y direction is adjustable |
| Tile Helper `/tile-grid-slicer/` | Exact tile grid → individual PNGs + JSON ZIP | Divisible grid; no tile rearrangement, terrain rules or Godot-specific autotile resource |
| Scan Image Split `/split-scanned-images/` | Manual vertical split and LR/RL output order → PNG/JSON ZIP | Images only, not PDF; no spine detection, deskew or automatic center inference |
| Image Margin Crop `/auto-crop-image-margins/` | White/transparent content bounds → padding → preview PNG | Images only, not PDF; no OCR; all-blank inputs fail visibly |
| Favicon Pack `/favicon-generator/` | Fit image → 16/32/48/180/192/512 PNGs + modern ICO + manifest/head snippets ZIP | No SVG/maskable generation; modern PNG-in-ICO, not legacy DIB compatibility; manifest is an icon fragment |

## Additional meaningful aliases

`/image-to-pixel-art/` and `/32x32-pixel-art-converter/` open the refiner (default 32). `/etsy-image-resizer/` opens Marketplace Pack. `/brand-icon-pack/` opens Favicon Pack. Each supports existing ko/en/ja prefixes. Query combinations are not separate sitemap pages.

## Platform/source checks: 2026-09-20

Preset choices are centralized in `src/platform-presets.js` with `source` and `sourceCheckedAt` rather than scattered constants. These sources were checked; the app-selected values are not represented as platform mandates.

- Etsy: https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop — recommends listing dimensions at least 2000 pixels on both sides. This application chooses a 3000×2000 landscape JPEG, flattening transparency; it is not a required exact size.
- Shopify: https://help.shopify.com/en/manual/products/product-media/product-media-types — 2048×2048 is a recommended square product size; theme requirements can differ.
- Manifest icons: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons and https://web.dev/articles/add-manifest — correct src/sizes/type and common 192/512 icon outputs. No installability guarantee follows from icons alone.
- Apple touch icons: https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html — archived Apple guidance includes an apple-touch-icon link and 180-pixel example; not claimed as an exhaustive current device specification.
- BMFont text format: https://www.angelcode.com/products/bmfont/doc/file_format.html . Godot FontFile import reference: https://docs.godotengine.org/en/stable/classes/class_fontfile.html .

Amazon and Instagram output presets were not verified sufficiently for this release and are excluded rather than guessed. No external palette collection was copied.

## Godot usage, without invented resources

For the bitmap-font ZIP, keep `font.png` next to `font.fnt` inside the Godot project. Assign the imported FontFile to a Label/Control Font theme override and choose a font size matching the cell height. This is an import guide based on the official FontFile documentation, not a claim that a Godot runtime import was tested here. No `.tres` or version-specific resource is fabricated.

Sprite and atlas JSON coordinates are pixel coordinates. When adding atlas padding, use the new dimensions and frame rectangles. Game Asset PNGs are exact-size images; choose nearest-neighbor sampling in the target engine for pixel art. No engine-specific import script is bundled.

## Explicitly not shipped

The requested PDF booklet/signature/RTL/manga imposition, PDF spread splitting and PDF margin crop are not implemented. Image split/crop tools above are not substitutes advertised as PDF tools. Silence removal and pause shortening, collision polygons, seamless edge blending and deskew are also not implemented. No SEO entry or stub action claims these are ready. Existing PDF editing, merging, splitting and media trim/audio/GIF tools are preserved but not expanded in these areas.
