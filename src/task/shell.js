import {t,getLocale,setLocale,LOCALES,savePreference,locationParts,localizedURL,localeFromEnvironment} from '../i18n.js';
import {INTENTS,intentFor} from '../intents.js';
import {landingFor,landingText} from '../landings.js';
import {updateSiteContent} from '../site-content.js';
import {track,setAnalyticsContext,trafficSource} from '../analytics.js';
import {authorize} from '../entitlement.js';
import {BRAND} from '../brand.js';
import {TASK_TOOLS,kindOf} from './registry.js';
import {ui} from './strings.js';
import {takeFiles,stashFiles} from './handoff.js';
/** Shared runtime for the home directory and every single-task page: locale and URL, file
 * intake (picker, drop anywhere, paste, hand-off from another page), toast, download and
 * the Free-plan gate. A tool module only describes its own workspace. */
export const root=new URL('../../',import.meta.url);
const $=s=>document.querySelector(s);
let storage;try{storage=localStorage;}catch{}
const listeners=new Set();
export const page={id:'home',landing:'',path:'',auto:true,query:new URLSearchParams()};
export const locale=getLocale;
export const text=(key,vars)=>ui(getLocale(),key,vars);
export const onLocale=fn=>{listeners.add(fn);return ()=>listeners.delete(fn);};
export const pagePrefix=()=>page.auto?'':getLocale()+'/';
export const toolURL=(id,query='')=>localizedURL(INTENTS[id].path,page.auto?null:getLocale(),root,query).href;
let toastTimer=0;
export function toast(message,{error=false}={}){
 const el=$('#toast');if(!el)return;el.textContent=message;el.classList.toggle('error',error);el.hidden=false;
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},error?7000:3200);
}
export function download(blob,name){
 track('download');const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30_000);
}
/** Move on to another tool with files in hand; nothing leaves the device. */
export async function continueWith(id,files){await stashFiles(files);track('related_tool_click',{target_intent:id});location.assign(toolURL(id));}
export {authorize,track,kindOf};
function applyLocation(){
 const url=new URL(location.href),parts=locationParts(url.pathname,root.pathname);
 page.auto=!parts.locale;page.path=parts.path;page.query=url.searchParams;
 setLocale(localeFromEnvironment(url,root,{storage,languages:navigator.languages||[]}));
 page.id=parts.path?intentFor(parts.path):'home';page.landing=landingFor(parts.path)?.intent===page.id?parts.path:'';
}
function renderChrome(){
 const l=getLocale();document.documentElement.lang=l;
 const land=landingText(page.landing,l),title=page.id==='home'?text('homeTitle'):land?.title||t(`intent.${page.id}.title`),description=page.id==='home'?text('homeLead'):land?.description||t(`intent.${page.id}.description`);
 document.title=(page.id==='home'?BRAND.name+' — '+title:title+' · '+BRAND.name);
 for(const [sel,value]of [['meta[name="description"]',description],['meta[property="og:title"]',document.title],['meta[property="og:description"]',description]]){const m=$(sel);if(m)m.content=value;}
 const h=$('#taskTitle');if(h)h.textContent=title;const lead=$('#taskLead');if(lead)lead.textContent=description;
 const select=$('#languageSelect');if(select){select.options[0].textContent=t('language.auto');select.value=page.auto?'auto':l;}
 for(const el of document.querySelectorAll('[data-ui]'))el.textContent=text(el.dataset.ui);
 for(const a of document.querySelectorAll('[data-home-link]'))a.setAttribute('href',pagePrefix());
 updateSiteContent(page.id,l,page.landing);
}
function changeLanguage(value){
 page.auto=value==='auto';savePreference(page.auto?null:value,storage);
 const url=new URL(location.href);url.searchParams.delete('lang');
 setLocale(page.auto?localeFromEnvironment(new URL(root.href),root,{languages:navigator.languages||[]}):value);
 history.replaceState({},'',localizedURL(page.path,page.auto?null:getLocale(),root,url.search));
 renderChrome();for(const fn of listeners)fn(getLocale());
 setAnalyticsContext({intent:page.id,language:getLocale()});track('language_change');
}
/** Files reach a page four ways; all end in intake(files). */
function wireIntake(intake,{accept}={}){
 const input=$('#fileInput');if(input){if(accept)input.accept=accept;input.addEventListener('change',()=>{const files=[...input.files];input.value='';if(files.length)intake(files,'picker');});}
 let depth=0;const zone=()=>document.body.classList.toggle('dragging',depth>0);
 addEventListener('dragenter',e=>{if(e.dataTransfer?.types?.includes('Files')){depth++;zone();}});
 addEventListener('dragleave',()=>{depth=Math.max(0,depth-1);zone();});
 addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault();});
 addEventListener('drop',e=>{if(!e.dataTransfer?.files?.length)return;e.preventDefault();depth=0;zone();intake([...e.dataTransfer.files],'drop');});
 addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])];if(files.length&&!/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName||'')){e.preventDefault();intake(files,'paste');}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-action="pick"]'))input?.click();});
}
export async function boot(){
 applyLocation();renderChrome();
 $('#languageSelect')?.addEventListener('change',e=>changeLanguage(e.target.value));
 setAnalyticsContext({intent:page.id,landing_intent:page.id,language:getLocale(),device_class:matchMedia('(max-width: 640px)').matches?'mobile':'desktop',traffic_source:trafficSource(document.referrer,location.origin)});
 track('page_view');if(page.id!=='home')track('tool_open');
 if(page.id==='home'){const home=await import('./home.js');wireIntake(home.mount());return;}
 const def=TASK_TOOLS[page.id];if(!def)return;
 const tool=await import(`./${def.module}.js`),workspace=tool.mount({def,el:$('#taskApp')});
 const intake=(files,source)=>{
  const ok=files.filter(f=>def.kinds.includes(kindOf(f)));
  if(!ok.length){toast(text('wrongKind',{kind:def.kinds.map(k=>text('kinds.'+k)).join(' · ')}),{error:true});return;}
  track('file_selected',{count:ok.length,file_kind:def.kinds[0]});workspace.add(ok,source);
 };
 wireIntake(intake,{accept:tool.accept});
 const carried=await takeFiles();if(carried.length)intake(carried,'handoff');
}
boot();
