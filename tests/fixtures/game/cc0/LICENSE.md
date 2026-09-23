# CC0 game-asset fixtures

Every file here is public domain (CC0 1.0 Universal, https://creativecommons.org/publicdomain/zero/1.0/),
copied unmodified from its source and only renamed so the name says what the test relies on.
They are real published game assets, used by `tests/game-real-assets.test.mjs` so the engines are
checked on artwork nobody drew for the test.

| File | Source | Author | Licence |
|---|---|---|---|
| kenney-micro-roguelike-8px-s1.png | Micro Roguelike, `Tilemap/colored_tilemap.png` — https://kenney.nl/assets/micro-roguelike | Kenney (kenney.nl) | CC0 |
| kenney-roguelike-dungeon-magenta-16px-s1.png | Roguelike Caves & Dungeons, `Spritesheet/roguelikeDungeon_magenta.png` — https://kenney.nl/assets/roguelike-caves-dungeons | Kenney (kenney.nl) | CC0 |
| kenney-tiny-dungeon-packed-16px.png | Tiny Dungeon, `Tilemap/tilemap_packed.png` — https://kenney.nl/assets/tiny-dungeon | Kenney (kenney.nl) | CC0 |
| oga-caeles-blob47-16px.png | Seamless Tileset Template II, `template_CC0_by_caeles.png` — https://opengameart.org/content/seamless-tileset-template-ii | caeles (OpenGameArt) | CC0 |
| oga-charmap-oldschool-7x9.png | ASCII Bitmap Font "oldschool", `charmap-oldschool_white.png` — https://opengameart.org/content/ascii-bitmap-font-oldschool | domsson (OpenGameArt) | CC0 |
| oga-super-sprite-boy-32px.png | Super Sprite Boy, `32x32 sprite sheet.png` — https://opengameart.org/content/super-sprite-boy-sprite-sheet-30-frames-32x32-64x64 | chrismthegamedude (OpenGameArt) | CC0 |
| oga-sumo-hulk-x4-64px.png | Sprite sheet sidescroller cycles, `sumoHulk_spriteSheet_x4.png` — https://opengameart.org/content/sprite-sheet-sidescoller-cycles | Eris (OpenGameArt) | CC0 |

Ground truth used by the tests comes from each pack's own `Tilesheet.txt` / `spritesheetInfo.txt`
(Kenney) or was counted by hand (OpenGameArt): see `tools/eval-game-engines.json`.
