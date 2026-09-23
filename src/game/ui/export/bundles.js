/** Export bundles of the UI workspace: a UI kit (9-slice elements + button states) and a game font.
 * Pure apart from PNG encoding; runs in the UI worker. Every file an engine loads comes with the
 * verification status measured by tools/engine-verify/ui (see docs/STUDIO-UI.md) — a target that
 * was not run in its engine says UNVERIFIED in its README instead of pretending.
 *
 * Kit payload: {name, elements:[{name, blob, rect, nine}], buttons:[{name, states:{state:{element}|{from, ops}}}],
 *               targets:['generic','godot','unity','android','css','phaser','pixi'], atlas:false}
 * Font payload: {name, model, pages:[{file, png}], targets:['bmfont-text','bmfont-xml','bmfont-bin','msdf-json','godot','unity','phaser','pixi'],
 *               charset:'…', missing:[…], source:{family, license}} */
import {crop,normalizeNine,toNinePatchPNG,effectivePadding} from '../nine-patch.js';
import {variant} from '../../ui-states.js';
import {encodePNG} from '../../pack/png.js';
import {layoutPages} from '../../pack/layout.js';
import {fntText,fntXML,fntBinary,msdfAtlasJSON} from '../font/formats.js';
import * as H from './helpers.js';
export const KIT_TARGETS=Object.freeze(['generic','godot','unity','android','css','phaser','pixi']);
export const FONT_TARGETS=Object.freeze(['bmfont-text','bmfont-xml','bmfont-bin','msdf-json','godot','unity','phaser','pixi']);
const enc=new TextEncoder(),txt=(name,s)=>({name,data:enc.encode(s)}),json=v=>JSON.stringify(v,null,1);
const safe=s=>String(s||'ui').normalize('NFC').replace(/[^\p{L}\p{N}_.-]+/gu,'_').replace(/^[._-]+|[._-]+$/g,'')||'ui';
/** Android resource names: lowercase ASCII letters, digits and underscore, starting with a letter. */
export const androidName=s=>{let n=String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9_]+/g,'_').replace(/^_+|_+$/g,'');if(!/^[a-z]/.test(n))n='ui_'+n;return n||'ui';};
const MODE_NUM={stretch:0,tile:1,'tile-fit':2};
/** Every element the kit ships, generated button states included, as {name, image:{w,h,data}, nine}. */
async function kitElements(p,image){
 const out=[],byName=new Map();
 for(const e of p.elements){
  const img=await image(e.blob),data=crop(img.data,img.width,img.height,e.rect);
  const it={name:safe(e.name),w:e.rect.w,h:e.rect.h,data,nine:e.nine?normalizeNine(e.nine,e.rect.w,e.rect.h):null,source:e};
  out.push(it);byName.set(e.name,it);
 }
 const buttons=[];
 for(const b of p.buttons||[]){
  const states={};const base=byName.get(b.states.normal?.element);if(!base)continue;states.normal=base.name;
  for(const [st,v] of Object.entries(b.states)){
   if(st==='normal')continue;
   if(v.element){const el=byName.get(v.element);if(el)states[st]=el.name;continue;}
   const from=byName.get(b.states[v.from||'normal']?.element)||base,r=variant(from.data,from.w,from.h,v.ops||{});
   const pad=r.pad||0,nine=from.nine?{...from.nine,border:Object.fromEntries(Object.entries(from.nine.border).map(([k,x])=>[k,x+pad])),padding:from.nine.padding?Object.fromEntries(Object.entries(from.nine.padding).map(([k,x])=>[k,x+pad])):null}:null;
   const it={name:safe(`${b.name}_${st}`),w:r.width,h:r.height,data:r.data,nine:nine?normalizeNine(nine,r.width,r.height):null,generated:{from:from.name,ops:v.ops,applied:r.applied}};
   out.push(it);states[st]=it.name;
  }
  buttons.push({name:safe(b.name),states});
 }
 return {items:out,buttons};
}
export async function buildKitBundle(p,{image}){
 const name=safe(p.name||'ui'),targets=p.targets?.length?p.targets:KIT_TARGETS,files=[],notes=[];
 const {items,buttons}=await kitElements(p,image);
 if(!items.length)throw Error('There is no element to export');
 const dup=items.map(i=>i.name).find((n,i,a)=>a.indexOf(n)!==i);if(dup)throw Error(`Two elements are called ${dup}; rename one`);
 // Two image layouts: one PNG per element (CSS and Android need it: border-image and .9.png take a
 // whole image) and one packed atlas (Phaser/Pixi read regions). Godot, Unity and the generic JSON
 // follow the `atlas` option.
 const single=[],singleRects=new Map();
 for(const it of items){singleRects.set(it.name,{image:single.length,x:0,y:0,w:it.w,h:it.h});single.push({file:`${it.name}.png`,width:it.w,height:it.h,png:await encodePNG({width:it.w,height:it.h,data:it.data},{indexed:'never'})});}
 let packed=null,packedRects=new Map();
 const needAtlas=p.atlas||targets.includes('phaser')||targets.includes('pixi');
 if(needAtlas){
  const lay=layoutPages(items.map(i=>({id:i.name,w:i.w,h:i.h})),{shapePadding:2,borderPadding:1,maxWidth:4096,maxHeight:4096,sizeMode:'pot',multipack:false,effort:'normal'});
  const pg=lay.pages[0],data=new Uint8ClampedArray(pg.width*pg.height*4);
  for(const pl of pg.placements){const it=items.find(i=>i.name===pl.id);for(let y=0;y<it.h;y++)data.set(it.data.subarray(y*it.w*4,(y+1)*it.w*4),((pl.y+y)*pg.width+pl.x)*4);packedRects.set(it.name,{image:0,x:pl.x,y:pl.y,w:it.w,h:it.h});}
  packed=[{file:`${name}_atlas.png`,width:pg.width,height:pg.height,png:await encodePNG({width:pg.width,height:pg.height,data},{indexed:'never'})}];
 }
 const images=p.atlas?packed:single,rects=p.atlas?packedRects:singleRects;
 const doc={format:'nerulio-ui',version:1,generator:{tool:'nerulio-studio',url:'https://nerulio.pages.dev/game/studio/'},
  images:images.map(i=>({file:i.file,width:i.width,height:i.height})),
  elements:Object.fromEntries(items.map(it=>{const n=it.nine;return [it.name,{image:rects.get(it.name).image,rect:{x:rects.get(it.name).x,y:rects.get(it.name).y,w:it.w,h:it.h},
   nineSlice:n?{...n.border}:null,padding:n?.padding?{...n.padding}:null,stretch:n?{horizontal:n.stretch.h,vertical:n.stretch.v}:null,drawCenter:n?n.drawCenter:true,
   ...(it.generated?{generated:it.generated}:{})}];})),
  buttons:Object.fromEntries(buttons.map(b=>[b.name,b.states]))};
 const put=(folder,list)=>{for(const i of list)files.push({name:`${name}/${folder}${i.file}`,data:i.png});};
 if(targets.includes('generic')){put('',images);files.push(txt(`${name}/nerulio-ui.json`,json(doc)));}
 if(targets.includes('godot')){
  put('godot/',images);
  for(const it of items){if(!it.nine)continue;files.push(txt(`${name}/godot/${it.name}.tres`,H.godotStyleBox({texture:images[rects.get(it.name).image].file,rect:p.atlas?rects.get(it.name):null,nine:it.nine})));}
  for(const b of buttons)files.push(txt(`${name}/godot/${b.name}_theme.tres`,H.godotButtonTheme({button:b,items,images,rects,atlas:!!p.atlas})));
  files.push(txt(`${name}/godot/nerulio-ui.json`,json(doc)),txt(`${name}/godot/nerulio_ui_import.gd`,H.GODOT_UI_HELPER),txt(`${name}/godot/README.md`,H.godotKitReadme(name)));
 }
 if(targets.includes('unity')){
  put('unity/',images);files.push(txt(`${name}/unity/nerulio-ui.json`,json(doc)),txt(`${name}/unity/Editor/NerulioUIImporter.cs`,H.UNITY_UI_IMPORTER),txt(`${name}/unity/README.md`,H.unityKitReadme(name)));
 }
 if(targets.includes('android')){
  for(const it of items){const nine=it.nine||normalizeNine({},it.w,it.h),p9=toNinePatchPNG(it.data,it.w,it.h,nine);
   files.push({name:`${name}/android/drawable-nodpi/${androidName(it.name)}.9.png`,data:await encodePNG({width:p9.width,height:p9.height,data:p9.data},{indexed:'never'})});}
  files.push(txt(`${name}/android/README.md`,H.androidReadme()));
 }
 if(targets.includes('css')){put('css/',single);files.push(txt(`${name}/css/${name}.css`,H.css({items,images:single,rects:singleRects})),txt(`${name}/css/demo.html`,H.cssDemo({name,items})));}
 if(targets.includes('phaser')||targets.includes('pixi')){
  const atlasJson=H.textureAtlasJSON({items,images:packed,rects:packedRects,name});
  if(targets.includes('phaser')){put('phaser/',packed);files.push(txt(`${name}/phaser/${name}.json`,json(atlasJson)),txt(`${name}/phaser/README.md`,H.phaserKitReadme({name,items})));}
  if(targets.includes('pixi')){put('pixi/',packed);files.push(txt(`${name}/pixi/${name}.json`,json(atlasJson)),txt(`${name}/pixi/README.md`,H.pixiKitReadme({name,items})));}
 }
 files.push(txt(`${name}/README.md`,H.kitReadme({name,items,buttons,targets})));
 return {name:`${name}-ui.zip`,files,notes};
}
export function buildFontBundle(p){
 const m=p.model,name=safe(p.name||m.face),targets=p.targets?.length?p.targets:FONT_TARGETS,files=[];
 const pages=p.pages.map((pg,i)=>({file:m.pages[i].file,data:pg.png}));
 const addPages=folder=>{for(const pg of pages)files.push({name:`${name}/${folder}${pg.file}`,data:pg.data});};
 const bitmap=m.type==='bitmap';
 if(targets.includes('bmfont-text')||targets.includes('bmfont-xml')||targets.includes('bmfont-bin')){
  addPages('bmfont/');
  if(targets.includes('bmfont-text'))files.push(txt(`${name}/bmfont/${name}.fnt`,fntText(m)));
  if(targets.includes('bmfont-xml'))files.push(txt(`${name}/bmfont/${name}.xml.fnt`,fntXML(m)));
  if(targets.includes('bmfont-bin')&&bitmap)files.push({name:`${name}/bmfont/${name}.bin.fnt`,data:fntBinary(m)});
 }
 if(targets.includes('msdf-json')){addPages('msdf-atlas-gen/');files.push(txt(`${name}/msdf-atlas-gen/${name}.json`,json(msdfAtlasJSON(m))));}
 if(targets.includes('godot')){addPages('godot/');files.push(txt(`${name}/godot/${name}.fnt`,fntText(m)),txt(`${name}/godot/${name}.json`,json(msdfAtlasJSON(m))),txt(`${name}/godot/nerulio_font_import.gd`,H.GODOT_FONT_HELPER),txt(`${name}/godot/README.md`,H.godotFontReadme({name,m})));}
 if(targets.includes('unity')){addPages('unity/');files.push(txt(`${name}/unity/${name}.json`,json(msdfAtlasJSON(m))),txt(`${name}/unity/Editor/NerulioTMPFontImporter.cs`,H.UNITY_TMP_IMPORTER),txt(`${name}/unity/README.md`,H.unityFontReadme({name,m})));}
 if(targets.includes('phaser')){addPages('phaser/');files.push(txt(`${name}/phaser/${name}.xml`,fntXML(m)),txt(`${name}/phaser/README.md`,H.phaserFontReadme({name,m})));}
 if(targets.includes('pixi')){addPages('pixi/');files.push(txt(`${name}/pixi/${name}.fnt`,fntText(m)),txt(`${name}/pixi/README.md`,H.pixiFontReadme({name,m})));}
 files.push(txt(`${name}/charset.txt`,p.charset||''));
 if(p.missing?.length)files.push(txt(`${name}/missing-glyphs.txt`,p.missing.map(x=>`U+${x.codepoint.toString(16).toUpperCase().padStart(4,'0')}\t${x.char}\t${x.count}\t${x.where.map(w=>`${w.file}:${w.line}`).join(' ')}`).join('\n')+'\n'));
 files.push(txt(`${name}/README.md`,H.fontReadme({name,m,targets,missing:p.missing||[],source:p.source||{}})));
 return {name:`${name}-font.zip`,files,notes:[]};
}
export {effectivePadding,MODE_NUM};
