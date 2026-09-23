/** Text formats for the remaining engines and tools: GameMaker strips, Defold (.atlas + .tilesource),
 * LÖVE (Lua quads), Spine / libGDX (.atlas), Starling / Sparrow (XML) and CSS sprites.
 *
 * Exporters that need per-frame images rather than atlas pages (GameMaker, Defold) describe them as
 * `compose` jobs — {width, height, items:[{id, x, y}]} where each item draws one frame's FULL canvas
 * (trim restored) at x,y — and the bundle builder draws them from the packed sprites. */
import {frameRows,playback,frameKeys,pageNames,stemOf,round,requireNoRotation,xmlEsc,luaStr,json,GENERATOR} from './common.js';

/** A common cell for frames drawn with their pivots on one point (so the origin does not drift). */
export function pivotCell(rows){
 const L=Math.max(...rows.map(r=>Math.round(r.pivotPx.x))),T=Math.max(...rows.map(r=>Math.round(r.pivotPx.y)));
 const R=Math.max(...rows.map(r=>r.sourceW-Math.round(r.pivotPx.x))),B=Math.max(...rows.map(r=>r.sourceH-Math.round(r.pivotPx.y)));
 return {w:L+R,h:T+B,originX:L,originY:T,offset:r=>({x:L-Math.round(r.pivotPx.x),y:T-Math.round(r.pivotPx.y)})};
}
const ident=s=>String(s).toLowerCase().replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'')||'sprite';
/** Folder a Defold bundle expects to live in, relative to the project root. */
export const defoldFolder=base=>`assets/${ident(base)}`;

// ------------------------------------------------------------------ GameMaker
/** GameMaker imports a horizontal strip named `<name>_strip<N>.png` as a sprite of N frames
 * (Sprite Editor › Import, or drag the PNG into the IDE). One strip per tag; every frame is drawn
 * on one common cell with its pivot on the same point, and that point is the sprite origin. */
export function gamemakerFiles(model,variant,{base=stemOf(model.name)}={}){
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),byKey=new Map(rows.map(r=>[r.key,r])),anims=playback(model,keys);
 const files=[],composes=[],sprites=[],notes=[];
 const groups=anims.length?anims.map(a=>({name:a.name,steps:a.steps,fps:a.fps,loop:a.loop})):[{name:base,steps:rows.map(r=>({key:r.key,ms:r.durationMs})),fps:12,loop:true}];
 for(const g of groups){
  const list=g.steps.map(s=>byKey.get(s.key)),cell=pivotCell(list),n=list.length;
  const name=`spr_${ident(base)}_${ident(g.name)}`,file=`${name}_strip${n}.png`;
  composes.push({name:file,width:cell.w*n,height:cell.h,items:list.map((r,i)=>{const o=cell.offset(r);return {id:r.id,x:i*cell.w+o.x,y:o.y};})});
  const ms=g.steps.map(s=>round(s.ms,3)),uniform=ms.every(v=>Math.abs(v-ms[0])<.01);
  sprites.push({name,file,frames:n,width:cell.w,height:cell.h,xorigin:cell.originX,yorigin:cell.originY,
   playbackSpeed:uniform?round(1000/ms[0],3):g.fps,playbackSpeedType:'frames per second',loop:g.loop,durationsMs:ms,uniformTiming:uniform});
  if(!uniform)notes.push(`${g.name}: frames have different durations; a GameMaker sprite has one speed (${g.fps} fps is used). The exact ms are in gamemaker.json.`);
 }
 files.push({name:'gamemaker.json',text:json({schemaVersion:1,engineTarget:'gamemaker',generator:{...GENERATOR},verified:false,sprites}),type:'application/json'});
 files.push({name:'README-GAMEMAKER.md',type:'text/markdown',text:`# GameMaker — UNVERIFIED in the engine

There is no headless GameMaker, so this export has not been loaded in GameMaker itself. The strip
naming (\`name_stripN.png\`) and the numbers below follow the GameMaker manual (Sprite Strips).

For each strip: **Create Sprite › Import** (or drag the PNG into the Asset Browser). GameMaker
cuts \`_stripN\` files into N frames. Then set in the Sprite Editor:

${sprites.map(s=>`* \`${s.file}\` → ${s.frames} frame(s) of ${s.width}×${s.height}, **Origin** x ${s.xorigin}, y ${s.yorigin}, **Speed** ${s.playbackSpeed} frames per second${s.uniformTiming?'':' (frames have different durations; see gamemaker.json)'}`).join('\n')}

