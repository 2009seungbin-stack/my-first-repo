/** The twelve v1 recipe steps as adapters over Nerulio's engines (platform/recipe.js has the params).
 * Each step is (doc, p, ctx) → doc and never mutates its input. Pure steps run in the pipeline worker
 * (and in Node tests); the AI steps (bg.remove AI, upscale AI) and caption (browser text rendering)
 * need the page: `main(p)` says so, and the runner hands them `ctx.ai` from src/pipeline/browser.js.
 *
 * Engines wrapped, not rewritten: src/matting.js + src/super-resolution.js (through ctx.ai),
 * src/studio/pixel/converter.js (pixelize, palette), src/studio/pixel/cleanup.js + src/game/pixel-snap.js
 * (pixel.snap), src/game/export/anim.js (GIF), src/game/zlib.js (PNG/APNG deflate). New here: sheet
 * splitting (sheet.js), the die-cut border (border.js), motion loops, the fit presets and byte targets. */
import {FIT_SPECS,defaultStep} from '../../platform/recipe.js';
import {adaptiveTolerance,alphaBounds,borderColor,contentBounds,cropRect,blank,fill,hexRGB,over,resize,warp,hasTransparency,mapFrames,withFrames} from './raster.js';
import {splitSheet} from './sheet.js';
import {stickerBorder} from './border.js';
import {fitBytes,zipFiles,pngStill} from './encode.js';
import {sampleToGrid,paletteFromFrames,quantizeFrames,scaleNearest} from '../studio/pixel/converter.js';
import {analyse,runCleanup} from '../studio/pixel/cleanup.js';

/** Thrown by a step that has to run on the page (AI model, browser text) when called without ctx.ai. */
export class NeedsPage extends Error{constructor(op){super(`${op} runs on the page`);this.name='NeedsPage';}}
const note=(ctx,x)=>ctx?.report?.(x);

// ---------------------------------------------------------------- bg.remove
/** Solid backdrop → transparent: border-connected flood fill within `tol`, then the edge band is
 * un-mixed from the backdrop colour (colour-to-alpha), which removes the light/dark halo a plain
 * flood fill leaves around anti-aliased outlines. */
export function removeSolid(data,w,h,color,tol,{hard=false}={}){
 const out=new Uint8ClampedArray(data),n=w*h,bg=new Uint8Array(n),lim=tol*tol,stack=[];
 const near=i=>{const p=i*4;if(data[p+3]<8)return true;const r=data[p]-color[0],g=data[p+1]-color[1],b=data[p+2]-color[2];return r*r+g*g+b*b<=lim;};
 const seed=i=>{if(!bg[i]&&near(i)){bg[i]=1;stack.push(i);}};
 for(let x=0;x<w;x++){seed(x);seed((h-1)*w+x);}for(let y=0;y<h;y++){seed(y*w);seed(y*w+w-1);}
 while(stack.length){const i=stack.pop(),x=i%w,y=(i-x)/w;if(x>0)seed(i-1);if(x<w-1)seed(i+1);if(y>0)seed(i-w);if(y<h-1)seed(i+w);}
 for(let i=0;i<n;i++)if(bg[i])out[i*4+3]=0;
 // Edge band: pixels within 2 px of the removed backdrop.
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(bg[i])continue;let edge=false;
  for(let dy=-2;dy<=2&&!edge;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-2;dx<=2;dx++){const xx=x+dx;if(xx>=0&&xx<w&&bg[yy*w+xx]){edge=true;break;}}}
  if(!edge)continue;const p=i*4;let a=0;
  for(let c=0;c<3;c++){const v=data[p+c],b=color[c],den=v>b?255-b:b;const s=den?Math.abs(v-b)/den:0;if(s>a)a=s;}
  a=Math.min(1,a*1.15);// a little firmer than the pure estimate: keeps thin dark lines solid
  if(a>=1)continue;if(a<.04){out[p+3]=0;continue;}
  for(let c=0;c<3;c++)out[p+c]=Math.round(color[c]+(data[p+c]-color[c])/a);
  out[p+3]=Math.round(Math.min(data[p+3]/255,a)*255);
 }
 despeckle(out,w,h,color,tol);
 if(hard)for(let i=3;i<out.length;i+=4)out[i]=out[i]>=128?255:0;
 return out;
}
/** Islands of backdrop noise the flood fill could not reach (AI backdrops are rarely flat): small opaque
 * pieces (< 2 % of the largest) whose average colour is still close to the backdrop. */
