/** Godot 4 export: a native `SpriteFrames` resource (.tres) of `AtlasTexture`s, and a small scene
 * (.tscn) with an `AnimatedSprite2D` that uses it with NEAREST filtering and the pivot as offset.
 *
 * Native text resources are written here ONLY because they are loaded by Godot 4.7.2 itself in
 * tools/engine-verify (probe mode "spriteframes-tres": ResourceLoader.load, every animation's frame
 * count, speed, loop, relative durations, AtlasTexture region/margin, and pixels drawn at 1× and 4×).
 * See docs/STUDIO-PACK.md for the run. Format notes that were checked against that engine:
 *  * `format=3` text resources; `ext_resource` paths may be RELATIVE to the .tres (Godot resolves
 *    them against the resource's own folder), so the folder can live anywhere under res://.
 *  * `AnimatedSprite2D` durations are relative to the animation speed: 250 ms at 12 fps = 3.0.
 *  * `AtlasTexture.margin = Rect2(offset, sourceSize − regionSize)` restores a trimmed frame's size.
 *  * AtlasTexture cannot rotate a region → a rotated pack is refused (the Godot preset never rotates).
 *  * Texture filtering is a CanvasItem property, not a texture one: a node that inherits the default
 *    project filter (Linear) blurs pixel art. The scene sets `texture_filter = 1` (Nearest); the
 *    README says how to make Nearest the project default instead. */
import {frameRows,playback,frameKeys,pageNames,stemOf,round,requireNoRotation,GENERATOR} from './common.js';
const num=v=>{const r=round(v,6);return Number.isInteger(r)?`${r}.0`:String(r);};
const str=s=>'"'+String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
/** A Variant value in Godot's text resource syntax (Dictionary / Array / String / float / bool). */
function variant(v){
 if(v==null)return 'null';
 if(typeof v==='boolean')return v?'true':'false';
 if(typeof v==='number')return Number.isInteger(v)?String(v):num(v);
 if(typeof v==='string')return str(v);
 if(Array.isArray(v))return `[${v.map(variant).join(', ')}]`;
 return `{\n${Object.entries(v).map(([k,x])=>`${str(k)}: ${variant(x)}`).join(',\n')}\n}`;
}
export function godotFiles(model,variant_,{base=stemOf(model.name),nearest=true}={}){
 const v=variant_;requireNoRotation(v,'Godot AtlasTexture');
 const keys=frameKeys(model),rows=frameRows(model,v,{base,keys}),names=pageNames(base,v),anims=playback(model,keys),notes=[];
 if(!anims.length)throw Object.assign(Error('Godot SpriteFrames needs at least one animation (tag).'),{code:'no-animation'});
 const byKey=new Map(rows.map(r=>[r.key,r]));
 // One AtlasTexture per distinct region+margin: identical frames share one sub-resource.
 const subs=new Map(),subOf=new Map();
 for(const r of rows){
  const sig=`${r.page}:${r.x},${r.y},${r.w},${r.h}:${r.ox},${r.oy},${r.sourceW},${r.sourceH}`;
  if(!subs.has(sig))subs.set(sig,{id:`AtlasTexture_${subs.size+1}`,r});
  subOf.set(r.key,subs.get(sig).id);
 }
 const tex=names.map((n,i)=>({id:`${i+1}_page`,name:n}));
 const out=[`[gd_resource type="SpriteFrames" load_steps=${tex.length+subs.size+1} format=3]`,''];
 for(const t of tex)out.push(`[ext_resource type="Texture2D" path=${str(t.name)} id=${str(t.id)}]`);
 out.push('');
 for(const {id,r} of subs.values()){
  out.push(`[sub_resource type="AtlasTexture" id=${str(id)}]`,`atlas = ExtResource(${str(tex[r.page].id)})`,
   `region = Rect2(${r.x}, ${r.y}, ${r.w}, ${r.h})`);
  if(r.ox||r.oy||r.sourceW!==r.w||r.sourceH!==r.h)out.push(`margin = Rect2(${r.ox}, ${r.oy}, ${r.sourceW-r.w}, ${r.sourceH-r.h})`);
  out.push('filter_clip = true','');
 }
 const animText=anims.map(a=>{
  const tick=1000/a.fps;
  const frames=a.steps.map(s=>`{\n"duration": ${num(s.ms/tick)},\n"texture": SubResource(${str(subOf.get(s.key))})\n}`).join(', ');
  return `{\n"frames": [${frames}],\n"loop": ${a.loop?'true':'false'},\n"name": &${str(a.name)},\n"speed": ${num(a.fps)}\n}`;
 }).join(', ');
 const extras={generator:GENERATOR.name,schemaVersion:1,frames:Object.fromEntries(rows.map(r=>[r.key,{
  pivot:[round(r.pivotPx.x,3),round(r.pivotPx.y,3)],source_size:[r.sourceW,r.sourceH],tag:r.frame.tag||'',
  boxes:(r.frame.boxes||[]).map(b=>({...b})),collision:(r.frame.collision||[]).map(p=>p.flat())}]))};
 out.push('[resource]',`metadata/nerulio = ${variant(extras)}`,`animations = [${animText}]`,'');
 const tres=`${base}${v.suffix}.tres`;
 // The preview scene: pivot of the first frame of the first animation on the node origin.
 const first=byKey.get(anims[0].steps[0].key),node=base.replace(/[^\w]/g,'_').replace(/^(\d)/,'_$1')||'Sprite';
 const scene=[`[gd_scene load_steps=2 format=3]`,'',`[ext_resource type="SpriteFrames" path=${str(tres)} id="1_frames"]`,'',
  `[node name=${str(node)} type="AnimatedSprite2D"]`,...(nearest?['texture_filter = 1']:[]),'sprite_frames = ExtResource("1_frames")',
  `animation = &${str(anims[0].name)}`,`autoplay = ${str(anims[0].name)}`,'centered = false',
  `offset = Vector2(${num(-first.pivotPx.x)}, ${num(-first.pivotPx.y)})`,''].join('\n');
 const pivotsDiffer=anims.some(a=>{const p=a.steps.map(s=>byKey.get(s.key).pivotPx);return p.some(q=>Math.abs(q.x-p[0].x)>.01||Math.abs(q.y-p[0].y)>.01);});
 if(pivotsDiffer)notes.push('Frames of one animation have different pivots; AnimatedSprite2D has one offset per node, so the scene uses the first frame\'s pivot (every pivot is kept in metadata/nerulio).');
 if(rows.some(r=>(r.frame.boxes||[]).length||(r.frame.collision||[]).length))notes.push('Hitboxes and collision polygons are stored in the resource metadata ("nerulio"), not as nodes.');
 const readme=`# Godot 4 (tested in 4.7.2)

Files: \`${tres}\` (SpriteFrames), \`${base}${v.suffix}.tscn\` (an AnimatedSprite2D using it), ${names.map(n=>`\`${n}\``).join(', ')}.

