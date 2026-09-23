import * as Im from '../image.js';
import {bytes,stem,zip} from '../core.js';
import {packRects,atlasData,ATLAS_FORMATS} from '../atlas-pack.js';
import {t} from '../i18n.js';
import {text,toast,download,track,onLocale,continueWith,page as route} from './shell.js';
import {groupAnimations,sharedCanvas,naturalCompare} from '../game/animation-names.js';
import {decodeExact} from './exact-decode.js';
import {frame as modelFrame,animation as modelAnimation} from '../game/model.js';
import {godotBundle} from '../game/exporters/godot.js';
import './strings-trust.js';
/** Sprite sheet / texture atlas maker: frames in → packed PNG + engine data out, with a live
 * atlas view and an animation preview. Animated GIF / APNG / WebP inputs are split into
 * frames when the browser has ImageDecoder. */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const natural=(a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});
function alphaBounds(c){
 const {width:w,height:h}=c,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;let l=w,tp=h,r=-1,b=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>0){if(x<l)l=x;if(x>r)r=x;if(y<tp)tp=y;if(y>b)b=y;}
 return r<0?{x:0,y:0,w:1,h:1}:{x:l,y:tp,w:r-l+1,h:b-tp+1};
}
async function framesOf(file){
 if(/gif|apng|webp|png/i.test(file.type)&&'ImageDecoder' in window&&await ImageDecoder.isTypeSupported(file.type).catch(()=>false)){
  const decoder=new ImageDecoder({data:await file.arrayBuffer(),type:file.type});await decoder.tracks.ready;const n=decoder.tracks.selectedTrack?.frameCount||1;
  if(n>1){const out=[];for(let i=0;i<n;i++){const {image}=await decoder.decode({frameIndex:i}),c=Im.canvas(image.displayWidth,image.displayHeight);c.getContext('2d').drawImage(image,0,0);image.close();out.push({name:`${stem(file.name)}_${String(i).padStart(String(n).length,'0')}.png`,canvas:c,delay:0});}decoder.close();return out;}
  decoder.close();
 }
 return [{name:file.name,canvas:await decodeExact(file)}];
}
export function mount({el,def}){
 let frames=[],seq=0,built=null,timer=0,playing=true,tick=0,raf=0,last=0,dragId=null,busy=false,groups=[],anim=-1;
 let o={layout:'packed',padding:2,trim:true,extrude:0,pot:false,rotate:false,maxSize:4096,columns:0,format:'json-hash',name:'',fps:12,outlines:true,pixelated:true,shared:false};
 // What a format can hold. Godot's AtlasTexture cannot rotate a region, so a Godot export packs
 // unrotated; Phaser 3's Starling XML reader ignores frameX/frameWidth, so XML is written untrimmed
 // (and on each file's own canvas) — otherwise Phaser 3 draws trimmed frames cropped.
 const rotating=()=>o.rotate&&o.format!=='godot',trimming=()=>o.trim&&o.format!=='xml',sharing=()=>o.shared&&o.format!=='xml';
 /** Frames grouped by file name (walk_01, walk-2, attack 3 …), numbers sorted as numbers. Each
  * animation with frames of different sizes gets one canvas (the largest, bottom-centred) that
  * the preview plays on and the data file records as sourceSize/offset, so an engine plays the
  * frames exactly where the preview showed them instead of jumping between frame sizes (B18). */
 function regroup(){
  groups=groupAnimations(frames.map(f=>f.name)).map(g=>{const list=g.frames.map(i=>frames[i]),sizes=list.map(f=>({w:f.w,h:f.h}));
   const differ=sizes.some(s=>s.w!==sizes[0].w||s.h!==sizes[0].h);
   return {name:g.name,frames:list,canvas:differ?sharedCanvas(sizes):null};});
  if(anim>=groups.length)anim=-1;
 }
 const playList=()=>anim>=0&&groups[anim]?groups[anim].frames:frames;
 const T=(k,v)=>text('atlas.'+k,v);
 function empty(){el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button><button type="button" class="ghost" data-action="atlas-sample">${esc(text('sample'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;}
 const seg=(id,key,values,label)=>`<div class="segmented" role="group" id="${id}">${values.map(v=>`<button type="button" data-action="atlas-set" data-key="${key}" data-value="${v}" aria-pressed="${String(o[key])===String(v)}">${esc(label(v))}</button>`).join('')}</div>`;
 function frame(){
  el.innerHTML=`<div class="work atlas-work"><section class="board"><div class="atlas-views"><div class="atlas-view"><div class="view-head"><strong>${esc(T('sheet'))}</strong><span id="atlasInfo"></span><label class="check mini"><input id="atlasOutlines" type="checkbox" ${o.outlines?'checked':''}> ${esc(T('outlines'))}</label></div><div class="atlas-canvas" id="atlasHost"><canvas id="atlasCanvas"></canvas><svg id="atlasSvg" xmlns="http://www.w3.org/2000/svg"></svg></div></div>
<div class="atlas-view anim"><div class="view-head"><strong>${esc(T('animation'))}</strong><button type="button" class="mini-button" data-action="atlas-play" id="atlasPlay"></button></div><div class="chips-row" id="atlasAnims"></div><div class="atlas-canvas anim-canvas"><canvas id="animCanvas"></canvas></div><p class="hint" id="atlasCanvasNote" hidden></p><label class="field fps"><span>${esc(T('fps'))} <output id="fpsOut">${o.fps}</output></span><input id="atlasFps" type="range" min="1" max="60" value="${o.fps}"></label></div></div>
<div class="view-head frames-head"><strong>${esc(T('frames'))}</strong><span id="frameCount"></span><button type="button" class="mini-button" data-action="atlas-sort">${esc(T('sortName'))}</button><button type="button" class="mini-button" data-action="atlas-reverse">${esc(T('reverse'))}</button></div><div class="frame-strip" id="frameStrip"></div><p class="viewer-note">${esc(T('hint'))}</p></section>
<aside class="side"><div class="summary" id="atlasSummary" role="status" aria-live="polite"></div><form id="atlasOptions" class="options" autocomplete="off"><span class="opt-label">${esc(T('layout'))}</span>${seg('atlasLayout','layout',['packed','grid','row','column'],v=>T('layouts.'+v))}<span class="opt-label">${esc(T('padding'))}</span>${seg('atlasPadding','padding',[0,1,2,4,8],v=>v+'px')}
<details class="options-advanced"><summary>${esc(text('advanced'))}</summary><label class="field"><span>${esc(T('format'))}</span><select id="atlasFormat">${Object.entries(ATLAS_FORMATS).map(([k,v])=>`<option value="${k}" ${o.format===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
<label class="check"><input id="atlasTrim" type="checkbox" ${o.trim?'checked':''}> ${esc(T('trim'))}</label><label class="check"><input id="atlasPot" type="checkbox" ${o.pot?'checked':''}> ${esc(T('pot'))}</label><label class="check"><input id="atlasRotate" type="checkbox" ${o.rotate?'checked':''}> ${esc(T('rotate'))}</label><p class="hint bad" id="atlasRotateNote" ${o.rotate?'':'hidden'}>${esc(T('rotateNote'))}</p>
<div class="field-row"><label class="field"><span>${esc(T('extrude'))}</span><select id="atlasExtrude">${[0,1,2,4].map(v=>`<option ${o.extrude===v?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>${esc(T('maxSize'))}</span><select id="atlasMax">${[1024,2048,4096,8192].map(v=>`<option ${o.maxSize===v?'selected':''}>${v}</option>`).join('')}</select></label></div>
<div class="field-row"><label class="field"><span>${esc(T('columns'))}</span><input id="atlasColumns" type="number" min="0" max="512" value="${o.columns||''}" placeholder="${esc(text('resize.auto'))}" inputmode="numeric"></label><label class="field"><span>${esc(text('pdf.fileName'))}</span><input id="atlasName" type="text" maxlength="60" value="${esc(o.name)}" placeholder="atlas"></label></div><label class="check"><input id="atlasPixelated" type="checkbox" ${o.pixelated?'checked':''}> ${esc(T('pixelated'))}</label>
<label class="check"><input id="atlasShared" type="checkbox" ${o.shared?'checked':''}> ${esc(T('sharedCanvas'))}</label></details></form>
<div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(T('add'))}</button><button type="button" class="link" data-action="atlas-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="atlasRun" data-action="atlas-run"></button><nav class="next" id="atlasNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
 }
 function renderAnims(){
  const host=el.querySelector('#atlasAnims');if(!host)return;
  host.innerHTML=groups.length>1||groups[0]?.frames.length!==frames.length?[`<button type="button" class="chip" data-action="atlas-anim" data-index="-1" aria-pressed="${anim<0}">${esc(T('animationAll'))}<small>${frames.length}</small></button>`,
   ...groups.map((g,i)=>`<button type="button" class="chip" data-action="atlas-anim" data-index="${i}" aria-pressed="${anim===i}" data-name="${esc(g.name)}">${esc(g.name)}<small>${g.frames.length}</small></button>`)].join(''):'';
  const note=el.querySelector('#atlasCanvasNote'),g=anim>=0?groups[anim]:null;
  if(note){note.hidden=!(g?.canvas&&o.shared);if(!note.hidden)note.textContent=T('canvasNote',{w:g.canvas.w,h:g.canvas.h});}
 }
 function renderStrip(){
  el.querySelector('#frameStrip').innerHTML=frames.map((f,i)=>`<div class="frame-chip" draggable="true" data-id="${f.id}" title="${esc(f.name)}"><img src="${f.url}" alt="" draggable="false" class="${o.pixelated?'px':''}"><span>${i+1}</span><button type="button" data-action="atlas-remove" data-id="${f.id}" aria-label="${esc(text('remove'))}">×</button></div>`).join('');
  el.querySelector('#frameCount').textContent=T('frameCount',{n:frames.length});
  regroup();renderAnims();
 }
 function build(){
  if(!frames.length)return;const e=o.extrude;
  try{
   const rects=frames.map(f=>{const r=trimming()?f.trim:{x:0,y:0,w:f.w,h:f.h};return {id:f.id,w:r.w+e*2,h:r.h+e*2};});
   const packed=packRects(rects,{maxSize:o.maxSize,padding:o.padding,pot:o.pot,rotate:rotating(),layout:o.layout,columns:o.columns}),cv=el.querySelector('#atlasCanvas'),ctx=cv.getContext('2d');
   cv.width=packed.width;cv.height=packed.height;ctx.imageSmoothingEnabled=false;const by=new Map(packed.placements.map(p=>[p.id,p])),data=[];
   for(const f of frames){
    const p=by.get(f.id),r=trimming()?f.trim:{x:0,y:0,w:f.w,h:f.h};let src=f.canvas,sx=r.x,sy=r.y,tile=null;
    if(e){tile=Im.canvas(r.w+e*2,r.h+e*2);const tc=tile.getContext('2d');tc.imageSmoothingEnabled=false;
     for(const [dx,dy,dw,dh,ox,oy,ow,oh] of [[e,e,r.w,r.h,0,0,r.w,r.h],[0,e,e,r.h,0,0,1,r.h],[e+r.w,e,e,r.h,r.w-1,0,1,r.h],[e,0,r.w,e,0,0,r.w,1],[e,e+r.h,r.w,e,0,r.h-1,r.w,1],[0,0,e,e,0,0,1,1],[e+r.w,0,e,e,r.w-1,0,1,1],[0,e+r.h,e,e,0,r.h-1,1,1],[e+r.w,e+r.h,e,e,r.w-1,r.h-1,1,1]])tc.drawImage(f.canvas,r.x+ox,r.y+oy,ow,oh,dx,dy,dw,dh);
     src=tile;sx=0;sy=0;}
    const w=r.w+e*2,h=r.h+e*2;
    if(p.rotated){ctx.save();ctx.translate(p.x+h,p.y);ctx.rotate(Math.PI/2);ctx.drawImage(src,sx,sy,w,h,0,0,w,h);ctx.restore();}else ctx.drawImage(src,sx,sy,w,h,p.x,p.y,w,h);
    Im.release(tile);
    const g=sharing()?groups.find(x=>x.canvas&&x.frames.includes(f)):null,at=g?g.canvas.offsets[g.frames.indexOf(f)]:{x:0,y:0};
    data.push({name:f.name,x:p.x+e,y:p.y+e,w:r.w,h:r.h,rotated:p.rotated,trimmed:trimming()&&(r.w!==f.w||r.h!==f.h)||!!g,sourceW:g?g.canvas.w:f.w,sourceH:g?g.canvas.h:f.h,offsetX:r.x+at.x,offsetY:r.y+at.y});
   }
   const used=data.reduce((s,d)=>s+d.w*d.h,0);built={width:packed.width,height:packed.height,data,efficiency:used/(packed.width*packed.height),
    animations:groups.length>1||groups[0]?.frames.length>1?Object.fromEntries(groups.map(g=>[g.name,g.frames.map(f=>f.name)])):null};
   const svg=el.querySelector('#atlasSvg');svg.setAttribute('viewBox',`0 0 ${packed.width} ${packed.height}`);svg.innerHTML=o.outlines?data.map(d=>`<rect x="${d.x}" y="${d.y}" width="${d.rotated?d.h:d.w}" height="${d.rotated?d.w:d.h}"/>`).join(''):'';
   el.querySelector('#atlasHost').style.aspectRatio=`${packed.width} / ${packed.height}`;cv.classList.toggle('px',o.pixelated);
   el.querySelector('#atlasInfo').textContent=`${packed.width} × ${packed.height}`;
   el.querySelector('#atlasSummary').innerHTML=`<div class="summary-big">${packed.width} × ${packed.height}</div><div class="summary-line">${esc(T('frameCount',{n:frames.length}))} · ${esc(T('efficiency',{n:Math.round(built.efficiency*100)}))}${groups.length?` · <span id="atlasAnimCount" data-n="${groups.length}">${esc(T('animationsFound',{n:groups.length}))}</span>`:''}</div>`;
   const run=el.querySelector('#atlasRun');run.disabled=false;run.textContent=T('run',{f:ATLAS_FORMATS[o.format].ext.toUpperCase()});
  }catch(error){built=null;el.querySelector('#atlasSummary').innerHTML=`<div class="summary-line bad">${esc(error?.message||String(error))}</div>`;const run=el.querySelector('#atlasRun');run.disabled=true;run.textContent=T('cannot');}
 }
 function animate(now){
  raf=requestAnimationFrame(animate);const cv=el.querySelector('#animCanvas');const list=playList();if(!cv||!list.length)return;
  if(playing&&now-last>=1000/o.fps){last=now;tick=(tick+1)%list.length;}else if(cv.dataset.frame===String(tick)&&cv.dataset.n===String(list.length)&&cv.dataset.anim===String(anim))return;
  const W=Math.max(...list.map(f=>f.w)),H=Math.max(...list.map(f=>f.h));if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}
  const f=list[tick%list.length],ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);ctx.drawImage(f.canvas,Math.floor((W-f.w)/2),H-f.h);cv.dataset.frame=String(tick);cv.dataset.n=String(list.length);cv.dataset.anim=String(anim);cv.classList.toggle('px',o.pixelated);
  // Integer zoom only: a pixel sprite is shown at 1×, 2×, 3× … of its size, never 4.1×.
  const room=cv.parentElement?.clientWidth||W,scale=Math.max(1,Math.min(12,Math.floor(Math.min(room/W,240/H))));cv.style.width=W*scale+'px';cv.style.height=H*scale+'px';
  const play=el.querySelector('#atlasPlay');if(play)play.textContent=playing?'❚❚':'▶';
 }
 const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>{build();},60);};
 async function add(files){
  if(busy)return;busy=true;const first=!frames.length;
  // Each added batch is put in natural name order (walk_2 before walk_10), after what was there.
  try{const batch=[...files].sort((a,b)=>naturalCompare(a.name,b.name));
   for(const file of batch)for(const fr of await framesOf(file)){const c=fr.canvas;frames.push({id:++seq,name:fr.name,canvas:c,w:c.width,h:c.height,trim:alphaBounds(c),url:URL.createObjectURL(await Im.blobOf(c))});}
   if(first){frame();cancelAnimationFrame(raf);raf=requestAnimationFrame(animate);}
   track('tool_run',{intent:route.id});renderStrip();build();
  }catch(error){toast(error?.message||String(error),{error:true});if(!frames.length)empty();}finally{busy=false;}
 }
 function clear(){for(const f of frames){Im.release(f.canvas);URL.revokeObjectURL(f.url);}frames=[];built=null;cancelAnimationFrame(raf);empty();}
 async function sample(){
  const out=[];for(let i=0;i<8;i++){const c=Im.canvas(48,48),x=c.getContext('2d'),t=i/8*Math.PI*2,bob=Math.round(Math.sin(t)*3);
   x.fillStyle='#2b3a67';x.fillRect(18,14+bob,12,16);x.fillStyle='#f4c095';x.fillRect(19,5+bob,10,9);x.fillStyle='#e85d75';x.fillRect(17,3+bob,14,4);
   x.fillStyle='#1b1f3b';x.fillRect(19+Math.round(Math.sin(t)*4),30+bob,4,12-bob);x.fillRect(25-Math.round(Math.sin(t)*4),30+bob,4,12-bob);x.fillStyle='#f4c095';x.fillRect(14-Math.round(Math.cos(t)*3),16+bob,4,9);x.fillRect(30+Math.round(Math.cos(t)*3),16+bob,4,9);
   out.push(new File([await Im.blobOf(c)],`hero_run_${i}.png`,{type:'image/png'}));Im.release(c);}
  return out;
 }
 /** The packed atlas as the shared model (frames on their own canvas, trimmed pixels at their
  * offset) so the Sprite Lab Godot exporter can write it, animations included. */
 function godotFiles(base){
  const ids=new Map(),mframes=built.data.map((d,i)=>{const f=modelFrame({id:`s${i}`,name:d.name,sourceRect:{x:0,y:0,w:d.sourceW,h:d.sourceH},
   trimmedRect:{x:d.offsetX,y:d.offsetY,w:d.w,h:d.h}});ids.set(d.name,f.id);return f;});
  const atlas={frames:Object.fromEntries(built.data.map((d,i)=>[mframes[i].id,{x:d.x,y:d.y,w:d.w,h:d.h,page:0}])),pages:1,width:built.width,height:built.height,
   pageSizes:[{width:built.width,height:built.height}],padding:o.padding,extrude:o.extrude};
  const anims=(built.animations?Object.entries(built.animations):[['default',built.data.map(d=>d.name)]])
   .map(([name,list])=>modelAnimation({name,frameIds:list.map(n=>ids.get(n)).filter(Boolean),fps:o.fps}));
  return godotBundle({frames:mframes,animations:anims,atlas},{base});
 }
 async function run(){
  if(!built||busy)return;busy=true;const base=(o.name.trim()||'atlas').replace(/[^\w.-]+/g,'_'),fmt=ATLAS_FORMATS[o.format];
  try{const png=await Im.blobOf(el.querySelector('#atlasCanvas'));
   let entries;
   if(o.format==='godot'){
    // A Godot user gets what Sprite Lab ships: the JSON envelope plus the GDScript helper that
    // builds a SpriteFrames resource through the engine API (addons/nerulio_sprite/).
    entries=[{name:base+'.png',blob:png},...godotFiles(base).map(f=>({name:f.name,blob:new Blob([f.text],{type:f.type})}))];
   }else{
    const dataText=atlasData(o.format,built.data,{image:base+'.png',width:built.width,height:built.height,animations:built.animations});
    entries=[{name:base+'.png',blob:png},{name:`${base}.${fmt.ext}`,blob:new Blob([dataText],{type:'text/plain'})}];
   }
   const blob=await zip(entries,{paths:true});download(blob,base+'.zip');track('tool_success',{intent:route.id});
   built.png=new File([png],base+'.png',{type:'image/png'});el.querySelector('#atlasNext').innerHTML=`<span>${esc(text('next'))}</span>${def.next.map(id=>`<button type="button" class="chip" data-action="atlas-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
   toast(T('done',{size:bytes(blob.size)}));
  }catch(error){toast(error?.message||String(error),{error:true});}finally{busy=false;}
 }
 el.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action;
  if(a==='atlas-sample')add(await sample());
  else if(a==='atlas-set'){const v=b.dataset.value;o[b.dataset.key]=/^\d+$/.test(v)?Number(v):v;for(const s of b.parentElement.children)s.setAttribute('aria-pressed',String(s===b));schedule();}
  else if(a==='atlas-remove'){const i=frames.findIndex(f=>String(f.id)===b.dataset.id);if(i>=0){const [f]=frames.splice(i,1);Im.release(f.canvas);URL.revokeObjectURL(f.url);}if(!frames.length)return clear();tick=0;renderStrip();schedule();}
  else if(a==='atlas-sort'){frames.sort(natural);renderStrip();schedule();}
  else if(a==='atlas-reverse'){frames.reverse();renderStrip();schedule();}
  else if(a==='atlas-clear')clear();
  else if(a==='atlas-play'){playing=!playing;}
  else if(a==='atlas-anim'){anim=Number(b.dataset.index);tick=0;renderAnims();}
  else if(a==='atlas-run')run();
  else if(a==='atlas-next'&&built?.png)continueWith(b.dataset.tool,[built.png]);
 });
 el.addEventListener('input',e=>{
  if(!e.target.closest('.atlas-work'))return;const q=s=>el.querySelector(s);
  o={...o,fps:Number(q('#atlasFps').value),outlines:q('#atlasOutlines').checked,format:q('#atlasFormat').value,trim:q('#atlasTrim').checked,pot:q('#atlasPot').checked,rotate:q('#atlasRotate').checked,extrude:Number(q('#atlasExtrude').value),maxSize:Number(q('#atlasMax').value),columns:Math.max(0,Math.min(512,Math.round(Number(q('#atlasColumns').value)||0))),name:q('#atlasName').value,pixelated:q('#atlasPixelated').checked,shared:q('#atlasShared').checked};
  const rn=q('#atlasRotateNote');if(rn)rn.hidden=!o.rotate;
  q('#fpsOut').textContent=o.fps;if(e.target.id==='atlasPixelated')renderStrip();if(e.target.id!=='atlasFps')schedule();
 });
 el.addEventListener('submit',e=>e.preventDefault());
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();}});
 el.addEventListener('dragstart',e=>{const c=e.target.closest?.('.frame-chip');if(!c)return;dragId=c.dataset.id;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);});
 el.addEventListener('dragover',e=>{if(dragId){e.preventDefault();e.stopPropagation();}});
 el.addEventListener('drop',e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();const c=e.target.closest?.('.frame-chip'),from=frames.findIndex(f=>String(f.id)===dragId);dragId=null;if(!c||from<0)return;const [f]=frames.splice(from,1),to=frames.findIndex(x=>String(x.id)===c.dataset.id),r=c.getBoundingClientRect();frames.splice(to+(e.clientX>r.left+r.width/2?1:0),0,f);renderStrip();schedule();});
 el.addEventListener('dragend',()=>{dragId=null;});
 onLocale(()=>{if(!frames.length){empty();return;}frame();renderStrip();build();});
 // Work lives only in this tab: leaving it with frames loaded asks first.
 addEventListener('beforeunload',e=>{if(el.isConnected&&frames.length){e.preventDefault();e.returnValue='';}});
 empty();
 return {add};
}
