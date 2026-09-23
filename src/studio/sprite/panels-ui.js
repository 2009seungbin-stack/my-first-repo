/** Right-dock panels of the Sprite workspace: Import (decisions with confidence + one-click
 * alternatives), Frame (duration, pivot, boxes, collision, scope), Animation (tag properties) and
 * Align (canvas size, anchor alignment, jitter). All edits go through W.exec (one undo step each). */
import {h} from '../ui/dom.js';
import * as D from './sprite-doc.js';
import {gridLabel} from './import-plan.js';
import {ALIGNMENTS} from '../../game/frame-ops.js';
import {REFERENCES} from '../../game/jitter.js';
import {totalMs,steps} from './playback.js';
const CONF={high:'is-high',medium:'is-medium',low:'is-low'};
export function createPanels(W){
 const {t}=W;
 const sec=(title,...kids)=>h('div.st-sec',{},h('div.st-sec-head',{},h('span',{},title)),...kids);
 const button=(label,fn,{primary=false,id=null,disabled=false,title=null}={})=>{const b=h('button.st-btn'+(primary?'.primary':''),{type:'button','data-sp':id,disabled:disabled||null,title});b.textContent=label;b.addEventListener('click',fn);return b;};
 const field=(label,input)=>h('label.st-field.st-field-inline',{},h('span',{},label),input);
 const numIn=(value,{min=null,max=null,step=1,id,label,change})=>{const i=h('input.st-input.st-num',{type:'number',step:String(step),value:value==null?'':String(value),'data-sp':id,'aria-label':label,...(min!=null?{min:String(min)}:{}),...(max!=null?{max:String(max)}:{})});
  i.addEventListener('change',()=>{const v=Number(i.value);if(Number.isFinite(v))change(v);});i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();i.dispatchEvent(new Event('change'));}});return i;};
 const select=(value,options,{id,label,change})=>{const s=h('select.st-input',{'data-sp':id,'aria-label':label});for(const [v,l]of options)s.append(h('option',{value:v,selected:v===value||null},l));s.addEventListener('change',()=>change(s.value));return s;};
 // ------------------------------------------------------------------ Import
 const imp=h('div.sp-panel.sp-import',{});
 function altLabel(dec,alt){
  if(dec.id==='slice'){if(alt.startsWith('grid:')){const g=W.importState()?.analysis?.grids?.[Number(alt.slice(5))];return g?`${t('sp.imp.grid')} ${gridLabel(g)}`:alt;}return t('sp.alt.'+alt);}
  if(dec.id==='key')return alt==='none'?t('sp.alt.noKey'):t('sp.alt.useKey',{c:alt});
  if(dec.id==='timing')return t('sp.alt.ms',{ms:alt,fps:Math.round(1000/Number(alt))});
  const k='sp.alt.'+alt;const v=t(k);return v===k?alt:v;
 }
 /** Reasons in the reader's language, rebuilt from the numbers the detectors measured (the
  * detectors' own sentences are English); anything without numbers falls back to them. */
 function reasonsOf(dec){
  const pct=v=>Math.round((v||0)*100)+'%',out=[];
  if(dec.id==='slice'&&dec.evidence){const e=dec.evidence,lines=(e.separatorLinesX||0)+(e.separatorLinesY||0);
   if(dec.reranked)out.push(t('sp.why.reranked'));
   out.push(lines?t('grid.reason.separator',{n:lines,pct:pct(Math.min(e.separatorRatioX??1,e.separatorRatioY??1))}):t('grid.reason.noSeparator'));
   const g=W.importState()?.analysis?.grids?.find(x=>`${x.cellWidth}×${x.cellHeight}`===String(dec.value||'').split(' ')[0]);
   if(g)out.push(t('grid.reason.period',{px:g.cellWidth+g.spacingX,py:g.cellHeight+g.spacingY,ax:(e.periodicityX||0).toFixed(2),ay:(e.periodicityY||0).toFixed(2)}));
   out.push(t('grid.reason.bounds',{pct:pct(e.boundsConsistency)}));
   out.push((e.crossingsX||0)+(e.crossingsY||0)?t('grid.reason.cross',{n:(e.crossingsX||0)+(e.crossingsY||0)}):t('grid.reason.noCross'));
   if((e.splitColumns||0)+(e.splitRows||0))out.push(t('grid.reason.split'));
   if(e.commonSize===false)out.push(t('grid.reason.uncommon'));
   if(e.outsidePixels)out.push(t('grid.reason.outside',{n:e.outsidePixels}));
   if(dec.cellCount)out.push(t('sp.why.cells',{filled:dec.cellCount.filled,all:dec.cellCount.all}));
   return out;}
  if(dec.id==='slice'&&dec.auto){const a=dec.auto;
   out.push(a.code==='uniform'?t('sp.why.autoUniform',{pct:pct(a.consistency)}):a.code==='merged'?t('sp.why.autoMerged',{n:a.frames,pct:pct(a.consistency)}):t('sp.why.autoPlain',{n:a.frames}));
   if(a.attached)out.push(t('sp.why.attached',{n:a.attached}));if(a.unassigned)out.push(t('sp.why.unassigned',{n:a.unassigned}));return out;}
  if(dec.id==='key'&&dec.clearBorder)return [t('sp.why.keyClear')];
  if(dec.id==='key'&&dec.evidence){const e=dec.evidence;
   if(dec.byUser)out.push(t('sp.why.chosen'));
   else if(dec.chosen==='none')out.push(e.alphaSheet?t('sp.why.keyNoneAlpha'):dec.confidence==='medium'?t('sp.why.keyNoneUnsure',{c:dec.hex}):t('sp.why.keyNoneWeak',{c:dec.hex}));
   out.push(t('sp.why.keyBorder',{pct:pct(e.borderShare),c:dec.hex||dec.chosen}),t('sp.why.keySheet',{pct:pct(e.sheetShare)}));
   if(e.fullLines)out.push(t('sp.why.keyLines',{n:e.fullLines}));if(e.conventional)out.push(t('sp.why.keyConventional'));if(e.alphaSheet)out.push(t('sp.why.keyAlpha'));return out;}
  if(dec.id==='timing')return [t('sp.why.timing')];
  if(dec.id==='animations'&&dec.rows)return [t('sp.why.rows',{n:dec.rows.length,counts:dec.rows.slice(0,12).join(', ')}),...(dec.varying?[t('sp.why.rowsVary')]:[])];
  return dec.reasons||[];
 }
 const decName=dec=>dec.kind==='box-slice'||dec.kind==='pivot-slice'||dec.kind==='nine-slice'?t('sp.dec.aseSlice'):t('sp.dec.'+dec.label);
 function chosenLabel(dec){
  if(dec.id==='slice')return dec.chosen==='auto'?t('sp.alt.auto')+(dec.value?` · ${dec.value}`:''):dec.chosen==='custom'?t('sp.alt.custom')+(dec.value?` · ${dec.value}`:''):`${t('sp.imp.grid')} ${dec.value||''}`;
  if(dec.id==='key')return dec.chosen==='none'?t('sp.alt.noKey'):t('sp.alt.useKey',{c:dec.chosen});
  if(dec.id==='timing')return t('sp.alt.ms',{ms:dec.chosen,fps:Math.round(1000/Number(dec.chosen))});
  if(dec.kind==='box-slice'||dec.kind==='pivot-slice'||dec.kind==='nine-slice')return `“${dec.label}” → ${altLabel(dec,dec.chosen)}`;
  return altLabel(dec,dec.chosen);
 }
 function renderImport(){
  const a=W.asset();
  if(!a){imp.replaceChildren(h('p.st-muted.st-pad',{},t('sp.noAsset')));return;}
  const info=a.import,state=W.importState();
  const kids=[];
  if(info?.kind==='sheet'&&!info.applied){
   const busy=!state?.analysis;
   kids.push(h('p.sp-imp-lead',{},busy?t('sp.imp.analyzing'):t('sp.imp.previewLead')));
   // the primary action first: nothing to scroll for
   const plan=state?.plan;
   kids.push(h('div.st-row.sp-apply-row',{},button(t('sp.imp.apply'),()=>W.applyImport(),{primary:true,id:'import-apply',disabled:!plan}),plan?h('span.sp-imp-count',{'data-sp':'plan-count'},t('sp.imp.planCount',{frames:plan.rects.length,tags:plan.tags.length})):''));
  }
  const decisions=(info?.kind==='sheet'&&state?.plan?state.plan.decisions:info?.decisions)||[];
  if(!info)kids.push(h('p.st-muted.st-pad',{},t('sp.imp.none')));
  for(const dec of decisions){
   const alts=(dec.alternatives||[]).map(alt=>{const b=h('button.sp-alt',{type:'button','data-alt':alt,'data-dec':dec.id},altLabel(dec,alt));b.addEventListener('click',()=>W.choose(dec.id,alt));return b;});
   const conf=dec.confidence?h('span.st-conf.'+(CONF[dec.confidence]||''),{'data-conf':dec.confidence},t('sp.conf.'+dec.confidence)+(dec.score!=null?` ${Math.round(dec.score*100)}%`:'')):'';
   kids.push(h('div.sp-dec',{'data-dec':dec.id},
    h('div.sp-dec-head',{},h('span.sp-dec-what',{},decName(dec)),conf),
    h('div.sp-dec-chosen',{},dec.id==='key'&&dec.chosen!=='none'?h('span.sp-swatch',{style:`background:${dec.chosen}`}):'',chosenLabel(dec)),
    (()=>{const rs=reasonsOf(dec);return rs.length?h('details.st-why',{},h('summary',{},t('sp.imp.why')),h('ul',{},rs.map(r=>h('li',{},r)))):'';})(),
    alts.length?h('div.sp-alts',{},h('span.st-muted',{},t('sp.imp.instead')),alts):''));
  }
  if(info?.kind==='sheet'){
   const plan=state?.plan;
   if(plan&&state.choice?.slice==='custom'){
    const g=state.choice.grid||plan.grid||{w:16,h:16,ox:0,oy:0,sx:0,sy:0};
    const f=k=>numIn(g[k],{min:k==='w'||k==='h'?1:0,id:'grid-'+k,label:t('sp.imp.'+k),change:v=>W.setCustomGrid({...g,[k]:Math.max(k==='w'||k==='h'?1:0,Math.round(v))})});
    kids.push(h('div.st-grid-fields.sp-custom-grid',{},...['w','h','ox','oy','sx','sy'].map(k=>field(t('sp.imp.'+k),f(k)))));
   }
   if(state?.analysis?.auto?.unassigned&&plan?.decisions.find(d=>d.id==='slice')?.chosen==='auto')kids.push(h('p.st-muted.st-pad',{},t('sp.imp.unassigned',{n:state.analysis.auto.unassigned})));
   if(info.applied){
    if(plan)kids.push(h('p.sp-imp-count',{'data-sp':'plan-count'},t('sp.imp.planCount',{frames:plan.rects.length,tags:plan.tags.length})));
    kids.push(h('div.st-row',{},button(t('sp.imp.reapply'),()=>W.applyImport(),{id:'import-apply',disabled:!plan})));
    kids.push(h('p.sp-imp-done',{'data-sp':'import-state'},t('sp.imp.applied',{frames:a.frames.length,tags:a.tags.length})));
   }
  }else if(info)kids.push(h('p.sp-imp-done',{'data-sp':'import-state'},t('sp.imp.summary',{frames:a.frames.length,tags:a.tags.length,layers:a.layers.length})));
  imp.replaceChildren(...kids);
 }
 // ------------------------------------------------------------------ Frame
 const fr=h('div.sp-panel.sp-frame',{});
 function renderFrame(){
  const a=W.asset(),f=W.frame();
  if(!a||!f){fr.replaceChildren(h('p.st-muted.st-pad',{},a?t('sp.frame.none'):t('sp.noAsset')));return;}
  const i=W.cur(),sel=W.selected(),n=sel.length;
  const name=h('input.st-input',{type:'text',value:f.name,'data-sp':'frame-name','aria-label':t('sp.frame.name')});
  name.addEventListener('change',()=>W.exec(t('sp.cmd.renameFrame'),d=>D.renameFrame(d,a.id,f.id,name.value)));
  const dur=numIn(f.duration??100,{min:1,max:65535,id:'frame-duration',label:t('sp.frame.duration'),change:v=>W.setDurations(n>1?sel:[f.id],v)});
  const scope=select(W.prefs.scope,[['frame',t('sp.scope.frame')],['selected',t('sp.scope.selected',{n})],['tag',t('sp.scope.tag')],['all',t('sp.scope.all')]],{id:'scope',label:t('sp.frame.scope'),change:v=>W.setPref('scope',v)});
  const px=f.pivotX*f.canvasWidth,py=f.pivotY*f.canvasHeight;
  const pvx=numIn(+px.toFixed(2),{step:1,id:'pivot-x',label:t('sp.frame.pivotX'),change:v=>W.exec(t('sp.cmd.setPivot'),d=>D.setPivotPx(d,a.id,W.scopeIds(),Math.round(v),Math.round(py)))});
  const pvy=numIn(+py.toFixed(2),{step:1,id:'pivot-y',label:t('sp.frame.pivotY'),change:v=>W.exec(t('sp.cmd.setPivot'),d=>D.setPivotPx(d,a.id,W.scopeIds(),Math.round(px),Math.round(v)))});
  const presets=h('div.sp-presets',{},...[['bottom-center',.5,1],['center',.5,.5],['top-left',0,0]].map(([k,x,y])=>{const b=h('button.sp-alt',{type:'button','data-pivot':k},t('sp.pivot.'+k));b.addEventListener('click',()=>W.exec(t('sp.cmd.setPivot'),d=>{const ids=W.scopeIds();let out=d;for(const id of ids){const g=D.indexOf(W.asset(),id);const fx=W.asset().frames[g];out=D.setPivotPx(out,a.id,[id],Math.round(x*fx.canvasWidth),Math.round(y*fx.canvasHeight));}return out;}));return b;}));
  // box type
  const types=['hit','hurt','interact',...new Set(a.frames.flatMap(x=>x.boxes.map(b=>b.type)).filter(x=>!D.BOX_TYPES.includes(x)))];
  const type=select(W.prefs.boxType,[...types.map(x=>[x,D.BOX_TYPES.includes(x)?t('sp.box.'+x):x]),['__new',t('sp.box.newType')]],{id:'box-type',label:t('sp.frame.boxType'),change:v=>{if(v==='__new'){newType.hidden=false;newType.focus();return;}W.setPref('boxType',v);}});
  const newType=h('input.st-input',{type:'text',hidden:true,placeholder:t('sp.box.typeName'),'data-sp':'box-type-name',maxlength:'32'});
  newType.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const v=D.cleanType(newType.value);W.setPref('boxType',v);newType.hidden=true;renderFrame();}if(e.key==='Escape'){newType.hidden=true;}});
  const sw=h('span.sp-swatch',{style:`background:${D.boxColor(W.prefs.boxType)}`});
  const list=h('div.sp-boxes',{role:'listbox','aria-label':t('sp.frame.boxes')});
  const selId=W.selection().kind==='box'?W.selection().id:null;
  for(const b of f.boxes){
   const geo=b.shape==='rect'?`${b.x},${b.y} ${b.w}×${b.h}`:b.shape==='circle'?`○ ${b.cx},${b.cy} r${b.r}`:`⬠ ${b.points.length}`;
   const del=h('button.st-icon-btn',{type:'button',title:t('sp.box.delete'),'aria-label':t('sp.box.delete')},'×');
   del.addEventListener('click',e=>{e.stopPropagation();W.removeBox(b.id);});
   // a box may reach past the frame canvas (a sword's reach); it is kept as drawn — Aseprite slices
   // and engine collision shapes carry such offsets — but it is marked so it is never a surprise
   const out=D.boxOutside(b,f.canvasWidth,f.canvasHeight);
   const row=h('div.sp-box'+(b.id===selId?'.is-sel':''),{role:'option','aria-selected':String(b.id===selId),'data-box':b.id,tabindex:'-1'},h('span.sp-swatch',{style:`background:${D.boxColor(b.type)}`}),h('b',{},b.type),h('span.st-muted',{},geo),
    out?h('span.sp-box-out',{title:t('sp.box.outsideHint'),'data-sp':'box-outside'},t('sp.box.outside')):'',del);
   row.addEventListener('click',()=>W.setSelection({kind:'box',id:b.id}));list.append(row);
  }
  if(!f.boxes.length)list.append(h('p.st-muted',{},t('sp.box.none')));
  const cap=numIn(W.prefs.maxVertices,{min:3,max:64,id:'max-vertices',label:t('sp.col.vertices'),change:v=>W.setPref('maxVertices',Math.max(3,Math.min(64,Math.round(v))))});
  const thr=numIn(W.prefs.alphaThreshold,{min:0,max:254,id:'alpha-threshold',label:t('sp.col.threshold'),change:v=>W.setPref('alphaThreshold',Math.max(0,Math.min(254,Math.round(v))))});
  fr.replaceChildren(
   h('div.st-pad',{},
    field(t('sp.frame.name'),name),
    h('p.st-muted.sp-frame-meta',{},t('sp.frame.meta',{i:i+1,n:a.frames.length,w:f.canvasWidth,h:f.canvasHeight})),
    field(n>1?t('sp.frame.durationN',{n}):t('sp.frame.duration'),dur),
    field(t('sp.frame.scope'),scope)),
   sec(t('sp.frame.pivot'),h('div.st-pad',{},h('div.st-grid-fields',{},field('X',pvx),field('Y',pvy)),presets,h('p.st-muted.sp-hint',{},t('sp.frame.pivotHint')))),
   sec(t('sp.frame.boxes'),h('div.st-pad',{},h('div.sp-row',{},sw,field(t('sp.frame.boxType'),type)),newType,list,
    h('div.st-row.sp-wrap',{},button(t('sp.box.copyNext'),()=>W.run('sprite.copyBoxesNext'),{id:'copy-boxes'}),button(t('sp.box.copyScope'),()=>W.run('sprite.copyBoxesScope'),{id:'copy-boxes-scope'})),
    h('p.st-muted.sp-hint',{},t('sp.frame.boxHint')))),
   sec(t('sp.frame.collision'),h('div.st-pad',{},h('div.st-grid-fields',{},field(t('sp.col.vertices'),cap),field(t('sp.col.threshold'),thr)),
    h('div.st-row.sp-wrap',{},button(t('sp.col.auto'),()=>W.run('sprite.autoCollision'),{primary:true,id:'auto-collision'}),button(t('sp.col.clear'),()=>W.run('sprite.clearCollision'),{id:'clear-collision',disabled:!f.collision.length})),
    h('p.st-muted',{'data-sp':'collision-info'},f.collision.length?t('sp.col.info',{n:f.collision.length,v:f.collision.reduce((s,p)=>s+p.length,0)}):t('sp.col.noneYet')))),
   sec(t('sp.frame.mirror'),h('div.st-pad.st-row.sp-wrap',{},button(t('sp.mirror.flip'),()=>W.run('sprite.flipFrames'),{id:'flip-frames'}),button(t('sp.mirror.copyTag'),()=>W.run('sprite.mirrorTag'),{id:'mirror-tag',disabled:!W.playTag()})))
  );
 }
 // ------------------------------------------------------------------ Animation (tag)
 const tg=h('div.sp-panel.sp-tagpanel',{});
 function renderTag(){
  const a=W.asset();
  if(!a){tg.replaceChildren(h('p.st-muted.st-pad',{},t('sp.noAsset')));return;}
  const tag=W.playTag(),kids=[];
  const list=h('div.sp-taglist',{role:'listbox','aria-label':t('sp.tag.all')});
  for(const x of a.tags){const r=h('div.sp-tagrow'+(x===tag?'.is-sel':''),{role:'option','aria-selected':String(x===tag),'data-tag':x.id,tabindex:'-1'},h('span.sp-swatch',{style:`background:${x.color}`}),h('b',{},x.name),h('span.st-muted',{},t('sp.tag.frames',{n:x.frameIds.length})));r.addEventListener('click',()=>W.selectTag(x.id));list.append(r);}
  if(!a.tags.length)list.append(h('p.st-muted',{},t('sp.tag.none')));
  if(tag){
   const name=h('input.st-input',{type:'text',value:tag.name,'data-sp':'tag-name','aria-label':t('sp.tag.name')});
   name.addEventListener('change',()=>{try{W.exec(t('sp.cmd.renameTag'),d=>D.updateTag(d,a.id,tag.id,{name:name.value}));}catch(e){W.toast(e.message,{error:true});name.value=tag.name;}});
   const dir=select(tag.direction,[['forward',t('sp.dir.forward')],['reverse',t('sp.dir.reverse')],['pingpong',t('sp.dir.pingpong')]],{id:'tag-direction',label:t('sp.tag.direction'),change:v=>W.exec(t('sp.cmd.tagDirection'),d=>D.updateTag(d,a.id,tag.id,{direction:v}))});
   const rep=numIn(tag.repeat,{min:0,max:65535,id:'tag-repeat',label:t('sp.tag.repeat'),change:v=>W.exec(t('sp.cmd.tagRepeat'),d=>D.updateTag(d,a.id,tag.id,{repeat:Math.max(0,Math.round(v))}))});
   const col=h('input',{type:'color',value:/^#[0-9a-f]{6}/i.test(tag.color)?tag.color.slice(0,7):'#e8a33d','data-sp':'tag-color','aria-label':t('sp.tag.color')});
   col.addEventListener('change',()=>W.exec(t('sp.cmd.tagColor'),d=>D.updateTag(d,a.id,tag.id,{color:col.value})));
   const st=steps(a,tag),ms=totalMs(st);
   const fps=numIn('',{min:1,max:240,id:'tag-fps',label:t('sp.tag.fps'),change:v=>W.setDurations(tag.frameIds,Math.round(1000/Math.max(1,Math.min(240,v))))});
   fps.placeholder=Math.round(1000*st.length/Math.max(1,ms))+'';
   const del=button(t('sp.tag.delete'),()=>W.exec(t('sp.cmd.deleteTag',{name:tag.name}),d=>D.removeTag(d,a.id,tag.id)),{id:'tag-delete'});
   kids.push(h('div.st-pad',{},field(t('sp.tag.name'),name),field(t('sp.tag.direction'),dir),field(t('sp.tag.repeat'),rep),h('p.st-muted.sp-hint',{},t('sp.tag.repeatHint')),field(t('sp.tag.color'),col),
    h('p.st-muted',{'data-sp':'tag-summary'},t('sp.tag.summary',{n:tag.frameIds.length,steps:st.length,ms})),field(t('sp.tag.fps'),fps),h('p.st-muted.sp-hint',{},t('sp.tag.fpsHint')),h('div.st-row',{},del)));
  }else kids.push(h('p.st-muted.st-pad',{},t('sp.tag.pick')));
  tg.replaceChildren(sec(t('sp.tag.all'),h('div.st-pad',{},list)),...kids);
 }
 // ------------------------------------------------------------------ Align
 const al=h('div.sp-panel.sp-align',{});
 function renderAlign(){
  const a=W.asset();
  if(!a?.frames.length){al.replaceChildren(h('p.st-muted.st-pad',{},t('sp.frame.none')));return;}
  const ids=W.scopeIds(),pick=a.frames.filter(f=>ids.includes(f.id));
  const maxW=Math.max(...pick.map(f=>(f.trimmedRect||f.sourceRect).w)),maxH=Math.max(...pick.map(f=>(f.trimmedRect||f.sourceRect).h));
  const o=W.prefs.align;
  const w=numIn(o.width||'',{min:1,id:'align-w',label:t('sp.align.width'),change:v=>W.setPref('align',{...W.prefs.align,width:v>0?Math.round(v):null})});w.placeholder=String(maxW);
  const hh=numIn(o.height||'',{min:1,id:'align-h',label:t('sp.align.height'),change:v=>W.setPref('align',{...W.prefs.align,height:v>0?Math.round(v):null})});hh.placeholder=String(maxH);
  const pad=numIn(o.padding,{min:0,max:256,id:'align-pad',label:t('sp.align.padding'),change:v=>W.setPref('align',{...W.prefs.align,padding:Math.max(0,Math.round(v))})});
  const anchor=select(o.anchor,ALIGNMENTS.filter(x=>x!=='custom').map(x=>[x,t('sp.anchor.'+x)]),{id:'align-anchor',label:t('sp.align.anchor'),change:v=>W.setPref('align',{...W.prefs.align,anchor:v})});
  const trim=h('input',{type:'checkbox',checked:!!o.trim,'data-sp':'align-trim'});trim.addEventListener('change',()=>W.setPref('align',{...W.prefs.align,trim:trim.checked}));
  const ref=select(W.prefs.jitterRef,REFERENCES.map(r=>[r,t('sp.ref.'+r)]),{id:'jitter-ref',label:t('sp.align.reference'),change:v=>W.setPref('jitterRef',v)});
  const rep=W.jitterReport();
  al.replaceChildren(
   sec(t('sp.align.canvas'),h('div.st-pad',{},h('p.st-muted.sp-hint',{},t('sp.align.scopeNote',{n:ids.length})),h('div.st-grid-fields',{},field(t('sp.align.width'),w),field(t('sp.align.height'),hh),field(t('sp.align.padding'),pad)),field(t('sp.align.anchor'),anchor),
    h('label.st-check',{},trim,' ',t('sp.align.trim')),
    h('div.st-row',{},button(t('sp.align.apply'),()=>W.run('sprite.normalize'),{primary:true,id:'align-apply'})),h('p.st-muted',{'data-sp':'align-result'},W.alignResult()||''))),
   sec(t('sp.align.jitter'),h('div.st-pad',{},field(t('sp.align.reference'),ref),
    h('div.st-row.sp-wrap',{},button(t('sp.align.measure'),()=>W.run('sprite.measureJitter'),{id:'jitter-measure'}),button(t('sp.align.fixKeep'),()=>W.run('sprite.fixJitter'),{id:'jitter-fix',disabled:!rep}),button(t('sp.align.fixPin'),()=>W.run('sprite.fixJitterPin'),{id:'jitter-pin',disabled:!rep})),
    rep?h('div.sp-jitter',{'data-sp':'jitter-report'},h('p',{},t('sp.align.residual',{max:rep.residual.max.toFixed(2),rms:rep.residual.rms.toFixed(2)})),h('p.st-muted',{},t('sp.align.movement',{max:rep.metrics.max.toFixed(1)})),...rep.warnings.map(x=>h('p.st-muted',{},x))):h('p.st-muted',{},t('sp.align.jitterHint'))))
  );
 }
 return {imp,fr,tg,al,renderImport,renderFrame,renderTag,renderAlign,renderAll(){renderImport();renderFrame();renderTag();renderAlign();}};
}
