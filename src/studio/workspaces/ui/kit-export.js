/** Export panel shared by the 9-SLICE, STATES and ATLAS modes: one UI-kit ZIP with the engine
 * targets the user ticks. Each target shows how it was verified (VERIFY in helpers.js). */
import {h} from '../../ui/dom.js';
import * as U from './state.js';
import {KIT_TARGETS} from '../../../game/ui/export/bundles.js';
import {VERIFY} from '../../../game/ui/export/helpers.js';
export function kitPanel(W){
 const {ctx,t}=W;const box=h('div.ui-kit',{});let busy=false,last=null;
 const kit=()=>W.S().kit||{};
 const setKit=(patch,key='ui-kit')=>W.edit(t('ui.cmd.kit'),s=>({...s,kit:{...(s.kit||{}),...patch}}),{mergeKey:key});
 const targets=()=>kit().targets||['generic','godot','unity','css'];
 const exportable=()=>{const s=U.pruneForAssets(W.S(),ctx.doc.assets.map(a=>a.id));return {els:U.elementsOf(s),buttons:Object.values(s.buttons||{})};};
 const badge=(k)=>{const v=VERIFY.kit[k];return h('span.ui-verify.is-'+v.replace('/',''),{title:t('ui.verify.'+v.replace('/',''))},t('ui.verify.'+v.replace('/','')));};
 function render(){
  const {els}=exportable(),name=h('input.st-input',{type:'text',value:kit().name||'ui','aria-label':t('ui.kit.name'),'data-kit':'name',maxlength:'60'});
  name.addEventListener('change',()=>setKit({name:name.value.trim()||'ui'}));
  const rows=KIT_TARGETS.map(k=>{const c=h('input',{type:'checkbox',checked:targets().includes(k),'data-kit-target':k});
   c.addEventListener('change',()=>{const cur=new Set(targets());c.checked?cur.add(k):cur.delete(k);setKit({targets:KIT_TARGETS.filter(x=>cur.has(x))},'ui-kit-t');});
   return h('label.ui-target',{},c,h('span',{},t('ui.kit.target.'+k)),badge(k));});
  const atlas=h('input',{type:'checkbox',checked:!!kit().atlas,'data-kit':'atlas'});atlas.addEventListener('change',()=>setKit({atlas:atlas.checked},'ui-kit-a'));
  const go=h('button.st-btn.primary',{type:'button','data-kit':'export',disabled:busy||!els.length||!targets().length},busy?t('ui.kit.exporting'):t('ui.kit.export',{n:els.length}));
  go.addEventListener('click',exportNow);
  box.replaceChildren(h('label.st-field',{},h('span',{},t('ui.kit.name')),name),h('div.ui-targets',{},...rows),h('label.st-check',{},atlas,' ',t('ui.kit.atlas')),go,
   els.some(e=>!e.nine)?h('small.st-muted',{},t('ui.kit.noNine',{n:els.filter(e=>!e.nine).length})):'',
   last?h('p.ui-note',{'data-kit':'last'},t('ui.kit.done',{name:last.name,n:last.files.length})):'');
 }
 async function exportNow(){
  const {els,buttons}=exportable();if(busy||!els.length)return;
  busy=true;render();
  try{
   const blobs=[...new Set(els.map(e=>W.assetBlob(e.assetId)))];for(const b of blobs)await W.sendBlob(b);
   const byId=new Map(els.map(e=>[e.id,e]));
   const payload={name:kit().name||'ui',targets:targets(),atlas:!!kit().atlas,
    elements:els.map(e=>({name:e.name,blob:W.assetBlob(e.assetId),rect:e.rect,nine:e.nine})),
    buttons:buttons.map(b=>({name:b.name,states:Object.fromEntries(Object.entries(b.states).map(([k,v])=>[k,v.element?{element:byId.get(v.element)?.name}:{from:v.from,ops:v.ops}]))}))};
   const r=await W.work({op:'export',kind:'kit',payload});
   const a=h('a',{href:URL.createObjectURL(r.blob),download:r.name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
   last=r;ctx.toast(t('ui.kit.done',{name:r.name,n:r.files.length}));
   window.dispatchEvent(new CustomEvent('nerulio:ui-export',{detail:{kind:'kit',name:r.name,files:r.files}}));
  }catch(e){ctx.toast(String(e.message||e),{error:true});}
  finally{busy=false;render();}
 }
 return {panel:{id:'ui-kit-export',title:()=>t('ui.panel.kitExport'),dock:'right',order:40,render(body){body.append(box);}},render,exportNow,canExport:()=>!busy&&exportable().els.length>0};
}
