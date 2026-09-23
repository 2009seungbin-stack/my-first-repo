Use a **bitmap font** (a BMFont `.fnt` plus a PNG) when text is drawn at one known size, and always for pixel fonts, which must be drawn at whole multiples of their design size with antialiasing off and nearest filtering. Use an **SDF** font when the same text has to scale or needs cheap outlines and glows, and **MSDF** when it must also keep sharp corners at large sizes. In Godot 4.7 that is the *Multichannel Signed Distance Field* import option; Unity 6 font assets are SDF by default; PixiJS 8 reads SDF/MSDF from a BMFont file with a `distanceField` entry; Phaser's BitmapText is plain bitmap only.

Every image below was rendered by the engine named in its caption.

![Five ways to draw the same UI text in Godot 4.7.2](shot:engine-godot-font-modes "Rendered by Godot 4.7.2 (Compatibility renderer). A: pixel font with antialiasing, hinting and subpixel positioning off, 16 px at 3×. B: same font at 20 px, default import: uneven pixels. C: raster font scaled 6×: blurry. D: BMFont baked at 12 px, 6× nearest: blocky. E: same TTF with MSDF: sharp at 6× with a 2 px outline. Fonts: Kenney Pixel, Kenney Future (CC0).")

## How bitmap, SDF and MSDF fonts work {#how-they-work}

All three draw glyphs from a texture atlas. What differs is what a texel means.

| Format | Texel stores | Scaled up | Outline, glow, shadow | Texture cost |
|---|---|---|---|---|
| Bitmap | Coverage at one size | Blurry (linear) or blocky (nearest) | Baked into the image | One atlas per size and style |
| SDF | Distance to the edge, one channel | Smooth, but corners round off | Free in the shader | One atlas for all sizes, padded cells |
| MSDF | Three distances (R, G, B); the median is the edge | Smooth **and** sharp corners | Free in the shader | Like SDF, three channels |

A bitmap glyph is final pixels: exact at its baked size, wrong at any other. A signed distance field stores how far each texel is from the outline, and the shader rebuilds the edge where that distance crosses zero, at any scale. One channel cannot describe a corner (the field around it is round), so SDF rounds corners when magnified. MSDF spreads the edges over three channels and takes their median, which keeps the corner.

![Bitmap, SDF and MSDF fonts compared in PixiJS 8.21](shot:engine-pixi-sdf-msdf "Rendered by PixiJS 8.21.0 (WebGL) in Chromium. Bitmap font baked at 12 px: fine at 12 px, blurry at 72 px. SDF and MSDF atlases built at 32 px by msdf-atlas-gen 1.4: smooth at 72 px. Bottom: Kenney Pixel at 240 px; SDF rounds the square corners, MSDF keeps them. Fonts: Kenney Future, Kenney Pixel (CC0).")

## Set up sharp UI text {#set-up}

:::steps
1. **List the sizes.** Note the smallest and largest on-screen pixel size of each text style, whether the UI or camera scales, and which effects you need. One fixed size and no effects: bitmap. Zoom, scale tweens or big titles: SDF or MSDF.
2. **Pick the format.** Pixel font: bitmap, or a dynamic font with antialiasing off. Body text at a few fixed sizes: bitmap or the engine's dynamic font. Scaling text with outlines: SDF. Large titles and fonts with sharp corners: MSDF.
3. **Bake only the characters you use,** plus ASCII for numbers and names inserted at runtime. For Korean, Japanese or Chinese see [CJK font atlases from localisation files](guide:cjk-font-atlas-localization).
4. **Import with the right settings.** Godot: select the font, set the Import dock options below, click **Reimport**. Unity: **Window > TextMesh Pro > Font Asset Creator** with the render mode you chose.
5. **Draw at the size the atlas expects.** Bitmap fonts at their baked size or whole multiples of it, with nearest filtering for pixel fonts. SDF and MSDF at any size.
6. **Put outlines and shadows in the renderer** for SDF/MSDF text; bake them into the image only for bitmap fonts.
7. **Check the real resolution,** including 125 % and 150 % display scaling. A pixel font that is crisp at 16 px is uneven at 20 px.
:::

## Pixel fonts: integer sizes, no antialiasing {#pixel-fonts}

A pixel font is drawn on a grid of font units. It is crisp only when each grid cell lands on exactly one screen pixel. Kenney Pixel is designed on a 16 px grid, so 16, 32 and 48 px are crisp and 20 px is not (row B above: some pixels one screen pixel wide, some two). Godot's documentation puts it the same way: the font size must be an integer multiple of the design size, and the Control must be scaled by an integer too.

In Godot 4.7, select the `.ttf` and set in the **Import** dock:

