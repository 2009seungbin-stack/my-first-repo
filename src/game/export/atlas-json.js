/** JSON atlas formats built on TexturePacker's frame layout: Phaser 3/4 (atlas, multiatlas and an
 * animations file for `anims.fromJSON`), PixiJS 8 (spritesheet with `animations`,
 * `related_multi_packs`, `meta.scale`), Aseprite JSON (hash/array with frameTags and slices) and the
 * generic Nerulio JSON (which is TexturePacker-compatible, so a web engine can load it as is). */
import {GENERATOR,SCHEMA_VERSION,frameRows,playback,frameKeys,pageNames,stemOf,round,json,tpFrame,durationOf} from './common.js';

const metaOf=(variant,image,page,extra={})=>({app:GENERATOR.url,version:GENERATOR.version,generator:GENERATOR.name,image,format:'RGBA8888',
 size:{w:variant.pages[page].width,h:variant.pages[page].height},scale:String(variant.scale),...extra});

// ------------------------------------------------------------------ Phaser 3 / 4
/** Phaser: `atlas.json` (hash) for one page, a multiatlas `{textures:[…]}` for several, plus
 * `<name>.anims.json` for `this.anims.fromJSON(this.cache.json.get(key))`. Per-frame durations are
 * absolute ms (Phaser 3.60+ reads AnimationFrame.duration as the frame's own time), ping-pong is
 * `yoyo`, reverse is baked, loop is `repeat:-1`. */
export function phaserFiles(model,variant,{base=stemOf(model.name),textureKey=base}={}){
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant),files=[],notes=[];
 const multi=variant.pages.length>1;
 const dataName=multi?`${base}${variant.suffix}.multiatlas.json`:`${base}${variant.suffix}.json`;
 if(!multi){
  files.push({name:dataName,text:json({frames:Object.fromEntries(rows.map(r=>[r.key,tpFrame(r)])),meta:{...metaOf(variant,names[0],0),premultipliedAlpha:false}}),type:'application/json'});
 }else{
  files.push({name:dataName,text:json({textures:names.map((image,i)=>({image,format:'RGBA8888',size:{w:variant.pages[i].width,h:variant.pages[i].height},scale:variant.scale,
   frames:rows.filter(r=>r.page===i).map(r=>({filename:r.key,...tpFrame(r)}))})),meta:metaOf(variant,names[0],0,{image:undefined})}),type:'application/json'});
 }
 const anims=playback(model,keys).map(a=>({key:a.name,type:'frame',
  frames:(a.direction==='pingpong'?a.frameIds.map((id,i)=>({id,key:a.keys[i]})):a.steps.map(s=>({id:s.id,key:s.key}))).map(s=>({key:textureKey,frame:s.key,duration:round(durationOf(model.frames.find(f=>f.id===s.id),model),3)})),
  // Phaser's repeat counts EXTRA plays: Aseprite/Studio "play 3 times" is repeat 2.
  frameRate:a.fps,repeat:a.loop?-1:Math.max(0,a.repeat-1),yoyo:a.direction==='pingpong',skipMissedFrames:true,delay:0,repeatDelay:0,showOnStart:false,hideOnComplete:false}));
 const animName=`${base}${variant.suffix}.anims.json`;
 if(anims.length)files.push({name:animName,text:json({anims,globalTimeScale:1}),type:'application/json'});
 else notes.push('No animations: the project has no tags, so no Phaser animations file was written.');
 files.push({name:'README-PHASER.md',type:'text/markdown',text:`# Phaser 3 / Phaser 4

\`\`\`js
preload() {
  this.load.${multi?'multiatlas':'atlas'}('${textureKey}', '${multi?dataName+"', '":names[0]+"', '"+dataName}');${anims.length?`
  this.load.json('${textureKey}-anims', '${animName}');`:''}
}
create() {${anims.length?`
  this.anims.fromJSON(this.cache.json.get('${textureKey}-anims'));`:''}
  const sprite = this.add.sprite(100, 100, '${textureKey}', '${rows[0].key}');${anims.length?`
  sprite.play('${anims[0].key}');`:''}
}
\`\`\`

* Pixel art: create the game with \`pixelArt: true\` (nearest filtering, rounded positions).
* Frame names are the keys in the JSON; trimmed frames keep their full size and offset.
* Durations are per frame in milliseconds; ping-pong animations use \`yoyo\`.
* Loaded and drawn by Phaser ${'3.90'} and ${'4.2'} in tools/engine-verify (docs/STUDIO-PACK.md).
`});
 return {files,notes,images:names};
}

