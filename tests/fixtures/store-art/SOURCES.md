# Store Art Pack verification corpus (2026-09-28)

The files in this folder are test inputs, not shipped store art. They are not a substitute for the creator's own game art or their platform review.

| File | Origin and license | SHA-256 |
|---|---|---|
| `scribe-space-key-art-4k.jpg` | 3840×2160 LANCZOS derivative of Scribe's [2D Space Background](https://opengameart.org/content/2d-space-background), [CC0](https://creativecommons.org/publicdomain/zero/1.0/) (source 1920×1080 PNG SHA-256 `c852e4299069c4cb32c0e26254545485509bd08fecbaa86af29eda5ed7898d0b`) | `c864c16153092b3383f3187aa5347437f15d194e4ddf2c9984fe8d2465d46428` |
| `alloy-transparent-logo.png` | Original vector geometry drawn by the test author for this corpus; released as CC0. | `186944d6b4469dd42a599a0eb54ca8178c4f61257ac57b0213d9d92b3e9f1f15` |
| `kenney-gameplay-01.png` | Captured by running [Kenney Starter Kit 3D Platformer](https://github.com/KenneyNL/Starter-Kit-3D-Platformer) in Godot 4.6.3 at 1920×1080, frame 1; game package MIT, visual assets CC0. | `8a4ab8389a4e018f0d10f52ed175c171fbb0d514ebb98453c653e951857011bf` |
| `kenney-gameplay-02.png` | Same actual runtime, distinct player and camera position. | `2907e0180fe6db8f9d7633aa72699e7cc0fcd0299a6be3747aaf23b9d6f69a24` |
| `kenney-gameplay-03.png` | Same actual runtime, distinct player and camera position. | `45a678fc6a6b84ff6cb9efa3df8346c567c2ca0df6d6269c83cc24c2ec85cef4` |
| `kenney-gameplay-04.png` | Same actual runtime, distinct player and camera position. | `90c658ae604c97f6a64a0c429dece8a72998f3c8452d868b537c20aec6158f5b` |
| `kenney-gameplay-05.png` | Same actual runtime, distinct player and camera position. | `1dbbedd2957778f65390728a727a088d3981eaddaa3e28674f14209aa532b82f` |

The Godot capture script creates a fresh scene from `res://scenes/main.tscn`, disables player physics, moves the player and camera to five locations and saves the viewport images. All five images therefore contain actual rendered game geometry and UI, rather than generated substitutes. Screenshots remain byte-for-byte unchanged in the exported ZIP. The captured frames are test fixtures and do not imply the user's game owns this art.
