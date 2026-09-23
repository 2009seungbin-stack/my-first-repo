/** Engine files and READMEs of the UI workspace exports. Text templates only; the engine helper
 * scripts are the verified files from tools/engine-verify/ui/helpers/ (helper-sources.js).
 * VERIFY records what tools/engine-verify/ui actually ran — READMEs and the export panel read it,
 * so an unverified target is never presented as working. */
import {GODOT_UI_HELPER,UNITY_UI_IMPORTER,GODOT_FONT_HELPER,UNITY_TMP_IMPORTER} from './helper-sources.js';
export {GODOT_UI_HELPER,UNITY_UI_IMPORTER,GODOT_FONT_HELPER,UNITY_TMP_IMPORTER};
/** 'verified' = loaded AND drawn in the real engine and compared pixel by pixel on real assets;
 * 'partial' = loaded in the engine, some aspect not drawn; 'unverified' = not run in that engine. */
export const VERIFY=Object.freeze({
 kit:{generic:'n/a',godot:'unverified',unity:'unverified',android:'unverified',css:'unverified',phaser:'unverified',pixi:'unverified'},
 font:{'bmfont-text':'unverified','bmfont-xml':'unverified','bmfont-bin':'unverified','msdf-json':'n/a',godot:'unverified',unity:'unverified',phaser:'unverified',pixi:'unverified'}
});
const status=(kind,t)=>({verified:'VERIFIED',partial:'PARTLY VERIFIED',unverified:'UNVERIFIED','n/a':'plain data'}[VERIFY[kind][t]]||'UNVERIFIED');
const AXIS={stretch:0,tile:1,'tile-fit':2};
const f1=v=>(Math.round(v*1000)/1000).toFixed(1).replace(/\.0$/,'.0');
// ------------------------------------------------------------------ Godot
/** StyleBoxTexture as a Godot 4 text resource. The texture path is relative to the .tres (keep the
 * PNG next to it); content margins carry the 9-patch content padding. */