function despeckle(out,w,h,color,tol){
 const n=w*h,lab=new Int32Array(n),comps=[],stack=[];
 for(let s=0;s<n;s++){if(lab[s]||out[s*4+3]<128)continue;const c={id:comps.length+1,px:[],r:0,g:0,b:0};comps.push(c);lab[s]=c.id;stack.push(s);
  while(stack.length){const i=stack.pop();c.px.push(i);c.r+=out[i*4];c.g+=out[i*4+1];c.b+=out[i*4+2];const x=i%w,y=(i-x)/w;
   for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;const j=yy*w+xx;if(!lab[j]&&out[j*4+3]>=128){lab[j]=c.id;stack.push(j);}}}}}
 if(comps.length<2)return;
 const big=Math.max(...comps.map(c=>c.px.length)),lim=(2.2*tol)**2;
 for(const c of comps){const a=c.px.length;if(a>=.02*big)continue;const r=c.r/a-color[0],g=c.g/a-color[1],b=c.b/a-color[2];if(r*r+g*g+b*b>lim)continue;
  for(const i of c.px)out[i*4+3]=0;
  // and the soft rim around it
  for(const i of c.px){const x=i%w,y=(i-x)/w;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<w&&yy<h&&out[(yy*w+xx)*4+3]<128)out[(yy*w+xx)*4+3]=0;}}}
}
/** Which way 'auto' goes for one picture: already transparent, a solid backdrop, or the AI model. */
export function bgMode(data,w,h,tol){
 const b=borderColor(data,w,h,tol);
 if(b.transparent)return {mode:'keep',color:null};
 return b.share>=.9?{mode:'color',color:b.color}:{mode:'ai',color:b.color};
}
async function bgRemove(doc,p,ctx){
 const items=[];const used={color:0,ai:0,keep:0};
 for(const it of doc.items){
  const f=it.frames[0],m=p.mode==='color'?{mode:'color',color:borderColor(f.data,it.w,it.h,p.tolerance).color}:p.mode==='ai'?{mode:'ai',color:null}:bgMode(f.data,it.w,it.h,p.tolerance);
  const tol=m.mode==='color'&&p.mode==='auto'?adaptiveTolerance(f.data,it.w,it.h,m.color,p.tolerance):p.tolerance;
  used[m.mode]++;
  if(m.mode==='keep'){items.push(p.hard?mapFrames(it,(d,w,h)=>({data:d.map((v,i)=>i%4===3?(v>=128?255:0):v),w,h})):it);continue;}
  if(m.mode==='color'){items.push(mapFrames(it,(d,w,h)=>({data:removeSolid(d,w,h,m.color,tol,{hard:p.hard}),w,h})));continue;}
  if(!ctx?.ai?.bgRemove)throw new NeedsPage('bg.remove');
  const frames=[];for(const fr of it.frames){let d=await ctx.ai.bgRemove(fr.data,it.w,it.h,{refine:p.refine});if(p.hard){d=new Uint8ClampedArray(d);for(let i=3;i<d.length;i+=4)d[i]=d[i]>=128?255:0;}frames.push({data:d,ms:fr.ms});}
  items.push(withFrames(it,it.w,it.h,frames));
 }
 note(ctx,{op:'bg.remove',used});
 return {items,notes:doc.notes};
}

// ---------------------------------------------------------------- sheet.split
function sheetSplit(doc,p,ctx){
 const items=[];let last=null;
 for(const it of doc.items){
  const r=splitSheet(it.frames[0].data,it.w,it.h,p);last=r;
  const pad=String(r.cells.length).length<2?2:String(r.cells.length).length;
  r.cells.forEach((c,i)=>items.push({name:r.cells.length>1?`${it.name}-${String(i+1).padStart(pad,'0')}`:it.name,w:c.w,h:c.h,frames:[{data:c.data,ms:it.frames[0].ms}]}));
 }
 if(last)note(ctx,{op:'sheet.split',cols:last.cols,rows:last.rows,count:items.length,method:last.method,expected:{cols:p.cols,rows:p.rows}});
 return {items,notes:doc.notes};
}

