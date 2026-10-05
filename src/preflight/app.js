// @ts-check
import {ADAPTERS,emptyEnvironment,loadDatabase} from './adapters/index.js';
import {runPreflight,compareTargets} from './core/engine.js';
import {acceptsHost,hostName} from './core/adapter.js';
import {createCompatibilityIndex} from './core/resolver.js';
import {createCatalogIndex,parsePasteList,importEnvironment,hashName,validateEnvironment} from './core/parser.js';
import {POLICY} from './core/policy.js';
import {copySummary,exportJSON,exportCompatibilityReport,escapeHTML as e} from './core/report.js';
import {text,reasonText} from './messages.js';
import {listSetups,saveSetup,loadSetup,renameSetup,deleteSetup} from './storage/setups.js';
import {componentPicker} from './components/picker.js';
import {verdictHTML,actionsHTML,tableHTML,detailHTML,statusBadge} from './components/report-view.js';
/** @template {HTMLElement} T @param {string} selector @returns {T} */
function node(selector){const el=document.querySelector(selector);if(!el)throw Error('Missing UI element '+selector);return /** @type {T} */(el);}
/** @param {HTMLFormElement} form @param {string} name */
const control=(form,name)=>/** @type {HTMLInputElement} */(form.elements.namedItem(name));
/** @param {unknown} error */
const errorMessage=error=>error instanceof Error?error.message:String(error);
const root=document.querySelector('#preflight');
if(root)initialize(/** @type {HTMLElement} */(root)).catch(err=>{
 node('#pf-verdict').textContent=errorMessage(err);node('#pf-run').setAttribute('disabled','');
 root.setAttribute('aria-busy','false');
});
/** @param {HTMLElement} root */
async function initialize(root){
 const vertical=/** @type {import('./core/types').Vertical} */(root.dataset.vertical),adapter=ADAPTERS[vertical],locale=root.dataset.locale||'en';
 const t=(/** @type {string} */ key,/** @type {Record<string,string|number>} */ params={})=>text(locale,key,params);
 const database=await loadDatabase(vertical),index=createCatalogIndex(database.catalog),records=createCompatibilityIndex(database);
 const catalog=new Map(database.catalog.map(c=>[c.id,c]));
 let environment=emptyEnvironment(vertical),target=/** @type {import('./core/types').PreflightTarget} */(environment.target);
 /** @type {import('./core/types').PreflightResult|null} */
 let result=null;
 let filter='all',reportLimit=100,inventoryLimit=50,search='',savedId='',timer=0,analysisTimer=0;
 const expanded=new Set();
 /** @type {{component:import('./core/types').CompatibilityResult,text:string}[]} */
 let reportIndex=[];
 const envForm=/** @type {HTMLFormElement} */(node('#pf-environment')),addForm=/** @type {HTMLFormElement} */(node('#pf-add'));
 const notice=(/** @type {string} */ message,error=false)=>{
  const box=node('#pf-notice');box.textContent=message;box.hidden=false;box.classList.toggle('error',error);
  clearTimeout(timer);timer=window.setTimeout(()=>{box.hidden=true;},error?15000:5000);
 };
 const guard=(/** @type {()=>void} */ action)=>{try{action();}catch(err){notice(errorMessage(err),true);}};
 /** @returns {Storage} */
 const storage=()=>window.localStorage;
 const readTarget=()=>{
  const runtimes=Object.fromEntries(control(envForm,'runtimes').value.split(/\r?\n/).filter(s=>s.trim()).map(s=>{
   const at=s.indexOf('=');if(at<1||!s.slice(at+1).trim())throw Error('Runtime format: name=version');
   return [s.slice(0,at).trim(),s.slice(at+1).trim()];
  }));
  return /** @type {import('./core/types').PreflightTarget} */({version:control(envForm,'target').value.trim(),
   platform:control(envForm,'platform').value,architecture:control(envForm,'architecture').value,
   osVersion:control(envForm,'osVersion').value.trim(),runtimes,
   ...(vertical==='studio'?{daw:control(envForm,'daw').value.trim(),formats:[...envForm.querySelectorAll('input[name=format]:checked')].map(el=>/** @type {HTMLInputElement} */(el).value)}:{}),
   ...(vertical==='godot'?{renderer:control(envForm,'renderer').value,language:control(envForm,'language').value}:{})});
 };
 const syncForm=()=>{
  control(envForm,'current').value=environment.host.version;control(envForm,'target').value=target.version;
  control(envForm,'platform').value=target.platform;control(envForm,'architecture').value=target.architecture;
  control(envForm,'osVersion').value=target.osVersion||'';
  control(envForm,'runtimes').value=Object.entries(target.runtimes||{}).map(([k,v])=>k+'='+v).join('\n');
  if(vertical==='godot'){control(envForm,'renderer').value=target.renderer||'forward_plus';control(envForm,'language').value=target.language||'gdscript';}
  if(vertical==='studio'){control(envForm,'daw').value=target.daw||'';for(const el of envForm.querySelectorAll('input[name=format]'))/** @type {HTMLInputElement} */(el).checked=!!target.formats?.includes(/** @type {HTMLInputElement} */(el).value);}
  /** @type {HTMLInputElement} */(node('#pf-setup-name')).value=environment.name;
 };
 const renderTable=()=>{
  if(!result)return;
  const words=search.toLowerCase().split(/\s+/).filter(Boolean);
  const exactId=search.startsWith('id:')?search.slice(3):null;
  const rows=reportIndex.filter(({component:c,text})=>(exactId?c.component.id===exactId:words.every(w=>text.includes(w)))&&
   (filter==='all'||filter==='problems'&&!['READY','NOT_APPLICABLE'].includes(c.status)||filter==='updates'&&c.status==='UPDATE_REQUIRED'||filter==='unknown'&&c.status==='UNKNOWN'||filter==='ready'&&c.status==='READY')).map(r=>r.component);
  node('#pf-results').innerHTML=rows.length?tableHTML(rows.slice(0,reportLimit),locale):'<tr><td colspan="6">'+e(t('noResults'))+'</td></tr>';
  for(const c of rows.slice(0,reportLimit))if(expanded.has(c.component.id)){
   const row=document.getElementById('pf-detail-'+c.component.id);if(!row)continue;
   row.hidden=false;/** @type {HTMLElement} */(row.firstElementChild).innerHTML=detailHTML(c,catalog.get(c.component.id),locale);
   for(const b of node('#pf-results').querySelectorAll('[data-detail]'))if(/** @type {HTMLElement} */(b).dataset.detail===c.component.id)b.setAttribute('aria-expanded','true');
  }
  node('#pf-display-count').textContent=t('displayed',{shown:Math.min(reportLimit,rows.length),count:rows.length});
  node('#pf-more').hidden=rows.length<=reportLimit;
 };
 const renderInventory=()=>{
  node('#pf-inventory-count').textContent=String(environment.components.length);
  node('#pf-inventory').innerHTML=environment.components.slice(0,inventoryLimit).map(c=>'<div class="pf-inventory-row" data-id="'+e(c.id)+'"><span>'+e(c.name)+'<small>'+e(c.category)+' · '+e(c.id)+'</small></span><button type="button" data-remove="'+e(c.id)+'" aria-label="'+e(t('remove')+' '+c.name)+'">'+e(t('remove'))+'</button>'+
   '<label>'+e(t('version'))+'<input data-version="'+e(c.id)+'" maxlength="80" value="'+e(c.version||'')+'"></label>'+
   '<label class="pf-check"><input data-critical="'+e(c.id)+'" type="checkbox"'+(c.critical?' checked':'')+'>'+e(t('critical'))+'</label>'+
   '<label>'+e(t('installPath'))+'<input data-path="'+e(c.id)+'" value="'+e(c.installPath||'')+'" maxlength="1024"></label>'+
   '<label class="pf-check"><input data-ignore="'+e(c.id)+'" type="checkbox"'+(c.ignored?' checked':'')+'>'+e(t('ignore'))+'</label></div>').join('')+
   (environment.components.length>inventoryLimit?'<button type="button" data-inventory-more>'+e(t('showMore'))+'</button>':'');
 };
 const renderSaved=()=>{
  try{
   const list=listSetups(storage());
   node('#pf-saved').innerHTML=list.length?list.map(s=>'<div class="pf-saved-row"><input aria-label="'+e(t('setupName'))+'" data-saved-name="'+e(s.id)+'" value="'+e(s.name)+'" maxlength="100"><button type="button" data-load="'+e(s.id)+'">'+e(t('load'))+'</button><button type="button" data-rename="'+e(s.id)+'">'+e(t('rename'))+'</button><button type="button" data-delete="'+e(s.id)+'">'+e(t('remove'))+'</button><small>'+e(s.vertical)+' · '+e(s.updatedAt.slice(0,10))+(s.sample?' · SAMPLE DATA':'')+'</small></div>').join(''):'<p class="pf-muted">'+e(t('storageEmpty'))+'</p>';
  }catch(err){node('#pf-saved').textContent=errorMessage(err);}
 };
 const calculate=()=>{
  clearTimeout(analysisTimer);
  try{
   target=readTarget();environment.host.version=control(envForm,'current').value.trim();
   environment.target=target;environment.name=/** @type {HTMLInputElement} */(node('#pf-setup-name')).value.trim()||'My setup';
   result=runPreflight(environment,target,database,adapter,{index:records});
   reportIndex=result.components.map(component=>({component,text:[component.component.id,component.component.name,component.component.vendor,component.component.category,component.status].join(' ').toLowerCase()}));
   node('#pf-verdict').innerHTML=verdictHTML(result,locale);
   const provenance=node('#pf-provenance');provenance.textContent=t(result.sample?'sampleWarning':'realWarning');provenance.classList.toggle('sample',result.sample);
   node('#pf-actions').innerHTML=environment.components.length?actionsHTML(result,locale):'<p class="pf-muted">'+e(t('empty'))+'</p>';
   node('#pf-report').hidden=!environment.components.length;
   for(const id of ['pf-copy','pf-export','pf-export-report','pf-print'])/** @type {HTMLButtonElement} */(node('#'+id)).disabled=!environment.components.length;
   node('#pf-diff').innerHTML='';renderTable();
  }catch(err){
   result=null;node('#pf-verdict').textContent=errorMessage(err);node('#pf-report').hidden=true;node('#pf-actions').innerHTML='';node('#pf-diff').innerHTML='';
   for(const id of ['pf-copy','pf-export','pf-export-report','pf-print'])/** @type {HTMLButtonElement} */(node('#'+id)).disabled=true;
  }
 };
 const schedule=()=>{clearTimeout(analysisTimer);analysisTimer=window.setTimeout(calculate,150);};
 const adopt=(/** @type {import('./core/types').PreflightEnvironment} */ env)=>{
  if(!acceptsHost(adapter,env.host.name))throw Error('Expected host '+adapter.host);
  environment=env;target=env.target||{...target,platform:env.platform,architecture:env.architecture};
  expanded.clear();
  inventoryLimit=50;reportLimit=100;syncForm();renderInventory();calculate();
 };
 const addComponents=(/** @type {import('./core/types').PreflightComponent[]} */ additions)=>{
  const ids=new Set(environment.components.map(c=>c.id));
  const fresh=additions.filter(c=>!ids.has(c.id));
  if(environment.components.length+fresh.length>POLICY.maxComponents)throw Error('Maximum 10,000 components');
  if(!fresh.length)throw Error('No new components. This component is already in your setup.');
  // Validate before changing the existing environment.
  environment=validateEnvironment({...environment,components:[...environment.components,...fresh]});
  renderInventory();calculate();notice(t('added',{count:fresh.length}));
 };
 componentPicker(/** @type {HTMLInputElement} */(node('#pf-picker')),node('#pf-picker-options'),index,entry=>{
  control(addForm,'vendor').value=entry.vendor;control(addForm,'category').value=adapter.categories.includes(entry.category)?entry.category:'Other';
  control(addForm,'critical').checked=entry.critical!==false;
 });
 root.setAttribute('aria-busy','false');/** @type {HTMLButtonElement} */(node('#pf-run')).disabled=false;
 syncForm();renderSaved();calculate();
 envForm.addEventListener('submit',event=>{event.preventDefault();calculate();});
 envForm.addEventListener('input',schedule);envForm.addEventListener('change',event=>{
  if(event.target===control(envForm,'platform')){
   environment.platform=/** @type {import('./core/types').Platform} */(control(envForm,'platform').value);
   environment.host.name=hostName(adapter,environment.platform);
  }
  if(event.target===control(envForm,'architecture'))environment.architecture=/** @type {import('./core/types').Architecture} */(control(envForm,'architecture').value);
  calculate();
 });
 node('#pf-run').addEventListener('click',()=>{calculate();node('.pf-overview').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});});
 node('#pf-setup-name').addEventListener('input',schedule);
 for(const btn of root.querySelectorAll('[data-mode]'))btn.addEventListener('click',()=>{
  const mode=/** @type {HTMLElement} */(btn).dataset.mode;node('#pf-add').hidden=mode!=='manual';node('#pf-paste').hidden=mode!=='paste';
  for(const b of root.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b===btn));
 });
 addForm.addEventListener('submit',event=>{
  event.preventDefault();guard(()=>{
   const name=control(addForm,'name').value.trim(),known=index.find(name);if(!name)throw Error('Enter a component name');
   const deps=control(addForm,'dependencies').value.split(/\r?\n/).filter(s=>s.trim()).map(s=>{const [id,...range]=s.split('@');return {componentId:id.trim(),versionRange:range.join('@').trim()||undefined};});
   /** @type {import('./core/types').PreflightComponent} */
   const component={id:known?.id||'custom-'+hashName(name),name:known?.name||name,vendor:control(addForm,'vendor').value||known?.vendor||'',
    category:control(addForm,'category').value,version:control(addForm,'version').value.trim(),critical:control(addForm,'critical').checked,
    installPath:control(addForm,'installPath').value.trim(),installType:control(addForm,'installType').value,native:control(addForm,'native').checked,
    builtForHost:control(addForm,'builtForHost').value.trim(),dependencies:deps};
   if(control(addForm,'binaryArch').value)component.architecture=/** @type {import('./core/types').Architecture} */(control(addForm,'binaryArch').value);
   if(control(addForm,'binaryOS').value)component.platform=/** @type {import('./core/types').Platform} */(control(addForm,'binaryOS').value);
   addComponents([component]);addForm.reset();
  });
 });
 node('#pf-paste').addEventListener('submit',event=>{
  event.preventDefault();guard(()=>{const form=/** @type {HTMLFormElement} */(node('#pf-paste'));addComponents(parsePasteList(control(form,'list').value,index));control(form,'list').value='';});
 });
 node('#pf-sample').addEventListener('click',()=>guard(()=>{savedId='';adopt(structuredClone(database.sampleEnvironment));}));
 node('#pf-clear').addEventListener('click',()=>guard(()=>{savedId='';adopt(emptyEnvironment(vertical));}));
 node('#pf-import-label').addEventListener('keydown',event=>{const ev=/** @type {KeyboardEvent} */(event);if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();node('#pf-file').click();}});
 node('#pf-file').addEventListener('change',async()=>{
  const input=/** @type {HTMLInputElement} */(node('#pf-file')),file=input.files?.[0];if(!file)return;
  try{if(file.size>POLICY.maxImportBytes)throw Error('Import exceeds 5 MB');notice(t('importing'));
   const next=importEnvironment(await file.text(),vertical);
   if(!acceptsHost(adapter,next.host.name))throw Error('Expected host '+adapter.host);
   savedId='';adopt(next);notice(t('imported',{count:next.components.length}));
  }catch(err){notice(errorMessage(err),true);}finally{input.value='';}
 });
 node('#pf-inventory').addEventListener('click',event=>guard(()=>{
  const el=/** @type {HTMLElement} */(event.target),remove=el.closest('[data-remove]');
  if(remove){const id=/** @type {HTMLElement} */(remove).dataset.remove;environment.components=environment.components.filter(c=>c.id!==id);renderInventory();calculate();}
  if(el.hasAttribute('data-inventory-more')){inventoryLimit+=100;renderInventory();}
 }));
 root.addEventListener('change',event=>{
  const input=/** @type {HTMLInputElement} */(event.target);
  const id=input.dataset.version||input.dataset.critical||input.dataset.path||input.dataset.ignore;
  if(!id)return;
  const c=environment.components.find(c=>c.id===id);if(!c)return;
  if(input.dataset.version)c.version=input.value.trim();
  if(input.dataset.path)c.installPath=input.value.trim();
  if(input.dataset.critical)c.critical=input.checked;
  if(input.dataset.ignore)c.ignored=input.checked;
  calculate();
  if(input.dataset.ignore){const nextControl=document.getElementById('pf-detail-'+id)?.querySelector('input[data-ignore]');if(nextControl instanceof HTMLElement)nextControl.focus();}
 });
 node('#pf-save').addEventListener('click',()=>guard(()=>{calculate();if(!result)throw Error('Fix invalid input before saving');
  savedId=saveSetup(storage(),result.environment,savedId||undefined);renderSaved();notice(t('saved'));}));
 node('#pf-saved').addEventListener('click',event=>guard(()=>{
  const input=/** @type {HTMLElement} */(event.target),id=input.dataset.load||input.dataset.rename||input.dataset.delete;if(!id)return;
  if(input.dataset.load){const env=loadSetup(storage(),id);
   if(env.vertical!==vertical){window.location.href=new URL(locale+'/preflight/'+env.vertical+'/#setup='+encodeURIComponent(id),document.baseURI).href;return;}
   savedId=id;adopt(env);
  }else if(input.dataset.rename){const field=[...node('#pf-saved').querySelectorAll('[data-saved-name]')].find(el=>/** @type {HTMLElement} */(el).dataset.savedName===id);
   renameSetup(storage(),id,/** @type {HTMLInputElement} */(field).value);renderSaved();
   if(savedId===id){environment.name=/** @type {HTMLInputElement} */(field).value;/** @type {HTMLInputElement} */(node('#pf-setup-name')).value=environment.name;calculate();}
  }else if(input.dataset.delete){deleteSetup(storage(),id);if(savedId===id)savedId='';renderSaved();}
 }));
 if(location.hash.startsWith('#setup='))guard(()=>{const id=decodeURIComponent(location.hash.slice(7)),env=loadSetup(storage(),id);if(env.vertical!==vertical)throw Error('Wrong vertical for saved setup');savedId=id;adopt(env);history.replaceState(null,'',location.pathname);});
 for(const btn of root.querySelectorAll('[data-filter]'))btn.addEventListener('click',()=>{
  filter=/** @type {HTMLElement} */(btn).dataset.filter||'all';reportLimit=100;
  for(const b of root.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(btn===b));renderTable();
 });
 node('#pf-report-search').addEventListener('input',()=>{search=/** @type {HTMLInputElement} */(node('#pf-report-search')).value;reportLimit=100;renderTable();});
 node('#pf-more').addEventListener('click',()=>{reportLimit+=100;renderTable();});
 node('#pf-results').addEventListener('click',event=>{
  const el=/** @type {HTMLElement} */(event.target);
  const dep=/** @type {HTMLElement|null} */(el.closest('[data-dependency]'));
  if(dep&&result){
   const id=dep.dataset.dependency,position=result.components.findIndex(c=>c.component.id===id);
   if(position<0){notice('Required dependency is not in this inventory',true);return;}
   filter='all';search='id:'+id;reportLimit=100;expanded.add(id);
   /** @type {HTMLInputElement} */(node('#pf-report-search')).value=search;
   for(const b of root.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(/** @type {HTMLElement} */(b).dataset.filter==='all'));
   renderTable();document.getElementById('pf-detail-'+id)?.scrollIntoView({block:'center'});return;
  }
  const button=/** @type {HTMLElement|null} */(el.closest('[data-detail]'));if(!button||!result)return;
  const id=button.dataset.detail,c=result.components.find(c=>c.component.id===id),row=document.getElementById('pf-detail-'+id);
  if(!c||!row)return;
  const open=row.hidden;row.hidden=!open;
  if(open)expanded.add(id);else expanded.delete(id);
  for(const b of node('#pf-results').querySelectorAll('[data-detail]'))if(/** @type {HTMLElement} */(b).dataset.detail===id)b.setAttribute('aria-expanded',String(open));
  if(open)/** @type {HTMLElement} */(row.firstElementChild).innerHTML=detailHTML(c,catalog.get(c.component.id),locale);
 });
 node('#pf-compare').addEventListener('submit',event=>{
  event.preventDefault();guard(()=>{
   calculate();if(!result)throw Error('Fix invalid input');
   const version=control(/** @type {HTMLFormElement} */(node('#pf-compare')),'compareVersion').value.trim();
   const next=runPreflight(environment,{...target,version},database,adapter,{index:records}),diff=compareTargets(result,next);
   node('#pf-diff').innerHTML='<div class="pf-diff"><p>'+e(target.version)+' '+statusBadge(diff.before,locale,true)+' → '+e(version)+' '+statusBadge(diff.after,locale,true)+'</p>'+
    '<p>'+e(t('verdict.'+next.overallVerdict))+'</p><ul>'+next.reasons.map(r=>'<li>'+e(reasonText(locale,r))+'</li>').join('')+'</ul>'+
    (diff.changes.length?'<ul>'+diff.changes.slice(0,100).map(c=>'<li><b>'+e(c.name)+'</b>: '+statusBadge(c.before,locale)+' → '+statusBadge(c.after,locale)+
     '<p>'+c.reasons.map(r=>e(reasonText(locale,r))).join('<br>')+'</p></li>').join('')+'</ul>':'<p>'+e(t('compareEmpty'))+'</p>')+'</div>';
  });
 });
 const download=(/** @type {string} */ content,/** @type {string} */ type,/** @type {string} */ filename)=>{
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),30000);
 };
 node('#pf-export').addEventListener('click',()=>{calculate();if(result)download(exportJSON(result),'application/json','nerulio-preflight-'+vertical+'.json');});
 node('#pf-export-report').addEventListener('click',()=>{calculate();if(result)download(exportCompatibilityReport(result,locale),'text/html','nerulio-preflight-'+vertical+'.html');});
 node('#pf-copy').addEventListener('click',async()=>{
  calculate();if(!result)return;const summary=copySummary(result,locale);
  try{await navigator.clipboard.writeText(summary);notice(t('copied'));}
  catch{const fallback=node('#pf-copy-fallback');fallback.hidden=false;const area=/** @type {HTMLTextAreaElement} */(fallback.querySelector('textarea'));area.value=summary;area.focus();area.select();notice(t('copyFailed'));}
 });
 node('#pf-print').addEventListener('click',()=>{calculate();if(!result)return;
  document.querySelector('.pf-print-full')?.remove();
  const container=document.createElement('div');container.className='pf-print-full';
  const doc=new DOMParser().parseFromString(exportCompatibilityReport(result,locale),'text/html');container.innerHTML=doc.body.innerHTML;
  root.append(container);window.print();
 });
 window.addEventListener('afterprint',()=>document.querySelector('.pf-print-full')?.remove());
}
