/** Timeline panel (bottom dock): Aseprite-style layers × frames grid of cels, tag bars above the
 * frame numbers, per-frame durations, jitter marks, playback and onion-skin controls.
 *
 * Pointer: click a frame (or cel) = current + select; Shift = range; Ctrl/⌘ = toggle; drag selected
 * frame numbers sideways = reorder; drag across the tag lane = new tag (named inline); drag a tag
 * bar's end = resize; double-click a tag = rename inline; double-click a duration = edit it inline.
 * Keyboard (frame row is a listbox): ←/→ current frame (Shift extends), Home/End, Enter play,
 * F2 rename the tag under the current frame, Delete remove selected frames. */
import {h} from '../ui/dom.js';
import * as D from './sprite-doc.js';
import {SVG} from './icons.js';
const CW_MIN=14,CW_MAX=64;
export function createTimeline(W){
 const {t}=W;
 const root=h('div.sp-tl',{});
 const bar=h('div.sp-tl-bar',{role:'toolbar'});
 const body=h('div.sp-tl-body',{});
 root.append(bar,body);
 let cw=Number(W.prefs.cw)||26,drag=null,editing=null,jitter=null,lastKey='';
 const btn=(icon,label,fn,{id,pressed}={})=>{const b=h('button.sp-tb',{type:'button',title:label,'aria-label':label,'data-sp':id||null,...(pressed!=null?{'aria-pressed':String(!!pressed)}:{})});b.innerHTML=SVG[icon]||'';if(!SVG[icon])b.textContent=label;b.addEventListener('click',fn);return b;};
 function renderBar(){
  const a=W.asset(),f=W.frame(),n=a?.frames.length||0,cur=W.cur();
  const on=W.prefs.onion;
  const tag=W.playTag();
  const count=h('span.sp-tl-count',{'data-sp':'counter'},n?`${cur+1} / ${n}`:'0 / 0',f?h('small',{},` · ${f.duration??100} ms`):'',tag?h('small.sp-tl-tagname',{},` · ${tag.name}`):'');
  const onionBox=h('span.sp-tl-onion',{},
   btn('onion',t('sp.tl.onion')+' (F3)',()=>W.run('sprite.onion'),{id:'onion',pressed:on.on}),
   num(t('sp.tl.onionPrev'),on.before,0,8,v=>W.setPref('onion',{...W.prefs.onion,before:v}),'onion-prev'),
   num(t('sp.tl.onionNext'),on.after,0,8,v=>W.setPref('onion',{...W.prefs.onion,after:v}),'onion-next'),
   num(t('sp.tl.onionOpacity'),Math.round((on.opacity??.45)*100),5,100,v=>W.setPref('onion',{...W.prefs.onion,opacity:v/100}),'onion-opacity'),
   btn('tint',t('sp.tl.onionTint'),()=>W.setPref('onion',{...W.prefs.onion,tint:on.tint===false}),{id:'onion-tint',pressed:on.tint!==false}));
  bar.replaceChildren(
   btn('first',t('sp.tl.first')+' (Home)',()=>W.run('sprite.first')),
   btn('prev',t('sp.tl.prev')+' (,)',()=>W.step(-1)),
   btn(W.playing()?'pause':'play',(W.playing()?t('sp.tl.stop'):t('sp.tl.play'))+' (Enter)',()=>W.run('sprite.play'),{id:'play',pressed:W.playing()}),
   btn('next',t('sp.tl.next')+' (.)',()=>W.step(1)),
   btn('last',t('sp.tl.last')+' (End)',()=>W.run('sprite.last')),
   btn('loop',t('sp.tl.loopTag'),()=>W.setPref('loopTag',!W.prefs.loopTag),{id:'loop-tag',pressed:W.prefs.loopTag}),
   count,h('span.sp-sep',{}),onionBox,h('span.sp-sep',{}),
   btn('add',t('sp.tl.newFrame')+' (Alt+N)',()=>W.run('sprite.newFrame'),{id:'new-frame'}),
   btn('blank',t('sp.tl.emptyFrame'),()=>W.run('sprite.emptyFrame'),{id:'empty-frame'}),
   btn('trash',t('sp.tl.deleteFrames')+' (Alt+C)',()=>W.run('sprite.deleteFrames'),{id:'delete-frames'}),
   btn('flip',t('sp.tl.flip'),()=>W.run('sprite.flipFrames'),{id:'flip'}),
   btn('tag',t('sp.tl.newTag')+' (Alt+T)',()=>W.run('sprite.newTag'),{id:'new-tag'}),
   h('span.sp-sep',{}),
   durationField(),
   h('span.st-grow',{}),
   btn('zoomOut',t('sp.tl.narrower'),()=>setCw(cw-4)),btn('zoomIn',t('sp.tl.wider'),()=>setCw(cw+4)));
 }
 function num(label,value,min,max,set,id){const i=h('input.st-input.sp-num',{type:'number',min:String(min),max:String(max),step:'1',value:String(value),'aria-label':label,title:label,'data-sp':id});i.addEventListener('change',()=>set(Math.max(min,Math.min(max,Math.round(Number(i.value)||0)))));return i;}
 function durationField(){
  const a=W.asset(),ids=W.selected(),f=W.frame();
  const vals=a?a.frames.filter(x=>ids.includes(x.id)).map(x=>x.duration??100):[];
  const same=vals.length&&vals.every(v=>v===vals[0]);
  const i=h('input.st-input.sp-num.sp-dur',{type:'number',min:'1',max:'65535',step:'1',value:same?String(vals[0]):'',placeholder:vals.length?t('sp.tl.mixed'):'','aria-label':t('sp.tl.durationSel',{n:ids.length}),title:t('sp.tl.durationSel',{n:ids.length}),'data-sp':'duration'});
  i.addEventListener('change',()=>{const v=Math.round(Number(i.value));if(v>0)W.setDurations(W.selected(),v);});
  i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();i.dispatchEvent(new Event('change'));i.blur();}});
  void f;
  return h('label.sp-tl-dur',{},h('span',{},t('sp.tl.ms')),i);
 }
 function setCw(v){cw=Math.max(CW_MIN,Math.min(CW_MAX,v));W.setPref('cw',cw);render(true);}
 // ------------------------------------------------------------ grid
 function lanesFor(a){
  const bars=[];for(const tag of a.tags)for(const r of D.tagRuns(a,tag))bars.push({tag,from:r.from,to:r.to});
  bars.sort((x,y)=>x.from-y.from||(y.to-y.from)-(x.to-x.from));
  const ends=[];for(const b of bars){let l=ends.findIndex(e=>e<b.from);if(l<0){l=ends.length;ends.push(-1);}ends[l]=b.to;b.lane=l;}
  return {bars,lanes:Math.max(1,ends.length)};
 }
 function render(force=false){
  renderBar();
  const a=W.asset();
  if(!a||!a.frames.length){body.replaceChildren(W.timelineEmpty?.(a)||h('p.st-muted.st-pad.sp-tl-empty',{},a?t('sp.tl.noFrames'):t('sp.tl.noAsset')));lastKey='';return;}
  // documents are immutable: the grid is rebuilt only when one of these objects changed
  const key={frames:a.frames,tags:a.tags,layers:a.layers,cels:a.cels,cw,jitter};
  if(!force&&lastKey&&Object.keys(key).every(k=>key[k]===lastKey[k])&&body.firstChild?.classList?.contains('sp-tl-grid')){mark();return;}
  lastKey=key;
  const n=a.frames.length,{bars,lanes}=lanesFor(a);
  const grid=h('div.sp-tl-grid',{style:`--cw:${cw}px;--n:${n};--lanes:${lanes}`});
  // tag lane
  const lane=h('div.sp-tl-lane',{'data-sp':'tag-lane',title:t('sp.tl.laneHint')});
  for(const b of bars){
   const el=h('div.sp-tag',{'data-tag':b.tag.id,'data-from':String(b.from),'data-to':String(b.to),style:`left:${b.from*cw}px;width:${(b.to-b.from+1)*cw-2}px;top:${b.lane*18}px;--c:${b.tag.color}`,title:`${b.tag.name} · ${t('sp.dir.'+b.tag.direction)}${b.tag.repeat?` ×${b.tag.repeat}`:''}`},
    h('span.sp-tag-name',{},b.tag.name),b.tag.direction!=='forward'?h('span.sp-tag-dir',{},b.tag.direction==='reverse'?'◀':'◀▶'):'',b.tag.repeat?h('span.sp-tag-rep',{},'×'+b.tag.repeat):'',
    h('span.sp-tag-grip.is-l',{'data-grip':'l'}),h('span.sp-tag-grip.is-r',{'data-grip':'r'}));
   lane.append(el);
  }
  grid.append(h('div.sp-tl-head.sp-tl-h-tags',{},t('sp.tl.tags')),lane);
  // frame numbers + durations (listbox)
  const heads=h('div.sp-tl-frames',{role:'listbox','aria-multiselectable':'true','aria-orientation':'horizontal','aria-label':t('sp.tl.frames'),tabindex:'0','data-sp':'frames'});
  a.frames.forEach((f,i)=>{
   const j=jitter?.byId?.get(f.id);
   heads.append(h('div.sp-fh',{role:'option','data-i':String(i),id:'sp-fh-'+i,'aria-selected':'false',title:`${f.name} · ${f.duration??100} ms${j!=null?` · ${t('sp.tl.jitterPx',{px:j.toFixed(1)})}`:''}`},
    h('b',{},String(i+1)),h('small.sp-fh-ms',{'data-dur':String(i)},String(f.duration??100)),
    j!=null?h('i.sp-jit',{style:`--j:${Math.min(1,j/3)}`,class:'sp-jit'+(j>=1.5?' is-bad':j>=.5?' is-warn':'')}):''));
  });
  grid.append(h('div.sp-tl-head.sp-tl-h-frames',{},t('sp.tl.frames')),heads);
  // layer rows, top layer first (Aseprite)
  for(const l of [...a.layers].reverse()){
   const eye=h('button.sp-eye',{type:'button','aria-pressed':String(l.visible),title:t(l.visible?'sp.tl.hideLayer':'sp.tl.showLayer',{name:l.name}),'aria-label':t(l.visible?'sp.tl.hideLayer':'sp.tl.showLayer',{name:l.name})});eye.innerHTML=l.visible?SVG.eye:SVG.eyeOff;
   eye.addEventListener('click',()=>W.exec(t('sp.cmd.layerVisible'),d=>D.setLayer(d,a.id,l.id,{visible:!l.visible})));
   const name=h('span.sp-layer-name',{title:l.name},l.name);
   name.addEventListener('dblclick',()=>inlineEdit(name,l.name,v=>W.exec(t('sp.cmd.renameLayer'),d=>D.setLayer(d,a.id,l.id,{name:v}))));
   const cells=h('div.sp-tl-cels',{'data-layer':l.id});
   const own=new Set(a.cels.filter(c=>c.layerId===l.id&&c.frameId!=='*').map(c=>c.frameId)),shared=a.cels.some(c=>c.layerId===l.id&&c.frameId==='*');
   a.frames.forEach((f,i)=>cells.append(h('div.sp-cel'+(own.has(f.id)?'.is-own':shared?'.is-shared':'.is-empty'),{'data-i':String(i),title:own.has(f.id)?t('sp.tl.celOwn'):shared?t('sp.tl.celShared'):t('sp.tl.celEmpty')})));
   grid.append(h('div.sp-tl-head.sp-tl-layer',{'data-layer':l.id},eye,name),cells);
  }
  body.replaceChildren(grid);
  mark();
 }
 /** Selection / current-frame classes without rebuilding. */
 function mark(){
  const cur=W.cur(),sel=new Set(W.selected()),a=W.asset();if(!a)return;
  const ptag=W.playTag();
  for(const el of body.querySelectorAll('.sp-fh')){const i=Number(el.dataset.i),id=a.frames[i]?.id;el.classList.toggle('is-cur',i===cur);el.setAttribute('aria-selected',String(sel.has(id)));el.classList.toggle('is-sel',sel.has(id));}
  for(const el of body.querySelectorAll('.sp-cel')){const i=Number(el.dataset.i);el.classList.toggle('is-cur',i===cur);el.classList.toggle('is-sel',sel.has(a.frames[i]?.id));}
  for(const el of body.querySelectorAll('.sp-tag'))el.classList.toggle('is-play',!!ptag&&el.dataset.tag===ptag.id);
  const fr=body.querySelector('.sp-tl-frames');if(fr)fr.setAttribute('aria-activedescendant','sp-fh-'+cur);
  const c=body.querySelector(`.sp-fh[data-i="${cur}"]`);if(c)keepVisible(c);
  const cnt=bar.querySelector('[data-sp="counter"]');if(cnt){const f=W.frame(),tag=W.playTag();cnt.replaceChildren(a.frames.length?`${cur+1} / ${a.frames.length}`:"0 / 0",f?h('small',{},` · ${f.duration??100} ms`):'',tag?h('small.sp-tl-tagname',{},` · ${tag.name}`):'');}
  const pl=bar.querySelector('[data-sp="play"]');if(pl){pl.innerHTML=W.playing()?SVG.pause:SVG.play;pl.setAttribute('aria-pressed',String(W.playing()));}
 }
 function keepVisible(el){const b=body.getBoundingClientRect(),r=el.getBoundingClientRect(),head=120;if(r.left<b.left+head)body.scrollLeft-=b.left+head-r.left+cw;else if(r.right>b.right)body.scrollLeft+=r.right-b.right+cw;}
 // ------------------------------------------------------------ inline editor (no prompt())
 function inlineEdit(el,value,commit,{type='text',min}={}){
  if(editing)editing.done(false);
  const r=el.getBoundingClientRect(),hostR=root.getBoundingClientRect();
  const input=h('input.st-input.sp-inline',{type,value:String(value),style:`left:${r.left-hostR.left}px;top:${r.top-hostR.top}px;width:${Math.max(60,r.width)}px;height:${Math.max(18,r.height)}px`,'data-sp':'inline',...(min!=null?{min:String(min)}:{})});
  root.append(input);input.focus();input.select();
  const done=ok=>{if(!editing||editing.input!==input)return;editing=null;const v=input.value.trim();input.remove();if(ok&&v&&v!==String(value))commit(v);body.querySelector('.sp-tl-frames')?.focus({preventScroll:true});};
  editing={input,done};
  input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();done(true);}else if(e.key==='Escape'){e.preventDefault();done(false);}});
  input.addEventListener('blur',()=>done(true));
 }
 function renameTag(tagId){const el=body.querySelector(`.sp-tag[data-tag="${tagId}"] .sp-tag-name`)||body.querySelector(`.sp-tag[data-tag="${tagId}"]`);const tag=W.asset()?.tags.find(x=>x.id===tagId);if(!el||!tag)return;
  inlineEdit(el,tag.name,v=>{try{W.exec(t('sp.cmd.renameTag'),d=>D.updateTag(d,W.assetId(),tagId,{name:v}));}catch(e){W.toast(e.message,{error:true});}});}
 // ------------------------------------------------------------ pointer
 const indexAt=x=>{const lane=body.querySelector('.sp-tl-frames');const r=lane.getBoundingClientRect();return Math.max(0,Math.min(W.asset().frames.length-1,Math.floor((x-r.left)/cw)));};
 body.addEventListener('pointerdown',e=>{
  if(e.button!==0||editing)return;
  const a=W.asset();if(!a)return;
  const fh=e.target.closest('.sp-fh,.sp-cel'),tagEl=e.target.closest('.sp-tag'),lane=e.target.closest('.sp-tl-lane');
  if(fh){
   const i=Number(fh.dataset.i),id=a.frames[i].id;
   if(e.target.closest('.sp-fh-ms'))return;// duration: double-click edits
   const wasSel=W.selected().includes(id);
   drag={kind:'frame',i,x0:e.clientX,moved:false,wasSel,mods:{shift:e.shiftKey,mod:e.ctrlKey||e.metaKey},pointer:e.pointerId};
   if(!wasSel||e.shiftKey||e.ctrlKey||e.metaKey){W.clickFrame(i,drag.mods);drag.clicked=true;}
   body.setPointerCapture(e.pointerId);return;
  }
  if(tagEl){
   const tag=a.tags.find(x=>x.id===tagEl.dataset.tag),grip=e.target.dataset.grip;
   drag={kind:grip?'tag-resize':'tag',tag,grip,from:Number(tagEl.dataset.from),to:Number(tagEl.dataset.to),x0:e.clientX,moved:false,el:tagEl};
   body.setPointerCapture(e.pointerId);return;
  }
  if(lane){const i=indexAt(e.clientX);drag={kind:'new-tag',a:i,b:i,moved:false,el:null};body.setPointerCapture(e.pointerId);}
 });
 body.addEventListener('pointermove',e=>{
  if(!drag)return;const a=W.asset();if(!a)return;
  if(drag.kind==='frame'){
   if(!drag.moved&&Math.abs(e.clientX-drag.x0)<5)return;
   drag.moved=true;const i=indexAt(e.clientX+cw/2),grid=body.querySelector('.sp-tl-grid');
   let m=grid.querySelector('.sp-drop');if(!m){m=h('div.sp-drop',{});grid.append(m);}
   m.style.left=`calc(var(--head) + ${i*cw}px)`;drag.to=i;return;
  }
  if(drag.kind==='new-tag'){
   const i=indexAt(e.clientX);if(i!==drag.b||!drag.el){drag.b=i;drag.moved=true;const lo=Math.min(drag.a,drag.b),hi=Math.max(drag.a,drag.b);
    if(!drag.el){drag.el=h('div.sp-tag.is-draft',{});body.querySelector('.sp-tl-lane').append(drag.el);}
    drag.el.style.cssText=`left:${lo*cw}px;width:${(hi-lo+1)*cw-2}px;top:0;--c:#9ea5af`;}
   return;
  }
  if(drag.kind==='tag-resize'){const i=indexAt(e.clientX);drag.moved=true;const from=drag.grip==='l'?Math.min(i,drag.to):drag.from,to=drag.grip==='r'?Math.max(i,drag.from):drag.to;
   drag.el.style.left=`${from*cw}px`;drag.el.style.width=`${(to-from+1)*cw-2}px`;drag.nf=from;drag.nt=to;return;}
  if(drag.kind==='tag'&&Math.abs(e.clientX-drag.x0)>4)drag.moved=true;
 });
 const finish=e=>{
  if(!drag)return;const d=drag;drag=null;try{body.releasePointerCapture(e.pointerId);}catch{}
  body.querySelector('.sp-drop')?.remove();
  const a=W.asset();if(!a)return;
  if(d.kind==='frame'){
   if(d.moved&&d.to!=null){const ids=W.selected().length?W.selected():[a.frames[d.i].id];const before=a.frames.slice(0,d.to).filter(f=>!ids.includes(f.id)).length;W.moveFrames(ids,before);}
   else if(!d.clicked)W.clickFrame(d.i,d.mods);
   return;
  }
  if(d.kind==='new-tag'){d.el?.remove();if(!d.moved){W.setCurrent(d.a);return;}const id=W.newTag(Math.min(d.a,d.b),Math.max(d.a,d.b));if(id)requestAnimationFrame(()=>renameTag(id));return;}
  if(d.kind==='tag-resize'){if(d.moved&&d.nf!=null)W.exec(t('sp.cmd.tagRange'),doc=>D.setTagRange(doc,a.id,d.tag.id,d.nf,d.nt));else render(true);return;}
  if(d.kind==='tag'&&!d.moved)W.selectTag(d.tag.id);
 };
 body.addEventListener('pointerup',finish);body.addEventListener('pointercancel',e=>{if(drag){drag.moved=false;drag.kind==='new-tag'&&drag.el?.remove();drag=null;body.querySelector('.sp-drop')?.remove();render(true);}});
 body.addEventListener('dblclick',e=>{
  const a=W.asset();if(!a)return;
  // pointer capture sends the click pair to the body: find what is really under the pointer
  const target=document.elementFromPoint(e.clientX,e.clientY)||e.target;e={target,clientX:e.clientX,clientY:e.clientY};
  const ms=e.target.closest('.sp-fh-ms');if(ms){const i=Number(ms.dataset.dur),f=a.frames[i];inlineEdit(ms,f.duration??100,v=>{const n=Math.round(Number(v));if(n>0)W.setDurations(W.selected().includes(f.id)?W.selected():[f.id],n);},{type:'number',min:1});return;}
  const tagEl=e.target.closest('.sp-tag');if(tagEl&&tagEl.dataset.tag)renameTag(tagEl.dataset.tag);
 });
 body.addEventListener('contextmenu',e=>{const tagEl=e.target.closest('.sp-tag');if(!tagEl?.dataset.tag)return;e.preventDefault();W.selectTag(tagEl.dataset.tag);W.showPanel('sp-tag');});
 body.addEventListener('keydown',e=>{
  if(!e.target.closest('.sp-tl-frames'))return;
  const a=W.asset();if(!a?.frames.length)return;const cur=W.cur();
  const go=i=>{i=Math.max(0,Math.min(a.frames.length-1,i));W.clickFrame(i,{shift:e.shiftKey,mod:false});};
  if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();e.stopPropagation();go(cur+(e.key==='ArrowRight'?1:-1));}
  else if(e.key==='Home'||e.key==='End'){e.preventDefault();e.stopPropagation();go(e.key==='Home'?0:a.frames.length-1);}
  else if(e.key==='Enter'){e.preventDefault();e.stopPropagation();W.run('sprite.play');}
  else if(e.key==='F2'){e.preventDefault();const tag=W.playTag();if(tag)renameTag(tag.id);}
  else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();e.stopPropagation();W.run('sprite.deleteFrames');}
 });
 body.addEventListener('wheel',e=>{if(e.ctrlKey){e.preventDefault();setCw(cw+(e.deltaY<0?2:-2));}},{passive:false});
 return {root,render,mark,renameTag,setJitter(j){jitter=j;render(true);},focus(){body.querySelector('.sp-tl-frames')?.focus({preventScroll:true});},editing:()=>!!editing};
}