- **Antialiasing:** None (options None, Grayscale, LCD Subpixel; default Grayscale).
- **Hinting:** None. **Subpixel Positioning:** Disabled.
- **Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter:** Nearest (or **Texture Filter** = Nearest on the Control).

Godot 4.7's defaults help partly: **Hinting** defaults to *Light (Except Pixel Fonts)* and **Subpixel Positioning** to *Auto (Except Pixel Fonts)*, and in our test both switched off by themselves for Kenney Pixel. **Antialiasing stayed Grayscale**, so set it to None yourself. The project's default font has the same options under **Project Settings > GUI > Theme** (`gui/theme/default_font_antialiasing` and neighbours).

In Unity, use a static TextMesh Pro font asset with a non-antialiased render mode (**RASTER** or **RASTER_HINTED**) and **Sampling Point Size** = the design size; camera and canvas scaling are in [pixel art blurry in Unity](guide:unity-pixel-art-blurry-pixel-perfect). In Phaser and PixiJS, nearest filtering comes from the game-wide settings in [crisp pixel art in Phaser and PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi).

## Godot 4.7: BMFont import and MSDF {#godot}

**Bitmap fonts.** Put the `.fnt` and its PNG in the project; Godot imports them as a `FontFile`. The `size` in the file's `info` line becomes the font's **fixed size**, and the import option **Scaling Mode** (*Disabled*, *Enabled (Integer)*, *Enabled (Fractional)*; default Fractional) decides what happens at other sizes. Use **Enabled (Integer)** for pixel fonts. A glyph-sheet image can be imported directly too: set **Import As** to *Font Data (Image Font)* and fill in **Columns**, **Rows** and **Character Ranges**.

**MSDF.** Select a `.ttf`/`.otf`, tick **Multichannel Signed Distance Field**, click **Reimport**. **MSDF Size** (default 48) is the size the field is generated at; **MSDF Pixel Range** (default 8) is the width of the distance ramp. Godot's docs list three limits: the pixel range must be at least **twice the outline size**, fonts with self-intersecting outlines render wrongly, and LCD subpixel antialiasing is unavailable. Row E is this setting with a 2 px outline:

```gdscript
# title_label.gd - outline on an MSDF font (MSDF Pixel Range 8 >= 2 x outline 2)
extends Label

func _ready() -> void:
	add_theme_font_size_override("font_size", 12)
	add_theme_constant_override("outline_size", 2)
	add_theme_color_override("font_outline_color", Color(0.1, 0.2, 0.55))
	scale = Vector2(6, 6)   # MSDF: no re-rasterisation, edges stay sharp
```

Label and RichTextLabel also have **Font Shadow Color**, **Shadow Offset X/Y** and **Shadow Outline Size**.

## Unity 6: TextMesh Pro and UI Toolkit {#unity}

TextMesh Pro now ships inside the uGUI package (`com.unity.ugui` 2.5.0 in Unity 6000.5.3f1); UI Toolkit uses TextCore font assets. Both share these settings:

- **Render mode.** Bitmap: *SMOOTH*, *SMOOTH_HINTED*, *RASTER*, *RASTER_HINTED* (plus *COLOR* variants). Distance field: *SDF*, *SDFAA*, *SDFAA_HINTED*, *SDF8*, *SDF16*, *SDF32* — *SDFAA* is the fast, less accurate generator, *SDF8/16/32* oversample more. All are single-channel; there is no MSDF mode.
- **Atlas Population Mode.** *Static* bakes characters in the editor; *Dynamic* adds glyphs from the source font at runtime (the font file ships with the build); *Dynamic OS* uses a font installed on the player's system.
- **Effects.** Outline, underlay (shadow) and glow are material settings of the SDF shader.

Unity's UI Toolkit manual suggests Static with SDF16 for labels, SDF32 for titles, Dynamic with SDFAA for player-typed text, and padding of about a tenth of the sampling size. Note that in **Unity 6.5, UI Toolkit's default Advanced Text Generator does not support static font assets**; Unity's migration page recommends subsetting the font and using a dynamic asset. TextMesh Pro keeps all three modes.

## Phaser 3.90 and 4.2: BitmapText needs XML {#phaser}

Phaser's `load.bitmapFont` parses **XML BMFont only**. With the same font, a text `.fnt` failed ("Failed to process file") in Phaser 3.90.0 and 4.2.1, and the `.xml` loaded all 95 glyphs. Convert text `.fnt` files (BMFont's default and Nerulio's output) like this:

