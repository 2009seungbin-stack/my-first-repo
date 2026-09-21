import * as Im from '../image.js';
import {defaults,runRecipe} from '../recipes.js';
import {stem} from '../core.js';
import {t} from '../i18n.js';
import {createBatch} from './batch.js';
import {text,page} from './shell.js';
/** One task page for every "one image in → result out" recipe (game-asset and listing tools).
 * Each tool is a short declarative field list: the first group is always visible, the rest sits
 * under Advanced. Labels reuse the existing ko/en/ja `kit.*` messages; the engines are the
 * unchanged recipes in src/recipes.js, run once per dropped image. */
export const accept='image/*';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=(key,min,max,step=1)=>({key,type:'num',min,max,step}),C=key=>({key,type:'color'}),B=key=>({key,type:'check'}),X=(key,rows=3)=>({key,type:'text',rows});
const S=(key,options)=>({key,type:'select',options}),CH=(key,values,label)=>({key,type:'chips',values,label});
const FIT=()=>({...S('fit',[['contain','ui:resize.contain'],['cover','ui:resize.cover']]),title:'ui:recipe.fit'});
export const RECIPE_FORMS=Object.freeze({
 refiner:{basic:[CH('n',[16,32,64,128],v=>`${v}×${v}`),N('colors',2,256)],advanced:[N('n',8,512),N('dither',0,1,.1),N('outline',0,4),N('padding',0,64),B('cleanup'),C('background'),N('tolerance',0,441),B('pack'),X('palette',4)],pixelated:true},
 'logo-bg':{basic:[N('tolerance',0,441)],advanced:[C('background')]},
 'palette-swap':{basic:[C('from'),C('to')],advanced:[N('tolerance',0,441),B('shading')],pixelated:true},
 'texture-map':{basic:[S('mode',[['normal','kit.normal'],['gray','kit.gray'],['invert','kit.invert'],['alpha','kit.alphaMap']])],advanced:[N('strength',0,10,.1),B('invertY')]},
 'margin-crop':{basic:[],advanced:[N('threshold',0,255),N('padding',0,64)]},
 'tile-helper':{basic:[N('cellW',1,4096),N('cellH',1,4096)],advanced:[]},
 'atlas-padding':{basic:[N('cellW',1,4096),N('cellH',1,4096),N('padding',1,8)],advanced:[],pixelated:true},
 'scan-split':{basic:[N('divider',.01,.99,.01),S('order',[['LR','L → R'],['RL','R → L']])],advanced:[]},
 'marketplace-pack':{basic:[S('platform',[['all','Etsy + Shopify'],['etsy','Etsy'],['shopify','Shopify'],['custom','kit.custom']]),FIT()],advanced:[N('width',1,8192),N('height',1,8192),C('background')]},
 'print-pack':{basic:[N('longSide',64,4096),FIT()],advanced:[C('background')]},
 'favicon-pack':{basic:[],advanced:[]},
 'bitmap-font':{basic:[N('cellW',1,4096),N('cellH',1,4096),X('chars')],advanced:[N('baseline',0,4096)]}
});
const optionLabel=l=>l.startsWith('kit.')?t(l):l.startsWith('ui:')?text(l.slice(3)):l,label=f=>f.title?optionLabel(f.title):t('kit.'+f.key);
function field(f,o){
 const id=`rc-${f.key}${f.type==='chips'?'-chips':''}`,v=o[f.key];
 if(f.type==='chips')return `<span class="opt-label">${esc(label(f))}</span><div class="segmented" role="group" id="${id}">${f.values.map(x=>`<button type="button" data-action="task-option" data-chip="${f.key}" data-value="${x}" aria-pressed="${Number(v)===x}">${esc(f.label(x))}</button>`).join('')}</div>`;
 if(f.type==='check')return `<label class="check"><input id="${id}" data-option="${f.key}" type="checkbox" ${v?'checked':''}> ${esc(label(f))}</label>`;
 if(f.type==='select')return `<label class="field"><span>${esc(label(f))}</span><select id="${id}" data-option="${f.key}">${f.options.map(([value,l])=>`<option value="${value}" ${String(v)===value?'selected':''}>${esc(optionLabel(l))}</option>`).join('')}</select></label>`;
 if(f.type==='text')return `<label class="field"><span>${esc(label(f))}</span><textarea id="${id}" data-option="${f.key}" rows="${f.rows}" spellcheck="false">${esc(v||'')}</textarea></label>`;
 if(f.type==='color')return `<label class="field inline"><span>${esc(label(f))}</span><input id="${id}" data-option="${f.key}" type="color" value="${esc(v)}"></label>`;
 return `<label class="field"><span>${esc(label(f))}</span><input id="${id}" data-option="${f.key}" type="number" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}" inputmode="decimal"></label>`;
}
export function mount(ctx){
 const id=page.id,form=RECIPE_FORMS[id],all=[...form.basic,...form.advanced],chipKeys=new Set(all.filter(f=>f.type==='chips').map(f=>f.key));
 // A shared link (?n=64&colors=8) presets the same fields a person can set by hand; anything else is ignored.
 const preset=(f,fallback)=>{const raw=page.query.get(f.key);if(raw===null)return fallback;if(f.type==='num'||f.type==='chips'){const n=Number(raw),min=f.min??8,max=f.max??512;return Number.isFinite(n)&&n>=min&&n<=max?n:fallback;}if(f.type==='check')return raw==='1'||raw==='true';if(f.type==='select')return f.options.some(([v])=>v===raw)?raw:fallback;if(f.type==='color')return /^#[0-9a-f]{6}$/i.test(raw)?raw:fallback;return raw.slice(0,2000);};
 const options=()=>{const o=defaults(id),out={};for(const f of all)if(!(f.key in out)||f.type!=='chips')out[f.key]=preset(f,out[f.key]??o[f.key]);return out;};
 const simple=o=>form.basic.map(f=>field(f,o)).join('')||`<p class="hint">${esc(t(`intent.${id}.description`))}</p>`;
 const advanced=o=>form.advanced.map(f=>field(f,o)).join('')||`<p class="hint">${esc(text('recipe.noOptions'))}</p>`;
 function read(formEl,o){
  const next={...o};
  for(const f of all){
   if(f.type==='chips'){const pressed=formEl.querySelector(`#rc-${f.key}-chips [aria-pressed="true"]`);if(pressed&&Number(pressed.dataset.value)!==Number(o[f.key]))next[f.key]=Number(pressed.dataset.value);continue;}
   const el=formEl.querySelector(`[data-option="${f.key}"]`);if(!el)continue;
   const value=f.type==='check'?el.checked:f.type==='num'?Math.max(f.min,Math.min(f.max,Number(el.value)||0)):el.value;
   // A chip row and an exact-number box can share a key; whichever the user just changed wins.
   if(f.type==='num'&&chipKeys.has(f.key)&&value===Number(o[f.key]))continue;
   next[f.key]=value;
  }
  return next;
 }
 function reflect(formEl,o){for(const f of all){if(f.type==='chips')for(const b of formEl.querySelectorAll(`#rc-${f.key}-chips button`))b.setAttribute('aria-pressed',String(Number(b.dataset.value)===Number(o[f.key])));else if(f.type==='num'){const el=formEl.querySelector(`[data-option="${f.key}"]`);if(el&&document.activeElement!==el)el.value=o[f.key];}}}
 async function process(file,o,{signal,progress}){
  const source=await Im.decode(file);let result=null;
  try{
   const clean={...defaults(id),...o};
   result=await runRecipe(id,{source,items:[{name:file.name,blob:file}],options:clean,signal,progress});
   const zipped=result.kind==='file',name=zipped?`${stem(file.name)}-${id}.zip`:result.name,preview=zipped&&result.canvas?URL.createObjectURL(await Im.blobOf(result.canvas)):'';
   return {blob:result.blob,name,preview,zipped,contents:zipped?result.entries:null,count:result.outputCount||1,sourceWidth:result.width||source.width,sourceHeight:result.height||source.height,label:zipped?text('recipe.files',{n:result.outputCount}):`${result.width}×${result.height}`,
    note:zipped?text('recipe.zipNote',{n:result.outputCount}):`${source.width}×${source.height} → ${result.width}×${result.height}`};
  }finally{Im.release(result?.canvas);Im.release(source);}
 }
 const summary=ok=>({big:ok.length===1?ok[0].result.label:text('files',{n:ok.length}),only:true});
 return createBatch(ctx,{options,simple,advanced,read,reflect,process,summary,pill:it=>it.result.label,detail:it=>it.result.note,pixelated:!!form.pixelated,compareWhen:it=>!it.result?.zipped,contents:it=>it.result?.contents,advancedOpen:()=>!form.basic.length&&form.advanced.length>0});
}
