In PixiJS 8 you load a spritesheet by passing its JSON to `await Assets.load('hero.json')`. This loads the image named in `meta.image` and returns a `Spritesheet`. Its `sheet.textures` holds one texture per frame, and its `sheet.animations` holds one texture array per entry of the JSON's `animations` map. Pass one of those arrays to `new AnimatedSprite(...)`, set `animationSpeed` (frames per 60 Hz tick, so 6 fps is `6 / 60`) and call `play()`. For pixel art, set `TextureSource.defaultOptions.scaleMode = 'nearest'` before loading anything.

Every snippet below was run in PixiJS 8.21.0 (WebGL renderer, Chromium), and the measurements quoted come from that run.

## The spritesheet JSON PixiJS reads {#json-format}

PixiJS 8 reads the TexturePacker "JSON hash" layout: `frames` is an object keyed by frame name. It also reads a few optional fields that matter for animation:

```json
{
  "frames": {
    "green_walk_0": {
      "frame": { "x": 0, "y": 0, "w": 24, "h": 24 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 24, "h": 24 },
      "sourceSize": { "w": 24, "h": 24 },
      "anchor": { "x": 0.5, "y": 1 }
    },
    "green_walk_1": { "frame": { "x": 25, "y": 0, "w": 24, "h": 24 }, "anchor": { "x": 0.5, "y": 1 } }
  },
  "animations": {
    "green_walk": ["green_walk_0", "green_walk_1"]
  },
  "meta": { "image": "hero.png", "size": { "w": 224, "h": 74 }, "scale": "1" }
}
```

| Field | What PixiJS does with it |
|---|---|
| `frames[name].frame` | Rectangle on the page. For a `rotated` frame, PixiJS swaps the width and height itself |
| `spriteSourceSize`, `sourceSize` | Put a trimmed frame back in its original box |
| `anchor` | Becomes `texture.defaultAnchor`, which every Sprite built from that texture starts with |
| `animations` | Name → frame names in playback order. This becomes `sheet.animations` |
| `meta.scale` | Sets the texture resolution. `"2"` means an @2x image (see below) |
| `meta.related_multi_packs` | Other JSON files of the same atlas, loaded automatically |

Most generic JSON exporters leave out `animations`. Without it, `sheet.animations` is empty and you have to list the frames yourself. The PixiJS API docs note that default anchors, 9-slice borders and animation grouping are "currently only supported by TexturePacker". Nerulio's PixiJS export (below) writes all three as well. Aseprite JSON loads fine as a set of frames, but PixiJS does not turn Aseprite `frameTags` into animations.

## Load a spritesheet and play an animation {#load-and-play}

:::steps
1. **Export the sheet as JSON hash with animations.** Put the PNG and the JSON in the same folder. `meta.image` is resolved relative to the JSON file.
2. **Switch the default filter to nearest (pixel art only).** Set `TextureSource.defaultOptions.scaleMode = 'nearest'` before the first `Assets.load`. It only affects textures created after it runs.
3. **Create the application.** `const app = new Application(); await app.init({ width, height, roundPixels: true });` then add `app.canvas` to the page. In v8, `init` is asynchronous and `app.canvas` replaces `app.view`.
4. **Load the JSON.** `const sheet = await Assets.load('assets/hero.json')`. This fetches the image, parses the frames and returns a `Spritesheet`.
5. **Create the AnimatedSprite.** `const walk = new AnimatedSprite(sheet.animations.green_walk)`. Set `walk.animationSpeed = 6 / 60` for 6 frames per second, then call `walk.play()`. `autoPlay` is false by default, so without `play()` you only see the first frame.
6. **Place it and add it to the stage.** Scale by whole numbers (`walk.scale.set(3)`) and position it. The anchor already comes from the JSON. Without one in the JSON, the anchor is the top-left corner (0, 0).
:::

```js
// main.js — PixiJS 8
import { Application, Assets, AnimatedSprite, TextureSource } from 'pixi.js';

// pixel art: every texture source created from now on samples with 'nearest'
TextureSource.defaultOptions.scaleMode = 'nearest';

const app = new Application();
await app.init({ width: 720, height: 290, background: '#1b2030', roundPixels: true });
document.body.appendChild(app.canvas);

const sheet = await Assets.load('assets/hero.json'); // loads hero.png too, then parses it
const walk = new AnimatedSprite(sheet.animations.green_walk);
walk.animationSpeed = 6 / 60; // 6 frames per second at 60 ticks per second
walk.scale.set(3);
walk.position.set(50, 110);
walk.play();
app.stage.addChild(walk);
```

![PixiJS test scene: animated sprites from a spritesheet, a sheet at @2x with the right and wrong meta.scale, and the same frame with linear and nearest filtering](shot:engine-pixi-spritesheet "Rendered by PixiJS 8.21.0 (WebGL). Top: AnimatedSprites anchored at the feet from the JSON, an @2x sheet with meta.scale 2 (same size) and 1 (double size). Bottom: 'linear' vs 'nearest'. Art: Kenney, CC0.")

