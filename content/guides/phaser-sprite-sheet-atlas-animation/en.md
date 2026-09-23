In Phaser, a sprite sheet with equal cells is loaded with `this.load.spritesheet(key, url, { frameWidth, frameHeight, margin, spacing })` and animated with `this.anims.create({ frames: this.anims.generateFrameNumbers(key, { start, end }) })`. A packed atlas (TexturePacker JSON, hash or array) is loaded with `this.load.atlas` and animated with `generateFrameNames`, and an Aseprite export is loaded with `this.load.aseprite` and turned into animations with `this.anims.createFromAseprite`. The same code runs unchanged in Phaser 3.90 and Phaser 4. Set `pixelArt: true` in the game config so pixel art stays sharp.

Every snippet on this page was run in Phaser 3.90.0 and Phaser 4.2.1 (WebGL, Chromium), and the two engines drew the test scene pixel for pixel the same.

## Which loader for which file {#which-loader}

| What you have | Loader | Frame keys | Animation helper |
|---|---|---|---|
| One PNG, every cell the same size | `load.spritesheet` | numbers 0, 1, 2… | `generateFrameNumbers` |
| PNG + TexturePacker-style JSON (hash or array) | `load.atlas` | names from the JSON | `generateFrameNames` |
| Several PNG pages + one JSON with a `textures` list | `load.multiatlas` | names from the JSON | `generateFrameNames` |
| PNG + JSON exported by Aseprite | `load.aseprite` | `"0"`, `"1"`… | `createFromAseprite` |
| Animation definitions saved as JSON | `load.json` | (any texture) | `anims.fromJSON` |

A grid sheet is the simplest to start with. An atlas is better once frames have different sizes, once you trim transparent borders, or once you have many characters on one texture. The trade-offs are explained in [sprite sheet vs texture atlas](guide:sprite-sheet-vs-texture-atlas).

## Load a sprite sheet and play an animation {#load-and-play}

:::steps
1. **Measure the grid.** Open the PNG and note the cell size, the empty border around the whole sheet (`margin`) and the gap between cells (`spacing`). Kenney's Pixel Platformer characters, used below, are 24×24 cells with a 1 px gap and no border.
2. **Turn on pixel art.** In the game config set `pixelArt: true`. This switches textures to nearest-neighbour filtering, turns antialiasing off and rounds positions.
3. **Load the sheet in `preload`.** Call `this.load.spritesheet('chars', 'assets/characters.png', { frameWidth: 24, frameHeight: 24, spacing: 1, margin: 0 })`. Frames are numbered left to right, top to bottom, starting at 0.
4. **Create the animation in `create`.** Call `this.anims.create({ key: 'green-walk', frames: this.anims.generateFrameNumbers('chars', { start: 0, end: 1 }), frameRate: 6, repeat: -1 })`. `repeat: -1` loops forever.
5. **Add a sprite and play it.** `this.add.sprite(100, 100, 'chars', 0).setScale(3).play('green-walk')`. Scale by whole numbers (2, 3, 4) so every source pixel covers the same number of screen pixels.
6. **Check the cut if frames look wrong.** `this.textures.get('chars').frameTotal` should equal columns × rows + 1 (Phaser adds a `__BASE` frame for the whole image). Here it is 9 × 3 + 1 = 28.
:::

The whole scene, as it was run:

```js
// main.js — runs unchanged in Phaser 3.90 and Phaser 4.x
function preload() {
  // 24x24 cells, 1 px gap between cells, no border around the sheet
  this.load.spritesheet('chars', 'assets/characters.png', {
    frameWidth: 24,
    frameHeight: 24,
    spacing: 1,
    margin: 0
  });
}

function create() {
  this.anims.create({
    key: 'green-walk',
    frames: this.anims.generateFrameNumbers('chars', { start: 0, end: 1 }),
    frameRate: 6,
    repeat: -1
  });
  // any order, frames repeated: an idle loop that goes 15, 16, 17, 16
  this.anims.create({
    key: 'spike-idle',
    frames: this.anims.generateFrameNumbers('chars', { frames: [15, 16, 17, 16] }),
    frameRate: 8,
    repeat: -1
  });
  this.add.sprite(100, 100, 'chars', 0).setScale(3).play('green-walk');
  this.add.sprite(200, 100, 'chars', 15).setScale(3).play('spike-idle');
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: 720,
  height: 310,
  pixelArt: true, // nearest filtering, no antialias, round pixels
  scene: { preload, create }
});
```