// ------------------------------------------------------------------ PixiJS 8
/** PixiJS 8 `Assets.load('hero.json')` → Spritesheet. Several pages are linked with
 * `meta.related_multi_packs`, loaded automatically. `animations` lists frames in playback order
 * (Pixi's AnimatedSprite has no ping-pong or per-frame time of its own; the ms per step are in
 * `meta.nerulio.animations` for `new AnimatedSprite(frames.map((texture, i) => ({texture, time})))`). */
export function pixiFiles(model,variant,{base=stemOf(model.name)}={}){
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant),files=[],notes=[];
 const anims=playback(model,keys);
 const jsonNames=names.map(n=>n.replace(/\.png$/,'.json'));
 names.forEach((image,i)=>{
  const mine=rows.filter(r=>r.page===i);
  const data={frames:Object.fromEntries(mine.map(r=>[r.key,{...tpFrame(r,{pivot:false}),anchor:{x:round(r.pivotX),y:round(r.pivotY)}}])),
   meta:metaOf(variant,image,i,{...(jsonNames.length>1?{related_multi_packs:jsonNames.filter((_,k)=>k!==i)}:{})})};
  if(i===0&&anims.length){
   data.animations=Object.fromEntries(anims.map(a=>[a.name,a.steps.map(s=>s.key)]));
   data.meta.nerulio={animations:Object.fromEntries(anims.map(a=>[a.name,{fps:a.fps,loop:a.loop,direction:a.direction,durationsMs:a.steps.map(s=>round(s.ms,3))}]))};
  }
  files.push({name:jsonNames[i],text:json(data),type:'application/json'});
 });
 if(!anims.length)notes.push('No animations: the project has no tags.');
 if(jsonNames.length>1)notes.push('Pixi keeps each page as its own Spritesheet; `animations` is on the first page and may name frames from other pages — look textures up with Assets.cache or Texture.from(name).');
 files.push({name:'README-PIXI.md',type:'text/markdown',text:`# PixiJS 8

\`\`\`js
import { Assets, AnimatedSprite, Sprite, TextureSource } from 'pixi.js';
TextureSource.defaultOptions.scaleMode = 'nearest'; // pixel art
const sheet = await Assets.load('${jsonNames[0]}');${anims.length?`
const { durationsMs } = sheet.data.meta.nerulio.animations['${anims[0].name}'];
const hero = new AnimatedSprite(sheet.animations['${anims[0].name}'].map((texture, i) => ({ texture, time: durationsMs[i] })));
hero.play();`:`
const sprite = new Sprite(sheet.textures['${rows[0].key}']);`}
\`\`\`

* Each texture's default anchor is the frame's pivot (\`anchor\` in the JSON).
* \`meta.scale\` is the variant's scale (${variant.scale}); Pixi treats it as the resolution, so an @2x sheet draws at the same size as @1x, sharper.
* Loaded and drawn by PixiJS 8.21 in tools/engine-verify (docs/STUDIO-PACK.md).
`});
 return {files,notes,images:names};
}

// ------------------------------------------------------------------ Aseprite JSON
/** Frames in an order where every tag is one contiguous run (Aseprite's frameTags are from..to
 * ranges). A frame shared by two tags, or tags whose frames are not in document order, gets a
 * duplicate entry pointing at the same atlas region — nothing is dropped. */