Every frame of a strip is drawn with its pivot on the origin, so frames do not jump. For pixel art
turn off **Interpolate colours between pixels** (Game Options › Graphics).
`});
 return {files,composes,notes,images:[]};
}

// ------------------------------------------------------------------ Defold
const PLAYBACK=(dir,loop)=>`PLAYBACK_${loop?'LOOP':'ONCE'}_${dir==='reverse'?'BACKWARD':dir==='pingpong'?'PINGPONG':'FORWARD'}`;
/** Defold packs atlases itself at build time, so the `.atlas` lists INDIVIDUAL frame images (full
 * canvas, so frames stay aligned) plus animation groups; the `.tilesource` is the same animations
 * on one grid image (Defold tile sources need equal cells and left-to-right animation runs). Image
 * paths in Defold are project-absolute: put the folder at /assets/<name>/ or edit the paths. */
export function defoldFiles(model,variant,{base=stemOf(model.name),root='/'+defoldFolder(base),extrude=2}={}){
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),byKey=new Map(rows.map(r=>[r.key,r])),anims=playback(model,keys),notes=[];
 const composes=rows.map(r=>({name:`frames/${r.key}.png`,width:r.sourceW,height:r.sourceH,items:[{id:r.id,x:0,y:0}]}));
 const img=k=>`${root}/frames/${k}.png`;
 const atlas=[...rows.map(r=>`images {\n  image: "${img(r.key)}"\n  sprite_trim_mode: SPRITE_TRIM_MODE_OFF\n}`),
  ...anims.map(a=>`animations {\n  id: "${a.name}"\n${(a.direction==='pingpong'?a.keys:a.direction==='reverse'?[...a.keys].reverse():a.keys).map(k=>`  images {\n    image: "${img(k)}"\n    sprite_trim_mode: SPRITE_TRIM_MODE_OFF\n  }`).join('\n')}\n  playback: ${a.direction==='reverse'?PLAYBACK('forward',a.loop):PLAYBACK(a.direction,a.loop)}\n  fps: ${Math.max(1,Math.round(a.fps))}\n  flip_horizontal: 0\n  flip_vertical: 0\n}`),
  `margin: 0\nextrude_borders: ${extrude}\ninner_padding: 0\nmax_page_width: 0\nmax_page_height: 0\n`].join('\n');
 // Tile source: every animation run laid out in tile order, one common pivot-aligned cell.
 const runs=anims.length?anims.map(a=>({a,keys:a.direction==='reverse'?[...a.keys].reverse():a.keys})):[{a:{name:base,fps:12,loop:true,direction:'forward'},keys:rows.map(r=>r.key)}];
 const all=runs.flatMap(r=>r.keys.map(k=>byKey.get(k))),cell=pivotCell(all),total=all.length,cols=Math.max(1,Math.min(total,Math.ceil(Math.sqrt(total))));
 const items=[];let t=0;const animDefs=[];
 for(const r of runs){const start=t+1;for(const k of r.keys){const row=byKey.get(k),o=cell.offset(row);items.push({id:row.id,x:(t%cols)*cell.w+o.x,y:Math.floor(t/cols)*cell.h+o.y});t++;}
  animDefs.push(`animations {\n  id: "${r.a.name}"\n  start_tile: ${start}\n  end_tile: ${t}\n  playback: ${r.a.direction==='reverse'?PLAYBACK('forward',r.a.loop):PLAYBACK(r.a.direction,r.a.loop)}\n  fps: ${Math.max(1,Math.round(r.a.fps))}\n  flip_horizontal: 0\n  flip_vertical: 0\n}`);}
 composes.push({name:`${base}_tiles.png`,width:cols*cell.w,height:Math.ceil(total/cols)*cell.h,items});
 const tilesource=[`image: "${root}/${base}_tiles.png"`,`tile_width: ${cell.w}`,`tile_height: ${cell.h}`,'tile_margin: 0','tile_spacing: 0','collision: ""','material_tag: "tile"',
  ...animDefs,`extrude_borders: ${extrude}`,'inner_padding: 0','sprite_trim_mode: SPRITE_TRIM_MODE_OFF',''].join('\n');
 if(anims.some(a=>{const ms=a.steps.map(s=>s.ms);return ms.some(v=>Math.abs(v-ms[0])>.01);}))notes.push('Defold animations have one fps; frames with their own durations play at the animation fps.');
 if(anims.some(a=>!Number.isInteger(a.fps)))notes.push('Defold fps is a whole number; fractional fps were rounded.');
 return {files:[{name:`${base}.atlas`,text:atlas,type:'text/plain'},{name:`${base}.tilesource`,text:tilesource,type:'text/plain'},
  {name:'README-DEFOLD.md',type:'text/markdown',text:`# Defold (built with bob.jar 1.13.1)

