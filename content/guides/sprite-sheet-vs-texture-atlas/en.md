A **sprite sheet** is one image of frames laid out on a uniform grid: every frame has the same size, so an engine can find frame *n* from the cell size alone and no data file is needed. A **texture atlas** packs images of any size as tightly as possible and ships a data file (JSON, XML, `.atlas`, `.tres`) that records each frame's rectangle, its trim offset and sometimes a 90° rotation. Use a grid sheet for small, same-size animations; use a packed atlas once frames differ in size, carry a lot of empty space, or you want many sprites to share one texture and one draw call. Whatever you pack, keep the trim offsets, and enable rotation only if every engine you target reads rotated frames: PixiJS and Spine do, Phaser and Godot do not.

The engine behaviour on this page was reproduced with one test atlas made from Kenney's CC0 *Space Shooter Redux* art, loaded in Phaser 3.90.0, Phaser 4.2.1, PixiJS 8.21.0, the Spine 4.2 canvas runtime and Godot 4.7.2.

## Sprite sheet or atlas: the difference {#difference}

| | Grid sprite sheet | Packed texture atlas |
|---|---|---|
| Layout | Equal cells, optional margin and spacing | Any sizes, placed by a packer (MaxRects, Skyline…) |
| Data file | None (cell size, margin, spacing) | Required: rectangle, trim offset, rotation, pivot |
| Empty pixels | Every cell keeps its transparent border | Trimmed away, so pages are smaller |
| Setting it up in the engine | Grid slicer (`load.spritesheet`, Godot's grid, Unity *Grid By Cell Size*) | The engine's atlas loader or importer |
| Best for | Pixel-art characters and tiles of one size | Mixed sizes, VFX, UI, many characters on one page |

The two are not exclusive. Many projects draw animations as grid strips in Aseprite, then pack every strip's frames into one atlas at build time. Tilesets stay grids, because tilemap editors address tiles by grid index (see [tile seams and extrude](guide:tile-seams-texture-bleeding-padding-extrude)).

## Pack an atlas that loads correctly everywhere {#steps}

:::steps
1. **Pick the page size first.** Set a maximum page size your weakest target can load. OpenGL ES 3.0, and so WebGL 2, only guarantees 2048 px per side; many devices allow more, so read the real limit at runtime. Turn on multipack if the frames do not fit on one page.
2. **Trim, and keep the offsets.** Choose the trim mode that removes transparent borders but keeps the original frame size and offset (TexturePacker *Trim*, Nerulio *Trim (keep size and position)*). Do not use a crop mode for animation frames.
3. **Leave rotation off unless every target reads it.** Rotation saves little space and breaks silently in Phaser and Godot (see [the rotation table](#rotation)).
4. **Set padding for how the atlas will be sampled.** For nearest-filtered pixel art without mipmaps, use 2 px shape padding and 1 px extrude. For filtered, scaled or mipmapped art, use 4–8 px and extrude or alpha bleed.
5. **Store identical frames once.** Turn on alias detection (TexturePacker *Detect identical sprites*, libGDX `alias`, Nerulio *Store identical frames once*). Held frames and ping-pong loops then cost no extra pixels.
6. **Choose the size constraint.** Use power-of-two only when a target needs it: WebGL 1 with mipmaps or repeat, or older compressed formats. Otherwise *Smallest* or *Any size* wastes less.
7. **Export in the engine's own format and load it with the standard loader.** Examples: Phaser `this.load.atlas`, PixiJS `Assets.load`, a Godot `SpriteFrames` of `AtlasTexture`s, a libGDX/Spine `.atlas`.
8. **Check every frame at full size.** Draw each frame at its original source size over a solid background colour and compare it with the source image. A misplaced trimmed frame or a sideways rotated frame shows up at once.
:::

## Trimming: why the offsets must survive {#trimming}

Trimming cuts the transparent border off each frame before packing. That only works if the atlas also records where the art sat inside the original frame. Otherwise every frame of a walk cycle re-centres on its own bounding box and the character jitters, or its feet drift off the ground. TexturePacker-style JSON stores three things per frame:

- `frame`: the rectangle on the atlas page.
- `spriteSourceSize`: where the trimmed art sits inside the original frame (`x`, `y`).
- `sourceSize`: the size of the original frame. With `"trimmed": true`, Phaser and PixiJS draw the sprite as if it still had its full size.

In our test a 128×112 frame was trimmed to its 99×75 ship. It was drawn at the right place, pixel for pixel, in Phaser 3.90, Phaser 4.2 and PixiJS 8.21. Starling/Sparrow XML stores the same information as `frameX`/`frameY` (negative offsets) plus `frameWidth`/`frameHeight`.

> **Phaser 3.90 and trimmed Sparrow XML:** Phaser 3.90's `atlasXML` parser passes the sizes to `setTrim` in the wrong order. A trimmed XML frame reports its trimmed size (99×75 instead of 128×112) and lands in the wrong place when the sprite uses the default centred origin. Phaser 4.2 fixed the parser. For Phaser 3, use JSON, or export XML without trimming.

Godot's `AtlasTexture` expresses the same thing with `margin`. Its position is the trim offset, and its size is the original size minus the region size:

```gdscript
# Restore a trimmed atlas frame in Godot 4 (checked in Godot 4.7.2).
# The ship's source frame was 128x112; the trimmed art (99x75) is stored at (105, 2)
# on the atlas and sat at (10, 20) inside the original frame.
var frame := AtlasTexture.new()
frame.atlas = preload("res://atlas.png")
frame.region = Rect2(105, 2, 99, 75)
frame.margin = Rect2(10, 20, 128 - 99, 112 - 75)  # offset, then source size - region size
print(frame.get_size())  # (128.0, 112.0): the sprite behaves like the untrimmed frame
```

Drawn with a `Sprite2D`, this frame matched the untrimmed source image with 0 differing pixels.

The *crop* modes are different. *Crop, keep position* makes the frame smaller and moves the pivot so the art stays put. *Crop, flush position* forgets the offset entirely. Both are fine for static props and icons, but they are the classic cause of animation jitter. For the pivot side of this, see [hitboxes and pivots](guide:hitboxes-pivots-2d-animation).

## Rotation: which engines read rotated frames {#rotation}

With rotation on, a packer may store a frame turned 90° to fit it into a gap. The engine then has to turn it back. In TexturePacker's JSON, `"rotated": true` means the frame is stored rotated 90° clockwise, and `frame.w`/`frame.h` keep the upright size. The Spine/libGDX `.atlas` format uses the opposite direction: `rotate: true` (or `90`) means stored 90° counter-clockwise. Starling XML's `rotated="true"` means clockwise.

| Engine or format | Reads rotated frames? | What we saw |
|---|---|---|
| PixiJS 8.21 (TexturePacker JSON) | Yes | Clockwise frames drawn upright and exact. A counter-clockwise control frame came out wrong, which confirms the convention. |
| Phaser 3.90 and 4.2 (JSON hash, `atlasXML`) | No | Loaded without error, drawn sideways and clipped. We tried both frame-size conventions. `atlasXML` ignores `rotated` completely. |
| Spine runtimes / libGDX `.atlas` | Yes (counter-clockwise) | spine-canvas 4.2 drew `rotate: 90` regions upright. libGDX's packer ships with `rotation` off and warns that apps must draw rotated regions specially. |
| Godot 4.7 | No | `AtlasTexture` has only `atlas`, `region`, `margin` and `filter_clip`, with no rotation field. TexturePacker's own Godot importer tells you not to rotate. |
| Unity 6 | Only inside its own Sprite Atlas | *Allow Rotation* is a Sprite Atlas option; Unity's manual says to disable it for Canvas UI. An external atlas sliced into sprite rectangles cannot be rotated. |
| LÖVE, Defold, GameMaker | Not from a pre-packed atlas | A LÖVE `Quad` is a plain rectangle. Defold and GameMaker build their own texture pages from the separate images you give them. |

![Engine renders of the same atlas: source frames, PixiJS 8.21, Phaser 3.90 and Phaser 4.2](shot:engine-atlas-rotation "Rendered by PixiJS 8.21, Phaser 3.90 and Phaser 4.2 in Chromium from one TexturePacker-style JSON atlas: 1 untrimmed, 2 trimmed, 3 trimmed and stored 90° clockwise, 4 a rotated laser. Only PixiJS turns the rotated frames back. Art: Kenney, CC0.")

If even one target is on the "no" side, pack without rotation. In most frame sets the size you save is small.

## Padding, extrude and mipmaps {#padding}

Three settings keep neighbouring sprites from leaking into each other:

- **Border padding:** empty pixels between the sprites and the edge of the page.
- **Shape padding:** empty pixels between sprites. TexturePacker's docs recommend at least 2 for OpenGL rendering.
- **Extrude:** repeats each sprite's edge pixels outward, so a sample that lands just outside the rectangle still gets the sprite's own colour, not a transparent gap or a neighbour. Unity's *Alpha Dilation* and libGDX's `bleed` fill the colour under transparent pixels for the same reason.

Leaks come from sampling. Linear filtering blends each pixel with its neighbours. Sub-pixel camera positions and non-integer scales sample across the rectangle's edge. Mipmaps average 2×2 blocks per level, so a 2 px gap is 1 texel wide at mip level 1 and gone at level 2. The deeper the mip levels you actually reach, the wider the gap has to be. GameMaker's texture groups default to a 2 px border and force 8 px when mipmaps are on, and Unity's Sprite Atlas defaults to 4 px of padding.

| Art and sampling | Shape padding | Extrude / bleed |
|---|---|---|
| Pixel art, nearest filter, no mipmaps, integer scale | 2 px | 1 px, which also covers a camera at sub-pixel positions |
| Tiles drawn edge to edge | 2 px | 1–2 px (the fix for seams) |
| Smooth art, linear filter, no mipmaps | 2–4 px | 1–2 px or alpha bleed |
| Mipmapped or strongly downscaled art | 8 px or more | Alpha bleed, and padding that grows with the mip levels used |

## Page size: POT, NPOT and the maximum texture size {#page-size}

- **Maximum size.** The OpenGL ES 3.0 spec only promises `GL_MAX_TEXTURE_SIZE` ≥ 2048. On this test machine Chromium reported 16384 through the AMD GPU and 8192 through its SwiftShader software renderer. libGDX's packer defaults to 1024 ("safe for all devices") and TexturePacker to 2048. Check the real value at runtime rather than guessing.
- **Memory.** An uncompressed RGBA8888 page costs width × height × 4 bytes: 16 MiB for 2048², 64 MiB for 4096². A half-empty power-of-two page costs the same as a full one.
- **Power of two.** WebGL 1 cannot mipmap or repeat a non-power-of-two texture; WebGL 2 and current desktop and mobile APIs can. Block-compressed formats work in 4×4 blocks, which is why packers offer *multiple of 4*. Use POT only when a target needs it.
- **Multipack.** When frames do not fit on one page, the packer writes several:
  - Phaser loads them with `load.multiatlas`.
  - PixiJS follows `meta.related_multi_packs`.
  - Defold's *Max Page Size* splits an atlas into pages that still render in one draw call, with the `*_paged_atlas.material` materials.
  - Keep each animation on one page, so a playing sprite never switches textures mid-loop.

```js
// Ask the renderer instead of guessing (both lines were run in Chromium).
const phaserMax = this.game.renderer.getMaxTextureSize();                 // Phaser 3.90 / 4.2, inside a Scene
const pixiMax = app.renderer.gl.getParameter(app.renderer.gl.MAX_TEXTURE_SIZE); // PixiJS 8, WebGL renderer
```

## Draw calls and batching {#batching}

A GPU draw call can only sample the textures bound to it. Every time the next sprite needs a texture that is not bound, the renderer ends the batch and starts another. We counted real WebGL draw calls for 200 sprites that cycle through 40 different images:

| Engine | 40 separate textures | Same 40 images as frames of one atlas |
|---|---|---|
| Phaser 3.90 | 13 draw calls | 1 |
| Phaser 4.2 | 13 draw calls | 1 |
| PixiJS 8.21 | 7 draw calls | 1 |

Modern web renderers already batch several textures per draw call, so the gap is smaller than older advice suggests, but an atlas still turns many calls into one. Unity makes the same point in its manual: a sprite atlas lets Unity use one draw call for all the sprites in it. Draw order matters too. Sprites from two atlases that alternate in depth order still break the batch, so put things drawn together on the same page.

## Which format each engine reads {#formats}

| Engine | Packed atlas format | How it is loaded |
|---|---|---|
| Phaser 3 / 4 | TexturePacker JSON hash or array; multiatlas JSON; Starling/Sparrow XML | `load.atlas`, `load.multiatlas`, `load.atlasXML` ([Phaser guide](guide:phaser-sprite-sheet-atlas-animation)) |
| PixiJS 8 | TexturePacker JSON hash with `animations`, `meta.scale`, `related_multi_packs` | `Assets.load('atlas.json')` → `Spritesheet` ([PixiJS guide](guide:pixijs-8-spritesheet-animation)) |
| Godot 4 | `SpriteFrames` of `AtlasTexture` (region + margin); the built-in *Import As: TextureAtlas*; TexturePacker's plugin | `.tres` resources ([Godot guide](guide:godot-4-sprite-sheet-animation)) |
| Unity 6 | Sprite Atlas asset (Unity packs), or one texture in Sprite Mode *Multiple* with sprite rectangles | Sprite Atlas / Sprite Editor |
| libGDX, Spine | `.atlas` text (`bounds`, `offsets` from the bottom, `rotate`) | `TextureAtlas` / the Spine runtime |
| Defold | `.atlas` built by Defold from your images | Atlas resource ([Defold guide](guide:defold-atlas-tile-source-flipbook)) |

Godot's built-in *TextureAtlas* import mode is worth knowing. Give several PNGs the same `atlas_file` and Godot packs them into one image and turns each into an `AtlasTexture`. `trim_alpha_border_from_region` is on by default, and a *Mesh* mode makes polygon meshes for large, mostly transparent sprites.

:::nerulio ws=pack
Nerulio's Pack & Export workspace packs every frame of your project in the browser: nothing is uploaded, and the same frames go to every engine.

- **Packer.** Pick MaxRects, Skyline or Guillotine (or let it try them all). The page size can be POT, square, fixed or smallest, with multipack up to 64 pages.
- **Trim modes.** *None*, *Trim (keep size and position)*, *Crop, keep position* and *Crop*, with an alpha threshold.
- **Padding and identical frames.** Shape padding (2 px by default), border padding and extrude; *Store identical frames once* is on by default. Scale variants (@0.5x–@4x) are nearest-neighbour, so pixel art stays sharp.
- **Engine presets.** Each preset turns rotation off where the engine cannot read it: Godot, Unity, Phaser and LÖVE are refused, while PixiJS and Spine are allowed.
- **Export check.** The export line tells you how each format was checked, for example "Loaded in Godot 4.7.2". GameMaker strips are marked UNVERIFIED because no GameMaker was available to test them.
:::

![Nerulio Pack & Export: packed atlas page with trim, padding and extrude settings and the used percentage](shot:studio-pack-atlas "Nerulio Pack & Export: one packed page, per-frame trim sizes and the settings that produced it.")

![Nerulio Pack & Export: engine list with a Loaded in Godot 4.7.2 verification line](shot:studio-pack-export "Each export target shows how it was verified; GameMaker is marked UNVERIFIED.")

## FAQ {#faq}

### Is a sprite sheet the same thing as a texture atlas?

People use the words loosely, but a sprite sheet usually means equal grid cells that need no data file. A texture atlas means tightly packed images of any size plus a data file with each frame's rectangle and offsets. Both put many images on one texture.

### Why does my character jitter after packing the frames?

The frames were cropped and the offsets were lost, or the loader ignored them. Pack with a trim mode that keeps `sourceSize` and `spriteSourceSize` (Godot: `AtlasTexture.margin`), and do not use *crop* modes for animation frames.

### Should I allow rotation in TexturePacker for Phaser or Godot?

No. Phaser 3.90 and 4.2 load `"rotated": true` frames but draw them sideways, and Godot's `AtlasTexture` has no rotation field. PixiJS 8 and Spine/libGDX runtimes read rotated frames correctly.

### What padding and extrude should I use for pixel art?

With nearest filtering, no mipmaps and integer scaling, use 2 px of shape padding and 1 px of extrude. Tiles and anything drawn at sub-pixel camera positions benefit most from the extrude. Mipmapped art needs 8 px or more, plus alpha bleed.

### What is the maximum atlas size I can use?

OpenGL ES 3.0 and WebGL 2 only guarantee 2048×2048. Many GPUs accept more; this test machine reported 16384. Read `MAX_TEXTURE_SIZE` at runtime, and keep pages at 2048 if you target low-end mobile or unknown browsers.

## Sources {#sources}

- TexturePacker documentation, *Texture settings* (trim modes, padding, extrude, rotation, max size, multipack): https://www.codeandweb.com/texturepacker/documentation/texture-settings
- libGDX wiki, *Texture packer* (settings and defaults: `paddingX`, `rotation`, `alias`, `bleed`, `maxWidth` 1024): https://libgdx.com/wiki/tools/texture-packer
- Spine, *Atlas export format* (`bounds`, `offsets`, `rotate`): https://esotericsoftware.com/spine-atlas-format
- Starling API, `TextureAtlas` (XML format, `frameX`, `rotated`): https://doc.starling-framework.org/current/starling/textures/TextureAtlas.html
- Godot 4 class reference, `AtlasTexture`: https://docs.godotengine.org/en/stable/classes/class_atlastexture.html
- Godot 4 class reference, `ResourceImporterTextureAtlas`: https://docs.godotengine.org/en/stable/classes/class_resourceimportertextureatlas.html
- TexturePacker importer for Godot 4 (rotation not supported): https://github.com/CodeAndWeb/texturepacker-godot-plugin
- Unity 6 Manual, *Packing sprites into atlas textures*: https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/atlas/atlas-landing.html
- Unity 6 Manual, *Sprite Atlas Inspector window reference*: https://docs.unity3d.com/6000.3/Documentation/Manual/sprite/atlas/sprite-atlas-reference.html
- Phaser API, `LoaderPlugin` (`atlas`, `atlasXML`, `multiatlas`): https://docs.phaser.io/api-documentation/class/loader-loaderplugin
- PixiJS 8 guide, *Spritesheets*: https://pixijs.com/8.x/guides/components/sprite-sheets
- Defold manual, *Atlas* (margin, inner padding, extrude borders, max page size): https://defold.com/manuals/atlas/
- GameMaker manual, *Texture Groups* (border size, mipmaps): https://manual.gamemaker.io/monthly/en/Settings/Texture_Groups.htm
- LÖVE wiki, `love.graphics.newQuad`: https://love2d.org/wiki/love.graphics.newQuad
- MDN, *Using textures in WebGL* (WebGL 1 non-power-of-two limits): https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Tutorial/Using_textures_in_WebGL
- Khronos, OpenGL ES 3.0 `glGet` (`GL_MAX_TEXTURE_SIZE` at least 2048): https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glGet.xhtml