export function asepriteSequence(model){
 const seq=[],tags=[];
 const findRun=ids=>{outer:for(let s=0;s+ids.length<=seq.length;s++){for(let k=0;k<ids.length;k++)if(seq[s+k]!==ids[k])continue outer;return s;}return -1;};
 for(const a of model.animations){
  if(!a.frameIds.length)continue;
  let from=findRun(a.frameIds);
  if(from<0){from=seq.length;seq.push(...a.frameIds);}
  tags.push({anim:a,from,to:from+a.frameIds.length-1});
 }
 const used=new Set(seq);for(const f of model.frames)if(!used.has(f.id))seq.push(f.id);
 return {seq,tags};
}
const hex2=v=>Math.max(0,Math.min(255,v|0)).toString(16).padStart(2,'0');
const tagColor=c=>{const m=/^#?([0-9a-f]{6})/i.exec(c||'');return m?`#${m[1].toLowerCase()}ff`:'#000000ff';};
/** @param names 'index' → keys "0","1",… (what Phaser's createFromAseprite reads; Aseprite's
 *   --filename-format "{frame}"), 'title' → Aseprite's default "{title} {frame}.aseprite"-style keys. */
export function asepriteJson(model,variant,{base=stemOf(model.name),layout='hash',names:naming='index'}={}){
 if(variant.pages.length>1)throw Object.assign(Error('Aseprite JSON describes one sheet image. Raise the page size or turn multipack off for this export.'),{code:'multipage'});
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),byId=new Map(rows.map(r=>[r.id,r])),image=pageNames(base,variant)[0];
 const {seq,tags}=asepriteSequence(model);
 const entryKey=i=>naming==='index'?String(i):`${base} ${i}.aseprite`;
 const entries=seq.map((id,i)=>{const r=byId.get(id);return [entryKey(i),{...tpFrame(r,{pivot:false}),duration:Math.round(r.durationMs)}];});
 const frameTags=tags.map(({anim:a,from,to})=>({name:a.name,from,to,direction:a.direction==='pingpong'?'pingpong':a.direction==='reverse'?'reverse':'forward',
  color:tagColor(a.color),...(a.repeat>0?{repeat:String(a.repeat)}:a.loop===false?{repeat:'1'}:{})}));
 // Slices: the pivot of every frame, and each box type/slot, keyed on the frames where they change.
 const slices=[];
 const pivotKeys=[];let last='';
 seq.forEach((id,i)=>{const r=byId.get(id),k=`${r.sourceW},${r.sourceH},${Math.round(r.pivotPx.x)},${Math.round(r.pivotPx.y)}`;
  if(k!==last){pivotKeys.push({frame:i,bounds:{x:0,y:0,w:r.sourceW,h:r.sourceH},pivot:{x:Math.round(r.pivotPx.x),y:Math.round(r.pivotPx.y)}});last=k;}});
 if(pivotKeys.length)slices.push({name:'pivot',color:'#0000ffff',keys:pivotKeys});
 // Box slices: one slice per box type and slot; a key only where the box changes (Aseprite keys
 // hold until the next key), and an empty 0×0 key where the box stops, so it does not carry over to
 // frames that have none. Bounds are frame-canvas pixels and may lie outside the canvas (unclamped).
 const boxAt=(f,type,slot)=>(f.boxes||[]).filter(b=>b.shape==='rect'&&(b.type||'box')===type)[slot]||null;
 const slotNames=new Map();
 seq.forEach(id=>{const f=byId.get(id).frame,count={};for(const b of (f.boxes||[]).filter(b=>b.shape==='rect')){const ty=b.type||'box',n=count[ty]=(count[ty]||0)+1;slotNames.set(`${ty}${n>1?'_'+(n-1):''}`,[ty,n-1]);}});
 const boxSlots=new Map();
 for(const [name,[type,slot]] of slotNames){
  const keys=[];let last=null;
  seq.forEach((id,i)=>{const b=boxAt(byId.get(id).frame,type,slot),s_=variant.scale;
   const bounds=b?{x:Math.round(b.x*s_),y:Math.round(b.y*s_),w:Math.max(1,Math.round(b.w*s_)),h:Math.max(1,Math.round(b.h*s_))}:{x:0,y:0,w:0,h:0};
   const k=JSON.stringify(bounds);if(k!==last){keys.push({frame:i,bounds});last=k;}});
  boxSlots.set(name,keys);
 }
 for(const [name,keysList] of boxSlots)slices.push({name,color:name.startsWith('hurt')?'#00ff00ff':'#ff0000ff',keys:keysList});
 const meta={...metaOf(variant,image,0),frameTags,layers:[{name:'Layer 1',opacity:255,blendMode:'normal'}],slices};
 const frames=layout==='array'?entries.map(([k,v])=>({filename:k,...v})):Object.fromEntries(entries);
 const notes=[];
 if(rows.some(r=>r.rotated))notes.push('Aseprite itself never writes rotated frames; Phaser and Pixi read them, other Aseprite JSON readers may not.');
 if(seq.length>model.frames.length)notes.push(`${seq.length-model.frames.length} frame entr${seq.length-model.frames.length===1?'y is':'ies are'} repeated so every tag is one from..to range.`);
 return {name:`${base}${variant.suffix}.json`,text:json({frames,meta}),notes,image};
}
export function asepriteJsonFiles(model,variant,options={}){
 const one=asepriteJson(model,variant,options);
 return {files:[{name:one.name,text:one.text,type:'application/json'},{name:'README-ASEPRITE-JSON.md',type:'text/markdown',text:`# Aseprite JSON (${options.layout||'hash'})

The layout Aseprite writes with File › Export Sprite Sheet (JSON Data, ${options.layout==='array'?'Array':'Hash'}), with
\`meta.frameTags\` (direction, repeat), \`meta.slices\` (a \`pivot\` slice and one slice per box type) and per-frame
\`duration\` in milliseconds. Frame keys are ${options.names==='title'?'"{title} {frame}.aseprite"':'frame numbers ("0", "1", …), the `--filename-format "{frame}"` form'}.

* Phaser 3/4: \`this.load.aseprite(key, '${one.image}', '${one.name}')\` then \`this.anims.createFromAseprite(key)\`.
  Phaser needs the frame-number keys for that.
* PixiJS reads the frames; it builds no animations from frameTags.
* Loaded by Phaser 3.90, Phaser 4.2 and PixiJS 8.21 in tools/engine-verify (docs/STUDIO-PACK.md).
`}],notes:one.notes,images:[one.image]};
}