// ---------------------------------------------------------------- crop
const RATIO={'1:1':1,'4:3':4/3,'3:4':3/4,'3:2':1.5,'2:3':2/3,'16:9':16/9,'9:16':9/16,'4:5':.8};
/** The crop rectangle as intent: subject box + margin, grown to the ratio; inside the picture when it is opaque. */
export function cropRectFor(data,w,h,p){
 const opaque=!hasTransparency(data);
 const ar=RATIO[p.ratio]||0;
 let r;
 if(p.mode==='subject'){
  const b=(opaque?contentBounds(data,w,h,36):alphaBounds(data,w,h,8))||{x:0,y:0,w,h};
  const m=Math.round(p.margin*Math.max(b.w,b.h));
  r={x:b.x-m,y:b.y-m,w:b.w+2*m,h:b.h+2*m};
  if(ar){const cx=r.x+r.w/2,cy=r.y+r.h/2;if(r.w/r.h<ar)r.w=Math.round(r.h*ar);else r.h=Math.round(r.w/ar);r.x=Math.round(cx-r.w/2);r.y=Math.round(cy-r.h/2);}
 }else{
  let cw=w,ch=h;if(ar){if(w/h>ar)cw=Math.round(h*ar);else ch=Math.round(w/ar);}
  const k=1-p.margin;cw=Math.max(1,Math.round(cw*k));ch=Math.max(1,Math.round(ch*k));
  r={x:Math.round((w-cw)/2),y:Math.round((h-ch)/2),w:cw,h:ch};
 }
 if(opaque){
  // Never invent pixels around a photo: keep the ratio and shrink/shift into the picture.
  if(r.w>w||r.h>h){const s=Math.min(w/r.w,h/r.h),cx=r.x+r.w/2,cy=r.y+r.h/2;r.w=Math.max(1,Math.floor(r.w*s));r.h=Math.max(1,Math.floor(r.h*s));r.x=Math.round(cx-r.w/2);r.y=Math.round(cy-r.h/2);}
  r.x=Math.min(Math.max(0,r.x),w-r.w);r.y=Math.min(Math.max(0,r.y),h-r.h);
 }
 return r;
}
/** Circle / rounded-corner alpha mask with a 1 px analytic anti-aliased edge. */
export function shapeMask(data,w,h,shape,radius){
 if(shape==='rect')return data;
 const out=new Uint8ClampedArray(data);
 const R=shape==='circle'?Math.min(w,h)/2:Math.max(0,radius*Math.min(w,h));
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const px=x+.5,py=y+.5;let d;
  if(shape==='circle')d=Math.hypot(px-w/2,py-h/2)-R;
  else{const qx=Math.max(Math.abs(px-w/2)-(w/2-R),0),qy=Math.max(Math.abs(py-h/2)-(h/2-R),0);d=R>0?Math.hypot(qx,qy)-R:-1;}
  const cov=d<=-.5?1:d>=.5?0:.5-d;if(cov<1){const i=(y*w+x)*4+3;out[i]=Math.round(out[i]*cov);}
 }
 return out;
}
function crop(doc,p){
 return {items:doc.items.map(it=>{const r=cropRectFor(it.frames[0].data,it.w,it.h,p);return mapFrames(it,(d,w,h)=>({data:shapeMask(cropRect(d,w,h,r),r.w,r.h,p.shape,p.radius),w:r.w,h:r.h}));}),notes:doc.notes};
}

// ---------------------------------------------------------------- upscale
async function upscale(doc,p,ctx){
 const items=[];
 for(const it of doc.items){
  const s=Math.min(p.scale,p.maxSide/Math.max(it.w,it.h));
  if(s<=1.001){items.push(it);note(ctx,{op:'upscale',skipped:'maxSide'});continue;}
  if(p.engine==='pixel'){const k=Math.max(1,Math.floor(s));items.push(mapFrames(it,(d,w,h)=>{const r=scaleNearest({data:d,width:w,height:h},k);return {data:new Uint8ClampedArray(r.data.buffer,r.data.byteOffset,r.data.byteLength),w:r.width,h:r.height};}));continue;}
  const tw=Math.round(it.w*s),th=Math.round(it.h*s);
  if(p.engine==='smooth'){items.push(mapFrames(it,(d,w,h)=>({data:resize(d,w,h,tw,th),w:tw,h:th})));continue;}
  if(!ctx?.ai?.upscale)throw new NeedsPage('upscale');
  const frames=[];for(const f of it.frames){const r=await ctx.ai.upscale(f.data,it.w,it.h);frames.push({data:r.w===tw&&r.h===th?r.data:resize(r.data,r.w,r.h,tw,th),ms:f.ms});}
  items.push(withFrames(it,tw,th,frames));
 }
 return {items,notes:doc.notes};
}

