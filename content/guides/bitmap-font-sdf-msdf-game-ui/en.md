Use a **bitmap font** (a BMFont `.fnt` plus a PNG) when text is drawn at one known size, and always for pixel fonts: render them at whole multiples of their design size, with antialiasing off and nearest filtering. Use an **SDF** font when the same text has to scale, zoom or get outlines and glows cheaply. Use **MSDF** when you also need sharp corners at large sizes. In Godot 4.7 that is the *Multichannel Signed Distance Field* import option, Unity 6 TextMesh Pro and UI Toolkit font assets are SDF by default, and PixiJS 8 reads SDF/MSDF fonts from a BMFont file with a `distanceField` entry. Phaser's built-in BitmapText is a plain bitmap.

The rest of this guide shows what each format stores, the exact settings in Godot, Unity, Phaser and PixiJS, and the loader quirks we hit while rendering every example below in the real engines.

![Five ways to draw the same UI text in Godot 4.7.2](shot:engine-godot-font-modes "Rendered by Godot 4.7.2 (Compatibility renderer). A: pixel font imported with antialiasing, hinting and subpixel positioning off, 16 px at 3×. B: the same font at 20 px with the default import, so pixels come out uneven. C: an ordinary raster font scaled 6× goes blurry. D: a BMFont baked at 12 px, scaled 6× with nearest filtering, turns blocky. E: the same TTF with MSDF on stays sharp at 6× and takes a 2 px outline. Fonts: Kenney Pixel and Kenney Future (CC0).")

## How bitmap, SDF and MSDF fonts work {#how-they-work}

All three draw text from a texture atlas of glyphs. What differs is what each texel means.

| Format | What a texel stores | Scaling up | Outline, glow, shadow | Texture cost |
|---|---|---|---|---|
| Bitmap | Coverage (alpha) at one size | Blurry (linear) or blocky (nearest) | Baked into the image, or draw the text twice | One atlas per size and style |
| SDF | Distance to the nearest edge, one channel | Smooth edges, but corners get rounded | Free in the shader: shift the threshold | One atlas for all sizes, cells need padding |
| MSDF | Three distances in R, G and B; the median is the edge | Smooth edges **and** sharp corners | Free in the shader | Same layout as SDF, three channels |

A bitmap glyph is final pixels, so it is exact at the size it was baked for and wrong at any other. A signed distance field instead stores, for every texel, how far it is from the glyph outline. The shader turns that back into an edge at any scale by taking the texels where the distance crosses zero, so the edge stays smooth. A single distance channel cannot hold a sharp corner, because the distance field around a corner is round. MSDF splits the edges over three channels and takes the median, which keeps the corner.

![Bitmap, SDF and MSDF fonts compared in PixiJS 8.21](shot:engine-pixi-sdf-msdf "Rendered by PixiJS 8.21.0 (WebGL) in Chromium. Top: a bitmap font baked at 12 px is fine at 12 px and blurry at 72 px. Middle rows: SDF and MSDF atlases built at 32 px by msdf-atlas-gen 1.4 stay smooth at 72 px. Bottom: Kenney Pixel at 240 px from 32 px atlases. SDF rounds every square corner, MSDF keeps them. Fonts: Kenney Future and Kenney Pixel (CC0).")

## Set up sharp UI text, step by step {#set-up}

:::steps
1. **Write down the sizes.** Note the smallest and largest on-screen pixel size of each text style, whether the UI or camera scales, and which effects you need (outline, shadow, glow). One fixed size and no effects points to a bitmap font. Zooming, tweening scale or large titles point to SDF or MSDF.
2. **Pick the format.** Pixel font: bitmap, or a dynamic font with antialiasing off. Body text at a few fixed sizes: bitmap or the engine's dynamic font. Scaling text with outlines: SDF. Large titles, logos, fonts with sharp corners: MSDF.
3. **Build the atlas from the characters you really use.** Include ASCII for numbers and names that are inserted at runtime. For Korean, Japanese or Chinese, see [CJK font atlases from localisation files](guide:cjk-font-atlas-localization).
4. **Import it with the right settings.** In Godot, select the font and set the Import dock options below, then click **Reimport**. In Unity, make a font asset in **Window > TextMesh Pro > Font Asset Creator** with the render mode you chose.
5. **Draw at the size the atlas expects.** Bitmap fonts at their baked size or whole multiples of it, with nearest filtering for pixel fonts. SDF and MSDF fonts at any size.
6. **Add outlines and shadows in the renderer.** Use the engine's outline and shadow settings on SDF/MSDF text. Only bake them into the image for bitmap fonts.
7. **Check it at the real resolution.** Look at the smallest size at 100 % zoom and at 125 % and 150 % display scaling. A pixel font that is fine at 16 px can turn uneven at 20 px.
:::