## Speed, looping and per-frame timing {#playback}

- **`animationSpeed`** is how many frames advance per tick of a 60 Hz ticker, scaled by the ticker's `deltaTime`. The speed therefore does not depend on the monitor's refresh rate: frames per second = `animationSpeed × 60`. With `6 / 60`, frames changed every 166.6 ms on average in the test.
- **One-shot animations:** `new AnimatedSprite({ textures, animationSpeed: 0.1, loop: false, autoPlay: true, onComplete: () => … })`. The options object accepts every Sprite option as well (`anchor`, `position`…). `onComplete` fired exactly once, and the sprite stayed on its last frame with `playing === false`.
- **Other hooks:** `onFrameChange(frame)` fires on every texture change, `onLoop()` when a looping animation wraps around. `gotoAndStop(n)` and `gotoAndPlay(n)` jump to frame `n`, and a negative `animationSpeed` plays backwards.
- **Per-frame durations:** pass `{ texture, time }` objects instead of textures. `time` is in **milliseconds**. In the test, `[{ texture: a, time: 300 }, { texture: b, time: 100 }]` showed the frames for 300 ms and 100 ms. `animationSpeed` still multiplies these times, so leave it at 1 for real-time playback.

```js
// hold the first frame longer: times are milliseconds
const hit = new AnimatedSprite([
  { texture: sheet.textures.blue_walk_0, time: 300 },
  { texture: sheet.textures.blue_walk_1, time: 100 }
]);
hit.play();
```

When the durations come from Aseprite JSON, each frame's `duration` is still available as `sheet.data.frames[name].duration`. Build the `{ texture, time }` list from it.

## Pixel art: scaleMode 'nearest' in v8 {#pixel-art}

PixiJS textures default to `'linear'` filtering, which blurs pixel art as soon as it is scaled (bottom left of the image above). The v7 names are gone in v8. `SCALE_MODES.NEAREST` is now the string `'nearest'`, and there is no `BaseTexture` any more. You have three ways to set it:

- **For everything:** `TextureSource.defaultOptions.scaleMode = 'nearest'` before loading.
- **For one asset:** `await Assets.load({ src: 'assets/hero.json', data: { textureOptions: { scaleMode: 'nearest' } } })`. The spritesheet loader passes `textureOptions` on to its image. In the test, this overrode the global default for that asset alone.
- **After loading:** `sheet.textureSource.scaleMode = 'nearest'`, or `texture.source.scaleMode` for a single texture. All frames of a sheet share one source.

Also pass `roundPixels: true` to `app.init` so sprites are drawn at whole-pixel positions, and scale by whole numbers. Browser-level causes of blur, such as CSS scaling and `devicePixelRatio`, are covered in [crisp pixel art in Phaser and PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi).

## @2x sheets and meta.scale {#resolution}

In v8, `meta.scale` sets the resolution of the sheet's texture source directly. An @2x sheet whose JSON says `"scale": "2"` gives 24×24 textures for 48×48 pixels of image. It draws at the same size as the @1x sheet, just with more detail. The same image with `"scale": "1"` gave 48×48 textures, so every sprite drew at **double size** (top right of the image above). If an HD atlas suddenly appears twice as big after an upgrade to v8, `meta.scale` is the first thing to check. `meta.scale` also wins over an `@2x` in the file name.

To let PixiJS pick the variant for the device, name the files `hero@1x.json` and `hero@2x.json` and use a resolution pattern:

```js
await Assets.init({ texturePreference: { resolution: Math.min(2, window.devicePixelRatio) } });
Assets.add({ alias: 'hero', src: 'assets/hero@{1,2}x.json' });
const sheet = await Assets.load('hero'); // hero@2x.json on a 2x screen
```

`Assets.init` must run before the first `Assets.load`. With a preference of 2, the test loaded `hero@2x.json`, and its textures were still 24×24.

## Multi-page sheets {#multipack}

When an atlas needs several pages, every page gets its own JSON, and `meta.related_multi_packs` lists the other JSON files. Loading the first one loads the rest (`sheet.linkedSheets`), and every frame name is registered in the texture cache. There is a catch: **`sheet.animations` only resolves frames from its own page.** An animation listed on page 0 that uses frames stored on page 1 came back as an array of `undefined`. After the load, build such animations from the cache instead:

```js
const sheet = await Assets.load('assets/pack-0.json'); // also loads pack-1.json
const robot = new AnimatedSprite(['robot_walk_0', 'robot_walk_1', 'robot_walk_2'].map(n => Texture.from(n)));
```

In v8, `Texture.from(name)` only reads the cache. It returns `Texture.EMPTY` when the sheet has not finished loading, so call it after `await Assets.load`.

## Anchors and pivots {#anchor}

A frame's `anchor` in the JSON becomes `texture.defaultAnchor`. `new Sprite(texture)` and `new AnimatedSprite(textures)` copy it from their first texture. In the test, a JSON anchor of `{ "x": 0.5, "y": 1 }` put every character's feet on its position. If frames have different pivots (a sword swing, a crouch), pass `updateAnchor: true` so the anchor is copied again on every frame change. An `anchor` you set yourself overrides the JSON value until the next frame change with `updateAnchor`. Why pivots should sit at the feet or hips is explained in [hitboxes and pivots for 2D animation](guide:hitboxes-pivots-2d-animation).