1. Copy this folder into your project as \`${root}/\` (the \`.atlas\` and \`.tilesource\` use absolute
   project paths starting with \`${root}/\`; if you put it elsewhere, search-and-replace that prefix).
2. Use \`${base}.atlas\` (Defold packs the frame images itself) **or** \`${base}.tilesource\`
   (one grid image, cell ${cell.w}×${cell.h}) as the Image of a Sprite component, and pick an animation.

Frames are full-canvas images (trim off), so every frame keeps its place. Defold plays each
animation at one fps; per-frame durations are not representable. For pixel art set the sprite
material's sampler, or in game.project \`graphics.default_texture_min_filter/mag_filter = nearest\`.
`}],composes,notes,images:[]};
}

// ------------------------------------------------------------------ LÖVE
/** LÖVE has no atlas format; this is the Lua table of quads plus a tiny player. `ox, oy` put a
 * trimmed frame back where it was on its canvas; `px, py` is the pivot. Rotated frames are refused. */
export function loveFiles(model,variant,{base=stemOf(model.name)}={}){
 requireNoRotation(variant,'LÖVE quads');
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant),anims=playback(model,keys);
 const L=[`-- ${base}${variant.suffix}.lua — generated by ${GENERATOR.name}. Pixels, origin top-left.`,`return {`,
  `  images = { ${names.map(luaStr).join(', ')} },`,
  `  pages = { ${variant.pages.map(p=>`{ w = ${p.width}, h = ${p.height} }`).join(', ')} },`,`  frames = {`];
 for(const r of rows)L.push(`    [${luaStr(r.key)}] = { page = ${r.page+1}, x = ${r.x}, y = ${r.y}, w = ${r.w}, h = ${r.h}, ox = ${r.ox}, oy = ${r.oy}, sw = ${r.sourceW}, sh = ${r.sourceH}, px = ${round(r.pivotPx.x,3)}, py = ${round(r.pivotPx.y,3)} },`);
 L.push('  },','  order = {',...rows.map(r=>`    ${luaStr(r.key)},`),'  },','  animations = {');
 for(const a of anims)L.push(`    [${luaStr(a.name)}] = { loop = ${a.loop}, frames = { ${a.steps.map(s=>luaStr(s.key)).join(', ')} }, durations = { ${a.steps.map(s=>round(s.ms/1000,6)).join(', ')} } },`);
 L.push('  },','}','');
 const lib=`-- nerulio_atlas.lua — loads ${base}${variant.suffix}.lua and draws frames/animations with LÖVE 11.
local Atlas = {}
Atlas.__index = Atlas

function Atlas.load(path)
  love.graphics.setDefaultFilter("nearest", "nearest") -- pixel art stays sharp at any integer zoom
  local data = love.filesystem.load(path)()
  local dir = path:match("^(.*/)") or ""
  local self = setmetatable({ data = data, images = {}, quads = {} }, Atlas)
  for i, name in ipairs(data.images) do self.images[i] = love.graphics.newImage(dir .. name) end
  for key, f in pairs(data.frames) do
    local p = data.pages[f.page]
    self.quads[key] = love.graphics.newQuad(f.x, f.y, f.w, f.h, p.w, p.h)
  end
  return self
end

-- Draws a frame with its pivot at (x, y); trimmed frames are put back in place.
function Atlas:draw(key, x, y, sx, sy)
  local f = self.data.frames[key]
  sx, sy = sx or 1, sy or sx or 1
  love.graphics.draw(self.images[f.page], self.quads[key], x, y, 0, sx, sy, f.px - f.ox, f.py - f.oy)
end

-- A tiny player: anim = atlas:play("run"); anim:update(dt); anim:draw(x, y)
function Atlas:play(name)
  local a = assert(self.data.animations[name], "no animation " .. name)
  return { atlas = self, a = a, i = 1, t = 0,
    update = function(p, dt)
      p.t = p.t + dt
      while p.t >= p.a.durations[p.i] do
        p.t = p.t - p.a.durations[p.i]
        if p.i < #p.a.frames then p.i = p.i + 1 elseif p.a.loop then p.i = 1 else p.t = 0 break end
      end
    end,
    draw = function(p, x, y, sx, sy) p.atlas:draw(p.a.frames[p.i], x, y, sx, sy) end }
end

return Atlas
`;
 const main=`-- main.lua — example: shows the first animation at 4x. Run with: love .
local Atlas = require("nerulio_atlas")
local atlas, anim

function love.load()
  atlas = Atlas.load("${base}${variant.suffix}.lua")
  ${anims.length?`anim = atlas:play(${luaStr(anims[0].name)})`:'anim = nil'}
end

function love.update(dt) if anim then anim:update(dt) end end

function love.draw()
  if anim then anim:draw(200, 200, 4) else atlas:draw(${luaStr(rows[0].key)}, 200, 200, 4) end
end
`;
 return {files:[{name:`${base}${variant.suffix}.lua`,text:L.join('\n'),type:'text/plain'},{name:'nerulio_atlas.lua',text:lib,type:'text/plain'},
  {name:'main.lua',text:main,type:'text/plain'},{name:'README-LOVE.md',type:'text/markdown',text:`# LÖVE 11 (drawn by LÖVE 11.5 in tools/engine-verify)

\`love .\` in this folder plays the first animation. In your game: \`local Atlas = require("nerulio_atlas")\`,
\`atlas = Atlas.load("${base}${variant.suffix}.lua")\`, then \`atlas:draw(key, x, y)\` or \`atlas:play(name)\`.
\`nerulio_atlas.lua\` sets \`love.graphics.setDefaultFilter("nearest", "nearest")\` for pixel art.
Frame \`ox, oy\` restore trimmed frames; \`px, py\` is the pivot (the draw position).
`}],notes:[],images:names};
}