## Pixel fonts: integer sizes, no antialiasing {#pixel-fonts}

A pixel font is drawn on a grid of *n* font units per pixel. It is only crisp when each of those grid cells lands on exactly one screen pixel. Kenney Pixel, for example, is designed on a 16 px grid, so 16, 32 and 48 px are crisp and 20 px is not. Row B above is 20 px: some pixels come out one screen pixel wide and some two. Godot's documentation states the rule directly: the font size must be an integer multiple of the design size, and the Control must be scaled by an integer too.

In Godot 4.7, select the `.ttf` and set in the **Import** dock:

- **Antialiasing:** None (the options are None, Grayscale, LCD Subpixel; the default is Grayscale).
- **Hinting:** None.
- **Subpixel Positioning:** Disabled.
- **Project Settings > Rendering > Textures > Canvas Textures > Default Texture Filter:** Nearest, or set **Texture Filter** to Nearest on the Control.

Godot 4.7's defaults already help. **Hinting** defaults to *Light (Except Pixel Fonts)* and **Subpixel Positioning** to *Auto (Except Pixel Fonts)*, and both resolve to off for a font whose outlines are only horizontal and vertical lines. In our test, Godot switched both off for Kenney Pixel on its own. **Antialiasing stayed Grayscale**, though, so you still have to set it to None. The same three options exist for the project's default font under **Project Settings > GUI > Theme** (`gui/theme/default_font_antialiasing`, `default_font_hinting`, `default_font_subpixel_positioning`).

In Unity, a pixel font is a static TextMesh Pro asset with a non-antialiased render mode: **RASTER** or **RASTER_HINTED** in the Font Asset Creator, with **Sampling Point Size** set to the font's design size. Draw it at that size or whole multiples of it. Camera and canvas scaling are covered in [pixel art blurry in Unity](guide:unity-pixel-art-blurry-pixel-perfect). In Phaser and PixiJS, nearest filtering comes from the game-wide pixel-art settings in [crisp pixel art in Phaser and PixiJS](guide:pixel-art-crisp-in-browser-phaser-pixi).

## Godot 4.7: FontFile, BMFont import and MSDF {#godot}

**Bitmap fonts.** Drop the `.fnt` and its PNG into the project. Godot reads BMFont with the *font_data_bmfont* importer and makes a `FontFile`. The size in the `.fnt` file's `info` line becomes the font's **fixed size**. Its **Scaling Mode** option decides what happens at other sizes: *Disabled*, *Enabled (Integer)* or *Enabled (Fractional)*, and the default is Enabled (Fractional). For a pixel font, pick **Enabled (Integer)** so it only grows in whole steps. Godot can also build a font straight from a glyph sheet image: set the image's **Import As** to *Font Data (Image Font)* and fill in **Columns**, **Rows** and **Character Ranges**.

**MSDF.** Select a `.ttf`/`.otf`, tick **Multichannel Signed Distance Field** in the Import dock and click **Reimport**. **MSDF Size** (default 48) is the size the field is generated at, and **MSDF Pixel Range** (default 8) is the width of the distance ramp. The Godot docs give three limits. MSDF Pixel Range must be at least **twice the outline size** you use. Fonts with self-intersecting outlines render wrongly. LCD subpixel antialiasing is not available on MSDF fonts. Row E of the render is this setting with a 2 px outline:

```gdscript
# title_label.gd - outline on an MSDF font (MSDF Pixel Range 8 >= 2 x outline 2)
extends Label

func _ready() -> void:
	add_theme_font_size_override("font_size", 12)
	add_theme_constant_override("outline_size", 2)
	add_theme_color_override("font_outline_color", Color(0.1, 0.2, 0.55))
	scale = Vector2(6, 6)   # MSDF: no re-rasterisation, edges stay sharp
```

Label and RichTextLabel also have shadow overrides: **Font Shadow Color**, **Shadow Offset X/Y** and **Shadow Outline Size**.