## Common problems {#troubleshooting}

- **Nothing shows, or `Texture.EMPTY`:** you built textures before `await Assets.load` finished, or you misspelled a frame name. `Texture.from` no longer loads URLs in v8.
- **Only the first frame shows:** call `play()` or pass `autoPlay: true`.
- **The animation runs far too fast:** `animationSpeed` is not frames per second. Use `fps / 60`. FrameObject `time` values are milliseconds, not seconds.
- **HD sprites are twice the size:** `meta.scale` does not match the image.
- **Blurry or shimmering pixel art:** set `'nearest'` before loading, use `roundPixels: true` and whole-number scales.
- **Bleeding lines at frame edges:** pack with 1–2 px of padding or extrusion ([why it happens](guide:tile-seams-texture-bleeding-padding-extrude)).

:::nerulio ws=sprite
Nerulio's Studio builds the PixiJS spritesheet in your browser, and your files are never uploaded. Import a sheet, loose frames, a GIF or an `.aseprite` file in the Sprite workspace. It detects the grid with a confidence score and alternatives. You then tag animations, set per-frame durations and place a pivot per frame. Pack & Export writes the JSON that PixiJS 8.21 loaded and drew in Nerulio's engine tests, including rotated and multi-page sheets.

- **Sprite** tab: drop the file, check the detected grid and press **Apply**, then name animations on the tag lane and set pivots with **P**.
- **Pack & Export** tab: choose **PixiJS 8**. You get a spritesheet JSON with `animations` in playback order, `anchor` set from each pivot, `related_multi_packs` for several pages, and `meta.scale` matching each @2x or @0.5x variant.
- Frame times in ms are in `meta.nerulio.animations`, ready for `{ texture, time }` frames. The included README shows the three lines that use them.
:::

![Nerulio Sprite workspace right after dropping a sheet: the detected grid with its confidence and the frames cut from it](shot:studio-sprite-import "Nerulio's Sprite workspace proposes the grid, with a confidence score, before anything is cut.")

## FAQ {#faq}

### How do I play a spritesheet animation in PixiJS 8? {#faq-play-animation}

Load the JSON with `const sheet = await Assets.load('hero.json')`, then `const anim = new AnimatedSprite(sheet.animations.walk)`. Set `anim.animationSpeed = fps / 60`, call `anim.play()` and add it to the stage. The JSON needs an `animations` map, otherwise build the texture array yourself from `sheet.textures`.

### Why is my PixiJS pixel art blurry? {#faq-blurry}

Textures use `'linear'` filtering by default. Set `TextureSource.defaultOptions.scaleMode = 'nearest'` before loading, or `sheet.textureSource.scaleMode = 'nearest'` afterwards. Then use `roundPixels: true` and whole-number scales. `SCALE_MODES.NEAREST` from v7 no longer exists in v8.

### Why is my @2x spritesheet drawn at double size in PixiJS 8? {#faq-2x-double-size}

PixiJS 8 takes the texture resolution from `meta.scale`. An @2x image whose JSON says `"scale": "1"` is treated as 1x, so every frame is twice as big. Set `"scale": "2"` in that JSON.

### How do I set a different duration for each frame in PixiJS? {#faq-frame-duration}

Pass objects instead of textures: `new AnimatedSprite([{ texture, time: 300 }, { texture: next, time: 100 }])`. `time` is in milliseconds and is still multiplied by `animationSpeed`.

### Why are animations from a multi-pack spritesheet undefined? {#faq-multipack-undefined}

`sheet.animations` only looks up frames on its own page. Frames on the linked pages are in the texture cache, so build the animation with `names.map(n => Texture.from(n))` after `await Assets.load`, or keep each animation on one page.

## Sources {#sources}

- [PixiJS API: Spritesheet](https://pixijs.download/release/docs/assets.Spritesheet.html) — JSON format, `animations`, anchors, TexturePacker note (v8 release docs)
- [PixiJS API: AnimatedSprite](https://pixijs.download/release/docs/scene.AnimatedSprite.html) — `animationSpeed`, `loop`, `onComplete`, `updateAnchor`, FrameObject
- [PixiJS guide: Assets](https://pixijs.com/8.x/guides/components/assets) and [Resolver](https://pixijs.com/8.x/guides/components/assets/resolver) — `Assets.load`, `Assets.init`, resolution patterns (8.x)
- [PixiJS guide: Textures](https://pixijs.com/8.x/guides/components/textures) — `TextureSource`, `scaleMode` (8.x)
- [PixiJS v8 Migration Guide](https://pixijs.com/8.x/guides/migrations/v8) — `SCALE_MODES.NEAREST` → `'nearest'`, async `app.init`, `app.canvas`
- [Kenney Pixel Platformer](https://kenney.nl/assets/pixel-platformer) — CC0 art used in the tests