// ---------------------------------------------------------------- fit
/** Size and placement of a picture in a target spec (pure arithmetic, exported for tests). */
export function fitPlan(w,h,p){
 const spec=FIT_SPECS[p.preset],side=spec?.side||'box',W=p.w,H=p.h;
 if(side==='long'){const L=Math.max(W,H),s=L/Math.max(w,h);let cw=Math.max(1,Math.round(w*s)),ch=Math.max(1,Math.round(h*s));if(w>=h)cw=L;else ch=L;return {W:cw,H:ch,cw,ch,x:0,y:0};}
 if(p.mode==='cover'){const s=Math.max(W/w,H/h),cw=Math.max(W,Math.round(w*s)),ch=Math.max(H,Math.round(h*s));return {W,H,cw,ch,x:Math.round((W-cw)/2),y:Math.round((H-ch)/2)};}
 const m=Math.round(p.margin*Math.min(W,H)),aw=W-2*m,ah=H-2*m,s=Math.min(aw/w,ah/h),cw=Math.max(1,Math.min(aw,Math.round(w*s))),ch=Math.max(1,Math.min(ah,Math.round(h*s)));
 return {W,H,cw,ch,x:Math.floor((W-cw)/2),y:Math.floor((H-ch)/2)};
}
function fit(doc,p){
 const bg=p.bg==='transparent'?null:hexRGB(p.bg);
 return {items:doc.items.map(it=>{const plan=fitPlan(it.w,it.h,p);
  return mapFrames(it,(d,w,h)=>{const sc=resize(d,w,h,plan.cw,plan.ch,p.scale==='nearest'?'nearest':'smooth');const base=bg?fill(plan.W,plan.H,bg):blank(plan.W,plan.H);
   // Cover: the resized picture is larger than the canvas; over() clips it.
   return {data:over(base,plan.W,plan.H,sc,plan.cw,plan.ch,plan.x,plan.y),w:plan.W,h:plan.H};});}),notes:doc.notes};
}

// ---------------------------------------------------------------- pixel steps
function pixelize(doc,p){
 return {items:doc.items.map(it=>{const long=Math.max(it.w,it.h),gw=Math.max(1,Math.round(p.size*it.w/long)),gh=Math.max(1,Math.round(p.size*it.h/long));
  return mapFrames(it,(d,w,h)=>{const r=sampleToGrid({data:d,width:w,height:h},gw,gh,{method:p.sampler});return {data:new Uint8ClampedArray(r.data),w:r.width,h:r.height};});}),notes:doc.notes};
}
function palette(doc,p){
 return {items:doc.items.map(it=>{
  const frames=it.frames.map(f=>({data:f.data,width:it.w,height:it.h}));
  const pal=paletteFromFrames(frames,p.colors,{algorithm:p.method});
  const q=quantizeFrames(frames,pal,{dither:p.dither,strength:p.strength});
  return withFrames(it,it.w,it.h,q.map((f,i)=>({data:new Uint8ClampedArray(f.data),ms:it.frames[i].ms})));}),notes:doc.notes};
}
function pixelSnap(doc,p,ctx){
 const items=doc.items.map(it=>{
  const frames=it.frames.map(f=>({data:new Uint8Array(f.data.buffer,f.data.byteOffset,f.data.byteLength),width:it.w,height:it.h}));
  const o={intent:'restore',scale:p.scale||'auto',background:p.background,maxColors:p.colors};
  const A=analyse(frames,o);
  note(ctx,{op:'pixel.snap',grid:A.grid?{scale:A.grid.scale??A.grid.scaleX,confidence:A.grid.confidence,kind:A.grid.kind}:null,candidate:A.candidate?{scale:A.candidate.scale??A.candidate.scaleX,confidence:A.candidate.confidence}:null});
  const r=runCleanup(frames,o,A);
  const w=r.frames[0].width,h=r.frames[0].height;
  return withFrames(it,w,h,r.frames.map((f,i)=>({data:new Uint8ClampedArray(f.data),ms:it.frames[i].ms})));
 });
 return {items,notes:doc.notes};
}

// ---------------------------------------------------------------- sticker.border
function border(doc,p){
 if(!p.width)return doc;
 const color=hexRGB(p.color);
 return {items:doc.items.map(it=>{const px=Math.max(1,Math.round(p.width*Math.max(it.w,it.h)));
  return mapFrames(it,(d,w,h)=>{const r=stickerBorder(d,w,h,{px,color,shadow:p.shadow});return {data:r.data,w:r.w,h:r.h};});}),notes:doc.notes};
}

// ---------------------------------------------------------------- caption
async function caption(doc,p,ctx){
 if(!p.text)return doc;
 if(!ctx?.ai?.caption)throw new NeedsPage('caption');
 const items=[];
 for(const it of doc.items){const frames=[];for(const f of it.frames)frames.push({data:await ctx.ai.caption(f.data,it.w,it.h,p),ms:f.ms});items.push(withFrames(it,it.w,it.h,frames));}
 return {items,notes:doc.notes};
}

