/** FONT mode: game fonts from an outline font (TTF/OTF/WOFF, parsed here — cmap, kerning, variable
 * axes) or from a pixel-font sheet (auto grid + order, measured widths, hand kerning), with a charset
 * built from the game's translation files, bitmap / SDF / PSDF / MSDF / MTSDF atlases on one or many
 * pages, a missing-glyph report, a shader text preview, and engine exports. */
import {h} from '../../ui/dom.js';
import * as P from '../../core/project.js';
import * as U from './state.js';
import {PRESETS,detectFormat,readTranslations} from '../../../game/ui/charset.js';
import {RENDER_MODES,isField} from '../../../game/ui/font/build.js';
import {FONT_TARGETS} from '../../../game/ui/export/bundles.js';
import {VERIFY} from '../../../game/ui/export/helpers.js';
import {TextPreview} from './text-preview.js';
const PAGE_SIZES=[256,512,1024,2048,4096];
const PRESET_IDS=Object.keys(PRESETS);
const TP_KEY='nerulio.studio.ui.textPreview';
export default function fontMode(W){
 const {ctx,t,view}=W;
 let result=null,busy=null,error='',page=0,hoverGlyph=null,selGlyph=null,timer=0,buildSeq=0,info=new Map(),grid=new Map();
 const tp=new TextPreview();
 let tpo={text:'',sizes:null,color:'#ffffff',background:'#23252b',outline:0,outlineColor:'#000000',shadow:{on:false,x:2,y:2,soft:1.5,color:'#000000'},raw:false,kerning:true};
 try{tpo={...tpo,...JSON.parse(localStorage.getItem(TP_KEY)||'{}')};}catch{}
 const saveTp=()=>{try{localStorage.setItem(TP_KEY,JSON.stringify({...tpo,text:tpo.text.slice(0,2000)}));}catch{}};
 const font=()=>W.font();
 const upd=(label,fn,key=null)=>{const f=font();if(!f)return;W.edit(label,s=>U.updateFont(s,f.id,fn),{mergeKey:key});};
 // ---------------------------------------------------------------- adding fonts and translation files
 function pickFontFile(){const i=h('input',{type:'file',accept:'.ttf,.otf,.ttc,.woff,font/ttf,font/otf,font/woff'});i.addEventListener('change',()=>{const f=i.files[0];if(f)W.importFiles([f]);});i.click();}
 async function addFontFile(file){
  const kind=await W.sniff(file);
  if(kind==='woff2')throw Error(t('ui.font.woff2'));
  if(!kind)throw Error(t('ui.font.notFont'));
  const {id,meta}=await W.attachFile(file);await W.sendBlob(id);
  const r=await W.work({op:'fontInfo',blob:id});info.set(id,r.info);
  if(r.info.bitmapOnly)throw Error(t('ui.font.bitmapOnly',{name:file.name}));
  const doc=U.newFont(W.S(),{name:(r.info.family||file.name.replace(/\.[^.]+$/,'')),source:{kind:'file',blob:id,fileName:file.name,family:r.info.family||'',coords:null}});
  W.editDoc(t('ui.cmd.addFont',{name:file.name}),d=>U.withUi(P.attachFile(d,id,meta),s=>U.putFont(s,doc)));
  W.sel.font=doc.id;page=0;
 }
 async function addTranslations(files){
  const f=font();if(!f)throw Error(t('ui.font.needFontFirst'));
  const add=[];let meta=[];
  for(const file of files){const {id,meta:m}=await W.attachFile(file);meta.push([id,m]);
   const tr=readTranslations(file.name,new Uint8Array(await file.arrayBuffer()));
   const locales=tr.columns.length?tr.columns.filter(c=>c.locale&&/^(ko|ja|zh)/.test(c.locale)).map(c=>c.locale):null;
   add.push({id:U.uid('c'),kind:'file',blob:id,name:file.name,format:tr.format,locale:tr.locale,strings:tr.entries.length,columns:tr.columns.map(c=>({index:c.index,name:c.name,locale:c.locale})),locales:locales?.length?locales:null});}
  W.editDoc(t('ui.cmd.addTranslations',{n:files.length}),d=>{let x=d;for(const [id,m] of meta)x=P.attachFile(x,id,m);return U.withUi(x,s=>U.updateFont(s,f.id,fd=>({...fd,charset:{...fd.charset,sources:[...fd.charset.sources,...add]}})));});
  ctx.toast(t('ui.font.addedFiles',{n:files.length,strings:add.reduce((n,a)=>n+a.strings,0)}));
 }
 async function pixelFontFromImage(){
  const a=ctx.activeAsset;if(!a)return;
  const blob=P.primaryBlob(a);await W.sendBlob(blob);
  const r=await W.work({op:'gridDetect',blob});
  const g=r.guess;
  const source={kind:'grid',assetId:a.id,grid:g?{cellW:g.cellW,cellH:g.cellH,cols:g.cols,rows:g.rows,ox:0,oy:0,sx:0,sy:0}:{cellW:8,cellH:8,cols:Math.floor(a.width/8),rows:Math.floor(a.height/8),ox:0,oy:0,sx:0,sy:0},
   chars:g?g.chars:'',measure:'ink',baseline:null,lineHeight:null,spacing:1,spaceAdvance:null,keyColor:r.keyUsed||null,white:false};
  const doc=U.newFont(W.S(),{name:a.name.replace(/\.[^.]+$/,''),source});
  doc.charset.sources=[{id:U.uid('c'),kind:'text',text:g?g.chars.replace(/[\u0000-\u001f]/g,''):''}];
  W.edit(t('ui.cmd.pixelFont'),s=>U.putFont(s,doc));W.sel.font=doc.id;grid.set(doc.id,{guess:g,key:r.key});
  ctx.toast(g?t('ui.font.gridFound',{w:g.cellW,h:g.cellH,n:g.glyphs,conf:t('ui.conf.'+g.confidence)}):t('ui.font.gridNone'),{error:!g});
 }
 // ---------------------------------------------------------------- building (worker)
 function schedule(ms=220){clearTimeout(timer);timer=setTimeout(build,ms);}
 async function build(){
  const f=font();if(!f){result=null;renderAll();return;}
  const my=++buildSeq;busy={phase:'start'};error='';renderStatus();
  try{
   const payload=JSON.parse(JSON.stringify(f));
   if(f.source.kind==='file')await W.sendBlob(f.source.blob);
   else{const a=P.assetById(ctx.doc,f.source.assetId);if(!a)throw Error(t('ui.font.sheetGone'));payload.source.assetBlob=P.primaryBlob(a);await W.sendBlob(payload.source.assetBlob);}
   for(const c of f.charset.sources)if(c.kind==='file')await W.sendBlob(c.blob);
   if(f.source.kind==='file'&&!info.has(f.source.blob))W.work({op:'fontInfo',blob:f.source.blob}).then(r=>{info.set(f.source.blob,r.info);renderSource();}).catch(()=>{});
   const r=await W.work({op:'font',font:payload},{onProgress:p=>{if(my!==buildSeq)return;busy=p;renderStatus();}});
   if(my!==buildSeq){for(const p of r.pages)p.bitmap.close?.();return;}
   for(const p of result?.pages||[])p.bitmap.close?.();
   r.model.keepColor=f.source.kind==='grid'&&!f.source.white;
   result=r;if(page>=r.pages.length)page=0;busy=null;
   tp.setFont(r.model,r.pages.map(p=>p.bitmap));
  }catch(e){if(my!==buildSeq)return;busy=null;error=String(e.message||e);}
  renderAll();if(W.mode==='font')present();
 }
 // ---------------------------------------------------------------- canvas: the atlas page
 async function present(opts={}){
  const pg=result?.pages[page];
  if(!pg){if(font()?.source.kind==='grid')return W.showPicture(font().source.assetId,opts);view.clearImage();return;}
  const same=view.image&&view.image.w===pg.width&&view.image.h===pg.height;
  await view.setImage(pg.bitmap,pg.width,pg.height,{view:same||opts.restoreView?{...view.view}:null});
  ctx.status('image',t('ui.font.pageStatus',{n:page+1,of:result.pages.length,w:pg.width,h:pg.height}));
 }
 const glyphsOnPage=()=>result?result.model.glyphs.filter(g=>g.page===page&&g.w):[];
 const glyphAt=i=>glyphsOnPage().find(g=>i.x>=g.x&&i.y>=g.y&&i.x<g.x+g.w&&i.y<g.y+g.h)||null;
 function draw(g){
  if(!result)return;const {ctx:c,view:v,dpr}=g,s=v.scale;const X=x=>Math.round(v.x+x*s),Y=y=>Math.round(v.y+y*s);
  if(s>=1){c.lineWidth=1;c.strokeStyle='rgba(76,194,255,.35)';c.beginPath();for(const gl of glyphsOnPage()){c.rect(X(gl.x)+.5,Y(gl.y)+.5,Math.max(1,X(gl.x+gl.w)-X(gl.x)-1),Math.max(1,Y(gl.y+gl.h)-Y(gl.y)-1));}c.stroke();}
  for(const [gl,col] of [[hoverGlyph,'#ffffff'],[selGlyph&&result.model.glyphs.find(x=>x.id===selGlyph&&x.page===page),'#ffc83d']]){if(!gl)continue;c.lineWidth=Math.max(1,2*dpr);c.strokeStyle=col;c.strokeRect(X(gl.x)+1,Y(gl.y)+1,X(gl.x+gl.w)-X(gl.x)-2,Y(gl.y+gl.h)-Y(gl.y)-2);}
 }
 const describe=g=>`U+${g.id.toString(16).toUpperCase().padStart(4,'0')} ${String.fromCodePoint(g.id)} · ${g.w}×${g.h} · xoff ${g.xoffset} yoff ${g.yoffset} · adv ${g.xadvance}`;
 const tool={hover(i){const g=glyphAt(i);if(g!==hoverGlyph){hoverGlyph=g;W.invalidate();ctx.status('selection',g?describe(g):'');}},leave(){hoverGlyph=null;W.invalidate();},
  down(i){const g=glyphAt(i);selGlyph=g?.id??null;W.invalidate();renderMetrics();return false;},cursor:()=>'default'};
 // ---------------------------------------------------------------- list
 function list(){
  const fonts=Object.values(W.S().fonts||{}),box=h('div.ui-list',{role:'listbox','aria-label':t('ui.list.fonts')});
  if(!fonts.length)box.append(h('p.st-muted.st-pad',{},t('ui.font.none')));
  for(const f of fonts){const on=f.id===W.sel.font;const row=h('div.ui-row',{role:'option','aria-selected':String(on),tabindex:on?'0':'-1','data-font':f.id},h('span.ui-row-name',{},f.name),h('small',{},f.source.kind==='file'?f.source.fileName:t('ui.font.fromSheet')));
   const del=h('button.st-icon-btn',{type:'button','aria-label':t('ui.font.remove',{name:f.name}),title:t('ui.font.remove',{name:f.name})},'×');
   del.addEventListener('click',ev=>{ev.stopPropagation();removeFont(f);});row.append(del);
   row.addEventListener('click',()=>{W.select('font',f.id);});box.append(row);}
  const addF=h('button.st-btn',{type:'button','data-action':'add-font'},t('ui.font.addFile'));addF.addEventListener('click',pickFontFile);
  const acts=h('div.ui-actions',{},addF);
  if(ctx.activeAsset){const px=h('button.st-btn',{type:'button','data-action':'pixel-font'},t('ui.font.fromImage',{name:ctx.activeAsset.name}));px.addEventListener('click',()=>pixelFontFromImage().catch(e=>ctx.toast(String(e.message||e),{error:true})));acts.append(px);}
  return h('div',{},box,acts);
 }
 function removeFont(f){
  W.editDoc(t('ui.cmd.removeFont',{name:f.name}),d=>{let x=U.withUi(d,s=>U.removeFont(s,f.id));const still=U.usedFiles(U.uiState(x));for(const id of U.usedFiles(U.uiState(d)))if(!still.has(id))x=P.detachFile(x,id);return x;});
 }
 // ---------------------------------------------------------------- panels
 const srcBox=h('div.ui-font-src',{}),csBox=h('div.ui-charset',{}),rBox=h('div.ui-render',{}),mBox=h('div.ui-metrics',{}),xBox=h('div.ui-font-export',{}),tpBox=h('div.ui-tp',{});
 const num=(value,label,on,{min=0,max=9999,step=1,data}={})=>{const el=h('input.st-input.st-num',{type:'number',min:String(min),max:String(max),step:String(step),value:value==null?'':String(value),'aria-label':label,'data-font':data,inputmode:'numeric'});
  el.addEventListener('change',()=>{if(el.value===''){on(null);return;}const v=Number(el.value);if(!Number.isFinite(v))return;on(Math.max(min,Math.min(max,step<1?v:Math.round(v))));});return el;};
 const field=(label,ctl,extra='')=>h('label.st-field'+extra,{},h('span',{},label),ctl);
 const sel=(value,opts,label,on,data)=>{const s=h('select',{'aria-label':label,'data-font':data},...opts.map(([v,l])=>h('option',{value:String(v),selected:String(v)===String(value)},l)));s.addEventListener('change',()=>on(s.value));return s;};
 function renderSource(){
  const f=font();if(!f){srcBox.replaceChildren(h('p.st-muted.st-pad',{},t('ui.font.pick')));return;}
  const src=f.source,parts=[];
  if(src.kind==='file'){
   const i=info.get(src.blob);
   parts.push(h('div.ui-head',{},h('b',{},i?.fullName||src.family||src.fileName),h('span.st-muted',{},src.fileName)));
   if(i){parts.push(h('p.st-muted',{'data-font':'info'},t('ui.font.info',{glyphs:i.glyphs,cps:i.codepoints,type:i.outlines==='cff'?'CFF':'TrueType',hangul:i.hangul,kana:i.kana,han:i.han})));
    if(i.pixelGrid?.pixelSize){const pg=i.pixelGrid,r=f.render,using=r.size%pg.pixelSize===0&&r.mode==='mono';
     const ap=h('button.st-btn'+(using?'':'.primary'),{type:'button',disabled:using,'data-action':'use-pixel-size'},using?t('ui.nine.applied'):t('ui.font.usePixel',{px:pg.pixelSize}));
     ap.addEventListener('click',()=>upd(t('ui.cmd.render'),fd=>({...fd,render:{...fd.render,size:pg.pixelSize,mode:'mono',padding:0}})));
     parts.push(h('div.ui-suggest'+(using?'.is-applied':''),{'data-font':'pixel-grid','data-confidence':pg.confidence},h('b',{},t('ui.font.pixelGrid',{px:pg.pixelSize,sizes:pg.sizes.join(', ')})),' ',h('span.ui-conf.is-'+pg.confidence,{},t('ui.conf.'+pg.confidence)),h('small.st-muted',{},t('ui.font.pixelWhy',{q:pg.quantum,n:pg.points,g:pg.glyphs})),ap));}
    for(const ax of i.axes||[]){const cur=src.coords?.[ax.tag]??ax.default;
     const r=h('input',{type:'range',min:String(ax.min),max:String(ax.max),step:'1',value:String(cur),'data-axis':ax.tag,'aria-label':ax.tag});const out=h('output',{},String(cur));
     r.addEventListener('input',()=>{out.textContent=r.value;});r.addEventListener('change',()=>upd(t('ui.cmd.axis',{axis:ax.tag}),fd=>({...fd,source:{...fd.source,coords:{...(fd.source.coords||{}),[ax.tag]:Number(r.value)}}}),'axis-'+ax.tag));
     parts.push(h('label.st-field.ui-axis',{},h('span',{},`${ax.name||ax.tag} (${ax.tag})`),r,out));}
    if(i.instances?.length){const s=sel('',[['',t('ui.font.instance')],...i.instances.map((x,k)=>[k,x.name])],t('ui.font.instance'),v=>{if(v==='')return;upd(t('ui.cmd.axis',{axis:'instance'}),fd=>({...fd,source:{...fd.source,coords:{...i.instances[+v].coords}}}));},'instance');parts.push(field(t('ui.font.instance'),s));}
    if(i.license||i.copyright)parts.push(h('details.ui-sec',{},h('summary',{},t('ui.font.licence')),h('p.ui-licence',{},[i.copyright,i.license].filter(Boolean).join('\n\n').slice(0,1600))));
   }
  }else{
   const a=P.assetById(ctx.doc,src.assetId),g=src.grid,gi=grid.get(f.id);
   const setG=k=>v=>upd(t('ui.cmd.grid'),fd=>({...fd,source:{...fd.source,grid:{...fd.source.grid,[k]:v??0}}}),'grid-'+k);
   const setS=k=>v=>upd(t('ui.cmd.grid'),fd=>({...fd,source:{...fd.source,[k]:v}}),'src-'+k);
   parts.push(h('div.ui-head',{},h('b',{},a?.name||'?'),h('span.st-muted',{},a?`${a.width}×${a.height}`:'')));
   if(gi?.guess){const q=gi.guess;parts.push(h('div.ui-suggest.is-applied',{'data-font':'grid-guess','data-confidence':q.confidence},h('b',{},t('ui.font.gridGuess',{w:q.cellW,h:q.cellH,c:q.cols,r:q.rows})),' ',h('span.ui-conf.is-'+q.confidence,{},t('ui.conf.'+q.confidence)),h('small.st-muted',{},q.reasons.join(' · '))));}
   if(gi?.key)parts.push(h('p.ui-note',{},t('ui.font.keyFound',{color:gi.key.color,conf:t('ui.conf.'+gi.key.confidence)})));
   parts.push(h('div.ui-grid4',{},field(t('ui.font.cellW'),num(g.cellW,t('ui.font.cellW'),setG('cellW'),{min:1,max:512,data:'cellW'})),field(t('ui.font.cellH'),num(g.cellH,t('ui.font.cellH'),setG('cellH'),{min:1,max:512,data:'cellH'})),
    field(t('ui.font.cols'),num(g.cols,t('ui.font.cols'),setG('cols'),{min:1,max:256,data:'cols'})),field(t('ui.font.rows'),num(g.rows,t('ui.font.rows'),setG('rows'),{min:1,max:256,data:'rows'})),
    field(t('ui.font.ox'),num(g.ox,t('ui.font.ox'),setG('ox'),{max:512})),field(t('ui.font.oy'),num(g.oy,t('ui.font.oy'),setG('oy'),{max:512})),field(t('ui.font.sx'),num(g.sx,t('ui.font.sx'),setG('sx'),{max:64})),field(t('ui.font.sy'),num(g.sy,t('ui.font.sy'),setG('sy'),{max:64}))));
   const order=h('textarea.st-input.ui-order',{rows:'3','aria-label':t('ui.font.order'),'data-font':'order',spellcheck:'false'},src.chars);
   order.addEventListener('change',()=>upd(t('ui.cmd.order'),fd=>({...fd,source:{...fd.source,chars:order.value.replace(/\r?\n/g,'')}})));
   const presets=[['ascii32',t('ui.font.orderAscii')],['ascii33',t('ui.font.orderAscii33')],['cp437','CP437']].map(([k,l])=>{const b=h('button.st-link',{type:'button','data-order':k},l);
    b.addEventListener('click',()=>{const n=g.cols*g.rows;const chars=k==='cp437'?null:Array.from({length:Math.min(n,127-(k==='ascii32'?32:33))},(_,i)=>String.fromCharCode((k==='ascii32'?32:33)+i)).join('');
     import('../../../game/font-grid.js').then(({CP437})=>{const c=chars??CP437.slice(0,n).join('');upd(t('ui.cmd.order'),fd=>({...fd,source:{...fd.source,chars:c},charset:{...fd.charset,sources:fd.charset.sources.length?fd.charset.sources:[{id:U.uid('c'),kind:'text',text:c}]}}));});});return b;});
   parts.push(field(t('ui.font.order'),order),h('div.ui-actions',{},...presets),h('small.st-muted',{},t('ui.font.orderCount',{n:[...src.chars].length,cells:g.cols*g.rows})));
   parts.push(h('div.ui-grid2',{},field(t('ui.font.measure'),sel(src.measure,[['ink',t('ui.font.measureInk')],['fixed',t('ui.font.measureFixed')]],t('ui.font.measure'),setS('measure'),'measure')),
    field(t('ui.font.baseline'),num(src.baseline,t('ui.font.baseline'),setS('baseline'),{max:512,data:'baseline'})),field(t('ui.font.lineHeight'),num(src.lineHeight,t('ui.font.lineHeight'),setS('lineHeight'),{max:1024,data:'lineHeight'})),
    field(t('ui.font.letterSpacing'),num(src.spacing,t('ui.font.letterSpacing'),setS('spacing'),{min:-16,max:64,data:'spacing'})),field(t('ui.font.spaceAdvance'),num(src.spaceAdvance,t('ui.font.spaceAdvance'),setS('spaceAdvance'),{max:256,data:'spaceAdvance'}))));
   const key=h('input.st-input',{type:'text',value:src.keyColor||'','aria-label':t('ui.font.key'),placeholder:'#ffffff','data-font':'key',maxlength:'7'});
   key.addEventListener('change',()=>{const v=key.value.trim();upd(t('ui.cmd.key'),fd=>({...fd,source:{...fd.source,keyColor:/^#?[0-9a-f]{6}$/i.test(v)?('#'+v.replace('#','')).toLowerCase():null}}));});
   const white=h('input',{type:'checkbox',checked:!!src.white,'data-font':'white'});white.addEventListener('change',()=>upd(t('ui.cmd.key'),fd=>({...fd,source:{...fd.source,white:white.checked}})));
   parts.push(h('div.ui-grid2',{},field(t('ui.font.key'),key),h('label.st-check',{},white,' ',t('ui.font.white'))));
  }
  srcBox.replaceChildren(...parts);
 }
 function renderCharset(){
  const f=font();if(!f){csBox.replaceChildren();return;}
  const cs=f.charset,parts=[];
  const setCs=(patch,key)=>upd(t('ui.cmd.charset'),fd=>({...fd,charset:{...fd.charset,...patch}}),key);
  const rows=cs.sources.map(s=>{
   const rm=h('button.st-icon-btn',{type:'button','aria-label':t('ui.charset.remove'),title:t('ui.charset.remove'),'data-remove-source':s.id},'×');
   rm.addEventListener('click',()=>{W.editDoc(t('ui.cmd.charset'),d=>{let x=U.withUi(d,st=>U.updateFont(st,f.id,fd=>({...fd,charset:{...fd.charset,sources:fd.charset.sources.filter(c=>c.id!==s.id)}})));const still=U.usedFiles(U.uiState(x));if(s.kind==='file'&&!still.has(s.blob))x=P.detachFile(x,s.blob);return x;});});
   const stat=result?.charset?.perSource?.find(p=>p.id===s.id);
   let body;
   if(s.kind==='preset')body=h('span',{},t('ui.preset.'+s.preset),h('small.st-muted',{},stat?` · ${stat.glyphs}`:''));
   else if(s.kind==='text'){const ta=h('textarea.st-input',{rows:'2','aria-label':t('ui.charset.text'),'data-source-text':s.id},s.text||'');ta.addEventListener('change',()=>setCs({sources:cs.sources.map(c=>c.id===s.id?{...c,text:ta.value}:c)}));body=ta;}
   else{
    const cols=s.columns?.filter(c=>c.locale||c.name)||[];
    const pick=cols.length?h('div.ui-cols',{},...cols.map(c=>{const key=c.locale||c.index;const cb=h('input',{type:'checkbox',checked:!s.locales&&!s.picked?true:(s.locales||[]).includes(c.locale)||(s.picked||[]).includes(c.index)});
     cb.addEventListener('change',()=>{const cur=new Set(s.locales||(cols.filter(x=>x.locale).map(x=>x.locale)));cb.checked?cur.add(c.locale):cur.delete(c.locale);setCs({sources:cs.sources.map(x=>x.id===s.id?{...x,locales:[...cur]}:x)});});void key;
     return h('label.st-check',{},cb,' ',c.locale||c.name);})):null;
    body=h('div',{},h('b',{},s.name),h('small.st-muted',{},` · ${s.format}${s.locale?' · '+s.locale:''} · ${t('ui.charset.strings',{n:s.strings})}${stat?` · ${t('ui.charset.newGlyphs',{n:stat.newGlyphs})}`:''}`),pick);
   }
   return h('li.ui-source',{'data-source':s.kind},body,rm);
  });
  const addFile=h('button.st-btn',{type:'button','data-action':'add-l10n'},t('ui.charset.addFile'));
  addFile.addEventListener('click',()=>{const i=h('input',{type:'file',multiple:true,accept:'.po,.pot,.csv,.tsv,.json,.strings,.resx,.xliff,.xlf,.xml,.properties,.tres,.txt'});i.addEventListener('change',()=>{if(i.files.length)addTranslations([...i.files]).catch(e=>ctx.toast(String(e.message||e),{error:true}));});i.click();});
  const preset=sel('',[['',t('ui.charset.addPreset')],...PRESET_IDS.map(p=>[p,t('ui.preset.'+p)])],t('ui.charset.addPreset'),v=>{if(v)setCs({sources:[...cs.sources,{id:U.uid('c'),kind:'preset',preset:v}]});},'add-preset');
  const addText=h('button.st-btn',{type:'button','data-action':'add-text'},t('ui.charset.addText'));addText.addEventListener('click',()=>setCs({sources:[...cs.sources,{id:U.uid('c'),kind:'text',text:''}]}));
  const strip=h('input',{type:'checkbox',checked:cs.strip!==false,'data-font':'strip'});strip.addEventListener('change',()=>setCs({strip:strip.checked}));
  const order=sel(cs.order||'frequency',[['frequency',t('ui.charset.byFrequency')],['codepoint',t('ui.charset.byCode')]],t('ui.charset.order'),v=>setCs({order:v}),'order');
  const excl=h('input.st-input',{type:'text',value:cs.exclude||'','aria-label':t('ui.charset.exclude'),'data-font':'exclude'});excl.addEventListener('change',()=>setCs({exclude:excl.value},'cs-excl'));
  parts.push(h('ul.ui-sources',{},...rows),h('div.ui-actions',{},addFile,preset,addText),
   h('label.st-check',{},strip,' ',t('ui.charset.strip')),result?.charset?.removed&&Object.keys(result.charset.removed).length?h('small.st-muted',{'data-font':'removed'},t('ui.charset.removed',{list:Object.entries(result.charset.removed).map(([k,n])=>`${t('ui.strip.'+k)} ${n}`).join(', ')})):'',
   h('div.ui-grid2',{},field(t('ui.charset.order'),order),field(t('ui.charset.exclude'),excl)));
  if(result?.charset){const st=result.charset.stats;parts.push(h('p.ui-stats',{'data-font':'charset-stats'},t('ui.charset.stats',{n:st.total,latin:st.latin,hangul:st.hangul,kana:st.kana,han:st.han,other:st.other+st.jamo+st.cjkPunct})));}
  const miss=result?.missing||[];
  if(result)parts.push(miss.length?h('details.ui-missing',{'data-font':'missing',open:miss.length<=40},h('summary',{},t('ui.charset.missing',{n:miss.length})),
   h('ul',{},...miss.slice(0,300).map(m=>h('li',{},h('b',{},m.char),` U+${m.codepoint.toString(16).toUpperCase().padStart(4,'0')} × ${m.count}`,m.where.length?h('small.st-muted',{},' · '+m.where.map(w=>`${w.file}:${w.line}`).join(', ')):''))))
   :h('p.ui-ok',{'data-font':'missing-none'},t('ui.charset.allPresent')));
  csBox.replaceChildren(...parts);
 }
 function renderRender(){
  const f=font();if(!f){rBox.replaceChildren();return;}
  const r=f.render,setR=(k,key)=>v=>upd(t('ui.cmd.render'),fd=>({...fd,render:{...fd.render,[k]:v}}),key||'render-'+k);
  const parts=[];
  if(f.source.kind==='file'){
   parts.push(h('div.ui-grid2',{},field(t('ui.render.mode'),sel(r.mode,RENDER_MODES.map(m=>[m,t('ui.render.m.'+m)]),t('ui.render.mode'),setR('mode','render-mode'),'mode')),
    field(t('ui.render.size'),num(r.size,t('ui.render.size'),setR('size'),{min:4,max:512,data:'size'})),
    ...(isField(r.mode)?[field(t('ui.render.range'),num(r.range,t('ui.render.range'),setR('range'),{min:1,max:64,data:'range'}))]:[]),
    ...(r.mode==='mono'?[field(t('ui.render.threshold'),num(r.threshold,t('ui.render.threshold'),setR('threshold'),{min:0,max:1,step:.05,data:'threshold'}))]:[]),
    field(t('ui.render.padding'),num(r.padding,t('ui.render.padding'),setR('padding'),{max:64,data:'padding'})),field(t('ui.render.spacing'),num(r.spacing,t('ui.render.spacing'),setR('spacing'),{max:64,data:'spacing'})),
    field(t('ui.render.page'),sel(r.pageWidth,PAGE_SIZES.map(v=>[v,`${v}×${v}`]),t('ui.render.page'),v=>upd(t('ui.cmd.render'),fd=>({...fd,render:{...fd.render,pageWidth:+v,pageHeight:+v}})),'page')),
    field(t('ui.render.sizeMode'),sel(r.sizeMode,[['pot',t('ui.render.pot')],['auto',t('ui.render.auto')],['fixed',t('ui.render.fixed')]],t('ui.render.sizeMode'),setR('sizeMode','render-sm'),'sizeMode'))));
   const kern=h('input',{type:'checkbox',checked:r.kerning!==false,'data-font':'kerning'});kern.addEventListener('change',()=>setR('kerning','render-k')(kern.checked));
   parts.push(h('label.st-check',{},kern,' ',t('ui.render.kerning')));
   if(r.mode==='sdf'||r.mode==='psdf'){const a=h('input',{type:'checkbox',checked:!!r.alphaOnly,'data-font':'alphaOnly'});a.addEventListener('change',()=>setR('alphaOnly','render-a')(a.checked));parts.push(h('label.st-check',{},a,' ',t('ui.render.alphaOnly')));}
   parts.push(h('small.st-muted',{},t('ui.render.hint.'+r.mode)));
  }else parts.push(h('p.ui-note',{},t('ui.render.gridNote')));
  parts.push(statusEl);
  rBox.replaceChildren(...parts);renderStatus();
 }
 const statusEl=h('div.ui-status',{'aria-live':'polite'});
 function renderStatus(){
  const parts=[];
  if(busy)parts.push(h('p.ui-busy',{'data-font':'busy'},t('ui.render.phase.'+(busy.phase||'start'),{done:busy.done??'',total:busy.total??''})));
  if(error)parts.push(h('p.st-error',{'data-font':'error'},error));
  if(result&&!busy){const m=result.model,used=m.glyphs.reduce((n,g)=>n+g.w*g.h,0),area=m.pages.reduce((n,p)=>n+p.width*p.height,0);
   parts.push(h('p.ui-stats',{'data-font':'result'},t('ui.render.result',{g:m.glyphs.length,p:m.pages.length,w:m.pages[0].width,h:m.pages[0].height,eff:Math.round(used/area*1000)/10,k:m.kerning.length,ms:result.ms})));
   if(m.pages.length>1)parts.push(h('div.ui-pages',{role:'tablist'},...m.pages.map((p,i)=>{const b=h('button.ui-toggle',{type:'button','aria-pressed':String(i===page),'data-page':String(i)},t('ui.render.pageN',{n:i+1}));b.addEventListener('click',()=>{page=i;present();renderStatus();});return b;})));}
  statusEl.replaceChildren(...parts);ctx.badge?.('ui-font-render');
 }
 function renderMetrics(){
  const f=font();if(!f){mBox.replaceChildren();return;}
  const parts=[],m=result?.model;
  if(m)parts.push(h('p.ui-stats',{},t('ui.metrics.line',{lh:m.lineHeight,base:m.base,asc:Math.round(m.ascender*10)/10,desc:Math.round(m.descender*10)/10})));
  const g=selGlyph!=null&&m?m.glyphs.find(x=>x.id===selGlyph):null;
  if(g){const ov=f.overrides?.[g.id]||{},setO=k=>v=>upd(t('ui.cmd.glyph'),fd=>{const o={...(fd.overrides||{})};const cur={...(o[g.id]||{})};if(v==null)delete cur[k];else cur[k]=v;if(Object.keys(cur).length)o[g.id]=cur;else delete o[g.id];return {...fd,overrides:o};},'glyph-'+g.id+k);
   parts.push(h('div.ui-sec',{'data-font':'glyph'},h('h3',{},t('ui.metrics.glyph',{c:String.fromCodePoint(g.id),u:g.id.toString(16).toUpperCase().padStart(4,'0')})),
    h('div.ui-grid3',{},field(t('ui.metrics.xadvance'),num(ov.xadvance??g.xadvance,'xadvance',setO('xadvance'),{min:-512,max:2048})),field(t('ui.metrics.xoffset'),num(ov.xoffset??g.xoffset,'xoffset',setO('xoffset'),{min:-512,max:512})),field(t('ui.metrics.yoffset'),num(ov.yoffset??g.yoffset,'yoffset',setO('yoffset'),{min:-512,max:512}))),
    Object.keys(ov).length?h('small.st-muted',{},t('ui.metrics.overridden')):''));}
  else parts.push(h('small.st-muted',{},t('ui.metrics.clickGlyph')));
  // kerning: the font's own pairs (count) + hand pairs
  const hand=U.kerningList(f);
  const a=h('input.st-input.ui-char',{type:'text',maxlength:'2','aria-label':t('ui.metrics.first'),'data-kern':'first'}),b=h('input.st-input.ui-char',{type:'text',maxlength:'2','aria-label':t('ui.metrics.second'),'data-kern':'second'});
  const amt=h('input.st-input.st-num',{type:'number',min:'-64',max:'64',value:'-1','aria-label':t('ui.metrics.amount'),'data-kern':'amount'});
  const add=h('button.st-btn',{type:'button','data-kern':'add'},t('ui.metrics.addPair'));
  add.addEventListener('click',()=>{const x=[...a.value][0],y=[...b.value][0],v=Math.round(+amt.value||0);if(!x||!y)return;upd(t('ui.cmd.kern'),fd=>({...fd,kerning:{...(fd.kerning||{}),[U.kerningKey(x.codePointAt(0),y.codePointAt(0))]:v}}));});
  parts.push(h('div.ui-sec',{},h('h3',{},t('ui.metrics.kerning')),m?h('small.st-muted',{},t('ui.metrics.kernCount',{n:m.kerning.filter(k=>!k.hand).length,px:m.kerning.filter(k=>k.amount).length})):'',
   h('div.ui-kern-add',{},a,b,amt,add),
   hand.length?h('ul.ui-kern',{},...hand.map(k=>{const rm=h('button.st-icon-btn',{type:'button','aria-label':t('ui.charset.remove')},'×');rm.addEventListener('click',()=>upd(t('ui.cmd.kern'),fd=>{const o={...fd.kerning};delete o[U.kerningKey(k.first,k.second)];return {...fd,kerning:o};}));
    return h('li',{},`${String.fromCodePoint(k.first)}${String.fromCodePoint(k.second)}  ${k.amount>0?'+':''}${k.amount}`,rm);})):''));
  if(f.source.kind==='grid'){const sug=h('button.st-btn',{type:'button','data-kern':'suggest'},t('ui.metrics.suggest'));sug.addEventListener('click',suggestKerning);parts.push(sug,kernSuggestions?renderSuggestions():'');}
  mBox.replaceChildren(...parts);
 }
 let kernSuggestions=null;
 async function suggestKerning(){
  const f=font();if(!f||f.source.kind!=='grid')return;
  try{const payload=JSON.parse(JSON.stringify(f));payload.source.assetBlob=P.primaryBlob(P.assetById(ctx.doc,f.source.assetId));await W.sendBlob(payload.source.assetBlob);
   const r=await W.work({op:'kernSuggest',font:payload});kernSuggestions=r.suggestions;renderMetrics();}catch(e){ctx.toast(String(e.message||e),{error:true});}
 }
 function renderSuggestions(){
  const s=kernSuggestions;if(!s.pairs.length)return h('p.st-muted',{},t('ui.metrics.noSuggest'));
  const apply=h('button.st-btn.primary',{type:'button','data-kern':'apply-suggested'},t('ui.metrics.applyAll',{n:s.pairs.length}));
  apply.addEventListener('click',()=>{upd(t('ui.cmd.kern'),fd=>{const o={...(fd.kerning||{})};for(const p of s.pairs)o[U.kerningKey(p.first,p.second)]=p.amount;return {...fd,kerning:o};});kernSuggestions=null;});
  return h('div.ui-suggest',{'data-kern':'suggestions'},h('b',{},t('ui.metrics.suggested',{n:s.pairs.length,gap:s.typical})),h('small.st-muted',{},s.pairs.slice(0,24).map(p=>`${String.fromCodePoint(p.first)}${String.fromCodePoint(p.second)} ${p.amount}`).join('  ')),apply);
 }
 function renderExport(){
  const f=font();if(!f){xBox.replaceChildren();return;}
  const targets=f.exportTargets||['bmfont-text','bmfont-xml','msdf-json','godot','unity','phaser','pixi'];
  const name=h('input.st-input',{type:'text',value:f.exportName||'font','aria-label':t('ui.kit.name'),'data-font':'exportName',maxlength:'60'});
  name.addEventListener('change',()=>upd(t('ui.cmd.exportName'),fd=>({...fd,exportName:name.value.trim().replace(/[^\p{L}\p{N}_.-]+/gu,'_')||'font'})));
  const rows=FONT_TARGETS.map(k=>{const c=h('input',{type:'checkbox',checked:targets.includes(k),'data-font-target':k});c.addEventListener('change',()=>{const cur=new Set(targets);c.checked?cur.add(k):cur.delete(k);upd(t('ui.cmd.exportName'),fd=>({...fd,exportTargets:FONT_TARGETS.filter(x=>cur.has(x))}),'font-t');});
   const v=VERIFY.font[k].replace('/','');const na=k==='bmfont-bin'&&result&&result.model.type!=='bitmap';
   return h('label.ui-target'+(na?'.is-na':''),{title:na?t('ui.font.binNoField'):null},c,h('span',{},t('ui.font.target.'+k)),h('span.ui-verify.is-'+v,{},t('ui.verify.'+v)));});
  const go=h('button.st-btn.primary',{type:'button','data-font':'export',disabled:!result||!!busy},t('ui.font.export'));go.addEventListener('click',exportNow);
  xBox.replaceChildren(field(t('ui.kit.name'),name),h('div.ui-targets',{},...rows),go);
 }
 async function exportNow(){
  const f=font();if(!f||!result||busy)return;
  try{
   const cps=result.charset.codepoints||[];
   const payload={name:f.exportName||f.name,model:result.model,pages:result.pages.map(p=>({png:p.png})),targets:f.exportTargets||['bmfont-text','bmfont-xml','msdf-json','godot','unity','phaser','pixi'],
    charset:cps.map(c=>String.fromCodePoint(c)).join(''),missing:result.missing,source:{family:info.get(f.source.blob)?.fullName||f.name,license:info.get(f.source.blob)?.license||''}};
   const r=await W.work({op:'export',kind:'font',payload});
   const a=h('a',{href:URL.createObjectURL(r.blob),download:r.name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
   ctx.toast(t('ui.kit.done',{name:r.name,n:r.files.length}));
   window.dispatchEvent(new CustomEvent('nerulio:ui-export',{detail:{kind:'font',name:r.name,files:r.files}}));
  }catch(e){ctx.toast(String(e.message||e),{error:true});}
 }
 function renderPreview(){
  const f=font();if(!f||!result){tpBox.replaceChildren(h('p.st-muted.st-pad',{},f?t('ui.render.phase.start'):t('ui.font.pick')));return;}
  const m=result.model,base=m.size;
  if(!tpo.text)tpo.text=defaultSample(f);
  const sizes=tpo.sizes||(m.type==='bitmap'?[base,base*2,base*3]:[Math.round(base/2),base,base*2,base*4]);
  const ta=h('textarea.st-input.ui-tp-text',{rows:'2','aria-label':t('ui.tp.text'),'data-tp':'text',spellcheck:'false'},tpo.text);ta.addEventListener('input',()=>{tpo.text=ta.value;saveTp();draw();});
  const sz=h('input.st-input',{type:'text',value:sizes.join(', '),'aria-label':t('ui.tp.sizes'),'data-tp':'sizes'});sz.addEventListener('change',()=>{const v=sz.value.split(/[ ,]+/).map(Number).filter(x=>x>=2&&x<=512).slice(0,8);tpo.sizes=v.length?v:null;saveTp();renderPreview();});
  const color=h('input',{type:'color',value:tpo.color,'aria-label':t('ui.tp.color')});color.addEventListener('input',()=>{tpo.color=color.value;saveTp();draw();});
  const bg=h('input',{type:'color',value:tpo.background,'aria-label':t('ui.tp.background')});bg.addEventListener('input',()=>{tpo.background=bg.value;saveTp();draw();});
  const kern=h('input',{type:'checkbox',checked:tpo.kerning,'data-tp':'kerning'});kern.addEventListener('change',()=>{tpo.kerning=kern.checked;saveTp();draw();});
  const bar=[h('label.st-field.ui-inline',{},h('span',{},t('ui.tp.sizes')),sz),h('label.st-field.ui-inline',{},h('span',{},t('ui.tp.color')),color),h('label.st-field.ui-inline',{},h('span',{},t('ui.tp.background')),bg),h('label.st-check',{},kern,' ',t('ui.render.kerning'))];
  if(m.type!=='bitmap'){
   const ol=h('input.st-input.st-num',{type:'number',min:'0',max:String(Math.max(1,m.distanceRange)),step:'.25',value:String(tpo.outline),'aria-label':t('ui.tp.outline'),'data-tp':'outline'});ol.addEventListener('input',()=>{tpo.outline=+ol.value||0;saveTp();draw();});
   const olc=h('input',{type:'color',value:tpo.outlineColor,'aria-label':t('ui.tp.outlineColor')});olc.addEventListener('input',()=>{tpo.outlineColor=olc.value;saveTp();draw();});
   const sh=h('input',{type:'checkbox',checked:tpo.shadow.on,'data-tp':'shadow'});sh.addEventListener('change',()=>{tpo.shadow={...tpo.shadow,on:sh.checked};saveTp();draw();});
   const raw=h('input',{type:'checkbox',checked:tpo.raw,'data-tp':'raw'});raw.addEventListener('change',()=>{tpo.raw=raw.checked;saveTp();draw();});
   bar.push(h('label.st-field.ui-inline',{},h('span',{},t('ui.tp.outline')),ol,olc),h('label.st-check',{},sh,' ',t('ui.tp.shadow')),h('label.st-check',{},raw,' ',t('ui.tp.raw')));
  }
  const note=h('small.st-muted.ui-tp-note',{'data-tp':'note'});
  tpBox.replaceChildren(h('div.ui-preview-bar',{},...bar),ta,h('div.ui-tp-stage',{},tp.canvas),note);
  function draw(){const r=tp.render({...tpo,sizes});if(tp.canvas.parentElement!==tpBox.querySelector('.ui-tp-stage'))tpBox.querySelector('.ui-tp-stage')?.replaceChildren(tp.canvas);
   note.textContent=[m.type==='bitmap'?t('ui.tp.bitmapNote',{size:base}):t('ui.tp.fieldNote',{range:m.distanceRange}),r.missing.length?t('ui.tp.missing',{n:r.missing.length,chars:r.missing.slice(0,20).map(c=>String.fromCodePoint(c)).join('')}):''].filter(Boolean).join(' · ');}
  draw();
 }
 function defaultSample(f){
  const hasKo=f.charset.sources.some(s=>s.kind==='file');
  return hasKo?t('ui.tp.sampleKo'):t('ui.tp.sample');
 }
 function renderAll(){renderSource();renderCharset();renderRender();renderMetrics();renderExport();renderPreview();W.refresh();}
 return {
  panels:()=>[
   {id:'ui-font-source',title:()=>t('ui.panel.fontSource'),dock:'right',order:12,render(body){body.append(srcBox);}},
   {id:'ui-charset',title:()=>t('ui.panel.charset'),dock:'right',order:13,badge:()=>result?String(result.charset.count):'',render(body){body.append(csBox);}},
   {id:'ui-font-render',title:()=>t('ui.panel.render'),dock:'right',order:14,render(body){body.append(rBox);}},
   {id:'ui-font-metrics',title:()=>t('ui.panel.metrics'),dock:'right',order:16,render(body){body.append(mBox);}},
   {id:'ui-font-export',title:()=>t('ui.panel.fontExport'),dock:'right',order:40,render(body){body.append(xBox);}},
   {id:'ui-text-preview',title:()=>t('ui.panel.textPreview'),dock:'bottom',order:5,render(body){body.append(tpBox);}}
  ],
  enter(){ctx.minBottomHeight?.(220);if(!W.sel.font)W.sel.font=Object.keys(W.S().fonts||{})[0]||null;renderAll();if(result)present({restoreView:true});schedule(0);},
  leave(){hoverGlyph=null;clearTimeout(timer);},
  list,tool,draw,present,addFontFile,addTranslations,pickFontFile,importFnt:async()=>{throw Error(t('ui.font.fntLater'));},
  onSelect(kind){if(kind==='font'){page=0;selGlyph=null;kernSuggestions=null;result=null;renderAll();schedule(0);}},
  onAsset(){if(W.mode==='font')W.refresh();},
  onDoc(doc,prev){const a=U.uiState(doc).fonts?.[W.sel.font],b=prev&&U.uiState(prev).fonts?.[W.sel.font];if(W.mode!=='font')return;if(a!==b){renderAll();schedule();}},
  onLocale(){renderAll();},
  canExport:()=>!!result&&!busy,exportNow,
  dispose(){for(const p of result?.pages||[])p.bitmap.close?.();}
 };
}