// ------------------------------------------------------------------ Spine / libGDX
/** The libGDX/Spine 4 text atlas. `offsets` are libGDX's: x from the left, y from the BOTTOM of the
 * original frame. Rotated regions are written `rotate: 90` (stored 90° clockwise, the same pixels
 * Phaser/Pixi read). UNVERIFIED: no Spine or libGDX runtime runs in tools/engine-verify yet. */
export function spineFiles(model,variant,{base=stemOf(model.name),filter='Nearest',pma=false}={}){
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant),out=[];
 names.forEach((image,i)=>{
  if(i)out.push('');
  out.push(image,`size:${variant.pages[i].width},${variant.pages[i].height}`,`filter:${filter},${filter}`,`pma:${pma?'true':'false'}`);
  for(const r of rows.filter(q=>q.page===i)){
   out.push(r.key,`bounds:${r.x},${r.y},${r.region.w},${r.region.h}`);
   if(r.trimmed)out.push(`offsets:${r.ox},${r.sourceH-r.oy-r.h},${r.sourceW},${r.sourceH}`);
   if(r.rotated)out.push('rotate:90');
  }
 });
 return {files:[{name:`${base}${variant.suffix}.atlas`,text:out.join('\n')+'\n',type:'text/plain'},
  {name:'README-SPINE-LIBGDX.md',type:'text/markdown',text:`# Spine / libGDX texture atlas — UNVERIFIED

The Spine 4 / libGDX (1.10+) text atlas format: page lines (\`size\`, \`filter\`, \`pma\`), then one
entry per region with \`bounds\`, \`offsets\` (x from the left, y from the bottom of the original
frame, original width and height) and \`rotate:90\` for rotated regions. No Spine or libGDX runtime
has loaded this file in Nerulio's verification harness yet; check one frame before relying on it.
libGDX: \`new TextureAtlas(Gdx.files.internal("${base}${variant.suffix}.atlas"))\`.
`}],notes:['Spine/libGDX atlas: UNVERIFIED in a runtime.'],images:names};
}