## Unity 6: TextMesh Pro and UI Toolkit font assets {#unity}

In Unity 6, TextMesh Pro is part of the uGUI package (Unity 6000.5.3f1 ships `com.unity.ugui` 2.5.0). UI Toolkit uses TextCore font assets. Both read the same settings:

- **Render mode.** Bitmap modes: *SMOOTH*, *SMOOTH_HINTED*, *RASTER*, *RASTER_HINTED* (and *COLOR* variants for colour fonts). Distance-field modes: *SDF*, *SDFAA*, *SDFAA_HINTED*, *SDF8*, *SDF16*, *SDF32*. Unity's docs describe *SDFAA* as the faster, less accurate generator and *SDF8/16/32* as progressively more oversampling. Unity's SDF modes are single-channel. TextMesh Pro has no MSDF mode.
- **Atlas Population Mode.** *Static* bakes the characters in the editor. *Dynamic* starts empty and adds glyphs from the source font at runtime, so the font file ships with the build. *Dynamic OS* uses a font installed on the player's system.
- **Effects.** Outline, underlay (shadow) and glow are material settings of the SDF shader, so they do not need a new atlas.

Unity's UI Toolkit manual recommends Static with SDF16 for general labels, SDF32 for titles, Dynamic with SDFAA for text the player types, and padding of about one tenth of the sampling size. In **Unity 6.5, UI Toolkit's default Advanced Text Generator does not support static font assets**. Unity's migration page says to subset the font file and use a dynamic asset instead. TextMesh Pro (uGUI) still has all three modes.

## Phaser 3.90 and 4.2: BitmapText needs XML {#phaser}

Phaser's `load.bitmapFont` parses **XML BMFont only**. We loaded the same font as a text `.fnt` and as `.xml` in Phaser 3.90.0 and 4.2.1. The text file failed with "Failed to process file" in both, and the XML file loaded all 95 glyphs. If your tool exports text `.fnt` (BMFont's default, and Nerulio's), convert it:

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

Leave out the size argument to draw at the font's own size. A size you pass is scaled relative to the size in the file. Neither Phaser 3.90.0 nor 4.2.1 has a distance-field BitmapText (we found no SDF or MSDF code in either source tree), so for big scalable titles in Phaser use a large bitmap font or a `Text` object.

## PixiJS 8: BitmapText with SDF and MSDF {#pixijs}

PixiJS 8 loads BMFont text and XML through `Assets`, and turns on its SDF or MSDF shader when the font declares a distance field:

```js
import { Assets, BitmapText } from 'pixi.js';

await Assets.load(['future12.fnt', 'pixel-msdf.xml']);

// Bitmap font: fontSize = the size in the file's info line draws it 1:1.
const hud = new BitmapText({ text: 'Wave 7', style: { fontFamily: 'Future12', fontSize: 16, fill: '#ffeea0' } });

// MSDF font (from msdf-atlas-gen): any size stays sharp.
const title = new BitmapText({ text: 'Hi!', style: { fontFamily: 'PixelMSDF', fontSize: 240, fill: '#ffeea0' } });
app.stage.addChild(hud, title);
```

The XML file must contain `<distanceField fieldType="msdf" distanceRange="4"/>` (or `fieldType="sdf"`). One quirk showed up in PixiJS 8.21.0. A **text** `.fnt` with the line `distanceField fieldType=msdf distanceRange=4` loaded as a *plain* bitmap font. The parser only accepts lower-case record names, so the `distanceField` line is skipped. The same data as XML switched the shader on. Ship SDF/MSDF fonts to Pixi as XML, for example with the converter above. msdf-atlas-gen writes JSON rather than BMFont, and tools such as msdf-bmfont-xml and Snowb write BMFont directly.

## Outlines and shadows {#outlines-shadows}

On SDF and MSDF text, an outline is a second threshold on the same distance, and a shadow or glow is a sample at an offset or a softer threshold. None of it needs a new texture. There is one limit: the effect can only reach as far as the distance range stored in the atlas. That is why Godot asks for MSDF Pixel Range ≥ 2 × outline size, and why TextMesh Pro's padding caps how thick an outline can get. For bitmap fonts, bake the outline into the glyph image when you build the font, so the atlas cells grow by the outline width. Or draw the text twice, offset by one pixel for a pixel-art drop shadow.

## Memory and atlas size {#memory}

