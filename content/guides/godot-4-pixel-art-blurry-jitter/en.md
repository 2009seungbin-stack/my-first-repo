Pixel art looks blurry in Godot 4 because 2D textures are drawn with **Linear** filtering by default. Set **Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter** to **Nearest** to fix it. Jitter and shimmering pixels come from scaling by non-whole factors and from sprites or the camera sitting between pixels. To fix that, set **Display → Window → Stretch** to **Mode** `viewport` and **Scale Mode** `integer` (Godot 4.2+), turn on **Rendering → 2D → Snap → Snap 2D Transforms to Pixel**, and move the camera in whole pixels.

Every setting and number below was checked in Godot 4.7.2 with the gl_compatibility renderer. The pictures are real Godot renders of Kenney's CC0 Pixel Platformer and Tiny Dungeon art. One thing is new in Godot 4.7: projects created with it start with **Stretch Mode** `canvas_items` and **Aspect** `expand`, so check these settings even in a new project.

## Make pixel art sharp and stable {#steps}

:::steps
1. **Set the texture filter to Nearest.** Open **Project → Project Settings**, go to **Rendering → Textures → Canvas Textures** and set **Default Texture Filter** to **Nearest**. Every node left on **Inherit** now draws texels as hard squares. To change a single node instead, set its **CanvasItem → Texture → Filter** to **Nearest**.
2. **Check the import settings.** Select the PNG in the FileSystem dock and open the **Import** dock. **Compress → Mode** should be **Lossless** (the default) and **Mipmaps → Generate** off (the default). Never use **VRAM Compressed** for pixel art. If you changed anything, click **Reimport**.
3. **Pick a base resolution.** Under **Display → Window → Size**, set **Viewport Width** and **Viewport Height** to your game's pixel resolution, for example 320×180 or 640×360. Both scale evenly to 1280×720, 1920×1080 and 2560×1440. For a bigger window at start-up, set **Window Width Override** and **Window Height Override** (for example 1280×720).
4. **Stretch in whole steps.** Under **Display → Window → Stretch**, set **Mode** to `viewport`, **Aspect** to `keep` (black bars) or `expand` (more of the world on wider screens), and **Scale Mode** to `integer`. The game then renders at the base resolution and is scaled up 2×, 3×, 4× and so on, never 3.125×.
5. **Snap sprites to pixels.** Under **Rendering → 2D → Snap**, turn on **Snap 2D Transforms to Pixel**. Leave **Snap 2D Vertices to Pixel** off: the docs advise against using both. Like the stretch settings, snapping is only read when the game starts.
6. **Move the camera in whole pixels.** Turn off **Position Smoothing** on the Camera2D that follows the player and place the camera on the player's rounded position (script below). Smoothing always leaves the camera between pixels.
7. **Remove stutter on high-refresh screens.** If motion looks uneven at 120/144 Hz, turn on **Physics → Common → Physics Interpolation** (Godot 4.3+ for 2D). Move your bodies in `_physics_process()`, then test the camera again.
:::

![The same two Kenney characters at 6×: on the left with Linear filtering, soft and smeared; on the right with Nearest, every pixel a hard square](shot:engine-godot-pixel-linear-vs-nearest "Rendered by Godot 4.7.2 (gl_compatibility): Sprite2D at 6× with texture_filter Linear (left) and Nearest (right). Art: Kenney Pixel Platformer, CC0.")

## All the settings in one place {#project-godot}

If you prefer editing the file, these are the lines the steps above write to `project.godot`. Godot 4.7.2 loads them without changes. At a 1000×600 window, the root viewport then drew the 320×180 game at exactly 3× with 20 px and 30 px bars; with `scale_mode="fractional"` the same window gave 3.125×.

```ini
[display]

window/size/viewport_width=320
window/size/viewport_height=180
window/size/window_width_override=1280
window/size/window_height_override=720
window/stretch/mode="viewport"
window/stretch/aspect="keep"
window/stretch/scale_mode="integer"

[rendering]

textures/canvas_textures/default_texture_filter=0
2d/snap/snap_2d_transforms_to_pixel=true
```

`default_texture_filter=0` is Nearest; the default, 1, is Linear. With integer scaling, a window smaller than the base size cuts off the game. Set the root window's `min_size` to the base size if players can resize the window.

## Why pixel art turns blurry {#why-blurry}