![Phaser test scene: a sprite sheet cut with and without spacing, and animations from five loaders](shot:engine-phaser-spritesheet "Rendered by Phaser 4.2.1 (WebGL) at 3× with pixelArt: true; Phaser 3.90.0 drew the identical image. Art: Kenney, CC0.")

## margin, spacing, startFrame and endFrame {#spritesheet-config}

Phaser counts the grid as `floor((width − margin + spacing) / (frameWidth + spacing))` columns, and the same way for rows. Each cell starts `frameWidth + spacing` pixels after the previous one. If you leave out `spacing` on a sheet that has gaps, every frame starts one pixel further to the left of where it should than the one before it. Frame 8 of the test sheet starts at x = 192 instead of 200, which is the creeping offset in the middle row of the image above. When the first frame is right but later ones drift, spacing is the setting to fix. When the whole grid is shifted, it is the margin.

- `frameHeight` defaults to `frameWidth`, so square cells only need `frameWidth`.
- `startFrame` and `endFrame` keep part of a sheet. `endFrame` is an **index in the full grid, inclusive**. The API docs describe it as "the total number of frames to extract", but that is not how it behaves. The frames you keep are **renumbered from 0**. With `startFrame: 9, endFrame: 10` you get frames 0 and 1 (plus `__BASE`), and frame 0 is the cell at (0, 25).
- `generateFrameNumbers` takes `start`, `end` (default −1, the last frame), `first` (one frame put before the rest) or an explicit `frames` array.

## Texture atlases: JSON hash vs JSON array {#atlas-hash-array}

TexturePacker and most other packers write one of two JSON layouts. In the **hash** layout, `frames` is an object keyed by frame name. In the **array** layout, `frames` is a list of objects with a `filename` field. You do not have to tell Phaser which one you have: `load.atlas` checks whether `frames` is an array and picks the right parser. In the test, both files gave the same 10 frames plus `__BASE`.

```js
// preload
this.load.atlas('chars-atlas', 'assets/characters.png', 'assets/characters.json');

// create — frame names "blue/walk_0001", "blue/walk_0002"
this.anims.create({
  key: 'blue-walk',
  frames: this.anims.generateFrameNames('chars-atlas', {
    prefix: 'blue/walk_',
    start: 1,
    end: 2,
    zeroPad: 4 // 1 -> "0001"
  }),
  frameRate: 6,
  repeat: -1
});
```

`generateFrameNames` builds each name as `prefix + number padded to zeroPad + suffix`. It **skips names that do not exist** and only logs a console warning ("Frame … not found in texture …"). An animation that plays too few frames is almost always a prefix, a suffix such as `.png`, or a `zeroPad` that does not match the JSON. Called with no config, `generateFrameNames('chars-atlas')` returns every frame in the atlas.

**Multi-page atlases.** When a packer spills onto several pages, it writes one JSON whose `textures` array lists each page image and its frames. Load it with `this.load.multiatlas('chars-multi', 'assets/characters-multi.json', 'assets/')`. The third argument is the folder that holds the page images. After that, frame names work exactly as with a single atlas, even when an animation takes frames from different pages.

> **Rotation:** in Nerulio's engine tests, TexturePacker-style frames stored rotated came out mirrored in both Phaser 3.90 and 4.2. Unless you have checked the result yourself, pack for Phaser with rotation turned off.

## Aseprite files {#aseprite}

In Aseprite, use **File › Export Sprite Sheet**. On the Output tab, enable **JSON Data** (Hash or Array), keep **Tags** checked under Meta, and set **Item Filename** to `{frame}`. The command-line equivalent is `aseprite -b hero.aseprite --sheet hero.png --data hero.json --format json-hash --list-tags --filename-format "{frame}"`. The `{frame}` name matters: `createFromAseprite` looks frames up by the keys `"0"`, `"1"`…, so with Aseprite's default names such as `hero 0.aseprite` no animation gets any frames.

```js
// preload
this.load.aseprite('aliens', 'assets/aliens.png', 'assets/aliens.json');

// create — one animation per Aseprite tag, named after the tag
this.anims.createFromAseprite('aliens');
this.add.sprite(300, 100, 'aliens').setScale(3).play({ key: 'pink-walk', repeat: -1 });
```