1. Copy the whole folder anywhere under your project (\`res://\`). The resource refers to the
   PNG${names.length>1?'s':''} by a relative path, so keep them together.
2. Drag \`${base}${v.suffix}.tscn\` into a scene, or put \`${tres}\` on your own AnimatedSprite2D's **Sprite Frames**.

Pixel art stays sharp only with **Nearest** filtering. The scene sets it on its node
(\`texture_filter = Nearest\`). For your own nodes set **Project Settings › Rendering › Textures ›
Canvas Textures › Default Texture Filter = Nearest** once, or set the node's Texture › Filter.
The PNG import defaults (Lossless, no mipmaps) are right for 2D and need no change.

* Per-frame durations are relative to each animation's speed (Godot's own rule); your milliseconds
  are already converted. Reverse and ping-pong are baked into the frame order.
* Trimmed frames keep their full size through \`AtlasTexture.margin\`.
* Pivots, tags, hitboxes and collision polygons: \`sprite_frames.get_meta("nerulio")\`.
* Godot 3.x cannot read this (no per-frame duration, different resource format).
`;
 // Import settings for each page, read by Godot's own importer (it fills in uid/dest itself):
 // lossless, no mipmaps, and fix_alpha_border OFF — Godot's default recolours every pixel under
 // alpha 20 with its nearest opaque neighbour (measured on the 4096² FX sheet: faint sparks
 // (255,204,0,10) came back (255,255,230,10)), which is not the art that was packed.
 const imports=names.map(n=>({name:`${n}.import`,type:'text/plain',text:`[remap]\n\nimporter="texture"\ntype="CompressedTexture2D"\n\n[params]\n\ncompress/mode=0\ncompress/high_quality=false\ncompress/lossy_quality=0.7\ncompress/hdr_compression=1\ncompress/normal_map=0\ncompress/channel_pack=0\nmipmaps/generate=false\nmipmaps/limit=-1\nroughness/mode=0\nroughness/src_normal=""\nprocess/fix_alpha_border=false\nprocess/premult_alpha=false\nprocess/normal_map_invert_y=false\nprocess/hdr_as_srgb=false\nprocess/hdr_clamp_exposure=false\nprocess/size_limit=0\ndetect_3d/compress_to=0\n`}));
 return {files:[{name:tres,text:out.join('\n'),type:'text/plain'},{name:`${base}${v.suffix}.tscn`,text:scene,type:'text/plain'},...imports,
  {name:'README-GODOT.md',text:readme,type:'text/markdown'}],notes,images:names};
}