```js
// fnt-to-xml.mjs - convert a BMFont *text* .fnt into the XML flavour Phaser's load.bitmapFont reads.
// Usage: node fnt-to-xml.mjs font.fnt font.xml
import { readFileSync, writeFileSync } from 'node:fs';

const [src, out] = process.argv.slice(2);
const esc = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const tags = { info: [], common: [], page: [], distanceField: [], char: [], kerning: [] };

for (const line of readFileSync(src, 'utf8').split(/\r?\n/)) {
  const tag = line.split(/\s/, 1)[0];
  if (!(tag in tags)) continue; // skips "chars count=" / "kernings count=" (recounted below)
  const attrs = [...line.matchAll(/(\w+)=("[^"]*"|\S+)/g)]
    .map(([, k, v]) => `${k}="${esc(v.replace(/^"|"$/g, ''))}"`);
  tags[tag].push(`<${tag} ${attrs.join(' ')}/>`);
}

writeFileSync(out, `<?xml version="1.0"?>
<font>
  ${tags.info[0]}
  ${tags.common[0]}
  <pages>${tags.page.join('')}</pages>
  ${tags.distanceField.join('')}
  <chars count="${tags.char.length}">
    ${tags.char.join('\n    ')}
  </chars>
  <kernings count="${tags.kerning.length}">${tags.kerning.join('')}</kernings>
</font>
`);
console.log(`${out}: ${tags.char.length} chars, ${tags.kerning.length} kernings`);
```

```js
// In your scene (Phaser 3.90 or 4.x). With pixelArt: true in the game config the font stays crisp.
preload() {
  this.load.bitmapFont('future12', 'future12.png', 'future12.xml');
}
create() {
  this.add.bitmapText(16, 40, 'future12', 'Wave 7');              // the font's own size: 1:1
  this.add.bitmapText(110, 34, 'future12', 'Wave 7').setScale(6); // whole-number scale
}
```

Omit the size argument to draw at the font's own size; a size you pass is scaled relative to it. Neither version has a distance-field BitmapText (no SDF/MSDF code in either source tree), so large scalable titles in Phaser need a big bitmap font or a `Text` object.

## PixiJS 8: BitmapText with SDF and MSDF {#pixijs}

PixiJS 8 loads BMFont text and XML through `Assets` and switches to its SDF or MSDF shader when the font declares a distance field:

```js
import { Assets, BitmapText } from 'pixi.js';

await Assets.load(['future12.fnt', 'pixel-msdf.xml']);

// Bitmap font: fontSize = the size in the file's info line draws it 1:1.
const hud = new BitmapText({ text: 'Wave 7', style: { fontFamily: 'Future12', fontSize: 16, fill: '#ffeea0' } });

// MSDF font (from msdf-atlas-gen): any size stays sharp.
const title = new BitmapText({ text: 'Hi!', style: { fontFamily: 'PixelMSDF', fontSize: 240, fill: '#ffeea0' } });
app.stage.addChild(hud, title);
```

The XML needs `<distanceField fieldType="msdf" distanceRange="4"/>` (or `fieldType="sdf"`). In PixiJS 8.21.0 a **text** `.fnt` with `distanceField fieldType=msdf distanceRange=4` loaded as a *plain* bitmap font: the text parser only matches lower-case record names and skips that line. The same data as XML worked, so give Pixi SDF/MSDF fonts as XML (the converter above keeps the `distanceField` entry). msdf-atlas-gen writes JSON, so convert its output; msdf-bmfont-xml and Snowb write BMFont directly.

## Outlines, shadows and memory {#outlines-memory}

On SDF and MSDF text an outline is a second threshold on the same distance, and a shadow or glow is an offset or softer sample, so no new texture is needed. The effect can only reach as far as the distance range stored in the atlas, which is why Godot wants MSDF Pixel Range ≥ 2 × outline and why TextMesh Pro's padding limits outline thickness. For bitmap fonts, bake the outline into the glyphs when building the font, or draw the text twice for a one-pixel drop shadow.

Memory: a bitmap atlas holds one size of one style, so three sizes plus an outlined variant are four atlases. A distance-field atlas serves all of them but pads every cell, and MSDF needs RGB. For the 95 printable ASCII glyphs of Kenney Future: bitmap at 12 px, 150×160; msdf-atlas-gen at 32 px with pixel range 4, 228×228 SDF (one channel) and 236×236 MSDF (RGB). Latin UI text is small either way; character count is what costs memory, hence subsets or dynamic atlases for CJK.

## Pitfalls {#pitfalls}

- **Mind the `size` in the `.fnt`.** Godot uses it as the fixed size; Phaser and Pixi scale your requested size relative to it.
- **Nearest filtering and whole-number scale are both needed** for pixel fonts. Either alone still blurs.
- **Tiny text.** At very small sizes, a bitmap hinted for that size often reads better than any distance field.
- **Kerning** exists only if the generator wrote pairs. A font built from a glyph sheet has none.

