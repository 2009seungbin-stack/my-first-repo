# Game landing fixtures (all CC0-1.0)

Used by `tests/game-landing-browser.py` (Lab landings, Chromium and Firefox) and `tools/studio-screens.py`.

| File | Source | Author | Licence | Change |
|---|---|---|---|---|
| `kenney-blue-button.png` | https://kenney.nl/assets/ui-pack (`blue_button_rectangle_depth_flat.png`) | Kenney (www.kenney.nl) | CC0-1.0 | palette PNG re-saved as RGBA |
| `kenney-blue-panel.png` | https://kenney.nl/assets/ui-pack (`blue_button_square_border.png`) | Kenney | CC0-1.0 | palette PNG re-saved as RGBA |
| `bricks076c_color.png`, `_roughness.png`, `_ao.png`, `_height.png`, `_normal.png` | https://ambientcg.com/view?id=Bricks076C (1K PNG) | ambientCG (Lennart Demes) | CC0-1.0 | resized to 128×128 (Lanczos; the 16-bit displacement scaled to 8-bit; the normal map nearest) |
| `ground054_color.png` | https://ambientcg.com/view?id=Ground054 (1K PNG) | ambientCG | CC0-1.0 | resized to 128×128 (Lanczos) |
| `torch-texturepacker.json`, `torch-sparrow.xml` | atlas data written by hand for the CC0 torch sheet `tests/fixtures/game/corpus/torch/Torch_Sheet.png` (XLIVE99, https://opengameart.org/content/animated-pixel-torch): a TexturePacker-style JSON hash (6 frames `torch_00.png`…, no durations) and a Sparrow/Starling XML with trimmed SubTextures named like Friday Night Funkin' atlases (`torch flame0000`…, `torch dim0000`…; rectangles = each frame's opaque bounds) | Nerulio (data), XLIVE99 (art) | CC0-1.0 | new files; the sheet itself is not copied |

Licences: https://creativecommons.org/publicdomain/zero/1.0/ and https://docs.ambientcg.com/license/.
The other fixtures these tests use (ninja frames, samurai sheet, Kenney tiny dungeon) live in
`tests/fixtures/game/corpus/` and `tests/fixtures/kenney/` with their own licence files.
