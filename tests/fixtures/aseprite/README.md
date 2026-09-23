# Aseprite fixtures (CC0-1.0)

All files here were made for Nerulio and are dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). None of them contain third-party art.

| File | Written by | Covers |
|---|---|---|
| `blend-rgba.aseprite` | real Aseprite v1.3.18.6 (built from the official source zip), `tools/aseprite/make-fixtures.lua` | all 19 layer blend modes over a partly transparent backdrop, layer and cel opacity |
| `gray-blend.aseprite` | same | grayscale colour mode with multiply/screen/addition/difference/hue |
| `indexed-features.aseprite` | same | indexed, transparent index 3, 8-colour palette with alpha, group, hidden layer, linked cels, 4 frames with durations, tags in all four directions with repeats, 9-patch and pivot slices, user data text/colour/typed properties incl. an extension map |
| `tilemap-flips.aseprite` | same | tilemap layer + tileset, tiles flipped in X, Y, diagonal and combinations, cel z-index |
| `writer-compose-groups.aseprite` | Nerulio's `writeAseprite` | header flag 2 (group opacity/blend valid) |

`<name>.f<N>.rgba.z` is the reference image for frame N: raw RGBA, zlib-compressed (decode with
`node:zlib` `inflateSync`). For the Aseprite-written files it is Aseprite's own export
(`aseprite -b <file> --save-as {frame}.png`, decoded with Pillow). For
`writer-compose-groups.aseprite` it is Aseprite's render with the "compose groups" preference on
(`Image:drawSprite`, `tools/aseprite/composed.lua`), because Aseprite's PNG export always renders
groups flattened. `manifest.json` lists the frames and a few metadata values the reader must report.
