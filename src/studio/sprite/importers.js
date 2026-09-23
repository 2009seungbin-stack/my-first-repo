/** Import for the Sprite workspace: files in, one undoable document step out, every automatic
 * decision recorded in asset.import (and shown by the Import panel with one-click alternatives).
 *
 *   single image           → sheet: key colour, grid or islands, one animation per row (Apply)
 *   several numbered images / a folder → frames of one sprite, animations by file name
 *   animated GIF / APNG    → every frame with its delay (disposal applied)
 *   .aseprite / .ase       → layers, cels, tags, durations, slices → pivots/boxes/9-slice
 *   Sprite Lab project JSON → frames and animations onto the sheet it was made from
 *   atlas data (Aseprite JSON, TexturePacker JSON, Starling XML) + its image → named frames */
import * as P from '../core/project.js';
import * as D from './sprite-doc.js';
import {sheetPlan,groupFrameFiles,placeFrames,delayDecision,frameKey} from './import-plan.js';
import {animatedAsset,sheetFrames,buildTags,stem,labProjectFrames} from './import-build.js';
import {readProjectFile as readLabProject,PROJECT_FORMAT as LAB_FORMAT} from '../../game/project.js';
import {isGIF} from './gif-decode.js';
import {isAPNG} from './apng-decode.js';
import {parseAtlas,atlasFrames} from './atlas-data.js';
let worker=null,seq=0;const waiting=new Map();
export function work(msg,transfer=[]){
 worker||=Object.assign(new Worker(new URL('./sprite-worker.js',import.meta.url),{type:'module'}),{onmessage:({data})=>{const w=waiting.get(data.id);if(!w)return;waiting.delete(data.id);data.ok?w.resolve(data.result):w.reject(Error(data.error));},onerror:e=>{for(const w of waiting.values())w.reject(Error(e.message||'worker failed'));waiting.clear();worker=null;}});
 const id=++seq;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});worker.postMessage({...msg,id},transfer);});
}
const ext=f=>(/\.([a-z0-9]+)$/i.exec(f.name||'')?.[1]||'').toLowerCase();
const pathOf=f=>f.nerulioPath||f.webkitRelativePath||f.name;
export const isSpriteFile=f=>/^(ase|aseprite|gif|apng|json|xml)$/.test(ext(f));
const IMAGE=/^(png|jpe?g|webp|bmp|avif|gif|apng)$/;
/** What a dropped set of files is. Pure-ish: reads magic bytes. */
export async function classify(files){
 const out={aseprite:[],animated:[],images:[],lab:[],atlas:[],other:[]};
 for(const f of files){
  const e=ext(f);
  if(e==='ase'||e==='aseprite'){out.aseprite.push(f);continue;}
  if(e==='json'||e==='xml'){
   const text=await f.text();let json=null;try{json=e==='json'?JSON.parse(text):null;}catch{}
   if(json?.format===LAB_FORMAT)out.lab.push({file:f,json});
   else{try{out.atlas.push({file:f,atlas:parseAtlas(text,f.name)});}catch{out.other.push(f);}}
   continue;
  }
  if(!IMAGE.test(e)&&!/^image\//.test(f.type||'')){out.other.push(f);continue;}
  const head=new Uint8Array(await f.slice(0,1<<16).arrayBuffer());
  if(isGIF(head)){const bytes=new Uint8Array(await f.arrayBuffer());if(gifFrameCount(bytes)>1){out.animated.push({file:f,kind:'gif',bytes});continue;}}
  if(e==='apng'||(head[0]===137&&head[1]===80)){const bytes=new Uint8Array(await f.arrayBuffer());if(isAPNG(bytes)){out.animated.push({file:f,kind:'apng',bytes});continue;}}
  out.images.push(f);
 }
 return out;
}
/** Counts image descriptors quickly (a one-frame GIF is just an image). */
function gifFrameCount(b){
 let p=13;if(b[10]&0x80)p+=3*(1<<((b[10]&7)+1));let n=0;
 const skip=()=>{while(p<b.length){const s=b[p++];if(!s)return;p+=s;}};
 while(p<b.length){const k=b[p++];if(k===0x3B)break;if(k===0x21){p++;skip();continue;}if(k!==0x2C)break;const f=b[p+8];p+=9;if(f&0x80)p+=3*(1<<((f&7)+1));p++;skip();if(++n>1)return n;}
 return n;
}
export function createImporter(ctx,{onChange=()=>{}}={}){
 const {t,images}=ctx;
 const sheets=new Map();// assetId → {origId, keyedId, analyses:{auto,none,force}, choice}
 const put=async blob=>(await images.put(blob)).id;
 async function importFiles(files,{from='drop'}={}){
  const c=await classify(files),made=[];
  if(c.other.length)ctx.toast(t('sp.import.unsupported',{names:c.other.map(f=>f.name).slice(0,3).join(', ')}),{error:true});
  for(const f of c.aseprite)made.push(await guard(f.name,()=>importAseprite(f)));
  for(const a of c.animated)made.push(await guard(a.file.name,()=>importAnimated(a)));
  // atlas data takes the image it names (or the only image dropped with it)
  for(const a of c.atlas){
   const img=c.images.find(f=>f.name===a.atlas.image)||c.images.find(f=>stem(f.name)===stem(a.file.name))||(c.images.length===1?c.images[0]:null);
   if(!img){ctx.toast(t('sp.import.atlasNeedsImage',{name:a.file.name,image:a.atlas.image||'?'}),{error:true});continue;}
   c.images.splice(c.images.indexOf(img),1);made.push(await guard(a.file.name,()=>importAtlas(img,a)));
  }
  for(const l of c.lab){
   const img=c.images.length===1?c.images.shift():null;
   made.push(await guard(l.file.name,()=>importLab(l,img)));
  }
  if(c.images.length>1){
   const g=groupFrameFiles(c.images.map(pathOf));
   const sameSize=await sameSizes(c.images);
   // Same-sized files only form one animation when their names read as a sequence (most end in
   // a frame number); idle.png + run.png + jump.png, or unrelated drops, stay separate sprites.
   const numbered=c.images.filter(f=>frameKey(pathOf(f)).index!=null).length/c.images.length;
   const asFrames=g.decision.chosen==='names'||numbered>=.5&&g.decision.confidence!=='low'&&sameSize||c.images.some(f=>/[\\/]/.test(pathOf(f)));
   if(asFrames)made.push(await guard(c.images[0].name,()=>importFrameFiles(c.images)));
   else for(const f of c.images)made.push(await guard(f.name,()=>importSheet(f)));
  }else if(c.images.length===1)made.push(await guard(c.images[0].name,()=>importSheet(c.images[0])));
  const ok=made.filter(Boolean);
  if(ok.length)await ctx.showAsset(ok[ok.length-1]);
  onChange();
  return ok;
 }
 async function guard(name,fn){try{return await fn();}catch(e){console.error(e);ctx.toast(t('sp.import.failed',{name,reason:String(e.message||e)}),{error:true});return null;}}
 async function sameSizes(files){const s=await Promise.all(files.slice(0,64).map(f=>createImageBitmap(f).then(b=>{const r=b.width+'x'+b.height;b.close();return r;}).catch(()=>'?')));return new Set(s).size===1;}
 function add(asset,label){ctx.execute(ctx.edit(label,d=>P.addAssets(d,[asset]),{meta:{from:'sprite-import'}}));return asset.id;}
 // ---------------------------------------------------------------- .aseprite
 async function importAseprite(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  ctx.status('selection',t('sp.import.reading',{name:file.name}));
  const r=await work({op:'aseprite',bytes},[bytes.buffer]);
  const frames=[];
  for(let i=0;i<r.frames.length;i++){const fr=r.frames[i];const cels=[];for(const c of fr.cels)cels.push({layer:c.layer,blob:await put(c.png),x:c.x,y:c.y,opacity:c.opacity});
   frames.push({name:`${stem(file.name)}_${i}`,duration:fr.duration,cels,...r.frameMeta[i]});}
  const asset=animatedAsset({name:file.name,width:r.width,height:r.height,layers:r.layers,frames,tags:r.tags,slices:r.slices,source:file,
   importInfo:{kind:'aseprite',decisions:r.decisions,sliceBoxes:r.sliceBoxes,pivotSlice:r.pivotSlice,warnings:r.warnings,colorMode:r.colorMode}});
  ctx.status('selection','');
  return add(asset,t('sp.cmd.importFile',{name:file.name}));
 }
 // ---------------------------------------------------------------- GIF / APNG
 async function importAnimated({file,kind,bytes}){
  const r=await work({op:'animation',bytes,kind},[bytes.buffer]);
  const frames=[];
  for(let i=0;i<r.frames.length;i++){const fr=r.frames[i];frames.push({name:`${stem(file.name)}_${i}`,duration:fr.delay,cels:fr.cel?[{layer:0,blob:await put(fr.cel.png),x:fr.cel.x,y:fr.cel.y}]:[],metadata:{[kind]:{delay:fr.delay,rawDelay:fr.rawDelay,disposal:fr.disposal}}});}
  // GIF NETSCAPE loop: 0 = forever; n = n more times (browsers play n+1); no loop block = once
  const repeat=kind==='gif'?(r.loop==null?1:r.loop===0?0:r.loop+1):(r.loop===0?0:r.loop);
  const decisions=[{id:'frames',label:'frames',chosen:String(frames.length),confidence:'high',reasons:[`${frames.length} frames decoded with their delays and disposal`,...r.warnings.slice(0,3)],alternatives:[]}];
  const dd=delayDecision(r.frames);if(dd)decisions.push(dd);
  const asset=animatedAsset({name:file.name,width:r.width,height:r.height,frames,tags:[{name:stem(file.name),from:0,to:frames.length-1,repeat}],source:file,importInfo:{kind,decisions}});
  return add(asset,t('sp.cmd.importFile',{name:file.name}));
 }
 // ---------------------------------------------------------------- loose frames
 async function importFrameFiles(files,{grouping='auto',placement='auto'}={}){
  const recs=[];for(const f of files){const {record}=await images.importFile(f);recs.push({file:f,path:pathOf(f),record});}
  const g=groupFrameFiles(recs.map(r=>r.path),{mode:grouping});
  const ordered=g.order.map(i=>recs[i]),place=placeFrames(ordered.map(r=>({w:r.record.width,h:r.record.height})),{mode:placement});
  const posOf=new Map(g.order.map((orig,k)=>[orig,k]));
  const frames=ordered.map((r,k)=>({name:frameKey(r.path).stem,duration:100,cels:[{layer:0,blob:r.record.id,x:place.offsets[k].x,y:place.offsets[k].y}],metadata:{file:r.path,size:[r.record.width,r.record.height]}}));
  const tags=g.groups.map(gr=>({name:gr.name,positions:gr.items.map(i=>posOf.get(i))}));
  const decisions=[g.decision,...(place.decision?[place.decision]:[]),{id:'timing',label:'timing',chosen:'100',confidence:'low',reasons:['image files store no frame timing; 100 ms per frame (10 fps) is Aseprite\'s default'],alternatives:['83','67','50','125','150']}];
  const name=g.groups.length===1?g.groups[0].name:frameKey(recs[0].path).folder||stem(files[0].name);
  const asset=animatedAsset({name,width:place.width,height:place.height,frames,tags,importInfo:{kind:'frames',decisions}});
  return add(asset,t('sp.cmd.importFrames',{n:files.length}));
 }
 // ---------------------------------------------------------------- sheet
 async function importSheet(file){
  const {record,source}=await images.importFile(file);
  const asset={...P.imageAsset({name:file.name||'sheet.png',width:record.width,height:record.height,blob:record.id,source}),import:{kind:'sheet',decisions:[],state:'analyzing'}};
  const id=add(asset,t('sp.cmd.importFile',{name:file.name}));
  sheets.set(id,{origId:record.id,keyedId:null,analyses:{},choice:{}});
  analyzeSheet(id).catch(e=>ctx.toast(t('sp.import.failed',{name:file.name,reason:e.message}),{error:true}));
  return id;
 }
 /** Runs (or reuses) the analysis for the asset's sheet under a key mode; updates the plan preview. */
 async function analyzeSheet(assetId,{keyMode}={}){
  let s=sheets.get(assetId);const a=P.assetById(ctx.doc,assetId);if(!a)return null;
  if(!s){const orig=a.import?.sourceBlob||P.primaryBlob(a);s={origId:orig,keyedId:null,analyses:{},choice:{}};sheets.set(assetId,s);}
  const mode=keyMode||s.choice.keyMode||'auto';s.choice.keyMode=mode;
  if(!s.analyses[mode]){
   s.busy=true;onChange(assetId);
   const rec=images.get(s.origId);if(!rec)throw Error('The original image is not loaded');
   const r=await work({op:'analyze',key:s.origId,blob:rec.blob,keyMode:mode,keyColor:s.choice.keyColor||null,tolerance:s.choice.tolerance||0});
   if(r.keyed){r.keyedId=await put(r.keyed);delete r.keyed;}
   s.analyses[mode]=r;s.busy=false;
  }
  onChange(assetId);return s;
 }
 function sheetState(assetId){return sheets.get(assetId)||null;}
 /** A grid typed by hand: which of its cells hold pixels is measured on the (keyed) sheet. */
 async function setCustomGrid(assetId,g){
  const s=sheets.get(assetId);if(!s)return;
  s.choice={...s.choice,slice:'custom',grid:g,cells:null};onChange(assetId);
  const r=s.analyses[s.choice.keyMode||'auto'],id=r?.keyedId||s.origId,rec=images.get(id);if(!rec)return;
  const tok=s.cellToken=(s.cellToken||0)+1;
  try{const {cells}=await work({op:'cells',key:id,blob:rec.blob,spec:g});if(tok===s.cellToken&&cells){s.choice.cells=cells;onChange(assetId);}}catch{}
 }
 /** The plan for the current choice (for the preview), or null while analysing. */
 function planFor(assetId){
  const s=sheets.get(assetId);if(!s)return null;
  // once applied, the document is the truth (undo/redo can change which choice is applied)
  const a=P.assetById(ctx.doc,assetId);
  if(a?.import?.applied&&a.import.choice&&s.synced!==a.import){s.synced=a.import;s.choice={...a.import.choice};}
  const r=s.analyses[s.choice.keyMode||'auto'];if(!r)return null;
  return {analysis:r,plan:sheetPlan(r,s.choice)};
 }
 /** Cuts the frames the plan shows: one undo step. */
 function applySheet(assetId){
  const s=sheets.get(assetId),p=planFor(assetId);if(!p)return false;
  const {analysis:r,plan}=p,a=P.assetById(ctx.doc,assetId);
  const shared=r.keyedId||s.origId,frames=sheetFrames(a,plan.rects,{duration:plan.duration}),tags=buildTags(frames,plan.tags);
  const cels=a.cels.map(c=>c.frameId===P.SHARED&&c.layerId===a.layers[0].id?{...c,blob:shared}:c).filter(c=>c.frameId===P.SHARED);
  const importInfo={kind:'sheet',decisions:plan.decisions,choice:{...s.choice},...(r.keyedId?{sourceBlob:s.origId}:{}),applied:true};
  ctx.execute(ctx.edit(t('sp.cmd.cutFrames',{n:frames.length,tags:tags.length}),d=>D.replaceContent(d,assetId,{frames,cels,tags,grid:plan.grid,importInfo})));
  s.synced=P.assetById(ctx.doc,assetId)?.import;
  onChange(assetId);return true;
 }
 /** One-click alternative for a decision of the active asset. */
 async function choose(assetId,decisionId,alt){
  const a=P.assetById(ctx.doc,assetId);if(!a?.import)return;
  const kind=a.import.kind;
  if(kind==='sheet'){
   const s=sheets.get(assetId)||(await analyzeSheet(assetId));
   if(decisionId==='key'){s.choice.keyMode=alt==='none'?'none':'force';await analyzeSheet(assetId,{keyMode:s.choice.keyMode});}
   else if(decisionId==='slice'){s.choice.slice=alt;if(alt==='custom'&&!s.choice.grid){const g=planFor(assetId)?.plan.grid||{w:16,h:16,ox:0,oy:0,sx:0,sy:0};s.choice.grid=g;}}
   else if(decisionId==='animations')s.choice.animations=alt;
   else if(decisionId==='timing')s.choice.duration=Number(alt)||100;
   if(a.import.applied)applySheet(assetId);else onChange(assetId);
   return;
  }
  const withDecision=(d,patch)=>P.mapAsset(d,assetId,x=>({...x,import:{...x.import,decisions:x.import.decisions.map(q=>q.id===decisionId?{...q,...patch}:q)}}));
  const swap=q=>({chosen:alt,alternatives:[q.chosen,...q.alternatives.filter(x=>x!==alt)]});
  const dec=a.import.decisions.find(q=>q.id===decisionId);if(!dec)return;
  const what=dec.kind?.endsWith('slice')?`${t('sp.dec.aseSlice')} ${dec.label}`:t('sp.dec.'+dec.label);
  const label=t('sp.cmd.decision',{what,choice:altLabel(alt)});
  if(decisionId==='delays'){
   ctx.execute(ctx.edit(label,d=>withDecision(D.setDurations(d,assetId,a.frames.map(f=>f.id),f=>{const m=f.metadata?.gif||f.metadata?.apng;return m?(alt==='raw'?Math.max(1,m.rawDelay):m.delay):f.duration;}),swap(dec))));
  }else if(decisionId==='timing'){
   ctx.execute(ctx.edit(label,d=>withDecision(D.setDurations(d,assetId,a.frames.map(f=>f.id),Number(alt)||100),swap(dec))));
  }else if(decisionId==='grouping'){
   const paths=a.frames.map(f=>f.metadata?.file||f.name),g=groupFrameFiles(paths,{mode:alt});
   const order=g.order.map(i=>a.frames[i].id);
   ctx.execute(ctx.edit(label,d=>{let x=P.mapAsset(d,assetId,y=>({...y,frames:order.map(id=>y.frames.find(f=>f.id===id))}));const as=P.assetById(x,assetId);
    x=D.setTags(x,assetId,g.groups.map(gr=>({name:gr.name,frameIds:gr.items.map(i=>a.frames[i].id)})));void as;return withDecision(x,swap(dec));}));
  }else if(decisionId==='placement'){
   const sizes=a.frames.map(f=>({w:f.metadata?.size?.[0]||a.width,h:f.metadata?.size?.[1]||a.height})),pl=placeFrames(sizes,{mode:alt});
   ctx.execute(ctx.edit(label,d=>withDecision(P.mapAsset(d,assetId,x=>({...x,cels:x.cels.map(c=>{const k=x.frames.findIndex(f=>f.id===c.frameId);return k<0?c:{...c,x:pl.offsets[k].x,y:pl.offsets[k].y};})})),swap(dec))));
  }else if(dec.kind==='box-slice'){
   const boxId=Object.entries(a.import.sliceBoxes||{}).find(([,n])=>n===dec.label)?.[0];if(!boxId)return;
   const ids=a.frames.map(f=>f.id);
   ctx.execute(ctx.edit(label,d=>withDecision(alt==='ignore'?D.removeBox(d,assetId,ids,boxId):D.updateBox(d,assetId,ids,boxId,{type:alt}),swap(dec))));
  }else if(dec.kind==='pivot-slice'&&alt==='ignore'){
   ctx.execute(ctx.edit(label,d=>withDecision(P.mapAsset(d,assetId,x=>({...x,frames:x.frames.map(f=>({...f,pivotX:.5,pivotY:1}))})),swap(dec))));
  }
  onChange(assetId);
 }
 const altLabel=alt=>{const k='sp.alt.'+String(alt);const v=t(k);return v===k?String(alt):v;};
 // ---------------------------------------------------------------- Sprite Lab JSON
 async function importLab({file,json},img){
  let assetId=null;
  if(img){const {record,source}=await images.importFile(img);const asset=P.imageAsset({name:img.name,width:record.width,height:record.height,blob:record.id,source});assetId=add(asset,t('sp.cmd.importFile',{name:img.name}));}
  else{const a=ctx.activeAsset;if(a&&json.sheet&&a.width===json.sheet.width&&a.height===json.sheet.height&&a.cels.some(c=>c.frameId===P.SHARED))assetId=a.id;}
  if(!assetId)throw Error(t('sp.import.labNeedsSheet',{w:json.sheet?.width??'?',h:json.sheet?.height??'?'}));
  const a=P.assetById(ctx.doc,assetId),loaded=readLabProject(json,{sheetWidth:a.width,sheetHeight:a.height}),{frames,tags}=labProjectFrames(a,loaded);
  ctx.execute(ctx.edit(t('sp.cmd.labProject',{n:frames.length}),d=>D.replaceContent(d,assetId,{frames,tags,importInfo:{kind:'sprite-lab',decisions:[{id:'lab',label:'lab',chosen:file.name,confidence:'high',reasons:[`${frames.length} frames and ${tags.length} animations from ${file.name}`],alternatives:[]}]}})));
  return assetId;
 }
 // ---------------------------------------------------------------- atlas data
 async function importAtlas(img,{file,atlas}){
  const {record,source}=await images.importFile(img);
  const base=P.imageAsset({name:img.name,width:record.width,height:record.height,blob:record.id,source});
  const {frames,tags,decisions,rotated}=atlasFrames(atlas,{width:record.width,height:record.height});
  if(rotated)decisions.push({id:'rotated',label:'rotated',chosen:String(rotated),confidence:'high',reasons:[`${rotated} rotated frames are kept as regions; their pixels stay rotated (UNVERIFIED for export)`],alternatives:[]});
  const tagList=buildTags(frames,tags);
  const asset=D.syncTags({...base,frames,tags:tagList,import:{kind:'atlas',decisions}});
  return add(asset,t('sp.cmd.importFile',{name:file.name}));
 }
 return {importFiles,importFrameFiles,importSheet,analyzeSheet,applySheet,planFor,sheetState,setCustomGrid,choose,classify};
}