export function godotStyleBox({texture,rect=null,nine}){
 const b=nine.border,p=nine.padding;
 const lines=['[gd_resource type="StyleBoxTexture" load_steps=2 format=3]','',`[ext_resource type="Texture2D" path="${texture}" id="1_tex"]`,'','[resource]'];
 if(p)lines.push(`content_margin_left = ${f1(p.left)}`,`content_margin_top = ${f1(p.top)}`,`content_margin_right = ${f1(p.right)}`,`content_margin_bottom = ${f1(p.bottom)}`);
 lines.push('texture = ExtResource("1_tex")',`texture_margin_left = ${f1(b.left)}`,`texture_margin_top = ${f1(b.top)}`,`texture_margin_right = ${f1(b.right)}`,`texture_margin_bottom = ${f1(b.bottom)}`);
 if(AXIS[nine.stretch.h])lines.push(`axis_stretch_horizontal = ${AXIS[nine.stretch.h]}`);
 if(AXIS[nine.stretch.v])lines.push(`axis_stretch_vertical = ${AXIS[nine.stretch.v]}`);
 if(rect)lines.push(`region_rect = Rect2(${rect.x}, ${rect.y}, ${rect.w}, ${rect.h})`);
 if(!nine.drawCenter)lines.push('draw_center = false');
 return lines.join('\n')+'\n';
}
/** A Theme with one Button type's five style boxes (normal/hover/pressed/disabled/focus). */
export function godotButtonTheme({button,items,images,rects}){
 const ext=[],subs=[],map={};let n=0;
 for(const [st,name] of Object.entries(button.states)){
  const it=items.find(i=>i.name===name);if(!it||!it.nine)continue;
  const img=images[rects.get(name).image].file;let id=ext.find(e=>e.path===img)?.id;
  if(!id){id=`${ext.length+1}_tex`;ext.push({path:img,id});}
  const sid=`StyleBoxTexture_${++n}`;map[st]=sid;
  const b=it.nine.border,p=it.nine.padding,r=rects.get(name),atlas=images.length===1&&images[0].width!==it.w;
  subs.push(`[sub_resource type="StyleBoxTexture" id="${sid}"]`,...(p?[`content_margin_left = ${f1(p.left)}`,`content_margin_top = ${f1(p.top)}`,`content_margin_right = ${f1(p.right)}`,`content_margin_bottom = ${f1(p.bottom)}`]:[]),
   `texture = ExtResource("${id}")`,`texture_margin_left = ${f1(b.left)}`,`texture_margin_top = ${f1(b.top)}`,`texture_margin_right = ${f1(b.right)}`,`texture_margin_bottom = ${f1(b.bottom)}`,
   ...(AXIS[it.nine.stretch.h]?[`axis_stretch_horizontal = ${AXIS[it.nine.stretch.h]}`]:[]),...(AXIS[it.nine.stretch.v]?[`axis_stretch_vertical = ${AXIS[it.nine.stretch.v]}`]:[]),
   ...(atlas?[`region_rect = Rect2(${r.x}, ${r.y}, ${r.w}, ${r.h})`]:[]),'');
 }
 const lines=[`[gd_resource type="Theme" load_steps=${ext.length+subs.filter(l=>l.startsWith('[sub')).length+1} format=3]`,'',...ext.map(e=>`[ext_resource type="Texture2D" path="${e.path}" id="${e.id}"]`),'',...subs,'[resource]'];
 for(const st of ['normal','hover','pressed','disabled','focus'])if(map[st])lines.push(`Button/styles/${st} = SubResource("${map[st]}")`);
 return lines.join('\n')+'\n';
}
export const godotKitReadme=name=>`# ${name} — Godot 4 (${status('kit','godot')})

* \`<element>.tres\`: a StyleBoxTexture per 9-slice element (texture margins = the stretch borders,
  content margins = the content padding, axis stretch = stretch / tile / tile fit). Keep each PNG next
  to its .tres. Use it in a Theme, a Panel/PanelContainer (theme_override_styles/panel) or a Button.
* \`<button>_theme.tres\`: a Theme whose Button has the five state style boxes.
* NinePatchRect instead: patch_margin_* = the same four numbers (\`nerulio-ui.json\` → nineSlice).
* \`nerulio_ui_import.gd\`: builds the same resources from nerulio-ui.json for a script workflow.
* Pixel art: set the node's (or the project's) texture filter to Nearest, or corners blur.
`;
// ------------------------------------------------------------------ Unity
export const unityKitReadme=name=>`# ${name} — Unity (${status('kit','unity')})

Put this folder under Assets/. \`Editor/NerulioUIImporter.cs\` reads \`nerulio-ui.json\` and sets every
sprite's border (Unity order: left, bottom, right, top; bottom-left origin), Point filter, no
compression, and a SpriteState for each button (Button › Transition: Sprite Swap). Menu:
Tools › Nerulio › Apply UI kit. Use Image Type = Sliced (stretch) or Tiled (tile) on a UI Image.
Unity sprites have no content padding: use the padding numbers from nerulio-ui.json in your layout.
`;
// ------------------------------------------------------------------ Android
export const androidReadme=()=>`# Android 9-patch (${status('kit','android')})

\`drawable-nodpi/*.9.png\`: the element with a 1-px frame — black marks on top/left = the stretch
band, on bottom/right = the content area (padding). Android allows one band per side here. Put
them in res/drawable-nodpi (pixel art) or the density folder you target; the file name is the
resource name (lowercase letters, digits, underscore).
`;
// ------------------------------------------------------------------ CSS
const CSS_REPEAT={stretch:'stretch',tile:'repeat','tile-fit':'round'};
export function css({items,images,rects}){
 const out=[`/* Nerulio UI kit — CSS border-image (${status('kit','css')}).
   --ui-scale scales the corners (1, 2, 3 …); image-rendering keeps pixel art sharp. border-image
   'repeat' centres the tiles (CSS rule); 'round' fits whole tiles like Godot's Tile Fit. */`,':root{--ui-scale:1}'];
 for(const it of items){
  if(!it.nine)continue;const b=it.nine.border,p=it.nine.padding||b,file=images[rects.get(it.name).image].file;
  const pad=['top','right','bottom','left'].map(k=>`calc(${Math.max(0,p[k]-b[k])}px * var(--ui-scale))`).join(' ');
  out.push(`.ui-${it.name}{box-sizing:border-box;border-style:solid;border-width:${['top','right','bottom','left'].map(k=>`calc(${b[k]}px * var(--ui-scale))`).join(' ')};`+
   `border-image-source:url("${file}");border-image-slice:${b.top} ${b.right} ${b.bottom} ${b.left}${it.nine.drawCenter?' fill':''};border-image-width:auto;`+
   `border-image-repeat:${CSS_REPEAT[it.nine.stretch.h]} ${CSS_REPEAT[it.nine.stretch.v]};padding:${pad};image-rendering:pixelated;min-width:calc(${b.left+b.right}px * var(--ui-scale));min-height:calc(${b.top+b.bottom}px * var(--ui-scale))}`);
 }
 return out.join('\n')+'\n';
}
export const cssDemo=({name,items})=>`<!doctype html><meta charset="utf-8"><title>${name}</title><link rel="stylesheet" href="${name}.css">
<style>body{background:#2b2d33;color:#fff;font:14px system-ui;padding:16px;display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}div{display:inline-block}</style>
${items.filter(i=>i.nine).map(i=>`<div class="ui-${i.name}" style="width:${i.w*2}px;height:${i.h+24}px">${i.name}</div>`).join('\n')}
`;
// ------------------------------------------------------------------ Phaser / Pixi
/** TexturePacker JSON (hash) with `scale9Borders` (TexturePacker's 9-slice field) and the Studio's own
 * `nerulio` block per frame (borders, padding, stretch) for loaders that ignore scale9Borders. */