// ---------------------------------------------------------------- motion
/** One frame of a loop at phase t ∈ [0,1): the picture is first fitted inside 1/(1+amp) of the canvas,
 * so nothing is clipped whatever the step order. */
export function motionFrame(d,w,h,kind,amp,t){
 const k=1/(1+amp),wave=(1-Math.cos(2*Math.PI*t))/2;
 switch(kind){
  case 'bounce':{const sq=Math.min(.08,amp)*(1-wave);return warp(d,w,h,{sx:k*(1+sq),sy:k*(1-sq),dy:amp*h*k*(.5-wave)});}
  case 'shake':return warp(d,w,h,{sx:k,sy:k,rot:Math.sin(2*Math.PI*t)*amp*1.6,dx:Math.sin(2*Math.PI*t)*amp*w*k*.5});
  case 'blink':return warp(d,w,h,{sx:k,sy:k,alpha:1-wave*Math.min(.85,amp*8)});
  case 'zoom':return warp(d,w,h,{sx:k*(1+amp*wave),sy:k*(1+amp*wave)});
 }
 return new Uint8ClampedArray(d);
}
function motion(doc,p){
 return {items:doc.items.map(it=>{const base=it.frames[0].data;const frames=[];for(let i=0;i<p.frames;i++)frames.push({data:motionFrame(base,it.w,it.h,p.kind,p.amp,i/p.frames),ms:p.ms});return withFrames(it,it.w,it.h,frames);}),notes:doc.notes};
}

/** Op → implementation, and whether it needs the page for these params. */
export const STEPS=Object.freeze({
 'bg.remove':{run:bgRemove,main:p=>p.mode!=='color'},
 'sheet.split':{run:sheetSplit,main:()=>false},
 crop:{run:crop,main:()=>false},
 upscale:{run:upscale,main:p=>p.engine==='ai'},
 fit:{run:fit,main:()=>false},
 pixelize:{run:pixelize,main:()=>false},
 palette:{run:palette,main:()=>false},
 'pixel.snap':{run:pixelSnap,main:()=>false},
 'sticker.border':{run:border,main:()=>false},
 caption:{run:caption,main:p=>!!p.text},
 motion:{run:motion,main:()=>false},
});

// ---------------------------------------------------------------- export
const MIME={png:'image/png',apng:'image/png',gif:'image/gif',webp:'image/webp'};
const EXT={png:'png',apng:'png',gif:'gif',webp:'webp'};
/** Files of a finished doc. `fitPreset` = the last fit step's preset (LINE extras, names).
 * @returns {Promise<{files:{name:string,bytes:Uint8Array,mime:string,w:number,h:number,frames:number,colors:number|null,over:boolean}[],pack:{name:string,bytes:Uint8Array}|null}>} */
export async function exportDoc(doc,p,ctx={},{fitPreset=null,stem='nerulio'}={}){
 const many=doc.items.length>1,width=String(doc.items.length).length<2?2:String(doc.items.length).length;
 const files=[];
 for(const [i,it] of doc.items.entries()){
  const r=await fitBytes(it,{format:p.format,maxBytes:p.maxBytes,loop:p.loop,webp:ctx.ai?.webp});
  const name=many?`${String(i+1).padStart(width,'0')}.${EXT[r.format]}`:`${stem}.${EXT[r.format]}`;
  files.push({name,bytes:r.bytes,mime:MIME[r.format],w:it.w,h:it.h,frames:it.frames.length,colors:r.colors,over:r.over});
 }
 // LINE Creators Market wants main.png (240×240) and tab.png (96×74) beside the stickers.
 if(p.extras&&fitPreset==='line.sticker'&&doc.items.length){
  const first=doc.items[0],f=first.frames[0].data;
  for(const [name,W,H] of [['main.png',240,240],['tab.png',96,74]]){
   const plan=fitPlan(first.w,first.h,{preset:'custom',w:W,h:H,mode:'contain',margin:0});
   const sc=resize(f,first.w,first.h,plan.cw,plan.ch);const data=over(blank(W,H),W,H,sc,plan.cw,plan.ch,plan.x,plan.y);
   files.push({name,bytes:pngStill(data,W,H),mime:'image/png',w:W,h:H,frames:1,colors:null,over:false});
  }
 }
 const zip=p.pack==='zip'||(p.pack==='auto'&&files.length>1);
 return {files,pack:zip?{name:`${stem}.zip`,bytes:zipFiles(files)}:null};
}
export const DEFAULT_EXPORT=defaultStep('export').p;