What the test confirmed with a file written by Aseprite 1.3.18:

- Each tag becomes an animation with the tag's name (case-sensitive). Pass an array of tag names to create only some of them.
- Per-frame durations are kept: 200 ms and 100 ms frames played for 200 ms and 100 ms.
- A **ping-pong** tag becomes `yoyo: true`, and a reverse tag is reversed.
- The animations **play once**. `createFromAseprite` does not set `repeat`, so `play('pink-walk')` stops after one pass. To loop, pass `repeat: -1` when you play it, as above.

Getting `.aseprite` files into other engines as well is covered in [Aseprite files in Godot, Unity and Phaser](guide:aseprite-files-godot-unity-phaser).

## Per-frame durations: they replace frameRate {#frame-durations}

Frames can carry their own `duration` in milliseconds: `frames: [{ key: 'chars', frame: 0, duration: 300 }, { key: 'chars', frame: 1 }]`. The Phaser animation docs say these durations are *added* to the frame time that `frameRate` gives. That is not what happened in 3.90.0 or 4.2.1. With `frameRate: 10` (100 ms), the frame with `duration: 300` stayed on screen for **300 ms, not 400 ms**, and the frame without a duration stayed for 100 ms. Both versions run the same line of code (`currentFrame.duration || msPerFrame`). There is one exception: if you override `frameRate` in `play({ key, frameRate })`, every per-frame duration is ignored. With `frameRate: 20`, both frames lasted 50 ms.

## Animation definitions as JSON {#anims-json}

`this.anims.toJSON()` writes every global animation as `{ anims: [...], globalTimeScale }`, and `this.anims.fromJSON(data)` recreates them, so an art tool can own the animation list instead of your code:

```js
// preload
this.load.json('anims', 'assets/anims.json');
// create — needs the textures the JSON refers to already loaded
this.anims.fromJSON(this.cache.json.get('anims'));
```

Each entry has the same fields as the object you pass to `anims.create`. Animations are global, so create them once, not in every scene.

## Pixel art and Phaser 4 differences {#phaser-4}

For sprite sheets and animations, Phaser 4 changes nothing in the API. Every call on this page is identical in 3.90 and 4.2. The differences are in rendering:

- **`pixelArt: true`** has the same effect in both: `antialias` and `antialiasGL` become false and `roundPixels` becomes true (read back from `game.config` in both versions). `roundPixels` defaults to false when `pixelArt` is not set.
- **Phaser 4 rounds only when it is safe.** By default (`vertexRoundMode` `"safeAuto"`), positions are rounded only for objects that are not scaled or rotated, drawn by a camera with `roundPixels` on. Scaled sprites still get nearest filtering, so they stay sharp, but their positions are not snapped.
- **`smoothPixelArt: true`** (new in Phaser 4) keeps texels square but antialiases their edges. It is meant for pixel art that is scaled or rotated by non-integer amounts, and it turns `pixelArt` off.
- **`this.load.atlasPCT`** (new in Phaser 4) loads the Phaser Compact Texture atlas, a line-based text format that is much smaller than JSON. JSON atlases keep working.
- The Canvas renderer is deprecated in Phaser 4. Use WebGL (`Phaser.AUTO` picks it).
- Trimmed Starling/Sparrow XML atlases (`load.atlasXML`) are placed wrongly in Phaser 3.90; Phaser 4.0 fixed it. In Phaser 3, use JSON or untrimmed XML.

Blur that has nothing to do with frames, such as CSS scaling of the canvas, fractional zoom or camera movement, is covered in [crisp pixel art in Phaser and PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi).

## Common problems {#troubleshooting}

- **The last column or row is missing:** the image is not exactly `margin + n × frameWidth + (n − 1) × spacing` wide or tall. Check the size, or re-export the sheet with even cells.
- **Too few frames play:** look for "Frame … not found" warnings. The generated names do not match the atlas keys.
- **Blurry or shimmering sprites:** set `pixelArt: true` and keep sprite scale and camera zoom whole numbers.
- **Lines from neighbouring frames at the edges:** pack with 1–2 px of padding or extrusion; [tile seams and texture bleeding](guide:tile-seams-texture-bleeding-padding-extrude) explains why.

