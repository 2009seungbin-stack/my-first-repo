import * as Im from '../image.js';
import {clamp,stem,zip} from '../core.js';
import {landingFor,SOCIAL} from '../landings.js';
import {t} from '../i18n.js';
import {BRAND} from '../brand.js';
import {text,toast,download,track,onLocale,continueWith,authorize,page as route,locale} from './shell.js';
/** Image crop: the picture appears with a crop box already on it, the output size is the big
 * number and Download is live from the first frame — there is nothing to run. The box is kept
 * in image pixels (never screen pixels), so what is exported is exactly what is framed at any
 * display zoom. Orientation (90° turns, mirror) and straightening are a declarative transform
 * replayed from the untouched source, which keeps undo exact and avoids stacked resampling. */
export const accept='image/*,.heic,.heif';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RATIOS=[['free',0],['1:1',1],['4:3',4/3],['3:2',1.5],['16:9',16/9],['9:16',9/16],['4:5',.8],['orig',-1]];
const HANDLES=['nw','n','ne','e','se','s','sw','w'],EXT={png:'png',jpeg:'jpg',webp:'webp'},MIN=8,PREVIEW=1400;
const int=(v,max=65535)=>{const n=Math.round(Number(v));return Number.isFinite(n)&&n>0?Math.min(max,n):0;};
const norm=(b,vw,vh)=>{const w=Math.max(1,Math.min(vw,Math.round(b.w))),h=Math.max(1,Math.min(vh,Math.round(b.h)));return {x:clamp(Math.round(b.x),0,vw-w),y:clamp(Math.round(b.y),0,vh-h),w,h};};
const centred=(vw,vh,ar)=>{if(!(ar>0))return {x:0,y:0,w:vw,h:vh};let w=vw,h=vw/ar;if(h>vh){h=vh;w=vh*ar;}return norm({x:(vw-w)/2,y:(vh-h)/2,w,h},vw,vh);};
function ratioName(ar){return RATIOS.find(([,v])=>v>0&&Math.abs(v-ar)<v*.005)?.[0]||'custom';}
/** Zoom that keeps a w×h frame fully covered by the same rectangle rotated by `deg`. */
const coverScale=(w,h,deg)=>{const a=Math.abs(deg)*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));return Math.max((w*c+h*s)/w,(w*s+h*c)/h);};
/** Source → oriented → straightened, in one blit. `tr.turn` counts clockwise quarter turns and
 * `tr.mirror` is a horizontal flip of the source; the buttons compose them in display space
 * (see turnBy / mirrorBy) so the crop box can follow without re-measuring the picture. */
function paint(ctx,src,tr,w,h){
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.translate(w/2,h/2);
 if(tr.angle){ctx.rotate(tr.angle*Math.PI/180);const z=coverScale(w,h,tr.angle);ctx.scale(z,z);}
 ctx.rotate(tr.turn*Math.PI/2);if(tr.mirror)ctx.scale(-1,1);
 ctx.drawImage(src,-src.width/2,-src.height/2);
}
function roundedPath(ctx,w,h,r){
 r=Math.min(r,w/2,h/2);ctx.moveTo(r,0);ctx.lineTo(w-r,0);ctx.arcTo(w,0,w,r,r);ctx.lineTo(w,h-r);ctx.arcTo(w,h,w-r,h,r);ctx.lineTo(r,h);ctx.arcTo(0,h,0,h-r,r);ctx.lineTo(0,r);ctx.arcTo(0,0,r,0,r);ctx.closePath();
}
/** A circle or rounded crop leaves the outside fully transparent instead of filling it. */
function maskShape(c,shape,radius){
 const ctx=c.getContext('2d'),w=c.width,h=c.height;
 ctx.save();ctx.globalCompositeOperation='destination-in';ctx.fillStyle='#fff';ctx.beginPath();
 if(shape==='circle')ctx.ellipse(w/2,h/2,w/2,h/2,0,0,Math.PI*2);else roundedPath(ctx,w,h,Math.min(w,h)/2*clamp(radius,0,100)/100);
 ctx.fill();ctx.restore();
}
/** Content bounds of an opaque image with a uniform border: the border colour comes from the
 * four corners and rows are read in bands, so a large photo never needs one full ImageData. */
