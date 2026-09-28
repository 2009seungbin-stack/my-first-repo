/** The intent content of every indexable search page (docs/SEO-CONTENT-MODEL.md), one file per
 * page group. Build-time only for the file tools (tools/build.mjs injects it as static HTML; the
 * browser never loads this module), and for the game landings (tools/game-landing-build.mjs).
 * GROUPS is the ownership map: each indexable page (canonical path) belongs to exactly one file,
 * and tests/seo-depth.test.mjs checks that the file defines exactly its pages in en, ko and ja. */
import spriteCore from './sprite-core.js';
import spriteEngines from './sprite-engines.js';
import spriteFormats from './sprite-formats.js';
import pack from './pack.js';
import pixelFix from './pixel-fix.js';
import pixelEdit from './pixel-edit.js';
import tileCore from './tile-core.js';
import tileEngines from './tile-engines.js';
import texturePbr from './texture-pbr.js';
import textureNormals from './texture-normals.js';
import ui from './ui.js';
import toolsImage from './tools-image.js';
import toolsMedia from './tools-media.js';

export const GROUPS=Object.freeze({
 'sprite-core':['sprite-slicer','game/sprite-lab','normalize-sprite-frames','game/sprite-animation-preview','game/sprite-pivot-editor','game/hitbox-editor','game/collision-polygon-generator','game/sprite-editor','game/sprite-animator','game/sprite-atlas-viewer','game/sprite-sheet-to-png-frames','game/sprite-sheet-slicing-off','game/sprite-jitter-after-trim','game/ezgif-sprite-cutter-alternative'],
 'sprite-engines':['game/aseprite-to-godot','game/godot-sprite-sheet','game/aseprite-to-unity','game/aseprite-to-phaser','game/unity-sprite-sheet','game/gamemaker-sprite-strip','game/sprite-sheet-frame-size','game/godot-animation-frame-duration','game/gdevelop-sprite-sheet','game/aseprite-to-gamemaker'],
 'sprite-formats':['game/aseprite-viewer','game/aseprite-to-gif','game/sprite-sheet-to-aseprite','game/sprite-sheet-to-video','game/fnf-spritesheet-to-gif','game/sprite-sheet-to-gif','game/remove-sprite-background','game/aseprite-to-sprite-sheet','game/aseprite-json-to-pixi','game/keep-aseprite-tags-when-packing','game/gif-to-sprite-sheet'],
 'pack':['sprite-sheet-maker','game/texture-packer-free','game/phaser-texture-atlas','game/pixi-spritesheet-json','game/defold-atlas','game/love2d-quads','game/spine-atlas','game/sparrow-xml-spritesheet','game/css-sprite-generator','game/texturepacker-to-godot','game/texturepacker-to-unity','game/phaser-atlas-frames-wrong','game/pixijs-2x-spritesheet-scale','game/sprite-sheet-packers-compared'],
 'pixel-fix':['game/godot-pixel-art-blurry','game/unity-pixel-art-blurry','game/pixel-art-downscaler','game/fix-ai-pixel-art','game/pixel-art-upscaler','game/pixel-art-cleanup','game/pixel-perfect-checker','game/pixel-snapper-alternative'],
 'pixel-edit':['game/pixel-art-editor','game/pixel-art-animation','game/pixel-art-palette-editor','game/pixel-art-outline','game/pixel-lab','game/palette-extractor','game/palette-swap-ramp','game/lospec-palette','game/aseprite-alternative'],
 'tile-core':['game/tileset-generator','game/tilemap-editor','game/tile-lab','game/autotile-tester','game/tileset-slicer','game/blob-47-tileset','game/dual-grid-tileset','game/sprite-fusion-alternative'],
 'tile-engines':['game/godot-autotile','game/rpg-maker-autotile-to-godot','game/tiled-wang-set','game/unity-rule-tile','game/ldtk-autotile-rules','game/godot-tileset-collision','game/gamemaker-autotile-to-godot','game/godot-terrain-wrong-tiles'],
 'texture-pbr':['game/texture-lab','game/channel-unpacker','game/pbr-texture-validator','game/texture-edge-bleed','texture-mask-packer','game/roughness-to-smoothness','game/normal-map-converter','game/tiling-normal-map-seams'],
 'texture-normals':['game/sprite-normal-map','normal-map-generator','game/pixel-art-normal-map','game/godot-2d-normal-map','game/unity-2d-normal-map','game/normal-map-sprite-sheet','game/normal-map-opengl-or-directx','game/laigter-alternative','game/normalmap-online-alternative'],
 'ui':['game/ui-lab','game/9-slice-editor','game/button-state-generator','game/missing-glyph-checker','game/ui-scale-preview','bitmap-font-maker','game/seamless-tile-checker','tile-grid-slicer','atlas-padding'],
 'tools-image':['image/editor','image/compress','image/convert','image/resize','image/png-to-jpg','image/jpg-to-png','image/png-to-webp','image/webp-to-png','image/jpg-to-webp','image/webp-to-jpg','image/avif-to-jpg','image/avif-to-png','image/bmp-to-png','image/bmp-to-jpg','image/compress-to-20kb','image/compress-to-50kb','image/compress-to-100kb','image/compress-to-200kb','image/compress-to-500kb','image/compress-to-1mb','image/resize/instagram-post','image/resize/instagram-portrait','image/resize/instagram-story','image/resize/youtube-thumbnail','image/resize/youtube-banner','image/resize/x-header','image/resize/linkedin-banner','image/resize/discord-banner'],
 'tools-media':['pdf/editor','pdf/split','pdf/compress','media','video/trim','video/frame','video/to-mp3','video/to-gif','video/compress','video/mp4-to-gif','video/mov-to-gif','video/webm-to-gif','video/mp4-to-mp3','video/mov-to-mp3','video/webm-to-mp3']
});
const FILES={'sprite-core':spriteCore,'sprite-engines':spriteEngines,'sprite-formats':spriteFormats,pack,'pixel-fix':pixelFix,'pixel-edit':pixelEdit,'tile-core':tileCore,'tile-engines':tileEngines,'texture-pbr':texturePbr,'texture-normals':textureNormals,ui,'tools-image':toolsImage,'tools-media':toolsMedia};
export const DEPTH=Object.freeze(Object.assign({},...Object.values(FILES)));
export const groupFile=Object.freeze(FILES);
/** The intent types (docs/SEO-CONTENT-MODEL.md §Types). */
export const TYPES=Object.freeze(['conversion','engine','troubleshoot','create','format','compare','tool']);