// ------------------------------------------------------------------ Starling / Sparrow XML
/** Starling / Sparrow / HaxeFlixel XML. Trimmed frames use frameX/frameY (negative offsets) and
 * frameWidth/frameHeight. Phaser 3.90's XML parser passes those to setTrim in the wrong order, so a
 * trimmed XML frame is drawn wrongly in Phaser 3 (Phaser 4 is fixed); the "Sparrow XML (Phaser 3)"
 * preset turns trim off, which loads correctly everywhere. One XML per page. */
export function starlingFiles(model,variant,{base=stemOf(model.name)}={}){
 requireNoRotation(variant,'Starling/Sparrow XML (Phaser ignores its rotated attribute)');
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant),files=[];
 names.forEach((image,i)=>{
  const mine=rows.filter(r=>r.page===i);
  files.push({name:image.replace(/\.png$/,'.xml'),type:'application/xml',text:`<?xml version="1.0" encoding="UTF-8"?>
<!-- ${GENERATOR.name} -->
<TextureAtlas imagePath="${xmlEsc(image)}" width="${variant.pages[i].width}" height="${variant.pages[i].height}">
${mine.map(r=>`  <SubTexture name="${xmlEsc(r.key)}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"${r.trimmed?` frameX="${-r.ox}" frameY="${-r.oy}" frameWidth="${r.sourceW}" frameHeight="${r.sourceH}"`:''} pivotX="${round(r.pivotPx.x,3)}" pivotY="${round(r.pivotPx.y,3)}"/>`).join('\n')}
</TextureAtlas>
`});
 });
 const notes=rows.some(r=>r.trimmed)?['Trimmed frames in XML: Phaser 3.90 draws them wrongly (its AtlasXML parser swaps trimmed and full sizes); Phaser 4, Starling and HaxeFlixel read them. Use the "Sparrow XML (Phaser 3)" preset (trim off) for Phaser 3.']:[];
 return {files,notes,images:names};
}

// ------------------------------------------------------------------ CSS sprites
/** `.sprite-<key>` classes with the frame's own size and background position. CSS cannot hide the
 * neighbours of a trimmed frame inside its full box, so CSS output uses untrimmed frames (the CSS
 * preset sets trim off) and refuses rotation. `image-rendering: pixelated` keeps pixel art sharp. */
export function cssFiles(model,variant,{base=stemOf(model.name),prefix='sprite'}={}){
 requireNoRotation(variant,'CSS sprites');
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant),notes=[];
 if(rows.some(r=>r.trimmed))notes.push('Some frames are trimmed: their CSS box is the trimmed size (use the CSS preset, trim off, to keep full frames).');
 const cls=k=>`${prefix}-${String(k).replace(/[^\w-]+/g,'-')}`;
 const css=[`/* ${GENERATOR.name} — ${names.join(', ')} */`,`.${prefix}{display:inline-block;background-repeat:no-repeat;image-rendering:pixelated;}`,
  ...names.map((n,i)=>`.${prefix}-page-${i}{background-image:url("${n}");background-size:${variant.pages[i].width}px ${variant.pages[i].height}px;}`),
  ...rows.map(r=>`.${cls(r.key)}{width:${r.w}px;height:${r.h}px;background-position:${-r.x}px ${-r.y}px;}`)].join('\n')+'\n';
 const html=`<!doctype html><meta charset="utf-8"><title>${xmlEsc(base)} sprites</title><link rel="stylesheet" href="${base}${variant.suffix}.css">
<style>body{background:#222;color:#ddd;font:12px system-ui}figure{display:inline-block;margin:8px;text-align:center}.${prefix}{zoom:4}</style>
${rows.map(r=>`<figure><i class="${prefix} ${prefix}-page-${r.page} ${cls(r.key)}"></i><figcaption>${xmlEsc(r.key)}</figcaption></figure>`).join('\n')}
`;
 return {files:[{name:`${base}${variant.suffix}.css`,text:css,type:'text/css'},{name:`${base}${variant.suffix}.html`,text:html,type:'text/html'}],notes,images:names};
}