A bitmap atlas holds one size of one style. Three sizes plus an outlined variant means four atlases. An SDF or MSDF atlas serves every size and every effect, but each cell carries padding for the distance ramp, and MSDF needs RGB. For scale, here is the 95 printable ASCII glyphs of Kenney Future. As a bitmap font baked at 12 px (the Nerulio export) the atlas is 150×160 RGBA. With msdf-atlas-gen 1.4 at 32 px and a pixel range of 4 it is 228×228 as SDF (one channel) and 236×236 as MSDF (RGB). For Latin UI text all three are small. What eats memory is the character count, which is why CJK needs a subset or a dynamic atlas.

## Pitfalls {#pitfalls}

- **The size in the `.fnt` file matters.** Godot uses the `info size` as the font's fixed size, and Phaser and Pixi scale the size you ask for relative to it. Draw at that number, or whole multiples of it for pixel fonts.
- **Text vs XML BMFont.** Phaser needs XML. PixiJS reads both, but only honours `distanceField` from XML in 8.21.
- **Linear filtering on pixel fonts.** Nearest filtering and whole-number scale are both needed. Either one alone still blurs.
- **MSDF on tiny text.** At very small sizes a plain bitmap hinted at that size is often more legible than any distance field.
- **Kerning.** BMFont kerning pairs only exist if the generator wrote them. A font made from a glyph sheet has none.

:::nerulio tool=bitmap-font
Nerulio's UI Lab has a bitmap font stage that runs in the browser with no upload. It turns a glyph sheet or a local TTF/OTF into a BMFont, and its checker compares the font with your localisation files. The Fixed grid export (an 8×12 CC0 sheet) loaded pixel-exact in Godot 4.7.2 and PixiJS 8 in Nerulio's engine harness. The Font file mode is not in that harness yet; the Kenney Future font in this guide came from it and loaded in Godot, Phaser (after XML conversion) and PixiJS.
- **Fixed grid**: the grid and character order are detected with a confidence level. Every glyph is its whole cell.
- **Measured widths**: tight glyph rectangles and per-character advances from the pixels. **Font file**: renders a TTF/OTF at a chosen size and measures the result.
- **Character-set builder**: Characters used in my text, ASCII, Latin-1, and Korean or Japanese characters taken from your pasted text.
- **Download** gives `font.png`, `font.fnt` (BMFont text), `font.json` and a README. Tick **Also build an SDF texture (Beta)** to add a single-channel SDF (`font-sdf.png`) with the one-line shader formula it needs.
- Limits: one atlas page, no kerning pairs and no MSDF. The SDF output has not been checked in an engine. Convert `font.fnt` to XML for Phaser.
:::

![Nerulio UI Lab bitmap font stage](shot:lab-ui-font "Nerulio UI Lab, Font stage: an 8×12 glyph sheet detected as a 16×6 grid starting at the space character, with the line preview drawn from the font's own metrics.")

## FAQ {#faq}

### Is SDF or MSDF better for game UI?

MSDF, when the text is drawn large or has sharp corners, because a single-channel SDF rounds corners at large sizes. For small body text and soft, rounded fonts, SDF looks the same and is simpler: Unity's TextMesh Pro only offers SDF, and it is fine for most UI.

### Why is my pixel font blurry in Godot 4?

Usually one of three things. **Antialiasing** is still Grayscale in the font's Import dock. The size is not a whole multiple of the font's design size. Or the Control is drawn with linear filtering or a fractional scale. Set Antialiasing to None, Hinting to None and Subpixel Positioning to Disabled, use the design size, and set the texture filter to Nearest.

### Why does Phaser fail to load my .fnt file?

Phaser's `load.bitmapFont` only parses the XML variant of BMFont. A text `.fnt` (the `info face=… size=…` format) fails with "Failed to process file". Export XML from your font tool or convert the file with a script such as the one above.

### Can I use MSDF fonts in Unity?

Not in TextMesh Pro or UI Toolkit: their distance-field modes (SDF, SDFAA, SDF8/16/32) are single-channel. Large text in Unity is usually fine with SDF32. If you need true MSDF, it takes a third-party solution.

### Do I need a separate bitmap font for each size?

Yes, if you want each size to be pixel-exact. Bake one atlas per size, or use whole multiples of one pixel font. A distance-field font covers all sizes with one atlas, at the cost of slightly softer small text.

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