:::nerulio tool=bitmap-font
Nerulio's UI Lab has a bitmap font stage that runs in the browser with no upload. It turns a glyph sheet or a local TTF/OTF into a BMFont. A Fixed grid export (an 8×12 CC0 sheet) loaded pixel-exact in Godot 4.7.2 and PixiJS 8 in Nerulio's engine harness. The Font file mode is not in that harness yet; the Kenney Future font in this guide came from it and loaded in Godot, Phaser (after XML conversion) and PixiJS.
- **Fixed grid**: grid and character order are detected with a confidence level; every glyph is its whole cell.
- **Measured widths** and **Font file**: tight glyph rectangles and per-character advances, from the sheet's pixels or from a TTF/OTF rendered at the size you choose.
- **Character-set builder**: characters used in my text, ASCII, Latin-1, or the Korean/Japanese characters of your pasted text.
- **Download** gives `font.png`, `font.fnt` (BMFont text), `font.json` and a README; **Also build an SDF texture (Beta)** adds a single-channel `font-sdf.png` with the shader formula it needs.
- Limits: one page, no kerning, no MSDF, the SDF output is not engine-tested, and Phaser needs the XML conversion above.
:::

![Nerulio UI Lab bitmap font stage](shot:lab-ui-font "Nerulio UI Lab, Font stage: an 8×12 glyph sheet detected as a 16×6 grid starting at the space character, with a line drawn from the font's own metrics.")

## FAQ {#faq}

### Is SDF or MSDF better for game UI?

MSDF for large text and fonts with sharp corners, because single-channel SDF rounds corners when magnified. For body text and rounded fonts SDF looks the same and is simpler; Unity's TextMesh Pro only offers SDF.

### Why is my pixel font blurry in Godot 4?

Usually Antialiasing is still Grayscale in the Import dock, the size is not a whole multiple of the design size, or the Control uses linear filtering or a fractional scale. Set Antialiasing and Hinting to None, Subpixel Positioning to Disabled, use the design size and Nearest filtering.

### Why does Phaser fail to load my .fnt file?

`load.bitmapFont` parses only XML BMFont. A text `.fnt` (`info face=… size=…`) fails with "Failed to process file"; export XML or convert it with a script like the one above.

### Can I use MSDF fonts in Unity?

Not with TextMesh Pro or UI Toolkit: their distance-field modes are single-channel. SDF32 is usually enough for large text; true MSDF needs a third-party solution.

### Do I need a separate bitmap font for each size?

For pixel-exact results, yes: one atlas per size, or whole multiples of one pixel font. A distance-field font covers every size with one atlas, with slightly softer small text.

## Sources {#sources}

- [ResourceImporterDynamicFont (Godot 4.7)](https://docs.godotengine.org/en/stable/classes/class_resourceimporterdynamicfont.html)
- [ResourceImporterBMFont (Godot 4.7)](https://docs.godotengine.org/en/stable/classes/class_resourceimporterbmfont.html)
- [Using fonts: bitmap fonts, pixel fonts, MSDF, outlines (Godot 4.7)](https://docs.godotengine.org/en/stable/tutorials/ui/gui_using_fonts.html)
- [Godot 4.7 font importer source, option names and enum labels](https://github.com/godotengine/godot/blob/4.7-stable/editor/import/resource_importer_dynamic_font.cpp)
- [Font Asset Creator (TextMesh Pro, uGUI 2.0)](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/TextMeshPro/FontAssetsCreator.html)
- [Font Asset properties (TextMesh Pro, uGUI 2.0)](https://docs.unity3d.com/Packages/com.unity.ugui@2.0/manual/TextMeshPro/FontAssetsProperties.html)
- [Introduction to font assets (Unity 6.3 Manual, UI Toolkit)](https://docs.unity3d.com/6000.3/Documentation/Manual/UIE-font-asset.html)
- [Migrate static font assets to Advanced Text Generator (Unity 6.5 Manual)](https://docs.unity3d.com/6000.5/Documentation/Manual/ui-systems/migrate-static-font-assets.html)
- [Bitmap Text (Phaser documentation)](https://docs.phaser.io/phaser/concepts/gameobjects/bitmap-text)
- [Bitmap text (PixiJS 8 guide)](https://pixijs.com/8.x/guides/components/scene-objects/text/bitmap)
- [msdf-atlas-gen (Viktor Chlumský)](https://github.com/Chlumsky/msdf-atlas-gen)
- [BMFont file format (AngelCode)](https://www.angelcode.com/products/bmfont/doc/file_format.html)