export function textureAtlasJSON({items,images,rects,name}){
 const pg=images[0],frames={};
 for(const it of items){const r=rects.get(it.name),f={frame:{x:r.x,y:r.y,w:r.w,h:r.h},rotated:false,trimmed:false,spriteSourceSize:{x:0,y:0,w:r.w,h:r.h},sourceSize:{w:r.w,h:r.h}};
  if(it.nine){const b=it.nine.border;f.scale9Borders={x:b.left,y:b.top,w:r.w-b.left-b.right,h:r.h-b.top-b.bottom};f.nerulio={nineSlice:{...b},padding:it.nine.padding,stretch:{...it.nine.stretch}};}
  frames[it.name]=f;}
 return {frames,meta:{app:'https://nerulio.pages.dev/game/studio/',version:'1',image:pg.file,format:'RGBA8888',size:{w:pg.width,h:pg.height},scale:'1'}};
}
const nineArgs=it=>{const b=it.nine.border;return `${b.left}, ${b.right}, ${b.top}, ${b.bottom}`;};
export const phaserKitReadme=({name,items})=>`# ${name} — Phaser 3.60+ / 4 (${status('kit','phaser')})

\`\`\`js
this.load.atlas('${name}', '${name}_atlas.png', '${name}.json');
// create():
${items.filter(i=>i.nine).slice(0,6).map(i=>`this.add.nineslice(x, y, '${name}', '${i.name}', width, height, ${nineArgs(i)});`).join('\n')}
\`\`\`
Arguments after the size: leftWidth, rightWidth, topHeight, bottomHeight (source pixels). Phaser's
NineSlice stretches; tile modes are not available in Phaser. Use \`pixelArt: true\` in the game config.
`;
export const pixiKitReadme=({name,items})=>`# ${name} — PixiJS 8 (${status('kit','pixi')})

\`\`\`js
const sheet = await PIXI.Assets.load('${name}.json');
${items.filter(i=>i.nine).slice(0,6).map(i=>`new PIXI.NineSliceSprite({ texture: sheet.textures['${i.name}'], leftWidth: ${i.nine.border.left}, topHeight: ${i.nine.border.top}, rightWidth: ${i.nine.border.right}, bottomHeight: ${i.nine.border.bottom}, width, height });`).join('\n')}
\`\`\`
Set \`texture.source.scaleMode = 'nearest'\` for pixel art. NineSliceSprite stretches; for tiling use TilingSprite pieces.
`;
export const kitReadme=({name,items,buttons,targets})=>`# ${name} — UI kit from Nerulio Studio

${items.length} element(s), ${buttons.length} button(s). Folders: ${targets.join(', ')}.
Every number is in source pixels: nineSlice = the stretch borders (left, right, top, bottom),
padding = where content goes (Android content area / Godot content margins).

Verification (tools/engine-verify/ui, real engines, Kenney CC0 art):
${Object.entries(VERIFY.kit).map(([k,v])=>`* ${k}: ${status('kit',k)}`).join('\n')}
`;
// ------------------------------------------------------------------ fonts
const fieldNote=m=>m.type==='bitmap'?'bitmap (white glyphs in alpha; tint freely)':`${m.type.toUpperCase()} distance field, distanceRange ${m.distanceRange} px at ${m.size} px/em`;
export const godotFontReadme=({name,m})=>`# ${name} — Godot 4 (${status('font','godot')})

${m.type==='bitmap'?`Drop \`${name}.fnt\` and its PNG page(s) into the project: Godot imports a BMFont as a FontFile.
For pixel fonts set the texture filter to Nearest and use the size ${m.size} (or a whole multiple).`:`\`nerulio_font_import.gd\` builds a FontFile from \`${name}.json\` + the page PNGs (${fieldNote(m)}) and saves it.
Run it from the editor (File › Run with the script open) or call NerulioFontImport.build(json_path).`}
`;
export const unityFontReadme=({name,m})=>`# ${name} — Unity TextMeshPro (${status('font','unity')})