// ------------------------------------------------------------------ generic JSON
/** Nerulio's own JSON: every field the Studio knows (pivots, boxes, collision, tags, playback), in a
 * layout a TexturePacker reader also accepts (`frames[key].frame`, `spriteSourceSize`, `sourceSize`). */
export function genericJson(model,variant,{base=stemOf(model.name),engineTarget='generic',settings={}}={}){
 const keys=frameKeys(model),rows=frameRows(model,variant,{base,keys}),names=pageNames(base,variant);
 const frames=Object.fromEntries(rows.map(r=>[r.key,{...tpFrame(r),page:r.page,image:r.image,region:r.region,aliasOf:r.aliasOf,
  offset:{x:r.ox,y:r.oy},pivotPx:{x:round(r.pivotPx.x,3),y:round(r.pivotPx.y,3)},duration:round(r.durationMs,3),tag:r.frame.tag||'',
  boxes:(r.frame.boxes||[]).map(b=>({...b})),collision:(r.frame.collision||[]).map(p=>p.map(([x,y])=>[x,y]))}]));
 const list=playback(model,keys);
 // `animations` is the TexturePacker/Pixi form (name → frame keys in playback order), so PixiJS
 // builds them as is; everything else about an animation is in `animationData`.
 const animations=Object.fromEntries(list.map(a=>[a.name,a.steps.map(s=>s.key)]));
 const animationData=Object.fromEntries(list.map(a=>[a.name,{frames:a.keys,fps:a.fps,direction:a.direction,loop:a.loop,
  playback:{frames:a.steps.map(s=>s.key),durationsMs:a.steps.map(s=>round(s.ms,3))},totalMs:round(a.steps.reduce((n,s)=>n+s.ms,0),3)}]));
 const data={schemaVersion:SCHEMA_VERSION,engineTarget,generator:{...GENERATOR},
  meta:{...metaOf(variant,names[0],0),images:names,pages:variant.pages.map((p,i)=>({image:names[i],w:p.width,h:p.height})),
   premultipliedAlpha:!!settings.premultiply,trimMode:settings.trimMode,padding:{shape:settings.shapePadding,border:settings.borderPadding},extrude:settings.extrude,
   coordinates:'pixels, origin top-left, y down; frame = stored pixels (unrotated size), region = rectangle on the page',
   implicitAnimation:!!model.implicitAnimation},
  frames,animations,animationData};
 return {files:[{name:`${base}${variant.suffix}.nerulio.json`,text:json(data),type:'application/json'}],notes:[],images:names};
}
