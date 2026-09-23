/** Game landing pages (tools/game-landing-build.mjs): hand the dropped files to the Studio.
 * Files never leave the browser: they are parked in IndexedDB by src/task/handoff.js and the
 * Studio takes them on start (src/studio/app.js start()). Also: the language menu, and old Lab
 * links with settings in the query (e.g. ?stage=export) forwarded to the classic Lab page. */
import {stashFiles,takeHandoff} from './task/handoff.js';
const root=new URL('../',import.meta.url);
const LOCALES=['ko','en','ja'],STORAGE_KEY='fileforge.language.v1';
const main=document.querySelector('[data-game-landing]');
const $=s=>document.querySelector(s);
function parts(){
 const rel=location.pathname.startsWith(root.pathname)?location.pathname.slice(root.pathname.length):location.pathname.replace(/^\/+/,'');
 const seg=rel.split('/').filter(Boolean),locale=LOCALES.includes(seg[0])?seg.shift():null;
 return {locale,path:seg.join('/')};
}
const here=parts();
const prefix=here.locale?here.locale+'/':'';
let storage=null;try{storage=localStorage;}catch{}
const saved=()=>{try{const v=storage?.getItem(STORAGE_KEY);return LOCALES.includes(v)?v:null;}catch{return null;}};
const pageURL=(locale,search=location.search)=>new URL((locale?locale+'/':'')+(here.path?here.path+'/':'')+search+location.hash,root).href;
/** 1. Old deep links: the Lab kept its settings in the query; those belong to the classic page. */
const LAB_KEYS=/^(stage|mode|cellW|cellH|atlasPadding|maxSize|bg|kind|tileWidth|tileHeight|margin|spacing|preset|scale|format|layout|columns|padding|extrude|pot|trim)$/;
function forwardLegacy(){
 const classic=main?.dataset.classic;if(!classic)return false;
 const q=new URLSearchParams(location.search);
 if(![...q.keys()].some(k=>LAB_KEYS.test(k)))return false;
 location.replace(new URL(prefix+classic+'/'+location.search+location.hash,root).href);return true;
}
/** 2. Unprefixed URL = language negotiation (x-default): go to the visitor's language when it is not English. */
function negotiate(){
 if(here.locale)return false;
 const want=saved()||(navigator.languages||[navigator.language]).map(l=>String(l||'').toLowerCase().split('-')[0]).find(l=>LOCALES.includes(l));
 if(!want||want==='en')return false;
 location.replace(pageURL(want));return true;
}
function wireLanguage(){
 const select=$('#languageSelect');if(!select)return;
 select.value=here.locale||'auto';
 select.addEventListener('change',()=>{
  const v=select.value;try{if(v==='auto')storage?.removeItem(STORAGE_KEY);else storage?.setItem(STORAGE_KEY,v);}catch{}
  location.assign(pageURL(v==='auto'?null:v));
 });
}
/** 3. Files → Studio. A pack page imports through the Sprite workspace, then asks for Pack & Export. */
const status=text=>{const el=$('[data-gl-status]');if(!el)return;el.textContent=text;el.hidden=!text;};
const t=key=>({
 opening:{en:'Opening the Studio…',ko:'Studio를 여는 중…',ja:'Studioを開いています…'},
 failed:{en:'This browser did not let the page hand the files over. The Studio opens empty; drop the files there again.',ko:'이 브라우저가 파일 전달을 막았습니다. 빈 Studio가 열리면 파일을 다시 끌어다 놓으세요.',ja:'このブラウザがファイルの受け渡しを許可しませんでした。空のStudioが開くので、もう一度ドロップしてください。'}
}[key][document.documentElement.lang]||'');
let sending=false;
export async function openInStudio(files){
 files=[...files].filter(f=>f instanceof Blob&&f.size>0);if(!files.length||sending)return false;
 sending=true;status(t('opening'));
 const entry=$('[data-gl-entry]')?.value||main?.dataset.ws||'sprite',then=$('[data-gl-then]')?.value||'';
 const ok=await stashFiles(files,{from:'landing',page:main?.dataset.key||'',...(then?{workspace:then}:{})});
 if(!ok){status(t('failed'));await new Promise(r=>setTimeout(r,2500));}
 document.documentElement.dataset.glHandoff=ok?'stashed':'failed';
 location.assign(new URL(`${prefix}game/studio/?ws=${encodeURIComponent(entry)}`,root).href);
 return ok;
}
/** A dropped folder (e.g. numbered frames) is read entry by entry. */
async function filesOf(dt){
 const items=[...(dt.items||[])].map(i=>i.webkitGetAsEntry?.()).filter(Boolean);
 if(!items.some(e=>e.isDirectory))return [...(dt.files||[])];
 const out=[];
 const walk=async entry=>{
  if(entry.isFile){out.push(await new Promise((res,rej)=>entry.file(res,rej)));return;}
  const reader=entry.createReader();let batch;
  do{batch=await new Promise((res,rej)=>reader.readEntries(res,rej));for(const e of batch)await walk(e);}while(batch.length);
 };
 for(const e of items)await walk(e);
 return out;
}
function wireIntake(){
 const input=$('#glFiles'),zone=$('[data-gl-drop]');
 if(input){const accept=main?.dataset.accept;if(accept)input.accept=accept;input.addEventListener('change',()=>{const f=[...input.files];input.value='';openInStudio(f);});}
 const pick=()=>input?.click();
 document.addEventListener('click',e=>{if(e.target.closest('[data-gl-pick]')){e.preventDefault();e.stopPropagation();pick();return;}if(e.target.closest('[data-gl-drop]')&&!e.target.closest('a,button'))pick();});
 zone?.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target===zone){e.preventDefault();pick();}});
 let depth=0;const mark=()=>document.body.classList.toggle('gl-dragging',depth>0);
 addEventListener('dragenter',e=>{if(e.dataTransfer?.types?.includes('Files')){depth++;mark();}});
 addEventListener('dragleave',()=>{depth=Math.max(0,depth-1);mark();});
 addEventListener('dragover',e=>{if(e.dataTransfer?.types?.includes('Files'))e.preventDefault();});
 addEventListener('drop',async e=>{if(!e.dataTransfer)return;e.preventDefault();depth=0;mark();const files=await filesOf(e.dataTransfer).catch(()=>[...(e.dataTransfer.files||[])]);openInStudio(files);});
 addEventListener('paste',e=>{const f=[...(e.clipboardData?.files||[])];if(f.length){e.preventDefault();openInStudio(f);}});
}
async function boot(){
 if(!main)return;
 if(forwardLegacy()||negotiate())return;
 wireLanguage();wireIntake();
 // Files carried here from another Nerulio tool go straight on to the Studio.
 const carried=await takeHandoff();
 if(carried.files.length){openInStudio(carried.files);return;}
 document.documentElement.dataset.glReady='1';
}
boot();