Put this folder under Assets/. \`Editor/NerulioTMPFontImporter.cs\` creates a TMP_FontAsset from
\`${name}.json\` + the page PNG (${fieldNote(m)}). Menu: Tools › Nerulio › Import TMP font.
TextMeshPro renders SDF (single channel, in alpha) and bitmap fonts; MSDF is not a TMP format.
`;
export const phaserFontReadme=({name,m})=>`# ${name} — Phaser (${status('font','phaser')})

\`\`\`js
this.load.bitmapFont('${name}', '${m.pages[0].file}', '${name}.xml');
this.add.bitmapText(x, y, '${name}', 'Text', ${m.size});
\`\`\`
Phaser reads the XML flavour of BMFont. ${m.type==='bitmap'?'':'Phaser draws distance-field pages as plain bitmaps (no SDF shader).'}
`;
export const pixiFontReadme=({name,m})=>`# ${name} — PixiJS 8 (${status('font','pixi')})

\`\`\`js
await PIXI.Assets.load('${name}.fnt');
new PIXI.BitmapText({ text: 'Text', style: { fontFamily: '${m.face}', fontSize: ${m.size} } });
\`\`\`
${m.type==='bitmap'?'':`The .fnt carries \`distanceField fieldType=${m.type} distanceRange=${m.distanceRange}\`; Pixi 8 renders it with its SDF/MSDF shader at any size.`}
`;
export const fontReadme=({name,m,targets,missing,source})=>`# ${name} — game font from Nerulio Studio

${m.glyphs.length} glyphs, ${m.pages.length} page(s) of ${m.pages[0].width}×${m.pages[0].height}, ${fieldNote(m)}.
lineHeight ${m.lineHeight}, base ${m.base}, ${m.kerning.filter(k=>k.amount).length} kerning pairs (whole px; the msdf-atlas-gen JSON keeps all ${m.kerning.length} in em units).
${missing.length?`\n${missing.length} character(s) of the charset are not in the font: see missing-glyphs.txt.\n`:''}
Source font: ${source.family||m.face}. ${source.license?`Licence (from the font's name table): ${String(source.license).slice(0,400)}`:'Check the source font licence before shipping the atlas.'}

Folders: ${targets.join(', ')}. Verification (tools/engine-verify/ui):
${Object.entries(VERIFY.font).map(([k])=>`* ${k}: ${status('font',k)}`).join('\n')}
`;