- **Filtering is a property of the node, not of the image.** Every CanvasItem has a **Texture → Filter**. **Inherit**, the default, takes the parent's filter, and at the top the viewport's filter, which comes from the project setting.
- **SubViewports have their own filter.** A new SubViewport's **Canvas Item Default Texture Filter** is **Linear**, whatever the project setting says (checked in 4.7.2). If you render the game into a SubViewport, for a CRT effect or split screen, set it to **Nearest** there too.
- **Compression and mipmaps.** VRAM compression adds block artifacts and colour shifts. Mipmaps with **Nearest Mipmap** filters make sprites smeary when the camera zooms out. In the Import dock, the **2D** preset keeps a texture on Lossless even if something uses it in 3D. The default **2D/3D (Auto-Detect)** preset switches such textures to VRAM Compressed.
- **The art is already soft.** No engine setting can fix a sprite that was resized with smoothing before import, or scaled by 2.5× in a paint program. Check the file itself (see [the Nerulio block](#nerulio)).

## Why pixel art jitters or shimmers {#why-jitter}

"Jitter" is three different problems. Fix them in this order.

**1. Uneven pixel sizes (shimmer).** At a non-whole scale, some source pixels become 3 screen pixels wide and others 2. When the camera moves, the thick and thin columns travel across the sprite and it seems to crawl. `Scale Mode = integer` removes this, at the cost of black bars.

![A 96×56 px view scaled 2.5× on the left, where lines and outlines come out 2 or 3 px thick, and 3× on the right, where every pixel is the same size](shot:engine-godot-pixel-fractional-vs-integer "Rendered by Godot 4.7.2: one 96×56 SubViewport shown with Nearest at 2.5× (left) and 3× (right), enlarged 2× with nearest-neighbour after capture. Art: Kenney Tiny Dungeon and Pixel Platformer, CC0.")

**2. The player shakes against the background (sub-pixel camera).** In a low-resolution viewport, every sprite and the camera are rounded to whole pixels on their own. When a smoothed camera trails the player by a fractional distance, the two roundings disagree from frame to frame and the player hops back and forth by one pixel. We rendered a 96×56 viewport with **Snap 2D Transforms to Pixel** on while the player walked at a steady speed. With the built-in **Position Smoothing**, the player's screen position changed on 78 of 180 frames, always between the same two columns. With a camera placed on the player's rounded position, it never changed:

```gdscript
# pixel_camera.gd - a Camera2D that follows a target on whole pixels (no smoothing).
# Put it below the target in the scene tree so it runs after the target has moved.
extends Camera2D

@export var target: Node2D

func _ready() -> void:
	position_smoothing_enabled = false
	process_callback = Camera2D.CAMERA2D_PROCESS_PHYSICS

func _physics_process(_delta: float) -> void:
	global_position = target.global_position.round()
```

If you want a smooth, trailing camera in a low-resolution game, you need the "sub-pixel camera" technique. Render the game into a SubViewport one pixel larger than the screen, keep the camera on whole pixels, and shift the scaled-up image by the leftover fraction × the scale factor. Godot has no built-in switch for it.

**3. Stutter from mismatched update rates.** Physics runs 60 ticks per second. A 144 Hz monitor shows some ticks for two frames and others for three, so motion looks uneven even with perfect pixels. It gets worse when the player moves in `_physics_process()` and a smoothed Camera2D updates every frame (its default **Process Callback** is **Idle**). In a 144 fps test, the player's on-screen position reversed direction 238 times in 288 frames. With the camera's **Process Callback** set to **Physics**, it reversed 0 times. **Physics Interpolation** (Godot 4.3+) goes further and draws bodies between two ticks. With it on, Camera2D switches itself to physics updates and interpolates too (Godot prints "Camera2D overridden to physics process mode due to use of physics interpolation"). Call `reset_physics_interpolation()` after teleporting a node so it doesn't glide.

## canvas_items or viewport? {#stretch-modes}

| | `viewport` | `canvas_items` |
|---|---|---|
| Renders at | The base resolution, then scaled up | The window resolution |
| Pixels | Always whole game pixels (true low-res) | Rotated or scaled sprites can use smaller "mixels" |
| Text, UI | Pixel-sized, like the art | Sharp at any size |
| Docs recommend it for | Pixel-art games | Most non-pixel games, some pixel games |

Both work with `integer` scale mode and Nearest filtering. Use `viewport` if everything must sit on the same pixel grid. Use `canvas_items` if you want high-resolution text, smooth rotation or zoom. New Godot 4.7 projects start with `canvas_items`.

## Pixel fonts {#pixel-fonts}

Labels are CanvasItems, so the Nearest filter applies to them too. For a TTF/OTF pixel font, select it in the FileSystem dock and in the **Import** dock:

- Set **Antialiasing** to **Disabled** if the font is not drawn at a whole multiple of its design size.
- Since Godot 4.4, **Hinting** and **Subpixel Positioning** default to "(Except Pixel Fonts)" modes, which switch both off for fonts whose glyphs are made only of straight horizontal and vertical lines. On older versions, set **Subpixel Positioning** to **Disabled** yourself.
- Use font sizes that are multiples of the size the font was drawn for (8, 16, 24 … for an 8 px font).

The **GUI → Theme** default-font settings only affect Godot's built-in font, not fonts you import. For bitmap fonts made from a sprite sheet, see [bitmap and SDF fonts for game UI](guide:bitmap-font-sdf-msdf-game-ui).

## Version notes {#versions}

- **Godot 4.0+:** **Default Texture Filter** under Canvas Textures, and **Snap 2D Transforms/Vertices to Pixel**.
- **4.2:** **Stretch → Scale Mode** (`fractional`/`integer`) added.
- **4.3:** built-in **Physics Interpolation** for 2D.
- **4.4:** font import defaults detect pixel fonts ("Except Pixel Fonts" modes).
- **4.7:** new projects start with **Stretch Mode** `canvas_items`, **Aspect** `expand`. SpriteFrames gain a ping-pong loop mode.

:::nerulio tool=pixel-perfect-checker
When the sprite itself is the problem, the Pixel Perfect Checker tells you. It measures the pixel scale and grid offset of an image, counts in-between edge colours, and only offers **Recover 1× source** when an exact block grid exists. Our Kenney character scaled 3× nearest read "Integer pixel grid found · 3×". At 2.5× nearest it read "No integer grid — non-integer scaling · estimated ≈ 2.547×". After a bilinear 3× resize it read "Resampled ≈2.98×", with 61.5% of edge pixels intermediate.

- Drop the sprite or frames on the page and open **Check**. Everything runs on your device.
- Export clean 1× frames, or a whole-number upscale with **Export scale (nearest)**.
- For Godot, [Pack & Export](studio:pack) writes a SpriteFrames bundle whose scene node is set to Nearest. Its `.png.import` files are Lossless with no mipmaps, and alpha-border fixing is off so faint pixels keep their colour. It was loaded in Godot 4.7.2. The project-wide filter and stretch settings are still yours to set (steps 1–5).
:::

## FAQ {#faq}

### Why is my pixel art blurry in Godot 4?

2D nodes use Linear filtering by default, which blends neighbouring texels. Set **Rendering → Textures → Canvas Textures → Default Texture Filter** to **Nearest**, and check that SubViewports and nodes with their own **Texture → Filter** are set to Nearest too.

### Where is the texture filter setting in Godot 4?

It is no longer an import option, as it was in Godot 3. It is set per CanvasItem (**Texture → Filter**), per Viewport (**Canvas Item Default Texture Filter**), and project-wide under **Project Settings → Rendering → Textures → Canvas Textures → Default Texture Filter**.

### How do I get integer scaling in Godot 4?

Set **Display → Window → Stretch → Scale Mode** to `integer` (Godot 4.2 and later), with **Stretch Mode** `viewport` or `canvas_items`. The scale is then rounded down to a whole number, and the remaining space becomes black bars.

### Why does my player jitter when the camera moves?

The camera and the player are rounded to pixels separately, or they update at different rates. Put the Camera2D on the player's rounded position without smoothing, or set its **Process Callback** to **Physics**. Enable **Physics Interpolation** if the monitor refresh rate differs from the physics tick rate.

### Should I use Snap 2D Transforms or Snap 2D Vertices to Pixel?

Use **Snap 2D Transforms to Pixel**. The Godot docs recommend enabling only that one, because using both makes movement look even less smooth.

## Sources {#sources}

- [ProjectSettings](https://docs.godotengine.org/en/4.7/classes/class_projectsettings.html) — Godot 4.7 class reference (default_texture_filter, stretch mode/aspect/scale_mode, snap_2d_*, physics_interpolation)
- [Multiple resolutions](https://docs.godotengine.org/en/4.7/tutorials/rendering/multiple_resolutions.html) — Godot 4.7 manual (pixel art: viewport, keep/expand, integer)
- [Importing images](https://docs.godotengine.org/en/4.7/tutorials/assets_pipeline/importing_images.html) and [ResourceImporterTexture](https://docs.godotengine.org/en/4.7/classes/class_resourceimportertexture.html) — Godot 4.7
- [CanvasItem](https://docs.godotengine.org/en/4.7/classes/class_canvasitem.html) and [Viewport](https://docs.godotengine.org/en/4.7/classes/class_viewport.html) — Godot 4.7 class reference (texture_filter, canvas_item_default_texture_filter)
- [Camera2D](https://docs.godotengine.org/en/4.7/classes/class_camera2d.html) — Godot 4.7 class reference (process_callback, position smoothing)
- [Using physics interpolation](https://docs.godotengine.org/en/4.7/tutorials/physics/interpolation/using_physics_interpolation.html) — Godot 4.7 manual
- [ResourceImporterDynamicFont](https://docs.godotengine.org/en/4.7/classes/class_resourceimporterdynamicfont.html) — Godot 4.7 class reference (antialiasing, hinting, subpixel positioning)
- [editor_node.cpp at 4.7.2-stable](https://github.com/godotengine/godot/blob/4.7.2-stable/editor/editor_node.cpp) — `get_initial_settings()`: new-project stretch defaults
