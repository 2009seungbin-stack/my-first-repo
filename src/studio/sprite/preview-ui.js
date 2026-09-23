/** Floating animation preview (Aseprite's F7 window): plays the current tag at 1:1, 2×, 3× or 4×
 * device pixels while the main canvas stays zoomed in for editing. Nearest-neighbour always. */
import {h} from '../ui/dom.js';
import {steps,stepAt,rangeTag} from './playback.js';
import {drawFrame} from './frame-render.js';
const BGS={checker:null,black:'#000',white:'#fff',gray:'#7f7f7f',magenta:'#ff00ff',green:'#00b140'};
export function createPreview(W,host){
 const {t}=W;
 const el=h('div.sp-preview',{hidden:true,role:'dialog','aria-label':t('sp.preview.title'),'data-sp':'preview'});
 const title=h('span.sp-preview-title',{},t('sp.preview.title'));
 const zoom=h('select.st-input',{'aria-label':t('sp.preview.zoom'),'data-sp':'preview-zoom'});
 const bg=h('select.st-input',{'aria-label':t('sp.preview.bg'),'data-sp':'preview-bg'});
 const close=h('button.st-icon-btn',{type:'button','aria-label':t('sp.preview.close'),title:t('sp.preview.close')},'×');
 const canvas=h('canvas.sp-preview-canvas',{width:1,height:1});
 const head=h('div.sp-preview-head',{},title,zoom,bg,close);
 el.append(head,h('div.sp-preview-body',{},canvas));
 host.append(el);
 let raf=0,t0=0,lastKey='',busy=false;
 function options(){
  zoom.replaceChildren(...[1,2,3,4,6,8].map(z=>h('option',{value:String(z),selected:W.prefs.previewZoom===z||null},z===1?'1:1':`${z}×`)));
  bg.replaceChildren(...Object.keys(BGS).map(k=>h('option',{value:k,selected:W.prefs.previewBg===k||null},t('sp.bg.'+k))));
 }
 zoom.addEventListener('change',()=>{W.setPref('previewZoom',Number(zoom.value));lastKey='';});
 bg.addEventListener('change',()=>{W.setPref('previewBg',bg.value);lastKey='';});
 close.addEventListener('click',()=>toggle(false));
 // drag by the header
 head.addEventListener('pointerdown',e=>{if(e.target!==head&&e.target!==title)return;const r=el.getBoundingClientRect(),hr=host.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;head.setPointerCapture(e.pointerId);
  const move=ev=>{const x=Math.max(0,Math.min(hr.width-40,ev.clientX-hr.left-dx)),y=Math.max(0,Math.min(hr.height-30,ev.clientY-hr.top-dy));el.style.left=x+'px';el.style.top=y+'px';el.style.right='auto';};
  const up=()=>{head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',up);W.setPref('previewPos',{x:parseFloat(el.style.left)||0,y:parseFloat(el.style.top)||0});};
  head.addEventListener('pointermove',move);head.addEventListener('pointerup',up);});
 function toggle(on=el.hidden){
  el.hidden=!on;W.setPref('preview',on);
  if(on){options();const p=W.prefs.previewPos;if(p){el.style.left=p.x+'px';el.style.top=p.y+'px';el.style.right='auto';}t0=performance.now();lastKey='';loop();}
  else cancelAnimationFrame(raf);
 }
 async function loop(){
  raf=requestAnimationFrame(loop);
  if(busy)return;const a=W.asset();if(!a?.frames.length){canvas.width=canvas.height=1;return;}
  const tag=W.playTag()||rangeTag(a),list=steps(a,tag),s=stepAt(list,performance.now()-t0,{loop:true});if(!s)return;
  const f=a.frames[s.index],z=W.prefs.previewZoom||2,dpr=devicePixelRatio||1;
  const W0=Math.max(...tag.frameIds.map(id=>a.frames.find(x=>x.id===id)).filter(Boolean).map(x=>x.canvasWidth)),H0=Math.max(...tag.frameIds.map(id=>a.frames.find(x=>x.id===id)).filter(Boolean).map(x=>x.canvasHeight));
  const key=[a.id,f,z,W.prefs.previewBg,tag.id,W0,H0].map(x=>typeof x==='object'?x?.id+':'+x?.duration+':'+x?.offsetX+':'+x?.pivotX:x).join('|')+'|'+a.cels.length+'|'+(a.layers.map(l=>l.visible?1:0).join(''));
  title.textContent=`${tag.name||t('sp.preview.all')} · ${s.index+1}`;
  if(key===lastKey)return;lastKey=key;busy=true;
  try{
   canvas.width=W0*z;canvas.height=H0*z;canvas.style.width=`${W0*z/dpr}px`;canvas.style.height=`${H0*z/dpr}px`;
   const x=canvas.getContext('2d');x.imageSmoothingEnabled=false;x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,canvas.width,canvas.height);
   const b=BGS[W.prefs.previewBg||'checker'];
   if(b){x.fillStyle=b;x.fillRect(0,0,canvas.width,canvas.height);}else{const n=Math.max(4,4*z);for(let yy=0;yy<canvas.height;yy+=n)for(let xx=0;xx<canvas.width;xx+=n){x.fillStyle=((xx/n+yy/n)&1)?'#3a3d44':'#2e3036';x.fillRect(xx,yy,n,n);}}
   // frames of other sizes are placed so their pivots line up with the largest canvas's pivot
   const ref=a.frames.find(q=>q.canvasWidth===W0&&q.canvasHeight===H0)||f,dx=Math.round(ref.pivotX*W0-f.pivotX*f.canvasWidth),dy=Math.round(ref.pivotY*H0-f.pivotY*f.canvasHeight);
   x.setTransform(z,0,0,z,0,0);await drawFrame(x,W.images,a,f,{dx,dy});
  }catch{}finally{busy=false;}
 }
 return {el,toggle,get open(){return !el.hidden;},restart(){t0=performance.now();lastKey='';},destroy(){cancelAnimationFrame(raf);el.remove();}};
}