function borderBounds(c,tol=14){
 const ctx=c.getContext('2d',{willReadFrequently:true}),W=c.width,H=c.height;
 const at=(x,y)=>ctx.getImageData(x,y,1,1).data,base=at(0,0);
 for(const p of [at(W-1,0),at(0,H-1),at(W-1,H-1)])for(let i=0;i<4;i++)if(Math.abs(p[i]-base[i])>tol)return null;
 let left=W,top=H,right=-1,bottom=-1;
 for(let y=0;y<H;y+=64){
  const rows=Math.min(64,H-y),d=ctx.getImageData(0,y,W,rows).data;
  for(let r=0;r<rows;r++)for(let x=0;x<W;x++){
   const i=(r*W+x)*4;
   if(Math.abs(d[i]-base[0])>tol||Math.abs(d[i+1]-base[1])>tol||Math.abs(d[i+2]-base[2])>tol||Math.abs(d[i+3]-base[3])>tol){
    if(x<left)left=x;if(x>right)right=x;const yy=y+r;if(yy<top)top=yy;if(yy>bottom)bottom=yy;}
  }
 }
 return right<0?null:{x:left,y:top,w:right-left+1,h:bottom-top+1};
}
export function mount({el,def}){
 const T=(k,v)=>text('crop.'+k,v);
 const items=[];let current=0,seq=0,drag=null,busy=false,undoStack=[],redoStack=[],lastKey='',lastAt=0,o=preset();
 /** Landing preset first, then the URL: ratio, exact size, a SOCIAL platform slug, shape. */
 function preset(){
  const q=new URLSearchParams(landingFor(route.landing)?.query||'');for(const [k,v] of route.query)q.set(k,v);
  const slug=Object.hasOwn(SOCIAL,q.get('preset')||'')?q.get('preset'):'';
  let w=int(q.get('w')),h=int(q.get('h'));if(slug)[,w,h]=SOCIAL[slug];
  const exact=!!(w&&h),named=RATIOS.find(([k])=>k===q.get('ratio'));
  return {ratio:named?named[0]:exact?ratioName(w/h):'free',preset:slug,outMode:exact?'exact':'keep',outW:w,outH:h,ar:exact?w/h:0,
   format:['keep','png','jpeg','webp'].includes(q.get('format'))?q.get('format'):'keep',quality:clamp(int(q.get('quality'),100)||92,25,100),
   shape:['rect','circle','round'].includes(q.get('shape'))?q.get('shape'):'rect',radius:22};
 }
 const workW=it=>it.tr.turn%2?it.source.height:it.source.width,workH=it=>it.tr.turn%2?it.source.width:it.source.height;
 const arOf=it=>o.ratio==='free'?0:o.ratio==='orig'?workW(it)/workH(it):o.ratio==='custom'?o.ar:RATIOS.find(([k])=>k===o.ratio)[1];
 function outputSize(b){
  if(o.outMode!=='exact')return {w:b.w,h:b.h};
  let w=o.outW,h=o.outH;
  if(w&&!h)h=Math.max(1,Math.round(b.h*w/b.w));
  if(h&&!w)w=Math.max(1,Math.round(b.w*h/b.h));
  return w&&h?{w,h}:{w:b.w,h:b.h};
 }
 const formatOf=file=>{const kept=['image/png','image/jpeg','image/webp'].includes(file.type)?file.type.slice(6):'png',f=o.format==='keep'?kept:o.format;return f==='jpeg'&&o.shape!=='rect'?'png':f;};
 const boxOf=it=>norm(it.box,workW(it),workH(it)),sizeOf=it=>outputSize(boxOf(it));
 // ---- chrome
 function empty(){el.innerHTML=`<div class="dropzone" data-action="pick" role="button" tabindex="0"><div class="dropzone-art" aria-hidden="true"><span></span><span></span><b>+</b></div><strong>${esc(T('drop'))}</strong><span>${esc(T('dropHint'))}</span><div class="dropzone-actions"><button type="button" class="primary" data-action="pick">${esc(text('pick'))}</button></div><small class="local-note">${esc(text('local'))}</small></div>`;}
 const tool=(action,label,mark)=>`<button type="button" class="mini-button" data-action="${action}" title="${esc(label)}" aria-label="${esc(label)}"><span aria-hidden="true">${mark}</span></button>`;
 function frame(){
  el.innerHTML=`<div class="work crop-work"><section class="viewer crop-viewer">
<div class="crop-bar" role="toolbar" aria-label="${esc(T('area'))}">${tool('crop-turn-left',T('rotateLeft'),'⟲')}${tool('crop-turn-right',T('rotateRight'),'⟳')}${tool('crop-flip-h',T('flipH'),'⇄')}${tool('crop-flip-v',T('flipV'),'⇅')}<span class="crop-gap"></span><button type="button" class="mini-button wide" data-action="crop-trim">${esc(T('autoTrim'))}</button>${tool('crop-undo',T('undo'),'↶')}${tool('crop-redo',T('redo'),'↷')}<button type="button" class="mini-button wide" data-action="crop-reset">${esc(T('reset'))}</button></div>
<div class="crop-stage"><div class="crop-frame" id="cropFrame"><canvas id="cropView"></canvas><div class="crop-box" id="cropBox" tabindex="0" role="group" aria-label="${esc(T('area'))}"><span class="crop-thirds" aria-hidden="true"></span>${HANDLES.map(h=>`<b class="crop-handle h-${h}" data-handle="${h}"></b>`).join('')}</div></div></div>
<p class="viewer-note" id="cropNote"></p></section>
<aside class="side"><div class="summary" id="taskSummary" role="status" aria-live="polite"></div>
<form id="cropOptions" class="options" autocomplete="off"><span class="opt-label">${esc(T('ratio'))}</span><div class="chips-row" id="cropRatio" role="group" aria-label="${esc(T('ratio'))}">${RATIOS.map(([k])=>`<button type="button" class="chip" data-ratio="${k}" aria-pressed="${o.ratio===k}">${esc(k==='free'?T('free'):k==='orig'?T('orig'):k)}</button>`).join('')}</div>
<label class="field spaced"><span>${esc(T('preset'))}</span><select id="cropPreset">${['',...Object.keys(SOCIAL)].map(slug=>`<option value="${slug}" ${o.preset===slug?'selected':''}>${slug?esc((SOCIAL[slug][0][locale()]||SOCIAL[slug][0].en)+' · '+SOCIAL[slug][1]+'×'+SOCIAL[slug][2]):esc(T('presetNone'))}</option>`).join('')}</select></label>
<details class="options-advanced" id="optionsAdvanced" ${o.outMode==='exact'||o.shape!=='rect'||o.format!=='keep'?'open':''}><summary>${esc(text('advanced'))}</summary>
<span class="opt-label">${esc(T('area'))}</span><div class="field-row"><label class="field"><span>X</span><input id="cropX" type="number" min="0" max="65535" inputmode="numeric"></label><label class="field"><span>Y</span><input id="cropY" type="number" min="0" max="65535" inputmode="numeric"></label></div>
<div class="field-row"><label class="field"><span>${esc(T('width'))}</span><input id="cropW" type="number" min="1" max="65535" inputmode="numeric"></label><label class="field"><span>${esc(T('height'))}</span><input id="cropH" type="number" min="1" max="65535" inputmode="numeric"></label></div>
<label class="field"><span>${esc(T('straighten'))} <output id="cropAngleOut">0°</output></span><input id="cropAngle" type="range" min="-45" max="45" step=".5" value="0"><small>${esc(T('straightenHint'))}</small></label>
<label class="field"><span>${esc(T('shape'))}</span><select id="cropShape">${['rect','circle','round'].map(s=>`<option value="${s}" ${o.shape===s?'selected':''}>${esc(T(s))}</option>`).join('')}</select></label>
<label class="field" id="cropRadiusField" ${o.shape==='round'?'':'hidden'}><span>${esc(T('radius'))} <output id="cropRadiusOut">${o.radius}%</output></span><input id="cropRadius" type="range" min="2" max="100" value="${o.radius}"></label>
<label class="field"><span>${esc(T('outSize'))}</span><select id="cropOutMode"><option value="keep" ${o.outMode==='keep'?'selected':''}>${esc(T('keepPixels'))}</option><option value="exact" ${o.outMode==='exact'?'selected':''}>${esc(T('exactSize'))}</option></select></label>
<div class="field-row" id="cropOutRow" ${o.outMode==='exact'?'':'hidden'}><label class="field"><span>${esc(T('width'))}</span><input id="cropOutW" type="number" min="0" max="65535" value="${o.outW||''}" inputmode="numeric"></label><label class="field"><span>${esc(T('height'))}</span><input id="cropOutH" type="number" min="0" max="65535" value="${o.outH||''}" inputmode="numeric"></label></div>
<label class="field"><span>${esc(text('compress.format'))}</span><select id="cropFormat">${['keep','png','jpeg','webp'].map(f=>`<option value="${f}" ${o.format===f?'selected':''}>${f==='keep'?esc(T('keep')):f==='jpeg'?'JPG':f.toUpperCase()}</option>`).join('')}</select></label>
<label class="field"><span>${esc(T('quality'))} <output id="cropQualityOut">${o.quality}</output></span><input id="cropQuality" type="range" min="25" max="100" value="${o.quality}"></label></details></form>
<button type="button" class="dashed" data-action="crop-apply-all" id="cropApplyAll" hidden>${esc(T('applyAll'))}</button>
<div class="file-list" id="taskFiles"></div><div class="list-actions"><button type="button" class="dashed" data-action="pick">${esc(text('add'))}</button><button type="button" class="link" data-action="crop-clear">${esc(text('removeAll'))}</button></div>
<button type="button" class="primary big" id="taskDownload" data-action="crop-download" disabled></button><nav class="next" id="taskNext"></nav><small class="local-note">${esc(text('local'))}</small></aside></div>`;
 }
 function renderView(){
  const it=items[current],cv=el.querySelector('#cropView'),host=el.querySelector('#cropFrame');if(!it||!cv)return;
  const vw=workW(it),vh=workH(it),pw=Math.max(1,Math.round(vw*it.pscale)),ph=Math.max(1,Math.round(vh*it.pscale));
  if(cv.width!==pw||cv.height!==ph){cv.width=pw;cv.height=ph;}
  paint(cv.getContext('2d'),it.preview,it.tr,pw,ph);
  host.style.setProperty('--ar',`${vw} / ${vh}`);host.style.setProperty('--arn',(vw/vh).toFixed(6));
 }
 function renderBox(){
  const it=items[current],box=el.querySelector('#cropBox');if(!it||!box)return;
  const vw=workW(it),vh=workH(it),b=boxOf(it),scale=el.querySelector('#cropFrame').getBoundingClientRect().width/vw||0;
  Object.assign(box.style,{left:b.x/vw*100+'%',top:b.y/vh*100+'%',width:b.w/vw*100+'%',height:b.h/vh*100+'%',
   borderRadius:o.shape==='circle'?'50%':o.shape==='round'?Math.round(Math.min(b.w,b.h)/2*clamp(o.radius,0,100)/100*scale)+'px':'0'});
  for(const [id,value] of [['#cropX',b.x],['#cropY',b.y],['#cropW',b.w],['#cropH',b.h]]){const input=el.querySelector(id);if(input&&document.activeElement!==input)input.value=value;}
  const angle=el.querySelector('#cropAngle');if(angle&&document.activeElement!==angle){angle.value=it.tr.angle;el.querySelector('#cropAngleOut').textContent=degrees(it.tr.angle);}
 }
 const degrees=a=>(a>0?'+':'')+a.toFixed(1).replace(/\.0$/,'')+'°';
 function renderSummary(){
  const it=items[current],box=el.querySelector('#taskSummary'),button=el.querySelector('#taskDownload');if(!it||!box)return;
  const b=boxOf(it),size=outputSize(b),fmt=formatOf(it.file);
  box.innerHTML=`<div class="summary-big">${size.w} × ${size.h}</div><div class="summary-line">${esc(T('source',{w:workW(it),h:workH(it)}))} · ${EXT[fmt].toUpperCase()}${items.length>1?' · '+esc(text('files',{n:items.length})):''}</div>`;
  button.disabled=busy;button.textContent=busy?T('working'):items.length>1?text('downloadAll',{n:items.length}):text('download');
  el.querySelector('#cropApplyAll').hidden=items.length<2;
  const note=[T('hint')];
  if(size.w!==b.w||size.h!==b.h)note.push(T('scaledTo',{a:`${b.w}×${b.h}`,b:`${size.w}×${size.h}`}));
  if(o.shape!=='rect'&&(o.format==='jpeg'||(o.format==='keep'&&it.file.type==='image/jpeg')))note.push(T('alphaFormat'));
  el.querySelector('#cropNote').textContent=note.join(' ');
  el.querySelector('[data-action="crop-undo"]').disabled=!undoStack.length;el.querySelector('[data-action="crop-redo"]').disabled=!redoStack.length;
 }
 function renderList(){
  const host=el.querySelector('#taskFiles');if(!host)return;
  host.innerHTML=items.map((it,i)=>{const b=boxOf(it),size=outputSize(b);
   return `<div class="file ${i===current?'is-current':''}" data-index="${i}"><button type="button" class="file-main" data-action="crop-select" data-index="${i}"><img ${it.thumb?`src="${it.thumb}"`:''} alt=""><span><b>${esc(it.file.name)}</b><small>${b.x},${b.y} · ${b.w}×${b.h}</small></span><em class="pill good">${size.w}×${size.h}</em></button><button type="button" class="icon" data-action="crop-save" data-index="${i}" title="${esc(text('saveOne'))}" aria-label="${esc(text('saveOne'))}">↓</button><button type="button" class="icon" data-action="crop-remove" data-index="${i}" title="${esc(text('remove'))}" aria-label="${esc(text('remove'))}">×</button></div>`;
  }).join('');
 }
 function renderNext(){
  const next=el.querySelector('#taskNext');if(next)next.innerHTML=`<span>${esc(text('next'))}</span>${(def.next||[]).map(id=>`<button type="button" class="chip" data-action="crop-next" data-tool="${id}">${esc(t(`intent.${id}.title`))}</button>`).join('')}`;
 }
 const render=()=>{renderView();renderBox();renderSummary();renderList();};
 // ---- history: one entry per gesture; typing in the same field for a moment coalesces.
 const snap=()=>items.map(it=>({id:it.id,box:{...it.box},tr:{...it.tr}}));
 function record(key=''){
  const now=Date.now();if(key&&key===lastKey&&now-lastAt<900){lastAt=now;return;}
  lastKey=key;lastAt=now;undoStack.push(snap());if(undoStack.length>60)undoStack.shift();redoStack.length=0;
 }
 function restore(state){lastKey='';for(const s of state){const it=items.find(x=>x.id===s.id);if(it){it.box={...s.box};it.tr={...s.tr};}}render();}
 // ---- transforms, composed in display space so the framing never jumps
 function turnBy(it,cw){
  const vw=workW(it),vh=workH(it),b=boxOf(it);
  it.box=cw?{x:vh-(b.y+b.h),y:b.x,w:b.h,h:b.w}:{x:b.y,y:vw-(b.x+b.w),w:b.h,h:b.w};
  it.tr={...it.tr,turn:(it.tr.turn+(cw?1:3))%4};
 }
 function mirrorBy(it,vertical){
  const vw=workW(it),vh=workH(it),b=boxOf(it),tr=it.tr;
  it.box=vertical?{...b,y:vh-(b.y+b.h)}:{...b,x:vw-(b.x+b.w)};
  it.tr={turn:((vertical?6:4)-tr.turn)%4,mirror:!tr.mirror,angle:-tr.angle};
 }
 function reset(it){it.tr={turn:0,mirror:false,angle:0};it.box=centred(it.source.width,it.source.height,arOf(it));}
 // ---- box editing (all maths in image pixels; the frame is measured live, so any zoom works)
 const pointAt=e=>{const it=items[current],r=el.querySelector('#cropFrame').getBoundingClientRect();
  return {x:clamp((e.clientX-r.left)/r.width,0,1)*workW(it),y:clamp((e.clientY-r.top)/r.height,0,1)*workH(it)};};
 function fromHandle(handle,start,p,ar,vw,vh){
  let x1=start.x,y1=start.y,x2=start.x+start.w,y2=start.y+start.h;
  const E=handle.includes('e'),W=handle.includes('w'),N=handle.includes('n'),S=handle.includes('s');
  if(E)x2=clamp(p.x,x1+MIN,vw);if(W)x1=clamp(p.x,0,x2-MIN);
  if(S)y2=clamp(p.y,y1+MIN,vh);if(N)y1=clamp(p.y,0,y2-MIN);
  let w=x2-x1,h=y2-y1;
  if(ar>0){
   if((E||W)&&(N||S)){
    if(w/h>ar)w=h*ar;else h=w/ar;
    const k=Math.min(1,(W?x2:vw-x1)/w,(N?y2:vh-y1)/h);w*=k;h*=k;
    if(W)x1=x2-w;else x2=x1+w;if(N)y1=y2-h;else y2=y1+h;
   }else if(E||W){
    h=Math.min(vh,w/ar);w=h*ar;if(W)x1=x2-w;else x2=x1+w;
    y1=clamp(start.y+start.h/2-h/2,0,vh-h);y2=y1+h;
    if(x1<0){x1=0;x2=w;}if(x2>vw){x2=vw;x1=vw-w;}
   }else{
    w=Math.min(vw,h*ar);h=w/ar;if(N)y1=y2-h;else y2=y1+h;
    x1=clamp(start.x+start.w/2-w/2,0,vw-w);x2=x1+w;
    if(y1<0){y1=0;y2=h;}if(y2>vh){y2=vh;y1=vh-h;}
   }
  }
  return norm({x:x1,y:y1,w:x2-x1,h:y2-y1},vw,vh);
 }
 function fromDraw(anchor,p,ar,vw,vh){
  const left=p.x<anchor.x,up=p.y<anchor.y,roomX=left?anchor.x:vw-anchor.x,roomY=up?anchor.y:vh-anchor.y;
  let w=Math.min(Math.abs(p.x-anchor.x),roomX),h=Math.min(Math.abs(p.y-anchor.y),roomY);
  if(ar>0){
   if(w/Math.max(h,1e-6)>ar)w=h*ar;else h=w/ar;
   const k=Math.min(1,roomX/Math.max(w,1e-6),roomY/Math.max(h,1e-6));w*=k;h*=k;
  }
  return norm({x:left?anchor.x-w:anchor.x,y:up?anchor.y-h:anchor.y,w,h},vw,vh);
 }
 function setBox(b,{list=true}={}){const it=items[current];if(!it)return;it.box=b;renderBox();renderSummary();if(list)renderList();}
 /** Re-fit the current box to the chosen ratio, keeping its centre and never growing. */
 function applyRatio(){
  const it=items[current];if(!it)return;const ar=arOf(it),vw=workW(it),vh=workH(it),b=boxOf(it);
  if(!(ar>0)){setBox(b);return;}
  const cx=b.x+b.w/2,cy=b.y+b.h/2;let w=b.w,h=w/ar;if(h>b.h){h=b.h;w=h*ar;}
  setBox(norm({x:clamp(cx-w/2,0,vw-w),y:clamp(cy-h/2,0,vh-h),w,h},vw,vh));
 }
 function pressRatio(){for(const c of el.querySelectorAll('[data-ratio]'))c.setAttribute('aria-pressed',String(c.dataset.ratio===o.ratio));}
 // ---- files
 async function add(files){
  if(!await authorize(route.id))return;
  if(!items.length)frame();
  for(const file of files){
   let source=null;
   try{source=await Im.decode(file);}catch(error){toast(error?.message||String(error),{error:true});continue;}
   const k=Math.min(1,PREVIEW/Math.max(source.width,source.height));
   const preview=k<1?Im.resize(source,Math.max(1,Math.round(source.width*k)),Math.max(1,Math.round(source.height*k))):source;
   const it={id:++seq,file,source,preview,owned:preview!==source,pscale:preview.width/source.width,tr:{turn:0,mirror:false,angle:0},box:{x:0,y:0,w:source.width,h:source.height},thumb:''};
   it.box=centred(source.width,source.height,arOf(it));
   items.push(it);current=items.length-1;
   try{const c=Im.canvas(80,80),ctx=c.getContext('2d'),f=Math.min(80/preview.width,80/preview.height);
    ctx.drawImage(preview,0,0,preview.width,preview.height,(80-preview.width*f)/2,(80-preview.height*f)/2,preview.width*f,preview.height*f);
    it.thumb=URL.createObjectURL(await Im.blobOf(c,'image/png'));Im.release(c);}catch{}
  }
  if(!items.length){empty();return;}
  track('tool_run',{intent:route.id});undoStack=[];redoStack=[];render();renderNext();
 }
 function drop(it){Im.release(it.source);if(it.owned)Im.release(it.preview);if(it.thumb)URL.revokeObjectURL(it.thumb);}
 function remove(index){
  const [it]=items.splice(index,1);if(!it)return;drop(it);
  current=Math.min(current,Math.max(0,items.length-1));
  if(!items.length){undoStack=[];redoStack=[];empty();return;}
  undoStack=undoStack.map(s=>s.filter(x=>x.id!==it.id));redoStack=redoStack.map(s=>s.filter(x=>x.id!==it.id));render();
 }
 function clear(){for(const it of items.splice(0))drop(it);current=0;undoStack=[];redoStack=[];empty();}
 // ---- output
 async function result(it){
  const vw=workW(it),vh=workH(it),identity=!it.tr.turn&&!it.tr.mirror&&!it.tr.angle;
  let work=it.source,cut=null,scaled=null,flat=null;
  try{
   if(!identity){work=Im.canvas(vw,vh);paint(work.getContext('2d'),it.source,it.tr,vw,vh);}
   const b=boxOf(it);
   cut=Im.canvas(b.w,b.h);cut.getContext('2d').drawImage(work,b.x,b.y,b.w,b.h,0,0,b.w,b.h);
   if(o.shape!=='rect')maskShape(cut,o.shape,o.radius);
   const size=outputSize(b);let out=cut;
   if(size.w!==b.w||size.h!==b.h){scaled=await Im.resizeQuality(cut,size.w,size.h);out=scaled;}
   const fmt=formatOf(it.file);
   if(fmt==='jpeg'){flat=Im.background(out,'#ffffff');out=flat;}
   const blob=await Im.blobOf(out,'image/'+fmt,o.quality/100);
   return {blob,name:`${stem(it.file.name)}-crop-${size.w}x${size.h}.${EXT[fmt]}`,width:size.w,height:size.h};
  }finally{if(work!==it.source)Im.release(work);Im.release(flat);Im.release(scaled);Im.release(cut);}
 }
 async function save(only=null){
  if(busy||!items.length)return;busy=true;renderSummary();
  try{
   const out=[];for(const it of (only===null?items:[items[only]]))out.push(await result(it));
   if(out.length===1)download(out[0].blob,out[0].name);
   else{
    toast(text('zipping'));const used=new Set();
    const entries=out.map(e=>{let name=e.name,n=1;while(used.has(name))name=`${stem(e.name)}-${++n}.${e.name.split('.').pop()}`;used.add(name);return {name,blob:e.blob};});
    download(await zip(entries),`${BRAND.name.toLowerCase()}-${route.id}.zip`);
   }
   track('tool_success',{intent:route.id});
  }catch(error){toast(error?.message||String(error),{error:true});track('tool_error',{intent:route.id,error_code:'processing_failed'});}
  finally{busy=false;renderSummary();}
 }
 async function handOff(id){
  if(busy||!items.length)return;busy=true;renderSummary();
  try{const files=[];for(const it of items){const r=await result(it);files.push(new File([r.blob],r.name,{type:r.blob.type}));}await continueWith(id,files);}
  catch(error){toast(error?.message||String(error),{error:true});}finally{busy=false;renderSummary();}
 }
 /** Snap the box to the content: transparent margins first (image-bounds worker), then a
  * uniform border colour measured from the corners. */
 async function autoTrim(){
  const it=items[current];if(!it||busy)return;busy=true;renderSummary();
  const vw=workW(it),vh=workH(it),identity=!it.tr.turn&&!it.tr.mirror&&!it.tr.angle;
  let work=it.source;
  try{
   if(!identity){work=Im.canvas(vw,vh);paint(work.getContext('2d'),it.source,it.tr,vw,vh);}
   const {imageBounds}=await import('../image-bounds.js');
   let b=await imageBounds(work);
   if(!b||(b.w===vw&&b.h===vh))b=borderBounds(work)||b;
   if(!b||(b.w===vw&&b.h===vh)){toast(T('trimNone'));return;}
   record();it.box=norm(b,vw,vh);if(arOf(it)>0)applyRatio();
  }catch(error){toast(error?.message||String(error),{error:true});}
  finally{if(work!==it.source)Im.release(work);busy=false;renderBox();renderSummary();renderList();}
 }
 /** Same framing for every file: the box as a fraction of this picture, re-fitted to the
  * chosen ratio (centred) when one is locked. */
 function applyAll(){
  const src=items[current];if(!src||items.length<2)return;record();
  const b=boxOf(src),vw=workW(src),vh=workH(src),rel={x:b.x/vw,y:b.y/vh,w:b.w/vw,h:b.h/vh};
  for(const it of items){
   if(it===src)continue;
   const w=workW(it),h=workH(it),ar=arOf(it);
   let box=norm({x:rel.x*w,y:rel.y*h,w:rel.w*w,h:rel.h*h},w,h);
   if(ar>0){const cx=box.x+box.w/2,cy=box.y+box.h/2;let bw=box.w,bh=bw/ar;if(bh>box.h){bh=box.h;bw=bh*ar;}
    box=norm({x:clamp(cx-bw/2,0,w-bw),y:clamp(cy-bh/2,0,h-bh),w:bw,h:bh},w,h);}
   it.box=box;
  }
  render();toast(T('appliedAll',{n:items.length}));
 }
 // ---- events
 el.addEventListener('pointerdown',e=>{
  const host=e.target.closest('#cropFrame');if(!host||!items.length||busy)return;
  const it=items[current],vw=workW(it),vh=workH(it),p=pointAt(e),handle=e.target.closest('[data-handle]');
  record();host.setPointerCapture(e.pointerId);e.preventDefault();
  if(handle)drag={mode:'resize',handle:handle.dataset.handle,start:boxOf(it)};
  else if(e.target.closest('#cropBox'))drag={mode:'move',start:boxOf(it),from:p};
  else{drag={mode:'draw',anchor:p};setBox(norm({x:p.x,y:p.y,w:1,h:1},vw,vh),{list:false});}
  el.querySelector('#cropBox').focus({preventScroll:true});
 });
 el.addEventListener('pointermove',e=>{
  if(!drag)return;const it=items[current];if(!it)return;
  const vw=workW(it),vh=workH(it),p=pointAt(e),ar=arOf(it);
  if(drag.mode==='resize')setBox(fromHandle(drag.handle,drag.start,p,ar,vw,vh),{list:false});
  else if(drag.mode==='move')setBox(norm({...drag.start,x:drag.start.x+p.x-drag.from.x,y:drag.start.y+p.y-drag.from.y},vw,vh),{list:false});
  else setBox(fromDraw(drag.anchor,p,ar,vw,vh),{list:false});
 });
 const endDrag=()=>{
  if(!drag)return;const mode=drag.mode;drag=null;const it=items[current];if(!it)return;
  // A stray click on the picture must not replace the framing with a sliver.
  if(mode==='draw'&&(it.box.w<MIN*2||it.box.h<MIN*2)&&undoStack.length)restore(undoStack.pop());
  renderList();renderSummary();
 };
 addEventListener('pointerup',endDrag);addEventListener('pointercancel',endDrag);
 el.addEventListener('click',e=>{
  const chip=e.target.closest('[data-ratio]');
  if(chip){
   o={...o,ratio:chip.dataset.ratio,preset:'',outMode:'keep',outW:0,outH:0,ar:0};pressRatio();
   el.querySelector('#cropPreset').value='';el.querySelector('#cropOutMode').value='keep';el.querySelector('#cropOutRow').hidden=true;
   el.querySelector('#cropOutW').value='';el.querySelector('#cropOutH').value='';
   if(items.length){record();applyRatio();renderList();}
   return;
  }
  const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,i=Number(b.dataset.index),it=items[current];
  if(a==='crop-select'){current=i;render();}
  else if(a==='crop-remove')remove(i);
  else if(a==='crop-save')save(i);
  else if(a==='crop-download')save();
  else if(a==='crop-clear')clear();
  else if(a==='crop-next')handOff(b.dataset.tool);
  else if(a==='crop-apply-all')applyAll();
  else if(a==='crop-trim')autoTrim();
  else if(!it||busy)return;
  else if(a==='crop-turn-left'||a==='crop-turn-right'){record();turnBy(it,a==='crop-turn-right');render();}
  else if(a==='crop-flip-h'||a==='crop-flip-v'){record();mirrorBy(it,a==='crop-flip-v');render();}
  else if(a==='crop-reset'){record();reset(it);render();}
  else if(a==='crop-undo'&&undoStack.length){redoStack.push(snap());restore(undoStack.pop());}
  else if(a==='crop-redo'&&redoStack.length){undoStack.push(snap());restore(redoStack.pop());}
 });
 el.addEventListener('change',e=>{
  if(e.target.id!=='cropPreset')return;
  const slug=e.target.value;
  if(!slug)o={...o,preset:'',outMode:'keep',outW:0,outH:0};
  else{
   const [,w,h]=SOCIAL[slug];o={...o,preset:slug,outMode:'exact',outW:w,outH:h,ar:w/h,ratio:ratioName(w/h)};
   el.querySelector('#cropOutW').value=w;el.querySelector('#cropOutH').value=h;el.querySelector('#cropOutMode').value='exact';el.querySelector('#optionsAdvanced').open=true;
  }
  el.querySelector('#cropOutRow').hidden=o.outMode!=='exact';pressRatio();
  if(items.length){record();applyRatio();renderList();}
 });
 el.addEventListener('input',e=>{
  const it=items[current],id=e.target.id;if(!id||!id.startsWith('crop'))return;
  if(['cropX','cropY','cropW','cropH'].includes(id)){
   if(!it)return;
   const vw=workW(it),vh=workH(it),ar=arOf(it),v=s=>Math.max(0,int(el.querySelector(s).value));
   const b={x:v('#cropX'),y:v('#cropY'),w:Math.max(1,v('#cropW')),h:Math.max(1,v('#cropH'))};
   if(ar>0){if(id==='cropW')b.h=b.w/ar;else if(id==='cropH')b.w=b.h*ar;}
   record(id);setBox(norm(b,vw,vh));return;
  }
  if(id==='cropAngle'){if(!it)return;record(id);it.tr={...it.tr,angle:Number(e.target.value)};el.querySelector('#cropAngleOut').textContent=degrees(it.tr.angle);renderView();return;}
  if(id==='cropRadius'){o={...o,radius:Number(e.target.value)};el.querySelector('#cropRadiusOut').textContent=o.radius+'%';renderBox();return;}
  if(id==='cropQuality'){o={...o,quality:Number(e.target.value)};el.querySelector('#cropQualityOut').textContent=o.quality;return;}
  if(id==='cropShape'){o={...o,shape:e.target.value};el.querySelector('#cropRadiusField').hidden=o.shape!=='round';renderBox();renderSummary();return;}
  if(id==='cropFormat'){o={...o,format:e.target.value};renderSummary();renderList();return;}
  if(id==='cropOutMode'){o={...o,outMode:e.target.value};el.querySelector('#cropOutRow').hidden=o.outMode!=='exact';renderSummary();renderList();return;}
  if(id==='cropOutW'||id==='cropOutH'){
   o={...o,outW:int(el.querySelector('#cropOutW').value),outH:int(el.querySelector('#cropOutH').value),preset:''};
   if(o.outW&&o.outH){o.ar=o.outW/o.outH;o.ratio=ratioName(o.ar);pressRatio();}
   el.querySelector('#cropPreset').value='';renderSummary();renderList();
  }
 });
 // On the document, not the workspace: a button that disables itself after its click drops focus to
 // <body>, and shortcuts (undo, delete) pressed next would otherwise never reach the workspace.
 document.addEventListener('keydown',e=>{
  if(!el.isConnected||e.target.closest?.('dialog'))return;
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.dropzone')){e.preventDefault();e.target.click();return;}
  const it=items[current];if(!it||busy)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();el.querySelector(e.shiftKey?'[data-action="crop-redo"]':'[data-action="crop-undo"]').click();return;}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();el.querySelector('[data-action="crop-redo"]').click();return;}
  if(!e.key.startsWith('Arrow')||!e.target.closest('#cropFrame'))return;
  e.preventDefault();
  const step=e.shiftKey?10:1,vw=workW(it),vh=workH(it),b=boxOf(it);
  const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
  record('nudge'+(e.altKey?'-size':''));
  // Ctrl/Cmd is taken by undo, so Alt+arrows resize instead of moving.
  if(e.altKey){const ar=arOf(it);let w=Math.max(MIN,b.w+dx),h=Math.max(MIN,b.h+dy);if(ar>0){if(dx)h=w/ar;else w=h*ar;}setBox(norm({...b,w,h},vw,vh));}
  else setBox(norm({...b,x:b.x+dx,y:b.y+dy},vw,vh));
 });
 el.addEventListener('submit',e=>e.preventDefault());
 onLocale(()=>{if(!items.length){empty();return;}frame();render();renderNext();});
 empty();
 return {add,get items(){return items;}};
}