:::nerulio ws=sprite
Nerulio's Studio does the asset side in the browser, and your files never leave your machine. Drop a sheet or a folder of frames into the Sprite workspace. It detects the grid, including margin and spacing, and shows its confidence with alternatives you can pick. You then tag animations and set per-frame durations on the timeline. Pack & Export writes the Phaser files. Nerulio loaded and drew those files in Phaser 3.90 and 4.2 in its engine tests.

- **Sprite** tab: drop the PNG, check the detected grid, press **Apply**, then drag across the tag lane to name each animation.
- **Pack & Export** tab: choose **Phaser 3 / 4**. You get an atlas JSON (hash, or a multiatlas when there are several pages) and `<name>.anims.json` for `this.anims.fromJSON`. Durations are in ms per frame, ping-pong becomes `yoyo`, loops become `repeat: -1`. The preset never rotates frames.
- Prefer `load.aseprite`? Export **Aseprite JSON** (hash or array). It uses the `"0"`, `"1"`… keys that `createFromAseprite` needs.
:::

![Nerulio Pack & Export with the list of engine targets and the verification line under the export button](shot:studio-pack-export "Pack & Export in Nerulio's Studio: one export button per engine, each with the engine version it was loaded in.")

## FAQ {#faq}

### What is the difference between load.spritesheet and load.atlas in Phaser? {#faq-spritesheet-vs-atlas}

`load.spritesheet` cuts one image into equal cells from `frameWidth`, `frameHeight`, `margin` and `spacing`, and numbers the frames from 0. `load.atlas` reads each frame's rectangle from a JSON file, so frames can have different sizes, be trimmed and have names. Use `generateFrameNumbers` for the first and `generateFrameNames` for the second.

### Why does my Phaser sprite sheet animation show part of the next frame? {#faq-neighbour-frame}

The grid settings do not match the image. Usually the sheet has a gap between cells and `spacing` is missing, so every frame starts one pixel further off than the one before it. It can also be a missing `margin`, or a `frameWidth` that is off by one. Check that `frameTotal` equals columns × rows + 1.

### Do sprite sheets and animations work differently in Phaser 4? {#faq-phaser-4}

No. `load.spritesheet`, `load.atlas`, `load.multiatlas`, `load.aseprite`, `anims.create`, `generateFrameNumbers`, `generateFrameNames`, `createFromAseprite` and `fromJSON` ran unchanged in 3.90 and 4.2. Phaser 4 adds `smoothPixelArt`, the compact PCT atlas format (`load.atlasPCT`) and safer pixel rounding.

### How do I make an Aseprite animation loop in Phaser? {#faq-aseprite-loop}

`createFromAseprite` creates the animations without a `repeat` value, so they play once. Pass it when playing: `sprite.play({ key: 'walk', repeat: -1 })`. You can also change the animation after creating it: `this.anims.get('walk').repeat = -1`.

### How do I give one frame a longer duration in Phaser? {#faq-frame-duration}

Give that frame its own `duration` in milliseconds in the `frames` array. It replaces the time from `frameRate` for that frame only (measured in 3.90 and 4.2). Do not also pass `frameRate` to `play()`, because that makes Phaser ignore per-frame durations.

## Sources {#sources}

- [Phaser docs: Loader (spritesheet, atlas, multiatlas)](https://docs.phaser.io/phaser/concepts/loader) — Phaser 4.1 documentation, with a v3.90 version switcher
- [Phaser docs: Animations (AnimationManager, generateFrameNumbers, createFromAseprite)](https://docs.phaser.io/phaser/concepts/animations) — Phaser 4.1 documentation
- [Phaser v3 to v4 Migration Guide](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/MIGRATION-GUIDE.md) — round pixels, Canvas renderer deprecation
- [Phaser 4 Pixel Art Guide](https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Pixel%20Art%20Guide/Phaser%204%20Pixel%20Art%20Guide.md) — `pixelArt`, `smoothPixelArt`, `vertexRoundMode`
- [Phaser 4.0.0 change log](https://github.com/phaserjs/phaser/blob/master/changelog/v4/4.0/CHANGELOG-v4.0.0.md) — PCT atlas, the AtlasXML trim fix
- [Aseprite docs: Exporting sprite sheets](https://www.aseprite.org/docs/sprite-sheet/) and [command line interface](https://www.aseprite.org/docs/cli/) — Aseprite 1.3
- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — CC0 art used in the tests
